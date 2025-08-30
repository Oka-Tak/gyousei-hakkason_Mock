# 組織データ変換スクリプト

このスクリプト（`convert_organization.py`）は、CSVファイルからの生の組織データを、`DB_data/DDL.sql`で定義されているデータベースの`organization`テーブルに挿入するのに適した構造化された形式に変換するために設計されています。

## 目的

このスクリプトの主な目的は以下の通りです。
1. `agency.csv`から省庁情報を読み込みます。
2. `2-1_mockdata.csv`からモックの組織階層データを読み込みます。
3. 一意の組織パスを抽出し、それらを`organization_id`にマッピングします。
4. `organization_id`、`supervising_agency_id`、`agency_id`、および様々な階層レベル（局・庁、部、課、室、班、係）を含む構造化された組織データを含む`converted_organization.csv`ファイルを生成します。

## データベーススキーマ参照

`organization`テーブルのスキーマは以下の通りです。

```sql
CREATE TABLE IF NOT EXISTS organization (
  organization_id       SMALLINT PRIMARY KEY,
  supervising_agency_id SMALLINT NOT NULL,
  agency_id             SMALLINT NOT NULL,
  bureau_office         VARCHAR(255),
  division              VARCHAR(255),
  department            VARCHAR(255),
  section               VARCHAR(255),
  team                  VARCHAR(255),
  unit                  VARCHAR(255),

  CONSTRAINT fk_org_supervising_agency
    FOREIGN KEY (supervising_agency_id) REFERENCES agency(agency_id)
      ON UPDATE RESTRICT ON DELETE RESTRICT,

  CONSTRAINT fk_org_agency
    FOREIGN KEY (agency_id) REFERENCES agency(agency_id)
      ON UPDATE RESTRICT ON DELETE RESTRICT
);
```

## 入力ファイル

このスクリプトには以下の入力ファイルが必要です。

- `source_data/source_test_data/agency.csv`: `agency_id`と`agency_name`のマッピングが含まれています。
- `source_data/source_test_data/2-1_mockdata.csv`: `府省庁`、`政策所管府省庁`、`局・庁`、`部`、`課`、`室`、`班`、`係`などの生の組織階層データが含まれています。

## 出力ファイル

- `converted_organization.csv`: 変換された組織データを含む生成されたCSVファイルで、`organization`テーブルへのインポート準備ができています。

## 実行方法

1.  **依存関係のインストールを確認**: このスクリプトには`pandas`ライブラリが必要です。インストールされていない場合は、仮想環境をセットアップしてインストールできます。
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    pip install pandas
    ```

2.  **スクリプトの実行**:
    ```bash
    source venv/bin/activate && python3 convert_organization.py
    ```

    これにより、現在の作業ディレクトリに`converted_organization.csv`が生成されます。

## スクリプトのロジック

- スクリプトはまず`agency.csv`を読み込み、`agency_name`から`agency_id`へのマッピングを作成します。
- 次に`2-1_mockdata.csv`を読み込み、組織階層カラムの一意の組み合わせを抽出します。
- 各一意の組織パスに対して、新しい`organization_id`を割り当て、`agency_name_to_id`マップを使用して対応する`agency_id`と`supervising_agency_id`を検索します。
- 階層カラムの`NaN`値は、データベーススキーマのNULL許容カラムと一致するように`None`に変換されます。
- 結果のデータは`converted_organization.csv`に保存されます。
