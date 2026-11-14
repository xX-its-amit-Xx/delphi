#!/usr/bin/env bash
# PROPOSED replacement for tracks/lean/check.sh (not applied; the repo is read-only for this agent).
#
#   DELPHI_ROOT=<repo> bash check-strict.sh file.lean [...]
#   bash check-strict.sh --probes        run on lean-probes/: 4 must be REJECTED, 1 flagged, exit 0 only if so
#
# Closes five holes found by probing the current check.sh (see lean-probes/ and check-sh-probe-output.txt):
#   A. no toolchain: "lake: command not found" has no "error" in it, so a file with no #print line passed
#   B. `sorry` with no `#print axioms` line: Lean only WARNS ("declaration uses `sorry`"), so it passed
#   C. a result assumed with `axiom` and then "proved" from it passed (only sorryAx was refused)
#   D. an empty file, or one with no `#print axioms` at all, passed (0 asked = 0 printed)
#   E. theorems with no `#print axioms` line of their own were never audited
# Not closed here, needs a human or a second check: a theorem whose hypotheses contradict each other
# (ProbeVacuous) is kernel-valid and says nothing. It is printed as a reminder, not failed.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="${DELPHI_ROOT:-D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci}"
export PATH="${ELAN_BIN:-/c/Temp/elan/bin}:$PATH"
export ELAN_HOME="${ELAN_HOME:-C:/Temp/elan}"
ALLOWED='propext|Classical.choice|Quot.sound'

check_one() {
  local f="$1" why=""
  case "$f" in /*|[A-Za-z]:*) ;; *) f="$(cd "$(dirname "$f")" && pwd)/$(basename "$f")" ;; esac
  local out rc
  out="$(cd "$ROOT/lean" && lake env lean "$f" 2>&1)"; rc=$?
  local asked printed thms
  asked=$(grep -c '^#print axioms' "$f")
  printed=$(printf '%s\n' "$out" | grep -cE "depends on axioms|does not depend on any axioms")
  thms=$(grep -cE '^[[:space:]]*(private |protected )?(theorem|lemma) ' "$f")
  [ "$rc" -ne 0 ] && why="$why lean-exit-$rc;"
  printf '%s\n' "$out" | grep -q "error" && why="$why error;"
  printf '%s\n' "$out" | grep -qE "sorryAx|declaration uses" && why="$why sorry;"
  [ "$asked" -eq 0 ] && why="$why no-axiom-audit;"
  [ "$asked" -ne "$printed" ] && why="$why axiom-lines-$printed/$asked;"
  # every axiom named in the output must be on the allow-list
  local extra
  extra=$(printf '%s\n' "$out" | tr '\n' ' ' | grep -oE "depends on axioms: \[[^]]*\]" | sed 's/depends on axioms: \[//; s/\]//' | tr ',' '\n' | sed 's/^ *//; s/ *$//' | grep -vE "^($ALLOWED)$" | grep -v '^$' | sort -u | tr '\n' ' ')
  [ -n "$extra" ] && why="$why extra-axioms:[${extra% }];"
  local note=""
  [ "$thms" -gt "$asked" ] && note=" (NOTE: $((thms - asked)) of $thms theorems have no #print axioms line)"
  if [ -n "$why" ]; then printf 'REJECTED %-34s%s%s\n' "$(basename "$f")" "$why" "$note"; return 1
  else printf 'CHECKED  %-34s theorems=%s audited=%s%s\n' "$(basename "$f")" "$thms" "$asked" "$note"; return 0; fi
}

if ! command -v lake >/dev/null 2>&1; then echo "FAILED: no Lean toolchain (lake not on PATH). Nothing was checked."; exit 3; fi

if [ "${1:-}" = "--probes" ]; then
  bad=0
  for p in ProbeSorryNoPrint ProbeCustomAxiom ProbeEmpty ProbeHonestSorry; do
    if check_one "$HERE/lean-probes/$p.lean"; then echo "  ^ SURVIVOR: this probe must be rejected"; bad=1; fi
  done
  check_one "$HERE/lean-probes/ProbeVacuous.lean" && echo "  ^ expected: kernel-valid but vacuous (contradictory hypotheses); no script here can catch it"
  [ $bad -eq 0 ] && echo "probes: 4 of 4 bad files rejected" || echo "probes: SURVIVORS"
  exit $bad
fi

status=0
for f in "$@"; do check_one "$f" || status=1; done
[ $# -eq 0 ] && { echo "FAILED: no files given. Nothing was checked."; exit 2; }
[ $status -eq 0 ] && echo "ALL CHECKED: no errors, no sorry, axioms within [$ALLOWED]" || echo "FAILED"
exit $status
