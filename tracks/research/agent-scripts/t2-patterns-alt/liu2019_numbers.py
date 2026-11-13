import openpyxl,statistics as st,sys
D=sys.argv[1]
wb=openpyxl.load_workbook(D+"/MOESM11.xlsx",read_only=True,data_only=True)
print("--- Fig. 5a (agar %, TB speeds x3 then CAA speeds x3) ---")
for r in wb["Fig. 5a"].iter_rows(values_only=True):
    print([c for c in r if c is not None])
wb=openpyxl.load_workbook(D+"/MOESM7.xlsx",read_only=True,data_only=True)
ws=wb["Fig. 1c"]; rows=[r for r in ws.iter_rows(values_only=True)][2:]
print("--- Fig 1c: mean clone expansion speed (mm/h) per selection series, n clones ---")
for j,n in enumerate(["A 5mm","B 10mm","C 15mm","D 20mm","E 25mm"]):
    v=[r[j] for r in rows if r[j] is not None and isinstance(r[j],(int,float))]
    print(n,"n=%d mean=%.3f sd=%.3f"%(len(v),st.mean(v),st.stdev(v)))
