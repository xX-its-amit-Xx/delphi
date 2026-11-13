# Own arithmetic for t4-glide-alt. Inputs are labelled with their source.
nu_air=1.5e-5   # m2/s, kinematic viscosity of air (unverified background; the check below reproduces the paper's Re)
# 1. Re check against Fauli et al. Table I (arXiv 1811.12221): U [m/s], wing length L [m], quoted Re
for U,L,Re in [(1.2,0.035,2800),(1.7,0.05,5700),(2.4,0.08,12700)]:
    print('wild fruit Re calc',round(U*L/nu_air),'paper',Re)
# 2. Glide-range bound (registry law flight-climb-glide-law, glide_range_le: x <= h*(L/D)max)
LD=3.77   # plate_glide_eq.py output, coeff set A (matches Pomerenk & Ristroph 2408.08864 'value of 3.8 near 0.22')
for h,name in [(1.2,'1.2 m water column (Fauli tank height)'),(1.5,'1.5 m bench release (design-glide illustration)')]:
    print(name,'-> max horizontal range',round(h*LD,2),'m; Fauli tank is 0.25 m wide, so range/width =',round(h*LD/0.25,1))
# 3. Fruit: autorotation has no steady horizontal glide; glide_range_le with (L/D)max ~ 0 gives x<=0 (no information on descent speed)
print('fruit: range bound = h*0 = 0 m: the glide-range law is vacuous for a vertical autorotating sink')
