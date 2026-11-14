import json,sys,re,os
D=sys.argv[1]
dois=open(os.path.join(D,'dois.txt')).read().split()
for i,d in enumerate(dois,1):
    print('=====',i,d)
    try:
        c=json.load(open(os.path.join(D,'epmc','cr%d.json'%i),encoding='utf-8'))['message']
        print('CR:',c.get('title'),c.get('container-title'),c.get('issued',{}).get('date-parts'),[a.get('family') for a in c.get('author',[])][:4])
    except Exception as e: print('CR FAIL',e)
    try:
        r=json.load(open(os.path.join(D,'epmc','%d.json'%i),encoding='utf-8'))['resultList']['result']
        if r:
            r=r[0]; print('EPMC:',r.get('title'),r.get('pubYear'),'PMID',r.get('pmid'),'OA',r.get('isOpenAccess'))
            print(re.sub('<[^>]+>','',r.get('abstractText','NO ABSTRACT'))[:1500])
        else: print('EPMC none')
    except Exception as e: print('EPMC FAIL',e)
