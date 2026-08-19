export const WHATSAPP_NUMBER = '5514930855878';

export function createWhatsAppLink(message: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export const WHATSAPP = {
  diagnostico: createWhatsAppLink('Olá! Gostaria de agendar um Diagnóstico Financeiro Gratuito (30 a 45 min) para a minha empresa.'),
  planoEssencial: createWhatsAppLink('Olá! Tenho interesse no Plano Essencial de BPO Financeiro e gostaria de agendar um Diagnóstico Gratuito.'),
  planoGestao: createWhatsAppLink('Olá! Tenho interesse no Plano Gestão e quero agendar o Diagnóstico Financeiro Gratuito.'),
  planoEstrategico: createWhatsAppLink('Olá! Tenho interesse no Plano Estratégico e gostaria de agendar uma reunião de diagnóstico sob medida.'),
  beta: createWhatsAppLink('Olá! Gostaria de conhecer o Programa Beta do Plano Inteligência Financeira AnalisAI.me.'),
  mei: createWhatsAppLink('Olá! Estou começando como MEI ou autônomo e gostaria de conhecer o plano para começar minha organização financeira do jeito certo.'),
  parceria: createWhatsAppLink('Olá! Sou contador ou proprietário de escritório contábil e gostaria de conhecer o Programa de Parcerias do AnalisAI.me.'),
};

export const CONTACT_EMAIL = 'contato@analisai.me';
