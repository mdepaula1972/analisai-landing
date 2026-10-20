import { createServiceRoleClient } from '@/lib/supabase-server';
import { generateCashLedgerPdfBuffer } from './cash-ledger-pdf';
import { sendEvolutionMedia, sendEvolutionText } from './evolution';
import JSZip from 'jszip';

export interface AccountingCsvEntry {
  formatted_date: string; // DD/MM/AAAA
  entry_type: 'INFLOW' | 'OUTFLOW' | 'C' | 'D';
  amount: number;
  category_name?: string;
  description?: string;
  document_number?: string;
  patrimonial_origin?: 'PJ' | 'PF';
  is_paid: boolean;
}

export interface AccountingPackageResult {
  competencePeriod: string; // ex: "09/2026"
  totalInflow: number;
  totalOutflow: number;
  netResult: number;
  documentsCount: number;
  csvContent: string;
  csvBuffer: Buffer;
  pdfBuffer: Buffer;
  zipBuffer: Buffer;
  csvFileName: string;
  pdfFileName: string;
  zipFileName: string;
  companyName: string;
  client: any;
}

/**
 * Gera o Extrato Contábil em CSV no layout universal de importação
 * compatível com Domínio Sistemas, Alterdata, Questor, Omie e ContaAzul.
 */
export function generateAccountingCsv(entries: AccountingCsvEntry[]): string {
  const headers = [
    'Data',
    'Tipo',
    'Valor',
    'Categoria_Contabil',
    'Favorecido_Descricao',
    'Documento_Fiscal',
    'Classificacao_Patrimonial',
    'Status',
  ];

  const rows = entries.map((entry) => [
    entry.formatted_date,
    entry.entry_type === 'INFLOW' || entry.entry_type === 'C' ? 'C' : 'D',
    Number(entry.amount || 0).toFixed(2),
    `"${(entry.category_name || 'Geral').replace(/"/g, '""')}"`,
    `"${(entry.description || '').replace(/"/g, '""')}"`,
    entry.document_number || 'N/A',
    entry.patrimonial_origin || 'PJ',
    entry.is_paid ? 'QUITADO' : 'PENDENTE',
  ]);

  // Inclui Byte Order Mark (BOM) UTF-8 para abertura impecável no Excel e sistemas Windows
  return '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
}

/**
 * Normaliza e resolve o período de competência fiscal (ex: "09/2026").
 * Se nenhum for informado, assume o mês anterior em relação ao fuso de Brasília.
 */
export function resolveCompetencePeriod(requestedPeriod?: string): {
  competence: string;
  year: number;
  month: number;
  startDate: string;
  endDate: string;
} {
  const brDateFormatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [currentDay, currentMonthStr, currentYearStr] = brDateFormatter.format(new Date()).split('/');
  const currentMonth = parseInt(currentMonthStr, 10);
  const currentYear = parseInt(currentYearStr, 10);

  let targetYear = currentYear;
  let targetMonth = currentMonth - 1;

  if (targetMonth === 0) {
    targetMonth = 12;
    targetYear = currentYear - 1;
  }

  if (requestedPeriod && requestedPeriod.includes('/')) {
    const parts = requestedPeriod.split('/');
    if (parts.length === 2) {
      const pMonth = parseInt(parts[0], 10);
      const pYear = parseInt(parts[1], 10);
      if (!isNaN(pMonth) && !isNaN(pYear) && pMonth >= 1 && pMonth <= 12) {
        targetMonth = pMonth;
        targetYear = pYear < 100 ? 2000 + pYear : pYear;
      }
    }
  }

  const mStr = String(targetMonth).padStart(2, '0');
  const competence = `${mStr}/${targetYear}`;

  // Calcula o último dia do mês alvo
  const lastDay = new Date(targetYear, targetMonth, 0).getDate();
  const startDate = `${targetYear}-${mStr}-01`;
  const endDate = `${targetYear}-${mStr}-${String(lastDay).padStart(2, '0')}`;

  return {
    competence,
    year: targetYear,
    month: targetMonth,
    startDate,
    endDate,
  };
}

/**
 * Busca todos os registros contábeis do cliente para o período de apuração
 */
export async function fetchClientAccountingData(clientId: string, requestedPeriod?: string) {
  const supabase = createServiceRoleClient();
  const period = resolveCompetencePeriod(requestedPeriod);

  // 1. Dados cadastrais do cliente
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();

  if (clientErr || !client) {
    throw new Error(`Cliente não localizado: ${clientId}`);
  }

  // 2. Lançamentos realizados no Livro Caixa (entradas e saídas)
  const { data: ledgerEntries } = await supabase
    .from('cash_ledger_entries')
    .select('*')
    .eq('client_id', clientId)
    .gte('entry_date', period.startDate)
    .lte('entry_date', period.endDate)
    .order('entry_date', { ascending: true });

  // 3. Contas a pagar e receber do período (incluindo tributos como DAS-MEI)
  const { data: payablesReceivables } = await supabase
    .from('payables_receivables')
    .select('*')
    .eq('client_id', clientId)
    .or(`tax_competence.eq.${period.competence},and(current_due_date.gte.${period.startDate},current_due_date.lte.${period.endDate})`)
    .order('current_due_date', { ascending: true });

  // 4. Documentos fiscais e comprovantes vinculados ao período
  const { data: documents } = await supabase
    .from('documents')
    .select('id, storage_path, file_name, mime_type, doc_type, created_at')
    .eq('client_id', clientId)
    .gte('created_at', `${period.startDate}T00:00:00.000Z`)
    .lte('created_at', `${period.endDate}T23:59:59.999Z`);

  const csvEntries: AccountingCsvEntry[] = [];
  let totalInflow = 0;
  let totalOutflow = 0;

  // Processa itens do Livro Caixa
  for (const entry of ledgerEntries || []) {
    const [y, m, d] = (entry.entry_date || '').split('-');
    const formattedDate = d && m && y ? `${d}/${m}/${y}` : entry.entry_date;
    const amountNum = Number(entry.amount) || 0;
    const isInflow = entry.entry_type === 'income';

    if (isInflow) {
      totalInflow += amountNum;
    } else {
      totalOutflow += amountNum;
    }

    csvEntries.push({
      formatted_date: formattedDate,
      entry_type: isInflow ? 'INFLOW' : 'OUTFLOW',
      amount: amountNum,
      category_name: entry.dre_group || 'despesa_operacional',
      description: entry.description,
      document_number: entry.document_id ? entry.document_id.slice(0, 8) : 'N/A',
      patrimonial_origin: 'PJ',
      is_paid: entry.status === 'realizado',
    });
  }

  // Complementa com contas a pagar/receber que ainda não foram para o ledger
  for (const bill of payablesReceivables || []) {
    // Evita duplicar se já foi dado baixa em cash_ledger_entries
    const alreadyInLedger = (ledgerEntries || []).some(
      (le: any) =>
        Math.abs(Number(le.amount) - Number(bill.amount)) < 0.01 &&
        le.description.toLowerCase().includes(bill.counterparty_name.toLowerCase().slice(0, 5))
    );

    if (!alreadyInLedger) {
      const [y, m, d] = (bill.current_due_date || '').split('-');
      const formattedDate = d && m && y ? `${d}/${m}/${y}` : bill.current_due_date;
      const amountNum = Number(bill.amount) || 0;
      const isReceivable = bill.type === 'receivable';

      if (bill.status === 'paid') {
        if (isReceivable) totalInflow += amountNum;
        else totalOutflow += amountNum;
      }

      csvEntries.push({
        formatted_date: formattedDate,
        entry_type: isReceivable ? 'INFLOW' : 'OUTFLOW',
        amount: amountNum,
        category_name: bill.is_government_tax ? 'Impostos / Tributos' : (isReceivable ? 'Recebimentos' : 'Contas a Pagar'),
        description: bill.counterparty_name,
        document_number: bill.tax_competence ? `DAS-${bill.tax_competence}` : 'Boleto/Pix',
        patrimonial_origin: 'PJ',
        is_paid: bill.status === 'paid',
      });
    }
  }

  // Ordena por data
  csvEntries.sort((a, b) => {
    const parseD = (s: string) => {
      const parts = s.split('/');
      return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : s;
    };
    return parseD(a.formatted_date).localeCompare(parseD(b.formatted_date));
  });

  const netResult = totalInflow - totalOutflow;
  const documentsCount = documents?.length || 0;

  return {
    client,
    period,
    csvEntries,
    documents: documents || [],
    totalInflow,
    totalOutflow,
    netResult,
    documentsCount,
  };
}

/**
 * Constrói o Pacote Consolidado de Fechamento Contábil:
 * - Extrato Contábil estruturado em CSV
 * - Relatório diagramado em PDF
 * - Compactador ZIP contendo extrato, relatório e a pasta /comprovantes/
 */
export async function buildAccountingClosingPackage(
  clientId: string,
  requestedPeriod?: string
): Promise<AccountingPackageResult> {
  const data = await fetchClientAccountingData(clientId, requestedPeriod);
  const companySafe = (data.client.company_name || data.client.name || 'Empresa')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .slice(0, 30);
  const competenceSafe = data.period.competence.replace('/', '_');

  const csvFileName = `extrato_movimentacao_${competenceSafe}.csv`;
  const pdfFileName = `relatorio_fechamento_${competenceSafe}.pdf`;
  const zipFileName = `Fechamento_Contabil_${competenceSafe}_${companySafe}.zip`;

  // 1. Gera CSV
  const csvContent = generateAccountingCsv(data.csvEntries);
  const csvBuffer = Buffer.from(csvContent, 'utf-8');

  // 2. Gera PDF Consolidado
  const pdfResult = await generateCashLedgerPdfBuffer(clientId);
  const pdfBuffer = pdfResult.buffer;

  // 3. Monta o Pacote ZIP via JSZip
  const zip = new JSZip();
  zip.file(csvFileName, csvBuffer);
  zip.file(pdfFileName, pdfBuffer);

  // Pasta de comprovantes fiscais
  const comprovantesFolder = zip.folder('comprovantes');
  if (comprovantesFolder && data.documents.length > 0) {
    const supabase = createServiceRoleClient();
    for (const doc of data.documents) {
      if (doc.storage_path) {
        try {
          const { data: fileBlob, error: downloadErr } = await supabase.storage
            .from('documents')
            .download(doc.storage_path);

          if (!downloadErr && fileBlob) {
            const arrayBuf = await fileBlob.arrayBuffer();
            const safeName = (doc.file_name || `comprovante_${doc.id.slice(0, 8)}`).replace(/[^\w.-]/g, '_');
            comprovantesFolder.file(safeName, Buffer.from(arrayBuf));
          }
        } catch (downloadEx) {
          console.warn(`[Closing Package] Não foi possível incluir documento ${doc.storage_path}:`, downloadEx);
        }
      }
    }
  }

  const zipUint8 = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  const zipBuffer = Buffer.from(zipUint8);

  return {
    competencePeriod: data.period.competence,
    totalInflow: data.totalInflow,
    totalOutflow: data.totalOutflow,
    netResult: data.netResult,
    documentsCount: data.documentsCount,
    csvContent,
    csvBuffer,
    pdfBuffer,
    zipBuffer,
    csvFileName,
    pdfFileName,
    zipFileName,
    companyName: data.client.company_name || data.client.name,
    client: data.client,
  };
}

/**
 * Persiste o registro do fechamento mensal no banco de dados e salva os arquivos no Supabase Storage
 */
export async function persistMonthlyClosingRecord(
  pkg: AccountingPackageResult,
  sentToAccountant: boolean = false
): Promise<string> {
  const supabase = createServiceRoleClient();
  let csvStoragePath: string | null = null;
  let zipStoragePath: string | null = null;

  try {
    const competenceSlug = pkg.competencePeriod.replace('/', '-');
    const folder = `${pkg.client.id}/${competenceSlug}`;

    // Tenta upload do CSV
    const csvDest = `${folder}/${pkg.csvFileName}`;
    const { error: csvUploadErr } = await supabase.storage
      .from('client-exports')
      .upload(csvDest, pkg.csvBuffer, { contentType: 'text/csv; charset=utf-8', upsert: true });

    if (!csvUploadErr) {
      csvStoragePath = csvDest;
    }

    // Tenta upload do ZIP
    const zipDest = `${folder}/${pkg.zipFileName}`;
    const { error: zipUploadErr } = await supabase.storage
      .from('client-exports')
      .upload(zipDest, pkg.zipBuffer, { contentType: 'application/zip', upsert: true });

    if (!zipUploadErr) {
      zipStoragePath = zipDest;
    }
  } catch (storageErr) {
    console.warn('[Closing Package] Erro ao salvar arquivos no storage client-exports:', storageErr);
  }

  const { data: record, error: dbErr } = await supabase
    .from('monthly_closings')
    .insert({
      client_id: pkg.client.id,
      competence_period: pkg.competencePeriod,
      total_inflow: pkg.totalInflow,
      total_outflow: pkg.totalOutflow,
      net_result: pkg.netResult,
      documents_count: pkg.documentsCount,
      csv_storage_path: csvStoragePath,
      zip_storage_path: zipStoragePath,
      sent_to_accountant_at: sentToAccountant ? new Date().toISOString() : null,
    })
    .select('id')
    .single();

  if (dbErr) {
    console.error('[Closing Package] Erro ao gravar registro na tabela monthly_closings:', dbErr);
  }

  return record?.id || '';
}

/**
 * Gera e envia o pacote de fechamento contábil para o cliente (e contador se aplicável) via WhatsApp
 */
export async function generateAndSendAccountingClosing(params: {
  clientId: string;
  phone: string;
  requestedPeriod?: string;
  dispatchToAccountant?: boolean;
}): Promise<{ success: boolean; message: string; pkg?: AccountingPackageResult }> {
  try {
    // 1. Gera o pacote contábil
    const pkg = await buildAccountingClosingPackage(params.clientId, params.requestedPeriod);

    const inflowFmt = pkg.totalInflow.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const outflowFmt = pkg.totalOutflow.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const netFmt = pkg.netResult.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const summaryText =
      `📊 *Fechamento Contábil Concluído (${pkg.competencePeriod})*\n\n` +
      `• *Entradas:* ${inflowFmt}\n` +
      `• *Saídas:* ${outflowFmt}\n` +
      `• *Resultado Líquido:* ${netFmt}\n` +
      `• *Documentos anexados:* ${pkg.documentsCount}\n\n` +
      `📄 Segue anexo o arquivo CSV pronto para importação no sistema do seu contador e o relatório em PDF.`;

    // 2. Envia Extrato CSV
    await sendEvolutionMedia({
      phone: params.phone,
      mediaBase64: pkg.csvBuffer.toString('base64'),
      mediaType: 'document',
      fileName: pkg.csvFileName,
      mimeType: 'text/csv',
      caption: `📑 Extrato de Movimentação Contábil (${pkg.competencePeriod})`,
    });

    // 3. Envia Relatório PDF
    await sendEvolutionMedia({
      phone: params.phone,
      mediaBase64: pkg.pdfBuffer.toString('base64'),
      mediaType: 'document',
      fileName: pkg.pdfFileName,
      mimeType: 'application/pdf',
      caption: `📊 Relatório Financeiro e DRE (${pkg.competencePeriod})`,
    });

    // 4. Envia o Pacote ZIP se houver documentos e o tamanho for viável para WhatsApp (< 15MB)
    if (pkg.zipBuffer.length > 0 && pkg.zipBuffer.length < 15 * 1024 * 1024) {
      await sendEvolutionMedia({
        phone: params.phone,
        mediaBase64: pkg.zipBuffer.toString('base64'),
        mediaType: 'document',
        fileName: pkg.zipFileName,
        mimeType: 'application/zip',
        caption: `📦 Pacote Completo de Fechamento com Comprovantes (${pkg.competencePeriod})`,
      });
    }

    // 5. Envia o texto resumo
    await sendEvolutionText({
      phone: params.phone,
      text: summaryText,
    });

    let sentToAccountant = false;

    // 6. Envio para o Contador Vinculado (se solicitado ou se auto_send ativo)
    const shouldSendToAccountant = params.dispatchToAccountant || pkg.client.auto_send_monthly_closing;
    const accountantPhone = pkg.client.accountant_phone?.replace(/\D/g, '');

    if (shouldSendToAccountant && accountantPhone && accountantPhone !== params.phone.replace(/\D/g, '')) {
      try {
        const accountantSummary =
          `👋 Olá, *${pkg.client.accountant_name || 'Contador(a)'}*!\n\n` +
          `Aqui é o **AnalisAí**, assistente contábil e financeiro da empresa *${pkg.companyName}*.\n\n` +
          `O titular autorizou o envio mensal automático do pacote de fechamento contábil referente à competência *${pkg.competencePeriod}*:\n` +
          `• *Entradas:* ${inflowFmt}\n` +
          `• *Saídas:* ${outflowFmt}\n` +
          `• *Resultado:* ${netFmt}\n` +
          `• *Documentos auditados:* ${pkg.documentsCount}\n\n` +
          `📁 Seguem em anexo o arquivo CSV formatado para importação direta no seu sistema contábil (Domínio, Alterdata, Questor, etc.) e o relatório consolidado em PDF.`;

        await sendEvolutionText({
          phone: accountantPhone,
          text: accountantSummary,
        });

        await sendEvolutionMedia({
          phone: accountantPhone,
          mediaBase64: pkg.csvBuffer.toString('base64'),
          mediaType: 'document',
          fileName: pkg.csvFileName,
          mimeType: 'text/csv',
          caption: `📑 Extrato Contábil — ${pkg.companyName} (${pkg.competencePeriod})`,
        });

        await sendEvolutionMedia({
          phone: accountantPhone,
          mediaBase64: pkg.pdfBuffer.toString('base64'),
          mediaType: 'document',
          fileName: pkg.pdfFileName,
          mimeType: 'application/pdf',
          caption: `📊 Relatório Consolidado — ${pkg.companyName} (${pkg.competencePeriod})`,
        });

        if (pkg.zipBuffer.length > 0 && pkg.zipBuffer.length < 15 * 1024 * 1024) {
          await sendEvolutionMedia({
            phone: accountantPhone,
            mediaBase64: pkg.zipBuffer.toString('base64'),
            mediaType: 'document',
            fileName: pkg.zipFileName,
            mimeType: 'application/zip',
            caption: `📦 Pacote ZIP com Comprovantes — ${pkg.companyName} (${pkg.competencePeriod})`,
          });
        }

        sentToAccountant = true;
        console.log(`[Closing Package] Pacote enviado com sucesso ao contador (${accountantPhone})`);
      } catch (accErr) {
        console.error('[Closing Package] Erro ao enviar pacote para o contador:', accErr);
      }
    }

    // 7. Persiste o histórico no Supabase
    await persistMonthlyClosingRecord(pkg, sentToAccountant);

    return {
      success: true,
      message: 'Pacote de fechamento contábil gerado e enviado com sucesso.',
      pkg,
    };
  } catch (err: any) {
    console.error('[Closing Package] Falha ao processar fechamento contábil:', err);
    return {
      success: false,
      message: err.message || 'Erro inesperado ao gerar fechamento contábil.',
    };
  }
}
