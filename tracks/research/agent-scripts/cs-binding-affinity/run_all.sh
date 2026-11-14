#!/usr/bin/env bash
# One command, clean folder: bash run_all.sh [raw_dir]
# Needs python with numpy + rdkit. Downloads about 30 MB from the ChEMBL REST API (no key).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
RAW="${1:-C:/Temp/delphi-sprint/cs-binding-affinity/raw}"
python -I "$HERE/targets.py"
python -I "$HERE/fetch.py" "$RAW"
python "$HERE/analyze.py" "$RAW" --stage dev   > "$HERE/dev_output.txt"
python "$HERE/analyze.py" "$RAW" --stage final > "$HERE/final_output.txt"
tail -n +1 "$HERE/final_output.txt"
