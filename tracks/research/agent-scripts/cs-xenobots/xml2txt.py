import re,sys,html
s=open(sys.argv[1],encoding='utf-8').read()
s=re.sub(r'<ref-list.*?</ref-list>','',s,flags=re.S)
s=re.sub(r'<[^>]+>',' ',s); s=html.unescape(s); s=re.sub(r'\s+',' ',s)
open(sys.argv[2],'w',encoding='utf-8').write(s)
