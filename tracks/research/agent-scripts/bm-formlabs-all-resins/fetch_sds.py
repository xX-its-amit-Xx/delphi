"""Download English (US) SDS PDFs for key materials (pk list) into data/formlabs-tds/sds, append to MANIFEST.tsv. Re-runnable."""
import json,os,hashlib,urllib.request,datetime,time
ROOT='D:/Users/ashenoy00000/delphi-work'
idx=json.load(open(ROOT+'/agents2/scratch/bm-formlabs-all-resins/ds_index.json'))
pks={1693:'rigid10k',1817:'rigid4000',3432:'tough1000',3102:'tough1500v2',3374:'tough2000v2',19:'durable',3497:'flexible80av2',2379:'flexible50a_ENUS',2380:'flexible50a_ENEU',2097:'silicone40a',2538:'clearv5',2530:'greyv5',622:'hightemp',1340:'esd',994:'nylon12',1125:'nylon11',1885:'tpu90a',2462:'fastmodel'}
DD=ROOT+'/data/formlabs-tds/sds'; os.makedirs(DD,exist_ok=True)
now=datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
by={r['pk']:r for r in idx['records']}
for pk,name in pks.items():
    dst=f'{DD}/{name}__{pk}.pdf'
    if os.path.exists(dst): continue
    u=by[pk]['file']
    req=urllib.request.Request(u,headers={'User-Agent':'delphi-research/0.1'})
    b=urllib.request.urlopen(req,timeout=60).read(); open(dst,'wb').write(b)
    open(ROOT+'/data/formlabs-tds/MANIFEST.tsv','a').write('\t'.join(map(str,(u,dst,len(b),hashlib.sha256(b).hexdigest(),now)))+'\n')
    print(name,len(b)); time.sleep(0.5)
