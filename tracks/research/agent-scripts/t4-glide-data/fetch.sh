#!/bin/sh
# Clean-machine fetch. Usage: sh fetch.sh <outdir>   (needs curl, unzip, sha256sum)
set -e
OUT=${1:-./glide-fauli}; mkdir -p "$OUT/x"; cd "$OUT"
curl -sL -A delphi-research/0.1 -o repo.zip https://codeload.github.com/jerabaul29/EffectFoldAngleAutorotatingSeeds/zip/refs/heads/master
echo "expect c9c2d6617b120bd398c4e3e8e5e1a0e8bd4a82b7dbc5d73b0a551b1205fbe51b (3065098 bytes; repo head 151df28f, 2019-07-22)"
sha256sum repo.zip; wc -c < repo.zip
cd x && unzip -qo ../repo.zip && ls
