import re,sys,html
t=open(sys.argv[1],encoding='utf8').read()
t=re.sub(r'<(/p|/title|/sec|/abstract)>','\n',t); t=re.sub(r'<[^>]+>','',t)
open(sys.argv[2],'w',encoding='utf8').write(html.unescape(t))
