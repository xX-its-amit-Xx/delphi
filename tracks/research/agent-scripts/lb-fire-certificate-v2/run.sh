#!/usr/bin/env bash
# One command: check the V2 certificate (must end ALL CHECKED) and the negative control (must FAIL).
#   bash run.sh
HERE="$(cd "$(dirname "$0")" && pwd)"
CHECK="${CHECK_SH:-D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/tracks/lean/check.sh}"
echo "== main =="
bash "$CHECK" "$HERE/FireCoatingCertificateV2.lean"; main=$?
echo "== negative control (expected: FAILED) =="
bash "$CHECK" "$HERE/FireCoatingCertificateV2NegativeControl.lean"; neg=$?
echo "== python cross-check of the direction (no-loss time vs lossy time vs sound upper bound) =="
python -I -c "
import math
C,h,q,dT=2000.,10.,20000.,300.
x=h*dT/q
print('no-loss', C*dT/q, 'lossy', -(C/h)*math.log(1-x), 'sound upper bound', C*dT/(q-h*dT))
"
if [ $main -eq 0 ] && [ $neg -ne 0 ]; then echo "RESULT: OK (main checked, control rejected)"; exit 0; fi
echo "RESULT: NOT OK (main=$main neg=$neg)"; exit 1
