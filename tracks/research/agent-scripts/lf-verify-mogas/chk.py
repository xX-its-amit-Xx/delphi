import json,re,sys
e=json.load(open('egg.json',encoding='utf-8'))['message']
print('EGG',e.get('title'),e.get('issued'),e.get('container-title'),[a.get('family') for a in e.get('author',[])]);print(e.get('abstract'))
c=json.load(open('chito.json',encoding='utf-8'))['message']
print('CHITO',c.get('title'),c.get('issued'),c.get('container-title'),[a.get('family') for a in c.get('author',[])]);print(c.get('abstract'))
a=json.load(open('auth.json',encoding='utf-8'))['message']
print('total',a['total-results'])
kw=re.compile(r'fire|flame|flamm|retardan|char|combust|burn|thermal|ignit',re.I)
n=0
for it in a['items']:
    if not any('Mogas' in (x.get('family') or '') and 'Laia' in (x.get('given') or '') for x in it.get('author',[])): continue
    n+=1
    t=' '.join(it.get('title') or []); ab=it.get('abstract') or ''
    hits=sorted(set(m.group(0).lower() for m in kw.finditer(t+' '+ab)))
    print(it['DOI'],'|',(it.get('issued') or {}).get('date-parts'),'|',t[:90],'| abs' if ab else '| noabs','|',hits)
    for m in re.finditer(r'[^.]*\b(fire|flame|flamm\w*|retardan\w*|charring|combust\w*|ignit\w*)\b[^.]*\.',ab,re.I): print('    >>',m.group(0).strip()[:300])
print('n hers',n)
p=open('profile.html',encoding='utf-8',errors='replace').read()
txt=re.sub(r'<script.*?</script>|<style.*?</style>','',p,flags=re.S); txt=re.sub(r'<[^>]+>',' ',txt); txt=re.sub(r'\s+',' ',txt)
print('profile len',len(txt))
for w in ['fire','flame','retardant','coating','chitosan','cellulose','regulation','testing','pioneers the field','water-based design','Addams','DumoLab','Assistant Professor']:
    i=[m.start() for m in re.finditer(w,txt,re.I)]
    print(w,len(i), txt[max(0,i[0]-60):i[0]+90] if i else '')
