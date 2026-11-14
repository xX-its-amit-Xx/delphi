#!/usr/bin/env bash
# Bring one workflow's agent results into the repo and the dashboard bundle, with every gate.
#
#   bash tracks/scripts/integrate-fleet.sh <journal.jsonl> <agents_out_dir>
#
# Steps: journal -> one JSON per agent (the journal is the copy that counts; agent-written files can be
# stubs) -> agent-written .lean files and scripts -> holdout scrub -> every .lean through check.sh
# (files that fail are listed, never counted) -> bundle -> leak gates.
set -u
cd "$(dirname "$0")/../.."
J="$1"; SRC="$2"; NEW=()
python -I tracks/scripts/extract-journal.py "$J" tracks/research/agents || exit 1
for d in "$SRC"/*/; do
  l="$(basename "$d")"
  for f in "$d"*.lean; do [ -f "$f" ] && cp "$f" "tracks/research/lean/${l}__$(basename "$f")" && NEW+=("tracks/research/lean/${l}__$(basename "$f")"); done
  n=$(find "$d" -type f ! -name '*.lean' -size -2000k | wc -l)
  if [ "$n" -gt 0 ]; then mkdir -p "tracks/research/agent-scripts/$l"; find "$d" -maxdepth 2 -type f ! -name '*.lean' ! -name '*.zip' ! -name '*.gz' ! -name '*.html' ! -name '*.pdf' -size -2000k -exec cp {} "tracks/research/agent-scripts/$l/" \; ; fi
done
python -I tracks/scripts/scrub-holdout.py tracks/research | tail -1
echo "== lean =="
# only the files copied in this run; a file the kernel rejects is moved to failed/ so it is never counted
mkdir -p tracks/research/lean/failed
for f in "${NEW[@]}"; do
  case "$f" in *NegativeControl*) continue;; esac
  if bash tracks/lean/check.sh "$f" > /dev/null 2>&1; then echo "PASS $(basename "$f")"; else echo "FAIL $(basename "$f")"; mv "$f" tracks/research/lean/failed/; fi
done | tee -a tracks/research/lean/CHECKED.txt
echo "== build =="; node tracks/build.mjs | tail -4
echo "== gates =="; node holdout/check-leaks.mjs tracks | tail -2; node sim-engine/scales/atlas/holdout-html-scan.mjs | tail -2
