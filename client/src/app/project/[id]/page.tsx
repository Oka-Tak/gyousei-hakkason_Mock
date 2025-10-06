"use client";

import React, { useEffect, useState } from 'react';
import Money from '@/components/common/Money';
import { formatCountJa } from '@/utils/format';

type ProjectDetail = {
  id: string;
  overview: any;
  policies: any[];
  subsidies: any[];
  related: any[];
  kpis: Array<{ type: string; label: string; unit: string; unit_disp?: string; unit_kind?: 'yen'|'percent'|'count'|'other'; direction: string; series: { year: number; value: number }[] }>
};

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

const ProjectPage: React.FC<{ params: { id: string } }> = ({ params }) => {
  const { id } = params;
  const [data, setData] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/project/${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json);
      } catch (e: any) { setError(e.message); }
    })();
  }, [id]);

  if (error) return <div style={{ padding: 16, color: 'crimson' }}>エラー: {error}</div>;
  if (!data) return <div style={{ padding: 16 }}>読み込み中...</div>;

  const ov = data.overview || {};
  const title = ov['事業名'] || `事業 ${id}`;

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header style={{ background: 'linear-gradient(90deg,#07796b 0%,#0a9a89 100%)', color: '#fff', borderRadius: 12, padding: 18 }}>
        <h1 style={{ margin: 0 }}>{title}</h1>
        <div style={{ marginTop: 4, fontSize: 13, opacity: 0.9 }}>事業ID: {id}（{ov['事業年度'] || ov['予算年度'] || '年度不明'}）</div>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>概要</div>
          <div style={{ marginBottom: 8 }}><b>目的</b><div>{ov['事業の目的'] || '—'}</div></div>
          <div style={{ marginBottom: 8 }}><b>現状・課題</b><div>{ov['現状・課題'] || '—'}</div></div>
          <div style={{ marginBottom: 8 }}><b>事業の概要</b><div>{ov['事業の概要'] || '—'}</div></div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
            <div><b>開始年度</b> {ov['事業開始年度'] || '—'}</div>
            <div><b>終了予定</b> {ov['事業終了（予定）年度'] || (ov['終了予定なし'] ? 'なし' : '—')}</div>
            <div><b>主要経費</b> {ov['主要経費'] ? <Money amount={Number((ov['主要経費']||'').replace(/,/g,''))} /> : '—'}</div>
            {ov['事業概要URL'] && <a href={ov['事業概要URL']} target="_blank" rel="noreferrer">概要URL</a>}
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['実施方法ー直接実施','実施方法ー補助','実施方法ー負担','実施方法ー交付','実施方法ー分担金・拠出金','実施方法ーその他'].map(k => (
              ov[k] ? <span key={k} style={{ background: '#f8fafc', border: '1px solid #eef2f7', borderRadius: 8, padding: '4px 8px', fontSize: 12 }}>{k.replace('実施方法ー','')}</span> : null
            ))}
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>根拠・政策</div>
          {data.policies.length === 0 && <div style={{ color: '#64748b', fontSize: 13 }}>情報が見つかりませんでした。</div>}
          {data.policies.slice(0,6).map((p,i) => (
            <div key={i} style={{ border: '1px solid #eef2f7', borderRadius: 10, padding: '6px 8px', marginBottom: 6, background: '#f8fafc' }}>
              <div style={{ fontWeight: 700 }}>{p.policy || p.program || p.law_name || '—'}</div>
              {p.url && <a href={p.url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>政策URL</a>}
              {p.law_name && <div style={{ fontSize: 12, color: '#64748b' }}>{p.law_name}（{p.law_id || p.law_no || ''}）</div>}
            </div>
          ))}
          <div style={{ fontWeight: 800, margin: '12px 0 6px' }}>補助率等</div>
          {data.subsidies.slice(0,6).map((s,i) => (
            <div key={i} style={{ fontSize: 13, display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <span>{s.target || '対象不明'}</span>
              <span style={{ color: '#64748b' }}>{s.rate || '—'}</span>
              <span style={{ color: '#64748b' }}>{s.cap || ''}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>KPI（抜粋）</div>
        {data.kpis.length === 0 && <div style={{ color: '#64748b', fontSize: 13 }}>情報が見つかりませんでした。</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {useMemo(() => {
            const arr = [...data.kpis];
            arr.sort((a,b) => {
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
            return arr;
          }, [data.kpis]).map((k,idx) => {
            const recent = k.series.slice(-8);
            const last = k.series[k.series.length - 1];
            const scaleMax = niceMax(recent.map(s => s.value));
            const isPercent = k.unit_kind === 'percent';
            return (
              <div key={idx} style={{ border: '1px solid #eef2f7', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: isPercent ? '84px 1fr' : '1fr', gap: 10, alignItems: 'center' }}>
                  {isPercent && last && (
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <Donut percent={Math.max(0, Math.min(100, last.value))} />
                    </div>
                  )}
                  <div>
                    <div style={{ fontWeight: 700 }}>{k.label}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{k.type} / {(k.unit_disp || k.unit || '単位不明')} / {k.direction || '—'}</div>
                  </div>
                </div>
                <div style={{ marginTop: 6 }}>
                  {isPercent ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                      {recent.map((p) => (
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
                      {recent.map((p) => (
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
      </section>

      <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>関連事業</div>
        {data.related.length === 0 && <div style={{ color: '#64748b', fontSize: 13 }}>関連情報が見つかりませんでした。</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {data.related.map((r,i) => (
            <div key={i} style={{ border: '1px solid #eef2f7', borderRadius: 10, padding: '6px 8px' }}>
              <a href={`/project/${encodeURIComponent(r.related_id)}`} style={{ fontWeight: 700 }}>{r.related_name || r.related_id}</a>
              <div style={{ fontSize: 12, color: '#64748b' }}>{r.relation || ''}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default ProjectPage;
