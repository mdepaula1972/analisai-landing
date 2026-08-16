// ── Créditos ─────────────────────────────────────────────────

export interface TenantCreditos {
  id: string;
  tenant_id: string;
  plano: string;
  limite_mensal: number;
  creditos_extra: number;
  uso_mes_atual: number;
  mes_referencia: string;   // 'YYYY-MM'
  updated_at: string;
}

export interface CreditoTransacao {
  id: string;
  tenant_id: string;
  tipo: 'uso' | 'compra' | 'reset_mensal' | 'bonus';
  quantidade: number;
  descricao?: string;
  stripe_payment_id?: string;
  created_at: string;
}

// ── Estado de uso de créditos ─────────────────────────────────

export interface CreditStatus {
  usoAtual: number;
  limiteMensal: number;
  creditosExtra: number;
  disponivelTotal: number;
  percentualUso: number;   // 0-100
  estado: 'normal' | 'aviso' | 'soft_limit' | 'esgotado';
}

// ── Pacotes de créditos para compra ──────────────────────────

export interface PacoteCreditos {
  id: string;
  label: string;
  quantidade: number;
  preco: number;       // em centavos
  precoLabel: string;  // 'R$ 29,90'
  destaque?: boolean;
}

export const PACOTES_CREDITOS: PacoteCreditos[] = [
  {
    id: 'pack_50',
    label: 'Pacote Básico',
    quantidade: 50,
    preco: 2990,
    precoLabel: 'R$ 29,90',
  },
  {
    id: 'pack_150',
    label: 'Pacote Padrão',
    quantidade: 150,
    preco: 7990,
    precoLabel: 'R$ 79,90',
    destaque: true,
  },
  {
    id: 'pack_500',
    label: 'Pacote Premium',
    quantidade: 500,
    preco: 19990,
    precoLabel: 'R$ 199,90',
  },
];

// ── Helpers ───────────────────────────────────────────────────

export function calcCreditStatus(cred: TenantCreditos): CreditStatus {
  const disponivelTotal = cred.limite_mensal + cred.creditos_extra;
  const percentualUso = disponivelTotal > 0
    ? Math.round((cred.uso_mes_atual / disponivelTotal) * 100)
    : 100;

  let estado: CreditStatus['estado'] = 'normal';
  if (percentualUso >= 100) estado = 'esgotado';
  else if (percentualUso >= 90) estado = 'soft_limit';
  else if (percentualUso >= 75) estado = 'aviso';

  return {
    usoAtual: cred.uso_mes_atual,
    limiteMensal: cred.limite_mensal,
    creditosExtra: cred.creditos_extra,
    disponivelTotal,
    percentualUso,
    estado,
  };
}
