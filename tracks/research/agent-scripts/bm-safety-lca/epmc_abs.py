"""Print the Europe PMC abstract for each DOI. python -I epmc_abs.py <doi> [<doi>...]"""
import sys,json,re,urllib.request,urllib.parse
sys.stdout.reconfigure(encoding='utf8',errors='replace')
for d in sys.argv[1:]:
    u='https://www.ebi.ac.uk/europepmc/webservices/rest/search?'+urllib.parse.urlencode({'query':'DOI:'+d,'format':'json','resultType':'core'})
    r=json.load(urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'delphi-research/0.1'}),timeout=60))['resultList']['result']
    if not r: print(d,'NOT FOUND'); continue
    x=r[0]; print('##',d,x.get('pubYear'),x.get('title'),'| PMID',x.get('pmid'),'|',x.get('journalTitle')); print(re.sub(r'<[^>]+>','',x.get('abstractText','(no abstract)'))); print()
