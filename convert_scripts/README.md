# Data conversion pipeline

This repo includes scripts to convert official source CSVs under `source_data/` into normalized CSVs under `converted_data/` compatible with the DB schema in `DB_data/docment/DDL.sql`.

## Source files
- `source_data/agency.csv` — master of agencies (`agency_id, agency_name, agency_order`)
- `source_data/2-1_RS_2024_予算・執行_サマリ.csv` — project-level budget and execution summary (totals per year)
- `source_data/5-1_RS_2024_支出先_支出情報.csv` — per-recipient spending, block metadata, contract metadata

## Outputs
- `converted_data/converted_organization.csv` — normalized organization hierarchy (maps agency + 局/部/課/室/班/係 → `organization_id`)
- `converted_data/converted_project.csv` — project rows with totals (initial/補正/繰越/予備費/執行/翌年) and `organization_id`
- `converted_data/converted_project_spending_block.csv` — unique `(project_id, budget_year, block_no)` rows with names, roles, block total amount
- `converted_data/converted_project_spending.csv` — recipient rows with corporate numbers, address, contract metadata, and `block_no`

## How to run
```
# 1) Organization (uses agency.csv + 2-1)
python3 convert_scripts/convert_organization.py

# 2) Projects (uses agency.csv + converted_organization.csv + 2-1)
python3 convert_scripts/convert_project.py

# 3) Spending blocks (uses 5-1)
python3 convert_scripts/convert_project_spending_block.py

# 4) Spendings (uses 5-1)
python3 convert_scripts/convert_project_spending.py

# Optional: create a single import-ready CSV for project_spending with block_id resolved
python3 generate_project_spending_import_csv.py
```

## Import to DB
- See `DB_data/docment/DDL.sql` and `DB_data/docment/postgresql_import_procedure.md` for schema and import guidance.
- Alternatively, import into Supabase using the same schema; set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `client/.env`.

## App pages powered by this data
- `/insight` — agency summary and top recipients
- `/recipients` — browse recipients by agency
- `/compare` — A/B compare two agencies
- `/company` — company/recipient overview by corporate number or name

