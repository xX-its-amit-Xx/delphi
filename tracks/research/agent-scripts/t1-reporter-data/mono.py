import json,sys,numpy as np
d=json.load(open(sys.argv[1],encoding='utf-8'))
for r in d:
    if r.get('collection')=='functions' and 'cytometry' in r['name']:
        t=sorted(r['table'],key=lambda z:z['x'])
        m=[]
        for row in t:
            b=np.array(row['bin'],float);w=np.array(row['output'],float);c=np.cumsum(w);m.append(float(np.interp(.5*c[-1],c,b)))
        m=np.array(m);viol=[(i,round(m[i]/m[i-1],3)) for i in range(1,len(m)) if m[i]>m[i-1]]
        if viol: print(r['name'],'n_levels',len(m),'violations(index,ratio)',viol)
