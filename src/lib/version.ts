/**
 * Versão Oficial do Sistema AnalisAí
 * Atualizado a cada novo deploy em produção
 */
export const APP_VERSION = 'v1.5.9';
export const APP_BUILD_TIMESTAMP = '04/11/2026 09:15 BRT';
export const APP_RELEASE_NAME =
  'Trava Global de 50 Testadores, Cota Máxima de 30 Documentos & Onboarding Otimizado (PF/PJ)';

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

