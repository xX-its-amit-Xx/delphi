# Own calculation: KPP baseline vs measured chemotactic front, numbers from design-patterns.json (read, not re-fetched)
import math
D=0.1807; r=0.9985; c_meas=4.335   # mm^2/h, 1/h, mm/h (glucose+100uM aspartate wild type, per design file)
kpp=2*math.sqrt(r*D); print('KPP 2*sqrt(rD) mm/h =',round(kpp,4),' measured/KPP =',round(c_meas/kpp,2))
X=0.7874;Da=2.88;A=100
c=X*math.sqrt(r*A/(X+Da)); print('Narla Eq21 with fitted X: c mm/h =',round(c,3))
print('c^2/r =',round(c*c/r,3))
