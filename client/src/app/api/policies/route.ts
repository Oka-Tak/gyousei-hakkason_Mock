import { NextResponse } from 'next/server';
import { loadPolicyLaw } from '@/server/dataCatalog';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').toLowerCase();
    const rows = loadPolicyLaw();
    const items = rows.map(r => ({
      project_id: r['予算事業ID'], project_name: r['事業名'],
      policy_no: r['番号（政策・施策）'], ministry: r['政策所管府省庁_P'], policy: r['政策'], program: r['施策'], url: r['政策・施策URL'],
      law_no: r['番号（根拠法令）'], law_name: r['法令名'], law_id: r['法令ID'], plan_name: r['計画通知名']
    })).filter(it => !q || ((it.policy||'').toLowerCase().includes(q) || (it.law_name||'').toLowerCase().includes(q) || (it.project_name||'').toLowerCase().includes(q)));
    return NextResponse.json({ items });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

