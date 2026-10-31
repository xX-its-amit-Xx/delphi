#!/usr/bin/env bash
# Logged literature search for the physics thread. Usage: physics/search.sh <tag> <openalex|pubmed> [orx options...] "<query>"
# Appends one line per call to physics/prior-art/_cmdlog.txt and writes raw output to physics/prior-art/raw/<tag>.json.
# run_identifier is null: `orx discover` issues none. No email, name or account id is sent (NCBI_EMAIL unset).
set -u
unset NCBI_EMAIL
ORX="$HOME/.cargo/bin/orx"
tag="$1"; src="$2"; shift 2
dir="$(cd "$(dirname "$0")" && pwd)/prior-art"
out="$dir/raw/$tag.json"
ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
"$ORX" discover "$src" --no-telemetry "$@" > "$out" 2> "$dir/raw/$tag.err"
rc=$?
n=$(python -I -c "import json,sys
try:
  print(len(json.load(open(sys.argv[1],encoding='utf-8'))))
except Exception as e: print('parse-error')" "$out")
printf '%s\t%s\torx discover %s --no-telemetry %s\texit=%s\thits=%s\traw/%s.json\n' "$ts" "$tag" "$src" "$*" "$rc" "$n" "$tag" >> "$dir/_cmdlog.txt"
echo "$ts $tag exit=$rc hits=$n"
