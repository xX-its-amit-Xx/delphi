import json,sys,urllib.parse,urllib.request,re,html
UA={"User-Agent":"delphi-research/0.1"}
def get(u): return urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=40).read().decode()
for d in sys.argv[1:]:
    r=json.loads(get("https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&resultType=core&query=DOI:%22"+urllib.parse.quote(d)+"%22"))
    for x in r['resultList']['result'][:1]:
        print("==",d,x.get('title'),x.get('pubYear'),x.get('source'),x.get('id'),x.get('pmcid'),x.get('isOpenAccess'))
        print(html.unescape(re.sub('<[^>]+>','',x.get('abstractText','')))[:2500]);print()
