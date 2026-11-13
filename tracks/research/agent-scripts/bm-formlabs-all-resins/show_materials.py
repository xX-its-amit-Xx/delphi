import json,sys,re
sys.stdout.reconfigure(encoding='utf-8')
d=json.load(open('D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-formlabs-all-resins/materials.json',encoding='utf8'))
sel=sys.argv[1:]
for k,v in d.items():
    if sel and not any(k.startswith(s) for s in sel): continue
    print('####',k)
    for kk,lst in v['props'].items():
        for e in lst:
            st=e['states']
            if st: print('  ',kk,'|',e['label'][:34],'|',' ; '.join(f"{re.sub(r'Post-Cured','PC',s)[:20]}={x}" for s,x in zip(st,e['values'])))
            else: print('  ',kk,'|',e['label'][:34],'|',e['values'])
    print('   BIO',v['bio'])
