"""Verify DOIs resolve on Crossref and print title/first author/year/abstract-snippet. Run: python -I verify_dois.py"""
import urllib.request, json, sys, re
sys.stdout.reconfigure(encoding="utf8")
DOIS = ["10.1002/ad.1912","10.3390/polym16111526","10.3390/polym13020237","10.1038/s41467-024-54808-8","10.1089/3dp.2015.0022"]
for d in DOIS:
    r = urllib.request.Request("https://api.crossref.org/works/"+d, headers={"User-Agent":"delphi-research/0.1"})
    m = json.load(urllib.request.urlopen(r, timeout=40))["message"]
    ab = re.sub(r"<[^>]+>"," ",m.get("abstract","")).strip()
    print(d, "|", m["title"][0], "|", m["author"][0].get("family"), "|", m["issued"]["date-parts"][0][0], "|", m.get("container-title",[""])[0])
    print("   abstract:", ab[:600])
