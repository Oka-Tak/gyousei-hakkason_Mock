#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
VENV_DIR="${PROJECT_ROOT}/.venv"

python3 -m venv "${VENV_DIR}"
source "${VENV_DIR}/bin/activate"

pip install --quiet --upgrade pip
pip install --quiet sentence-transformers numpy

python "${PROJECT_ROOT}/scripts/generate_agency_embeddings.py" --model-id 1 "$@"

deactivate
