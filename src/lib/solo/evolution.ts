/**
 * Cliente de Integração com a Evolution API (Docker)
 * Gerencia envio de mensagens, documentos, mídias e áudios nativos.
 */

let cachedUrl: string | null = null;
let cachedKey: string | null = null;
let lastCacheTime = 0;

export async function getEvolutionConfig() {
  const now = Date.now();
  if (cachedUrl && cachedKey && now - lastCacheTime < 30000) {
    return {
      apiUrl: cachedUrl,
      apiKey: cachedKey,
      instance: process.env.EVOLUTION_INSTANCE_NAME || process.env.WHATSAPP_INSTANCE_ID || 'analisai_solo',
    };
  }

  // 1. Tenta carregar do Supabase (bot_config)
  try {
    const { createServiceRoleClient } = await import('@/lib/supabase-server');
    const supabase = createServiceRoleClient();
    const { data } = await supabase.from('bot_config').select('key, value');
    if (data && Array.isArray(data)) {
      const urlRow = data.find((r: any) => r.key === 'evolution_api_url');
      const keyRow = data.find((r: any) => r.key === 'evolution_api_key');
      if (urlRow?.value) cachedUrl = urlRow.value.trim().replace(/\/+$/, '');
      if (keyRow?.value) cachedKey = keyRow.value.trim();
    }
  } catch (err) {
    console.warn('[Evolution Config] Erro ao buscar bot_config no Supabase:', err);
  }

  // 2. Fallbacks
  if (!cachedUrl) {
    const envUrl = process.env.EVOLUTION_API_URL || process.env.WHATSAPP_API_URL;
    if (envUrl && !envUrl.includes('punk-photographers-windsor-love')) {
      cachedUrl = envUrl.trim().replace(/\/+$/, '');
    } else {
      cachedUrl = 'https://firewire-turbo-telephony-delivery.trycloudflare.com';
    }
  }

  if (!cachedKey) {
    cachedKey =
      process.env.EVOLUTION_API_KEY ||
      process.env.WHATSAPP_API_TOKEN ||
      process.env.WHATSAPP_KEY ||
      'analisai_secret_2026';
  }

  lastCacheTime = now;
  return {
    apiUrl: cachedUrl,
    apiKey: cachedKey,
    instance: process.env.EVOLUTION_INSTANCE_NAME || process.env.WHATSAPP_INSTANCE_ID || 'analisai_solo',
  };
}

export function formatWhatsAppNumber(phone: string): string {
  if (phone.includes('@')) {
    return phone;
  }
  const digits = phone.replace(/\D/g, '');
  // Se for um LID do WhatsApp Web (14+ dígitos sem DDI)
  if (digits.length >= 14 && !digits.startsWith('55')) {
    return `${digits}@lid`;
  }
  if (digits.startsWith('55')) {
    return digits;
  }
  return `55${digits}`;
}

export interface SendEvolutionTextParams {
  phone: string;
  text: string;
}

export interface SendEvolutionMediaParams {
  phone: string;
  mediaUrl?: string;
  mediaBase64?: string;
  mediaType: 'image' | 'document' | 'video' | 'audio';
  fileName?: string;
  caption?: string;
}

export async function sendEvolutionText({ phone, text }: SendEvolutionTextParams) {
  const formattedPhone = formatWhatsAppNumber(phone);
  const { apiUrl, apiKey, instance } = await getEvolutionConfig();

  try {
    const res = await fetch(`${apiUrl}/message/sendText/${instance}`, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: formattedPhone,
        text,
        options: {
          delay: 1200,
          presence: 'composing',
          linkPreview: true,
        },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('[Evolution API] Erro ao enviar texto:', data);
      return { success: false, error: data };
    }

    return { success: true, data };
  } catch (err: unknown) {
    console.error('[Evolution API] Falha de conexão ao enviar texto:', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendEvolutionMedia({
  phone,
  mediaUrl,
  mediaBase64,
  mediaType,
  fileName,
  caption,
}: SendEvolutionMediaParams) {
  const formattedPhone = formatWhatsAppNumber(phone);
  const resolvedFileName = fileName || (mediaType === 'document' ? 'documento.pdf' : 'arquivo');
  const mimeType = mediaType === 'document' ? 'application/pdf' : (mediaType === 'image' ? 'image/jpeg' : 'application/octet-stream');
  const { apiUrl, apiKey, instance } = await getEvolutionConfig();

  let cleanMedia = mediaUrl || mediaBase64 || '';
  if (cleanMedia && !cleanMedia.startsWith('http') && !cleanMedia.startsWith('data:')) {
    cleanMedia = `data:${mimeType};base64,${cleanMedia}`;
  }

  try {
    const res = await fetch(`${apiUrl}/message/sendMedia/${instance}`, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: formattedPhone,
        mediatype: mediaType,
        mimetype: mimeType,
        caption: caption || '',
        media: cleanMedia,
        fileName: resolvedFileName,
        mediaMessage: {
          mediatype: mediaType,
          mimetype: mimeType,
          fileName: resolvedFileName,
          caption: caption || '',
          media: cleanMedia,
        },
        options: {
          delay: 1200,
          presence: 'composing',
        },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('[Evolution API] Erro ao enviar mídia:', data);
      return { success: false, error: data };
    }
    return { success: true, data };
  } catch (err: unknown) {
    console.error('[Evolution API] Falha ao enviar mídia:', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function fetchMediaBase64FromEvolution(messageData: any): Promise<string | null> {
  try {
    if (!messageData) return null;
    const { apiUrl, apiKey, instance } = await getEvolutionConfig();

    // 1. Se o próprio objeto já tiver o base64 (webhookBase64: true da Evolution API)
    const directBase64 =
      messageData.base64 ||
      messageData.message?.base64 ||
      messageData.message?.imageMessage?.base64 ||
      messageData.message?.documentMessage?.base64 ||
      messageData.message?.audioMessage?.base64 ||
      (typeof messageData === 'string' && messageData.length > 500 ? messageData : null);

    if (directBase64 && typeof directBase64 === 'string') {
      const clean = directBase64.replace(/^data:[^;]+;base64,/, '').trim();
      if (clean.length > 50) {
        return clean;
      }
    }

    // 2. Monta o objeto message completo exigido pelo endpoint /chat/getBase64FromMediaMessage
    let fullMessage: any = messageData;

    if (messageData.data?.key && messageData.data?.message) {
      fullMessage = {
        key: messageData.data.key,
        message: messageData.data.message,
      };
    } else if (messageData.key && messageData.message) {
      fullMessage = {
        key: messageData.key,
        message: messageData.message,
      };
    } else if (messageData.key) {
      fullMessage = {
        key: messageData.key,
        message: messageData.message || {},
      };
    }

    const res = await fetch(`${apiUrl}/chat/getBase64FromMediaMessage/${instance}`, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: fullMessage,
        convertToMp4: false,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Evolution API] Falha ao buscar base64 da mídia:', errText);
      return null;
    }

    const json = await res.json();
    let base64Result = json.base64 || null;
    if (base64Result && typeof base64Result === 'string') {
      base64Result = base64Result.replace(/^data:[^;]+;base64,/, '').trim();
    }
    return base64Result;
  } catch (err) {
    console.error('[Evolution API] Erro na requisição de getBase64FromMediaMessage:', err);
    return null;
  }
}

export interface SendEvolutionPollParams {
  phone: string;
  question: string;
  options: string[];
  selectableCount?: number;
}

/**
 * Envia uma enquete interativa nativa do WhatsApp (botões de clique direto)
 * com fallback transparente para texto se o dispositivo ou endpoint não suportar.
 */
export async function sendEvolutionPoll({
  phone,
  question,
  options,
  selectableCount = 1,
}: SendEvolutionPollParams) {
  const formattedPhone = formatWhatsAppNumber(phone);
  const { apiUrl, apiKey, instance } = await getEvolutionConfig();

  try {
    const res = await fetch(`${apiUrl}/message/sendPoll/${instance}`, {
      method: 'POST',
      headers: {
        apikey: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: formattedPhone,
        name: question,
        selectableCount,
        values: options,
        options: {
          delay: 1000,
          presence: 'composing',
        },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return { success: true, data };
    }
  } catch (pollErr) {
    console.warn('[Evolution API] Falha ao enviar enquete nativa, aplicando fallback de texto:', pollErr);
  }

  // Fallback garantido: Envia como texto formatado com instruções claras
  const fallbackText = `${question}\n\n${options.map((opt) => `👉 ${opt}`).join('\n')}\n\n_(Você também pode responder digitando *Sim* ou *Não*)_`;
  return sendEvolutionText({ phone, text: fallbackText });
}
