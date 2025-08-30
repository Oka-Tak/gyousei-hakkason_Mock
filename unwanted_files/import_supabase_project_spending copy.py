import csv
import os
import psycopg2
from psycopg2 import extras

# データベース接続情報
DB_HOST = "db.eboyjghmwilyaxpudpry.supabase.co"
DB_NAME = "postgres" # あなたのデータベース名に置き換えてください
DB_USER = "postgres"   # あなたのユーザー名に置き換えてください
DB_PASSWORD = "IT-Sawayaka" # あなたのパスワードに置き換えてください
DB_PORT = "5432"

def import_project_spending_data(source_csv_path):
    conn = None
    cur = None
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            port=DB_PORT
        )
        cur = conn.cursor()
        
        print(f"Attempting to import project_spending data from: {source_csv_path}")

        with open(source_csv_path, mode='r', encoding='utf-8') as infile:
            reader = csv.DictReader(infile)
            
            if not reader.fieldnames:
                print("Error: No CSV headers found in source file.")
                return

            # 挿入するデータのリスト
            records_to_insert = []

            row_count = 0
            for row in reader:
                row_count += 1
                project_id = row.get('project_id')
                budget_year = row.get('budget_year')
                block_no = row.get('block_no')

                if not (project_id and budget_year and block_no):
                    print(f"Skipping row {row_count} due to missing project_id, budget_year, or block_no: {row}")
                    continue

                try:
                    project_id = int(project_id)
                    budget_year = int(budget_year)
                except ValueError:
                    print(f"Skipping row {row_count} due to invalid project_id or budget_year: {row}")
                    continue

                # block_id を project_spending_block テーブルからルックアップ
                cur.execute(
                    "SELECT block_id FROM project_spending_block WHERE project_id = %s AND budget_year = %s AND block_no = %s",
                    (project_id, budget_year, block_no)
                )
                block_id_result = cur.fetchone()

                if not block_id_result:
                    print(f"Skipping row {row_count}: No matching block_id found for project_id={project_id}, budget_year={budget_year}, block_no='{block_no}'")
                    continue
                
                block_id = block_id_result[0]

                # その他のフィールドの準備
                recipient_name = row.get('recipient_name')
                corporate_number = row.get('corporate_number')
                address = row.get('address')
                corporation_type = row.get('corporation_type')
                is_other_recipient = row.get('is_other_recipient') == 'True'
                amount = row.get('amount')
                contract_method = row.get('contract_method')
                contract_method_detail = row.get('contract_method_detail')
                bidders_count = row.get('bidders_count')
                successful_bid_rate = row.get('successful_bid_rate')
                single_bid_reason = row.get('single_bid_reason')
                is_other_contract = row.get('is_other_contract') == 'True'
                contract_summary = row.get('contract_summary')

                # 数値型フィールドのNone変換
                try:
                    amount = float(amount) if amount else None
                except ValueError:
                    amount = None
                try:
                    bidders_count = int(bidders_count) if bidders_count else None
                except ValueError:
                    bidders_count = None
                try:
                    successful_bid_rate = float(successful_bid_rate) if successful_bid_rate else None
                except ValueError:
                    successful_bid_rate = None

                records_to_insert.append((
                    block_id, project_id, budget_year, recipient_name, corporate_number,
                    address, corporation_type, is_other_recipient, amount,
                    contract_method, contract_method_detail, bidders_count,
                    successful_bid_rate, single_bid_reason, is_other_contract, contract_summary
                ))
            
            print(f"Processed {row_count} rows from source CSV. Prepared {len(records_to_insert)} records for insertion.")

            # データを一括挿入
            if records_to_insert:
                insert_query = """
                    INSERT INTO project_spending (
                        block_id, project_id, budget_year, recipient_name, corporate_number,
                        address, corporation_type, is_other_recipient, amount,
                        contract_method, contract_method_detail, bidders_count,
                        successful_bid_rate, single_bid_reason, is_other_contract, contract_summary
                    ) VALUES %s
                """
                extras.execute_values(
                    cur, insert_query, records_to_insert,
                    page_size=1000 # チャンクサイズを調整してパフォーマンスを向上
                )
                conn.commit()
                print(f"Successfully inserted {len(records_to_insert)} records into project_spending.")
            else:
                print("No records to insert into project_spending.")

    except FileNotFoundError:
        print(f"Error: Source CSV file not found at {source_csv_path}")
    except psycopg2.Error as e:
        print(f"Database error: {e}")
        if conn:
            conn.rollback()
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
    finally:
        if cur is not None:
            cur.close()
        if conn is not None:
            conn.close()

if __name__ == "__main__":
    source_file = 'converted_data/converted_project_spending.csv'
    import_project_spending_data(source_file)
