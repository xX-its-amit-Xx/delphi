import json, time, urllib.request
dois=["10.1038/srep31110","10.1126/sciadv.1602890","10.1038/nmat4544","10.1038/ncomms9092","10.1038/s41467-018-08055-3","10.1002/adma.202007982","10.3390/biomimetics6040058","10.1039/d6mh00947f","10.1103/physrevlett.118.084301","10.1364/JOSA.11.000233","10.1016/j.conbuildmat.2015.08.136","10.3390/biomimetics10100711","10.1016/j.matdes.2024.112807","10.3390/gels12050382","10.1038/natrevmats.2017.66"]
res={}
for d in dois:
    for attempt in range(3):
        try:
            r=urllib.request.Request('https://api.crossref.org/works/'+d,headers={'User-Agent':'delphi-research/0.1'})
            m=json.load(urllib.request.urlopen(r,timeout=60))['message']
            res[d]={'title':(m.get('title') or [''])[0],'year':(m.get('issued',{}).get('date-parts') or [[None]])[0][0],'venue':(m.get('container-title') or [''])[0],'first_author':(m.get('author') or [{}])[0].get('family')}
            break
        except Exception as e:
            res[d]={'error':str(e)}; time.sleep(5)
    print(d,res[d]); time.sleep(2)
json.dump(res,open('verify_dois_out.json','w'),indent=1)
