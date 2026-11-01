"""WT vs alf (W169L, F241Y) Kcnk5b MD analysis. Run on Explorer in the md env.
Amber numbering (tleap reordered): resid 1-2 filter K+, chain A res n -> resid n-3 (3-257), chain B res n -> resid n+252 (258-512), filter waters went to the solvent block."""
import glob, json, os, sys, numpy as np
import MDAnalysis as mda
from MDAnalysis.analysis import align
from scipy.optimize import minimize

RUN = '/scratch/shenoy.am/delphi-md/kcnk5b/run'
OUT = os.environ.get('OUT', '/scratch/shenoy.am/delphi-md/kcnk5b/analysis')
os.makedirs(OUT, exist_ok=True)
SYSTEMS = os.environ.get('SYSTEMS', 'WT W169L F241Y').split()
DISCARD_NS = float(os.environ.get('DISCARD_NS', 2.5))
NBLK = 5
A = lambda n: n - 3
Bc = lambda n: n + 252
F1 = [98, 99, 100, 101, 102]    # T I G Y G
F2 = [203, 204, 205, 206, 207]  # T V G F G
RAD = {'C': 1.85, 'N': 1.8, 'O': 1.65, 'S': 2.0}  # HOLE "simple" radii
TM = '(resid 3-512) and name CA and not (resid %d-%d or resid %d-%d)' % (A(6), A(20), Bc(6), Bc(20))
ZGRID = np.arange(-30.0, 22.0, 1.0)


def strands(u):
    """4 filter strands (P1A, P2A, P1B, P2B) -> list of AtomGroups ordered T,I,G,Y,G."""
    return [[u.select_atoms('resid %d' % f(r)) for r in F] for f in (A, Bc) for F in (F1, F2)]


def hole_profile(prot_xyz, prot_r, center_xy, zgrid):
    """HOLE-like: at each z, largest sphere centred in that plane (within 6 A of the axis) touching no atom."""
    out = []
    for z in zgrid:
        m = np.abs(prot_xyz[:, 2] - z) < 8.0
        P, Rr = prot_xyz[m], prot_r[m]
        if len(P) < 10:
            out.append(np.nan)
            continue

        def f(p):
            q = np.array([p[0], p[1], z])
            return -np.min(np.linalg.norm(P - q, axis=1) - Rr)
        best = None
        for dx, dy in ((0, 0), (1.5, 0), (-1.5, 0), (0, 1.5), (0, -1.5)):
            r = minimize(f, center_xy + np.array([dx, dy]), method='Nelder-Mead',
                         options={'xatol': 0.05, 'fatol': 0.01, 'maxiter': 200})
            if np.linalg.norm(r.x - center_xy) > 6:
                continue
            if best is None or r.fun < best:
                best = r.fun
        out.append(-best if best is not None else np.nan)
    return np.array(out)


def block_means(x, nb=NBLK):
    x = np.asarray(x, float)
    x = x[~np.isnan(x)]
    if len(x) < nb:
        return []
    return [blk.mean() for blk in np.array_split(x, nb)]


def analyse(v, r):
    d = os.path.join(RUN, v)
    segs = sorted(glob.glob(os.path.join(d, os.environ.get('SEGPAT', 'prod_r%d_s*.nc') % r)))
    def _done(f):
        try:
            return 'Final Performance Info' in open(f[:-3] + '.out').read()
        except OSError:
            return False
    segs = [f for f in segs if _done(f)]  # completed segments only (rst7 is also written mid-run)
    if not segs:
        return None
    top = os.path.join(d, '%s_hmr.parm7' % v)
    u = mda.Universe(top, segs, format='NCDF')
    import parmed
    from MDAnalysis.coordinates.memory import MemoryReader
    rc = np.asarray(parmed.amber.Rst7.open(os.path.join(d, 'min.rst7')).coordinates, dtype=np.float32).reshape(1, -1, 3)
    ref = mda.Universe(top, rc, format=MemoryReader)
    ref.atoms.translate([0, 0, -ref.select_atoms('resname PC and name P31').positions[:, 2].mean()])
    st = strands(u)
    stref = strands(ref)
    prot = u.select_atoms('resid 3-512 and not name H*')
    prot_r = np.array([RAD.get(n[0], 1.85) for n in prot.names])
    K = u.select_atoms('name K+')
    W = u.select_atoms('resname WAT and name O')
    lipC = u.select_atoms('resname PA OL and name C*')
    res169 = u.select_atoms('(resid %d or resid %d) and not name N CA C O H*' % (A(169), Bc(169)))
    res241 = u.select_atoms('(resid %d or resid %d) and not name N CA C O H*' % (A(241), Bc(241)))
    lipall = u.select_atoms('resname PA PC OL and not name H*')
    lipP = u.select_atoms('resname PC and name P31')
    fbb_ref = np.concatenate([g.select_atoms('name N CA C O').positions for s in stref for g in s])
    tm_ref = ref.select_atoms(TM)
    tm_ref_xyz = tm_ref.positions.copy()
    tm_ref_c = tm_ref_xyz.mean(0)
    mob = u.select_atoms(TM)
    seg_ns = float(os.environ.get('SEG_NS', 2.5))
    nper = None
    rows, prof = [], []
    for i, ts in enumerate(u.trajectory):
        if nper is None:
            nper = max(1, u.trajectory.n_frames // len(segs))
        t_ns = (i + 1) * seg_ns / nper
        c = mob.center_of_geometry()
        Rm, rmsd_tm = align.rotation_matrix(mob.positions - c, tm_ref_xyz - tm_ref_c)
        u.atoms.translate(-c)
        u.atoms.rotate(Rm)
        u.atoms.translate(tm_ref_c)
        zc = lipP.positions[:, 2].mean()   # bilayer centre -> z = 0 (OPM-like frame)
        u.atoms.translate([0, 0, -zc])
        O = np.array([[g.select_atoms('name O').positions[0] for g in s] for s in st])  # 4 strands x 5 res
        OG1 = np.array([s[0].select_atoms('name OG1').positions[0] for s in st])
        axis_xy = O[:, :4].reshape(-1, 3)[:, :2].mean(0)
        zO = O[:, :, 2].mean(0)
        zOG = OG1[:, 2].mean()
        if os.environ.get('DEBUG') and i < 2:
            print('DEBUG zc', zc, 'zOG', zOG, 'zO', zO, 'K z', K.positions[:2, 2], 'axis', axis_xy, 'Oz per strand', O[:, :, 2].round(1).tolist(), flush=True)
        # diagonal O-O widths at T, I/V, G, Y/F carbonyls: P1A-P1B (0,2), P2A-P2B (1,3)
        diag = [(np.linalg.norm(O[0, k] - O[2, k]) + np.linalg.norm(O[1, k] - O[3, k])) / 2 for k in range(4)]
        fbb = np.concatenate([g.select_atoms('name N CA C O').positions for s in st for g in s])
        frmsd = np.sqrt(((fbb - fbb_ref) ** 2).sum(1).mean())
        edges = {'S0': (zO[3], zO[3] + 3.5), 'S1': (zO[2], zO[3]), 'S2': (zO[1], zO[2]),
                 'S3': (zO[0], zO[1]), 'S4': (zOG, zO[0]), 'cav': (zOG - 10.0, zOG)}

        def occ(ag, rad):
            p = ag.positions
            inr = np.linalg.norm(p[:, :2] - axis_xy, axis=1) < rad
            return {k: int(np.sum(inr & (p[:, 2] >= lo) & (p[:, 2] < hi))) for k, (lo, hi) in edges.items()}
        ko = occ(K, 2.5)
        wo = occ(W, 2.5)
        wcav = occ(W, 7.0)['cav']
        p = lipC.positions
        rr = np.linalg.norm(p[:, :2] - axis_xy, axis=1)
        zwin = (p[:, 2] < zOG - 2) & (p[:, 2] > zOG - 14)
        lip_cav = int(np.sum((rr < 8.0) & zwin))
        lip_axis = float(np.min(rr[zwin], initial=99.0))

        def lipcont(sc):
            dd = np.linalg.norm(lipall.positions[:, None, :] - sc.positions[None, :, :], axis=2)
            return int(np.sum(dd.min(1) < 4.5))
        row = dict(t_ns=t_ns, tm_rmsd=rmsd_tm, filt_rmsd=frmsd, dT=diag[0], dI=diag[1], dG=diag[2], dY=diag[3],
                   K_filter=sum(ko[k] for k in ('S0', 'S1', 'S2', 'S3', 'S4')),
                   W_filter=sum(wo[k] for k in ('S1', 'S2', 'S3', 'S4')),
                   W_cav=wcav, lip_cav=lip_cav, lip_axis=lip_axis, lip169=lipcont(res169), lip241=lipcont(res241),
                   zOG=zOG, zO_T=zO[0], zO_Y=zO[3])
        row.update({'K_' + k: ko[k] for k in ko})
        row.update({'W_' + k: wo[k] for k in wo})
        if i % 5 == 0:
            pr = hole_profile(prot.positions, prot_r, axis_xy, ZGRID)
            prof.append(np.concatenate([[t_ns, zOG], pr]))
            row['r_filter_min'] = float(np.nanmin(pr[(ZGRID >= zOG) & (ZGRID <= zO[3])]))
            row['r_cavity_min'] = float(np.nanmin(pr[(ZGRID < zOG - 2) & (ZGRID > zOG - 12)]))
            row['r_inner_min'] = float(np.nanmin(pr[(ZGRID <= zOG - 12) & (ZGRID >= -26)]))
        rows.append(row)
    return rows, np.array(prof)


METRICS = ['filt_rmsd', 'dT', 'dI', 'dG', 'dY', 'K_filter', 'K_S0', 'K_S1', 'K_S2', 'K_S3', 'K_S4', 'K_cav',
           'W_filter', 'W_cav', 'lip_cav', 'lip_axis', 'lip169', 'lip241', 'r_filter_min', 'r_cavity_min',
           'r_inner_min', 'tm_rmsd']

if __name__ == '__main__':
    res = {}
    for v in SYSTEMS:
        for r in (1, 2):
            out = analyse(v, r)
            if out is None:
                continue
            rows, prof = out
            res[(v, r)] = rows
            np.save(os.path.join(OUT, 'profile_%s_r%d.npy' % (v, r)), prof)
            keys = ['t_ns'] + sorted({k for row in rows for k in row} - {'t_ns'})
            with open(os.path.join(OUT, 'frames_%s_r%d.tsv' % (v, r)), 'w') as f:
                f.write('\t'.join(keys) + '\n')
                for row in rows:
                    f.write('\t'.join('%.4g' % row.get(k, np.nan) for k in keys) + '\n')
            print(v, r, len(rows), 'frames', round(rows[-1]['t_ns'], 2), 'ns', flush=True)
    np.save(os.path.join(OUT, 'zgrid.npy'), ZGRID)
    summary = {'discard_ns': DISCARD_NS, 'n_blocks_per_replica': NBLK}
    for v in SYSTEMS:
        reps = [res[(v, r)] for r in (1, 2) if (v, r) in res]
        if not reps:
            continue
        s = {'ns_per_replica': [round(rp[-1]['t_ns'], 2) for rp in reps]}
        for m in METRICS:
            repmeans, blocks = [], []
            for rp in reps:
                x = np.array([row.get(m, np.nan) for row in rp if row['t_ns'] > DISCARD_NS], float)
                x = x[~np.isnan(x)]
                if len(x) == 0:
                    continue
                repmeans.append(float(x.mean()))
                blocks += block_means(x)
            if not repmeans:
                continue
            sem = float(np.std(blocks, ddof=1) / np.sqrt(len(blocks))) if len(blocks) > 1 else float('nan')
            s[m] = dict(mean=float(np.mean(repmeans)), sem=sem, replica_means=repmeans)
        summary[v] = s
    for v in ('W169L', 'F241Y'):
        if v in summary and 'WT' in summary:
            summary[v]['delta_vs_WT'] = {
                m: dict(delta=summary[v][m]['mean'] - summary['WT'][m]['mean'],
                        se=float(np.hypot(summary[v][m]['sem'], summary['WT'][m]['sem'])))
                for m in METRICS if m in summary[v] and m in summary['WT']}
    json.dump(summary, open(os.path.join(OUT, 'summary.json'), 'w'), indent=1)
    for v in SYSTEMS:
        if v in summary:
            print(v, {m: (round(x['mean'], 3), round(x['sem'], 3)) for m, x in summary[v].items()
                      if isinstance(x, dict) and 'mean' in x})
