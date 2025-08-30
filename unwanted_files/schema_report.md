# CSVファイル解析とDBスキーマ設計報告書

## 1. はじめに

提供されたCSVファイル `2-1_RS_2024_予算・執行_サマリ _2 (version 1).csv` は、そのままではデータベースにインポートするのが難しい形式でした。そのため、Pythonスクリプト `gyosei/2-1_translate.py` を使用してデータを整形し、`converted_budget_summary_revised.csv` を生成しました。本報告書では、整形後のCSVファイルの構造を分析し、適切なデータベーススキーマを提案します。

## 2. データソースの概要

元のCSVファイルは、予算と執行に関するサマリーデータを含んでいますが、ヘッダー行が不完全で、データ行にも空のセルや特殊なフォーマットの数値が含まれていました。Pythonスクリプトによる整形後、データはより構造化されましたが、依然として一部の列名が不明瞭です。

### 整形後のCSVファイルの先頭行 (head converted_budget_summary_revised.csv)

```
ID,,,,ID,,,,,,,,,
1.0,2024,2024.0,内閣人事局経費,,,,33498000,0,0,0,0,0,34482000
1.0,2023,2024.0,内閣人事局経費,,,,33328000,0,0,0,11200834,0,33498000
1.0,2022,2024.0,内閣人事局経費,,,,36142000,0,0,0,26711000,0,33328000
1.0,2021,2024.0,内閣人事局経費,,新たな成長推進枠：17管理職のマネジメント能力向上に向けた取組として、マネジメント研修の充実を図るための環境整備に係る請負に関する経費を計上したため。,,29457000,0,0,0,23771000,0,45013000
4.0,2024,2024.0,情報システムの整備（情報通信技術調達等適正・効率化推進費）,,"重要政策推進枠：128,761,683",,480000000000,205000000000,93383296000,0,0,0,579012000000
```

## 3. スキーマ設計

整形後のCSVファイルの内容に基づき、以下のデータベーススキーマを提案します。テーブル名は `budget_summary` とし、各列のデータ型と簡単な説明を記載します。

### テーブル: `budget_summary`

| 列名               | データ型 | 説明                                                              |
| :----------------- | :------- | :---------------------------------------------------------------- |
| `id`               | `INTEGER`  | カテゴリID (例: 1, 4, 7)                                          |
| `fiscal_year`      | `INTEGER`  | 会計年度 (例: 2024, 2023)                                         |
| `report_year`      | `INTEGER`  | レポートが作成された年 (例: 2024)                                 |
| `category_name`    | `TEXT`     | カテゴリ名 (例: 内閣人事局経費)                                   |
| `text_col_1`       | `TEXT`     | 可変テキストフィールド1 (空欄、または説明/補足情報)               |
| `text_col_2`       | `TEXT`     | 可変テキストフィールド2 (空欄、または説明/補足情報)               |
| `text_col_3`       | `TEXT`     | 可変テキストフィールド3 (空欄、または説明/補足情報)               |
| `budget_amount`    | `BIGINT`   | 予算額                                                            |
| `execution_amount_1` | `BIGINT`   | 執行額1                                                           |
| `execution_amount_2` | `BIGINT`   | 執行額2                                                           |
| `execution_amount_3` | `BIGINT`   | 執行額3                                                           |
| `execution_amount_4` | `BIGINT`   | 執行額4                                                           |
| `execution_amount_5` | `BIGINT`   | 執行額5                                                           |
| `total_amount`     | `BIGINT`   | 合計額                                                            |

### SQL DDL (Data Definition Language)

```sql
CREATE TABLE budget_summary (
    id INTEGER,
    fiscal_year INTEGER,
    report_year INTEGER,
    category_name TEXT,
    text_col_1 TEXT,
    text_col_2 TEXT,
    text_col_3 TEXT,
    budget_amount BIGINT,
    execution_amount_1 BIGINT,
    execution_amount_2 BIGINT,
    execution_amount_3 BIGINT,
    execution_amount_4 BIGINT,
    execution_amount_5 BIGINT,
    total_amount BIGINT
);
```

## 4. 考察と今後のステップ

*   **データインポートの実施**:
    *   Pythonスクリプト `import_data.py` を作成し、`converted_budget_summary_revised.csv` からSQLiteデータベース `budget_data.db` へデータをインポートしました。
    *   `import_data.py` は、`venv/bin/python import_data.py` コマンドで実行できます。
*   **ヘッダーの調整**: 整形後のCSVの最初の行は依然として不完全なヘッダー情報を含んでいましたが、`pandas.read_csv` の `header=0` と `names` パラメータを組み合わせることで、この行を適切に処理し、データ行から読み込みを開始しました。
*   **データ型の確認**: `BIGINT` は大きな数値を格納するために選択しましたが、実際のデータの最大値によっては `NUMERIC` や `DECIMAL` の方が適切かもしれません。ただし、現在のデータを見る限り、整数値で十分と判断しました。
*   **NULL値の扱い**: 空のセルは `NULL` として扱われることを想定しており、Pythonスクリプトで数値型に変換する際に `fillna(0)` を適用しています。
*   **可変テキストフィールド**: `text_col_1`, `text_col_2`, `text_col_3` は、CSVファイル内で位置が固定されていない、または空欄が多いテキスト情報（詳細説明や補足情報）を格納するために設けました。これらのフィールドの具体的な内容は、データの行によって異なります。
*   **一意性の制約**: 現在のデータからは、どの列が主キーになり得るか明確ではありません。`id` と `fiscal_year` の組み合わせが一意である可能性もありますが、データの全体像を確認する必要があります。必要に応じて、複合主キーやサロゲートキーの導入を検討します。

このスキーマ設計は、提供されたCSVデータに基づいており、データベースへの効率的なインポートと基本的なクエリを可能にすることを目的としています。
</content>
