import json,urllib.request,urllib.parse,re,html
UA={'User-Agent':'delphi-research/0.1'}
def get(u): return urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=60).read().decode('utf8','replace')
for q,a,b in [('DOI:"10.3389/frobt.2022.1011793"',700,1900),('DOI:"10.1242/jeb.046052"',900,1900),('DOI:"10.1093/icb/icac101"',800,1700)]:
    j=json.loads(get('https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&resultType=core&query='+urllib.parse.quote(q)))
    r=j['resultList']['result'][0]; print(q,r.get('license'),r.get('isOpenAccess')); print(re.sub('<[^>]+>','',r['abstractText'])[a:b].encode('ascii','replace').decode())
d=json.loads(get('https://api.crossref.org/works/10.1017/jfm.2022.89'))['message']
print(re.sub('<[^>]+>','',html.unescape(d.get('abstract','')))[:1300].encode('ascii','replace').decode())
