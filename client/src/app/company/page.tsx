"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Money from '@/components/common/Money';

type Overview = {
  recipient_name: string;
  corporate_number: string | null;
  total_amount: number;
  projects_count: number;
  by_agency: Array<{ name: string; value: number }>;
  by_year: Array<{ year: number; value: number }>;
  contract_methods: Array<{ name: string; count: number; value: number }>;
};

const CompanyPage: React.FC = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => { const f = () => setIsMobile(window.innerWidth <= 600); f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);

  const [cn, setCn] = useState('');
  const [name, setName] = useState('');
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (params: { cn?: string; name?: string }) => {
    try {
      setLoading(true); setError(null);
      const sp = new URLSearchParams();
      if (params.cn) sp.set('cn', params.cn);
      if (params.name) sp.set('name', params.name);
      const res = await fetch(`/api/insights/company?${sp.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json.overview || null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const cnQ = sp.get('cn') || '';
    const nameQ = sp.get('name') || '';
    if (cnQ || nameQ) {
      setCn(cnQ); setName(nameQ); search({ cn: cnQ || undefined, name: nameQ || undefined });
    }
  }, []);

  return (
    <div style={{ padding: isMobile ? 12 : 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header style={{ background: 'linear-gradient(90deg,#07796b 0%,#0a9a89 100%)', color: '#fff', borderRadius: 12, padding: isMobile ? 16 : 22 }}>
        <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 28 }}>会社（受取先）概要</h1>
        <p style={{ marginTop: 6 }}>法人番号（cn）または名称の一部で検索します。例: ?cn=1234567890123 または ?name=○○株式会社</p>
      </header>

      <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input placeholder="法人番号（例：1234567890123）" value={cn} onChange={(e) => setCn(e.target.value)} style={{ flex: '1 1 260px', minWidth: 220, border: '1px solid #ddd', borderRadius: 8, padding: '8px 10px' }} />
        <input placeholder="名称（例：○○株式会社）" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: '1 1 260px', minWidth: 220, border: '1px solid #ddd', borderRadius: 8, padding: '8px 10px' }} />
        <button onClick={() => search({ cn: cn || undefined, name: name || undefined })} style={{ border: '1px solid #07796b', background: '#07796b', color: '#fff', padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}>検索</button>
        <button onClick={() => { setCn(''); setName(''); setData(null); setError(null); }} style={{ border: '1px solid #ddd', background: '#f8fafc', padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}>クリア</button>
      </section>

      {loading && <div>読み込み中...</div>}
      {error && <div style={{ color: 'crimson' }}>エラー: {error}</div>}

      {data && (
        <section style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1fr', gap: 16 }}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 12, color: '#64748b' }}>名称</div>
                <div style={{ fontWeight: 800 }}>{data.recipient_name}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>法人番号</div>
                <div style={{ fontWeight: 600 }}>{data.corporate_number || 'なし'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>合計金額</div>
                <div style={{ fontWeight: 800, fontSize: isMobile ? 18 : 22 }}><Money amount={data.total_amount} /></div>
                <div style={{ fontSize: 12, color: '#64748b' }}>関連プロジェクト</div>
                <div style={{ fontWeight: 800 }}>{data.projects_count.toLocaleString('ja-JP')}</div>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>省庁別（上位）</div>
              {data.by_agency.map(a => (
                <div key={a.name} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 100px', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 12 }}>{a.name}</div>
                  <div style={{ background: '#e2f6f2', height: 8, borderRadius: 999 }}>
                    <div style={{ width: `${Math.min(100, (a.value / Math.max(1, data.total_amount)) * 100)}%`, background: '#07796b', height: 8, borderRadius: 999 }} />
                  </div>
                  <div style={{ fontSize: 12, textAlign: 'right' }}><Money amount={a.value} /></div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>年別の推移</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
              {data.by_year.map(y => (
                <div key={y.year} style={{ display: 'grid', gridTemplateColumns: '50px 1fr 100px', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 12 }}>{y.year}</div>
                  <div style={{ background: '#f1f5f9', height: 8, borderRadius: 999 }}>
                    <div style={{ width: `${Math.min(100, (y.value / Math.max(1, data.total_amount)) * 100)}%`, background: '#0a9a89', height: 8, borderRadius: 999 }} />
                  </div>
                  <div style={{ fontSize: 12, textAlign: 'right' }}><Money amount={y.value} /></div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>契約方法</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
                {data.contract_methods.map(c => (
                  <div key={c.name} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'center' }}>
                    <div style={{ fontSize: 12 }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{c.count.toLocaleString('ja-JP')}件</div>
                    <div style={{ fontWeight: 700 }}><Money amount={c.value} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {!data && !loading && (
        <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>検索のヒント</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: '#475569' }}>
            <li>法人番号があるとより正確です（重複名称を避けられます）。</li>
            <li>名称は一部一致でも検索できます（例：通信、財団）。</li>
            <li>「グラフで見る」から、関係の広がりを辿れます。</li>
          </ul>
        </section>
      )}
    </div>
  );
};

export default CompanyPage;

