"""Fetch Crossref metadata+abstract for every DOI cited; saves scratch/crossref_abstracts.json (re-runnable)."""
import json,urllib.request,urllib.parse,re,html,time
UA={'User-Agent':'delphi-research/0.1'}
DOIS=['10.1242/jeb.046052','10.1088/1748-3190/ab23e6','10.1101/765560','10.3354/ab00494','10.1007/bf00044128','10.1017/s0025315400048761','10.1046/j.1095-8649.2003.00041.x','10.1111/j.1469-7998.1990.tb04009.x','10.1016/j.cub.2021.08.054','10.1098/rspb.2012.2261','10.1098/rsbl.2014.0960','10.1006/jtbi.1993.1113','10.1093/icb/icac101','10.1088/1748-3190/acce86','10.1371/journal.pone.0014483','10.1242/bio.059973','10.1139/cjz-2014-0013','10.1111/j.1095-8312.2010.01550.x','10.1063/5.0347662','10.1016/j.birob.2026.100318','10.1242/dev.199384','10.3897/compcytogen.20.190559']
out={}
for d in DOIS:
    for k in range(3):
        try:
            m=json.loads(urllib.request.urlopen(urllib.request.Request('https://api.crossref.org/works/'+urllib.parse.quote(d),headers=UA),timeout=40).read())['message']
            out[d]={'title':html.unescape(m['title'][0]),'year':(m.get('issued',{}).get('date-parts') or [[None]])[0][0],'journal':(m.get('container-title') or [''])[0],'volume':m.get('volume'),'page':m.get('page') or m.get('article-number'),'authors':[(a.get('family','')+' '+a.get('given','')).strip() for a in m.get('author',[])],'abstract':html.unescape(re.sub(r'\s+',' ',re.sub('<[^>]+>',' ',m.get('abstract','') or ''))).strip()}
            break
        except Exception as e:
            out[d]={'error':str(e)}; time.sleep(4)
    time.sleep(1.5)
json.dump(out,open('D:/Users/ashenoy00000/delphi-work/agents2/scratch/t6-flyingfish-deep/crossref_abstracts.json','w',encoding='utf8'),indent=1,ensure_ascii=False)
for d,v in out.items(): print(d,'ERR' if 'error' in v else 'ok',len(v.get('abstract','')))
