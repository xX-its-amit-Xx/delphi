#!/usr/bin/env bash
# usage: bash check_lean.sh   (needs the repo's lean/ lake project and elan at C:/Temp/elan)
export ELAN_HOME=C:/Temp/elan PATH="/c/Temp/elan/bin:$PATH"
HERE="$(cd "$(dirname "$0")" && pwd -W 2>/dev/null || pwd)"
cd D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean && lake env lean "$HERE/HygromorphFalsifier.lean"; echo "lean exit=$?"
