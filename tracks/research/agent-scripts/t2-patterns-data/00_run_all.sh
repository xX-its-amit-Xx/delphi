#!/bin/sh
# Reproduce everything for t2-patterns-data from a clean machine. Needs Python >=3.10, openpyxl 3.1.x, numpy, scipy; internet.
# Optional arg: DATA_DIR (default D:/Users/ashenoy00000/delphi-work/data/cremer2019)
set -e
D="${1:-D:/Users/ashenoy00000/delphi-work/data/cremer2019}"
H="$(dirname "$0")"
python -I "$H/01_download.py" "$D"
python -P "$H/02_analysis.py" "$D" "$H/analysis_results.json"
python -P "$H/03_fisher_baseline.py"
