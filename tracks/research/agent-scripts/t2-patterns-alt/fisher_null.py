import openpyxl,math,statistics as st,sys
# Own calculation: Fisher-KPP null speed c_F = 2*sqrt(D*r) vs measured front speed, Cremer 2019 ED Fig 1c.
# D = D_chemotaxis_1 = 50.2e-12 m^2/s (MOESM3.txt line 31) -> um^2/s 50.2 -> mm^2/h: 50.2e-6 mm^2/s *3600 s/h = 0.18072
D=50.2e-12*1e6*3600   # m^2/s -> mm^2/h
print("D =",D,"mm^2/h")
f="D:/Users/ashenoy00000/delphi-work/data/t2alt/cremer2019/MOESM11.xlsx"
ws=openpyxl.load_workbook(f,read_only=True,data_only=True).worksheets[0]
rows=[r for r in ws.iter_rows(values_only=True)][2:27]
ratios=[]
for r in rows:
    u,g=r[8],r[11]; cF=2*math.sqrt(D*g); ratios.append(u/cF)
    print("%-9s %-14s %-9s u=%.3f r=%.3f cF=%.3f u/cF=%.2f"%(r[1],r[2],r[5],u,g,cF,u/cF))
print("n=%d ratio min=%.2f median=%.2f max=%.2f"%(len(ratios),min(ratios),st.median(ratios),max(ratios)))
# log-log slope of u on r across all 25 rows (OLS)
x=[math.log(r[11]) for r in rows]; y=[math.log(r[8]) for r in rows]
mx,my=st.mean(x),st.mean(y); s=sum((a-mx)*(b-my) for a,b in zip(x,y))/sum((a-mx)**2 for a in x)
print("OLS log-log slope of u on r, all 25 rows: %.2f (Fisher/sqrt law: 0.5)"%s)
