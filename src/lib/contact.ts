export const WHATSAPP_NUMBER = '551331500987';
export const WHATSAPP_DISPLAY = '(13) 3150-0987';

export function createWhatsAppLink(message: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export const WHATSAPP = {
  diagnostico: createWhatsAppLink('Olá! Gostaria de agendar um Diagnóstico Financeiro Gratuito (30 a 45 min) para a minha empresa.'),
  planoMei: createWhatsAppLink('Olá! Tenho interesse no Plano Autônomo & MEI (a partir de R$ 397/mês) e gostaria de solicitar uma proposta.'),
  planoEssencial: createWhatsAppLink('Olá! Tenho interesse no Plano Essencial (a partir de R$ 697/mês) e gostaria de solicitar uma proposta.'),
  planoGestao: createWhatsAppLink('Olá! Tenho interesse no Plano Gestão & Relatórios (a partir de R$ 1.397/mês) e gostaria de agendar o Diagnóstico Gratuito.'),
  planoEstrategico: createWhatsAppLink('Olá! Tenho interesse no Plano CFO Estratégico (a partir de R$ 1.997/mês) e gostaria de agendar uma reunião sob medida.'),
  beta: createWhatsAppLink('Olá! Gostaria de conhecer o Programa Beta do Plano Inteligência Financeira AnalisAI.me.'),
  mei: createWhatsAppLink('Olá! Estou começando como MEI ou autônomo e gostaria de conhecer o plano para começar minha organização financeira do jeito certo.'),
  parceria: createWhatsAppLink('Olá! Sou contador ou proprietário de escritório contábil e gostaria de conhecer o Programa de Parcerias do AnalisAI.me.'),
};

export const CONTACT_EMAIL = 'contato@analisai.me';
