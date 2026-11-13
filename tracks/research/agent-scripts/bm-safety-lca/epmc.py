"""Europe PMC search helper. Usage: python -I epmc.py "<query>" [n]  -> prints title/journal/year/DOI/PMCID/citedBy"""
import sys,json,urllib.request,urllib.parse
sys.stdout.reconfigure(encoding='utf8',errors='replace')
q=sys.argv[1]; n=sys.argv[2] if len(sys.argv)>2 else '8'
u='https://www.ebi.ac.uk/europepmc/webservices/rest/search?'+urllib.parse.urlencode({'query':q,'format':'json','pageSize':n,'resultType':'lite'})
r=json.load(urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'delphi-research/0.1'}),timeout=60))
for x in r['resultList']['result']:
    print(x.get('pubYear'),'|',x.get('title','')[:140],'|',x.get('journalTitle'),'|',x.get('doi'),'|',x.get('pmcid'),'|cit',x.get('citedByCount'))
