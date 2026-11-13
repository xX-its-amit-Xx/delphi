"""Path helper: puts the D: drive library folder on sys.path.

Install once (nothing is written to C:, pip cache disabled, temp redirected to D:):
  set TMP=D:\\Users\\ashenoy00000\\delphi-work\\agents2\\scratch\\bm-simulation-fem\\tmp
  python -m pip install --no-cache-dir --target D:\\Users\\ashenoy00000\\delphi-work\\agents2\\scratch\\bm-simulation-fem\\pylib scikit-fem==12.0.2 numpy==2.5.4 scipy==1.18.1
Override the folder with env var BM_PYLIB.
"""
import os
import sys

PYLIB = os.environ.get(
    "BM_PYLIB",
    r"D:\Users\ashenoy00000\delphi-work\agents2\scratch\bm-simulation-fem\pylib",
)
if os.path.isdir(PYLIB) and PYLIB not in sys.path:
    sys.path.insert(0, PYLIB)

OUT = os.environ.get(
    "BM_OUT",
    r"D:\Users\ashenoy00000\delphi-work\agents2\scripts\bm-simulation-fem\results",
)
os.makedirs(OUT, exist_ok=True)
