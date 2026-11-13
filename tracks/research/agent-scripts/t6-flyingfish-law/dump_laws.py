import json,os,sys
R='D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/registry/'
ls=json.load(open(R+'lawsets/lawset-1.8.1.json'))
rows=[]
for e in ls['laws']:
    lid=e['law_id'];v=e['version']
    p=R+'law-versions/%s@%s.json'%(lid,v)
    if not os.path.exists(p): p=R+'laws/%s.json'%lid
    d=json.load(open(p))
    lr=d.get('lean_ref') or {}
    rows.append(dict(id=lid,ver=v,pin_status=e['status'],file_status=d.get('status'),cls=d.get('class'),kind=e['kind'],label=d.get('label'),module=lr.get('module'),theorem=lr.get('theorem'),taxa=(d.get('scope') or {}).get('taxa'),fa=(d.get('evidence') or {}).get('flyingFishAudit'),stmt=d.get('statement_en'),src=os.path.basename(p)))
json.dump(rows,open('D:/Users/ashenoy00000/delphi-work/agents2/scratch/t6-flyingfish-law/laws181.json','w'),indent=1)
for r in rows: print(r['id'],r['ver'],r['pin_status'],r['cls'],r['module'],r['theorem'],'|',r['label'][:60],'| FA' if r['fa'] else '')
print(sum(1 for r in rows if not r['theorem']),'without theorem')
