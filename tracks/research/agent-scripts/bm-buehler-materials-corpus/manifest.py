# Write a sha256/size manifest for every file kept under the two data folders. Run: python -I manifest.py
import os,hashlib,json,datetime
roots=['D:/Users/ashenoy00000/delphi-work/data/buehler-papers/','D:/Users/ashenoy00000/delphi-work/data/formlabs-recheck-bm/']
URL={'f80v2.pdf':'https://media.formlabs.com/asset/af9d9268-d8c4-4019-9ccd-bd3af926c67e/-ENUS-Flexible-80A-V2-TDS.pdf','f80v1.pdf':'https://media.formlabs.com/m/442fcd13220df367/original/-ENUS-Flexible-80A-TDS.pdf','solvent.html':'https://formlabs.com/support/solvent-compatibility/',
 'dimas_thesis_mit_1721.1_79497.pdf':'https://dspace.mit.edu/server/api/core/bitstreams/46fe020b-f556-412b-b547-bcd6b39cafbf/content','gu_thesis_mit_1721.1_119343.pdf':'https://dspace.mit.edu/server/api/core/bitstreams/955b9d04-a990-49a0-bf70-c8da0e4f3774/content','pmc7189256.html':'https://pmc.ncbi.nlm.nih.gov/articles/PMC7189256/'}
rows=[];tot=0
for r in roots:
    for f in sorted(os.listdir(r)):
        p=r+f
        if f=='MANIFEST.json': continue
        b=open(p,'rb').read(); tot+=len(b)
        u=URL.get(f,'derived-or-api (see fetch_meta.py / fetch_fulltext.py for URL)')
        rows.append(dict(file=p,bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),url=u,date='2026-11-12'))
json.dump(rows,open(roots[0]+'MANIFEST.json','w'),indent=1)
print(len(rows),'files',round(tot/1e6,1),'MB total')
