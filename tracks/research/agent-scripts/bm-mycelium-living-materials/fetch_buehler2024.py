"""Save the Crossref abstract of Buehler 2024 (10.1088/2632-2153/ad7228) as plain text for quote checking. Usage: python -I fetch_buehler2024.py <outfile>"""
import json,re,sys,html,urllib.request
m=json.load(urllib.request.urlopen(urllib.request.Request("https://api.crossref.org/works/10.1088/2632-2153/ad7228",headers={"User-Agent":"delphi-research/0.1"}),timeout=60))["message"]
t=html.unescape(re.sub(r"<[^>]+>"," ",m.get("abstract","")));t=re.sub(r"\s+"," ",t)
open(sys.argv[1],"w",encoding="utf-8").write(t);print(len(t))
