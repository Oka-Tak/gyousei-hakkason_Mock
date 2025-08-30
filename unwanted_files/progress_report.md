# 進捗報告書

## 1. 概要

本報告書は、行政事業レビュー見える化サイトの要件定義書に基づき、データベースとWebアプリケーションを製作するタスクの現在の進捗状況をまとめたものです。

## 2. 達成済み項目

- **要件定義書の分析**: `requirements_definition.md` を読み込み、プロジェクトの目標、技術スタック、および主要機能を理解しました。
- **データベーススキーマの再設計**: 新しいER図に基づき、`projects`, `organizations`, `organization_names` の3つのテーブルを設計しました。
- **PostgreSQLアダプターのインストール**: PythonからPostgreSQLに接続するための `psycopg2-binary` パッケージを仮想環境にインストールしました。
- **PostgreSQLサーバーのインストールと起動**: ローカル環境にPostgreSQLサーバーと関連ツールをインストールし、サービスを起動しました。
- **PostgreSQLユーザーのセットアップ**: デフォルトの `postgres` ユーザーのパスワードを設定しました。
- **Python仮想環境の作成と設定**: 必要なPythonパッケージをインストールするための仮想環境を作成し、アクティベートしました。
- **CSV変換スクリプト (`gyosei/2-1_translate.py`) の修正と再生成**:
    - `converted_budget_summary_revised.csv` を生成する際に、`organization_name.csv` を参照して `組織ID` を生成するように修正しました。
    - `組織ID` が見つからない場合は `None` を割り当て、CSV出力時に `nan` ではなく空文字列になるように処理しました。
    - 修正されたスクリプトを実行し、`converted_budget_summary_revised.csv` を再生成しました。
- **データインポートスクリプト (`import_data.py`) の修正と実行**:
    - 新しいER図に基づき、`projects`, `organizations`, `organization_names` テーブルのDDLを英語の列名で定義しました。
    - `organization_name.csv` から `organization_names` テーブルへのデータインポートロジックを実装しました。
    - `organization_names` テーブルのデータを利用して `organizations` テーブルのダミーデータを生成し、インポートするロジックを実装しました。
    - `converted_budget_summary_revised.csv` から `projects` テーブルへのデータインポートロジックを修正し、`組織ID` が `NULL` または `"nan"` のレコードは挿入しないようにしました。
    - `import_data.py` を実行し、すべてのテーブルへのデータインポートと変換を成功させました。
- **Next.jsプロジェクトのセットアップ**: Next.jsプロジェクト `client` を作成し、必要な依存関係 (`pg`, `d3`, `@types/pg`, `@types/d3`) をインストールしました。
- **Next.js APIエンドポイントの修正**: `client/app/api/data/route.ts` を修正し、新しい英語のテーブル名と列名を使用してデータベースからデータを取得するSQLクエリを実装しました。
- **Next.jsフロントエンドの修正**: `client/app/page.tsx` を修正し、新しいAPIエンドポイントから取得したデータ構造に合わせて、ノードとリンクの生成ロジックを更新しました。ノードを楕円とテキストのグループで描画し、事業名を常時表示するようにしました。SVGのサイズとD3.jsのフォース設定も調整しました。

## 3. 現在の課題

- **Next.js APIエンドポイントのエラー**: `client/app/api/data/route.ts` でSQLクエリ内のテーブル名と列名を英語に修正しましたが、まだ「relation "projects" does not exist」というエラーが発生しています。これは、データベースのテーブル名がPostgreSQLのデフォルトの小文字ルールに従って作成されているにもかかわらず、クエリで大文字のテーブル名を参照しているためと考えられます。

## 4. 今後のステップ

1.  **Next.js APIエンドポイントの修正**:
    - `client/app/api/data/route.ts` のSQLクエリ内のテーブル名と列名を、PostgreSQLのデフォルトの小文字ルールに合わせてすべて小文字で記述するように修正します。
2.  **Next.js開発サーバーの再起動**: 変更を反映させるために、開発サーバーを停止し、再起動します。
3.  **Webアプリケーションのブラウザでの確認**: ユーザーに再度ブラウザで `http://localhost:3002` (または利用可能なポート) にアクセスしてもらい、以下の点を確認します。
    - エッジが表示されるか？
    - ノード同士の関連が可視化されるか？
    - 全画面表示とノードの見切れは改善されたか？
    - クリック時の関連ノード/エッジのハイライトは動作するか？
    - ノードの表示形式（大き目の楕円の中に事業名）は適切か？
4.  **最終報告書の作成**: 全てのタスクが完了した後、最終的な報告書を作成します。

---
**現在のタスク進捗チェックリスト:**
- [x] Analyze requirements_definition.md
- [x] Design/Verify database schema
- [x] Implement database creation and data import
    - [x] Install PostgreSQL adapter
    - [x] Modify import script for PostgreSQL
    - [x] Configure database connection
    - [x] Install PostgreSQL server
    - [x] Start PostgreSQL service
    - [x] Set up PostgreSQL user/database
    - [x] Create Python virtual environment
    - [x] Activate virtual environment
    - [x] Install psycopg2-binary and pandas in venv
    - [x] Debug data import issue (extra data after last expected column)
        - [x] Examine gyosei/2-1_translate.py
        - [x] Modify translation script for robust CSV output
        - [x] Regenerate converted_budget_summary_revised.csv (Not needed with execute_values)
        - [x] Add debug output to import_data.py
    - [x] Run data import
        - [x] Implement staging table creation
        - [x] Modify import to staging table
        - [x] Implement data transformation from staging to final table
        - [x] Fix integer conversion error (e.g., "1.0" to 1)
        - [x] Execute data import and transformation
- [x] Develop the web application
    - [x] Set up Next.js project
    - [x] Install pg package in Next.js project
    - [x] Implement API endpoint to fetch data
    - [x] Install @types/pg
    - [x] Install D3.js
    - [x] Install @types/d3
    - [x] Implement force-directed graph visualization
    - [x] Add interactive features (hover, click, focus, drag)
    - [x] Implement node limit and dynamic loading
    - [x] Start Next.js development server
    - [x] Install browser dependencies
    - [x] Rebuild puppeteer
    - [x] Configure Next.js for no-sandbox (Puppeteer)
    - [x] Stop Next.js development server
    - [x] Remove --no-sandbox from package.json
    - [x] Restart Next.js development server
    - [ ] Verify web application in browser
- [x] Re-evaluate database schema based on new ERD
- [x] Modify CSV translation script to generate organization data
- [x] Regenerate converted_budget_summary_revised.csv
- [x] Update data import script for new tables
- [x] Fix ON CONFLICT error in organization staging import
- [x] Fix foreign key constraint violation (組織ID=0 not in organization)
- [x] Fix "nan" error in project import
- [x] Update Next.js API endpoint for new data structure
- [ ] Update Next.js frontend for new data structure and visualization
- [x] Re-run data import to apply new schema
