import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    console.log('[diagnostico/webhook] Webhook InfinitePay recebido:', JSON.stringify(body));

    // Captura campos padrão da InfinitePay
    const status = body.status || body.transaction_status || body.event || body.payment_status;
    const pedidoId = body.order_id || body.metadata?.pedido_id || body.external_reference || body.id;
    const customerEmail = body.customer?.email || body.email || '';
    const customerName = body.customer?.name || body.name || '';
    const customerPhone = body.customer?.phone || body.phone || '';
    const valor = (body.amount || body.value || 19700) > 1000 ? (body.amount || body.value) / 100 : (body.amount || body.value || 197);

    const isAprovado = 
      status === 'paid' || 
      status === 'confirmed' || 
      status === 'approved' || 
      status === 'success' ||
      body.paid === true ||
      body.status === 'COMPLETED';

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      if (pedidoId) {
        // Tenta atualizar pedido existente
        const { data: updated } = await supabase
          .from('diagnostico_pedidos')
          .update({
            status: isAprovado ? 'confirmado' : status,
            metodo_pagamento: body.payment_method || 'infinitepay',
            observacoes: `Atualizado via InfinitePay Webhook (${status}) em ${new Date().toISOString()}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', pedidoId)
          .select();

        // Se não encontrou por ID, insere um novo registro de pedido confirmado
        if (!updated || updated.length === 0) {
          await supabase.from('diagnostico_pedidos').insert([
            {
              id: pedidoId,
              nome_pagador: customerName || 'Cliente InfinitePay',
              email: customerEmail,
              whatsapp: customerPhone,
              metodo_pagamento: body.payment_method || 'infinitepay',
              valor: valor,
              status: isAprovado ? 'confirmado' : 'pendente',
              observacoes: `Criado via InfinitePay Webhook em ${new Date().toISOString()}`,
            }
          ]);
        }
      } else {
        // Se a InfinitePay não enviar pedidoId específico, cria o registro do cliente
        await supabase.from('diagnostico_pedidos').insert([
          {
            nome_pagador: customerName || 'Cliente InfinitePay',
            email: customerEmail,
            whatsapp: customerPhone,
            metodo_pagamento: body.payment_method || 'infinitepay',
            valor: valor,
            status: isAprovado ? 'confirmado' : 'pendente',
            session_id: body.id || `ip_${Date.now()}`,
            observacoes: `Recebido da InfinitePay em ${new Date().toISOString()}`,
          }
        ]);
      }
    }

    return NextResponse.json({ received: true, processed: isAprovado });
  } catch (error: any) {
    console.error('[diagnostico/webhook] Erro:', error);
    return NextResponse.json({ error: 'Erro no processamento do webhook.' }, { status: 500 });
  }
}
