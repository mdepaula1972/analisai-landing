export const WHATSAPP_NUMBER =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || process.env.OFFICIAL_BOT_WHATSAPP || '551331500987';
export const WHATSAPP_DISPLAY =
  process.env.NEXT_PUBLIC_WHATSAPP_DISPLAY || process.env.OFFICIAL_BOT_PHONE_DISPLAY || '(13) 3150-0987';

export const WHATSAPP_DEFAULT_MESSAGE =
  'Olá! Vim pelo site da AnalisAí.me e quero solicitar um diagnóstico financeiro para minha empresa.';

export function createWhatsAppLink(message: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export const WHATSAPP = {
  soloTeste: createWhatsAppLink('Olá! Quero testar o AnalisAí Solo no WhatsApp enviando um boleto.'),
  diagnostico: createWhatsAppLink(WHATSAPP_DEFAULT_MESSAGE),
  planoMei: createWhatsAppLink('Olá! Tenho interesse no Plano Inicial de BPO Financeiro e quero solicitar um diagnóstico financeiro para minha empresa.'),
  planoEssencial: createWhatsAppLink('Olá! Tenho interesse no Plano Essencial (a partir de R$ 697/mês) e gostaria de solicitar uma proposta.'),
  planoGestao: createWhatsAppLink('Olá! Tenho interesse no Plano Gestão & Relatórios (a partir de R$ 1.397/mês) e gostaria de agendar o Diagnóstico Gratuito.'),
  planoEstrategico: createWhatsAppLink('Olá! Tenho interesse no Plano CFO Estratégico (a partir de R$ 1.997/mês) e gostaria de agendar uma reunião sob medida.'),
  beta: createWhatsAppLink('Olá! Gostaria de conhecer o Programa Beta do Plano Inteligência Financeira AnalisAI.me.'),
  mei: createWhatsAppLink('Olá! Estou começando e gostaria de conhecer a solução ideal para organizar meu financeiro do jeito certo.'),
  parceria: createWhatsAppLink('Olá! Sou contador ou proprietário de escritório contábil e gostaria de conhecer o Programa de Parcerias do AnalisAI.me.'),
};

export const CONTACT_EMAIL = 'contato@analisai.me';
