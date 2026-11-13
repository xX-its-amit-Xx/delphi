import re,sys,html
s=open(sys.argv[1],encoding='utf8',errors='ignore').read()
s=re.sub(r'(?s)<(script|style|svg|noscript).*?</\1>','',s)
s=re.sub(r'(?i)<(br|/p|/div|/li|/h\d|/tr|/span|/a|/button|/label)[^>]*>','\n',s)
s=re.sub(r'<[^>]+>','',s)
s=html.unescape(s)
lines=[re.sub(r'[ \t\xa0]+',' ',l).strip() for l in s.split('\n')]
out=[]
for l in lines:
    if l and (not out or out[-1]!=l): out.append(l)
open(sys.argv[2],'w',encoding='utf8').write('\n'.join(out))
