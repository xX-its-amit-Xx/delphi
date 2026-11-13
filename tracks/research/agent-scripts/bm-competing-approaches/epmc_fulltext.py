# usage: epmc_fulltext.py <doi> <outfile>   -> saves plain text of OA full text via Europe PMC
import sys, json, re, urllib.request, urllib.parse, html, hashlib
doi, out = sys.argv[1], sys.argv[2]
H={'User-Agent':'delphi-research/0.1'}
def get(u):
    return urllib.request.urlopen(urllib.request.Request(u,headers=H),timeout=90).read()
d=json.loads(get('https://www.ebi.ac.uk/europepmc/webservices/rest/search?'+urllib.parse.urlencode({'query':'DOI:'+doi,'format':'json','resultType':'lite'})))
r=d['resultList']['result'][0]; pmc=r.get('pmcid'); print(doi,pmc,r.get('title'))
x=get(f'https://www.ebi.ac.uk/europepmc/webservices/rest/{pmc}/fullTextXML').decode('utf8','replace')
t=re.sub(r'<[^>]+>',' ',x); t=html.unescape(re.sub(r'\s+',' ',t))
open(out,'w',encoding='utf8').write(t)
print(len(t), hashlib.sha256(t.encode()).hexdigest())
