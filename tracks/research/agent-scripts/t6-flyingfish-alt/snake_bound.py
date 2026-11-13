# Energy-height range bound (Delphi.glide_range_le: x <= h*LDmax, no thrust, lift=weight)
# applied to Socha 2005 flying-snake glides. Inputs are quoted from the abstracts fetched on 2026-11-12:
#  Socha 2005 (doi 10.1242/jeb.01579): h=9.62 m, x=10.14+-2.69 m, airspeed 10.0+-0.9 m/s, min glide angle 28+-10 deg, min recorded 13 deg
#  Holden 2014 (doi 10.1242/jeb.090902): 2-D cross-section max L/D 2.7 (water tunnel, Re 3000-15000)
import math, json
g=9.81; h=9.62; x=10.14; sd=2.69; v=10.0; LD2d=2.7
LD_angle13=1/math.tan(math.radians(13))
out={}
out["x_over_h_observed"]=x/h
out["LD_from_min_recorded_angle_13deg"]=LD_angle13
out["bound_no_KE_LD2.7"]=h*LD2d
out["bound_no_KE_LD13deg"]=h*LD_angle13
KE=v*v/(2*g)
out["KE_height_at_10ms_m"]=KE
out["bound_with_KE_LD2.7"]=(h-KE)*LD2d
out["bound_with_KE_LD13deg"]=(h-KE)*LD_angle13
out["mean_plus_1sd_x"]=x+sd
for k,val in out.items(): print(k,round(val,3))
# Chen 2026 CFD lift coefficients: taxiing vs gliding
print("CL taxiing/gliding", 2.15/0.57)
json.dump(out,open("snake_bound_result.json","w"),indent=1)
