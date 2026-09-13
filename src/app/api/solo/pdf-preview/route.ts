import { NextRequest, NextResponse } from 'next/server';
import { generateCashLedgerPdfBuffer } from '@/lib/solo/cash-ledger-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId') || '3f9a839b-2b1b-41ec-91f2-7da50a95b770';

    const { buffer, fileName } = await generateCashLedgerPdfBuffer(clientId);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err: any) {
    console.error('[PDF Preview Error]:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro ao gerar visualização do PDF' },
      { status: 500 }
    );
  }
}
