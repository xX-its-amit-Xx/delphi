#!/usr/bin/env bash
# Logged HTTP GET for the physics thread. Usage: physics/fetch.sh <tag> <url> [out-ext]
# Saves body to physics/prior-art/raw/<tag>.<ext>, appends url, time, HTTP status, bytes, sha256 to _cmdlog.txt.
# Plain GET, curl default user agent, no email/name/account parameters.
set -u
tag="$1"; url="$2"; ext="${3:-json}"
dir="$(cd "$(dirname "$0")" && pwd)/prior-art"
out="$dir/raw/$tag.$ext"
ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
code=$(curl -sL -o "$out" -w '%{http_code}' --max-time 90 "$url")
bytes=$(stat -c %s "$out" 2>/dev/null || echo 0)
sha=$(sha256sum "$out" | cut -c1-64)
printf '%s\t%s\tGET %s\thttp=%s\tbytes=%s\tsha256=%s\traw/%s.%s\n' "$ts" "$tag" "$url" "$code" "$bytes" "$sha" "$tag" "$ext" >> "$dir/_cmdlog.txt"
echo "$ts $tag http=$code bytes=$bytes"
