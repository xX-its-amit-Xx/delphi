#!/bin/sh
# Run from this folder. Python 3.14.2, numpy 2.5.3, scipy 1.18.1 (installed in user site-packages; scripts add it to sys.path because of python -I).
sh 00_download.sh
python -I 02_build_matrix.py
python -I 03_analysis.py 0.01 2 1000 main
python -I 03_analysis.py 0.03 2 300 c0.03
python -I 03_analysis.py 0.003 2 300 c0.003
python -I 03_analysis.py 0.01 3 300 z3
python -I 04_active_subset.py
