/**
 * Serviço de Integração com WhatsApp Cloud API (Meta Oficial)
 * Suporta envio de mensagens de texto, alertas administrativos e documentos (PDF).
 */

interface EnviarTextoParams {
  para: string; // Formato internacional: ex: "5513999999999" (sem caracteres especiais)
  texto: string;
}

interface EnviarDocumentoParams {
  para: string;
  urlDocumento: string;
  nomeArquivo: string;
  legenda?: string;
}

const WHATSAPP_API_URL = 'https://graph.facebook.com/v20.0';

/**
 * Normaliza número de telefone para o padrão WhatsApp internacional E.164 (ex: 5513999999999)
 */
export function formatarNumeroWhatsApp(numero: string): string {
  const limpo = numero.replace(/\D/g, '');
  if (limpo.startsWith('55')) {
    return limpo;
  }
  return `55${limpo}`;
}

/**
 * Envia uma mensagem de texto simples pelo WhatsApp Cloud API
 */
export async function enviarMensagemWhatsApp({ para, texto }: EnviarTextoParams) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;

  if (!token || !phoneId) {
    console.warn('[WhatsApp] WHATSAPP_TOKEN ou WHATSAPP_PHONE_ID não configurados nas variáveis de ambiente.');
    return { sucesso: false, erro: 'Configurações de WhatsApp não encontradas' };
  }

  const destinatario = formatarNumeroWhatsApp(para);

  try {
    const res = await fetch(`${WHATSAPP_API_URL}/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: destinatario,
        type: 'text',
        text: {
          preview_url: false,
          body: texto,
        },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('[WhatsApp Cloud API] Erro no envio:', data);
      return { sucesso: false, erro: data.error?.message || 'Erro no envio' };
    }

    return { sucesso: true, data };
  } catch (err: any) {
    console.error('[WhatsApp Cloud API] Falha de conexão:', err);
    return { sucesso: false, erro: err.message };
  }
}

/**
 * Envia um documento PDF para o WhatsApp do cliente
 */
export async function enviarDocumentoWhatsApp({
  para,
  urlDocumento,
  nomeArquivo,
  legenda,
}: EnviarDocumentoParams) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;

  if (!token || !phoneId) {
    console.warn('[WhatsApp] WHATSAPP_TOKEN ou WHATSAPP_PHONE_ID não configurados.');
    return { sucesso: false, erro: 'Credenciais ausentes' };
  }

  const destinatario = formatarNumeroWhatsApp(para);

  try {
    const res = await fetch(`${WHATSAPP_API_URL}/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: destinatario,
        type: 'document',
        document: {
          link: urlDocumento,
          filename: nomeArquivo,
          caption: legenda || '',
        },
      }),
    });

    const data = await res.json();
    return { sucesso: res.ok, data };
  } catch (err: any) {
    console.error('[WhatsApp Cloud API] Falha ao enviar documento:', err);
    return { sucesso: false, erro: err.message };
  }
}

/**
 * Dispara notificação interna no WhatsApp da Solucione quando uma nova coleta é enviada
 */
export async function notificarAdminNovaColeta(dados: {
  nome_negocio: string;
  setor?: string;
  faturamento_medio?: string;
  custos_fixos?: string;
  custos_variaveis?: string;
  dividas_parcelamentos?: string;
  email: string;
  whatsapp: string;
}) {
  const adminWhatsApp = process.env.ADMIN_WHATSAPP || '551331500987';

  const mensagem = `🚀 *NOVA COLETA DE DIAGNÓSTICO RECEBIDA!*\n\n` +
    `🏢 *Empresa:* ${dados.nome_negocio}\n` +
    `📂 *Setor:* ${dados.setor || 'Não informado'}\n` +
    `💰 *Faturamento Médio:* ${dados.faturamento_medio || 'Não informado'}\n` +
    `🏛️ *Custos Fixos:* ${dados.custos_fixos || 'Não informado'}\n` +
    `📦 *Custos Variáveis:* ${dados.custos_variaveis || 'Não informado'}\n` +
    `💳 *Dívidas:* ${dados.dividas_parcelamentos || 'Nenhuma'}\n\n` +
    `📧 *E-mail:* ${dados.email}\n` +
    `📱 *WhatsApp:* ${dados.whatsapp}\n\n` +
    `⏳ _Prazo de entrega do relatório: até 72 horas._`;

  return enviarMensagemWhatsApp({
    para: adminWhatsApp,
    texto: mensagem,
  });
}
