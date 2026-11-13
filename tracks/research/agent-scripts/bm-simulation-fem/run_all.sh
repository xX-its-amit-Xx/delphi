#!/bin/sh
# Reproduce everything (Git Bash on Windows). Total run time about 6 minutes on 1 core.
# 0) one-time install, entirely on D: (pip cache off, temp on D:):
#    export TMP='D:\Users\ashenoy00000\delphi-work\agents2\scratch\bm-simulation-fem\tmp' TEMP="$TMP"
#    python -m pip install --no-cache-dir --target 'D:\Users\ashenoy00000\delphi-work\agents2\scratch\bm-simulation-fem\pylib' scikit-fem==12.0.2 numpy==2.5.4 scipy==1.18.1
cd "$(dirname "$0")"
python s00_versions.py
python s01_timoshenko_check.py
python s02_sweep_2d.py
python s03_length_mesh.py
python s04_width_3d.py        # about 2 min
python s05_nonlinear_plate.py # about 3 min
python s05b_ritz_convergence.py
python s06_extreme_contrast.py
python s07_design_numbers.py
python s08_verify_citations.py # needs internet
