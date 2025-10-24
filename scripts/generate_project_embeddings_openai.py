#!/usr/bin/env python3
"""Generate project semantic embeddings with OpenAI.

This script mirrors the data preparation flow of
``scripts/generate_project_embeddings.py`` but obtains embeddings from
OpenAI's embeddings API so that検索時のモデルと学習済みベクトルのモデルを揃えられる。

Usage example:
    python scripts/generate_project_embeddings_openai.py \
        --model-id 3 \
        --budget-year 2024 \
        --output converted_data/project_semantic_embedding_openai.csv

Requirements:
  pip install openai tqdm numpy
"""

from __future__ import annotations

import argparse
import csv
import os
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

import numpy as np
from openai import OpenAI
from tqdm import tqdm

from generate_project_embeddings import (
    BASE_DIR,
    ProjectRecord,
    build_surface,
    format_embedding,
    read_agency_names,
    read_organization_map,
    read_project_rows,
    read_related_projects,
    to_pg_array,
)

DEFAULT_OUTPUT = BASE_DIR / "converted_data" / "project_semantic_embedding_openai.csv"
DEFAULT_MODEL = "text-embedding-3-small"
DEFAULT_BATCH = 100


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate project semantic embeddings CSV with OpenAI")
    parser.add_argument("--model-id", type=int, required=True, help="embedding_model.model_id value")
    parser.add_argument("--budget-year", type=int, default=2024, help="target budget year to export")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="output CSV path")
    parser.add_argument("--openai-model", default=DEFAULT_MODEL, help="OpenAI embedding model name")
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH, help="number of texts per embedding request")
    parser.add_argument("--max-keywords", type=int, default=64, help="limit number of keywords per project")
    parser.add_argument(
        "--api-key-env",
        default="OPENAI_API_KEY",
        help="Environment variable that stores the OpenAI API key (default: OPENAI_API_KEY)",
    )
    parser.add_argument(
        "--api-key-file",
        type=Path,
        default=None,
        help="Optional file path from which to read the OpenAI API key (first line is used)",
    )
    return parser.parse_args()


def resolve_api_key(args: argparse.Namespace) -> str:
    if args.api_key_file:
        if not args.api_key_file.exists():
            raise FileNotFoundError(f"APIキー ファイルが見つかりません: {args.api_key_file}")
        with args.api_key_file.open("r", encoding="utf-8") as f:
            key = f.readline().strip()
            if key:
                return key
    env_key = os.getenv(args.api_key_env, "").strip()
    if env_key:
        return env_key
    raise RuntimeError(
        "OpenAI APIキーが見つかりません。環境変数を設定するか --api-key-file で指定してください。"
    )


def prepare_texts(
    records: List[ProjectRecord],
    org_map: Dict[int, Dict[str, str]],
    related_map: Dict[Tuple[int, int], List[Tuple[str, str]]],
    max_keywords: int,
) -> Tuple[List[str], List[str], List[List[str]]]:
    surfaces: List[str] = []
    keywords_list: List[List[str]] = []
    texts: List[str] = []
    for record in records:
        org = org_map.get(record.organization_id)
        related = related_map.get((record.project_id, record.budget_year), [])
        surface, keywords = build_surface(record, org, related)
        trimmed_keywords = keywords[:max_keywords]
        surfaces.append(surface)
        keywords_list.append(trimmed_keywords)
        if trimmed_keywords:
            text = f"{surface} キーワード: {', '.join(trimmed_keywords)}"
        else:
            text = surface
        texts.append(text.replace("\n", " ").strip())
    return texts, surfaces, keywords_list


def batched(iterable: Iterable[str], batch_size: int) -> Iterable[List[str]]:
    batch: List[str] = []
    for item in iterable:
        batch.append(item)
        if len(batch) >= batch_size:
            yield batch
            batch = []
    if batch:
        yield batch


def embed_texts(client: OpenAI, model: str, texts: List[str], batch_size: int) -> np.ndarray:
    embeddings: List[List[float]] = []
    for chunk in tqdm(list(batched(texts, batch_size)), desc="Embedding", unit="batch"):
        response = client.embeddings.create(model=model, input=chunk)
        embeddings.extend([item.embedding for item in response.data])
    array = np.asarray(embeddings, dtype="float32")
    if array.shape[0] != len(texts):
        raise RuntimeError("Embedding件数がテキスト件数と一致しません")
    return array


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
                to_pg_array(row.get("synonyms", [])),
                to_pg_array(row.get("keywords", [])),
            ])


def main() -> None:
    args = parse_args()
    api_key = resolve_api_key(args)
    client = OpenAI(api_key=api_key)

    agency_names = read_agency_names()
    org_map = read_organization_map(agency_names)
    project_records = read_project_rows(args.budget_year)
    related_map = read_related_projects(args.budget_year)

    texts, surfaces, keywords_list = prepare_texts(project_records, org_map, related_map, args.max_keywords)
    embeddings = embed_texts(client, args.openai_model, texts, args.batch_size)

    rows = []
    for record, surface, keywords, vec in zip(project_records, surfaces, keywords_list, embeddings):
        rows.append({
            "project_id": record.project_id,
            "budget_year": record.budget_year,
            "surface": surface,
            "synonyms": [],
            "keywords": keywords,
            "embedding": vec.tolist(),
        })

    write_csv(rows, args.model_id, args.output)
    print(f"Wrote {len(rows)} rows to {args.output}")


if __name__ == "__main__":
    main()

