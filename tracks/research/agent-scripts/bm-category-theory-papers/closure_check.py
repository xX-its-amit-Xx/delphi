"""Is Delta_eps_thk (eq 14) a dynamics-compatible reduction (paper A.15) of the two-lamina tissue law (eqs 9, 12, 13)?
Plain python (no sympy). Part 1: with tau_L = tau_T = tau the derivative of Delta equals -(Delta - Delta0(mA,mB))/tau for random
states (an identity, checked numerically). Part 2: with tau_L != tau_T, two states with the SAME (Delta, mA, mB) have DIFFERENT
d(Delta)/dt, so no induced dynamics on (Delta, m) exists (A.15 fails). Part 3: Delta0 depends on mA, mB separately unless mA = mB.
Run: python -I closure_check.py"""
import math, random
random.seed(1)
def f_lam(m,eL,eT,u,P):
    return (-(m-P['meq'](u))/P['tm'], -(eL-P['xL']*(m-P['m0']))/P['tL'], -(eT-P['xT']*(m-P['m0']))/P['tT'])
def D(s,P):
    (mA,eLA,eTA),(mB,eLB,eTB)=s
    cA,sA=math.cos(P['pA'])**2,math.sin(P['pA'])**2; cB,sB=math.cos(P['pB'])**2,math.sin(P['pB'])**2
    return eLA*cA+eTA*sA-(eLB*cB+eTB*sB)
def dD(s,u,P):
    # exact: D is linear in the eps components, so dD/dt = D applied to the eps-derivatives
    (mA,eLA,eTA),(mB,eLB,eTB)=s
    fA=f_lam(mA,eLA,eTA,u,P); fB=f_lam(mB,eLB,eTB,u,P)
    cA,sA=math.cos(P['pA'])**2,math.sin(P['pA'])**2; cB,sB=math.cos(P['pB'])**2,math.sin(P['pB'])**2
    return fA[1]*cA+fA[2]*sA-(fB[1]*cB+fB[2]*sB)
def D0(s,P):
    (mA,_,_),(mB,_,_)=s
    cA,sA=math.cos(P['pA'])**2,math.sin(P['pA'])**2; cB,sB=math.cos(P['pB'])**2,math.sin(P['pB'])**2
    return (P['xL']*cA+P['xT']*sA)*(mA-P['m0'])-(P['xL']*cB+P['xT']*sB)*(mB-P['m0'])
base=dict(m0=0.05,xL=0.01,xT=0.1,tm=3.0,pA=0.3,pB=1.2,meq=lambda u:0.1+0.2*u)
# Part 1
P=dict(base,tL=2.0,tT=2.0); worst=0
for _ in range(1000):
    s=tuple((random.random(),random.random(),random.random()) for _ in range(2)); u=random.random()
    worst=max(worst,abs(dD(s,u,P)+(D(s,P)-D0(s,P))/2.0))
print('Part1 tau_L=tau_T=tau: max |dD/dt + (D-D0(mA,mB))/tau| over 1000 random states =',worst)
# Part 3
s=((0.3,0.1,0.2),(0.5,0.1,0.2)); s_eq=((0.4,0.1,0.2),(0.4,0.1,0.2))
print('Part3 D0 with mA!=mB:',D0(s,P),' and mA=mB:',D0(s_eq,P))
# Part 2: phiA=0, phiB=pi/2 so D = eL_A - eT_B ; tau_L=1, tau_T=5
P2=dict(base,pA=0.0,pB=math.pi/2,tL=1.0,tT=5.0)
s1=((1.0,0.0,0.0),(1.0,0.0,0.0))                 # D = 0
s2=((1.0,0.1,0.0),(1.0,0.0,0.1))                 # D = 0.1 - 0.1 = 0
print('Part2 tau_L=1,tau_T=5: state1 D=%.3f dD/dt=%.4f | state2 D=%.3f dD/dt=%.4f (same D, mA, mB)'%(D(s1,P2),dD(s1,0.5,P2),D(s2,P2),dD(s2,0.5,P2)))
