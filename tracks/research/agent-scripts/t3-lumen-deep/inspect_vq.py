import openpyxl,glob,sys
D='D:/Users/ashenoy00000/delphi-work/data/vasquez2021/x/Source Data/'
for f in sorted(glob.glob(D+'lumen_manuscript_figure*.xlsx')):
    wb=openpyxl.load_workbook(f,read_only=True,data_only=True)
    for ws in wb.worksheets:
        rows=list(ws.iter_rows(min_row=1,max_row=2,values_only=True))
        print(f.split('/')[-1],'|',ws.title,ws.max_row,ws.max_column); print('   ',[str(c)[:20] for c in rows[0]][:18])
