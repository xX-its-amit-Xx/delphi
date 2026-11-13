"""Recompute the numbers used in the plain-language report from Cremer 2019 ED Fig 1c (MOESM11).
Usage: python -I calc.py <path to MOESM11.xlsx>"""
import sys,hashlib,math
sys.stdout.reconfigure(encoding='utf8')
import openpyxl
p=sys.argv[1]
print('sha256',hashlib.sha256(open(p,'rb').read()).hexdigest(),'bytes',len(open(p,'rb').read()))
wb=openpyxl.load_workbook(p,data_only=True)
for ws in wb:
    print('SHEET',ws.title)
    for row in ws.iter_rows(values_only=True):
        if any(c is not None for c in row): print(row)
