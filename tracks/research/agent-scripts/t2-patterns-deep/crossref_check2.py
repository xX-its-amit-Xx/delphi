import json, urllib.request, urllib.parse, time
OUT=r'D:/Users/ashenoy00000/delphi-work/agents2/scratch/t2-patterns-deep/crossref2.json'
UA={'User-Agent':'delphi-research/0.1'}
dois=["10.1073/pnas.1101996108","10.1016/j.bpj.2011.06.023","10.1073/pnas.1001994107","10.1126/science.1209042","10.1073/pnas.1910849117","10.7554/eLife.67316","10.1038/s41467-019-09521-2","10.7554/eLife.27455",
"10.1007/s00285-008-0201-3","10.1007/s11538-008-9299-0","10.1146/annurev-biophys-083012-130350","10.1038/376049a0","10.1016/S0006-3495(98)77677-5","10.1007/BF02476407","10.1016/0022-5193(70)90092-5","10.1016/0001-8708(78)90130-5"]
res={}
for d in dois:
    for a in range(3):
        try:
            m=json.load(urllib.request.urlopen(urllib.request.Request('https://api.crossref.org/works/'+urllib.parse.quote(d),headers=UA),timeout=30))['message']
            res[d]=dict(title=m['title'][0],year=(m.get('issued',{}).get('date-parts') or [[None]])[0][0],venue=(m.get('container-title') or [''])[0],authors=', '.join(x.get('family','') for x in m.get('author',[])[:4])); break
        except Exception as e:
            res[d]=dict(error=str(e)); time.sleep(3)
    print(d,res[d]); time.sleep(1.5)
json.dump(res,open(OUT,'w'),indent=1)
