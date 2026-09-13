import { GoogleGenerativeAI } from '@google/generative-ai';
import { createServiceRoleClient } from '@/lib/supabase-server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '';

export async function generateCashFlowPostponeAdvice(
  clientId: string,
  availableCash?: number
): Promise<string> {
  const supabase = createServiceRoleClient();

  // 1. Busca contas a pagar em aberto do cliente
  const { data: openBills, error } = await supabase
    .from('payables_receivables')
    .select('*')
    .eq('client_id', clientId)
    .eq('type', 'payable')
    .eq('status', 'open')
    .order('current_due_date', { ascending: true });

  if (error || !openBills || openBills.length === 0) {
    return `Não identifiquei nenhuma conta a pagar em aberto no seu Livro Caixa no momento.

📝 *Como funciona o Consultor de Caixa:*
Assim que você envia fotos ou PDFs dos seus boletos (energia, fornecedores, aluguel), o AnalisAí registra os valores e vencimentos automaticamente.
Com esses boletos agendados, quando você perguntar *"qual conta devo atrasar?"*, eu calculo os juros de cada uma e indico a melhor decisão para proteger seu fluxo de caixa!

👉 Envie uma foto ou PDF de boleto agora para começarmos!`;
  }

  const totalOpen = openBills.reduce((acc, b) => acc + Number(b.amount), 0);

  // 2. Monta o contexto para o raciocínio do Gemini
  const billsContext = openBills
    .map(
      (b, idx) =>
        `${idx + 1}. Fornecedor: "${b.counterparty_name}" | Valor: R$ ${Number(b.amount).toFixed(2)} | Vencimento: ${b.current_due_date} | Criticidade (1-5): ${b.criticality_score || 3} | Notas: ${b.notes || 'Nenhuma'}`
    )
    .join('\n');

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: `Você é o Consultor Sênior de Fluxo de Caixa do AnalisAí Solo.
Seu trabalho é apoiar autônomos, MEIs e microempresários que estão enfrentando aperto temporário de caixa, indicando exatamente qual conta pagar e qual postergar com o menor risco.

DIRETRIZES DE DECISÃO CONTÁBIL:
1. SERVIÇOS ESSENCIAIS (Energia, Água, Internet, Telefonia): NÃO adiar se houver risco de corte iminente. A interrupção paralisa as vendas da empresa.
2. ALUGUEL / IMÓVEL: Avaliar juros e multas contratuais (geralmente 10% mais juros diários). Se for adiar, deve ser alinhado com a imobiliária.
3. FORNECEDORES DE INSUMOS/MERCADORIAS: Priorizar postergação daqueles com melhor relacionamento ou onde a multa de mora seja menor que o custo de capital de giro.
4. FORNECEDORES DE SERVIÇOS NÃO CRÍTICOS: Podem ser postergados com aviso cordial.

ESTRUTURA DA RESPOSTA (Mantenha concisa, clara e empática no WhatsApp):
- 🎯 **Recomendação Direta**: Qual boleto atrasar primeiro e por quê.
- 🛡️ **Proteja Imediatamente**: Quais contas NÃO devem ser atrasadas sob nenhuma hipótese.
- 💬 **Texto Pronto de Negociação**: Um modelo curto de mensagem de WhatsApp para o cliente copiar e enviar ao fornecedor pedindo prorrogação sem atrito.`,
  });

  const prompt = `Analise a situação de caixa deste cliente e forneça sua recomendação especializada:
- Saldo em caixa informado no momento: ${availableCash ? `R$ ${availableCash.toFixed(2)}` : 'Aperto temporário sem valor exato informado'}
- Total de contas em aberto: R$ ${totalOpen.toFixed(2)}
- Lista das contas:
${billsContext}`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}
