"""Plain-language numbers. Usage: python -E -P calc2.py <MOESM11.xlsx>
Reads Cremer 2019 ED Fig 1c; computes (1) one-number fit u^2=k*r on 6 wild-type aspartate rows,
(2) its error on held-out rows, (3) Fisher-Kolmogorov (no chemotaxis) speed 2*sqrt(D*r) with D=50.2 um^2/s."""
import sys,math,openpyxl
sys.stdout.reconfigure(encoding='utf8')
ws=openpyxl.load_workbook(sys.argv[1],data_only=True).active
rows=[r for r in ws.iter_rows(min_row=3,values_only=True) if r[0] and r[8] is not None and isinstance(r[8],(int,float))]
fit=[r for r in rows if r[0]=='HE206' and r[1]=='wt' and r[5]=='Aspartate']
print('fit rows',len(fit))
k=sum(r[8]**2*r[11] for r in fit)/sum(r[11]**2 for r in fit)   # least squares through origin of u^2 on r
print('k mm^2/h = %.3f'%k)
for r in fit: print(' fit',r[2],'u=%.3f r=%.3f pred=%.3f err=%+.1f%%'%(r[8],r[11],math.sqrt(k*r[11]),100*(math.sqrt(k*r[11])/r[8]-1)))
print('held-out (non wild-type, aspartate or serine, with inducer series):')
errs=[]
for r in rows:
    if r in fit or r[5] not in ('Aspartate','Serine'): continue
    pred=math.sqrt(k*r[11]); e=100*(pred/r[8]-1); errs.append(abs(e))
    print(' ',r[0],r[1],r[2],r[3],r[4],r[5],'u=%.3f r=%.3f pred=%.3f err=%+.1f%%'%(r[8],r[11],pred,e))
print('n heldout',len(errs),'min|err| %.1f max|err| %.1f'%(min(errs),max(errs)),'n within 15%%: %d'%sum(e<=15 for e in errs))
D=50.2e-12*3600*1e6  # m^2/s -> mm^2/h : 1 m^2/s = 3.6e9 mm^2/h
print('D mm^2/h',50.2e-12*3.6e9)
for name,u,r in [('glucose',4.3347312336,0.9985),('glycerol',3.67462190077778,0.7735)]:
    cF=2*math.sqrt(50.2e-12*3.6e9*r); print(name,'Fisher speed %.3f mm/h, measured/Fisher %.2f'%(cF,u/cF))
