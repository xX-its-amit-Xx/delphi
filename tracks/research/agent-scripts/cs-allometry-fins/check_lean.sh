#!/usr/bin/env bash
# Checks StrouhalBainbridge.lean against the repo's Mathlib, then confirms a deliberately false
# variant is rejected. Usage: bash check_lean.sh
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
LEANDIR="${LEANDIR:-D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean}"
TMP="${TMP_LEAN:-C:/Temp/delphi-sprint/cs-allometry-fins}"
export ELAN_HOME="${ELAN_HOME:-C:/Temp/elan}"; export PATH="/c/Temp/elan/bin:$PATH"
mkdir -p "$TMP"; cp "$HERE/StrouhalBainbridge.lean" "$TMP/SB.lean"
cd "$LEANDIR" || exit 2
if lake env lean "$TMP/SB.lean" > "$TMP/sb.log" 2>&1 && ! grep -q -E "error|sorry" "$TMP/sb.log"; then echo "PASS StrouhalBainbridge.lean"; else echo "FAIL StrouhalBainbridge.lean"; tail -5 "$TMP/sb.log"; fi
# negative control: claim the floor with the inequality reversed
cat "$HERE/StrouhalBainbridge.lean" > "$TMP/SBneg.lean"
cat >> "$TMP/SBneg.lean" <<'L'

theorem StrouhalBainbridge.false_floor (a b α u : ℝ) (ha : 0 < a) (hα : 0 < α) (hu : 0 < u) :
    α * (b + a / u) ≤ α * b := by
  have h : 0 ≤ a / u := div_nonneg ha.le hu.le
  nlinarith [mul_nonneg hα.le h]
L
if lake env lean "$TMP/SBneg.lean" > "$TMP/sbneg.log" 2>&1; then echo "BROKEN: false variant accepted"; else echo "PASS negative control (false variant rejected)"; fi
