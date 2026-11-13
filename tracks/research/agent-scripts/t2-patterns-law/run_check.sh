#!/usr/bin/env bash
# Runs the repo checker on NarlaSpeed.lean, then on a sorry-mutated copy (must FAIL). One Lean process at a time.
H=D:/Users/ashenoy00000/delphi-work/agents2
C=D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/tracks/lean/check.sh
bash $C $H/scripts/t2-patterns-law/NarlaSpeed.lean > $H/scratch/t2-patterns-law/check_ok.txt 2>&1; echo "exit_ok=$?" >> $H/scratch/t2-patterns-law/check_ok.txt
sed 's/    linear_combination r1 \* e2 - r2 \* e1/    sorry/' $H/scripts/t2-patterns-law/NarlaSpeed.lean > $H/scratch/t2-patterns-law/NarlaSpeedMutant.lean
bash $C $H/scratch/t2-patterns-law/NarlaSpeedMutant.lean > $H/scratch/t2-patterns-law/check_mutant.txt 2>&1; echo "exit_mutant=$?" >> $H/scratch/t2-patterns-law/check_mutant.txt
