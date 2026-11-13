import json,os,sys
R='D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/registry/'
ls=json.load(open(R+'lawsets/lawset-1.8.1.json',encoding='utf-8'))
out=[]
for p in ls['laws']:
    f=R+'laws/'+p['law_id']+'.json'
    d=json.load(open(f,encoding='utf-8')) if os.path.exists(f) else {}
    lr=d.get('lean_ref') or {}
    out.append(dict(id=p['law_id'],ver=p['version'],status=p['status'],kind=p['kind'],label=d.get('label'),module=lr.get('module'),theorem=lr.get('theorem'),taxa=(d.get('scope') or {}).get('taxa')))
for o in out: print(o['id'],'|',o['ver'],'|',o['status'],'|',(o['label'] or '')[:110],'|',o['module'],'|',o['theorem'])
print(len(out), 'no theorem:',[o['id'] for o in out if not o['theorem']])
json.dump(out,open(sys.argv[1],'w'),indent=1)
