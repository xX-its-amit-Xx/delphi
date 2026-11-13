#!/usr/bin/env python3
"""Verify DOIs against Crossref; append to scratch/crossref_verified.jsonl. usage: crossref.py doi1 doi2 ..."""
import re, sys, json, urllib.request, datetime
out=r"D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-biopolymer-films/crossref_verified.jsonl"
for doi in sys.argv[1:]:
    try:
        r=urllib.request.Request("https://api.crossref.org/works/"+doi,headers={"User-Agent":"delphi-research/0.1"})
        m=json.load(urllib.request.urlopen(r,timeout=40))["message"]
        yr=(m.get("issued",{}).get("date-parts") or [[None]])[0][0]
        rec={"doi":doi,"title":(m.get("title") or [""])[0],"year":yr,"venue":(m.get("container-title") or [""])[0],
             "authors":", ".join(a.get("family","") for a in m.get("author",[])[:4]),"checked":str(datetime.date.today()),"ok":True,"abstract":re.sub(r"<[^>]+>"," ",m.get("abstract","") or "").strip()[:1500]}
    except Exception as e:
        rec={"doi":doi,"ok":False,"err":str(e)}
    print(json.dumps(rec)); open(out,"a").write(json.dumps(rec)+"\n")
