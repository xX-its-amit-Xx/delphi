import re,sys,html
for p in sys.argv[1:]:
    t=open(p,encoding='utf-8').read()
    t=re.sub(r'<(tr|p|title|sec|caption|table-wrap|fig)[ >]',lambda m:'\n'+m.group(0),t)
    t=re.sub(r'</t[dh]>',' | ',t)
    t=re.sub(r'<[^>]+>','',t)
    t=html.unescape(t)
    t=re.sub(r'[ \t]+',' ',t)
    open(p.replace('.xml','.txt'),'w',encoding='utf-8').write(t)
