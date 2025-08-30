import csv
import pandas as pd
import numpy as np

def convert_project_data(agency_csv_path, organization_csv_path, mock_data_csv_path, output_csv_path):
    # Load agency data for lookup (agency_name to agency_id)
    agency_df = pd.read_csv(agency_csv_path)
    agency_name_to_id = dict(zip(agency_df['agency_name'], agency_df['agency_id']))

    # Load converted organization data for lookup (organization_path to organization_id)
    organization_df = pd.read_csv(organization_csv_path)

    # Create a mapping from organization path components to organization_id
    # Ensure all path components are treated as strings for consistent key creation
    organization_df_filled = organization_df.fillna('')
    organization_path_to_id = {}
    for _, row in organization_df_filled.iterrows():
        # Reconstruct the key used in convert_organization.py
        # Note: 'supervising_agency_id' and 'agency_id' are already IDs, not names
        org_path_key = (
            row['agency_id'],
            row['supervising_agency_id'],
            row['bureau_office'],
            row['department'], # '部' in source maps to 'department'
            row['division'],   # '課' in source maps to 'division'
            row['section'],    # '室' in source maps to 'section'
            row['team'],       # '班' in source maps to 'team'
            row['unit']        # '係' in source maps to 'unit'
        )
        organization_path_to_id[org_path_key] = row['organization_id']

    # Load mock data for projects
    mock_df = pd.read_csv(mock_data_csv_path)

    # Filter out rows that are detailed breakdowns (where '会計区分' is not empty)
    # We want the aggregated rows which have the '合計' values and empty '会計区分'
    project_data_df = mock_df[mock_df['会計区分'].isnull() | (mock_df['会計区分'] == '')].copy()

    # Convert relevant columns to numeric, coercing errors to NaN
    numeric_cols = [
        '当初予算（合計）', '補正予算（合計）', '前年度からの繰越し（合計）',
        '予備費等（合計）', '執行額（合計）', '翌年度への繰越し(合計）', '翌年度要求額（合計）'
    ]
    for col in numeric_cols:
        # Replace non-numeric strings (like '4.80327E+11') with NaN before converting
        project_data_df[col] = pd.to_numeric(project_data_df[col], errors='coerce')
        # Fill NaN with 0 as per DDL default
        project_data_df[col] = project_data_df[col].fillna(0)

    projects = []
    # Use a set to track unique (project_id, budget_year) pairs to avoid duplicates
    processed_projects = set()

    for index, row in project_data_df.iterrows():
        project_id = row['予算事業ID']
        budget_year = row['予算年度'] # Corrected: Use 予算年度 for budget_year
        project_year_from_source = row['事業年度'] # Use 事業年度 for project_year

        # Skip if this (project_id, budget_year) pair has already been processed
        if (project_id, budget_year) in processed_projects:
            continue
        
        processed_projects.add((project_id, budget_year))

        agency_name = row['府省庁']
        supervising_agency_name = row['政策所管府省庁']

        agency_id = agency_name_to_id.get(agency_name)
        supervising_agency_id = agency_name_to_id.get(supervising_agency_name)

        if agency_id is None:
            print(f"Warning: Agency '{agency_name}' not found for project_id {project_id}, budget_year {budget_year}. Skipping record.")
            continue
        if supervising_agency_id is None:
            print(f"Warning: Supervising Agency '{supervising_agency_name}' not found for project_id {project_id}, budget_year {budget_year}. Skipping record.")
            continue

        # Reconstruct the organization path key from the mock data row
        # Ensure all components are strings and fill NaN with empty string for lookup
        org_path_key_from_mock = (
            agency_id,
            supervising_agency_id,
            str(row['局・庁']).strip() if pd.notna(row['局・庁']) else '',
            str(row['部']).strip() if pd.notna(row['部']) else '',
            str(row['課']).strip() if pd.notna(row['課']) else '',
            str(row['室']).strip() if pd.notna(row['室']) else '',
            str(row['班']).strip() if pd.notna(row['班']) else '',
            str(row['係']).strip() if pd.notna(row['係']) else ''
        )
        
        organization_id = organization_path_to_id.get(org_path_key_from_mock)

        if organization_id is None:
            print(f"Warning: Organization path {org_path_key_from_mock} not found in converted_organization.csv for project_id {project_id}, budget_year {budget_year}. Skipping record.")
            continue

        projects.append({
            'project_id': project_id,
            'budget_year': budget_year,
            'project_year': project_year_from_source, # Corrected: Use 事業年度 for project_year
            'project_name': row['事業名'],
            'organization_id': organization_id,
            'main_change_reason': row['主な増減理由'] if pd.notna(row['主な増減理由']) else None,
            'notes': row['その他特記事項'] if pd.notna(row['その他特記事項']) else None,
            'initial_budget_total': row['当初予算（合計）'],
            'adjustment_total': row['補正予算（合計）'],
            'carryover_from_previous_total': row['前年度からの繰越し（合計）'],
            'contingency_total': row['予備費等（合計）'],
            'execution_total': row['執行額（合計）'],
            'carryover_to_next_total': row['翌年度への繰越し(合計）'],
            'next_year_request_total': row['翌年度要求額（合計）'],
        })

    # Create output DataFrame
    output_df = pd.DataFrame(projects)

    # Save to CSV
    output_df.to_csv(output_csv_path, index=False)
    print(f"Converted project data saved to {output_csv_path}")

if __name__ == "__main__":
    agency_csv = './source_data/agency.csv'
    organization_csv = './converted_data/converted_organization.csv' # This should be the output of convert_organization.py
    mock_data_csv = './source_data/2-1_RS_2024_予算・執行_サマリ.csv'
    output_csv = './converted_data/converted_project.csv'
    
    # First, ensure converted_organization.csv exists by running convert_organization.py
    # This part is for local testing/execution flow, in the actual task,
    # we assume converted_organization.csv is already available.
    try:
        # Ensure converted_organization.csv exists by running convert_organization.py
        # This part is for local testing/execution flow, in the actual task,
        # we assume converted_organization.csv is already available.
        # To run convert_organization.py, we need to execute it as a script
        # or ensure its functions are importable.
        # For simplicity in this environment, we'll execute it as a separate command.
        # In a real scenario, you might refactor to make functions directly importable
        # or manage execution flow differently.
        import subprocess
        print("Ensuring converted_organization.csv is up-to-date by running convert_organization.py...")
        subprocess.run(
            ['python3', './convert_scripts/convert_organization.py'],
            check=True,
            capture_output=True,
            text=True
        )
        print("convert_organization.py executed successfully.")
    except subprocess.CalledProcessError as e:
        print(f"Error running convert_organization.py: {e.stderr}")
        print("Please ensure convert_organization.py is available and executable.")
    except Exception as e:
        print(f"Unexpected error during organization conversion check: {e}")

    convert_project_data(agency_csv, organization_csv, mock_data_csv, output_csv)
