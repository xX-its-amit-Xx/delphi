#!/usr/bin/env bash
# Reproduces every Lean result of bm-lean-materials-laws. One Lean process at a time.
# Expected: VoigtReuss, EulerBucklingStrip, TimoshenkoCeilingUnique pass (exit 0); NegativeControl FAILS (exit 1, shows sorryAx).
HERE="$(cd "$(dirname "$0")" && pwd)"
CHECK=D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/tracks/lean/check.sh
for f in VoigtReuss EulerBucklingStrip TimoshenkoCeilingUnique NegativeControl; do
  echo "=== $f"; bash "$CHECK" "$HERE/$f.lean"; echo "exit=$?"
done
