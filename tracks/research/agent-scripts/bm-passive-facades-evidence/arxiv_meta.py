import sys,urllib.request,re,html
for i in sys.argv[1:]:
    t=urllib.request.urlopen(urllib.request.Request("https://export.arxiv.org/api/query?id_list="+i,headers={"User-Agent":"delphi-research/0.1"}),timeout=40).read().decode()
    e=t.split("<entry>")[1]
    print("##",i,"|",re.sub(r"\s+"," ",re.search(r"<title>(.*?)</title>",e,re.S).group(1)),"|",re.search(r"<published>(.*?)</published>",e).group(1),"|",", ".join(re.findall(r"<name>(.*?)</name>",e)[:3]))
