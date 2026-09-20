import { NextResponse } from 'next/server';
import { sendEvolutionText } from '@/lib/solo/evolution';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const target = url.searchParams.get('phone') || '5513978122222';

  const sendRes = await sendEvolutionText({
    phone: target,
    text: `🧪 Teste Diagnóstico Vercel -> WhatsApp (${new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })})`,
  });

  return NextResponse.json({
    target,
    success: sendRes.success,
    result: sendRes,
    evolutionUrlEnv: process.env.EVOLUTION_API_URL || 'not_set',
    timestamp: new Date().toISOString(),
  });
}
