import psycopg2
import pandas as pd
import sys
import os
from io import StringIO
import csv # Import the csv module
from psycopg2 import extras # Import for execute_values

# Database connection details (replace with your PostgreSQL credentials if different)
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_NAME = os.getenv('DB_NAME', 'postgres') # Default PostgreSQL database name
DB_USER = os.getenv('DB_USER', 'postgres') # Default PostgreSQL user
DB_PASSWORD = os.getenv('DB_PASSWORD', 'your_local_pg_password') # IMPORTANT: Replace with your local PostgreSQL password
DB_PORT = os.getenv('DB_PORT', '5432')

PROJECT_CSV_FILE = 'converted_budget_summary_revised.csv'
ORGANIZATION_NAME_CSV_FILE = 'organization_name.csv'

PROJECT_TABLE_NAME = 'projects'
ORGANIZATION_TABLE_NAME = 'organizations'
ORGANIZATION_NAME_TABLE_NAME = 'organization_names'

PROJECT_STAGING_TABLE_NAME = 'projects_staging_raw'
ORGANIZATION_STAGING_TABLE_NAME = 'organizations_staging_raw'
ORGANIZATION_NAME_STAGING_TABLE_NAME = 'organization_names_staging_raw'


def create_tables(cursor):
    """Creates the project, organization, organization_name, and their staging tables if they don't exist."""
    # organization_names table schema
    organization_name_ddl = f"""
    CREATE TABLE IF NOT EXISTS {ORGANIZATION_NAME_TABLE_NAME} (
        ministry_id SMALLINT PRIMARY KEY,
        ministry_name VARCHAR(255),
        ministry_order SMALLINT
    );
    """
    cursor.execute(organization_name_ddl)
    print(f"Table '{ORGANIZATION_NAME_TABLE_NAME}' created or already exists.")

    # organization_names staging table schema
    organization_name_staging_ddl = f"""
    CREATE TABLE IF NOT EXISTS {ORGANIZATION_NAME_STAGING_TABLE_NAME} (
        organization_id_raw TEXT,
        organization_name_raw TEXT,
        order_raw TEXT
    );
    """
    cursor.execute(organization_name_staging_ddl)
    print(f"Staging table '{ORGANIZATION_NAME_STAGING_TABLE_NAME}' created or already exists.")

    # organizations table schema
    organization_ddl = f"""
    CREATE TABLE IF NOT EXISTS {ORGANIZATION_TABLE_NAME} (
        organization_id SMALLINT PRIMARY KEY,
        policy_ministry_id SMALLINT REFERENCES {ORGANIZATION_NAME_TABLE_NAME}(ministry_id),
        ministry_id SMALLINT REFERENCES {ORGANIZATION_NAME_TABLE_NAME}(ministry_id),
        bureau_agency VARCHAR(255),
        department VARCHAR(255),
        division VARCHAR(255),
        office VARCHAR(255),
        group_name VARCHAR(255),
        section VARCHAR(255)
    );
    """
    cursor.execute(organization_ddl)
    print(f"Table '{ORGANIZATION_TABLE_NAME}' created or already exists.")

    # organizations staging table schema
    organization_staging_ddl = f"""
    CREATE TABLE IF NOT EXISTS {ORGANIZATION_STAGING_TABLE_NAME} (
        organization_id_raw TEXT,
        policy_ministry_id_raw TEXT,
        ministry_id_raw TEXT,
        bureau_agency_raw TEXT,
        department_raw TEXT,
        division_raw TEXT,
        office_raw TEXT,
        group_name_raw TEXT,
        section_raw TEXT
    );
    """
    cursor.execute(organization_staging_ddl)
    print(f"Staging table '{ORGANIZATION_STAGING_TABLE_NAME}' created or already exists.")

    # projects table schema
    project_ddl = f"""
    CREATE TABLE IF NOT EXISTS {PROJECT_TABLE_NAME} (
        project_id SMALLINT,
        fiscal_year SMALLINT,
        business_year SMALLINT,
        project_name VARCHAR(255),
        organization_id SMALLINT REFERENCES {ORGANIZATION_TABLE_NAME}(organization_id),
        main_reason_for_change TEXT,
        other_notes TEXT,
        initial_budget_total BIGINT,
        supplementary_budget_total BIGINT,
        carried_over_from_previous_year_total BIGINT,
        reserve_etc_total BIGINT,
        execution_amount_total BIGINT,
        carried_over_to_next_year_total BIGINT,
        next_year_request_total BIGINT,
        PRIMARY KEY (project_id, fiscal_year)
    );
    """
    cursor.execute(project_ddl)
    print(f"Table '{PROJECT_TABLE_NAME}' created or already exists.")

    # projects staging table schema
    project_staging_ddl = f"""
    CREATE TABLE IF NOT EXISTS {PROJECT_STAGING_TABLE_NAME} (
        project_id_raw TEXT,
        fiscal_year_raw TEXT,
        business_year_raw TEXT,
        project_name_raw TEXT,
        organization_id_raw TEXT,
        main_reason_for_change_raw TEXT,
        other_notes_raw TEXT,
        initial_budget_total_raw TEXT,
        supplementary_budget_total_raw TEXT,
        carried_over_from_previous_year_total_raw TEXT,
        reserve_etc_total_raw TEXT,
        execution_amount_total_raw TEXT,
        carried_over_to_next_year_total_raw TEXT,
        next_year_request_total_raw TEXT
    );
    """
    cursor.execute(project_staging_ddl)
    print(f"Staging table '{PROJECT_STAGING_TABLE_NAME}' created or already exists.")


def import_csv_to_db():
    """Imports data from CSV files into PostgreSQL staging tables, then transforms to final tables."""
    conn = None
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            port=DB_PORT
        )
        cursor = conn.cursor()

        create_tables(cursor)

        # --- Import organization_name.csv ---
        cursor.execute(f"TRUNCATE TABLE {ORGANIZATION_NAME_STAGING_TABLE_NAME};")
        print(f"Staging table '{ORGANIZATION_NAME_STAGING_TABLE_NAME}' truncated.")

        df_org_name = pd.read_csv(ORGANIZATION_NAME_CSV_FILE)
        df_org_name = df_org_name.astype(str)
        data_to_insert_org_name = [tuple(row) for row in df_org_name.values]
        org_name_staging_cols = ['organization_id_raw', 'organization_name_raw', 'order_raw']
        insert_org_name_staging_sql = f"INSERT INTO {ORGANIZATION_NAME_STAGING_TABLE_NAME} ({', '.join(org_name_staging_cols)}) VALUES %s"
        extras.execute_values(cursor, insert_org_name_staging_sql, data_to_insert_org_name, page_size=1000)
        print(f"Data from '{ORGANIZATION_NAME_CSV_FILE}' successfully imported into staging table '{ORGANIZATION_NAME_STAGING_TABLE_NAME}'.")

        cursor.execute(f"TRUNCATE TABLE {ORGANIZATION_NAME_TABLE_NAME} CASCADE;") # CASCADE to clear dependent tables
        print(f"Final table '{ORGANIZATION_NAME_TABLE_NAME}' truncated.")

        transform_org_name_sql = f"""
        INSERT INTO {ORGANIZATION_NAME_TABLE_NAME} (ministry_id, ministry_name, ministry_order)
        SELECT
            NULLIF(SPLIT_PART(TRIM(organization_id_raw), '.', 1), '')::SMALLINT,
            NULLIF(TRIM(organization_name_raw), ''),
            NULLIF(SPLIT_PART(TRIM(order_raw), '.', 1), '')::SMALLINT
        FROM {ORGANIZATION_NAME_STAGING_TABLE_NAME};
        """
        cursor.execute(transform_org_name_sql)
        print(f"Data successfully transformed from staging to '{ORGANIZATION_NAME_TABLE_NAME}'.")

        # --- Generate and Import organization data ---
        cursor.execute(f"TRUNCATE TABLE {ORGANIZATION_STAGING_TABLE_NAME};")
        print(f"Staging table '{ORGANIZATION_STAGING_TABLE_NAME}' truncated.")

        # Example: Create dummy organization data based on existing organization_name
        cursor.execute(f"""
            INSERT INTO {ORGANIZATION_STAGING_TABLE_NAME} (organization_id_raw, policy_ministry_id_raw, ministry_id_raw, bureau_agency_raw, department_raw, division_raw, office_raw, group_name_raw, section_raw)
            SELECT DISTINCT ON (ministry_id)
                CAST(ministry_id AS TEXT),
                CAST(ministry_id AS TEXT),
                CAST(ministry_id AS TEXT),
                '', '', '', '', '', ''
            FROM {ORGANIZATION_NAME_TABLE_NAME};
        """)
        print(f"Dummy organization data generated and inserted into staging table '{ORGANIZATION_STAGING_TABLE_NAME}'.")

        cursor.execute(f"TRUNCATE TABLE {ORGANIZATION_TABLE_NAME} CASCADE;")
        print(f"Final table '{ORGANIZATION_TABLE_NAME}' truncated.")

        transform_organization_sql = f"""
        INSERT INTO {ORGANIZATION_TABLE_NAME} (organization_id, policy_ministry_id, ministry_id, bureau_agency, department, division, office, group_name, section)
        SELECT
            NULLIF(SPLIT_PART(TRIM(organization_id_raw), '.', 1), '')::SMALLINT,
            NULLIF(SPLIT_PART(TRIM(policy_ministry_id_raw), '.', 1), '')::SMALLINT,
            NULLIF(SPLIT_PART(TRIM(ministry_id_raw), '.', 1), '')::SMALLINT,
            NULLIF(TRIM(bureau_agency_raw), ''),
            NULLIF(TRIM(department_raw), ''),
            NULLIF(TRIM(division_raw), ''),
            NULLIF(TRIM(office_raw), ''),
            NULLIF(TRIM(group_name_raw), ''),
            NULLIF(TRIM(section_raw), '')
        FROM {ORGANIZATION_STAGING_TABLE_NAME};
        """
        cursor.execute(transform_organization_sql)
        print(f"Data successfully transformed from staging to '{ORGANIZATION_TABLE_NAME}'.")


        # --- Import project.csv ---
        cursor.execute(f"TRUNCATE TABLE {PROJECT_STAGING_TABLE_NAME};")
        print(f"Staging table '{PROJECT_STAGING_TABLE_NAME}' truncated.")

        project_column_names_for_pandas = [
            '予算事業ID', '予算年度', '事業年度', '事業名', '組織ID', '主な増減理由',
            'その他特記事項', '当初予算_合計', '補正額_合計',
            '前年度からの繰り越し_合計', '予備費等_合計', '執行額_合計',
            '翌年度への繰り越し_合計', '翌年度要求額_合計'
        ]
        df_project = pd.read_csv(PROJECT_CSV_FILE, header=0, names=project_column_names_for_pandas)
        df_project = df_project.astype(str)
        data_to_insert_project = [tuple(row) for row in df_project.values]
        project_staging_cols = [f'{col}_raw' for col in project_column_names_for_pandas]
        insert_project_staging_sql = f"INSERT INTO {PROJECT_STAGING_TABLE_NAME} ({', '.join(project_staging_cols)}) VALUES %s"
        extras.execute_values(cursor, insert_project_staging_sql, data_to_insert_project, page_size=1000)
        print(f"Data from '{PROJECT_CSV_FILE}' successfully imported into staging table '{PROJECT_STAGING_TABLE_NAME}'.")

        cursor.execute(f"TRUNCATE TABLE {PROJECT_TABLE_NAME} CASCADE;")
        print(f"Final table '{PROJECT_TABLE_NAME}' truncated.")

        transform_project_sql = f"""
        INSERT INTO {PROJECT_TABLE_NAME} (
            project_id, fiscal_year, business_year, project_name, organization_id, main_reason_for_change,
            other_notes, initial_budget_total, supplementary_budget_total,
            carried_over_from_previous_year_total, reserve_etc_total, execution_amount_total,
            carried_over_to_next_year_total, next_year_request_total
        )
        SELECT
            NULLIF(SPLIT_PART(TRIM(予算事業ID_raw), '.', 1), '')::SMALLINT,
            NULLIF(SPLIT_PART(TRIM(予算年度_raw), '.', 1), '')::SMALLINT,
            NULLIF(SPLIT_PART(TRIM(事業年度_raw), '.', 1), '')::SMALLINT,
            NULLIF(TRIM(事業名_raw), ''),
            CASE
                WHEN TRIM(組織ID_raw) = '' OR LOWER(TRIM(組織ID_raw)) = 'nan' THEN NULL
                ELSE NULLIF(SPLIT_PART(TRIM(組織ID_raw), '.', 1), '')::SMALLINT
            END,
            NULLIF(TRIM(主な増減理由_raw), ''),
            NULLIF(TRIM(その他特記事項_raw), ''),
            NULLIF(REGEXP_REPLACE(TRIM(当初予算_合計_raw), '[^0-9\-]', '', 'g'), '')::BIGINT,
            NULLIF(REGEXP_REPLACE(TRIM(補正額_合計_raw), '[^0-9\-]', '', 'g'), '')::BIGINT,
            NULLIF(REGEXP_REPLACE(TRIM(前年度からの繰り越し_合計_raw), '[^0-9\-]', '', 'g'), '')::BIGINT,
            NULLIF(REGEXP_REPLACE(TRIM(予備費等_合計_raw), '[^0-9\-]', '', 'g'), '')::BIGINT,
            NULLIF(REGEXP_REPLACE(TRIM(執行額_合計_raw), '[^0-9\-]', '', 'g'), '')::BIGINT,
            NULLIF(REGEXP_REPLACE(TRIM(翌年度への繰り越し_合計_raw), '[^0-9\-]', '', 'g'), '')::BIGINT,
            NULLIF(REGEXP_REPLACE(TRIM(翌年度要求額_合計_raw), '[^0-9\-]', '', 'g'), '')::BIGINT
        FROM {PROJECT_STAGING_TABLE_NAME}
        WHERE CASE
                WHEN TRIM(組織ID_raw) = '' OR LOWER(TRIM(組織ID_raw)) = 'nan' THEN NULL
                ELSE NULLIF(SPLIT_PART(TRIM(組織ID_raw), '.', 1), '')
              END IS NOT NULL; -- Only insert if organization_id is not NULL
        """
        cursor.execute(transform_project_sql)
        print(f"Data successfully transformed from staging to '{PROJECT_TABLE_NAME}'.")

        conn.commit()
        print("All data import and transformation completed.")

    except FileNotFoundError:
        print(f"Error: One of the CSV files not found.")
        sys.exit(1)
    except psycopg2.Error as e:
        print(f"PostgreSQL error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        sys.exit(1)
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    import_csv_to_db()
