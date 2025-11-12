# agent.md

## システム概要
- プロジェクト名: **ZAIMYAKU**（政府予算の可視化支援ツール）
- 実装: `client/` 配下の Next.js（App Router）アプリケーション
- 主用途: 政府事業データをネットワークグラフや省庁別ビューで探索し、受取先や KPI を横断的に把握する
- 対象ソース: Supabase 上の公開データベースと、`client/data/` に配置された CSV カタログ

## 技術スタックと依存関係
- **Next.js** + **React**（App Router、`use client` を多用）
- **TypeScript**
- **D3.js**（`src/components/graph/ForceGraph.tsx`）
- **Fuse.js**（曖昧検索・ノードサーチ）
- **Supabase JS SDK**（`src/server/supabaseClient.ts`）
- ユーティリティ: `@/utils/format`（金額・割合フォーマット）ほか

## データソース
-### Supabase
- 使用テーブル: `project`, `organization`, `agency`, `project_spending_block`, `project_spending`
- 参考テーブル: `embedding_model`, `agency_semantic_embedding`, `project_semantic_embedding`（現状のアプリでは未使用だが将来の検索拡張候補）
- コネクション: `SUPABASE_URL`, `SUPABASE_ANON_KEY` を環境変数で設定（`src/server/supabaseClient.ts`）
- キャッシュ: メモリキャッシュ + TTL（例: `MAIN_DATA_TTL_MS`, `SUBGRAPH_TTL_MS`, `RECIPIENT_TTL_MS`, `COMPANY_TTL_MS`）
- 行型管理: サービス層ごとに `type ProjectRow` / `OrganizationRow` などを定義しており、列追加時は忘れずに更新する。
- スキーマ注意点:
  - `project` は `PRIMARY KEY (project_id, budget_year)` の複合キー。クエリ時は `budget_year` を必ず条件に含め、Supabase の `.eq('budget_year', …)` を忘れない。
  - `project_spending_block` / `project_spending` も `budget_year` を保持しており、将来的に年次比較を行う際はこの列でフィルタする。
  - 金額系カラムは `numeric` 型なので `Number()` キャストで扱う（小数が必要な箇所では `parseFloat` 等を利用）。
  - `organization.supervising_agency_id` など追加列があるため、追加利用時はサービス層の型と集計ロジックを更新する。
- 主な取得ロジック:
  - `fetchMainData`（`src/server/dataService.ts`）: 2024年度事業の階層情報と金額を集計
  - `fetchSubgraph`（`src/server/subgraphService.ts`）: 指定ノード以下の組織・プロジェクト・支出を絞り込み
  - `fetchTopRecipientsByAgency` / `fetchCompanyOverview`（`src/server/insightService.ts`）: 受取先ランキングと法人概要
  - `fetchSpendingByProject`（`src/server/spendingService.ts`）: プロジェクト単位の支出明細

### ローカル CSV カタログ
- 保存場所: `client/data/`
- ローダー: `src/server/dataCatalog.ts`
- パーサー: `src/server/csv.ts` の `readText` / `csvToObjects` で BOM 除去・引用符付き CSV を処理し、結果はモジュールスコープの `cache` にキャッシュされる
- 対象ファイル:
  - 事業概要 (`1-2_RS_2024_基本情報_事業概要等.csv`)
  - 政策・法令 (`1-3_RS_2024_基本情報_政策・施策、法令等.csv`)
  - 補助率 (`1-4_RS_2024_基本情報_補助率等.csv`)
  - 関連事業 (`1-5_RS_2024_基本情報_関連事業.csv`)
  - KPI 系列 (`3-1_RS_2024_効果発現経路_目標・実績.csv`, `3-2_RS_2024_効果発現経路_目標のつながり.csv`)
- 単位の正規化: `src/server/unit.ts`（金額・割合・件数系を円換算／%換算に揃える）

### セマンティック検索
- API: `/api/search/project`（OpenAI Embeddings でクエリをベクトル化し、Supabase RPC `match_project_semantic` で類似プロジェクトを返す）
- サービス: `src/server/semanticSearch.ts`
- 環境変数: `OPENAI_API_KEY`（必須）、`OPENAI_EMBEDDING_MODEL`、`SUPABASE_PROJECT_MATCH_RPC`、`PROJECT_MATCH_THRESHOLD`（任意）

## クライアントロジック
- `useMainGraphData` / `useSubgraphData`（`src/features/graph/hooks/useGraphData.ts`）: `/api/data` と `/api/subgraph` を呼び出し、階層ノード + リンク + カラーマップを生成
- `ForceGraph`（`src/components/graph/ForceGraph.tsx`）: D3 の force シミュレーション、ズーム、ドラッグ、ハイライトを担当
- `Controls`, `NodeDetails`, `LoadingOverlay`, `Money` など共通 UI コンポーネントで検索・詳細表示・フォーマットを再利用

## 主なページ（App Router）
- `/`（`src/app/page.tsx`）: 全体ネットワーク + スポットライト検索
- `/subgraph`（`src/app/subgraph/page.tsx`）: 任意ノード起点のサブグラフ + 支出詳細パネル
- `/explore`（`src/app/explore/page.tsx`）: 深さ・予算フィルタとノード間パス探索
- `/agencies`（`src/app/agencies/page.tsx`）: 省庁ごとのミニグラフと統計タイル
- `/insight`（`src/app/insight/page.tsx`）: 「どこから・いくら・だれが」の横断分析
- `/compare`（`src/app/compare/page.tsx`）: 府省庁・プロジェクトの比較（セマンティック検索経由でプロジェクト候補を取得、総額・内訳・受取先を並列表示）
- `/recipients`（`src/app/recipients/page.tsx`）: 省庁別受取先ランキング
- `/company`（`src/app/company/page.tsx`）: 法人番号／名称から受取先概要を検索
- `/project/[id]`（`src/app/project/[id]/page.tsx`）: 事業概要・政策連携・補助率・関連事業・KPI
- `/policy`（`src/app/policy/page.tsx`）: 政策／法令キーワード検索
- `/outcomes`（`src/app/outcomes/page.tsx`）: KPI 指標ギャラリー
- `/landing`（`src/app/landing/page.tsx`）: プロダクト紹介用ランディング

## API レイヤー（`src/app/api/`）
- `/api/data` → `fetchMainData`
- `/api/subgraph` → `fetchSubgraph`
- `/api/insights/summary` → 省庁別サマリ
- `/api/insights/recipients` → 受取先上位 N
- `/api/insights/company` → 法人概要（cn / name 検索）
- `/api/project/[id]` → CSV カタログから事業詳細と KPI
- `/api/project_spending` → プロジェクト支出明細
- `/api/policies` → 政策・法令検索
- `/api/outcomes` → KPI リスト（単位正規化）

## 型とユーティリティ
- 型定義: `src/types/index.ts`（`RawProjectData`, `GraphNode`, `GraphLink`, `SpendingItem` など）
- バリデーション: `src/types/schemas.ts`（Zod スキーマ; `.passthrough()` で柔軟に許容）
- 型ガード: `src/types/guards.ts`（`isRawProjectData` で API 取得後の配列を検証）
- グラフ型: `src/features/graph/types.ts`（`GraphNodeDatum`, `GraphLinkDatum` など D3 連携用）
- 金額・割合フォーマット: `src/utils/format.ts`
- グラフ用定数: `src/features/graph/constants.ts`（ノードサイズなど）

## コーディング規約（TypeScript / React）
- **TypeScript**
  - `tsconfig.json` は `strict: true`。`any` は避け、必要なら `unknown` + 型ガードで絞り込む。
  - ドメイン型は `src/types/index.ts`、バリデーションは `src/types/schemas.ts` に集約し、API 追加時は両方を更新する。
  - パス解決は `@/` エイリアスを使用し、相対パスのネストを避ける。
  - 列挙値や定数は `as const` を付与し、`NODE_SIZE_BY_GROUP` のように型推論を固定する。
  - `satisfies` や `ReturnType` を活用し、Zod スキーマや API 戻り値から型を自動導出して重複定義を避ける。
  - Supabase クエリの戻り値はサービス層ごとに `type ProjectRow` などを宣言しており、列追加時は該当ファイルを更新する。`Database` 型を CLI で生成した場合は `src/types/` に配置し `.from()` の戻り値に適用する。
  - Main データフローに関わる型はユニオン型／判別可能共用体で状態を表現し、フロント側の `loading`・`error` ハンドリングを明示する。
- **React / Next.js**
  - 関数コンポーネントを標準とし、ステートフル処理は `useState` / `useMemo` / `useEffect` を組み合わせて記述する。
  - クライアント側でのみ必要なファイルにだけ `"use client"` を付与し、サーバーコンポーネントとの境界を意識する。
  - カスタムフックは `src/features/**/hooks/` に配置し、命名は `useXxx` に揃える。
  - スタイルは CSS Modules またはインラインスタイルを選択し、共有トークンは `globals.css` や共通コンポーネント側に寄せる。
- **Next.js（App Router 拡張）**
  - ページ／レイアウトはサーバーコンポーネントをデフォルトとし、クライアント要素が必要な箇所に限定した境界を設ける。
  - `loading.tsx`・`error.tsx`・`not-found.tsx` を各セグメントに用意し、サスペンスとエラーハンドリングを UI レベルで統一する。
  - `generateMetadata` / `generateStaticParams` はデータ取得ロジックと同じソースから値を導出し、ダブルフェッチを防ぐ。
  - キャッシュ方針は `fetch` オプションや Route Handler の `revalidateTag` を活用して明示的に管理する（無指定での ISR/SSG は避ける）。
- **API / サーバーコード**
  - Supabase へのアクセスは `src/server/**` に集約し、クライアントコンポーネントから直接呼び出さない。
  - API ルートは `NextResponse.json` を返却する。エラー時はログを出しつつ `status` を付与する。
  - キャッシュや TTL を導入する際は環境変数名をドキュメント化し、`process.env` アクセスにはフォールバックを用意する。
  - クエリ／パスパラメータは `zod` で検証し、バリデーションエラー時は 400 を返す（`src/app/api/**/route.ts`）。
- **Supabase**
  - `src/server/supabaseClient.ts` で初期化したクライアントを再利用し、Server Component / Route Handler からのみ利用する（クライアント側での直接利用は禁止）。
  - SELECT では必要な列だけを `select('col1,col2')` で取得し、JOIN が必要な場合はビューや RPC を検討する。
  - `const { data, error } = await supabase...` パターンで常に `error` をチェックし、API レイヤーでステータスコードと一緒に返却する。
  - サービスロールキーはローカル専用に留め、RLS を有効にした公開テーブルには匿名キー + ポリシーでアクセスする。
- **データ可視化（D3）**
  - DOM 直接操作は D3 管理下に限定し、副作用は `useEffect` でラップする。クリーンアップも忘れずに実装する。
  - ノード/リンク型を `GraphNodeDatum` / `GraphLinkDatum` に統一し、Force レイアウト用 state との型不整合を防ぐ。
- **ユーティリティ / 共通処理**
  - 金額・割合フォーマットは `@/utils/format` を利用し、重複ロジックを避ける。
  - 日付・数値などの共通関数を追加する場合は `src/utils/` に置き、単体テスト相当のサンプルコードをコメントで残す。

## エージェント運用指針
1. **データ構造の整合性を維持する:** `RawProjectData` にフィールドを追加する際は型・ガード・Zod スキーマを必ず更新する。
2. **Supabase クエリの負荷を意識する:** 新しい集計 API を作る場合は TTL キャッシュを導入し、必要であれば `MAIN_DATA_LIMIT` 等で件数制限する。
3. **CSV カタログ連携を整理する:** 新規 CSV を読むときは `dataCatalog.ts` にローダーを追加し、必要に応じて `unit.ts` で単位変換を定義する。
4. **グラフ UI の共通化を壊さない:** `ForceGraph` の props（サイズ、ハイライト、ズーム）を理解した上で、ページ側で追加機能を実装する。
5. **API 追加時は JSON レスポンスを徹底する:** App Router のルートハンドラは Node.js Runtime で動作するため、Supabase/CSV ヘルパーを経由して JSON を返却する。

## 開発・検証フロー
- ローカル起動: `cd client && npm install && npm run dev`
- 環境変数: `.env.local` に Supabase 接続情報を設定（本番キーを含めない）
- 手動確認: 各ページは API 呼び出し結果を即時描画するため、ブラウザまたは `curl` で API の戻り値を確認
- データ量調整: 開発時は `MAIN_DATA_LIMIT` を下げてレンダリング負荷を抑える

## 変更時のチェックリスト
- [ ] Supabase スキーマ／抽出条件変更後も主要ページ（`/`, `/subgraph`, `/insight` など）が正しく描画される
- [ ] `RawProjectData` と対応する型・スキーマを更新済み
- [ ] キャッシュ TTL（環境変数）が要件に合っている
- [ ] 新規ページや API の UI 導線（ナビゲーション等）を確認済み

補足: Web アプリの挙動は `client/` 配下のコードと Supabase/CSV データパイプラインで完結する。`scripts/` や `convert_scripts/` などの補助ディレクトリは本件の開発対象外として扱ってよい。
