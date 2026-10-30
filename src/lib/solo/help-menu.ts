import { APP_VERSION, getVersionFooterBadge } from '@/lib/version';

export interface HelpMenuOptions {
  role: 'operator' | 'owner' | 'trial';
  isAdminOrQa?: boolean;
  userName?: string;
}

/**
 * Identifica se a mensagem do usuário é um pedido de abertura da Central de Recursos / Comandos.
 */
export function isHelpMenuQuery(rawText: string): boolean {
  if (!rawText) return false;
  const clean = rawText
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[?!.]+$/g, '')
    .trim();

  const exactMatches = new Set([
    'menu',
    '!menu',
    '/menu',
    'ajuda',
    '!ajuda',
    '/ajuda',
    'help',
    '!help',
    '/help',
    'comandos',
    '!comandos',
    '/comandos',
    'funcoes',
    '!funcoes',
    '/funcoes',
    'opcoes',
    '!opcoes',
    'o que voce faz',
    'o que vc faz',
    'quais os comandos',
    'quais sao os comandos',
    'quais suas funcoes',
    'como usar',
    'manual',
  ]);

  if (exactMatches.has(clean)) return true;

  if (
    clean.length <= 48 &&
    (/\bo que (voce|vc) (faz|pode fazer|consegue fazer)\b/.test(clean) ||
      /\bquais (sao )?(os |seus )?(comandos|recursos|funcoes)\b/.test(clean) ||
      /\bpreciso de ajuda\b/.test(clean) ||
      /\bme mostra (o )?(menu|comandos)\b/.test(clean))
  ) {
    return true;
  }

  return false;
}

/**
 * Gera a Central de Recursos inteligente adaptada ao perfil do chamador:
 * - Operador/Secretária (role === 'operator')
 * - Dono / Assinante / Degustação (role === 'owner' | 'trial')
 * - Admin / QA (isAdminOrQa === true)
 */
export function getHelpMenuMessage(options: HelpMenuOptions): string {
  const { role, isAdminOrQa = false } = options;

  // 1. Visão restrita e focada para Operador / Secretária (sem expor DRE, saldos ou relatórios estratégicos)
  if (role === 'operator') {
    return `💡 *Central de Recursos — Perfil Operacional (AnalisAí ${APP_VERSION})*

Como você pode registrar e organizar lançamentos no dia a dia:

📸 *Envio de Documentos:*
• Envie fotos ou PDFs de Boletos, Notas Fiscais, Recibos e Comprovantes.
• Você pode adicionar legenda (ex: "parcelado em 3x" ou "já foi pago no Pix").

🎙️ *Comandos por Áudio ou Texto:*
• "Paguei o frete de 150 reais"
• "Cadastrar boleto da Sabesp R$ 120 vencimento dia 20"
• "Baixar a conta da Dufrio" ou "Prorrogar conta para dia 10"
• "Pagar fornecedor X" (para copiar a linha digitável/Pix salvo)

✅ *Conferência de Lançamentos:*
• Sempre que você enviar um documento ou lançamento, confirme com *[1]* para salvar, *[2]* para corrigir ou *[3]* para cancelar.
• _Nota: Relatórios gerenciais, saldos e DRE são exclusivos do titular da conta._

${getVersionFooterBadge()}`;
  }

  // 2. Visão completa para Dono / Assinante (e Degustação)
  let menu = `💡 *Central de Recursos — AnalisAí (${APP_VERSION})*

Como você pode interagir comigo no dia a dia:

📸 *Envio de Documentos:*
• Envie fotos ou PDFs de Boletos, Notas Fiscais e Comprovantes.
• Você pode adicionar legenda (ex: "parcelado em 3x").

🎙️ *Comandos por Áudio ou Texto:*
• "Paguei o frete de 150 reais"
• "Tenho 2 mil para receber do cliente X dia 15"
• "Baixar a conta de ontem" ou "Prorrogar conta da Dufrio para dia 10"
• "Desfazer" ou "Desfazer baixa" (para reabrir uma conta recém-baixada)
• "Meu saldo hoje é R$ 4.500" (para conciliar o caixa)

📊 *Consultas e Relatórios:*
• Digite *contas* para ver sua agenda financeira completa.
• Digite *DRE* ou *relatório* para receber o Livro Caixa em PDF.
• Digite *fechamento* para gerar o pacote do seu contador (CSV + ZIP).
• Digite *cobrar* para gerar link de cobrança amigável com chave Pix.

⚙️ *Outras Opções:*
• Digite *meu plano* para ver consumo e limites.
• Digite *equipe* para adicionar secretárias ou ajudantes.`;

  // 3. Seção adicional discreta para Admin / QA (qa_whitelist ou is_admin = true)
  if (isAdminOrQa) {
    menu += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛠️ *Atalhos de Telemetria & QA (Admin):*
• *!painel* ou *!metricas* → Telemetria de MRR, funil e assinantes
• *!radar* / *!feedbacks* → Radar de fricções e feedbacks de testadores
• *!reset* → Zera ciclo e lançamentos de teste para recomeçar
• *!bypass on* / *!bypass off* → Alterna trava de limites contratuais
• *!simular [start|solo|plus]* → Simula experiência de cada plano
• *!versao* ou *!v* → Mostra versão, build e commit ativo na Vercel
• *!marcos* → Guia completo de bateria de testes e QA`;
  }

  menu += `\n\n${getVersionFooterBadge()}`;

  return menu;
}

