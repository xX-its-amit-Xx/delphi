"""Resolve each DOI via Crossref (https://api.crossref.org/works/<doi>); write verified title/year/container to scratch/verify_dois.json"""
import json,time,urllib.request,urllib.error
DOIS="""10.1371/journal.pone.0120718
10.1371/journal.pone.0205607
10.1126/sciadv.aax1311
10.1038/s41467-024-54808-8
10.1016/j.conbuildmat.2015.08.136
10.1089/3dp.2015.0022
10.1016/j.cad.2014.02.010
10.1002/ad.1956
10.52842/conf.acadia.2013.033
10.1617/s11527-017-1117-4
10.1016/j.enbuild.2017.10.042
10.1016/j.conbuildmat.2017.12.134
10.1007/s10570-023-05342-1
10.1101/2025.08.22.671751
10.1186/s10086-023-02105-1
10.1002/adma.202007982
10.3390/biomimetics6040058
10.3390/polym16101402
10.1364/JOSA.11.000233
10.1007/s00226-018-1046-6
10.3390/mi14050924""".split()
out={}
for d in DOIS:
    for attempt in range(5):
        try:
            r=urllib.request.urlopen(urllib.request.Request('https://api.crossref.org/works/'+d,headers={'User-Agent':'delphi-research/0.1'}),timeout=60)
            m=json.load(r)['message']
            out[d]={'title':m['title'][0] if m.get('title') else None,'year':(m.get('issued',{}).get('date-parts') or [[None]])[0][0],
                    'container':(m.get('container-title') or [None])[0],'authors':[a.get('family') for a in m.get('author',[])][:4]}
            break
        except urllib.error.HTTPError as e:
            if e.code==429: time.sleep(20*(attempt+1)); continue
            out[d]={'error':e.code}; break
    time.sleep(2)
    print(d,out.get(d))
json.dump(out,open('D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-wood-cellulose-hygromorphs/verify_dois.json','w'),indent=1)
