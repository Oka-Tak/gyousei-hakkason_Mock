"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useMainGraphData } from '@/features/graph/hooks/useGraphData';
import { formatJaYen, formatPercent } from '@/utils/format';
import Money from '@/components/common/Money';

type Summary = {
  total: number;
  projectCount: number;
  firstLevel: { name: string; value: number }[];
};

const InsightPage: React.FC = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => { const f = () => setIsMobile(window.innerWidth <= 600); f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);

  // Load all agencies for suggestions; data itself is fetched but not rendered as graph here
  const { allAgencies } = useMainGraphData([]);
  const [agency, setAgency] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recipients, setRecipients] = useState<Array<{ recipient_name: string; corporate_number: string | null; total_amount: number; projects_count: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const agencies = useMemo(() => allAgencies || [], [allAgencies]);

  const loadData = async (ag: string) => {
    try {
      setLoading(true); setError(null);
      const [sRes, rRes] = await Promise.all([
        fetch(`/api/insights/summary?agency=${encodeURIComponent(ag)}`),
        fetch(`/api/insights/recipients?agency=${encodeURIComponent(ag)}&limit=10`),
      ]);
      if (!sRes.ok) throw new Error(`summary: ${sRes.status}`);
      if (!rRes.ok) throw new Error(`recipients: ${rRes.status}`);
      const sJson = await sRes.json();
      const rJson = await rRes.json();
      setSummary(sJson);
      setRecipients(rJson.recipients);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const onPickAgency = (ag: string) => { setAgency(ag); if (ag) loadData(ag); };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const ag = sp.get('agency');
      if (ag) { setAgency(ag); loadData(ag); }
    }
  }, []);

  return (
    <div style={{ padding: isMobile ? 12 : 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section style={{ background: 'linear-gradient(90deg,#07796b 0%,#0a9a89 100%)', color: '#fff', borderRadius: 12, padding: isMobile ? 16 : 22 }}>
        <div style={{ fontSize: isMobile ? 14 : 16, opacity: 0.9 }}>分断を越えるために</div>
        <h1 style={{ margin: '6px 0 10px 0', fontSize: isMobile ? 22 : 28 }}>データを日常に、だれもが一歩踏み出せるように。</h1>
        <p style={{ margin: 0, lineHeight: 1.7 }}>
          「だれが、いくら、どこから」—— 3つの問いからはじめましょう。
          むずかしい前提知識は不要です。手を動かしながら、あなたの関心に合わせて、すこしずつ見えてきます。
        </p>
      </section>

      <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>どこから（省庁を選択）</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            list="agency-list"
            placeholder="例: 総務省、文部科学省..."
            value={agency}
            onChange={(e) => setAgency(e.target.value)}
            onBlur={(e) => onPickAgency(e.target.value)}
            style={{ flex: '1 1 260px', minWidth: 220, border: '1px solid #ddd', borderRadius: 8, padding: '8px 10px' }}
          />
          <datalist id="agency-list">
            {agencies.map(a => <option key={a} value={a} />)}
          </datalist>
          <button onClick={() => onPickAgency(agency)} style={{ border: '1px solid #07796b', background: '#07796b', color: '#fff', padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}>見る</button>
          <button onClick={() => { setAgency(''); setSummary(null); setRecipients([]); }} style={{ border: '1px solid #ddd', background: '#f8fafc', padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}>クリア</button>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>ヒント: 入力欄をクリックすると候補が表示されます。</div>
      </section>

      {loading && <div style={{ padding: 8 }}>読み込み中...</div>}
      {error && <div style={{ color: 'crimson' }}>エラー: {error}</div>}

      {summary && (
        <section style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1.5fr', gap: 16 }}>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>いくら（この省庁の規模感）</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px', minWidth: 180, background: '#f8fafc', border: '1px solid #eef2f7', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>合計</div>
                <div style={{ fontWeight: 800, fontSize: isMobile ? 18 : 22 }}><Money amount={summary.total} /></div>
              </div>
              <div style={{ flex: '1 1 200px', minWidth: 180, background: '#f8fafc', border: '1px solid #eef2f7', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>プロジェクト数</div>
                <div style={{ fontWeight: 800, fontSize: isMobile ? 18 : 22 }}>{summary.projectCount.toLocaleString('ja-JP')}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
              <div style={{ flex: '1 1 200px', minWidth: 180, background: '#f8fafc', border: '1px solid #eef2f7', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>平均プロジェクト規模</div>
                <div style={{ fontWeight: 800 }}><Money amount={summary.total / Math.max(1, summary.projectCount)} /></div>
              </div>
              {summary.firstLevel.length > 0 && (
                <div style={{ flex: '1 1 200px', minWidth: 180, background: '#f8fafc', border: '1px solid #eef2f7', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>最大第一階層</div>
                  <div style={{ fontWeight: 800 }}>{summary.firstLevel[0].name}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}><Money amount={summary.firstLevel[0].value} />（{formatPercent(summary.firstLevel[0].value, summary.total)}）</div>
                </div>
              )}
              {summary.firstLevel.length > 0 && (
                <div style={{ flex: '1 1 200px', minWidth: 180, background: '#f8fafc', border: '1px solid #eef2f7', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>上位3の割合</div>
                  <div style={{ fontWeight: 800 }}>{formatPercent(summary.firstLevel.slice(0,3).reduce((s, c) => s + c.value, 0), summary.total)}</div>
                </div>
              )}
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>内訳（第一階層）</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
                {summary.firstLevel.map((c) => (
                  <div key={c.name} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 80px', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 12, color: '#334155' }}>{c.name}</div>
                    <div style={{ background: '#e2f6f2', height: 8, borderRadius: 999 }}>
                      <div style={{ width: `${Math.min(100, (c.value / Math.max(1, summary.total)) * 100)}%`, background: '#07796b', height: 8, borderRadius: 999 }} />
                    </div>
                    <div style={{ fontSize: 12, textAlign: 'right' }}><Money amount={c.value} />（{formatPercent(c.value, summary.total)}）</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>だれが（上位の受取先）</div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
              {recipients.map((r) => (
                <div key={`${r.recipient_name}::${r.corporate_number ?? ''}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center', border: '1px solid #eef2f7', borderRadius: 10, padding: '8px 10px', background: '#f8fafc' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{r.recipient_name || '不明'}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{r.corporate_number || '法人番号なし'}</div>
                    <div style={{ marginTop: 2, fontSize: 12, color: '#64748b' }}>関連プロジェクト: {r.projects_count}</div>
                  </div>
                  <div style={{ fontWeight: 800 }}><Money amount={r.total_amount} /></div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button onClick={() => agency && navigator.clipboard.writeText(`${location.origin}/insight?agency=${encodeURIComponent(agency)}`)} style={{ border: '1px solid #ddd', background: '#f8fafc', padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}>この見方を共有</button>
              <button onClick={() => agency && (location.href = `/subgraph?node=${encodeURIComponent(agency)}`)} style={{ border: '1px solid #07796b', background: '#07796b', color: '#fff', padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}>グラフで見る</button>
            </div>
          </div>
        </section>
      )}

      {!summary && (
        <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>まずは省庁を選んでみてください</div>
          <div style={{ color: '#64748b', fontSize: 13 }}>「どこから」を起点に、「いくら」「だれが」へスムーズにつながります。小さな一歩から始めましょう。</div>
        </section>
      )}
    </div>
  );
};

export default InsightPage;
