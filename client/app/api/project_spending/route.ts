// Next.js API Route: ダミー実装（ビルドエラー回避用）
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchSpendingByProject } from '@/server/spendingService';

const InputSchema = z.object({
  projectId: z.string().min(1),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const input = InputSchema.safeParse({ projectId: searchParams.get('projectId') });
    if (!input.success) {
      return NextResponse.json({ error: input.error.issues }, { status: 400 });
    }
    const list = await fetchSpendingByProject(input.data.projectId);
    return NextResponse.json({ spending_list: list });
  } catch (error: unknown) {
    console.error('Project spending API error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
