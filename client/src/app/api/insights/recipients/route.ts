import { NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchTopRecipientsByAgency } from '@/server/insightService';

const Schema = z.object({ agency: z.string().min(1), limit: z.coerce.number().min(1).max(50).optional() });

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const input = Schema.safeParse({ agency: searchParams.get('agency'), limit: searchParams.get('limit') });
    if (!input.success) return NextResponse.json({ error: input.error.issues }, { status: 400 });
    const data = await fetchTopRecipientsByAgency(input.data.agency, input.data.limit ?? 10);
    return NextResponse.json({ recipients: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

