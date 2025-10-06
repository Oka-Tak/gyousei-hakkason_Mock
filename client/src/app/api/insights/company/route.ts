import { NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchCompanyOverview } from '@/server/insightService';

const Schema = z.object({ cn: z.string().optional(), name: z.string().optional() }).refine(v => !!v.cn || !!v.name, { message: 'cn or name required' });

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const input = Schema.safeParse({ cn: searchParams.get('cn') || undefined, name: searchParams.get('name') || undefined });
    if (!input.success) return NextResponse.json({ error: input.error.issues }, { status: 400 });
    const overview = await fetchCompanyOverview({ corporate_number: input.data.cn, name: input.data.name });
    return NextResponse.json({ overview });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

