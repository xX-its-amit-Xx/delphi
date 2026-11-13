#!/usr/bin/env bash
# Clean-machine recipe: Python >= 3.10, curl, sha256sum, md5sum, pdftotext (poppler or xpdf 4.00).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
export DATA="${DATA:-$HOME/delphi-work/data/flyingfish}"
export OUT="${OUT:-$HERE/repro_results.json}"
bash "$HERE/fetch.sh"
# The two files that cannot be fetched by curl must be placed by hand (see fetch.sh):
#   $DATA/daane2021/daane2021_data_s1_mmc2.xlsx   sha256 1ac98650f493036218837d235ed4451ff096d926fa50b797dcea4fc7fca52279
#   $DATA/parkchoi2010-cached/wb-park-choi-2010.pdf sha256 ef77375e5e8282975e56f4ecfa8a7aae7c81c34712041303ac1ca09a864a7de3
python -I "$HERE/repro.py"
