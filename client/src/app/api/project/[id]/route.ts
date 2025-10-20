import { NextRequest, NextResponse } from 'next/server';
import { loadProjectOverview, loadPolicyLaw, loadSubsidy, loadRelatedProjects, loadKpiSeries, loadKpiLinks } from '@/server/dataCatalog';
import { normalizePercentSeries, normalizeUnit } from '@/server/unit';

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const overviewAll = loadProjectOverview().filter(r => r['予算事業ID'] === id);
    // pick latest by 事業年度 if multiple
    const pickLatest = (rows: any[]) => {
      if (!rows.length) return null;
      const withYear = rows.map(r => ({ r, y: Number(r['事業年度'] || r['予算年度'] || '0') }));
      withYear.sort((a,b) => b.y - a.y);
      return withYear[0].r;
    };
    const overview = pickLatest(overviewAll);

    const policies = loadPolicyLaw().filter(r => r['予算事業ID'] === id).map(r => ({
      policy_no: r['番号（政策・施策）'], policy_ministry: r['政策所管府省庁_P'], policy: r['政策'], program: r['施策'], url: r['政策・施策URL'],
      law_no: r['番号（根拠法令）'], law_name: r['法令名'], law_id: r['法令ID'], law_article: r['条'], law_item: r['項'], law_clause: r['号・号の細分'],
      plan_no: r['番号（関係する計画・通知等）'], plan_name: r['計画通知名'], plan_url: r['計画通知等URL']
    }));
    const subsidies = loadSubsidy().filter(r => r['予算事業ID'] === id).map(r => ({ target: r['補助対象'], rate: r['補助率'], cap: r['補助上限等'], url: r['補助率URL'] }));
    const related = loadRelatedProjects().filter(r => r['予算事業ID'] === id).map(r => ({ related_id: r['関連事業の事業ID'], related_name: r['関連事業の事業名'], relation: r['関連性'] }));

    const kpisAll = loadKpiSeries().filter(r => r['予算事業ID'] === id);
    const years = Array.from({length: 2060-2007+1}, (_,i)=>String(2007+i));
    const kpis = kpisAll.map(r => {
      const series = years.map(y => {
        const raw = (r[y] || '').replace(/,/g, '');
        const v = raw === '' ? null : Number(raw);
        return { year: Number(y), value: Number.isFinite(v as number) ? (v as number) : null };
      }).filter(p => p.value !== null);
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
        type: r['種別（アクティビティ・アウトプット・アウトカム）'],
        label: r['活動指標／成果指標'],
        unit: r['単位'],
        unit_disp: unitDisp,
        unit_kind: unitInfo.kind,
        direction: r['改善の上向き／下向き'],
        series: seriesOut,
      };
    })
    .filter(k => (k.label && k.label.trim().length > 0) && k.series.length > 0)
    .slice(0, 6);

    const links = loadKpiLinks().filter(r => r['予算事業ID'] === id).map(r => ({
      from_no: r['派生元ーアクティビティ・アウトプット・アウトカムの番号'], from_type: r['派生元ー種別（アクティビティ・アウトプット・アウトカム）'],
      to_no: r['派生先ーアクティビティ・アウトプット・アウトカムの番号'], to_type: r['派生先ー種別（アクティビティ・アウトプット・アウトカム）'],
      reason: r['後続アウトカムへのつながり']
    }));

    return NextResponse.json({ id, overview, policies, subsidies, related, kpis, links });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
