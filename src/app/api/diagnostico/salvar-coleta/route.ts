import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      pedido_id,
      nome_negocio,
      setor,
      faturamento_medio,
      custos_fixos,
      custos_variaveis,
      dividas_parcelamentos,
      email,
      whatsapp,
      origem_preenchimento,
    } = body;

    if (!email && !whatsapp && !nome_negocio) {
      return NextResponse.json(
        { error: 'Preencha os dados de identificação e contato.' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    let coletaId = crypto.randomUUID();

    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Se temos pedido_id válido em formato UUID, tenta associar
      const isValidUUID =
        pedido_id &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          pedido_id
        );

      const dadosExtraidos = {
        nome_negocio,
        setor,
        faturamento_medio: Number(faturamento_medio) || 0,
        custos_fixos: Number(custos_fixos) || 0,
        custos_variaveis: Number(custos_variaveis) || 0,
        dividas_parcelamentos: dividas_parcelamentos || '',
        origem_preenchimento: origem_preenchimento || 'texto_e_voz',
        data_envio: new Date().toISOString(),
      };

      const payload = {
        id: coletaId,
        pedido_id: isValidUUID ? pedido_id : null,
        nome_cliente: nome_negocio || null,
        email_cliente: email || null,
        whatsapp_cliente: whatsapp || null,
        mensagens: [
          {
            role: 'user',
            content: `Envio de Coleta de Dados para Diagnóstico Financeiro.\nNegócio: ${nome_negocio}\nSetor: ${setor}\nFaturamento: ${faturamento_medio}\nCustos Fixos: ${custos_fixos}\nCustos Variáveis: ${custos_variaveis}\nDívidas/Parcelamentos: ${dividas_parcelamentos}`,
          },
        ],
        dados_extraidos: dadosExtraidos,
        status: 'concluido',
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('diagnostico_coletas')
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.error('[api/diagnostico/salvar-coleta] Erro ao salvar no Supabase:', error);
      } else if (data?.id) {
        coletaId = data.id;
      }
    }

    return NextResponse.json({
      success: true,
      coleta_id: coletaId,
      mensagem: 'Dados salvos com sucesso.',
    });
  } catch (err: any) {
    console.error('[api/diagnostico/salvar-coleta] Erro geral:', err);
    return NextResponse.json(
      { error: 'Erro ao salvar os dados da coleta.' },
      { status: 500 }
    );
  }
}
