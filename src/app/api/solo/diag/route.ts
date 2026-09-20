import { NextResponse } from 'next/server';
import { sendEvolutionText } from '@/lib/solo/evolution';
import { getTrialWelcomeMessage } from '@/lib/solo/trial';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const target = url.searchParams.get('phone') || '5513978122222';

  const welcome = getTrialWelcomeMessage();
  const sendRes = await sendEvolutionText({
    phone: target,
    text: welcome,
  });

  return NextResponse.json({
    target,
    success: sendRes.success,
    result: sendRes,
    timestamp: new Date().toISOString(),
  });
}
