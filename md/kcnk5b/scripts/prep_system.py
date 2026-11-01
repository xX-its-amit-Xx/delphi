"""Orient a Kcnk5b dimer model (built in the 6WM0 frame) into the OPM membrane frame of 6WM0
(z = membrane normal, z=0 bilayer centre), place filter K+/waters, and list disulfides.
usage: python prep_system.py model.pdb outprefix"""
import sys, numpy as np
def read(fn, rec=('ATOM',)):
    out=[]
    for l in open(fn):
        if l[:6].strip() in rec:
            out.append(dict(name=l[12:16].strip(), resn=l[17:20].strip(), ch=l[21], resi=int(l[22:26]),
                            xyz=np.array([float(l[30:38]),float(l[38:46]),float(l[46:54])]), line=l))
    return out
def kabsch(P,Q):  # find R,t with R@P+t ~ Q
    pc,qc=P.mean(0),Q.mean(0); H=(P-pc).T@(Q-qc); U,S,Vt=np.linalg.svd(H)
    d=np.sign(np.linalg.det(Vt.T@U.T)); D=np.diag([1,1,d]); R=Vt.T@D@U.T; return R, qc-R@pc
model, pref = sys.argv[1], sys.argv[2]
tm = {(a['ch'],a['resi']):a['xyz'] for a in read('6WM0_prot.pdb') if a['name']=='CA'}
op = {(a['ch'],a['resi']):a['xyz'] for a in read('opm_6wm0.pdb') if a['name']=='CA'}
keys=sorted(set(tm)&set(op)); R,t=kabsch(np.array([tm[k] for k in keys]),np.array([op[k] for k in keys]))
Rto,tto=R,t
print('template->OPM fit on',len(keys),'CA; rmsd',np.sqrt(((np.array([R@tm[k]+t for k in keys])-np.array([op[k] for k in keys]))**2).sum(1).mean()).round(3))
atoms=read(model)
# model CA should already sit on template CA (MODELLER keeps the template frame)
mca={(a['ch'],a['resi']):a['xyz'] for a in atoms if a['name']=='CA'}
k2=sorted(set(mca)&set(tm))
R0,t0=kabsch(np.array([mca[k] for k in k2]),np.array([tm[k] for k in k2]))  # model -> template frame
dev=np.sqrt(((np.array([R0@mca[k]+t0 for k in k2])-np.array([tm[k] for k in k2]))**2).sum(1).mean())
print('model vs template CA rmsd after superposition',round(dev,3))
R,t=R@R0, R@t0+t   # model -> OPM
mca={k:R0@x+t0 for k,x in mca.items()}  # now in template frame (used below with template->OPM R,t)
Rt,tt=R,t
K=[a['xyz'] for a in read('6WM0_K.pdb',('HETATM',))]
K=np.array([Rto@k+tto for k in K]); order=np.argsort(K[:,2]); K=K[order]
ct=np.array([Rto@mca[('A',260)]+tto, Rto@mca[('B',260)]+tto]).mean(0)
print('K z (OPM frame):',K[:,2].round(2),' C-term (res260) z:',ct[2].round(2))
# extracellular side = far from the cytoplasmic C-termini
ext_up = K[:,2].mean() > ct[2]
sites = K[::-1] if ext_up else K   # sites[0]=S0 (outermost) ... sites[4]=S4
print('extracellular is +z' if ext_up else 'extracellular is -z')
lab=['S0','S1','S2','S3','S4']
with open(pref+'_oriented.pdb','w') as f:
    for a in atoms:
        x=Rt@a['xyz']+tt; l=a['line']; f.write(l[:30]+'%8.3f%8.3f%8.3f'%tuple(x)+l[54:])
    f.write('END\n')
# initial filter configuration: K+ at S1,S3; water at S0? no -> water at S2,S4 (equal for all systems)
with open(pref+'_filter.pdb','w') as f:
    n=1
    for i,(s,x) in enumerate(zip(lab,sites)):
        if s in ('S1','S3'): f.write('HETATM%5d K+    K+ X%4d    %8.3f%8.3f%8.3f  1.00  0.00           K\n'%(n,900+i,*x))
        elif s in ('S2','S4'): f.write('HETATM%5d  O   WAT X%4d    %8.3f%8.3f%8.3f  1.00  0.00           O\n'%(n,900+i,*x))
        n+=1
    f.write('END\n')
np.savetxt(pref+'_sites_z.txt',sites[:,2],header='S0..S4 z in OPM frame (template K+ positions)')
# disulfides
sg=[a for a in atoms if a['resn'] in('CYS','CYX') and a['name']=='SG']
with open(pref+'_ss.txt','w') as f:
    for i in range(len(sg)):
        for j in range(i+1,len(sg)):
            d=np.linalg.norm(sg[i]['xyz']-sg[j]['xyz'])
            if d<2.6: f.write('%s %d %s %d %.2f\n'%(sg[i]['ch'],sg[i]['resi'],sg[j]['ch'],sg[j]['resi'],d)); print('SS',sg[i]['ch'],sg[i]['resi'],sg[j]['ch'],sg[j]['resi'],round(d,2))
