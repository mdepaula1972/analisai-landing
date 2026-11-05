import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { identifier } = await req.json().catch(() => ({}));

    if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
      return NextResponse.json(
        { error: 'Informe o e-mail ou WhatsApp cadastrado do escritório.' },
        { status: 400 }
      );
    }

    const cleanInput = identifier.trim().toLowerCase();
    const cleanPhone = cleanInput.replace(/\D/g, '');
    const supabase = createServiceRoleClient();

    let office = null;

    // 1. Busca na tabela accountant_offices
    try {
      let query = supabase.from('accountant_offices').select('*');
      if (cleanPhone.length >= 8) {
        query = query.or(`phone.ilike.%${cleanPhone}%,email.ilike.%${cleanInput}%`);
      } else {
        query = query.ilike('email', `%${cleanInput}%`);
      }
      const { data } = await query.limit(1);
      if (data && data.length > 0) {
        office = data[0];
      }
    } catch {}

    // 2. Fallback no bot_config
    if (!office) {
      const { data: seedRow } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', 'bpo_seed_accountant_office')
        .maybeSingle();

      if (seedRow?.value) {
        try {
          const parsed = JSON.parse(seedRow.value);
          const seedPhone = (parsed.phone || '').replace(/\D/g, '');
          const seedEmail = (parsed.email || '').toLowerCase();
          if (
            (cleanPhone && seedPhone.includes(cleanPhone)) ||
            cleanInput.includes(seedEmail) ||
            cleanInput === 'demo'
          ) {
            office = parsed;
          }
        } catch {}
      }
    }

    // Suporte ao parceiro modelo
    if (!office && (cleanPhone === '5514930855878' || cleanInput.includes('escritoriomodelo') || cleanInput === 'demo')) {
      office = {
        id: 'seed-office-modelo-01',
        name: 'Escritório Modelo Contabilidade',
        contact_name: 'Contador Parceiro Teste',
        email: 'contato@escritoriomodelo.com.br',
        phone: '5514930855878',
        crc_number: 'SP-123456/O',
        commission_rate: 10.0,
        pix_key: 'contato@escritoriomodelo.com.br',
        status: 'active',
      };
    }

    if (!office) {
      return NextResponse.json(
        { error: 'Nenhum escritório contábil localizado com este e-mail ou WhatsApp. Verifique com a coordenação do AnalisAí.' },
        { status: 404 }
      );
    }

    const response = NextResponse.json({
      success: true,
      office,
      redirect: `/contador/dashboard?office_id=${encodeURIComponent(office.id)}`,
    });

    // Salva cookie seguro de sessão contábil por 30 dias
    response.cookies.set('analisai_office_id', office.id, {
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    response.cookies.set('analisai_office_name', office.name, {
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    return response;
  } catch (err: any) {
    console.error('[Contador Auth Error]:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro ao validar acesso do parceiro contábil.' },
      { status: 500 }
    );
  }
}
