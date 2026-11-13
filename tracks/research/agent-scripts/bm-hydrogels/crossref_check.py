#!/usr/bin/env python
"""usage: python -I crossref_check.py DOI [DOI ...] -> prints title/year/venue/authors from Crossref and appends to scratch/crossref_verified.jsonl"""
import sys,json,urllib.request,urllib.parse,datetime
sys.stdout.reconfigure(encoding='utf-8')
out='D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-hydrogels/crossref_verified.jsonl'
for doi in sys.argv[1:]:
    url='https://api.crossref.org/works/'+urllib.parse.quote(doi)
    try:
        d=json.load(urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'delphi-research/0.1'}),timeout=40))['message']
    except Exception as e:
        print('FAIL',doi,e); continue
    yr=(d.get('issued',{}).get('date-parts') or [[None]])[0][0]
    au=', '.join((a.get('family','')+' '+(a.get('given','') or '')[:1]) for a in d.get('author',[])[:6])
    rec={'doi':doi,'title':(d.get('title') or [''])[0],'year':yr,'venue':(d.get('container-title') or [''])[0],'authors':au,'checked':str(datetime.date.today()),'url':url}
    print('OK',json.dumps(rec,ensure_ascii=False))
    open(out,'a',encoding='utf-8').write(json.dumps(rec,ensure_ascii=False)+'\n')
