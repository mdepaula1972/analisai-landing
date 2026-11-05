/**
 * Master Authentication & Bypass de Segurança para o Telefone Pessoal do Marcos
 * Telefone: 14-930855878 / 5514930855878
 * Garante acesso livre irrestrito a todas as áreas restritas do AnalisAí:
 * - Torre de Controle Operacional BPO (/admin/bpo)
 * - Painel de Métricas (/admin)
 * - Portal do Contador Parceiro (/contador e /contador/dashboard)
 * - Portal do Cliente PWA (/portal)
 * - Todas as APIs administrativas, contábeis e de clientes
 */

export const MASTER_ADMIN_PHONES = [
  '5514930855878',
  '14930855878',
  '930855878',
  '55149930855878',
  '149930855878',
];

export const MASTER_ADMIN_INFO = {
  name: 'Marcos Antonio de Paula',
  role: 'master_admin',
  phone: '5514930855878',
  formattedPhone: '(14) 93085-5878',
  email: 'contato@analisai.me',
};

/**
 * Verifica se um input (seja telefone, token, query param ou header) corresponde
 * ao telefone master ou token pessoal do Marcos.
 */
export function isMasterPhone(input?: string | null): boolean {
  if (!input || typeof input !== 'string') return false;
  const trimmed = input.trim().toLowerCase();

  // Caso seja token fixo com o telefone
  if (trimmed.includes('14930855878') || trimmed.includes('930855878')) {
    return true;
  }

  // Compara dígitos limpos
  const clean = trimmed.replace(/\D/g, '');
  if (!clean) return false;

  return MASTER_ADMIN_PHONES.some(
    (p) => clean === p || clean.endsWith('14930855878') || clean.endsWith('930855878')
  );
}
