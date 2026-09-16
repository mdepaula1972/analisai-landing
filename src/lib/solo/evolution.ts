/**
 * Cliente de Integração com a Evolution API (Docker)
 * Gerencia envio de mensagens, documentos, mídias e áudios nativos.
 */

const EVOLUTION_API_URL =
  process.env.EVOLUTION_API_URL ||
  process.env.WHATSAPP_API_URL ||
  'https://once-harbour-lights-rarely.trycloudflare.com';

const EVOLUTION_API_KEY =
  process.env.EVOLUTION_API_KEY ||
  process.env.WHATSAPP_API_TOKEN ||
  process.env.WHATSAPP_KEY ||
  'analisai_secret_2026';

const EVOLUTION_INSTANCE =
  process.env.EVOLUTION_INSTANCE_NAME ||
  process.env.WHATSAPP_INSTANCE_ID ||
  process.env.WHATSAPP_INSTANCE ||
  'analisai_solo';

export function formatWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
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

  try {
    const res = await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: {
        'apikey': EVOLUTION_API_KEY,
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

  let cleanMedia = mediaUrl || mediaBase64 || '';
  if (cleanMedia && !cleanMedia.startsWith('http') && !cleanMedia.startsWith('data:')) {
    cleanMedia = `data:${mimeType};base64,${cleanMedia}`;
  }

  try {
    const res = await fetch(`${EVOLUTION_API_URL}/message/sendMedia/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: {
        'apikey': EVOLUTION_API_KEY,
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
    // O Baileys/Evolution API precisa de { key: ..., message: ... } para descriptografar com a mediaKey
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

    const res = await fetch(`${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: {
        'apikey': EVOLUTION_API_KEY,
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
