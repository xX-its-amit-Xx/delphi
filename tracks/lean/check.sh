#!/usr/bin/env bash
# Run the Lean kernel over every checkable file in tracks/lean and FAIL on anything that is not a proof.
#
#   bash tracks/lean/check.sh [file.lean ...]
#
# Why a script and not "it compiled": Lean reports a proof with an error in it as depending on
# `sorryAx`, and an `#print axioms` line then prints without complaint. This is how a tidy-up that
# removed one tactic turned the headline theorem into a placeholder in this repo, and the only thing
# that showed it was the axiom line. So this script treats three things as failures:
#   1. any line containing "error"
#   2. any axiom list containing sorryAx
#   3. a theorem named in an `#print axioms` line that did not print one
# It runs against the project's own Lean toolchain and Mathlib (lean/.lake), from lean/, and writes
# nothing inside lean/ (lean/ belongs to another session).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
export PATH="${ELAN_BIN:-/c/Temp/elan/bin}:$PATH"
export ELAN_HOME="${ELAN_HOME:-C:/Temp/elan}"
FILES=("$@")
[ ${#FILES[@]} -eq 0 ] && FILES=("$HERE/HygromorphCeilingCheck.lean")

echo "toolchain: $(cat "$ROOT/lean/lean-toolchain")   mathlib: $(grep -A4 '"name": "mathlib"' "$ROOT/lean/lake-manifest.json" | grep '"rev"' | head -1 | tr -d ' ,')"
status=0
for f in "${FILES[@]}"; do
  out="$(cd "$ROOT/lean" && lake env lean "$f" 2>&1)"
  errs=$(printf '%s\n' "$out" | grep -c "error")
  sorrys=$(printf '%s\n' "$out" | grep -c "sorryAx")
  asked=$(grep -c '^#print axioms' "$f")
  printed=$(printf '%s\n' "$out" | grep -c "depends on axioms")
  printf '%-52s errors=%s sorryAx=%s axiom-lines=%s/%s\n' "$(basename "$f")" "$errs" "$sorrys" "$printed" "$asked"
  if [ "$errs" -ne 0 ] || [ "$sorrys" -ne 0 ] || [ "$asked" -ne "$printed" ]; then
    status=1
    printf '%s\n' "$out" | grep -E "error|sorryAx" | head -12
  else
    printf '%s\n' "$out" | tr '\n' ' ' | sed "s/'ThompsonLaws/\n  ThompsonLaws/g; s/'//g" | sed 's/ depends on axioms:/ <-/' | cut -c1-150
    echo
  fi
done
[ $status -eq 0 ] && echo "ALL CHECKED: no errors, no sorryAx" || echo "FAILED"
exit $status
