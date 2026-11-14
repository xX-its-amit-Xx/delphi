"""Append one `#print axioms` line per theorem to Lean files that have none.

    python -I tracks/scripts/add-axiom-audit.py file.lean [...]

The strict checker (tracks/lean/check.sh) refuses a file with no audit line. This does not make a file
pass: it only makes Lean print what each theorem depends on, so check.sh can see a sorry or a stray axiom.
Handles one flat namespace per file (the shape the agents write); anything else is left alone and reported.
"""
import pathlib, re, sys
for a in sys.argv[1:]:
    p = pathlib.Path(a); s = p.read_text(encoding='utf-8')
    if re.search(r'^#print axioms', s, re.M):
        print('has audit lines already:', p.name); continue
    ns = re.findall(r'^namespace\s+(\S+)', s, re.M)
    if len(ns) > 1:
        print('more than one namespace, left alone:', p.name); continue
    names = re.findall(r'^\s*(?:private |protected )?(?:theorem|lemma)\s+(\S+)', s, re.M)
    pre = ns[0] + '.' if ns else ''
    s = s.rstrip('\n') + '\n\n-- axiom audit lines added by tracks/scripts/add-axiom-audit.py\n' + ''.join(f'#print axioms {pre}{n}\n' for n in names)
    p.write_bytes(s.encode('utf-8')); print('added', len(names), 'audit lines:', p.name)
