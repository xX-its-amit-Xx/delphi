#!/usr/bin/env bash
# Clean-machine run. Needs Python >= 3.11 with: pip install numpy pandas scipy openpyxl matplotlib   (tested: py 3.14.2, numpy 2.5.3, pandas 3.0.6, scipy 1.18.1, openpyxl 3.1.5, matplotlib 3.11.2)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
DATA="${1:-$HERE/data}"          # put data on a large drive, e.g. D:/.../data/t3-vasquez
mkdir -p "$DATA/code"
python -P "$HERE/01_fetch.py" "$DATA/vasquez"            # downloads 1.9 MB zip, checks sha256, writes MANIFEST.json
python -P "$HERE/02_reproduce.py" "$DATA/vasquez"        # prints every reproduced number, writes results.json
# optional: the authors' vertex-model code (MIT, 31,238 bytes, github tree sha 9dd450eb58dff250c33445295a4db7169e10c7ee)
curl -sL -A "delphi-research/0.1" -o "$DATA/code/lumen_vm.py" https://raw.githubusercontent.com/AlexDunnLab/lumen-shape/main/lumen_vm.py
echo "expect c3616021be9dfb957cfd82aab3df204eaac14000786ff851dc3ded185d14362e"; sha256sum "$DATA/code/lumen_vm.py"
python -P "$HERE/03b_diagnose_lumen_vm.py" "$DATA/code"  # shows A0=nan for default jitter
python -P "$HERE/03_run_lumen_vm.py" "$DATA/code" "$DATA/run1" 1   # ~100 s, one process
python -P "$HERE/04_compare_sim.py" "$DATA/run1/run.json" "$DATA/vasquez"
