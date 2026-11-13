"""Download every source used by bm-mycelium-living-materials into D:/Users/ashenoy00000/delphi-work/data/bm-myco/ (about 8 MB) and write MANIFEST.txt
(URL, date, bytes, sha256 per file). Needs: python 3, curl, pdftotext (poppler). Usage: python -I fetch_all.py"""
import subprocess, sys, os, hashlib, datetime
HERE=os.path.dirname(os.path.abspath(__file__)); D="D:/Users/ashenoy00000/delphi-work/data/bm-myco"
os.makedirs(D,exist_ok=True)
PMC="PMC12387367 PMC6645453 PMC13707017 PMC12217796 PMC12598823 PMC12038323 PMC12549730 PMC12287172 PMC5259796 PMC13558639 PMC5438213 PMC13601560 PMC13398475 PMC7868992 PMC6279784 PMC9036240 PMC11237183 PMC13654977 PMC11429656".split()
for p in PMC:
    subprocess.run([sys.executable,"-I",os.path.join(HERE,"epmc_fulltext.py"),p,D],check=True)
subprocess.run(["curl","-sL","-A","delphi-research/0.1","-o",D+"/arxiv-2305.12151v2.pdf","https://arxiv.org/pdf/2305.12151v2"],check=True)
subprocess.run(["pdftotext","-enc","UTF-8",D+"/arxiv-2305.12151v2.pdf",D+"/arxiv-2305.12151v2.raw.txt"],check=True)
subprocess.run([sys.executable,"-I",os.path.join(HERE,"flatten.py"),D+"/arxiv-2305.12151v2.raw.txt",D+"/arxiv-2305.12151v2.flat.txt"],check=True)
subprocess.run([sys.executable,"-I",os.path.join(HERE,"fetch_buehler2024.py"),D+"/buehler2024_abstract.txt"],check=True)
subprocess.run([sys.executable,"-I",os.path.join(HERE,"fetch_shen_pubabstract.py"),D+"/shen2024_published_abstract.txt"],check=True)
today=datetime.date.today().isoformat()
with open(D+"/MANIFEST.txt","w") as m:
    for f in sorted(os.listdir(D)):
        if f=="MANIFEST.txt": continue
        b=open(os.path.join(D,f),"rb").read()
        url="https://www.ebi.ac.uk/europepmc/webservices/rest/%s/fullTextXML"%f[:-4] if f.endswith(".xml") else ("https://arxiv.org/pdf/2305.12151v2" if f.startswith("arxiv") else "derived locally / Crossref / Europe PMC search API")
        m.write("%s\t%s\t%s\t%d\t%s\n"%(f,url,today,len(b),hashlib.sha256(b).hexdigest()))
print("done; manifest at",D+"/MANIFEST.txt")
