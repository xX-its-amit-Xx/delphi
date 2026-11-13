"""Save the published abstract of Shen et al. 2024 (PMID 38315077, DOI 10.1039/d3mh01277h) from Europe PMC as plain text. Usage: python -I fetch_shen_pubabstract.py <outfile>"""
import json,re,sys,html,urllib.request
u="https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:10.1039/d3mh01277h&format=json&resultType=core"
d=json.load(urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"delphi-research/0.1"}),timeout=60))
t=html.unescape(re.sub(r"<[^>]+>","",d["resultList"]["result"][0]["abstractText"]));t=re.sub(r"\s+"," ",t)
open(sys.argv[1],"w",encoding="utf-8").write(t);print(len(t))
