"""Own calculation: would an RH-driven passive shade close when shading is wanted?
Data: Open-Meteo historical archive API (ERA5 reanalysis-based), hourly T2m, RH2m, shortwave (GHI), year 2023, UTC.
Hygromorph model (assumption, from Cheng 2024 test range): element fully shading at RH<=30, fully open at RH>=90, linear between;
thick elements modelled as first-order low-pass of RH with time constant tau_h.
shade-wanted hour: T>=24C and GHI>=300 W/m2 ; gain-wanted hour: T<=10C and GHI>=200 W/m2 (both are proxies, not building simulations).
Outputs JSON to ../../scratch/bm-passive-facades-evidence/rh_vs_shade_need.json and raw downloads under data dir with sha256."""
import urllib.request, json, hashlib, os, time, datetime, math
D="D:/Users/ashenoy00000/delphi-work/data/passive-facades/openmeteo"; os.makedirs(D,exist_ok=True)
OUT="D:/Users/ashenoy00000/delphi-work/agents2/scratch/bm-passive-facades-evidence/rh_vs_shade_need.json"
CITIES={"Freiburg DE (Cfb)":(48.0,7.85),"London UK (Cfb)":(51.5,-0.12),"Madrid ES (Csa/BSk)":(40.42,-3.70),"Phoenix US (BWh)":(33.45,-112.07),
"Dubai AE (BWh)":(25.2,55.27),"Houston US (Cfa)":(29.76,-95.37),"Singapore (Af)":(1.35,103.82),"Mumbai IN (Am)":(19.08,72.88),"Sydney AU (Cfa)":(-33.87,151.21)}
def load(name,lat,lon):
    fn=os.path.join(D,name.split()[0]+"_2023.json")
    if not os.path.exists(fn):
        u="https://archive-api.open-meteo.com/v1/archive?latitude=%s&longitude=%s&start_date=2023-01-01&end_date=2023-12-31&hourly=temperature_2m,relative_humidity_2m,shortwave_radiation&timezone=UTC"%(lat,lon)
        b=urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"delphi-research/0.1"}),timeout=90).read()
        open(fn,"wb").write(b); time.sleep(3)
        open(os.path.join(D,"MANIFEST.tsv"),"a").write("%s\t%s\t%s\t%d\t%s\n"%(u,datetime.date.today(),os.path.basename(fn),len(b),hashlib.sha256(b).hexdigest()))
    return json.load(open(fn))["hourly"]
def state(rh,tau):
    a=1.0 if tau<=1 else 1-math.exp(-1/tau)
    out=[];x=rh[0]
    for r in rh:
        x=x+a*(r-x); f=min(1,max(0,(x-30)/60)); out.append(1-f)   # 1 = fully shading
    return out
res={}
for name,(la,lo) in CITIES.items():
    h=load(name,la,lo); T=h["temperature_2m"];RH=h["relative_humidity_2m"];G=h["shortwave_radiation"]
    ok=[i for i in range(len(T)) if None not in (T[i],RH[i],G[i])]
    T=[T[i] for i in ok];RH=[RH[i] for i in ok];G=[G[i] for i in ok]
    sw=[i for i in range(len(T)) if T[i]>=24 and G[i]>=300]; gw=[i for i in range(len(T)) if T[i]<=10 and G[i]>=200]
    r={"hours":len(T),"shade_wanted_h":len(sw),"gain_wanted_h":len(gw),"mean_RH_pct":round(sum(RH)/len(RH),1)}
    for tau in (1,6,24):
        s=state(RH,tau)
        ss=sum(s[i] for i in sw)/len(sw) if sw else None
        sg=sum(s[i] for i in gw)/len(gw) if gw else None
        wrong=sum(1 for i in sw if s[i]<0.5)/len(sw) if sw else None
        r["tau%dh"%tau]={"mean_shade_state_when_shade_wanted":None if ss is None else round(ss,2),"mean_shade_state_when_gain_wanted":None if sg is None else round(sg,2),
            "selectivity":None if ss is None or sg is None else round(ss-sg,2),"frac_shade_wanted_hours_element_mostly_open":None if wrong is None else round(wrong,2)}
    res[name]=r; print(name,json.dumps(r))
os.makedirs(os.path.dirname(OUT),exist_ok=True); json.dump(res,open(OUT,"w"),indent=1)
