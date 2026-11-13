"""s00: print the exact library versions used by every script here."""
import _env
import sys, platform
import numpy, scipy, skfem
txt = f"python {platform.python_version()} ({sys.executable}); numpy {numpy.__version__} ({numpy.__file__}); scipy {scipy.__version__}; scikit-fem {skfem.__version__}"
print(txt)
open(_env.OUT + r"\s00_versions.txt", "w").write(txt + "\n")
