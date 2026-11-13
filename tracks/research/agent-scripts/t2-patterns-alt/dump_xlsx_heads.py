import sys,os,glob,openpyxl
# usage: dump_xlsx_heads.py DIR  -> sheet names, dims and first 4 rows of every sheet in each xlsx (read-only, untrusted data)
for f in sorted(glob.glob(sys.argv[1]+"/*.xlsx"),key=lambda s:int(''.join(c for c in s.split('MOESM')[-1] if c.isdigit()) or 0)):
    wb=openpyxl.load_workbook(f,read_only=True,data_only=True)
    print("#####",os.path.basename(f))
    for ws in wb.worksheets:
        print("  sheet",ws.title,ws.max_row,ws.max_column)
        for i,r in enumerate(ws.iter_rows(values_only=True)):
            if i>=4: break
            print("    ",[c for c in r[:10] if c is not None])
