import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const { nome, email, whatsapp, valor = 197, metodo = 'pix' } = await req.json();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    let pedidoId = crypto.randomUUID();

    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const { data, error } = await supabase
        .from('diagnostico_pedidos')
        .insert([
          {
            id: pedidoId,
            nome_pagador: nome || 'Cliente Diagnóstico',
            email: email || '',
            whatsapp: whatsapp || '',
            metodo_pagamento: `infinitepay_${metodo}`,
            valor: Number(valor),
            status: 'pendente',
            observacoes: 'Aguardando pagamento via InfinitePay',
          }
        ])
        .select()
        .single();

      if (data?.id) {
        pedidoId = data.id;
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://analisai.me';
    const infinitepayHandle = process.env.INFINITEPAY_HANDLE || '';

    // Se o usuário configurar o INFINITEPAY_HANDLE ou link de cobrança direto
    const redirectUrl = `${appUrl}/diagnostico/coleta?pedido_id=${pedidoId}&nome=${encodeURIComponent(nome || '')}&email=${encodeURIComponent(email || '')}&whatsapp=${encodeURIComponent(whatsapp || '')}`;

    return NextResponse.json({
      sucesso: true,
      pedido_id: pedidoId,
      redirect_url: redirectUrl,
      handle: infinitepayHandle,
      mensagem: 'Cobrança iniciada com sucesso.',
    });
  } catch (error: any) {
    console.error('[infinitepay/checkout] Erro ao criar checkout:', error);
    return NextResponse.json({ error: 'Erro ao iniciar checkout.' }, { status: 500 });
  }
}
