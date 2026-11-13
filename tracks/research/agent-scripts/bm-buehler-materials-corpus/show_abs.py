# Print Crossref / EPMC abstract text for each cached record. Run: python -I show_abs.py
import json,glob,re,sys,html
sys.stdout.reconfigure(encoding='utf8')
D='D:/Users/ashenoy00000/delphi-work/data/buehler-papers/'
for f in sorted(glob.glob(D+'crossref_*.json')):
    j=json.load(open(f,encoding='utf8'))['message']
    a=j.get('abstract')
    a=html.unescape(re.sub(r'<[^>]+>','',a)).strip() if a else None
    print('\n###',j['DOI'],'|',j.get('container-title'),'|',j.get('volume'),j.get('page') or j.get('article-number'))
    print((j.get('title') or [''])[0])
    print('CR-ABSTRACT:',a)
for f in sorted(glob.glob(D+'epmc_*.json')):
    r=json.load(open(f,encoding='utf8')).get('resultList',{}).get('result',[])
    if r and r[0].get('abstractText'):
        print('\n### EPMC',f.split('epmc_')[1],r[0].get('pmcid'),'\n',re.sub(r'<[^>]+>','',r[0]['abstractText']))
