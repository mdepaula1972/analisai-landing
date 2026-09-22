import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { sendEvolutionText } from '@/lib/evolution';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const recoveryToken = requestUrl.searchParams.get('token');
  const next = requestUrl.searchParams.get('next') || '/recuperar/sucesso';

  const supabaseServer = createServiceRoleClient();

  if (code) {
    // Troca o código OAuth por sessão do Supabase Auth
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              request.cookies.set(name, value)
            );
          },
        },
      }
    );

    const { data: sessionData, error: sessionErr } = await supabaseAuth.auth.exchangeCodeForSession(code);

    if (!sessionErr && sessionData?.user && recoveryToken) {
      const socialUser = sessionData.user;
      const authenticatedEmail = socialUser.email || '';
      const socialProvider = socialUser.app_metadata?.provider || 'social';

      // Localiza a pendência de recuperação pelo token
      const { data: pending } = await supabaseServer
        .from('bot_action_confirmations')
        .select('*, clients(*)')
        .eq('id', recoveryToken)
        .eq('action_type', 'social_email_recovery')
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .single();

      if (pending) {
        const payload = pending.proposed_payload as any;
        const targetEmail = payload?.novo_email || authenticatedEmail;
        const nowIso = new Date().toISOString();

        // Atualiza o e-mail do cliente e ativa a quarentena de 24h
        await supabaseServer
          .from('clients')
          .update({
            email: targetEmail,
            email_updated_at: nowIso,
          })
          .eq('id', pending.client_id);

        // Marca a pendência como confirmada
        await supabaseServer
          .from('bot_action_confirmations')
          .update({
            status: 'confirmed',
            proposed_payload: {
              ...payload,
              authenticated_via: socialProvider,
              authenticated_email: authenticatedEmail,
              completed_at: nowIso,
            },
          })
          .eq('id', pending.id);

        // Notifica o cliente no WhatsApp dele imediatamente
        try {
          const clientData = pending.clients as any;
          const phone = pending.phone_number || clientData?.whatsapp_number;
          if (phone) {
            await sendEvolutionText({
              phone,
              text: `✅ *Recuperação por Prova Social Concluída!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sua identidade foi autenticada com sucesso via **${socialProvider.toUpperCase()}** (${authenticatedEmail}).

Seu e-mail de segurança foi atualizado para:
👉 \`${targetEmail}\`

🛡️ *Quarentena Bancária de 24h Ativa:*
Por diretrizes de segurança contra fraudes, alterações de chave Pix para terceiros ficam suspensas pelas próximas 24 horas. Seus repasses continuam 100% garantidos para o CNPJ oficial da sua empresa.`,
            });
          }
        } catch (notifyErr) {
          console.warn('[Social Auth Callback] Erro ao notificar WhatsApp:', notifyErr);
        }

        return NextResponse.redirect(new URL(`/recuperar/sucesso?email=${encodeURIComponent(targetEmail)}&provider=${encodeURIComponent(socialProvider)}`, request.url));
      }
    }
  }

  return NextResponse.redirect(new URL('/recuperar?erro=token_invalido_ou_expirado', request.url));
}
