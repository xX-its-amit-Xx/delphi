#!/usr/bin/env bash
# One command: bash check_lean.sh   (needs elan at C:/Temp/elan or ELAN_BIN set). Core Lean only.
HERE="$(cd "$(dirname "$0")" && pwd)"
export PATH="${ELAN_BIN:-/c/Temp/elan/bin}:$PATH"; export ELAN_HOME="${ELAN_HOME:-C:/Temp/elan}"
TC="${LEAN_TC:-leanprover/lean4:v4.35.0}"
cd "$HERE"
out="$(lean +$TC XenobotBounds.lean 2>&1)"; rc=$?
echo "$out"
if [ $rc -eq 0 ] && ! echo "$out" | grep -q "error\|sorryAx"; then echo "PASS XenobotBounds.lean"; else echo "FAIL XenobotBounds.lean"; fi
neg="$(lean +$TC XenobotNegativeControl.lean 2>&1)"; nrc=$?
if [ $nrc -ne 0 ] && echo "$neg" | grep -q "error"; then echo "PASS negative control rejected"; else echo "FAIL negative control was accepted"; fi
