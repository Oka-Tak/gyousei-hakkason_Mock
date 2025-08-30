# project_spending_block, project_spending インポート完全手順

---

## 1. テーブル作成（DDL.sql適用済みなら不要）
```bash
psql -U gyosei_user -d gyosei_db -h localhost -f DB_data/DDL.sql
```

---

## 2. カラム型の拡張（block_total_amountが大きい場合のみ）
```sql
ALTER TABLE project_spending_block ALTER COLUMN block_total_amount TYPE NUMERIC(16,2);
```
（psqlプロンプト内で実行）

---

## 3. project_spending_blockのインポート
```sql
-- psqlプロンプト内で
\copy project_spending_block (project_id, budget_year, block_no, block_name, role_in_project, block_total_amount) FROM 'DB_data/project_spending_block.csv' WITH (FORMAT CSV, HEADER TRUE, ENCODING 'UTF8');
```
または
```bash
psql -U gyosei_user -d gyosei_db -h localhost -c "\\copy project_spending_block (project_id, budget_year, block_no, block_name, role_in_project, block_total_amount) FROM 'DB_data/project_spending_block.csv' WITH (FORMAT CSV, HEADER TRUE, ENCODING 'UTF8');"
```

---

## 4. project_spendingのインポート（Pythonスクリプト使用）

### 4-1. Pythonスクリプト例（import_project_spending.py）
```python
import csv
import psycopg2

conn = psycopg2.connect(
    dbname='gyosei_db', user='gyosei_user', password='（パスワード）', host='localhost'
)
cur = conn.cursor()

with open('DB_data/project_spending.csv', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        project_id = row['project_id']
        budget_year = row['budget_year']
        block_no = row['block_no']
        # ...他のカラムも取得
        cur.execute(
            "SELECT block_id FROM project_spending_block WHERE project_id = %s AND budget_year = %s AND block_no = %s",
            (project_id, budget_year, block_no)
        )
        block_id_result = cur.fetchone()
        if not block_id_result:
            print(f"Skipping row: No matching block_id for project_id={project_id}, budget_year={budget_year}, block_no={block_no}")
            continue
        block_id = block_id_result[0]
        # INSERT文を作成（必要なカラムを指定）
        cur.execute(
            "INSERT INTO project_spending (block_id, project_id, budget_year, recipient_name, amount, ...) VALUES (%s, %s, %s, %s, %s, ...)",
            (block_id, project_id, budget_year, row['recipient_name'], row['amount'], ...)
        )
conn.commit()
cur.close()
conn.close()
```
- 必要に応じてカラム名・型・ファイルパスを調整してください。
- psycopg2が必要です。`pip install psycopg2-binary`

---

## 5. データ確認
```sql
SELECT COUNT(*) FROM project_spending_block;
SELECT COUNT(*) FROM project_spending;
```

---

この手順で、block_idの整合性を保ったまま2つのテーブルにデータを投入できます。
