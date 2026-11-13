import openpyxl,statistics as st
# Own calculation: mean front speed vs agar % from Liu 2019 Fig 5a (triplicates, TB cols 1-3, CAA cols 4-6)
ws=openpyxl.load_workbook("D:/Users/ashenoy00000/delphi-work/data/t2alt/liu2019/MOESM11.xlsx",read_only=True,data_only=True)["Fig. 5a"]
rows=[r for r in ws.iter_rows(values_only=True) if isinstance(r[0],(int,float))]
for r in rows:
    tb=st.mean(r[1:4]); caa=st.mean(r[4:7]); print("agar %.3f%%  TB %.2f  CAA %.2f mm/h"%(r[0],tb,caa))
t0=st.mean(rows[0][1:4]); t4=st.mean(rows[-1][1:4]); c0=st.mean(rows[0][4:7]); c4=st.mean(rows[-1][4:7])
print("TB 0.2->0.3%%: %.2f -> %.2f (x%.2f);  CAA: %.2f -> %.2f (x%.2f)"%(t0,t4,t4/t0,c0,c4,c4/c0))
