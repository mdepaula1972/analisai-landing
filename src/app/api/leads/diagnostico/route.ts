import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { notificarAdminLeadDiagnostico } from '@/lib/email';
import { notificarAdminNovaColeta } from '@/lib/whatsapp';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tipo, // 'PJ' | 'PF'
      nome,
      email,
      whatsapp,
      empresa_ou_ocupacao,
      setor,
      faturamento_ou_renda,
      custos_ou_gastos,
      desafio_ou_objetivo,
      score_ou_classificacao,
      detalhes_adicionais,
    } = body;

    if (!email && !whatsapp && !nome) {
      return NextResponse.json(
        { error: 'Por favor, informe seu nome e pelo menos um contato (WhatsApp ou E-mail).' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    let leadId = crypto.randomUUID();

    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const payload = {
        id: leadId,
        nome_cliente: nome || null,
        email_cliente: email || null,
        whatsapp_cliente: whatsapp || null,
        mensagens: [
          {
            role: 'user',
            content: `Diagnóstico Gratuito (${tipo || 'PJ'}).\nNome/Negócio: ${nome} / ${empresa_ou_ocupacao}\nSetor: ${setor || 'N/A'}\nFaturamento/Renda: ${faturamento_ou_renda}\nCustos/Despesas: ${custos_ou_gastos}\nDesafio/Objetivo: ${desafio_ou_objetivo}\nScore: ${score_ou_classificacao}`,
          },
        ],
        dados_extraidos: {
          tipo: tipo || 'PJ',
          nome,
          empresa_ou_ocupacao,
          setor,
          faturamento_ou_renda,
          custos_ou_gastos,
          desafio_ou_objetivo,
          score_ou_classificacao,
          detalhes: detalhes_adicionais || {},
          data_envio: new Date().toISOString(),
        },
        status: 'lead_diagnostico_gratuito',
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('diagnostico_coletas')
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.error('[api/leads/diagnostico] Erro Supabase:', error);
      } else if (data?.id) {
        leadId = data.id;
      }
    }

    // 1. Notificação por E-mail (Resend)
    notificarAdminLeadDiagnostico({
      tipo: tipo || 'PJ',
      nome: nome || 'Lead Sem Nome',
      email: email || 'Não informado',
      whatsapp: whatsapp || 'Não informado',
      empresa_ou_ocupacao,
      setor,
      faturamento_ou_renda,
      custos_ou_gastos,
      desafio_ou_objetivo,
      score_ou_classificacao,
      detalhes_adicionais,
    }).catch((err) => console.error('[Resend Lead] Erro disparo:', err));

    // 2. Notificação por WhatsApp (se configurado)
    notificarAdminNovaColeta({
      nome_negocio: `[LEAD ${tipo}] ${nome} - ${empresa_ou_ocupacao || ''}`,
      setor,
      faturamento_medio: faturamento_ou_renda,
      custos_fixos: custos_ou_gastos,
      custos_variaveis: desafio_ou_objetivo,
      dividas_parcelamentos: score_ou_classificacao,
      email: email || '',
      whatsapp: whatsapp || '',
    }).catch((err) => console.error('[WhatsApp Lead] Erro disparo:', err));

    return NextResponse.json({
      success: true,
      lead_id: leadId,
      mensagem: 'Diagnóstico processado com sucesso.',
    });
  } catch (err: any) {
    console.error('[api/leads/diagnostico] Erro geral:', err);
    return NextResponse.json(
      { error: 'Erro ao processar o diagnóstico.' },
      { status: 500 }
    );
  }
}
