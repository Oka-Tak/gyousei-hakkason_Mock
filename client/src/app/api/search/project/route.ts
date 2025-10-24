import { NextResponse } from 'next/server';
import { z } from 'zod';
import { searchProjectsSemantically } from '@/server/semanticSearch';

const QuerySchema = z.object({
  q: z.string().min(1, '検索語を入力してください'),
  limit: z
    .preprocess((value) => (value === null || value === undefined || value === '' ? undefined : Number(value)), z.number().int().min(1).max(20))
    .optional(),
  threshold: z
    .preprocess((value) => (value === null || value === undefined || value === '' ? undefined : Number(value)), z.number().min(0).max(1))
    .optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parseResult = QuerySchema.safeParse({
      q: searchParams.get('q'),
      limit: searchParams.get('limit'),
      threshold: searchParams.get('threshold'),
    });

    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues }, { status: 400 });
    }

    const matches = await searchProjectsSemantically({
      query: parseResult.data.q,
      limit: parseResult.data.limit,
      threshold: parseResult.data.threshold,
    });

    return NextResponse.json({ matches });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes('OPENAI_API_KEY') ? 500 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

