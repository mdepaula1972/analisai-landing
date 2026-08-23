import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('[infinitepay/webhook] Evento recebido:', JSON.stringify(body));

    // A InfinitePay envia o status da transação e metadados
    const status = body.status || body.transaction_status || body.event;
    const pedidoId = body.order_id || body.metadata?.pedido_id || body.external_reference;
    const amount = body.amount || body.value || 197;

    const isAprovado = 
      status === 'paid' || 
      status === 'confirmed' || 
      status === 'approved' || 
      status === 'success' ||
      body.paid === true;

    if (isAprovado && pedidoId) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        await supabase
          .from('diagnostico_pedidos')
          .update({
            status: 'confirmado',
            metodo_pagamento: body.payment_method || 'infinitepay_pix',
            observacoes: `Aprovado via InfinitePay Webhook em ${new Date().toISOString()}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', pedidoId);

        console.log(`[infinitepay/webhook] Pedido ${pedidoId} confirmado com sucesso no Supabase.`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[infinitepay/webhook] Erro ao processar webhook:', error);
    return NextResponse.json({ error: 'Erro interno no webhook.' }, { status: 500 });
  }
}
