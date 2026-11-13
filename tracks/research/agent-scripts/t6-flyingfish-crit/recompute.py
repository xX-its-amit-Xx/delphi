# Recompute every number in the frozen predictions P1-P6 of design-flyingfish.json
# Inputs: values copied from physics/glide-data.csv (application repo, read-only) and Deng abstract.
import math, json
g=9.81; rho=1.225
out={}
# ---- L3 model
m=0.06; S=0.006377+0.001837+0.004474; CLmax=0.78; LD=4.37; CD0=0.055; delta=0.14
W=m*g; WS=W/S; vmin2=2*WS/(rho*CLmax); vmin=math.sqrt(vmin2)
print(f"S={S:.6f} W={W:.4f} W/S={WS:.2f} vmin^2={vmin2:.2f} vmin={vmin:.3f}")
def bound(v0,h=0.0,d=0.0,LD=LD,v2=vmin2): return LD*(h+(v0**2-v2)/(2*g))/(1-d)
for v in (10,15,20):
    print(f"v0={v}: bound d=0 {bound(v):.2f}  d=.14 {bound(v,d=delta):.2f}  no-floor d=0 {LD*v*v/(2*g):.2f}")
print("v0 for 50 m d=.14:",math.sqrt(vmin2+2*g*50*(1-delta)/LD)," d=0:",math.sqrt(vmin2+2*g*50/LD))
# sensitivity of 10 m/s verdict (e) 0.65 m to CLmax
for cl in (0.70,0.78,0.80,0.90,1.03):
    v2=2*WS/(rho*cl); print(f"CLmax {cl}: vmin {math.sqrt(v2):.2f}  bound@10 d=0 {max(0,bound(10,v2=v2)):.2f}  bound@15 d=.14 {bound(15,d=delta,v2=v2):.2f}")
# CLmax needed so that 15 m/s bound reaches 50 m (verdict b)
for cl in (1.2,1.4,1.6,1.8,2.0):
    v2=2*WS/(rho*cl); print(f"CLmax {cl}: bound@15 d=.14 {bound(15,d=delta,v2=v2):.2f}")
# drag check
Dp=0.5*rho*100*S*CD0; print("D at 10 m/s CD0:",Dp," W/D:",W/Dp)
# ---- Deng P1/P2
print("P1 v0>= sqrt(2g*13.2)=",math.sqrt(2*g*13.2), "  with apex speed vmin(CLmax1.03,L3 W/S):", math.sqrt(2*g*13.2+2*WS/(rho*1.03)))
for ws in (37.03,46.37):
    print(" W/S",ws,"vmin(1.03)",math.sqrt(2*ws/(rho*1.03)),"v0 floor",math.sqrt(2*g*13.2+2*ws/(rho*1.03)))
print("P1 45.4 m at 4.7:",math.sqrt(2*g*45.4/4.7))
print("P2 ratio at 16.1:",45.4/(4.7*16.1**2/(2*g)), " bound",4.7*16.1**2/(2*g))
for r in (1.0,0.73,0.5,0.3):
    print(f" ratio {r} <-> v0 {math.sqrt(45.4*2*g/(4.7*r)):.2f} m/s")
for v in (16.1,18.2,20,25):
    print(f" v0 {v}: ratio {45.4/(4.7*v*v/(2*g)):.3f}")
# ---- Cheilopogon P3
mc=0.226; Sc=0.0225; WSc=mc*g/Sc
for cl in (0.78,1.03):
    print(f"Cheil W/S {WSc:.1f} CLmax {cl} vmin {math.sqrt(2*WSc/(rho*cl)):.2f}")
vminc2=2*WSc/(rho*1.03)
def T(v,th,cl_f=True):
    f=v*v/vminc2 if cl_f else 0
    return 2*v*math.sin(math.radians(th))/(g*(1-f))
for v in (3.87,5.15):
  for th in (20,23.3,30,45):
    print(f" v {v} th {th}: T_M5 {T(v,th):.3f}  T_ballistic {T(v,th,False):.3f} reach {v*math.cos(math.radians(th))*T(v,th):.2f}")
# P3 Monte Carlo: max over 10 leaps of ballistic T; speed U[3.87,5.15], pitch N(20,3.3)+offset
import random; random.seed(1)
def mc(offset,sd_extra,thr=0.50,n=10,N=40000):
    ex=0
    for _ in range(N):
        mx=0
        for _ in range(n):
            v=random.uniform(3.87,5.15); th=random.gauss(20,3.3)+offset+random.gauss(0,sd_extra)
            th=max(th,1)
            mx=max(mx,T(v,th))
        ex+= mx>thr
    return ex/N
for off,sd in ((0,0),(0,3),(5,3),(10,5)):
    print(f"P3 P(max T over 10 leaps >0.50 | ballistic) offset {off} extra sd {sd}: {mc(off,sd):.3f};  thr 0.80: {mc(off,sd,0.8):.3f}; thr 1.0: {mc(off,sd,1.0):.3f}")
