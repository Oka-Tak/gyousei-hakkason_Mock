# PostgreSQLセットアップ手順（実行例付き）

## 1. PostgreSQLインストール
（Ubuntu例）
```bash
sudo apt update
sudo apt install postgresql
```

## 2. ユーザー・データベース作成
```bash
sudo -u postgres psql
```
```sql
-- psqlプロンプト内で実行
CREATE USER gyosei_user WITH PASSWORD 'your_password';
CREATE DATABASE gyosei_db OWNER gyosei_user;
GRANT ALL PRIVILEGES ON DATABASE gyosei_db TO gyosei_user;
\q
```

## 3. スキーマ・テーブル作成
```bash
psql -U gyosei_user -d gyosei_db -h localhost -f DB_data/DDL.sql
```

## 4. CSVデータのインポート

### psqlコマンドから投入（推奨）
```bash
psql -U gyosei_user -d gyosei_db -h localhost -c "\\copy agency FROM 'DB_data/agency.csv' WITH CSV HEADER;"
psql -U gyosei_user -d gyosei_db -h localhost -c "\\copy organization FROM 'DB_data/organization.csv' WITH CSV HEADER;"
psql -U gyosei_user -d gyosei_db -h localhost -c "\\copy project FROM 'DB_data/project.csv' WITH CSV HEADER;"
```

### psqlプロンプト内で直接投入
```sql
-- psqlプロンプト内で
\copy agency FROM 'DB_data/agency.csv' WITH CSV HEADER;
\copy organization FROM 'DB_data/organization.csv' WITH CSV HEADER;
\copy project FROM 'DB_data/project.csv' WITH CSV HEADER;
```

※Windows/WSLの場合は絶対パス指定が必要な場合があります。
例: `C:/Users/yourname/gyousei-hakkason_Mock/DB_data/agency.csv`

## 5. .env.localの設定（Next.js用DB接続情報）
`client/.env.local` を作成し、以下を記載
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gyosei_db
DB_USER=gyosei_user
DB_PASSWORD=your_password
```

## 6. 動作確認
```bash
psql -U gyosei_user -d gyosei_db -h localhost -W
```
```sql
-- psqlプロンプト内で
\dt
SELECT COUNT(*) FROM agency;
SELECT COUNT(*) FROM organization;
SELECT COUNT(*) FROM project;
```

---

この手順を実行すれば、同じPostgreSQL環境を再現できます。
