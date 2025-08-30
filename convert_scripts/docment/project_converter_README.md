# 事業データ変換プログラム仕様書

## 1. 概要
このドキュメントは、CSVファイルから生事業データをデータベースの`project`テーブルに挿入するのに適した形式に変換する`convert_project.py`スクリプトについて説明します。このスクリプトは、事前に変換された組織データを活用して、`organization_id`を正しくマッピングします。

## 2. 目的
このスクリプトの主な目的は以下の通りです。
- ソースCSVファイル（`2-1_mockdata.csv`）から生事業データを読み込む。
- `agency.csv`を使用して府省庁名を`agency_id`にマッピングする。
- `converted_organization.csv`を使用して組織階層を`organization_id`にマッピングする。
- `project`テーブルのDDLに従って、関連する事業関連フィールドを抽出し、変換する。
- 処理された事業データを含むクリーンなCSVファイル（`converted_project.csv`）を生成する。

## 3. 入力ファイル
スクリプトは以下の入力ファイルを必要とします。

### 3.1. `agency.csv`
- **パス:** `./source_data/source_test_data/agency.csv`
- **説明:** `agency_name`から`agency_id`および`agency_order`へのマッピングが含まれています。組織ルックアップのために`agency_id`を解決するために使用されます。
- **主要列:**
    - `agency_id`: 各府省庁の一意の識別子。
    - `agency_name`: 府省庁名（例：「内閣官房」、「デジタル庁」）。

### 3.2. `converted_organization.csv`
- **パス:** `./converted_data/converted_organization.csv`
- **説明:** このファイルは`convert_organization.py`によって生成され、`organization_id`とその階層パス（府省庁、局・庁、部、課など）が含まれています。モックデータからの組織パスを正しい`organization_id`にマッピングするために不可欠です。
- **主要列:**
    - `organization_id`: 各組織の一意の識別子。
    - `supervising_agency_id`: 所管府省庁のID。
    - `agency_id`: 主な府省庁のID。
    - `bureau_office`、`division`、`department`、`section`、`team`、`unit`: 組織の階層コンポーネント。

### 3.3. `2-1_mockdata.csv`
- **パス:** `./source_data/source_test_data/2-1_mockdata.csv`
- **説明:** 生事業データの主要なソース。このファイルには、さまざまな年度および組織単位にわたるさまざまな事業の詳細な予算および執行情報が含まれています。
- **主要列（事業データ抽出に使用）:**
    - `予算事業ID`: `project_id`にマッピングされます。
    - `事業年度`: `budget_year`にマッピングされます。
    - `予算年度`: `project_year`にマッピングされます。
    - `事業名`: `project_name`にマッピングされます。
    - `府省庁`: 組織ルックアップのために`agency_id`を決定するために使用されます。
    - `政策所管府省庁`: 組織ルックアップのために`supervising_agency_id`を決定するために使用されます。
    - `局・庁`、`部`、`課`、`室`、`班`、`係`: `organization_id`を見つけるために使用される階層コンポーネント。
    - `主な増減理由`: `main_change_reason`にマッピングされます。
    - `その他特記事項`: `notes`にマッピングされます。
    - `当初予算（合計）`: `initial_budget_total`にマッピングされます。
    - `補正予算（合計）`: `adjustment_total`にマッピングされます。
    - `前年度からの繰越し（合計）`: `carryover_from_previous_total`にマッピングされます。
    - `予備費等（合計）`: `contingency_total`にマッピングされます。
    - `執行額（合計）`: `execution_total`にマッピングされます。
    - `翌年度への繰越し(合計）`: `carryover_to_next_total`にマッピングされます。
    - `翌年度要求額（合計）`: `next_year_request_total`にマッピングされます。
    - `会計区分`: 集計行をフィルタリングするために使用されます（この列がnullまたは空の場合）。

## 4. 出力ファイル

### 4.1. `converted_project.csv`
- **パス:** `./converted_data/converted_project.csv`
- **説明:** 変換された事業データが含まれており、各行は`project`テーブルに直接挿入できる一意の事業エントリを表します。
- **列:**
    - `project_id` (SMALLINT)
    - `budget_year` (SMALLINT)
    - `project_year` (SMALLINT)
    - `project_name` (VARCHAR(255))
    - `organization_id` (SMALLINT)
    - `main_change_reason` (VARCHAR(2000))
    - `notes` (VARCHAR(4000))
    - `initial_budget_total` (NUMERIC(14,2))
    - `adjustment_total` (NUMERIC(14,2))
    - `carryover_from_previous_total` (NUMERIC(14,2))
    - `contingency_total` (NUMERIC(14,2))
    - `execution_total` (NUMERIC(14,2))
    - `carryover_to_next_total` (NUMERIC(14,2))
    - `next_year_request_total` (NUMERIC(14,2))

## 5. 変換ロジック

### 5.1. データ読み込みと前処理
1. `agency.csv`が読み込まれ、`agency_name`から`agency_id`への辞書が作成されます。
2. `converted_organization.csv`が読み込まれます。完全な組織パス（`agency_id`、`supervising_agency_id`、およびすべての階層コンポーネントを含む）を表すタプルから`organization_id`へのマッピングが作成されます。階層コンポーネントのnull値は、一貫したキー生成のために空文字列として扱われます。
3. `2-1_mockdata.csv`が読み込まれます。
4. モックデータは、集計された事業行のみを含むようにフィルタリングされます。これは、`会計区分`列がnullまたは空文字列である行を選択することによって行われます。これにより、詳細な内訳行の処理が回避されます。

### 5.2. 事業データ抽出と変換
1. スクリプトは、フィルタリングされた事業データ行を反復処理します。
2. 各行について、`project_id`（`予算事業ID`）と`budget_year`（`事業年度`）を抽出します。
3. 複合主キー（`project_id`、`budget_year`）の重複エントリを防ぐために、`processed_projects`セットを使用して既に処理されたペアを追跡します。ペアが再度検出された場合、それはスキップされます。
4. `agency_id`と`supervising_agency_id`は、`府省庁`と`政策所管府省庁`列および`agency_name_to_id`マッピングを使用して解決されます。府省庁名が見つからない場合は警告が出力されます。
5. 現在のモックデータ行からの組織パスは、`organization_path_to_id`マッピングが作成された方法と同様に、タプルに再構築されます。これには、`agency_id`、`supervising_agency_id`、およびすべての階層コンポーネント（`局・庁`、`部`、`課`、`室`、`班`、`係`）が含まれ、nullは空文字列に変換され、空白が削除されます。
6. `organization_id`は、この再構築されたパスを使用してルックアップされます。組織パスが見つからない場合は警告が出力されます。
7. 数値の予算関連列（`当初予算（合計）`、`補正予算（合計）`など）は数値型に変換されます。非数値は`NaN`に強制され、DDLのデフォルト値と`CHECK`制約に一致するように`0`で埋められます。
8. その他の文字列フィールド（`事業名`、`主な増減理由`、`その他特記事項`）は抽出され、null値は`None`にマッピングされます。
9. 事業レコードを表す辞書が作成され、リストに追加されます。

### 5.3. 出力生成
1. 事業レコードのリストはPandas DataFrameに変換されます。
2. DataFrameは、DataFrameインデックスなしで`converted_project.csv`に保存されます。

## 6. 実行
スクリプトは直接実行できます。
```bash
python3 convert_scripts/convert_project.py
```
スクリプトの`if __name__ == "__main__":`ブロックは、`convert_project.py`が変換を進める前に`convert_organization.py`が最初に実行され（まだ最新でない場合）、`converted_organization.csv`が生成されることを保証します。これにより、必要なすべての前提データが利用可能になります。
