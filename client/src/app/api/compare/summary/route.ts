import { NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchCompareSummary } from '@/server/compareService';

const QuerySchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('agency'),
    value: z.string().min(1, '対象の府省庁名を指定してください'),
  }),
  z.object({
    type: z.literal('project'),
    projectId: z.preprocess((v) => (v === null || v === undefined || v === '' ? undefined : Number(v)), z.number().int().min(1, 'プロジェクトIDを指定してください')),
  }),
]);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parse = QuerySchema.safeParse({
      type: searchParams.get('type'),
      value: searchParams.get('value'),
      projectId: searchParams.get('projectId'),
    });
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.issues }, { status: 400 });
    }

    const params = parse.data;
    const summary = await fetchCompareSummary(
      params.type === 'agency'
        ? { type: 'agency', value: params.value }
        : { type: 'project', projectId: params.projectId },
    );
    if (!summary) {
      return NextResponse.json({ error: '対象が見つかりませんでした。' }, { status: 404 });
    }

    return NextResponse.json({ summary });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

