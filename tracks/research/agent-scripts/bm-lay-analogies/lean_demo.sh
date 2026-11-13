#!/usr/bin/env bash
# Runs (1) the project's Lean check of the ceiling file and (2) two deliberately false claims that Lean must refuse.
# Writes nothing inside the delphisci repo. Needs the project's elan toolchain (leanprover/lean4:v4.35.0 per lean-toolchain).
set -u
OUT=D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-lay-analogies
REPO=D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci
export PATH="/c/Temp/elan/bin:$PATH"; export ELAN_HOME="C:/Temp/elan"
{
echo "### check.sh on HygromorphCeilingCheck.lean"
( cd "$REPO" && bash tracks/lean/check.sh 2>&1 )
for f in demo_sorry demo_false; do
  echo; echo "### $f.lean (false claim: ceiling 7/5 instead of 3/2) -- Lean must report an error"
  ( cd "$REPO/lean" && lake env lean "$OUT/$f.lean" 2>&1 | cut -c1-200 | head -12 )
done
} > "$OUT/lean_check_out.txt" 2>&1
cat "$OUT/lean_check_out.txt"
