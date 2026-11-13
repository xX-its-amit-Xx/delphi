"""usage: python pubmed_abs.py DOI -> PMID + abstract via NCBI E-utilities (saved to data dir)"""
import sys, json, urllib.request, urllib.parse, re
sys.path.insert(0,".")
from nb_fetch import fetch, D
doi=sys.argv[1]
j=json.load(urllib.request.urlopen(urllib.request.Request("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&term="+urllib.parse.quote(doi+"[doi]"),headers={"User-Agent":"delphi-research/0.1"}),timeout=60))
ids=j["esearchresult"]["idlist"]; print("PMIDs",ids)
for i in ids:
    name="pubmed_%s.xml"%i
    fetch("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&retmode=xml&id="+i,name)
    t=open(D+"/"+name+".txt",encoding="utf8").read()
    print(t[:2500])
