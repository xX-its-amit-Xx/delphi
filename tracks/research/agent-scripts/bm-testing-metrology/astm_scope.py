"""Fetch ASTM store page(s) and print the Scope text + price. usage: python astm_scope.py d0638-14 ..."""
import sys, re, html, urllib.request, hashlib
for slug in sys.argv[1:]:
    url=f"https://store.astm.org/{slug}.html"
    req=urllib.request.Request(url,headers={"User-Agent":"delphi-research/0.1"})
    try: raw=urllib.request.urlopen(req,timeout=40).read()
    except Exception as e: print(slug,"ERR",e); continue
    open(f"astm_{slug}.html","wb").write(raw)
    t=raw.decode('utf8','ignore'); t=re.sub(r'<script.*?</script>|<style.*?</style>','',t,flags=re.S)
    t=html.unescape(re.sub(r'<.*?>',' ',t)); t=re.sub(r'\s+',' ',t)
    i=t.find('Scope'); 
    print('###',url,len(raw),hashlib.sha256(raw).hexdigest()[:12]); print(t[i:i+1500]); 
    for m in re.finditer(r'\$\s?\d+(\.\d\d)?',t): print('price',m.group(0)); break
