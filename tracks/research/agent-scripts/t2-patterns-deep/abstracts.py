"""Fetch abstracts from Europe PMC (core) by DOI; writes scratch/abstracts.json"""
import json,urllib.request,urllib.parse,re,html
B=r'D:/Users/ashenoy00000/delphi-work/agents2/scratch/t2-patterns-deep/'
UA={'User-Agent':'delphi-research/0.1'}
dois=["10.1073/pnas.1101996108","10.1016/j.bpj.2011.06.023","10.1073/pnas.1001994107","10.1073/pnas.0710150104","10.1073/pnas.86.18.6973","10.1038/s41567-021-01380-3","10.1126/science.153.3737.708","10.1016/0022-5193(71)90051-8","10.1038/349630a0","10.1038/239500a0","10.1126/science.1209042","10.1038/nrm1524"]
out={}
for d in dois:
    u='https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&resultType=core&query='+urllib.parse.quote('DOI:"%s"'%d)
    r=json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=60))['resultList']['result']
    if r:
        x=r[0]; ab=html.unescape(re.sub('<[^>]+>','',x.get('abstractText','') or ''))
        out[d]=dict(title=x['title'],year=x.get('pubYear'),journal=x.get('journalTitle'),pmid=x.get('pmid'),abstract=ab)
    else: out[d]=None
    print(d,bool(out[d]),len(out[d]['abstract']) if out[d] else 0)
json.dump(out,open(B+'abstracts.json','w'),indent=1)
