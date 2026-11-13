# Own arithmetic for the illustrative worked example (ILLUSTRATIVE numbers, not from a regulation).
import math
dT=800.0   # K, assumed fire-side minus ambient
Ra=1/9.0   # m2K/W, assumed unexposed film (h=9 W/m2K) -- illustrative
Rs=0.05    # m2K/W substrate, illustrative
d=0.002; k=0.10
R=d/k+Rs+Ra
print("R_tot",R,"steady rise",dT*Ra/R)
dmax=0.003; kmin=0.08
Rb=dmax/kmin+Rs+Ra
lo=dT*Ra/Rb
print("steady lower bound (best case within envelope)",lo)
# transient: tau<=tau_max=1800 s, t=1800 s
f=1-math.exp(-1800/1800)
print("fraction",f,"transient lower bound",f*lo)
# ignition thick: pi/4 * I * (Tig-T0)^2/q^2
I=0.5e6  # (W s^.5/m2K)^2 ... k rho c in W2 s/(m4 K2): illustrative
print("t_ig thick",math.pi/4*I*300**2/(25000**2))
