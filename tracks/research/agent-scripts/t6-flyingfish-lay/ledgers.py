import json,glob,os
R='D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/'
for f in sorted(glob.glob(R+'eliminate/ledger*.json')):
    d=json.load(open(f,encoding='utf8')); s=d['summary']
    print(os.path.basename(f),'candidates',s['candidates'],'eliminated',s['eliminated'],'consistent',s['consistent'],'unconstrained',s.get('unconstrained'),'kernelChecked',s.get('kernelCheckedEliminations'))
    if 'flier' in f or 'physiology' in f or 'tff' in f:
        for r in d['ledger']:
            print('   ',r['id'],'|',r['problem'][:110],'|',r['verdict'][:60])
for f in ['bound/result.json']:
    print(open(R+f,encoding='utf8').read()[:1800])
laws=json.load(open(R+'registry/lawsets/lawset-1.8.1.json'))
print({k:(v if not isinstance(v,(list,dict)) else len(v)) for k,v in laws.items()})
