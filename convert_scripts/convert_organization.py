import csv
import pandas as pd

def convert_organization_data(agency_csv_path, mock_data_csv_path, output_csv_path):
    # Load agency data for lookup
    agency_df = pd.read_csv(agency_csv_path)
    agency_name_to_id = dict(zip(agency_df['agency_name'], agency_df['agency_id']))

    # Load mock data
    mock_df = pd.read_csv(mock_data_csv_path)

    # Columns for organization hierarchy
    org_columns = [
        '府省庁', '政策所管府省庁', '局・庁', '部', '課', '室', '班', '係'
    ]

    # Create a DataFrame with unique organization paths
    # Fill NaN values with empty strings for uniqueness check
    unique_org_paths = mock_df[org_columns].drop_duplicates().fillna('')

    organizations = []
    organization_id_counter = 1
    organization_path_to_id = {}

    for index, row in unique_org_paths.iterrows():
        agency_name = row['府省庁']
        supervising_agency_name = row['政策所管府省庁']

        agency_id = agency_name_to_id.get(agency_name)
        supervising_agency_id = agency_name_to_id.get(supervising_agency_name)

        if agency_id is None:
            print(f"Warning: Agency '{agency_name}' not found in agency.csv. Skipping record.")
            continue
        if supervising_agency_id is None:
            print(f"Warning: Supervising Agency '{supervising_agency_name}' not found in agency.csv. Skipping record.")
            continue

        # Create a unique key for the organization path
        org_path_key = tuple([
            agency_id,
            supervising_agency_id,
            row['局・庁'],
            row['部'],
            row['課'],
            row['室'],
            row['班'],
            row['係']
        ])

        if org_path_key not in organization_path_to_id:
            organization_path_to_id[org_path_key] = organization_id_counter
            organizations.append({
                'organization_id': organization_id_counter,
                'supervising_agency_id': supervising_agency_id,
                'agency_id': agency_id,
                'bureau_office': row['局・庁'] if row['局・庁'] != '' else None,
                'division': row['課'] if row['課'] != '' else None,
                'department': row['部'] if row['部'] != '' else None,
                'section': row['室'] if row['室'] != '' else None,
                'team': row['班'] if row['班'] != '' else None,
                'unit': row['係'] if row['係'] != '' else None,
            })
            organization_id_counter += 1

    # Create output DataFrame
    output_df = pd.DataFrame(organizations)

    # Save to CSV
    output_df.to_csv(output_csv_path, index=False)
    print(f"Converted organization data saved to {output_csv_path}")

if __name__ == "__main__":
    agency_csv = './source_data/agency.csv'
    mock_data_csv = './source_data/2-1_RS_2024_予算・執行_サマリ.csv'
    output_csv = './converted_data/converted_organization.csv'
    convert_organization_data(agency_csv, mock_data_csv, output_csv)
