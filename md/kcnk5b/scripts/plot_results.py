"""Plots for WT vs alf Kcnk5b MD. usage: python plot_results.py <analysis_dir> <out_dir>"""
import json, os, sys, glob
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

AN, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
COL = {'WT': '#2a78d6', 'W169L': '#eb6834', 'F241Y': '#1baf7a'}   # validated categorical slots 1-3
SYS = ['WT', 'W169L', 'F241Y']
INK, INK2, GRID = '#0b0b0b', '#52514e', '#e4e3df'
plt.rcParams.update({'font.size': 9, 'axes.edgecolor': INK2, 'axes.labelcolor': INK, 'xtick.color': INK2,
                     'ytick.color': INK2, 'axes.spines.top': False, 'axes.spines.right': False,
                     'axes.grid': True, 'grid.color': GRID, 'grid.linewidth': 0.6, 'figure.facecolor': '#fcfcfb',
                     'axes.facecolor': '#fcfcfb', 'savefig.facecolor': '#fcfcfb'})
S = json.load(open(os.path.join(AN, 'summary.json')))
z = np.load(os.path.join(AN, 'zgrid.npy'))
disc = S.get('discard_ns', 2.5)

# 1. pore radius profiles
fig, ax = plt.subplots(figsize=(4.2, 5.2))
for v in SYS:
    P = [np.load(f) for f in sorted(glob.glob(os.path.join(AN, 'profile_%s_r*.npy' % v)))]
    P = [p[p[:, 0] > disc] for p in P if len(p)]
    if not P:
        continue
    allp = np.vstack([p[:, 2:] for p in P])
    m, sd = np.nanmean(allp, 0), np.nanstd(allp, 0)
    ax.fill_betweenx(z, m - sd, m + sd, color=COL[v], alpha=0.15, lw=0)
    ax.plot(m, z, color=COL[v], lw=2, label='%s (n=%d frames)' % (v, len(allp)))
ax.axvline(1.4, color=INK2, lw=0.8, ls='--')
ax.text(1.45, z.max() - 1, 'water radius 1.4 A', color=INK2, fontsize=7, va='top')
ax.set_xlabel('pore radius (A)')
ax.set_ylabel('z along membrane normal (A; 0 = bilayer centre, + = extracellular)')
ax.set_xlim(0, 8)
ax.set_title('Pore radius, HOLE-like (mean +/- SD)', fontsize=9, color=INK, loc='left')
ax.legend(frameon=False, fontsize=7, loc='lower right')
fig.tight_layout()
fig.savefig(os.path.join(OUT, 'pore_radius.png'), dpi=160)
plt.close(fig)

# 2. metric comparison: dot = pooled mean, bar = +/- block SEM, small marks = replica means
groups = [('Filter geometry', [('dT', 'T carbonyl diag (A)'), ('dI', 'I/V carbonyl diag (A)'),
                               ('dG', 'G carbonyl diag (A)'), ('dY', 'Y/F carbonyl diag (A)'),
                               ('filt_rmsd', 'filter backbone RMSD (A)')]),
          ('Ions, water, lipid', [('K_filter', 'K+ in filter S0-S4'), ('W_filter', 'waters in S1-S4'),
                                  ('W_cav', 'cavity waters'), ('lip_cav', 'lipid tail C in cavity'),
                                  ('lip_axis', 'closest lipid C to axis (A)')]),
          ('Pore radius minima', [('r_filter_min', 'filter min radius (A)'), ('r_cavity_min', 'cavity min radius (A)'),
                                  ('r_inner_min', 'inner-gate min radius (A)'), ('lip169', 'lipid atoms near res 169'),
                                  ('lip241', 'lipid atoms near res 241')])]
fig, axes = plt.subplots(3, 5, figsize=(11, 6.6))
for gi, (gname, mets) in enumerate(groups):
    for mi, (m, lab) in enumerate(mets):
        ax = axes[gi, mi]
        for k, v in enumerate(SYS):
            d = S.get(v, {}).get(m)
            if not d:
                continue
            ax.errorbar(k, d['mean'], yerr=d['sem'], fmt='o', color=COL[v], ms=7, capsize=0, lw=2)
            for rm in d['replica_means']:
                ax.plot(k + 0.18, rm, marker='_', color=COL[v], ms=9, mew=1.5)
        ax.set_xticks(range(3))
        ax.set_xticklabels(SYS, fontsize=7)
        ax.set_title(lab, fontsize=8, color=INK, loc='left')
        ax.set_xlim(-0.5, 2.6)
        ax.grid(axis='x', visible=False)
fig.suptitle('WT vs alf: pooled mean +/- block SEM (dot), replica means (dash); first %.1f ns of each replica discarded'
             % disc, fontsize=9, color=INK, x=0.01, ha='left')
fig.tight_layout()
fig.savefig(os.path.join(OUT, 'metrics.png'), dpi=160)
plt.close(fig)

# 3. filter site occupancy
sites = ['K_S0', 'K_S1', 'K_S2', 'K_S3', 'K_S4', 'K_cav']
fig, ax = plt.subplots(figsize=(5.6, 3.2))
w = 0.26
for k, v in enumerate(SYS):
    vals = [S.get(v, {}).get(s, {}).get('mean', np.nan) for s in sites]
    errs = [S.get(v, {}).get(s, {}).get('sem', 0) for s in sites]
    ax.bar(np.arange(len(sites)) + (k - 1) * w, vals, w - 0.03, yerr=errs, color=COL[v], label=v,
           error_kw=dict(ecolor=INK2, lw=1))
ax.set_xticks(range(len(sites)))
ax.set_xticklabels(['S0', 'S1', 'S2', 'S3', 'S4', 'cavity'])
ax.set_ylabel('mean K+ count')
ax.set_title('K+ occupancy of filter sites (+/- block SEM)', fontsize=9, color=INK, loc='left')
ax.legend(frameon=False, fontsize=7)
ax.grid(axis='x', visible=False)
fig.tight_layout()
fig.savefig(os.path.join(OUT, 'filter_occupancy.png'), dpi=160)
plt.close(fig)

# 4. time series of key metrics
keys = [('r_inner_min', 'inner-gate min radius (A)'), ('lip_cav', 'lipid tail C in cavity'),
        ('K_filter', 'K+ in filter'), ('filt_rmsd', 'filter RMSD (A)')]
fig, axes = plt.subplots(len(keys), 1, figsize=(6.5, 7), sharex=True)
for v in SYS:
    for f in sorted(glob.glob(os.path.join(AN, 'frames_%s_r*.tsv' % v))):
        rep = f.rsplit('_r', 1)[1].split('.')[0]
        hdr = open(f).readline().strip().split('\t')
        D = np.genfromtxt(f, skip_header=1)
        if D.ndim == 1:
            continue
        t = D[:, 0]
        for ax, (k, lab) in zip(axes, keys):
            y = D[:, hdr.index(k)]
            ok = ~np.isnan(y)
            ax.plot(t[ok], y[ok], color=COL[v], lw=1.2 if rep == '1' else 0.8, ls='-' if rep == '1' else ':',
                    label='%s r%s' % (v, rep))
            ax.set_ylabel(lab, fontsize=7)
axes[0].legend(frameon=False, fontsize=6, ncol=3)
axes[-1].set_xlabel('production time (ns)')
fig.tight_layout()
fig.savefig(os.path.join(OUT, 'timeseries.png'), dpi=160)
plt.close(fig)
print('plots written to', OUT)
