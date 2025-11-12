import { NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchCompareRecipients } from '@/server/compareService';

const QuerySchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('agency'),
    value: z.string().min(1),
    limit: z
      .preprocess((v) => (v === null || v === undefined || v === '' ? undefined : Number(v)), z.number().int().min(1).max(50))
      .optional(),
  }),
  z.object({
    type: z.literal('project'),
    projectId: z.preprocess((v) => (v === null || v === undefined || v === '' ? undefined : Number(v)), z.number().int().min(1)),
    limit: z
      .preprocess((v) => (v === null || v === undefined || v === '' ? undefined : Number(v)), z.number().int().min(1).max(50))
      .optional(),
  }),
]);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parse = QuerySchema.safeParse({
      type: searchParams.get('type'),
      value: searchParams.get('value'),
      projectId: searchParams.get('projectId'),
      limit: searchParams.get('limit'),
    });

    if (!parse.success) {
      return NextResponse.json({ error: parse.error.issues }, { status: 400 });
    }

    const params = parse.data;
    const data = await fetchCompareRecipients(
      params.type === 'agency'
        ? { type: 'agency', value: params.value, limit: params.limit }
        : { type: 'project', projectId: params.projectId, limit: params.limit },
    );

    return NextResponse.json({ recipients: data });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

