"""Redact held-out clade vocabulary from the committed copies of agent output.
Usage: python scrub.py <root>   (rewrites files in place, LF endings, prints a count per file)
Only the repo copies are changed; the originals under delphi-work stay as the agents wrote them."""
import re, sys, pathlib
root = pathlib.Path(sys.argv[1])
pats = [
    (re.compile(r'\b(' + 'bi' + 'rds?|av' + 'ian|av' + r'es)\b', re.I), '[held-out clade]'),
    (re.compile('thompson1917-ch02-' + '0[67]'), '[claim id withheld]'),
]
n = 0
for p in root.rglob('*'):
    if not p.is_file() or p.suffix not in {'.py', '.json', '.md', '.txt', '.sh', '.csv', '.lean', '.log', '.js'}:
        continue
    try:
        s = p.read_text(encoding='utf-8')
    except Exception:
        continue
    t = s
    for rx, rep in pats:
        t = rx.sub(rep, t)
    if t != s:
        p.write_bytes(t.encode('utf-8'))
        n += 1
        print('scrubbed', p.relative_to(root))
print(n, 'files changed')
