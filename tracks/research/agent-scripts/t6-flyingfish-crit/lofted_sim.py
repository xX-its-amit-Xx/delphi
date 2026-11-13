# Point-mass 2-D flight with parabolic polar fitted to Park&Choi model L3 (CDmin .055, LDmax 4.37, CLmax .78).
# Question: can a lofted/pitch-up launch beat the lift=W energy bound M3 (with stall floor)? Random search over
# launch angle and piecewise-constant CL(t). Deterministic seed. Pure Python.
import math, random
g=9.81; rho=1.225
CD0=0.055; LD=4.37; k=1/(4*LD*LD*CD0); CLmax=0.78
print("k=",k,"CL@LDmax=",math.sqrt(CD0/k),"LD at CLmax=",CLmax/(CD0+k*CLmax**2))
def fly(m,S,v0,h0,gam0,cls,seg=0.25,dt=0.002):
    x=0;z=h0;v=v0;gam=math.radians(gam0);t=0
    while (z>0 or t<0.02) and t<30:
        i=min(int(t/seg),len(cls)-1); CL=cls[i]
        q=0.5*rho*v*v*S
        L=q*CL; D=q*(CD0+k*CL*CL)
        W=m*g
        dv=(-D-W*math.sin(gam))/m
        dg=(L-W*math.cos(gam))/(m*max(v,0.5))
        v+=dv*dt; gam+=dg*dt
        x+=v*math.cos(gam)*dt; z+=v*math.sin(gam)*dt; t+=dt
        if v<0.5: break
    return x
def run(m,S,v0,h0,n=1500,seed=3):
    random.seed(seed); best=(0,None)
    for _ in range(n):
        gam=random.uniform(-5,60)
        cls=[random.choice([0,0.1,0.3,0.48,0.65,0.78]) for _ in range(8)]
        x=fly(m,S,v0,h0,gam,cls)
        if x>best[0]: best=(x,(gam,cls))
    # local refinement
    x0,(gam,cls)=best
    for _ in range(600):
        g2=gam+random.gauss(0,3); c2=[min(CLmax,max(0,c+random.gauss(0,0.1))) for c in cls]
        x=fly(m,S,v0,h0,g2,c2)
        if x>x0: x0,gam,cls=x,g2,c2
    return x0,gam,cls
def M3(m,S,v0,h0):
    vmin2=2*(m*g/S)/(rho*CLmax)
    return LD*(h0+max(0,v0*v0-vmin2)/(2*g)), LD*(h0+v0*v0/(2*g)), math.sqrt(vmin2)
import sys
cases=[("fish L3 m=.06 S=.012688",0.06,0.012688,[10,15],0.0),
       ("printed glider m=.03 S=.0127",0.03,0.0127,[7.5,8,10,12],1.0)]
for name,m,S,vs,h0 in cases:
    for v0 in vs:
        x,gam,cls=run(m,S,v0,h0)
        b,bnf,vm=M3(m,S,v0,h0)
        print(f"{name} v0={v0} h0={h0}: vmin={vm:.2f} best simulated x={x:.2f} m (gamma0 {gam:.1f}, CL {[round(c,2) for c in cls]}); M3 bound(with floor)={b:.2f}; no-floor energy bound={bnf:.2f}; ratio x/M3={x/b if b>0 else float('inf'):.2f}; x/noFloor={x/bnf:.2f}")
