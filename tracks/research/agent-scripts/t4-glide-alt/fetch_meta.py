import json,urllib.request,urllib.parse,re,time,sys
UA={'User-Agent':'delphi-research/0.1'}
def get(u):
    return urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=60).read().decode('utf8','replace')
ids='1811.12221,1902.08038,2408.08864,2010.12553,2505.00622,1309.2969'
x=get('http://export.arxiv.org/api/query?id_list='+ids)
for e in re.findall(r'<entry>(.*?)</entry>',x,re.S):
    print('ARXIV',re.search(r'<id>(.*?)</id>',e).group(1),'|',re.sub(r'\s+',' ',re.search(r'<title>(.*?)</title>',e,re.S).group(1)),'|',re.search(r'<published>(.*?)</published>',e).group(1)[:10])
    print('  ',re.sub(r'\s+',' ',re.search(r'<summary>(.*?)</summary>',e,re.S).group(1))[:700])
for q in ['DOI:"10.1242/jeb.046052"','DOI:"10.1038/s41598-022-05739-1"','DOI:"10.3389/frobt.2022.1011793"','DOI:"10.1088/1748-3190/ab23e6"','DOI:"10.1093/icb/icac101"','DOI:"10.1242/jeb.247989"']:
    time.sleep(1)
    try:
        j=json.loads(get('https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&resultType=core&query='+urllib.parse.quote(q)))
        for r in j['resultList']['result'][:1]:
            print('EPMC',q,'|',r.get('pmid'),r.get('pmcid'),'|',r['title'][:100],'|',r.get('pubYear'),'|',r.get('journalTitle'))
            print('  ',re.sub('<[^>]+>','',r.get('abstractText',''))[:900])
    except Exception as e: print('ERR',q,e)
