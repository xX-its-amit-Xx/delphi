#!/usr/bin/env bash
# Wait for OpenAlex's free daily budget to come back, then run complete-corpus.py once.
# Stops after 4 hours whatever happens, so it cannot loop forever.
cd "$(dirname "$0")/../.."
end=$(( $(date +%s) + 14400 ))
while [ "$(date +%s)" -lt "$end" ]; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -A "delphi-tracks/0.1 (literature survey)" \
    "https://api.openalex.org/works?filter=author.id:A5011504360&per-page=1&select=id")
  if [ "$code" = "200" ]; then
    PYTHONIOENCODING=utf-8 python tracks/scripts/complete-corpus.py && echo "COMPLETE-CORPUS-DONE" && exit 0
    echo "script failed; stopping"; exit 1
  fi
  sleep 300
done
echo "gave up after 4 hours; budget never returned"; exit 2
