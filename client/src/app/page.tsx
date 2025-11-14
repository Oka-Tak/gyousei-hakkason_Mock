import Link from 'next/link';

import styles from './page.module.css';

const NAV_LINKS = [
  { href: '/graph', label: 'グラフビュー', description: 'ネットワークグラフで関係性を探索' },
  { href: '/landing', label: 'ダッシュボード', description: '支出状況の全体像と主要指標を概観' },
  { href: '/explore', label: '探索', description: 'テーマ別・条件別にデータを深掘り' },
  { href: '/compare', label: '比較', description: '省庁や事業を指標で比較・検証' },
  { href: '/recipients', label: '受取先', description: '補助金の受取先や企業を追跡' },
  { href: '/agencies', label: '省庁一覧', description: '各省庁の取り組み・支出を俯瞰' },
  { href: '/company', label: '企業検索', description: '企業名から調達・関係データを検索' },
  { href: '/policy', label: '政策・法令ナビ', description: '政策テーマと関連法令を横断的に整理' },
  { href: '/outcomes', label: '目標と実績', description: 'KPIと進捗状況をモニタリング' },
  { href: '/insight', label: 'インサイト', description: '注目トピックや深堀り分析を掲載' },
];

const Page = () => (
  <main className={styles.portal}>
    <section className={styles.hero}>
      <img src="favicon.ico" alt="ZAIMYAKU ロゴ" width="100" className={styles.logo} />
      <h1>ZAIMYAKU</h1>
      <p className={styles.heroText}>
        各機能へのショートカットから、ダッシュボード、探索、インサイトまで必要なページにすぐアクセスできます。
        分析テーマに合わせて好きなビューを選択してください。
      </p>
    </section>

    <section className={styles.grid} aria-label="ZAIMYAKU ナビゲーション">
      {NAV_LINKS.map((link) => (
        <Link key={link.href} href={link.href} className={styles.card}>
          <div>
            <p className={styles.cardTitle}>{link.label}</p>
            <p className={styles.cardDescription}>{link.description}</p>
          </div>
          <span className={styles.cardArrow} aria-hidden="true">
            →
          </span>
        </Link>
      ))}
    </section>
  </main>
);

export default Page;
