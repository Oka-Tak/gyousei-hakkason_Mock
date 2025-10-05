"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useMainGraphData } from '@/features/graph/hooks/useGraphData';
import Money from '@/components/common/Money';

type Summary = { total: number; projectCount: number; firstLevel: { name: string; value: number }[] };
type RecItem = { recipient_name: string; corporate_number: string | null; total_amount: number; projects_count: number };

async function fetchSummary(agency: string): Promise<Summary> {
  const res = await fetch(`/api/insights/summary?agency=${encodeURIComponent(agency)}`);
  if (!res.ok) throw new Error(`summary ${res.status}`);
  return res.json();
}
async function fetchRecipients(agency: string, limit = 5): Promise<RecItem[]> {
  const res = await fetch(`/api/insights/recipients?agency=${encodeURIComponent(agency)}&limit=${limit}`);
  if (!res.ok) throw new Error(`recipients ${res.status}`);
  const json = await res.json();
  return json.recipients || [];
}

const ComparePage: React.FC = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => { const f = () => setIsMobile(window.innerWidth <= 600); f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  const { allAgencies } = useMainGraphData([]);
  const agencies = useMemo(() => allAgencies || [], [allAgencies]);

  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');
  const [leftS, setLeftS] = useState<Summary | null>(null);
  const [rightS, setRightS] = useState<Summary | null>(null);
  const [leftR, setLeftR] = useState<RecItem[]>([]);
  const [rightR, setRightR] = useState<RecItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    if (!left || !right) return;
    try {
      setLoading(true); setError(null);
      const [ls, rs, lr, rr] = await Promise.all([
        fetchSummary(left), fetchSummary(right), fetchRecipients(left, 5), fetchRecipients(right, 5)
      ]);
      setLeftS(ls); setRightS(rs); setLeftR(lr); setRightR(rr);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  };

  // Prefill from URL
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const a = sp.get('a') || '';
    const b = sp.get('b') || '';
    if (a) setLeft(a);
    if (b) setRight(b);
    if (a && b) { (async () => { await go(); })(); }
  }, []);

  return (
    <div style={{ padding: isMobile ? 12 : 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header style={{ background: 'linear-gradient(90deg,#07796b 0%,#0a9a89 100%)', color: '#fff', borderRadius: 12, padding: isMobile ? 16 : 22 }}>
        <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 28 }}>くらべる（A/B）</h1>
        <p style={{ marginTop: 6 }}>2つの「どこから」を並べるだけで、合計・内訳・受取先の違いが見えてきます。</p>
      </header>

      <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: '1 1 300px' }}>
          <input list="agency-list" placeholder="左（例: 総務省）" value={left} onChange={(e) => setLeft(e.target.value)} style={{ flex: 1, border: '1px solid #ddd', borderRadius: 8, padding: '8px 10px' }} />
          <input list="agency-list" placeholder="右（例: 文部科学省）" value={right} onChange={(e) => setRight(e.target.value)} style={{ flex: 1, border: '1px solid #ddd', borderRadius: 8, padding: '8px 10px' }} />
          <datalist id="agency-list">{agencies.map(a => <option key={a} value={a} />)}</datalist>
        </div>
        <button onClick={go} style={{ border: '1px solid #07796b', background: '#07796b', color: '#fff', padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}>くらべる</button>
        <button onClick={() => { setLeft(''); setRight(''); setLeftS(null); setRightS(null); setLeftR([]); setRightR([]); }} style={{ border: '1px solid #ddd', background: '#f8fafc', padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}>クリア</button>
      </section>

      {loading && <div>読み込み中...</div>}
      {error && <div style={{ color: 'crimson' }}>エラー: {error}</div>}

      {(leftS && rightS) && (
        <section style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
          {[{ title: left, s: leftS, r: leftR }, { title: right, s: rightS, r: rightR }].map((col, idx) => (
            <div key={idx} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>{col.title}</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px', minWidth: 180, background: '#f8fafc', border: '1px solid #eef2f7', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>合計</div>
                  <div style={{ fontWeight: 800, fontSize: isMobile ? 18 : 22 }}><Money amount={col.s.total} /></div>
                </div>
                <div style={{ flex: '1 1 200px', minWidth: 180, background: '#f8fafc', border: '1px solid #eef2f7', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>プロジェクト数</div>
                  <div style={{ fontWeight: 800, fontSize: isMobile ? 18 : 22 }}>{col.s.projectCount.toLocaleString('ja-JP')}</div>
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>内訳（第一階層 上位）</div>
                {col.s.firstLevel.slice(0, 5).map((c) => (
                  <div key={c.name} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 80px', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 12, color: '#334155' }}>{c.name}</div>
                    <div style={{ background: '#e2f6f2', height: 8, borderRadius: 999 }}>
                      <div style={{ width: `${Math.min(100, (c.value / Math.max(1, col.s.total)) * 100)}%`, background: '#07796b', height: 8, borderRadius: 999 }} />
                    </div>
                    <div style={{ fontSize: 12, textAlign: 'right' }}><Money amount={c.value} /></div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>上位受取先</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
                  {col.r.map((r) => (
                    <div key={`${r.recipient_name}::${r.corporate_number ?? ''}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center', border: '1px solid #eef2f7', borderRadius: 10, padding: '8px 10px', background: '#f8fafc' }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{r.recipient_name || '不明'}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{r.corporate_number || '法人番号なし'}</div>
                      </div>
                      <div style={{ fontWeight: 800 }}><Money amount={r.total_amount} /></div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                <button onClick={() => (location.href = `/subgraph?node=${encodeURIComponent(col.title)}`)} style={{ border: '1px solid #07796b', background: '#07796b', color: '#fff', padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}>グラフで見る</button>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
};

export default ComparePage;

