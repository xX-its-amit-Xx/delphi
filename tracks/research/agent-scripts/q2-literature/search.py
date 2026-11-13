import json,sys,time,urllib.parse,urllib.request
UA={"User-Agent":"delphi-research/0.1"}
def get(u):
    for _ in range(3):
        try: return urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=40).read().decode()
        except Exception as e: err=e; time.sleep(2)
    return "ERR "+str(err)
for q in sys.argv[1:]:
    r=get("https://api.crossref.org/works?rows=3&select=DOI,title,issued,container-title&query.bibliographic="+urllib.parse.quote(q))
    print("Q:",q)
    try:
        for i in json.loads(r)['message']['items']: print(" ",i['DOI'],'|',i['title'][0][:90],'|',i.get('issued',{}).get('date-parts',[[None]])[0][0])
    except Exception: print(" fail",r[:100])
    e=get("https://export.arxiv.org/api/query?max_results=3&search_query=all:"+urllib.parse.quote('"'+q+'"'))
    import re
    for m in re.finditer(r"<id>http://arxiv.org/abs/([^<]+)</id>.*?<title>(.*?)</title>",e,re.S): print("  arxiv",m.group(1),m.group(2).strip()[:80])
