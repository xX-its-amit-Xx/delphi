#!/usr/bin/env bash
# One command: bash run.sh
# 1. checks every row of sources.json carries a status and a source, writes table.md
# 2. checks LinkerBilayer.lean with a bare lean binary (no Mathlib)
# 3. checks NegativeControl.lean FAILS
set -u
here="$(cd "$(dirname "$0")" && pwd)"
LEAN="${LEAN:-$(ls /c/Temp/elan/toolchains/*/bin/lean.exe 2>/dev/null | head -1)}"
LEAN="${LEAN:-lean}"
python -I "$here/build_table.py" "$here/sources.json" "$here/table.md" || exit 1
if [ ! -x "$LEAN" ] && ! command -v "$LEAN" >/dev/null 2>&1; then
  echo "LEAN: not found at $LEAN (set LEAN=...). Lean files UNCHECKED."; exit 2
fi
if "$LEAN" "$here/LinkerBilayer.lean"; then echo "LEAN: LinkerBilayer.lean PASS"; else echo "LEAN: LinkerBilayer.lean FAIL"; exit 1; fi
if "$LEAN" "$here/NegativeControl.lean" >/dev/null 2>&1; then echo "LEAN: negative control PASSED (BAD)"; exit 1; else echo "LEAN: negative control fails as it must"; fi
if grep -n -E "sorry|^axiom " "$here/LinkerBilayer.lean"; then echo "LEAN: sorry/axiom present"; exit 1; fi
echo "ALL OK"
