"""Ceiling arithmetic from published numbers. Run: python ceiling_calc.py"""
import math
# Landrum & Riniker 2024: Kendall tau between assays (min curation 0.51, max curation 0.71).
# Bivariate-normal identity r = sin(pi*tau/2). Two assays with equal reliability rho: r_between = rho,
# so a perfect predictor of the true value correlates sqrt(rho) with a single noisy assay.
for name,tau in (("minimal",0.51),("maximal",0.71)):
    r=math.sin(math.pi*tau/2); print(name,"tau",tau,"r_between",round(r,3),"ceiling r =sqrt(rho)",round(math.sqrt(r),3))
# Kramer 2012: max R^2 = 0.81 -> r
print("Kramer max r",round(math.sqrt(0.81),3))
# generic: sigma_noise 0.54/sqrt2 .. 0.54 ; label SD s_y
for s_y in (1.4,1.8,2.2):
    for sig in (0.38,0.54):
        print("sd_y",s_y,"sigma",sig,"ceiling r",round(math.sqrt(1-sig**2/s_y**2),3))
