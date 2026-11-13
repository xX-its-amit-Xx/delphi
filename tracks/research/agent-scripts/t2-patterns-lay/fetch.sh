#!/bin/sh
# Re-fetch the two full texts (Europe PMC) used for quotes; run from any dir with OUT set.
OUT=${1:-.}
for p in PMC6883170 PMC8640786; do curl -s -A "delphi-research/0.1" "https://www.ebi.ac.uk/europepmc/webservices/rest/$p/fullTextXML" -o "$OUT/$p.xml"; done
