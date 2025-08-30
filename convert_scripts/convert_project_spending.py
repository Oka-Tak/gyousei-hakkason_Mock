import csv
import os

def convert_project_spending(source_csv_path, output_csv_path):
    """
    Converts data from the source CSV into a format suitable for the project_spending table.
    Note: block_id is not generated here as it's an IDENTITY column in the DB.
    Instead, project_id, budget_year, and block_no are included to link to project_spending_block.
    """
    # Ensure the output directory exists
    output_dir = os.path.dirname(output_csv_path)
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    output_data = []
    
    print(f"Attempting to convert from: {source_csv_path}")
    print(f"Output will be written to: {output_csv_path}")

    try:
        with open(source_csv_path, mode='r', encoding='utf-8') as infile:
            reader = csv.DictReader(infile)
            
            if reader.fieldnames:
                print(f"CSV Headers found: {reader.fieldnames}")
            else:
                print("Warning: No CSV headers found. This might indicate an empty or malformed CSV.")
                return # Exit if no headers are found

            row_count = 0
            for row in reader:
                row_count += 1
                # Required fields for linking to project_spending_block and project
                project_id = row.get('予算事業ID')
                budget_year = row.get('事業年度')
                block_no = row.get('支出先ブロック番号')

                # Fields for project_spending table
                recipient_name = row.get('支出先名')
                corporate_number = row.get('法人番号')
                address = row.get('所在地')
                corporation_type = row.get('法人種別')
                is_other_recipient = row.get('その他支出先')
                amount = row.get('金額')
                contract_method = row.get('契約方式等')
                contract_method_detail = row.get('具体的な契約方式等')
                bidders_count = row.get('入札者数')
                successful_bid_rate = row.get('落札率')
                single_bid_reason = row.get('一者応札・一者応募又は競争性のない随意契約となった理由及び改善策（支出額10億円以上）')
                is_other_contract = row.get('その他の契約')
                contract_summary = row.get('契約概要')

                # Skip rows that don't have essential linking information
                if not (project_id and budget_year and block_no):
                    print(f"Skipping row {row_count} due to missing essential linking information (project_id, budget_year, or block_no): {row}")
                    continue

                # Clean and convert data
                try:
                    project_id = int(project_id)
                    budget_year = int(budget_year)
                except ValueError:
                    print(f"Skipping row {row_count} due to invalid project_id or budget_year (values: project_id='{project_id}', budget_year='{budget_year}'): {row}")
                    continue
                
                # Convert corporate_number to string and ensure it's 13 chars, padding with '0' if needed
                if corporate_number:
                    corporate_number = str(corporate_number).strip()
                    if len(corporate_number) < 13:
                        corporate_number = corporate_number.zfill(13)
                    elif len(corporate_number) > 13:
                        corporate_number = corporate_number[:13] # Truncate if too long
                else:
                    corporate_number = None

                # Convert boolean fields
                is_other_recipient = True if str(is_other_recipient).strip().lower() == 'true' else False
                is_other_contract = True if str(is_other_contract).strip().lower() == 'true' else False

                # Convert numeric fields
                if amount:
                    try:
                        amount = float(str(amount).replace(',', ''))
                    except ValueError:
                        print(f"Warning: Row {row_count}: Could not convert '金額' to numeric (value: '{amount}'). Setting to None.")
                        amount = None
                else:
                    amount = None

                if bidders_count:
                    try:
                        bidders_count = int(float(str(bidders_count).replace(',', ''))) # Handle potential float strings
                    except ValueError:
                        print(f"Warning: Row {row_count}: Could not convert '入札者数' to integer (value: '{bidders_count}'). Setting to None.")
                        bidders_count = None
                else:
                    bidders_count = None

                if successful_bid_rate:
                    try:
                        successful_bid_rate = float(str(successful_bid_rate).replace(',', ''))
                    except ValueError:
                        print(f"Warning: Row {row_count}: Could not convert '落札率' to numeric (value: '{successful_bid_rate}'). Setting to None.")
                        successful_bid_rate = None
                else:
                    successful_bid_rate = None

                output_data.append({
                    'project_id': project_id,
                    'budget_year': budget_year,
                    'block_no': block_no, # Used for linking to project_spending_block
                    'recipient_name': recipient_name,
                    'corporate_number': corporate_number,
                    'address': address,
                    'corporation_type': corporation_type,
                    'is_other_recipient': is_other_recipient,
                    'amount': amount,
                    'contract_method': contract_method,
                    'contract_method_detail': contract_method_detail,
                    'bidders_count': bidders_count,
                    'successful_bid_rate': successful_bid_rate,
                    'single_bid_reason': single_bid_reason,
                    'is_other_contract': is_other_contract,
                    'contract_summary': contract_summary
                })
            print(f"Processed {row_count} rows from source CSV.")
            print(f"Found {len(output_data)} records to write for project_spending.")

    except FileNotFoundError:
        print(f"Error: Source CSV file not found at {source_csv_path}")
        return
    except Exception as e:
        print(f"An unexpected error occurred while reading the CSV file: {e}")
        return
    
    # Write to output CSV
    fieldnames = [
        'project_id', 'budget_year', 'block_no', 'recipient_name', 'corporate_number',
        'address', 'corporation_type', 'is_other_recipient', 'amount',
        'contract_method', 'contract_method_detail', 'bidders_count',
        'successful_bid_rate', 'single_bid_reason', 'is_other_contract', 'contract_summary'
    ]
    with open(output_csv_path, mode='w', encoding='utf-8', newline='') as outfile:
        writer = csv.DictWriter(outfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(output_data)

    print(f"Conversion complete. Output written to {output_csv_path}")

if __name__ == "__main__":
    source_file = 'source_data/5-1_RS_2024_支出先_支出情報.csv'
    output_file = 'converted_data/converted_project_spending.csv'
    convert_project_spending(source_file, output_file)
