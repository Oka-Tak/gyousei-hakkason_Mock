import csv

# 入力ファイル
SPENDING_CSV = 'converted_data/converted_project_spending.csv'
BLOCK_CSV = 'converted_data/converted_project_spending_block.csv'
# 出力ファイル
OUTPUT_CSV = 'project_spending_import.csv'

# block_idを自動採番し、project_id, budget_year, block_noで紐付ける辞書を作成する
block_dict = {}
with open(BLOCK_CSV, encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for idx, row in enumerate(reader, 1):
        key = (row['project_id'], row['budget_year'], row['block_no'])
        block_dict[key] = str(idx)  # block_idは1始まりの連番文字列

# project_spendingテーブルのカラム順
columns = [
    'block_id', 'project_id', 'budget_year', 'recipient_name', 'corporate_number',
    'address', 'corporation_type', 'is_other_recipient', 'amount',
    'contract_method', 'contract_method_detail', 'bidders_count',
    'successful_bid_rate', 'single_bid_reason', 'is_other_contract', 'contract_summary'
]

with open(SPENDING_CSV, encoding='utf-8') as fin, \
     open(OUTPUT_CSV, 'w', encoding='utf-8', newline='') as fout:
    reader = csv.DictReader(fin)
    writer = csv.writer(fout)
    writer.writerow(columns)  # ヘッダー

    for row in reader:
        key = (row['project_id'], row['budget_year'], row['block_no'])
        block_id = block_dict.get(key)
        if not block_id:
            print(f"block_id not found for {key}, skipping row.")
            continue
        # 型変換・整形
        def conv_bool(val):
            return 't' if val == 'True' else 'f' if val == 'False' else ''
        def conv_num(val):
            return val if val else ''
        out_row = [
            block_id,
            row['project_id'],
            row['budget_year'],
            row.get('recipient_name', ''),
            row.get('corporate_number', ''),
            row.get('address', ''),
            row.get('corporation_type', ''),
            conv_bool(row.get('is_other_recipient', '')),
            conv_num(row.get('amount', '')),
            row.get('contract_method', ''),
            row.get('contract_method_detail', ''),
            conv_num(row.get('bidders_count', '')),
            conv_num(row.get('successful_bid_rate', '')),
            row.get('single_bid_reason', ''),
            conv_bool(row.get('is_other_contract', '')),
            row.get('contract_summary', '')
        ]
        writer.writerow(out_row)

print(f'CSV出力完了: {OUTPUT_CSV}')

