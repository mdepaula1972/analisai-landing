// ── Tenant ────────────────────────────────────────────────────

export type PlanoTenant = 'essencial' | 'gestao' | 'estrategico';
export type RoleUsuario = 'admin_bpo' | 'gestor' | 'viewer';

export interface Tenant {
  id: string;
  slug: string;
  razao_social: string;
  nome_fantasia?: string;
  cnpj?: string;
  plano: PlanoTenant;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantUser {
  id: string;
  tenant_id: string;
  user_id: string;
  role: RoleUsuario;
  created_at: string;
}

// ── Contexto do usuário autenticado ───────────────────────────

export interface UserContext {
  userId: string;
  email: string;
  role: RoleUsuario;
  tenant?: Tenant;    // null para admin_bpo
}

// ── Permissões por plano ──────────────────────────────────────

export const PLANO_PERMISSOES: Record<PlanoTenant, {
  contas: boolean;
  limiteContas: number;
  dre: boolean;
  simulador: boolean;
  export: boolean;
  analiseIa: boolean;
  maxUsuarios: number;
}> = {
  essencial: {
    contas: true,
    limiteContas: 50,
    dre: false,
    simulador: false,
    export: false,
    analiseIa: false,
    maxUsuarios: 1,
  },
  gestao: {
    contas: true,
    limiteContas: 200,
    dre: true,
    simulador: false,
    export: true,
    analiseIa: false,
    maxUsuarios: 3,
  },
  estrategico: {
    contas: true,
    limiteContas: 9999,
    dre: true,
    simulador: true,
    export: true,
    analiseIa: true,
    maxUsuarios: 999,
  },
};

export function canAccess(plano: PlanoTenant, feature: keyof typeof PLANO_PERMISSOES['essencial']): boolean {
  return !!PLANO_PERMISSOES[plano][feature];
}

export const PLANO_LABELS: Record<PlanoTenant, string> = {
  essencial: 'Plano Essencial',
  gestao: 'Plano Gestão',
  estrategico: 'Plano Estratégico',
};

export const PLANO_CORES: Record<PlanoTenant, string> = {
  essencial: 'text-slate-400 bg-slate-800 border-slate-700',
  gestao: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  estrategico: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
};
