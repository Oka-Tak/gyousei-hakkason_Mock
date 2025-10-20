#!/usr/bin/env python3
"""
Generate semantic embeddings for projects and export as CSV.

This script mirrors `generate_agency_embeddings.py` but targets projects.
It reads normalized project data from `converted_data/converted_project.csv`,
organization hierarchy from `converted_data/converted_organization.csv`,
agency names from `DB_data/agency.csv`, and related project metadata from
`source_data/1-5_source.csv` (関連事業). It then produces surface text and
keywords per project (project_id, budget_year), computes sentence embeddings
with a user-specified model, and writes a CSV that can be imported into the
`project_semantic_embedding` table.

Output columns:
  - project_id (smallint)
  - budget_year (smallint)
  - model_id (int, provided via CLI)
  - embedding (vector literal string e.g. "[0.1,0.2,...]")
  - surface (text)
  - synonyms (text[] array literal)
  - keywords (text[] array literal)

Example:
  python scripts/generate_project_embeddings.py --model-id 2 \
      --budget-year 2024 \
      --output converted_data/project_semantic_embedding.csv

Requirements:
  pip install sentence-transformers numpy
"""

from __future__ import annotations

import argparse
import csv
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Sequence, Tuple

import numpy as np
from sentence_transformers import SentenceTransformer

BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_MODEL_NAME = "intfloat/multilingual-e5-small"
DEFAULT_OUTPUT = BASE_DIR / "converted_data" / "project_semantic_embedding.csv"
PROJECT_CSV = BASE_DIR / "converted_data" / "converted_project.csv"
ORGANIZATION_CSV = BASE_DIR / "converted_data" / "converted_organization.csv"
AGENCY_CSV = BASE_DIR / "DB_data" / "agency.csv"
RELATED_SOURCE_CSV = BASE_DIR / "source_data" / "1-5_source.csv"

ORG_FIELDS_ORDER = [
    "bureau_office",
    "division",
    "department",
    "section",
    "team",
    "unit",
]


@dataclass
class ProjectRecord:
    project_id: int
    budget_year: int
    project_name: str
    organization_id: int
    main_change_reason: str
    notes: str
    budgets: Dict[str, float]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate project semantic embeddings CSV")
    parser.add_argument("--model-id", type=int, required=True, help="embedding_model.model_id value")
    parser.add_argument("--budget-year", type=int, default=2024, help="target budget year to export")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="output CSV path")
    parser.add_argument("--model-name", default=DEFAULT_MODEL_NAME, help="sentence-transformers model name")
    parser.add_argument("--max-keywords", type=int, default=64, help="limit number of keywords per project")
    return parser.parse_args()


def read_agency_names() -> Dict[int, str]:
    if not AGENCY_CSV.exists():
        raise FileNotFoundError(f"Agency CSV not found: {AGENCY_CSV}")
    names: Dict[int, str] = {}
    with AGENCY_CSV.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if not row:
                continue
            try:
                agency_id = int(row.get("agency_id") or 0)
            except ValueError:
                continue
            name = (row.get("agency_name") or "").strip()
            if agency_id > 0 and name:
                names[agency_id] = name
    if not names:
        raise RuntimeError("No agency rows loaded from agency.csv")
    return names


def read_organization_map(agency_names: Dict[int, str]) -> Dict[int, Dict[str, str]]:
    if not ORGANIZATION_CSV.exists():
        raise FileNotFoundError(f"Organization CSV not found: {ORGANIZATION_CSV}")
    mapping: Dict[int, Dict[str, str]] = {}
    with ORGANIZATION_CSV.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if not row:
                continue
            try:
                organization_id = int(row.get("organization_id") or 0)
            except ValueError:
                continue
            if organization_id <= 0:
                continue
            agency_id = int(row.get("agency_id") or 0) if row.get("agency_id") else None
            agency_name = agency_names.get(agency_id or -1, "")
            mapping[organization_id] = {
                "agency_id": str(agency_id) if agency_id else "",
                "agency_name": agency_name,
                **{field: (row.get(field) or "").strip() for field in ORG_FIELDS_ORDER},
            }
    if not mapping:
        raise RuntimeError("No organization rows loaded from converted_organization.csv")
    return mapping


def safe_float(value: str | None) -> float:
    if not value:
        return 0.0
    try:
        return float(value)
    except ValueError:
        return 0.0


def read_project_rows(target_year: int) -> List[ProjectRecord]:
    if not PROJECT_CSV.exists():
        raise FileNotFoundError(f"Project CSV not found: {PROJECT_CSV}")
    records: List[ProjectRecord] = []
    with PROJECT_CSV.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if not row:
                continue
            try:
                budget_year = int(row.get("budget_year") or 0)
                project_id = int(row.get("project_id") or 0)
            except ValueError:
                continue
            if budget_year != target_year or project_id <= 0:
                continue
            organization_id = int(row.get("organization_id") or 0) if row.get("organization_id") else 0
            record = ProjectRecord(
                project_id=project_id,
                budget_year=budget_year,
                project_name=(row.get("project_name") or "").strip(),
                organization_id=organization_id,
                main_change_reason=(row.get("main_change_reason") or "").strip(),
                notes=(row.get("notes") or "").strip(),
                budgets={
                    "initial_budget_total": safe_float(row.get("initial_budget_total")),
                    "adjustment_total": safe_float(row.get("adjustment_total")),
                    "carryover_from_previous_total": safe_float(row.get("carryover_from_previous_total")),
                    "contingency_total": safe_float(row.get("contingency_total")),
                    "execution_total": safe_float(row.get("execution_total")),
                    "carryover_to_next_total": safe_float(row.get("carryover_to_next_total")),
                    "next_year_request_total": safe_float(row.get("next_year_request_total")),
                },
            )
            records.append(record)
    if not records:
        raise RuntimeError(f"No project rows found for budget_year={target_year}")
    return records


def read_related_projects(target_year: int) -> Dict[Tuple[int, int], List[Tuple[str, str]]]:
    """
    Returns mapping of (project_id, budget_year) -> list of (relation_type, related_project_name).
    """
    if not RELATED_SOURCE_CSV.exists():
        return {}
    related: Dict[Tuple[int, int], List[Tuple[str, str]]] = defaultdict(list)
    with RELATED_SOURCE_CSV.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if not row:
                continue
            try:
                budget_year = int(row.get("事業年度") or 0)
                project_id = int(row.get("予算事業ID") or 0)
            except ValueError:
                continue
            if budget_year != target_year or project_id <= 0:
                continue
            related_name = (row.get("関連事業の事業名") or "").strip()
            relation = (row.get("関連性") or "").strip()
            if not related_name:
                continue
            related[(project_id, budget_year)].append((relation, related_name))
    return related


def format_currency(value: float) -> str:
    if abs(value) < 1:
        return "0円"
    return f"{int(round(value)):,}円"


def build_surface(record: ProjectRecord, org: Dict[str, str] | None, related: List[Tuple[str, str]]) -> Tuple[str, List[str]]:
    parts: List[str] = []
    keywords: List[str] = []

    title = f"{record.budget_year}年度 {record.project_name}".strip()
    if title:
        parts.append(title)
        keywords.append(record.project_name)

    if org:
        hierarchy = [org.get("agency_name", "")]
        hierarchy.extend([org.get(field, "") for field in ORG_FIELDS_ORDER])
        hierarchy = [h for h in hierarchy if h]
        if hierarchy:
            parts.append("所管: " + " > ".join(hierarchy))
            keywords.extend(hierarchy)

    budget_segments = []
    initial = record.budgets.get("initial_budget_total", 0.0)
    if initial:
        budget_segments.append(f"当初予算 {format_currency(initial)}")
    adjustment = record.budgets.get("adjustment_total", 0.0)
    if adjustment:
        budget_segments.append(f"補正 {format_currency(adjustment)}")
    execution = record.budgets.get("execution_total", 0.0)
    if execution:
        budget_segments.append(f"執行額 {format_currency(execution)}")
    next_year = record.budgets.get("next_year_request_total", 0.0)
    if next_year:
        budget_segments.append(f"翌年度要求 {format_currency(next_year)}")
    if budget_segments:
        parts.append("予算情報: " + "、".join(budget_segments))

    if record.main_change_reason:
        parts.append(f"主な変更理由: {record.main_change_reason}")
    if record.notes:
        parts.append(f"備考: {record.notes}")

    if related:
        related_desc = []
        for relation, name in related:
            clean = name.strip()
            if not clean:
                continue
            if relation:
                related_desc.append(f"{clean}（{relation}）")
            else:
                related_desc.append(clean)
            keywords.append(clean)
        if related_desc:
            parts.append("関連事業: " + "、".join(related_desc))

    surface = "。".join(parts).strip()
    if surface and not surface.endswith("。"):
        surface += "。"
    keywords = list(dict.fromkeys(filter(None, keywords)))  # preserve order, remove duplicates/empty
    return surface, keywords


def to_pg_array(values: Iterable[str]) -> str:
    items = []
    for val in values:
        escaped = val.replace("\\", "\\\\").replace("\"", "\\\"")
        items.append(f'"{escaped}"')
    return "{" + ",".join(items) + "}"


def format_embedding(vec: Sequence[float]) -> str:
    return "[" + ",".join(f"{float(x):.8f}" for x in vec) + "]"


def build_payload(
    records: List[ProjectRecord],
    org_map: Dict[int, Dict[str, str]],
    related_map: Dict[Tuple[int, int], List[Tuple[str, str]]],
    model_name: str,
    max_keywords: int,
) -> List[Dict]:
    model = SentenceTransformer(model_name)
    payload: List[Dict] = []
    texts: List[str] = []
    surfaces: List[str] = []
    keywords_list: List[List[str]] = []

    for record in records:
        org = org_map.get(record.organization_id)
        related = related_map.get((record.project_id, record.budget_year), [])
        surface, keywords = build_surface(record, org, related)
        surfaces.append(surface)
        keywords_list.append(keywords[:max_keywords])
        if keywords:
            text = f"{surface} キーワード: {', '.join(keywords[:max_keywords])}"
        else:
            text = surface
        texts.append(text.replace("\n", " ").strip())

    embeddings = model.encode(texts, normalize_embeddings=True, convert_to_numpy=True)
    if isinstance(embeddings, list):
        embeddings = np.asarray(embeddings)

    for record, surface, keywords, vec in zip(records, surfaces, keywords_list, embeddings):
        payload.append({
            "project_id": record.project_id,
            "budget_year": record.budget_year,
            "surface": surface,
            "synonyms": [],
            "keywords": keywords,
            "embedding": vec.tolist(),
        })
    return payload


def write_csv(rows: List[Dict], model_id: int, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["project_id", "budget_year", "model_id", "embedding", "surface", "synonyms", "keywords"])
        for row in rows:
            writer.writerow([
                row["project_id"],
                row["budget_year"],
                model_id,
                format_embedding(row["embedding"]),
                row["surface"],
                to_pg_array(row["synonyms"]),
                to_pg_array(row["keywords"]),
            ])


def main() -> None:
    args = parse_args()
    agency_names = read_agency_names()
    org_map = read_organization_map(agency_names)
    project_records = read_project_rows(args.budget_year)
    related_map = read_related_projects(args.budget_year)
    payload = build_payload(project_records, org_map, related_map, args.model_name, args.max_keywords)
    write_csv(payload, args.model_id, args.output)
    print(f"Wrote {len(payload)} rows to {args.output}")


if __name__ == "__main__":
    main()
