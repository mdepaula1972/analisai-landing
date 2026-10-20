import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { generateAndSendAccountingClosing, resolveCompetencePeriod } from '@/lib/solo/accountant-export';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Cron Mensal de Fechamento Contábil
 * Programado para rodar no início de cada mês (1º dia útil)
 * 1. Identifica microempresas ativas com 'auto_send_monthly_closing = true'.
 * 2. Gera o pacote consolidado (CSV, PDF, ZIP com comprovantes) do mês anterior.
 * 3. Envia diretamente para o titular e para o contador parceiro vinculado via WhatsApp.
 */
export async function GET(req: NextRequest) {
  // Validação de segurança para Vercel Cron
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const urlKey = req.nextUrl.searchParams.get('key');
    if (urlKey !== cronSecret) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const force = req.nextUrl.searchParams.get('force') === 'true';

  // Validação do dia de execução no fuso de Brasília
  const brDateFormatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [dayStr, monthStr, yearStr] = brDateFormatter.format(new Date()).split('/');
  const currentDay = parseInt(dayStr, 10);

  // Executa normalmente nos primeiros 5 dias do mês (garantindo o 1º dia útil)
  if (!force && currentDay > 5) {
    return NextResponse.json({
      message: 'Cron de fechamento contábil executado apenas nos primeiros 5 dias do mês.',
      currentDay,
    });
  }

  const competenceInfo = resolveCompetencePeriod();
  const supabase = createServiceRoleClient();

  // 1. Busca todos os clientes ativos com envio contábil automático ativo
  const { data: eligibleClients, error: clientsErr } = await supabase
    .from('clients')
    .select('id, name, company_name, whatsapp_number, accountant_name, accountant_phone, accountant_email, auto_send_monthly_closing')
    .eq('status', 'active')
    .eq('auto_send_monthly_closing', true);

  if (clientsErr) {
    console.error('[Monthly Closing Cron] Erro ao buscar clientes:', clientsErr);
    return NextResponse.json({ error: 'database_error', details: clientsErr.message }, { status: 500 });
  }

  let processedCount = 0;
  let successCount = 0;
  const results: any[] = [];

  for (const client of eligibleClients || []) {
    if (!client.whatsapp_number) continue;
    processedCount++;

    // Idempotência: verifica se o fechamento desta competência já foi disparado
    const { data: existingClosing } = await supabase
      .from('monthly_closings')
      .select('id, sent_to_accountant_at')
      .eq('client_id', client.id)
      .eq('competence_period', competenceInfo.competence)
      .limit(1)
      .maybeSingle();

    if (existingClosing && !force) {
      results.push({
        clientId: client.id,
        name: client.name,
        status: 'already_processed',
        closingId: existingClosing.id,
      });
      continue;
    }

    try {
      const dispatchRes = await generateAndSendAccountingClosing({
        clientId: client.id,
        phone: client.whatsapp_number,
        requestedPeriod: competenceInfo.competence,
        dispatchToAccountant: true,
      });

      if (dispatchRes.success) {
        successCount++;
        results.push({
          clientId: client.id,
          name: client.name,
          status: 'success',
          competence: competenceInfo.competence,
          totalInflow: dispatchRes.pkg?.totalInflow,
          totalOutflow: dispatchRes.pkg?.totalOutflow,
        });
      } else {
        results.push({
          clientId: client.id,
          name: client.name,
          status: 'failed',
          error: dispatchRes.message,
        });
      }
    } catch (clientErr: any) {
      console.error(`[Monthly Closing Cron] Erro ao processar fechamento do cliente ${client.id}:`, clientErr);
      results.push({
        clientId: client.id,
        name: client.name,
        status: 'error',
        error: clientErr.message,
      });
    }
  }

  return NextResponse.json({
    success: true,
    competence: competenceInfo.competence,
    currentDay,
    totalEligible: eligibleClients?.length || 0,
    processedCount,
    successCount,
    results,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
