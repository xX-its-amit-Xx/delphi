import json,sys,urllib.parse,urllib.request,re,html
UA={"User-Agent":"delphi-research/0.1"}
for q in sys.argv[1:]:
    r=json.loads(urllib.request.urlopen(urllib.request.Request("https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&pageSize=6&resultType=lite&query="+urllib.parse.quote(q),headers=UA),timeout=40).read())
    print("Q:",q)
    for x in r['resultList']['result']: print(" ",x.get('doi'),'|',x.get('pubYear'),'|',x.get('title','')[:100],'|',x.get('source'),x.get('pmcid'))
