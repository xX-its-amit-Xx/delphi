#!/bin/bash
# Convert every saved TDS PDF to plain text (reading order) for sentence quotes. Needs poppler pdftotext.
S=/d/Users/ashenoy00000/delphi-work/agents2/scratch/bm-formlabs-all-resins
mkdir -p $S/txtraw
for f in /d/Users/ashenoy00000/delphi-work/data/formlabs-tds/*.pdf; do b=$(basename $f .pdf); pdftotext $f $S/txtraw/$b.txt; done
