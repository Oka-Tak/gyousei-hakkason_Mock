# PostgreSQL CSVインポート手順（project_spending_block, project_spending用）

この手順は `DB_data/project_spending_block.csv` および `DB_data/project_spending.csv` をPostgreSQLに投入する方法です。

---

## 1. テーブル作成（DDL適用済みの場合は不要）
`DB_data/DDL.sql` でテーブルが作成されていることを確認してください。

```bash
psql -U gyosei_user -d gyosei_db -h localhost -f DB_data/DDL.sql
```

---

## 2. CSVファイルのパスを確認
- `DB_data/project_spending_block.csv`
- `DB_data/project_spending.csv`
    
---


## 3. カラム型の拡張（必要な場合のみ）
block_total_amountに大きな値が含まれる場合、下記コマンドでカラム型を拡張してください。

```sql
ALTER TABLE project_spending_block ALTER COLUMN block_total_amount TYPE NUMERIC(16,2);
```

---

## 4. COPYコマンドでCSVをインポート

### psqlコマンドから投入
```bash
psql -U gyosei_user -d gyosei_db -h localhost -c "\\copy project_spending_block FROM 'DB_data/project_spending_block.csv' WITH CSV HEADER;"
psql -U gyosei_user -d gyosei_db -h localhost -c "\\copy project_spending FROM 'DB_data/project_spending.csv' WITH CSV HEADER;"
```

### psqlプロンプト内で直接投入
```sql
-- psqlプロンプト内で
\copy project_spending_block FROM 'DB_data/project_spending_block.csv' WITH CSV HEADER;
\copy project_spending FROM 'DB_data/project_spending.csv' WITH CSV HEADER;
```

※WSLの場合は絶対パス指定も可能です。
例: `/home/ユーザー名/gyousei-hakkason_Mock/DB_data/project_spending_block.csv`

---

## 5. データ確認
```sql
SELECT COUNT(*) FROM project_spending_block;
SELECT COUNT(*) FROM project_spending;
```

---

この手順で2つのCSVファイルをDBに投入できます。
