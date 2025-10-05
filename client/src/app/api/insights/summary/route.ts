import { NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchMainData } from '@/server/dataService';

const Schema = z.object({ agency: z.string().min(1).optional() });

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const input = Schema.safeParse({ agency: searchParams.get('agency') || undefined });
    if (!input.success) return NextResponse.json({ error: input.error.issues }, { status: 400 });
    const rows = await fetchMainData();
    const data = input.data.agency
      ? rows.filter((r: any) => r.agency_name === input.data.agency || r.ministry_name === input.data.agency)
      : rows;
    const total = data.reduce((s: number, r: any) => s + Number(r.total_budget || 0), 0);
    const projectCount = data.length;
    const firstLevel = new Map<string, number>();
    data.forEach((r: any) => {
      const k = r.bureau_agency || 'その他';
      firstLevel.set(k, (firstLevel.get(k) || 0) + Number(r.total_budget || 0));
    });
    const firstLevelArray = Array.from(firstLevel.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
    return NextResponse.json({ total, projectCount, firstLevel: firstLevelArray });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

