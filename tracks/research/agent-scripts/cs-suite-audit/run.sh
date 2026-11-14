#!/usr/bin/env bash
# One command, from a clean folder:   bash run.sh
# Regenerates the toy cases, gates them, runs the gate's self-test, and the sabotaged self-test.
# Expected exit codes are checked; the script exits 0 only if every one is as expected.
cd "$(dirname "$0")" || exit 2
rm -rf toy-cases; ok=0
expect() { want=$1; shift; "$@"; got=$?; if [ "$got" -eq "$want" ]; then echo "[exit $got, as expected]"; else echo "[exit $got, EXPECTED $want]"; ok=1; fi; echo; }
echo "== make toy cases ==";                 expect 0 node suite-gate.mjs --make-toy toy-cases
echo "== gate: good case only ==";           expect 0 node suite-gate.mjs toy-cases/good
echo "== gate: bad case only ==";            expect 1 node suite-gate.mjs toy-cases/bad
echo "== gate: both ==";                     expect 1 node suite-gate.mjs toy-cases
echo "== self-test (--fail-once) ==";        expect 0 node suite-gate.mjs --fail-once
echo "== self-test with rule P3 off ==";     expect 1 node suite-gate.mjs --fail-once --sabotage P3
exit $ok
