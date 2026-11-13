import sys,hashlib,urllib.request,os,datetime
UA={'User-Agent':'delphi-research/0.1'}
OUT='D:/Users/ashenoy00000/delphi-work/data/t6-flyingfish/'
items=[('xu2013-PMC3574442.xml','https://www.ebi.ac.uk/europepmc/webservices/rest/PMC3574442/fullTextXML'),
('daane2021-PMC9172250.xml','https://www.ebi.ac.uk/europepmc/webservices/rest/PMC9172250/fullTextXML'),
('cytogenet2026-PMC13282621.xml','https://www.ebi.ac.uk/europepmc/webservices/rest/PMC13282621/fullTextXML'),
('biolopen2023-PMC10445725.xml','https://www.ebi.ac.uk/europepmc/webservices/rest/PMC10445725/fullTextXML'),
('makiguchi2013.pdf','https://www.int-res.com/articles/ab2013/18/b018p105.pdf'),
('deng-biorxiv-765560.xml','https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&resultType=core&query=DOI:10.1101/765560'),
('deng2019-core.json','https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&resultType=core&query=DOI:10.1088/1748-3190/ab23e6'),
('parkchoi-core.json','https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&resultType=core&query=DOI:10.1242/jeb.046052'),
]
for n,u in items:
    p=OUT+n
    if os.path.exists(p): continue
    try:
        b=urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=60).read()
        open(p,'wb').write(b)
        print(n,len(b),hashlib.sha256(b).hexdigest(),u,datetime.date.today())
    except Exception as e: print('FAIL',n,e)
