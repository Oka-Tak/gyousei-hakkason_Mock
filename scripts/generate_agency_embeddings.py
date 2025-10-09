#!/usr/bin/env python3
"""Generate semantic embeddings for agencies and export as CSV.

This script reads agency hierarchy data from
`converted_data/converted_organization.csv` and basic agency metadata from
`DB_data/agency.csv`, computes sentence embeddings using
`intfloat/multilingual-e5-small`, and produces a CSV formatted for manual import
into the `agency_semantic_embedding` table.

The output columns are:
- agency_id (smallint)
- model_id (int, supplied via CLI)
- embedding (vector string e.g. "[0.1,0.2,...]")
- surface (text)
- synonyms (text[] as Postgres array literal)
- keywords (text[] as Postgres array literal)

Usage example:
  python scripts/generate_agency_embeddings.py --model-id 1 \
      --output converted_data/agency_semantic_embedding.csv

Requirements:
  pip install sentence-transformers numpy
"""

from __future__ import annotations

import argparse
import csv
from collections import defaultdict
from pathlib import Path
from typing import Dict, Iterable, List, Sequence

import numpy as np
from sentence_transformers import SentenceTransformer

BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_MODEL_NAME = "intfloat/multilingual-e5-small"
DEFAULT_OUTPUT = BASE_DIR / "converted_data" / "agency_semantic_embedding.csv"
ORGANIZATION_CSV = BASE_DIR / "converted_data" / "converted_organization.csv"
AGENCY_CSV = BASE_DIR / "DB_data" / "agency.csv"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate agency semantic embeddings CSV")
    parser.add_argument("--model-id", type=int, required=True, help="embedding_model.model_id value")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="output CSV path")
    parser.add_argument("--model-name", default=DEFAULT_MODEL_NAME, help="sentence-transformers model name")
    parser.add_argument("--max-keywords", type=int, default=200, help="limit number of keywords per agency")
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
            if agency_id <= 0:
                continue
            names[agency_id] = (row.get("agency_name") or "").strip()
    if not names:
        raise RuntimeError("No agency rows loaded from agency.csv")
    return names


def read_organization_rows() -> List[Dict[str, str]]:
    if not ORGANIZATION_CSV.exists():
        raise FileNotFoundError(f"Organization CSV not found: {ORGANIZATION_CSV}")
    with ORGANIZATION_CSV.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        return [row for row in reader if row]


def aggregate_by_agency(agency_names: Dict[int, str], rows: Sequence[Dict[str, str]]) -> List[Dict]:
    buckets: Dict[int, Dict[str, set]] = defaultdict(
        lambda: {
            "bureaus": set(),
            "divisions": set(),
            "departments": set(),
            "sections": set(),
            "teams": set(),
            "units": set(),
        }
    )

    for row in rows:
        try:
            agency_id = int(row.get("agency_id") or 0)
        except ValueError:
            continue
        if agency_id <= 0:
            continue
        for key, column in (
            ("bureaus", "bureau_office"),
            ("divisions", "division"),
            ("departments", "department"),
            ("sections", "section"),
            ("teams", "team"),
            ("units", "unit"),
        ):
            value = (row.get(column) or "").strip()
            if value:
                buckets[agency_id][key].add(value)

    records: List[Dict] = []
    for agency_id, parts in buckets.items():
        agency_name = agency_names.get(agency_id, f"agency_{agency_id}")
        keywords = list({
            *parts["bureaus"],
            *parts["divisions"],
            *parts["departments"],
            *parts["sections"],
            *parts["teams"],
            *parts["units"],
        })
        sections: List[str] = [agency_name]
        if parts["bureaus"]:
            sections.append(f"関連局: {', '.join(sorted(parts['bureaus']))}")
        if parts["divisions"] or parts["departments"]:
            sections.append(
                f"関連部・課: {', '.join(sorted(parts['divisions'] | parts['departments']))}"
            )
        if parts["sections"] or parts["teams"] or parts["units"]:
            sections.append(
                f"関連組織: {', '.join(sorted(parts['sections'] | parts['teams'] | parts['units']))}"
            )
        surface = "。".join(sections) + "。"
        records.append({
            "agency_id": agency_id,
            "surface": surface,
            "keywords": keywords,
        })
    return records


def to_pg_array(values: Iterable[str]) -> str:
    items = []
    for val in values:
        escaped = val.replace("\\", "\\\\").replace("\"", "\\\"")
        items.append(f'"{escaped}"')
    return "{" + ",".join(items) + "}"


def format_embedding(vec: Sequence[float]) -> str:
    return "[" + ",".join(f"{float(x):.8f}" for x in vec) + "]"


def build_payload(records: List[Dict], model_name: str, max_keywords: int) -> List[Dict]:
    model = SentenceTransformer(model_name)
    payload: List[Dict] = []
    texts = []
    for item in records:
        keywords = item["keywords"][:max_keywords]
        kw_text = ", ".join(keywords)
        surface = item["surface"].replace("\n", " ").strip()
        if kw_text:
            text = f"{surface} キーワード: {kw_text}"
        else:
            text = surface
        texts.append(text)

    embeddings = model.encode(texts, normalize_embeddings=True, convert_to_numpy=True)
    if isinstance(embeddings, list):
        embeddings = np.asarray(embeddings)

    for item, vec in zip(records, embeddings):
        keywords = item["keywords"][:max_keywords]
        payload.append({
            "agency_id": item["agency_id"],
            "surface": item["surface"],
            "synonyms": [],
            "keywords": keywords,
            "embedding": vec.tolist(),
        })
    return payload


def write_csv(rows: List[Dict], model_id: int, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["agency_id", "model_id", "embedding", "surface", "synonyms", "keywords"])
        for row in rows:
            writer.writerow([
                row["agency_id"],
                model_id,
                format_embedding(row["embedding"]),
                row["surface"],
                to_pg_array(row["synonyms"]),
                to_pg_array(row["keywords"]),
            ])


def main() -> None:
    args = parse_args()
    agency_names = read_agency_names()
    org_rows = read_organization_rows()
    grouped = aggregate_by_agency(agency_names, org_rows)
    payload = build_payload(grouped, args.model_name, args.max_keywords)
    write_csv(payload, args.model_id, args.output)
    print(f"Wrote {len(payload)} rows to {args.output}")


if __name__ == "__main__":
    main()
