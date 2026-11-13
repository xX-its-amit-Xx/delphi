"""fetch URL -> data/wood-hygro/<name>.html/.txt ; print sha256, size. usage: fetchtxt.py name url"""
import sys,re,html,hashlib,urllib.request,datetime
name,url=sys.argv[1:3]
D='D:/Users/ashenoy00000/delphi-work/data/wood-hygro/'
req=urllib.request.Request(url,headers={'User-Agent':'delphi-research/0.1'})
b=urllib.request.urlopen(req,timeout=90).read()
open(D+name+'.raw','wb').write(b)
t=b.decode('utf8','replace')
t=re.sub(r'(?s)<(script|style).*?</\1>','',t)
t=html.unescape(re.sub(r'<[^>]+>',' ',t))
t=re.sub(r'[ \t]+',' ',t); t=re.sub(r'\n\s*\n+','\n',t)
open(D+name+'.txt','w',encoding='utf8').write(t)
print(name,url,len(b),hashlib.sha256(b).hexdigest(),datetime.date.today())
