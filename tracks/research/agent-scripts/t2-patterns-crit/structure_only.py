# Counts rows/columns of the QUARANTINED source-data sheets WITHOUT printing any numeric value.
import sys
sys.path.insert(0,'D:/Users/ashenoy00000/delphi-work/agents2/scratch/t2-patterns-crit/pylib')
import openpyxl
base='D:/Users/ashenoy00000/delphi-work/agents/scratch/scout-patterns/dl/cremer/'
for f in ['MOESM13','MOESM15','MOESM16','MOESM21']:
    wb=openpyxl.load_workbook(base+f+'.xlsx',data_only=True)
    for ws in wb:
        cols={}
        for row in ws.iter_rows(values_only=True):
            for j,c in enumerate(row):
                if isinstance(c,(int,float)): cols[j]=cols.get(j,0)+1
        hdr=[]
        for row in ws.iter_rows(min_row=1,max_row=3,values_only=True):
            hdr+= [str(c)[:30] for c in row if isinstance(c,str)]
        print(f,'|',ws.title,'|dims',ws.max_row,'x',ws.max_column,'| numeric cells per col',dict(list(cols.items())[:12]),'| header strings',hdr[:14])
