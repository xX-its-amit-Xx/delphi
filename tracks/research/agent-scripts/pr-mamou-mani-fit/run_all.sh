#!/bin/sh
# one command: fetch pages (skips ones already saved) then check quotes
cd "$(dirname "$0")" && python -I fetch.py && python -I verify.py "$@"
