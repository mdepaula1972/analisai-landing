import { NextResponse } from 'next/server';
import { sendEvolutionText } from '@/lib/solo/evolution';

export const dynamic = 'force-dynamic';

export async function GET() {
  const r = await sendEvolutionText({
    phone: '5513978122222',
    text: '🧪 PING DIRETO DA VERCEL PARA WHATSAPP',
  });
  return NextResponse.json(r);
}
