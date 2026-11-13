"""Europe PMC abstracts by DOI. Saves scratch/epmc.json."""
import sys,json,urllib.request,urllib.parse,os,time,re
OUT='D:/Users/ashenoy00000/delphi-work/agents2/scratch/t4-glide-deep/epmc.json'
db=json.load(open(OUT)) if os.path.exists(OUT) else {}
for doi in sys.argv[1:]:
    u='https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&resultType=core&query='+urllib.parse.quote('DOI:"%s"'%doi)
    try:
        r=json.load(urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'delphi-research/0.1'}),timeout=40))
        res=r['resultList']['result']
        if res:
            x=res[0]; db[doi]={'id':x.get('id'),'src':x.get('source'),'pmcid':x.get('pmcid'),'title':x.get('title'),'abstract':re.sub('<[^>]+>','',x.get('abstractText','')),'year':x.get('pubYear'),'journal':x.get('journalTitle')}
            print('OK',doi,x.get('pmcid'),len(db[doi]['abstract']))
        else: print('none',doi)
    except Exception as e: print('ERR',doi,e)
    time.sleep(1)
json.dump(db,open(OUT,'w'),indent=1)
