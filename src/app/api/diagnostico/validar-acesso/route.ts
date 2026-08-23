import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pedidoId = searchParams.get('pedido_id');
    const sessionId = searchParams.get('session_id');

    // Modo desenvolvimento / teste liberado se não houver Supabase configurado
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ liberado: true, modo: 'fallback_dev' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let query = supabase.from('diagnostico_pedidos').select('*');

    if (pedidoId) {
      query = query.eq('id', pedidoId);
    } else if (sessionId) {
      query = query.eq('session_id', sessionId);
    } else {
      return NextResponse.json({ liberado: false, erro: 'Identificador de pedido não fornecido.' }, { status: 400 });
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return NextResponse.json({ liberado: false, erro: 'Pedido não encontrado.' }, { status: 404 });
    }

    if (data.status !== 'confirmado') {
      return NextResponse.json({
        liberado: false,
        status: data.status,
        mensagem: 'Pagamento pendente de confirmação.'
      }, { status: 403 });
    }

    return NextResponse.json({
      liberado: true,
      pedido: {
        id: data.id,
        nome: data.nome_pagador,
        email: data.email,
        whatsapp: data.whatsapp,
        metodo: data.metodo_pagamento,
        valor: data.valor,
      }
    });
  } catch (error: any) {
    console.error('[api/diagnostico/validar-acesso] Erro:', error);
    return NextResponse.json({ liberado: false, erro: 'Erro interno ao validar acesso.' }, { status: 500 });
  }
}
