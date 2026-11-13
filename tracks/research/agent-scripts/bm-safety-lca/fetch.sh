#!/bin/bash
# Fetch pages into data/safety-lca and log URL, date, size, sha256 to MANIFEST.tsv
cd /d/Users/ashenoy00000/delphi-work/data/safety-lca || exit 1
while read -r name url; do
  [ -z "$name" ] && continue
  [ -s "$name" ] || curl -sL -m 60 -A "delphi-research/0.1" -o "$name" "$url"
  printf '%s\t%s\t%s\t%s\t%s\n' "$url" "$name" "$(stat -c %s "$name")" "$(sha256sum "$name"|cut -d' ' -f1)" "$(date -u +%FT%TZ)" >> MANIFEST.tsv.new
done
sort -u MANIFEST.tsv.new -o MANIFEST.tsv; rm -f MANIFEST.tsv.new
