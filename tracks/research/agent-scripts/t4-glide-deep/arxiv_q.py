import sys,urllib.request,urllib.parse,re,time
for q in sys.argv[1:]:
    u='http://export.arxiv.org/api/query?max_results=5&search_query='+urllib.parse.quote(q)
    x=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'delphi-research/0.1'}),timeout=40).read().decode()
    print('##',q)
    for e in re.findall(r'<entry>(.*?)</entry>',x,flags=re.S):
        print('  ',re.search(r'<id>(.*?)</id>',e).group(1),'|',re.sub(r'\s+',' ',re.search(r'<title>(.*?)</title>',e,flags=re.S).group(1))[:100],'|',re.search(r'<published>(.*?)</published>',e).group(1)[:10])
    time.sleep(3)
