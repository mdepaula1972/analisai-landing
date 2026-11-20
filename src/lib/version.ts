/**
 * Versão Oficial do Sistema AnalisAí
 * Atualizado a cada novo deploy em produção
 */
export const APP_VERSION = 'v1.7.0';
export const APP_BUILD_TIMESTAMP = '20/11/2026 12:30 BRT';
export const APP_RELEASE_NAME =
  'Landing BPO Sênior PME, Comparativo CLT, Autoridade com Foto e WhatsApp (13) 3150-0987';

export function getShortCommitSha(): string {
  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    '';
  return sha ? `#${sha.slice(0, 7)}` : 'local/main';
}

export function getVersionFooterBadge(): string {
  const commit = getShortCommitSha();
  return `📦 _AnalisAí ${APP_VERSION} • Build ${APP_BUILD_TIMESTAMP} (${commit})_`;
}

export function getVersionStatusWhatsAppMessage(): string {
  const commit = getShortCommitSha();
  return `🤖 *Status de Versão — AnalisAí*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• *Versão Ativa:* *${APP_VERSION}*
• *Build:* ${APP_BUILD_TIMESTAMP}
• *Commit Vercel:* \`${commit}\`
• *Release:* ${APP_RELEASE_NAME}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ _Webhook conectado à última versão publicada._`;
}
