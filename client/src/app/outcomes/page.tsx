"use client";

import React, { useEffect, useMemo, useState } from 'react';

type OutcomeItem = { project_id: string; project_name: string; type: string; label: string; unit: string; unit_disp?: string; unit_kind?: 'yen'|'percent'|'count'|'other'; direction: string; series: { year: number; value: number }[] };
import Money from '@/components/common/Money';
import { formatCountJa } from '@/utils/format';

const OutcomesPage: React.FC = () => {
  const [projectId, setProjectId] = useState('');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<OutcomeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { (async () => { try { setLoading(true); const sp = new URLSearchParams(); if (projectId) sp.set('projectId', projectId); if (q) sp.set('q', q); const res = await fetch(`/api/outcomes?${sp.toString()}`); const json = await res.json(); setItems(json.items || []);} catch(e:any){ setError(e.message);} finally { setLoading(false);} })(); }, [projectId, q]);

  const Bar: React.FC<{ value: number; max: number; color?: string }> = ({ value, max, color = '#07796b' }) => (
    <div style={{ background: '#e2f6f2', height: 8, borderRadius: 999 }}>
      <div style={{ width: `${Math.min(100, (value / Math.max(1, max)) * 100)}%`, background: color, height: 8, borderRadius: 999 }} />
    </div>
  );

  const Donut: React.FC<{ percent: number; size?: number; color?: string }> = ({ percent, size = 72, color = '#07796b' }) => (
    <div style={{ width: size, height: size, borderRadius: '50%', position: 'relative', background: `conic-gradient(${color} ${Math.max(0, Math.min(100, percent))}%, #e5e7eb 0)` }}>
      <div style={{ position: 'absolute', inset: 6, borderRadius: '50%', background: '#fff' }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{Math.round(percent)}%</div>
    </div>
  );

  const niceMax = (vals: number[]) => {
    const finite = vals.filter(v => Number.isFinite(v));
    const m = finite.length ? Math.max(...finite) : 0;
    if (m <= 0) return 1;
    const exp = Math.floor(Math.log10(m));
    const base = Math.pow(10, exp);
    const k = m / base;
    if (k <= 1) return 1 * base;
    if (k <= 2) return 2 * base;
    if (k <= 5) return 5 * base;
    return 10 * base;
  };

  const Histogram: React.FC<{ points: { year: number; value: number }[]; max?: number; height?: number; color?: string; unitKind?: 'yen'|'percent'|'count'|'other'; unitDisp?: string; }> = ({ points, max, height = 84, color = '#07796b', unitKind, unitDisp }) => {
    const values = points.map(p => p.value);
    const m = max ?? niceMax(values);
    const latest = points[points.length - 1];
    const latestText = unitKind === 'yen' ? (<Money amount={latest?.value ?? 0} />) : unitKind === 'percent' ? (<>{Math.round(latest?.value ?? 0)}%</>) : unitKind === 'count' ? (<>{formatCountJa(latest?.value ?? 0, unitDisp || '')}</>) : (<>{(latest?.value ?? 0).toLocaleString('ja-JP')} {unitDisp || ''}</>);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ height, display: 'grid', gridTemplateColumns: `repeat(${points.length}, 1fr)`, alignItems: 'end', gap: 6 }}>
          {points.map((p, i) => (
            <div key={i} style={{ height: '100%', display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ height: `${Math.max(0, Math.min(100, (p.value / Math.max(1, m)) * 100))}%`, width: '100%', background: color, borderRadius: 4 }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${points.length}, 1fr)`, gap: 6 }}>
          {points.map((p, i) => (
            <div key={i} style={{ fontSize: 10, color: '#64748b', textAlign: 'center' }}>{String(p.year).slice(-2)}</div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: '#64748b' }}>最新: {latest?.year ?? ''}年 {latestText}</div>
      </div>
    );
  };

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <header style={{ background: 'linear-gradient(90deg,#07796b 0%,#0a9a89 100%)', color: '#fff', borderRadius: 12, padding: 18 }}>
        <h1 style={{ margin: 0 }}>目標と実績</h1>
        <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input placeholder="事業ID（任意）" value={projectId} onChange={(e)=>setProjectId(e.target.value)} style={{ border: '1px solid #ddd', borderRadius: 8, padding: '8px 10px' }} />
          <input placeholder="指標名で検索（任意）" value={q} onChange={(e)=>setQ(e.target.value)} style={{ border: '1px solid #ddd', borderRadius: 8, padding: '8px 10px' }} />
        </div>
      </header>

      {loading && <div>読み込み中...</div>}
      {error && <div style={{ color: 'crimson' }}>エラー: {error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {useMemo(() => {
          const sorted = [...items];
          sorted.sort((a, b) => {
            const ak = a.unit_kind === 'percent' ? 0 : 1;
            const bk = b.unit_kind === 'percent' ? 0 : 1;
            if (ak !== bk) return ak - bk;
            if (ak === 0) {
              const al = a.series[a.series.length - 1]?.value ?? -Infinity;
              const bl = b.series[b.series.length - 1]?.value ?? -Infinity;
              return bl - al;
            }
            return 0;
          });
          return sorted;
        }, [items]).map((k, idx) => {
          const last = k.series[k.series.length - 1];
          const recent = k.series.slice(-8);
          const scaleMax = niceMax(recent.map(s => s.value));
          const isPercent = k.unit_kind === 'percent';
          return (
            <div key={idx} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 12px', background: '#fff' }}>
              <div style={{ display: 'grid', gridTemplateColumns: isPercent ? '84px 1fr' : '1fr', gap: 10, alignItems: 'center' }}>
                {isPercent && last && (
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <Donut percent={Math.max(0, Math.min(100, last.value))} />
                  </div>
                )}
                <div>
                  <div style={{ fontWeight: 700 }}>{k.label}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{k.project_name} / {k.type} / {(k.unit_disp || k.unit || '単位不明')} / {k.direction || '—'}</div>
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                {isPercent ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                    {recent.slice(-8).map(p => (
                      <div key={p.year} style={{ border: '1px solid #eef2f7', borderRadius: 8, padding: '6px 8px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>{p.year}</span>
                        <span style={{ fontWeight: 700 }}>{Math.round(p.value)}%</span>
                      </div>
                    ))}
                  </div>
                ) : k.unit_kind === 'count' ? (
                  <Histogram points={recent} max={scaleMax} color="#07796b" unitKind={k.unit_kind} unitDisp={k.unit_disp} />
                ) : (
                  <div style={{ display: 'grid', gap: 4 }}>
                    {recent.map(p => (
                      <div key={p.year} style={{ display: 'grid', gridTemplateColumns: '50px 1fr 100px', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontSize: 12 }}>{p.year}</div>
                        <Bar value={p.value} max={scaleMax} />
                        <div style={{ fontSize: 12, textAlign: 'right' }}>
                          {k.unit_kind === 'yen' ? (
                            <Money amount={p.value} />
                          ) : (
                            <>{p.value.toLocaleString('ja-JP')} {k.unit_disp || ''}</>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OutcomesPage;
