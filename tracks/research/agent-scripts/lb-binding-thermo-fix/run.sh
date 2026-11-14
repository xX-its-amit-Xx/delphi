#!/usr/bin/env bash
# One command: check the repaired file (must end ALL CHECKED) and the negative control (must FAIL).
HERE="$(cd "$(dirname "$0")" && pwd)"
CHECK="D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/tracks/lean/check.sh"
bash "$CHECK" "$HERE/BindingThermo.lean" | tee "$HERE/check_main.txt"
main=${PIPESTATUS[0]}
bash "$CHECK" "$HERE/BindingThermoNegativeControl.lean" | tee "$HERE/check_negative.txt"
neg=${PIPESTATUS[0]}
if [ "$main" -eq 0 ] && [ "$neg" -ne 0 ]; then echo "RESULT: main ALL CHECKED, negative control REJECTED (as required)"; exit 0; fi
echo "RESULT: NOT OK (main exit=$main, negative exit=$neg; want 0 and non-zero)"; exit 1
