# ZAIMYAKU client

政府予算データを組織階層・事業・支出先から探索する Next.js アプリです。

## 開発

```bash
npm install
npm run dev
```

本番ビルドと型チェック:

```bash
npm run typecheck
npm run build
```

Supabase を利用する API の実行には `SUPABASE_URL` と `SUPABASE_ANON_KEY` が必要です。セマンティック事業検索には追加で `OPENAI_API_KEY` を設定します。

## グラフ描画

- `src/features/graph/buildGraph.ts`: 生データから階層グラフを構築し、接続を保ったまま表示ノード数を制限
- `src/components/graph/ForceGraph.tsx`: D3 force simulation、ズーム、ドラッグ、ハイライト
- `src/components/graph/LazyForceGraph.tsx`: 省庁別プレビューを表示直前まで遅延生成
- `src/features/graph/hooks/useGraphData.ts`: メイン／サブグラフ API とグラフ構築を接続

サブグラフの支出明細は初期ペイロードに含めず、事業ノードを選択した時だけ `/api/project_spending` から取得します。
