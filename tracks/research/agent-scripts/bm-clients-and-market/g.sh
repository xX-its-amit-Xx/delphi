#!/bin/bash
# usage: g.sh FILE_SUBSTRING REGEX [WIDTH]  (searches data/bm-clients-market)
cd /d/Users/ashenoy00000/delphi-work/data/bm-clients-market
f=$(ls | grep -F "$1" | head -1)
echo "## $f"
python -I ../../agents2/scripts/bm-clients-and-market/grep.py "$f" "$2" "${3:-200}"
