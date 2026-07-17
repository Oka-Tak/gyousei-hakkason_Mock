import { NextResponse } from 'next/server';
import { searchOutcomes } from '@/modules/catalog/application/catalogUseCases';
import { csvProjectCatalogRepository } from '@/modules/catalog/infrastructure/csvProjectCatalogRepository';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const items = searchOutcomes(csvProjectCatalogRepository, {
      projectId: searchParams.get('projectId') || undefined,
      query: searchParams.get('q') || undefined,
    });
    return NextResponse.json({ items });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
