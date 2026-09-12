/**
 * Cliente de Integração com a Evolution API (Docker)
 * Gerencia envio de mensagens, documentos, mídias e áudios nativos.
 */

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE_NAME || 'analisai';

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

  try {
    const res = await fetch(`${EVOLUTION_API_URL}/message/sendMedia/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: formattedPhone,
        mediaMessage: {
          mediatype: mediaType,
          fileName: fileName || (mediaType === 'document' ? 'documento.pdf' : 'arquivo'),
          caption: caption || '',
          media: mediaBase64 || mediaUrl,
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
