"""How close to the proved ceiling f<=3/2 (f = h*C_geom) are the paper's printed bilayers and the pine panel pair?
Also: sensitivity d ln f / d ln n at those points (zero at m^2 n = 1). Run: python -I ceiling_fraction.py"""
import math
def f(m,n): return 6*(1+m)**2/(3*(1+m)**2+(1+m*n)*(m*m+1/(m*n)))
rows=[('paper hygro pair  m=1 n=2850/5140',1,2850/5140),('paper thermal pair m=1 n=3500/6000',1,3500/6000),
      ('pine panel pair m=1 n=30/650 (equal-thickness, as the repo does)',1,30/650),
      ('pine panel pair m=2 n=30/650 (m=2 assumes sclereid ~2x fibre thickness, from spec-hygromorph-4d.json / Eger 2022, not re-fetched)',2,30/650),
      ('optimum for paper hygro n: m=1/sqrt(n)',1/math.sqrt(2850/5140),2850/5140)]
for name,m,n in rows:
    v=f(m,n); e=1e-6
    dl=(math.log(f(m,n*(1+e)))-math.log(f(m,n*(1-e))))/(math.log(1+e)-math.log(1-e))
    print('%-110s f=%.4f  f/1.5=%.4f  dlnf/dlnn=%+.4f'%(name,v,v/1.5,dl))
