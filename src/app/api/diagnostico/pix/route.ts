import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Configuração do Supabase não encontrada.' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { nome, email, whatsapp, comprovante_url, observacoes } = await req.json();

    if (!nome || !email || !whatsapp) {
      return NextResponse.json(
        { error: 'Nome, e-mail e WhatsApp são obrigatórios.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('diagnostico_pedidos')
      .insert([
        {
          nome_pagador: nome.trim(),
          email: email.trim().toLowerCase(),
          whatsapp: whatsapp.trim(),
          metodo_pagamento: 'pix',
          valor: 197.00,
          status: 'pendente_confirmacao',
          comprovante_url: comprovante_url || null,
          observacoes: observacoes || null,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('[api/diagnostico/pix] Erro ao salvar pedido:', error);
      return NextResponse.json(
        { error: 'Erro ao registrar pedido. Tente novamente.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, pedido_id: data.id });
  } catch (err) {
    console.error('[api/diagnostico/pix] Erro interno:', err);
    return NextResponse.json(
      { error: 'Erro interno ao processar pedido.' },
      { status: 500 }
    );
  }
}
