#!/bin/sh
# Re-run: vocabulary gap check on the .life/.organism format files, and Crossref check of the two xenobot DOIs.
R=D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/organism-format
echo "locomotion/sensor vocabulary hits (expect none):"
grep -n -i -E "locomot|swim|optogen|sensor|actuat|behav|stimul|kinemat|photo" $R/spec.mjs $R/life/spec.mjs $R/life/README.md $R/README.md $R/examples/winged-zebrafish.organism $R/life/examples/mouse-preimplantation.life | grep -v -i "sensory" | head
for d in 10.1126/scirobotics.abf1571 10.1073/pnas.1910837117; do curl -s -A "delphi-research/0.1" "https://api.crossref.org/works/$d" | python -c "import sys,json;m=json.load(sys.stdin)['message'];print(m['DOI'],'|',m['title'][0])"; done
