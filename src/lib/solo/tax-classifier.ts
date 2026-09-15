/**
 * Classificador de Porte e Perfil Tributário (CPF, MEI ou Simples/Empresa)
 * para concessão inteligente e protegida de limites de degustação no AnalisAí.
 */

export interface TaxClassification {
  taxId: string;
  type: 'cpf' | 'mei' | 'simples' | 'empresa';
  label: string;
  trialLimit: number;
  companyName?: string;
  isMei: boolean;
  isSimples: boolean;
}

/**
 * Consulta e classifica o perfil tributário a partir de um CPF ou CNPJ
 */
export async function classifyTaxId(rawTaxId?: string | null, companyHint?: string): Promise<TaxClassification> {
  const clean = (rawTaxId || '').replace(/\D/g, '');

  // 1. Caso seja CPF (11 dígitos) ou não informado: cota estrita de 1 degustação
  if (!clean || clean.length <= 11) {
    return {
      taxId: clean,
      type: 'cpf',
      label: 'Pessoa Física / Autônomo',
      trialLimit: 1,
      isMei: false,
      isSimples: false,
    };
  }

  // 2. Caso seja CNPJ (14 dígitos): verifica se é MEI ou Simples Nacional / Médio Porte
  if (clean.length === 14) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5s timeout

      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`, {
        headers: {
          'User-Agent': 'AnalisAi-Classifier/2.0 (Windows NT 10.0; Win64; x64)',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const isMei = Boolean(data.opcao_pelo_mei);
        const isSimples = Boolean(data.opcao_pelo_simples);
        const companyName = data.razao_social || data.nome_fantasia || companyHint;

        if (isMei) {
          return {
            taxId: clean,
            type: 'mei',
            label: 'Microempreendedor Individual (MEI)',
            trialLimit: 3, // MEI: 3 degustações
            companyName,
            isMei: true,
            isSimples: isSimples || true,
          };
        } else {
          return {
            taxId: clean,
            type: 'simples',
            label: 'Microempresa / Simples Nacional / EPP',
            trialLimit: 10, // Simples / Empresas: até 10 degustações
            companyName,
            isMei: false,
            isSimples,
          };
        }
      }
    } catch (apiErr) {
      console.warn('[TaxClassifier] Falha ou timeout na consulta de CNPJ via BrasilAPI:', apiErr);
    }

    // 3. Fallback Heurístico em caso de falha da API externa
    const hint = (companyHint || '').toUpperCase();
    const isMeiByHint = hint.match(/\bMEI\b/) || (hint.match(/\d{5,}/) && !hint.includes('LTDA') && !hint.includes('S.A'));
    if (isMeiByHint) {
      return {
        taxId: clean,
        type: 'mei',
        label: 'Microempreendedor Individual (MEI)',
        trialLimit: 3,
        companyName: companyHint,
        isMei: true,
        isSimples: true,
      };
    }

    // Se possui CNPJ válido de 14 dígitos mas a API falhou, concede como PJ (10 degustações)
    return {
      taxId: clean,
      type: 'simples',
      label: 'Pessoa Jurídica / Empresa',
      trialLimit: 10,
      companyName: companyHint,
      isMei: false,
      isSimples: true,
    };
  }

  // Padrão de segurança: 1 degustação
  return {
    taxId: clean,
    type: 'cpf',
    label: 'Pessoa Física / Autônomo',
    trialLimit: 1,
    isMei: false,
    isSimples: false,
  };
}
