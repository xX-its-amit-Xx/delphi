import sys, urllib.request, urllib.parse, re
q=sys.argv[1]; n=sys.argv[2] if len(sys.argv)>2 else '6'
u='http://export.arxiv.org/api/query?'+urllib.parse.urlencode({'search_query':q,'max_results':n})
t=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'delphi-research/0.1'}),timeout=60).read().decode()
for e in re.findall(r'<entry>(.*?)</entry>',t,re.S):
    i=re.search(r'<id>(.*?)</id>',e).group(1); ti=re.sub(r'\s+',' ',re.search(r'<title>(.*?)</title>',e,re.S).group(1)); y=re.search(r'<published>(\d{4})',e).group(1)
    print(i,y,ti[:120])
