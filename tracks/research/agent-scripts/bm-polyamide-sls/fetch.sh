#!/bin/sh
# usage: fetch.sh URL outname  -> downloads to data dir, logs url/date/size/sha256 to MANIFEST.tsv
D=/d/Users/ashenoy00000/delphi-work/data/bm-polyamide
curl -sL -A "delphi-research/0.1" --max-filesize 30000000 -o "$D/$2" "$1"
printf '%s\t%s\t%s\t%s\t%s\n' "$1" "$(date -u +%F)" "$(wc -c < "$D/$2")" "$(sha256sum "$D/$2" | cut -d' ' -f1)" "$2" >> "$D/MANIFEST.tsv"
tail -1 "$D/MANIFEST.tsv"
