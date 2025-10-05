import { NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchSubgraph } from '@/server/subgraphService';

// 入力スキーマの定義
const SubgraphInputSchema = z.object({
  node: z.string().min(1, 'node parameter is required'),
});

export async function GET(request: Request) {
  try {
    // URLパラメータからnodeIdを取得
    const { searchParams } = new URL(request.url);
    const input = SubgraphInputSchema.safeParse({ node: searchParams.get('node') });

    if (!input.success) {
      return NextResponse.json({ error: input.error.issues }, { status: 400 });
    }

    const nodeId = input.data.node;
    const data = await fetchSubgraph(nodeId);
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('Subgraph API error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
