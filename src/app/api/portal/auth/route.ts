import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { generateDashboardAccessLink } from '@/lib/solo/dashboard-auth';
import { WHATSAPP_NUMBER } from '@/lib/contact';
import { isMasterPhone } from '@/lib/solo/master-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawIdentifier = (body.identifier || body.phone || body.cnpj || '').trim();

    if (!rawIdentifier) {
      return NextResponse.json(
        { error: 'Informe seu WhatsApp ou CNPJ cadastrado para acessar o portal.' },
        { status: 400 }
      );
    }

    const cleanDigits = rawIdentifier.replace(/\D/g, '');

    // Master Access Bypass para o telefone do Marcos (14-930855878)
    if (isMasterPhone(cleanDigits) || isMasterPhone(rawIdentifier)) {
      return NextResponse.json({
        success: true,
        token: '5514930855878',
        portalUrl: '/portal?token=5514930855878',
        clientName: 'Marcos Antonio de Paula (Master Admin)',
        message: 'Acesso Master autorizado com sucesso!',
      });
    }

    const supabase = createServiceRoleClient();

    // 1. Tenta buscar por WhatsApp ou por CNPJ/CPF
    let query = supabase.from('clients').select('id, name, company_name, whatsapp_number, tax_id');

    if (cleanDigits.length >= 10 && cleanDigits.length <= 13) {
      // Telefone com DDD (ex: 81999998888 ou 5581999998888)
      const phoneSuffix = cleanDigits.slice(-8);
      query = query.or(`whatsapp_number.ilike.%${phoneSuffix}%,phone.ilike.%${phoneSuffix}%`);
    } else {
      // CNPJ (14 dígitos) ou CPF (11 dígitos)
      query = query.or(`tax_id.ilike.%${cleanDigits}%,cnpj.ilike.%${cleanDigits}%`);
    }

    const { data: clients, error: clientError } = await query.limit(1);

    const client = clients && clients.length > 0 ? clients[0] : null;

    if (!client) {
      return NextResponse.json(
        {
          error: 'Nenhum cliente BPO encontrado com este WhatsApp ou CNPJ. Fale com nosso suporte.',
          supportWhatsapp: WHATSAPP_NUMBER,
        },
        { status: 404 }
      );
    }

    const targetPhone = client.whatsapp_number || cleanDigits;
    const access = await generateDashboardAccessLink({
      clientId: client.id,
      phoneNumber: targetPhone,
      role: 'admin',
    });

    const portalUrl = `/portal?token=${access.token}`;

    return NextResponse.json({
      success: true,
      token: access.token,
      portalUrl,
      clientName: client.company_name || client.name,
      message: 'Acesso autenticado com sucesso!',
    });
  } catch (error: any) {
    console.error('[API Portal Auth] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao validar acesso ao portal.', details: error.message },
      { status: 500 }
    );
  }
}

