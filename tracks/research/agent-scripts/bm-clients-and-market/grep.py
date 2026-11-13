"""Strip tags from a saved page and print sentences matching a regex.  Usage: python -I grep.py FILE REGEX [WIDTH]"""
import sys; sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import re, html
t = open(sys.argv[1], encoding='utf-8', errors='replace').read()
t = re.sub(r'(?is)<(script|style|noscript).*?</\1>', ' ', t)
t = re.sub(r'(?s)<[^>]+>', ' ', t); t = html.unescape(t); t = re.sub(r'\s+', ' ', t)
w = int(sys.argv[3]) if len(sys.argv) > 3 else 200
for m in re.finditer(sys.argv[2], t, re.I):
    s = max(0, m.start()-w); print('...', t[s:m.end()+w], '...\n')
