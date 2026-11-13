import json
a=json.load(open('D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/registry/lawsets/lawset-1.8.1.json',encoding='utf8'))
b=json.load(open('D:/Users/ashenoy00000/delphi-work/upstream/leanbio/lean/registry/lawsets/lawset-1.6.0.json',encoding='utf8'))
A={x['law_id']:x for x in a['laws']};B={x['law_id']:x for x in b['laws']}
print('only in 1.8.1',sorted(set(A)-set(B)));print('only in 1.6.0',sorted(set(B)-set(A)))
for k in sorted(set(A)&set(B)):
    if A[k]['content_hash']!=B[k]['content_hash'] or A[k]['status']!=B[k]['status']:
        print('changed',k,B[k]['version'],B[k]['status'],'->',A[k]['version'],A[k]['status'])
flight=['flight-climb-glide-law','flight-allometry-law','scaling-area-law','perturb-wind-glide','perturb-isa-vmin','aspect-ratio-induced-drag','taxiing-thrust','elastic-similarity','fin-length-ratio']
for k in flight: print(k,A[k]['status'],A[k]['version'],'same_hash_as_1.6.0=',k in B and A[k]['content_hash']==B[k]['content_hash'])
