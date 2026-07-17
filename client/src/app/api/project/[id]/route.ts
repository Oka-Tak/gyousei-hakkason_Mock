import { NextRequest, NextResponse } from 'next/server';
import { getProjectDetail } from '@/modules/catalog/application/catalogUseCases';
import { csvProjectCatalogRepository } from '@/modules/catalog/infrastructure/csvProjectCatalogRepository';

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return NextResponse.json(getProjectDetail(csvProjectCatalogRepository, id));
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
