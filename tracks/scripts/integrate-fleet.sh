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
echo "== gates =="   # the exit codes are kept: a leak fails this script (the audit found they were being thrown away)
node holdout/check-leaks.mjs tracks > /tmp/gate1.$$ 2>&1; g1=$?; tail -2 /tmp/gate1.$$
node sim-engine/scales/atlas/holdout-html-scan.mjs > /tmp/gate2.$$ 2>&1; g2=$?; tail -2 /tmp/gate2.$$
for f in tracks/research/lean/*NegativeControl*.lean; do
  if bash tracks/lean/check.sh "$f" > /dev/null 2>&1; then echo "NEGATIVE CONTROL SURVIVED: $f"; g1=1; fi
done
[ "$g1" -eq 0 ] && [ "$g2" -eq 0 ] && echo "integrate: gates clean" || { echo "integrate: GATE FAILED"; exit 1; }
