import openpyxl,sys
D=sys.argv[1]
wb=openpyxl.load_workbook(D+"/MOESM12.xlsx",read_only=True,data_only=True)
ws=wb["Extended Data Figs 1e, f"]
rows=[r for r in ws.iter_rows(values_only=True)]
for r in rows[:3]: print([c for c in r if c is not None])
print("...")
for r in rows[-6:]: print([ (round(c,3) if isinstance(c,float) else c) for c in r[:7]])
