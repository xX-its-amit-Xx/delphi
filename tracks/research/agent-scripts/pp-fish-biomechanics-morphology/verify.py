import json,urllib.request,sys
dois=sys.argv[1:]
for d in dois:
    r=urllib.request.Request("https://api.crossref.org/works/"+d,headers={"User-Agent":"delphi-research/0.1"})
    try:
        m=json.load(urllib.request.urlopen(r,timeout=30))['message']
        print(d,'OK',m['issued']['date-parts'][0][0],(m.get('container-title') or [''])[0],'|',m['title'][0][:90],'|',[a.get('family') for a in m.get('author',[])][:3])
    except Exception as e: print(d,'FAIL',e)
