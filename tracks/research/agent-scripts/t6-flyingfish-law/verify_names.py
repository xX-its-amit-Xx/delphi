import json,re,os
L='D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/'
rows=json.load(open('D:/Users/ashenoy00000/delphi-work/agents2/scratch/t6-flyingfish-law/laws181.json'))
for r in rows:
    if not r['theorem']: continue
    p=L+r['module']; txt=open(p,encoding='utf8').read()
    short=r['theorem'].split('.')[-1]
    # namespace-agnostic: declaration with that short name
    m=re.search(r'(theorem|lemma)\s+'+re.escape(short)+r'\b',txt)
    print('OK ' if m else 'MISSING',r['id'],r['theorem'],'line',(txt[:m.start()].count('\n')+1) if m else '-')
