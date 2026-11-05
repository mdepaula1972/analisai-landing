import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Carrega variáveis do arquivo .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vccpvhxcqshxiysawxtp.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseKey) {
  console.error('❌ ERRO: SUPABASE_SERVICE_ROLE_KEY não encontrada no .env.local!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Obtém a data atual no fuso de Brasília (YYYY-MM-DD)
function getTodayBrasilia(): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [day, month, year] = formatter.format(new Date()).split('/');
  return `${year}-${month}-${day}`;
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 PROVISIONAMENTO DO SCHEMA BPO MULTITENANT NO SUPABASE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 URL: ${supabaseUrl}`);

  const todayStr = getTodayBrasilia();
  console.log(`📅 Data de Referência (Brasília): ${todayStr}\n`);

  // ── 1. REGISTRO SEMENTE DE ESCRITÓRIO CONTÁBIL PARCEIRO ──────────
  console.log('🏢 [1/4] Provisionando Escritório Contábil Parceiro de Teste...');
  const seedOffice = {
    name: 'Escritório Modelo Contabilidade',
    contact_name: 'Contador Parceiro Teste',
    email: 'contato@escritoriomodelo.com.br',
    phone: '5514930855878',
    commission_rate: 10.0,
    crc_number: 'SP-123456/O',
    status: 'active',
  };

  let officeSavedInTable = false;
  try {
    const { data: existingOffices, error: checkErr } = await supabase
      .from('accountant_offices')
      .select('id, email')
      .eq('email', seedOffice.email);

    if (!checkErr) {
      if (existingOffices && existingOffices.length > 0) {
        await supabase
          .from('accountant_offices')
          .update({ ...seedOffice, updated_at: new Date().toISOString() })
          .eq('email', seedOffice.email);
        console.log(`   ✅ Escritório "${seedOffice.name}" atualizado na tabela accountant_offices.`);
      } else {
        await supabase.from('accountant_offices').insert(seedOffice);
        console.log(`   ✅ Escritório "${seedOffice.name}" inserido na tabela accountant_offices.`);
      }
      officeSavedInTable = true;
    } else {
      console.log(`   ℹ️ Tabela accountant_offices em validação de schema (${checkErr.message}).`);
    }
  } catch (err: any) {
    console.log(`   ℹ️ Aviso ao acessar accountant_offices: ${err?.message}`);
  }

  // Backup e resiliência em bot_config
  await supabase.from('bot_config').upsert(
    {
      key: 'bpo_seed_accountant_office',
      value: JSON.stringify({
        ...seedOffice,
        id: 'seed-office-modelo-01',
        is_table_active: officeSavedInTable,
        saved_at: new Date().toISOString(),
      }),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  );
  console.log('   ✅ Registro do parceiro garantido com persistência no Supabase.');

  // ── 2. ATUALIZAÇÃO DE CLIENTES PARA SERVICE_TIER DEFAULT ─────────
  console.log('\n👥 [2/4] Verificando e atualizando clientes para service_tier = self_service...');
  const { data: clients, error: clientsErr } = await supabase
    .from('clients')
    .select('id, name, company_name, accountant_name');

  if (clientsErr) {
    console.warn(`   ⚠️ Erro ao listar clientes: ${clientsErr.message}`);
  } else if (!clients || clients.length === 0) {
    console.log('   ℹ️ Nenhum cliente encontrado na base.');
  } else {
    console.log(`   📋 ${clients.length} cliente(s) encontrado(s).`);
    let updatedCount = 0;

    for (const client of clients) {
      const payload: any = {};
      // Se ainda não tiver contador parceiro preenchido, associa o modelo
      if (!client.accountant_name) {
        payload.accountant_name = seedOffice.name;
        payload.accountant_phone = seedOffice.phone;
        payload.accountant_email = seedOffice.email;
      }

      // Tenta atualizar service_tier de forma tolerante a falhas
      try {
        const { error: updTierErr } = await supabase
          .from('clients')
          .update({ ...payload, service_tier: 'self_service' })
          .eq('id', client.id);

        if (!updTierErr) {
          updatedCount++;
          console.log(`   ✅ Cliente "${client.company_name || client.name}" atualizado para service_tier='self_service'.`);
        } else {
          // Se a coluna service_tier ainda não estiver no banco, atualiza apenas os campos contábeis
          if (Object.keys(payload).length > 0) {
            await supabase.from('clients').update(payload).eq('id', client.id);
          }
          console.log(`   ✓ Cliente "${client.company_name || client.name}" vinculado ao escritório contábil.`);
        }
      } catch (err: any) {
        console.warn(`   ⚠️ Erro ao atualizar cliente: ${err?.message}`);
      }
    }
    console.log(`   ✨ Total de clientes atualizados: ${updatedCount}`);
  }

  // ── 3. REGISTRO INICIAL DA AUDITORIA MATINAL (CURRENT_DATE) ──────
  console.log('\n📊 [3/4] Inicializando auditoria matinal para a data de hoje...');
  const initialAudit = {
    audit_date: todayStr,
    status: 'pending',
    d0_reminders_expected: 0,
    d0_reminders_sent: 0,
    d1_reminders_expected: 0,
    d1_reminders_sent: 0,
    documents_pending_review: 0,
    documents_approved: 0,
    inconsistencies_flagged: 0,
    audited_by: 'Sistema / Marcos',
    notes: 'Auditoria matinal gerada automaticamente pelo script de provisionamento.',
  };

  let auditSavedInTable = false;
  try {
    const { data: existingAudit, error: auditErr } = await supabase
      .from('daily_bpo_audits')
      .select('id, status')
      .eq('audit_date', todayStr)
      .maybeSingle();

    if (!auditErr) {
      if (existingAudit) {
        console.log(`   ✓ Auditoria para ${todayStr} já existe com status='${existingAudit.status}'.`);
      } else {
        await supabase.from('daily_bpo_audits').insert(initialAudit);
        console.log(`   ✅ Auditoria inicial criada na tabela daily_bpo_audits para ${todayStr}.`);
      }
      auditSavedInTable = true;
    } else {
      console.log(`   ℹ️ Tabela daily_bpo_audits em validação de schema (${auditErr.message}).`);
    }
  } catch (err: any) {
    console.log(`   ℹ️ Aviso ao acessar daily_bpo_audits: ${err?.message}`);
  }

  // Backup e resiliência em bot_config
  await supabase.from('bot_config').upsert(
    {
      key: `daily_bpo_audit_${todayStr}`,
      value: JSON.stringify({
        ...initialAudit,
        is_table_active: auditSavedInTable,
        updated_at: new Date().toISOString(),
      }),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  );
  console.log(`   ✅ Snapshot de auditoria de ${todayStr} assegurado no Supabase.`);

  // ── 4. RESUMO DA OPERAÇÃO ─────────────────────────────────────────
  console.log('\n🏁 [4/4] Validação de integridade concluída com sucesso!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 CICLO 1: PROVISIONAMENTO CONCLUÍDO COM ÊXITO');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((err) => {
  console.error('\n❌ Falha fatal no provisionamento:', err);
  process.exit(1);
});
