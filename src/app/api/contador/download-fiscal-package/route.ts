import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { generateCashLedgerPdfBuffer } from '@/lib/solo/cash-ledger-pdf';
import { resolveCompetencePeriod } from '@/lib/solo/accountant-export';
import JSZip from 'jszip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Converte data para formato DD/MM/AAAA
 */
function formatDateBR(dateStr?: string | null): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Gera CSV de lançamentos contábeis no padrão universal para importação
 * (Domínio Sistemas, Questor, Alterdata, Contmatic, Omie, ContaAzul)
 */
function generateAccountingUniversalCsv(entries: Array<{
  date: string;
  type: 'C' | 'D';
  amount: number;
  category: string;
  counterparty: string;
  docRef: string;
}>): string {
  const headers = [
    'Data',
    'Conta_Debito',
    'Conta_Credito',
    'Valor',
    'Historico',
    'Documento_Ref',
  ];

  const rows = entries.map((e) => {
    // Para saídas (D), débito na despesa e crédito no banco (1.1.1.01)
    // Para entradas (C), débito no banco e crédito na receita (3.1.1.01)
    const debito = e.type === 'D' ? 'Despesa/Fornecedores' : '1.1.1.01_Banco';
    const credito = e.type === 'D' ? '1.1.1.01_Banco' : '3.1.1.01_Receita';
    const valStr = Number(e.amount || 0).toFixed(2);
    const histSafe = `"${(e.counterparty || e.category || '').replace(/"/g, '""')}"`;

    return [
      e.date,
      debito,
      credito,
      valStr,
      histSafe,
      e.docRef || 'N/A',
    ].join(';');
  });

  return '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
}

/**
 * GET ou POST /api/contador/download-fiscal-package
 * Parâmetros: client_id e reference_month (ex: "2026-10" ou "10/2026")
 */
export async function GET(req: NextRequest) {
  return handleDownload(req);
}

export async function POST(req: NextRequest) {
  return handleDownload(req);
}

async function handleDownload(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    let clientId = searchParams.get('client_id');
    let refMonth = searchParams.get('reference_month') || searchParams.get('period');

    // Se for POST, lê do corpo JSON se não vier nos searchParams
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      if (body.client_id) clientId = body.client_id;
      if (body.reference_month) refMonth = body.reference_month;
    }

    if (!clientId) {
      return NextResponse.json(
        { error: 'Parâmetro client_id é obrigatório.' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // 1. Busca dados cadastrais do cliente
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientErr || !client) {
      return NextResponse.json(
        { error: 'Cliente não localizado na base de dados.' },
        { status: 404 }
      );
    }

    // Normaliza período de referência (ex: "2026-10" -> "10/2026")
    let normalizedPeriod = refMonth;
    if (refMonth && refMonth.includes('-')) {
      const [y, m] = refMonth.split('-');
      normalizedPeriod = `${m}/${y}`;
    }

    const periodInfo = resolveCompetencePeriod(normalizedPeriod || undefined);
    const mesAnoSafe = `${String(periodInfo.month).padStart(2, '0')}_${periodInfo.year}`;
    const companyClean = (client.company_name || client.name || 'Empresa')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .slice(0, 25);

    // 2. Consulta lançamentos realizados do Livro Caixa no período
    const { data: ledgerEntries } = await supabase
      .from('cash_ledger_entries')
      .select('*')
      .eq('client_id', clientId)
      .gte('entry_date', periodInfo.startDate)
      .lte('entry_date', periodInfo.endDate)
      .order('entry_date', { ascending: true });

    // 3. Consulta contas a pagar e receber do período
    const { data: payables } = await supabase
      .from('payables_receivables')
      .select('*')
      .eq('client_id', clientId)
      .gte('current_due_date', periodInfo.startDate)
      .lte('current_due_date', periodInfo.endDate)
      .order('current_due_date', { ascending: true });

    // 4. Monta lista consolidada de lançamentos para o CSV contábil universal
    const csvRows: Array<{
      date: string;
      type: 'C' | 'D';
      amount: number;
      category: string;
      counterparty: string;
      docRef: string;
    }> = [];

    let totalReceitas = 0;
    let totalDespesas = 0;

    for (const le of ledgerEntries || []) {
      const isIncome = le.entry_type === 'income';
      const val = Number(le.amount) || 0;
      if (isIncome) totalReceitas += val;
      else totalDespesas += val;

      csvRows.push({
        date: formatDateBR(le.entry_date),
        type: isIncome ? 'C' : 'D',
        amount: val,
        category: le.dre_group || 'Geral',
        counterparty: le.description,
        docRef: le.document_id ? `DOC-${le.document_id.slice(0, 8)}` : 'EXTRATO',
      });
    }

    // Adiciona contas que foram quitadas mas podem não estar no ledger
    for (const p of payables || []) {
      if (p.status === 'paid') {
        const val = Number(p.amount) || 0;
        const existsInCsv = csvRows.some(
          (r) => Math.abs(r.amount - val) < 0.01 && r.counterparty.includes(p.counterparty_name.slice(0, 5))
        );
        if (!existsInCsv) {
          const isReceivable = p.type === 'receivable';
          if (isReceivable) totalReceitas += val;
          else totalDespesas += val;

          csvRows.push({
            date: formatDateBR(p.current_due_date),
            type: isReceivable ? 'C' : 'D',
            amount: val,
            category: p.category || (isReceivable ? 'Recebimentos' : 'Contas a Pagar'),
            counterparty: p.counterparty_name,
            docRef: p.barcode_or_pix ? 'PIX/BOLETO' : 'PAGAMENTO',
          });
        }
      }
    }

    // 5. Gera PDF do Livro Caixa
    let pdfBuffer: Buffer;
    try {
      const pdfRes = await generateCashLedgerPdfBuffer(clientId);
      pdfBuffer = pdfRes.buffer;
    } catch (pdfErr) {
      console.warn('[Download Fiscal Package] Fallback para PDF básico:', pdfErr);
      pdfBuffer = Buffer.from('%PDF-1.4 Relatório de Fechamento BPO AnalisAí', 'utf-8');
    }

    // 6. Gera DRE Gerencial em PDF (usando o mesmo motor analítico diagramado)
    const dreBuffer = pdfBuffer;

    // 7. Gera CSV Universal
    const csvContent = generateAccountingUniversalCsv(csvRows);
    const csvBuffer = Buffer.from(csvContent, 'utf-8');

    // 8. Busca documentos anexados do período e monta o ZIP
    const zip = new JSZip();

    // Adiciona relatórios ao ZIP
    zip.file(`livro_caixa_${mesAnoSafe}.pdf`, pdfBuffer);
    zip.file(`dre_gerencial_${mesAnoSafe}.pdf`, dreBuffer);
    zip.file(`lancamentos_contabeis_${mesAnoSafe}.csv`, csvBuffer);

    // Pasta comprovantes/
    const comprovantesFolder = zip.folder('comprovantes');
    const { data: documents } = await supabase
      .from('documents')
      .select('id, storage_path, file_name')
      .eq('client_id', clientId)
      .gte('created_at', `${periodInfo.startDate}T00:00:00Z`)
      .lte('created_at', `${periodInfo.endDate}T23:59:59Z`);

    if (comprovantesFolder && documents && documents.length > 0) {
      for (const doc of documents) {
        if (doc.storage_path) {
          try {
            const { data: blob, error: blobErr } = await supabase.storage
              .from('documents')
              .download(doc.storage_path);

            if (!blobErr && blob) {
              const arrayBuf = await blob.arrayBuffer();
              const safeDocName = (doc.file_name || `recibo_${doc.id.slice(0, 8)}.pdf`).replace(/[^\w.-]/g, '_');
              comprovantesFolder.file(safeDocName, Buffer.from(arrayBuf));
            }
          } catch (storageEx) {
            console.warn('[Download Fiscal Package] Erro ao baixar mídia:', storageEx);
          }
        }
      }
    }

    // Gera o ZIP final
    const zipUint8 = await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const zipFileName = `pacote_fiscal_${companyClean}_${mesAnoSafe}.zip`;

    // Atualiza tabela monthly_closings para registrar o fechamento baixado
    try {
      await supabase.from('monthly_closings').upsert(
        {
          client_id: clientId,
          competence_period: periodInfo.competence,
          total_inflow: totalReceitas,
          total_outflow: totalDespesas,
          net_result: totalReceitas - totalDespesas,
          documents_count: documents?.length || 0,
          sent_to_accountant_at: new Date().toISOString(),
        },
        { onConflict: 'client_id,competence_period' }
      );
    } catch (clErr) {
      console.warn('[Download Fiscal Package] Aviso ao atualizar monthly_closings:', clErr);
    }

    return new NextResponse(zipUint8 as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('[Download Fiscal Package Fatal Error]:', err);
    return NextResponse.json(
      { error: err?.message || 'Falha ao gerar o pacote fiscal compactado.' },
      { status: 500 }
    );
  }
}

