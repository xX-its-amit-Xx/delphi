import math
from math import comb
g=9.81; vmin2=48.56; h0=1.0   # printed-glider placeholder from design-flyingfish.json: vmin^2 = 2*23.17/(1.225*.78)
# 1. launch-speed gate error: 0.5 m gate at 240 fps, +/-0.5 frame (uniform) at each end
for v0 in (7.5,8,10,12):
    frames=0.5/v0*240
    s_frame=math.sqrt(2)*(1/math.sqrt(12))/frames       # relative speed sd from two edge-timing errors
    H=g*h0+ (v0**2-vmin2)/2                             # = g*H  (J/kg *1)
    # bound B ∝ h0+(v0^2-vmin2)/2g ; dB/B = (v0^2 * 2*s_frame)/(2g*H_)/...
    Bm=h0+(v0**2-vmin2)/(2*g)
    rel=(2*v0**2*s_frame/(2*g))/Bm
    print(f"v0={v0}: gate {frames:.1f} frames, speed sd {100*s_frame:.1f}%, bound sd from speed alone {100*rel:.1f}%")
# 2. false/true refutation counts: P(>=2 of 30 above 1.10 bound) as function of per-flight exceedance prob p (independent flights)
for p in (0.01,0.03,0.05,0.10,0.20):
    P=1-sum(comb(30,k)*p**k*(1-p)**(30-k) for k in (0,1))
    print(f"per-flight exceedance p={p}: P(refute: >=2 of 30) = {P:.3f}")
# 3. effective sample: calibration errors are shared by all 30 flights; bound sd from L/D fit and vmin fit
for cv_LD in (0.05,0.10):
    print(f"if L/D fit from 10 drop glides has CV {cv_LD}, a shared +{1.645*cv_LD/math.sqrt(10)*100:.1f}% (95%) bias if drop errors independent; systematic (transient/Reynolds) bias unbounded")
