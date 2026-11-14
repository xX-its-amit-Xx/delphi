#!/usr/bin/env bash
# One command: bash run.sh   Re-downloads the three open full texts, re-checks every quoted number is
# still in the text, rescores, and re-checks the Lean file.
HERE="$(cd "$(dirname "$0")" && pwd)"; RAW="${RAW:-C:/Temp/delphi-sprint/cs-xenobots/raw}"; mkdir -p "$RAW"
for p in PMC6994979 PMC8670470 PMC10811512; do
  [ -s "$RAW/$p.xml" ] || curl -s -m 90 "https://www.ebi.ac.uk/europepmc/webservices/rest/$p/fullTextXML" -o "$RAW/$p.xml"
  python -I "$HERE/xml2txt.py" "$RAW/$p.xml" "$RAW/$p.txt"
done
python -I "$HERE/verify_quotes.py" "$RAW" && python -I "$HERE/score.py" && bash "$HERE/check_lean.sh"
