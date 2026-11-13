import re,sys
sys.stdout.reconfigure(encoding='utf8',errors='replace')
f=sys.argv[1]
t=open(f,encoding='utf8').read()
if f.endswith('.xml'):
    t=re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',t))
for kw in sys.argv[2:]:
    ms=list(re.finditer(re.escape(kw),t))
    print('###',kw,len(ms))
    for m in ms[:3]:
        print('   ...',t[max(0,m.start()-220):m.end()+260])
