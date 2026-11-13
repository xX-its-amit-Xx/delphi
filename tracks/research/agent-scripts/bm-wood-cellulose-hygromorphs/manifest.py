"""Write MANIFEST.json (url, fetch date, bytes, sha256) for the files kept under data/wood-hygro (original downloads only, not derived .txt)."""
import hashlib,json,os
D='D:/Users/ashenoy00000/delphi-work/data/wood-hygro/'
SRC={ # file -> url (all fetched 2026-11-12)
'icd/hygroskin.html':'https://www.icd.uni-stuttgart.de/projects/hygroskin-meteorosensitive-pavilion/',
'hygroscope-icd.raw':'https://www.icd.uni-stuttgart.de/projects/hygroscope-meteorosensitive-morphology/',
'holstov2015.pdf':'https://ndownloader.figshare.com/files/69786426 (Newcastle repository, doi 10.25405/ncl.34238076; CC BY-NC-ND)',
'correa2015.pdf':'https://dspace.mit.edu/server/api/core/bitstreams/bf9cdf49-47bb-4973-90b3-ae022dc9016a/content (MIT DSpace handle 1721.1/104845)',
'biorxiv_bc_origami.xml':'https://www.biorxiv.org/content/early/2025/08/22/2025.08.22.671751.source.xml',
'khosh.html':'https://link.springer.com/article/10.1007/s10570-023-05342-1 (CC BY 4.0)',
'peng2023.html':'https://jwoodscience.springeropen.com/articles/10.1186/s10086-023-02105-1',
'vailati2017.html':'https://link.springer.com/article/10.1617/s11527-017-1117-4 (abstract only, paywalled)',
'dezeen.html':'https://www.dezeen.com/2019/06/03/university-of-stuttgart-urbach-tower-self-shaping-wood/',
'uni-press.pdf':'https://www.uni-stuttgart.de/universitaet/aktuelles/presseinfo/document/080_19_self-forming-wood_en.pdf',
'eth-beech/beech_bilayers.csv':'ETH Research Collection doi 10.3929/ethz-b-000275694 (copied from agents/scratch/scout-biomaterial/data_eth, sha verified)',
}
for p in os.listdir(D):
    if p.startswith('PMC') and p.endswith('.xml'): SRC[p]='https://www.ebi.ac.uk/europepmc/webservices/rest/%s/fullTextXML'%p[:-4]
out=[]
for k,u in sorted(SRC.items()):
    b=open(D+k,'rb').read()
    out.append(dict(file=k,url=u,fetched='2026-11-12',bytes=len(b),sha256=hashlib.sha256(b).hexdigest()))
json.dump(out,open(D+'MANIFEST.json','w'),indent=1)
print(len(out),'files',sum(o['bytes'] for o in out),'bytes total')
