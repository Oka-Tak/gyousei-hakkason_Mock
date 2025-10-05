import { NextResponse } from 'next/server';
import { loadKpiSeries } from '@/server/dataCatalog';
import { normalizePercentSeries, normalizeUnit } from '@/server/unit';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId') || '';
    const q = (searchParams.get('q') || '').toLowerCase();
    const rows = loadKpiSeries().filter(r => !projectId || r['予算事業ID'] === projectId);
    const years = Array.from({length: 2060-2007+1}, (_,i)=>String(2007+i));
    const items = rows.map(r => {
      const series = years.map(y => {
        const raw = (r[y] || '').replace(/,/g, '');
        const v = raw === '' ? null : Number(raw);
        return { year: Number(y), value: Number.isFinite(v as number) ? (v as number) : null };
      }).filter(p => p.value !== null);
      // 単位正規化
      const unitInfo = normalizeUnit(r['単位'] || '');
      const baseValues = series.map(p => unitInfo.convert(p.value!));
      let dispValues = baseValues;
      let unitDisp = unitInfo.baseUnit;
      if (unitInfo.kind === 'percent') {
        const r2 = normalizePercentSeries(baseValues);
        dispValues = r2.series;
        unitDisp = r2.unit;
      }
      const seriesOut = series.map((p, idx) => ({ year: p.year, value: dispValues[idx] }));
      return {
        project_id: r['予算事業ID'], project_name: r['事業名'],
        type: r['種別（アクティビティ・アウトプット・アウトカム）'], label: r['活動指標／成果指標'], unit: r['単位'], direction: r['改善の上向き／下向き'],
        unit_disp: unitDisp,
        unit_kind: unitInfo.kind,
        series: seriesOut,
      };
    })
    .filter(it => (it.label && it.label.trim().length > 0) && it.series.length > 0)
    .filter(it => !q || ((it.label||'').toLowerCase().includes(q) || (it.project_name||'').toLowerCase().includes(q)));
    return NextResponse.json({ items: items.slice(0, 200) });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
