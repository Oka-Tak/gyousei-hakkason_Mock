# project_spending コンバーター仕様書

## 1. 概要

このドキュメントは、`project_spending` テーブルにデータを挿入するためのCSVファイルを生成するPythonスクリプト `convert_project_spending.py` の仕様を記述します。

## 2. 目的

`source_data/5-1_RS_2024_支出先_支出情報.csv` ファイルから関連データを抽出し、`project_spending` テーブルのスキーマに準拠した形式で `converted_data/converted_project_spending.csv` ファイルを生成します。このCSVファイルには、`project_spending_block` テーブルとの連携に必要な `project_id`, `budget_year`, `block_no` が含まれます。

## 3. 入力ファイル

-   **ファイルパス**: `source_data/5-1_RS_2024_支出先_支出情報.csv`
-   **エンコーディング**: UTF-8
-   **主要なカラム**:
    -   `事業年度`: `budget_year` に対応
    -   `予算事業ID`: `project_id` に対応
    -   `支出先ブロック番号`: `block_no` に対応
    -   `支出先名`: `recipient_name` に対応
    -   `法人番号`: `corporate_number` に対応
    -   `所在地`: `address` に対応
    -   `法人種別`: `corporation_type` に対応
    -   `その他支出先`: `is_other_recipient` に対応
    -   `金額`: `amount` に対応
    -   `契約方式等`: `contract_method` に対応
    -   `具体的な契約方式等`: `contract_method_detail` に対応
    -   `入札者数`: `bidders_count` に対応
    -   `落札率`: `successful_bid_rate` に対応
    -   `一者応札・一者応募又は競争性のない随意契約となった理由及び改善策（支出額10億円以上）`: `single_bid_reason` に対応
    -   `その他の契約`: `is_other_contract` に対応
    -   `契約概要`: `contract_summary` に対応

## 4. 出力ファイル

-   **ファイルパス**: `converted_data/converted_project_spending.csv`
-   **エンコーディング**: UTF-8
-   **カラム**:
    -   `project_id` (SMALLINT)
    -   `budget_year` (SMALLINT)
    -   `block_no` (VARCHAR(8))
    -   `recipient_name` (VARCHAR(255))
    -   `corporate_number` (CHAR(13))
    -   `address` (VARCHAR(1000))
    -   `corporation_type` (VARCHAR(64))
    -   `is_other_recipient` (BOOLEAN)
    -   `amount` (NUMERIC(14,2))
    -   `contract_method` (VARCHAR(255))
    -   `contract_method_detail` (VARCHAR(255))
    -   `bidders_count` (INTEGER)
    -   `successful_bid_rate` (NUMERIC(6,3))
    -   `single_bid_reason` (TEXT)
    -   `is_other_contract` (BOOLEAN)
    -   `contract_summary` (VARCHAR(2000))

## 5. 変換ロジック

1.  **入力ファイルの読み込み**: `source_data/5-1_RS_2024_支出先_支出情報.csv` をCSV辞書リーダーで読み込みます。
2.  **データ抽出と変換**:
    *   各行から必要なカラムの値を取得します。
    *   `project_id`, `budget_year`, `block_no` のいずれかが欠けている行はスキップします。
    *   `project_id` と `budget_year` は整数型に変換します。変換に失敗した場合は、その行をスキップします。
    *   `corporate_number` は文字列として取得し、13桁になるように左側を '0' で埋めます。13桁を超える場合は切り捨てます。
    *   `is_other_recipient` および `is_other_contract` は、文字列 'true' (大文字小文字を区別しない) の場合に `True`、それ以外の場合に `False` のブール値に変換します。
    *   `amount`, `bidders_count`, `successful_bid_rate` は数値型に変換します。カンマを除去し、`amount` と `successful_bid_rate` は浮動小数点数、`bidders_count` は整数に変換します。変換に失敗した場合は `None` とします。
3.  **出力ファイルの書き込み**: 変換されたデータを `converted_data/converted_project_spending.csv` に書き込みます。ヘッダー行も含まれます。

## 6. データベーススキーマとの関連

生成されるCSVファイルは、以下の `project_spending` テーブルのDDLに準拠しています。

```sql
CREATE TABLE IF NOT EXISTS project_spending (
  spending_id            BIGSERIAL PRIMARY KEY,
  block_id               BIGINT    NOT NULL,
  project_id             SMALLINT  NOT NULL,
  budget_year            SMALLINT  NOT NULL,

  recipient_name         VARCHAR(255),
  corporate_number       CHAR(13),                  -- 先頭0を保持
  address                VARCHAR(1000),
  corporation_type       VARCHAR(64),
  is_other_recipient     BOOLEAN,
  amount                 NUMERIC(14,2) CHECK (amount IS NULL OR amount >= 0),
  contract_method        VARCHAR(255),
  contract_method_detail VARCHAR(255),
  bidders_count          INTEGER CHECK (bidders_count IS NULL OR bidders_count >= 0),
  successful_bid_rate    NUMERIC(6,3) CHECK (successful_bid_rate IS NULL OR successful_bid_rate BETWEEN 0 AND 100),
  single_bid_reason      TEXT,
  is_other_contract      BOOLEAN,
  contract_summary       VARCHAR(2000),
  created_at             TIMESTAMP DEFAULT now(),

  CONSTRAINT fk_ps_block
    FOREIGN KEY (block_id) REFERENCES project_spending_block(block_id)
      ON UPDATE CASCADE ON DELETE CASCADE,

  -- 冗長だが検索しやすいように project も直接参照
  CONSTRAINT fk_ps_project
    FOREIGN KEY (project_id, budget_year)
    REFERENCES project(project_id, budget_year)
      ON UPDATE RESTRICT ON DELETE RESTRICT
);
```

**`spending_id` および `block_id` について**:
- `spending_id` は `BIGSERIAL PRIMARY KEY` として定義されており、データベースが自動的に値を生成するため、CSVファイルには含めません。
- `block_id` は `project_spending_block` テーブルの主キーであり、データベースによって自動的に生成されます。`converted_data/converted_project_spending.csv` には `block_id` は含めず、代わりに `project_id`, `budget_year`, `block_no` の組み合わせを含めます。データベースへのインポート時に、これらの情報を使用して `project_spending_block` テーブルから対応する `block_id` を取得し、`project_spending` テーブルに挿入する必要があります。
