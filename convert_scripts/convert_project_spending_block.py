import csv
import os

def convert_project_spending_block(source_csv_path, output_csv_path):
    """
    Converts data from the source CSV into a format suitable for the project_spending_block table.
    """
    # Ensure the output directory exists
    output_dir = os.path.dirname(output_csv_path)
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Set of unique (project_id, budget_year, block_no) to prevent duplicates
    seen_blocks = set()
    
    # Data to be written to the output CSV
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
                budget_year = row.get('事業年度')
                project_id = row.get('予算事業ID')
                block_no = row.get('支出先ブロック番号')
                block_name = row.get('支出先ブロック名')
                role_in_project = row.get('事業を行う上での役割')
                block_total_amount = row.get('ブロックの合計支出額')

                # Skip rows that don't have essential block information
                if not budget_year:
                    print(f"Skipping row {row_count} due to missing '事業年度': {row}")
                    continue
                if not project_id:
                    print(f"Skipping row {row_count} due to missing '予算事業ID': {row}")
                    continue
                if not block_no:
                    print(f"Skipping row {row_count} due to missing '支出先ブロック番号': {row}")
                    continue

                # Create a unique key for the block
                block_key = (project_id, budget_year, block_no)

                # Only process if this block hasn't been seen yet
                if block_key not in seen_blocks:
                    seen_blocks.add(block_key)

                    # Clean and convert data
                    try:
                        budget_year = int(budget_year)
                        project_id = int(project_id)
                    except ValueError:
                        print(f"Skipping row {row_count} due to invalid project_id or budget_year (values: project_id='{project_id}', budget_year='{budget_year}'): {row}")
                        continue
                    
                    # block_total_amount can be empty or non-numeric, handle it
                    if block_total_amount:
                        try:
                            # Remove commas and convert to float, then format to 2 decimal places
                            block_total_amount = float(str(block_total_amount).replace(',', ''))
                        except ValueError:
                            print(f"Warning: Row {row_count}: Could not convert 'ブロックの合計支出額' to numeric (value: '{block_total_amount}'). Setting to None for row: {row}")
                            block_total_amount = None # Set to None if conversion fails
                    else:
                        block_total_amount = None

                    output_data.append({
                        'project_id': project_id,
                        'budget_year': budget_year,
                        'block_no': block_no,
                        'block_name': block_name,
                        'role_in_project': role_in_project,
                        'block_total_amount': block_total_amount
                    })
            print(f"Processed {row_count} rows from source CSV.")
            print(f"Found {len(output_data)} unique blocks to write.")

    except FileNotFoundError:
        print(f"Error: Source CSV file not found at {source_csv_path}")
        return
    except Exception as e:
        print(f"An unexpected error occurred while reading the CSV file: {e}")
        return
    # Write to output CSV
    fieldnames = ['project_id', 'budget_year', 'block_no', 'block_name', 'role_in_project', 'block_total_amount']
    with open(output_csv_path, mode='w', encoding='utf-8', newline='') as outfile:
        writer = csv.DictWriter(outfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(output_data)

    print(f"Conversion complete. Output written to {output_csv_path}")

if __name__ == "__main__":
    # Corrected source file path to include Japanese characters
    source_file = 'source_data/5-1_RS_2024_支出先_支出情報.csv'
    output_file = 'converted_data/converted_project_spending_block.csv'
    convert_project_spending_block(source_file, output_file)
