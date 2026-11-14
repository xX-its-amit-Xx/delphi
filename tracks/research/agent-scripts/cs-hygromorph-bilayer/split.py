import hashlib,re,sys
rows=[l.split()[0] for l in open(__file__.replace('split.py','prereg.md'),encoding='utf-8') if re.match(r'^10\.\d+/',l)]
rows+=sys.argv[1:]
for d in rows:
    k=int(hashlib.sha256(d.lower().encode()).hexdigest(),16)%3
    print(('HOLDOUT' if k==0 else 'dev    '),d)
