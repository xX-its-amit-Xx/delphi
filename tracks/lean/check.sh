#!/usr/bin/env bash
# Run the Lean kernel over Lean files and FAIL on anything that is not an audited proof.
#
#   bash tracks/lean/check.sh [file.lean ...]      default: tracks/lean/HygromorphCeilingCheck.lean
#   bash tracks/lean/check.sh --probes             the deliberately bad files in probes/ must all be REJECTED
#
# Why a script and not "it compiled": Lean reports a proof with an error in it as depending on
# `sorryAx`, and an `#print axioms` line then prints without complaint. This is how a tidy-up that
# removed one tactic turned the headline theorem into a placeholder in this repo.
#
# Version 2 (2026-11-13). An audit (tracks/research/agents/cs-suite-audit.json) showed version 1 said
# "ALL CHECKED" for four kinds of non-proof. Each is now a failure:
#   A. no toolchain: "lake: command not found" contains no "error", so nothing was checked and it passed
#   B. `sorry` with no `#print axioms` line: Lean only warns ("declaration uses `sorry`")
#   C. a result assumed with a hand-written `axiom` (only sorryAx was refused): axioms outside the
#      standard three are now rejected
#   D. an empty file, or one with no `#print axioms` line at all (0 asked = 0 printed)
# Still failures as before: any "error", any sorryAx, an `#print axioms` line that did not print.
# Reported, not failed: theorems with no `#print axioms` line of their own (count shown).
# NOT caught by any script: a theorem whose hypotheses contradict each other is kernel-valid and says
# nothing (probes/ProbeVacuous.lean). That needs a reader.
#
# Runs against the project's own toolchain and Mathlib (lean/.lake), from lean/, and writes nothing
# inside lean/ (lean/ belongs to another session).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
export PATH="${ELAN_BIN:-/c/Temp/elan/bin}:$PATH"
export ELAN_HOME="${ELAN_HOME:-C:/Temp/elan}"
ALLOWED='propext|Classical.choice|Quot.sound'

if ! command -v lake >/dev/null 2>&1; then echo "FAILED: no Lean toolchain (lake not on PATH). Nothing was checked."; exit 3; fi

check_one() {
  local f="$1" why="" out rc asked printed thms extra note=""
  case "$f" in /*|[A-Za-z]:*) ;; *) f="$(cd "$(dirname "$f")" && pwd)/$(basename "$f")" ;; esac
  out="$(cd "$ROOT/lean" && lake env lean "$f" 2>&1)"; rc=$?
  asked=$(grep -c '^#print axioms' "$f")
  printed=$(printf '%s\n' "$out" | grep -cE "depends on axioms|does not depend on any axioms")
  thms=$(grep -cE '^[[:space:]]*(private |protected )?(theorem|lemma) ' "$f")
  [ "$rc" -ne 0 ] && why="$why lean-exit-$rc;"
  # Lean writes "file:line:col: error: ..." or "error(code): ..."; a bare word match rejected a valid
  # theorem NAMED fold_error_squares. A non-zero Lean exit is still a failure on its own (above).
  printf '%s\n' "$out" | grep -qE "(^|: )error[:(]" && why="$why error;"
  printf '%s\n' "$out" | grep -qE "sorryAx|declaration uses" && why="$why sorry;"
  [ "$asked" -eq 0 ] && why="$why no-axiom-audit;"
  [ "$asked" -ne "$printed" ] && why="$why axiom-lines-$printed/$asked;"
  extra=$(printf '%s\n' "$out" | tr '\n' ' ' | grep -oE "depends on axioms: \[[^]]*\]" | sed 's/depends on axioms: \[//; s/\]//' | tr ',' '\n' | sed 's/^ *//; s/ *$//' | grep -vE "^($ALLOWED)$" | grep -v '^$' | sort -u | tr '\n' ' ')
  [ -n "$extra" ] && why="$why extra-axioms:[${extra% }];"
  [ "$thms" -gt "$asked" ] && note=" (NOTE: $((thms - asked)) of $thms theorems have no #print axioms line)"
  if [ -n "$why" ]; then
    printf 'REJECTED %-50s%s%s\n' "$(basename "$f")" "$why" "$note"
    printf '%s\n' "$out" | grep -E "(^|: )error[:(]|sorryAx|declaration uses" | head -8
    return 1
  fi
  printf 'CHECKED  %-50s theorems=%s audited=%s%s\n' "$(basename "$f")" "$thms" "$asked" "$note"
  return 0
}

if [ "${1:-}" = "--probes" ]; then
  bad=0
  for p in ProbeSorryNoPrint ProbeCustomAxiom ProbeEmpty ProbeHonestSorry; do
    if check_one "$HERE/probes/$p.lean" >/dev/null; then echo "SURVIVOR: probes/$p.lean was accepted and must be rejected"; bad=1; else echo "rejected as required: $p"; fi
  done
  check_one "$HERE/probes/ProbeVacuous.lean" >/dev/null && echo "accepted, as expected: ProbeVacuous (kernel-valid, contradictory hypotheses; no script catches this)"
  [ $bad -eq 0 ] && echo "PROBES OK: 4 of 4 bad files rejected" || echo "PROBES FAILED"
  exit $bad
fi

FILES=("$@")
[ ${#FILES[@]} -eq 0 ] && FILES=("$HERE/HygromorphCeilingCheck.lean")
echo "toolchain: $(cat "$ROOT/lean/lean-toolchain")   mathlib: $(grep -A4 '"name": "mathlib"' "$ROOT/lean/lake-manifest.json" | grep '"rev"' | head -1 | tr -d ' ,')"
status=0
for f in "${FILES[@]}"; do check_one "$f" || status=1; done
[ $status -eq 0 ] && echo "ALL CHECKED: no errors, no sorry, axioms within [$ALLOWED]" || echo "FAILED"
exit $status
