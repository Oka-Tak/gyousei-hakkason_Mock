"use client";

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useMainGraphData } from '@/features/graph/hooks/useGraphData';
import Money from '@/components/common/Money';
import { useToast } from '@/components/common/Toast';

type Overview = {
  recipient_name: string;
  corporate_number: string | null;
  total_amount: number;
  projects_count: number;
  by_agency: Array<{ name: string; value: number }>;
  by_year: Array<{ year: number; value: number }>;
  contract_methods: Array<{ name: string; count: number; value: number }>;
};

type RecipientItem = {
  recipient_name: string;
  corporate_number: string | null;
  total_amount: number;
  projects_count: number;
};

type ViewMode = 'search' | 'ranking';

const CompanyPage: React.FC = () => {
  const { showToast } = useToast();
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const f = () => setIsMobile(window.innerWidth <= 600);
    f();
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);

  const [viewMode, setViewMode] = useState<ViewMode>('search');

  // === 会社検索モード ===
  const [cn, setCn] = useState('');
  const [name, setName] = useState('');
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchCompany = useCallback(async (params: { cn?: string; name?: string }) => {
    try {
      setLoading(true);
      setError(null);
      const sp = new URLSearchParams();
      if (params.cn) sp.set('cn', params.cn);
      if (params.name) sp.set('name', params.name);
      const res = await fetch(`/api/insights/company?${sp.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json.overview || null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const cnQ = sp.get('cn') || '';
    const nameQ = sp.get('name') || '';
    if (cnQ || nameQ) {
      setCn(cnQ);
      setName(nameQ);
      searchCompany({ cn: cnQ || undefined, name: nameQ || undefined });
    }
  }, [searchCompany]);

  // === 省庁別ランキングモード ===
  const { allAgencies } = useMainGraphData([]);
  const agencies = useMemo(() => allAgencies || [], [allAgencies]);

  const [agency, setAgency] = useState('');
  const [limit, setLimit] = useState(20);
  const [recipients, setRecipients] = useState<RecipientItem[]>([]);
  const [recipientFilter, setRecipientFilter] = useState('');
  const [rankingLoading, setRankingLoading] = useState(false);
  const [rankingError, setRankingError] = useState<string | null>(null);

  const loadRecipients = useCallback(async (ag: string, lim: number) => {
    if (!ag) return;
    try {
      setRankingLoading(true);
      setRankingError(null);
      const res = await fetch(`/api/insights/recipients?agency=${encodeURIComponent(ag)}&limit=${lim}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setRecipients(json.recipients || []);
    } catch (e: unknown) {
      setRankingError(e instanceof Error ? e.message : String(e));
    } finally {
      setRankingLoading(false);
    }
  }, []);

  useEffect(() => {
    if (viewMode === 'ranking' && agency) {
      loadRecipients(agency, limit);
    }
  }, [viewMode, agency, limit, loadRecipients]);

  const filteredRecipients = useMemo(
    () => recipients.filter((r) => !recipientFilter || (r.recipient_name || '').toLowerCase().includes(recipientFilter.toLowerCase())),
    [recipients, recipientFilter]
  );

  const handleViewCompanyDetail = useCallback((recipientName: string, corporateNumber: string | null) => {
    setViewMode('search');
    setCn(corporateNumber || '');
    setName(corporateNumber ? '' : recipientName);
    searchCompany({ cn: corporateNumber || undefined, name: corporateNumber ? undefined : recipientName });
  }, [searchCompany]);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 20px',
    border: 'none',
    borderBottom: active ? '3px solid #07796b' : '3px solid transparent',
    background: 'transparent',
    color: active ? '#07796b' : '#64748b',
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
    fontSize: 15,
    transition: 'all 0.2s',
  });

  return (
    <div style={{ padding: isMobile ? 12 : 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header style={{ background: 'linear-gradient(90deg,#07796b 0%,#0a9a89 100%)', color: '#fff', borderRadius: 12, padding: isMobile ? 16 : 22 }}>
        <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 28 }}>企業・受取先</h1>
        <p style={{ marginTop: 6 }}>法人番号や名称で企業を検索したり、省庁別の受取先ランキングを確認できます。</p>
      </header>

      {/* タブ */}
      <div style={{ borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 4 }}>
        <button type="button" style={tabStyle(viewMode === 'search')} onClick={() => setViewMode('search')}>
          企業検索
        </button>
        <button type="button" style={tabStyle(viewMode === 'ranking')} onClick={() => setViewMode('ranking')}>
          省庁別ランキング
        </button>
      </div>

      {/* 会社検索モード */}
      {viewMode === 'search' && (
        <>
          <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              placeholder="法人番号（例：1234567890123）"
              value={cn}
              onChange={(e) => setCn(e.target.value)}
              style={{ flex: '1 1 260px', minWidth: 220, border: '1px solid #ddd', borderRadius: 8, padding: '8px 10px' }}
            />
            <input
              placeholder="名称（例：○○株式会社）"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') searchCompany({ cn: cn || undefined, name: name || undefined });
              }}
              style={{ flex: '1 1 260px', minWidth: 220, border: '1px solid #ddd', borderRadius: 8, padding: '8px 10px' }}
            />
            <button
              onClick={() => searchCompany({ cn: cn || undefined, name: name || undefined })}
              style={{ border: '1px solid #07796b', background: '#07796b', color: '#fff', padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}
            >
              検索
            </button>
            <button
              onClick={() => { setCn(''); setName(''); setData(null); setError(null); }}
              style={{ border: '1px solid #ddd', background: '#f8fafc', padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}
            >
              クリア
            </button>
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
                  {data.by_agency.map((a) => (
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
                  {data.by_year.map((y) => (
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
                    {data.contract_methods.map((c) => (
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
                <li>省庁別ランキングから企業を選ぶと、詳細が表示されます。</li>
              </ul>
            </section>
          )}
        </>
      )}

      {/* 省庁別ランキングモード */}
      {viewMode === 'ranking' && (
        <>
          <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              list="agency-list"
              placeholder="例: 総務省"
              value={agency}
              onChange={(e) => setAgency(e.target.value)}
              style={{ flex: '1 1 260px', minWidth: 220, border: '1px solid #ddd', borderRadius: 8, padding: '8px 10px' }}
            />
            <datalist id="agency-list">
              {agencies.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
            <input
              placeholder="受取先名で絞り込み"
              value={recipientFilter}
              onChange={(e) => setRecipientFilter(e.target.value)}
              style={{ flex: '1 1 220px', minWidth: 200, border: '1px solid #ddd', borderRadius: 8, padding: '8px 10px' }}
            />
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              style={{ border: '1px solid #ddd', borderRadius: 8, padding: '8px 10px' }}
            >
              <option value={10}>10件</option>
              <option value={20}>20件</option>
              <option value={30}>30件</option>
              <option value={50}>50件</option>
            </select>
            <button
              onClick={() => agency && loadRecipients(agency, limit)}
              style={{ border: '1px solid #07796b', background: '#07796b', color: '#fff', padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}
            >
              更新
            </button>
          </section>

          {rankingLoading && <div>読み込み中...</div>}
          {rankingError && <div style={{ color: 'crimson' }}>エラー: {rankingError}</div>}

          {!!agency && !rankingLoading && (
            <section style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
              {filteredRecipients.map((r) => (
                <div
                  key={`${r.recipient_name}::${r.corporate_number ?? ''}`}
                  style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, background: '#fff', display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}
                >
                  <div>
                    <div style={{ fontWeight: 800 }}>{r.recipient_name || '不明'}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{r.corporate_number || '法人番号なし'}</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>関連プロジェクト: {r.projects_count}</div>
                  </div>
                  <div style={{ fontWeight: 800 }}><Money amount={r.total_amount} /></div>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${r.recipient_name} ${r.corporate_number ?? ''}`.trim());
                        showToast('クリップボードにコピーしました', 'success');
                      }}
                      style={{ border: '1px solid #ddd', background: '#f8fafc', padding: '6px 10px', borderRadius: 8, cursor: 'pointer' }}
                    >
                      コピー
                    </button>
                    <button
                      onClick={() => handleViewCompanyDetail(r.recipient_name, r.corporate_number)}
                      style={{ border: '1px solid #0ea5e9', background: '#0ea5e9', color: '#fff', padding: '6px 10px', borderRadius: 8, cursor: 'pointer' }}
                    >
                      詳細を見る
                    </button>
                    <button
                      onClick={() => agency && (location.href = `/subgraph?node=${encodeURIComponent(agency)}`)}
                      style={{ border: '1px solid #07796b', background: '#07796b', color: '#fff', padding: '6px 10px', borderRadius: 8, cursor: 'pointer' }}
                    >
                      グラフで見る
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}

          {!agency && !rankingLoading && (
            <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>使い方</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#475569' }}>
                <li>省庁を選んで、その省庁の上位受取先を表示します。</li>
                <li>「詳細を見る」をクリックすると、企業検索に切り替わり詳細が表示されます。</li>
                <li>「グラフで見る」から、関係の広がりを辿れます。</li>
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default CompanyPage;
