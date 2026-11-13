"""Resolve DOIs / title queries on Crossref; save results to scratch. Usage: python crossref_check.py"""
import json, urllib.request, urllib.parse, sys, os, time
OUT=r'D:/Users/ashenoy00000/delphi-work/agents2/scratch/t2-patterns-deep/crossref.json'
UA={'User-Agent':'delphi-research/0.1'}
def get(u):
    return json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=30))
dois="""10.1126/science.153.3737.708
10.1016/0022-5193(71)90051-8
10.1073/pnas.86.18.6973
10.1016/j.bpj.2010.12.3699
10.1038/s41467-018-04539-4
10.1038/s41586-019-1733-y
10.1073/pnas.2105138118
10.1038/s41586-019-1734-x
10.1073/pnas.2309251121
10.1073/pnas.1019079108
10.1038/349630a0
10.1038/239500a0
10.1111/j.1469-1809.1937.tb02153.x
10.1073/pnas.0710150104
10.1038/s41567-021-01380-3
10.1038/nrm1524
10.7554/eLife.71226""".split()
res={}
for d in dois:
    try:
        m=get('https://api.crossref.org/works/'+urllib.parse.quote(d))['message']
        res[d]=dict(title=m['title'][0],year=(m.get('issued',{}).get('date-parts') or [[None]])[0][0],venue=(m.get('container-title') or [''])[0],authors=', '.join((a.get('family','') for a in m.get('author',[])[:6])))
    except Exception as e: res[d]=dict(error=str(e))
    print(d,res[d]); time.sleep(0.3)
qs=["Arrested phase separation in reproducing bacteria creates a generic route to pattern formation",
"Sequential establishment of stripe patterns in an expanding cell population",
"Growth-rate dependent resource investment in bacterial motile behavior quantitatively follows potential benefit of chemotaxis",
"Bacterial chemotaxis in a microfluidic T-maze reveals strong phenotypic heterogeneity",
"Quantitative modeling of bacterial chemotaxis: signal amplification and accurate adaptation",
"Phenotypic diversity and temporal variability in a bacterial signaling network revealed by single-cell FRET",
"Spatial modulation of individual behaviors enables an ordered structure of diverse phenotypes during bacterial group migration",
"Complex patterns formed by motile cells of Escherichia coli Budrene Berg 1995 dynamics of formation"]
res['queries']={}
for q in qs:
    try:
        it=get('https://api.crossref.org/works?rows=3&select=DOI,title,issued,container-title&query.bibliographic='+urllib.parse.quote(q))['message']['items']
        res['queries'][q]=[(i['DOI'],i['title'][0] if i.get('title') else '',(i.get('issued',{}).get('date-parts') or [[None]])[0][0]) for i in it]
    except Exception as e: res['queries'][q]=str(e)
    print(q[:50],res['queries'][q])
json.dump(res,open(OUT,'w'),indent=1)
