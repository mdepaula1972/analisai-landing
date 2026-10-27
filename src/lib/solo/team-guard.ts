/**
 * Módulo de Proteção e Isolamento Multi-Operador (Blindagem de Sigilo)
 * Impede que membros de equipe (operadores/secretárias) acessem relatórios globais,
 * saldos, DREs ou excluam registros financeiros.
 */

export const RESTRICTED_OPERATOR_INTENTS = [
  'REQUEST_PDF_REPORT',
  'REQUEST_ACCOUNTING_CLOSING',
  'QUERY_BALANCE',
  'ADJUST_BALANCE',
  'QUERY_CASH_FLOW',
  'QUERY_BILLS',
  'DELETE_BILL',
  'DELETE_ENTRY',
  'EDIT_BILL',
  'UPDATE_BILL',
  'VIEW_DIVIDENDS',
  'VIEW_DRE',
  'CASH_FLOW_ADVICE',
  'TEAM_MANAGEMENT',
  'ADMIN_SIMULATION',
] as const;

export const OPERATOR_REFUSAL_MESSAGE =
  '🔒 *Acesso Restrito*\n\n' +
  'Esta funcionalidade envolve informações financeiras estratégicas ou comandos de exclusão e só pode ser acessada pelo administrador da conta.\n\n' +
  'Caso precise desta informação ou alteração, por favor solicite diretamente ao titular responsável.';

/**
 * Valida se o papel do usuário possui permissão para executar a intenção detectada
 */
export function validateOperatorPermissions(
  userRole: 'admin' | 'operator',
  detectedIntent: string
): { allowed: boolean; refusalMessage?: string } {
  if (userRole === 'operator') {
    const isRestricted = RESTRICTED_OPERATOR_INTENTS.some(
      (intent) => intent.toLowerCase() === detectedIntent.toLowerCase()
    );

    if (isRestricted) {
      return {
        allowed: false,
        refusalMessage: OPERATOR_REFUSAL_MESSAGE,
      };
    }
  }

  return { allowed: true };
}

/**
 * Verifica se um texto em linguagem natural ou comando simples tenta acessar relatórios/saldos/exclusões
 */
export function isRestrictedOperatorText(text: string): boolean {
  const clean = text.trim().toLowerCase();

  // Bloqueio de comandos de relatório / PDF / DRE / Fechamento Contábil
  if (/^(relat[oó]rio|pdf|dre|livro\s*caixa|balan[çc]o|demonstrativo|faturamento|fechamento|contabilidade|pacote\s*fiscal|fechamento\s*cont[aá]bil|pro\s*contador|para\s*o\s*contador)/i.test(clean)) {
    return true;
  }

  // Bloqueio de consultas de saldo, caixa geral ou fluxo
  if (/^(saldo|quanto\s*(tem|temos|sobrou)|caixa|fluxo\s*de\s*caixa|vis[aã]o\s*geral|posi[çc][aã]o)/i.test(clean)) {
    return true;
  }

  // Bloqueio de listagem global de contas da empresa
  if (/^(contas|agenda|semana|a\s*pagar|a\s*receber|vencimentos|o\s*que\s*vence)/i.test(clean)) {
    return true;
  }

  // Bloqueio de exclusão e cancelamento de lançamentos já cadastrados
  if (/^(excluir|apagar|deletar|remover|cancela\s*conta|apaga\s*conta)/i.test(clean)) {
    return true;
  }

  // Bloqueio de gestão de equipe
  if (/^(equipe|operador|adicionar\s*operador|remover\s*operador)/i.test(clean)) {
    return true;
  }

  return false;
}
