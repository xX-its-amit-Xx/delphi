import math
W=0.06*9.81; S=0.006377+0.001837+0.004474; rho=1.225; CL=0.78; LD=4.37; g=9.81; d=0.14
vmin=math.sqrt(2*W/(rho*S*CL))
print('W',W,'S',S,'W/S',W/S,'vmin',vmin)
for v0 in (10,15,20): print(v0,'level glide bound m (no ground effect)',LD*(v0**2-vmin**2)/(2*g),'with 14% ground effect',LD*(v0**2-vmin**2)/(2*g)/(1-d))
# launch speed needed for 50 m with ground effect
x=50; H=x*(1-d)/LD; print('v0 min for 50 m',math.sqrt(vmin**2+2*g*H))
print('50 m from 8 m height needs L/D',50/8)
print('L3 stall at CLmax 1.03',vmin*math.sqrt(0.78/1.03))
