# kcnk5b WT vs alf: all-atom MD (molecular rung of the kcnk5b fin-size chain)

Status (2026-10-31 22:45 EDT): **structure step done; MD systems built and partly equilibrated; production is BLOCKED
by the 2-GPU fair-use cap** (sibling sessions' jobs hold both GPU slots; see "Status and hand-off" at the end).
The MD part of Results is empty until a GPU slot frees up. Everything after that is automated on the cluster.

## Question
The kcnk5b chain in `genotype/causal-chains.json` / `genotype/CAUSAL.md` rests on dominant gain-of-function
`alf` alleles that raise K+ conductance about two-fold in Xenopus oocytes (Perathoner 2014), and the sign of the
downstream membrane-potential change is disputed (Perathoner 2014: hyperpolarisation in oocytes; Jiang 2024: net
Na+-channel-dependent depolarisation in fin-bud cells). MD cannot settle the cell-level sign: that depends on the
cell's other conductances. MD can ask the step below it: **do the alf substitutions change the channel's own
structure in a direction consistent with higher K+ conductance** (wider or more stable filter, more open inner
gate or cavity, fewer lipid tails plugging the cavity through the fenestrations)?

## Allele positions (as sourced)
- `causal-chains.json` records only allele names (`alf^dty86d`/ty86d, `alf^dt30mh`/pfau), no residues.
- The cited full text (Perathoner et al. 2014 PLoS Genet, PMID 24453984, PMC3894163, cached at
  `genotype/cache/epmc_fulltext_PMC3894163.xml`) gives them: *"In both alf alleles, distinct missense mutations
  (W169L and F241Y) were identified in the coding sequence for kcnk5b"*; Fig. 3B: *"position 169 and 241"*; Fig. 6J
  legend names `kcnk5b (F241Y)` and `kcnk5b (W169L)`. The text does **not** say which allele carries which
  substitution, so both are simulated and labelled by substitution, not allele.
- Numbering was checked against UniProt Q6PFU3 (zebrafish Kcnk5b, 448 aa): residue 169 = W (TM2, `LLWGF`),
  residue 241 = F (TM4, `SLFFSW`). Perathoner place both "in two distinct TM domains towards the cytoplasmic side".

## Structure (what the model rests on)
- AlphaFold DB AF-Q6PFU3-F1 (model v6, AlphaFold Monomer v2.0): global pLDDT 69.5; residues 1-260 mean 88.5
  (P1/filter 1 93.2, P2/filter 2 93.1, TM2 87.9, TM4 85.9; W169 90.7, F241 84.8); C-terminal tail 261-448 mean 43.3
  (disordered). A monomer prediction cannot give the domain-swapped K2P dimer, so it was used only as a confidence
  check on the region modelled.
- **Template: PDB 6WM0**, mouse TASK-2 (Kcnk5, UniProt Q9JK62) cryo-EM in MSP1D1 nanodiscs at pH 8.5, 3.52 A
  (Li, Rietmeijer & Brohawn 2020 Nature). Chosen over 6WLV (pH 6.5) because alkaline pH is TASK-2's open/active
  state. PDB sequence search also returned 2026 TASK-2 entries (10OY, 10PB-10PF; pH 6.5 or drug-bound) and TREK/TRAAK
  structures (36-38 %); Perathoner 2014 themselves modelled on TRAAK 3UM7.
- Zebrafish Kcnk5b vs mouse TASK-2: ungapped over residues 1-260 (same numbering), 58.7 % identity over the aligned
  300 residues. W169 and F241 are conserved at the same positions in mouse TASK-2. **Note:** the TASK-2 pH sensor
  K245 (Li 2020) is **N245** in zebrafish Kcnk5b, so the zebrafish channel lacks that titratable gate residue (no
  protonation choice needed there); R224 is conserved.
- Dimer model: MODELLER 10.8, residues 6-260 of both protomers threaded on 6WM0 chains A+B (A-B CA symmetry
  restraint, `refine.slow`, 5 models, best DOPE -67412, GA341 1.0; CA RMSD to template 0.68 A). C-terminus after 260
  omitted (not resolved in the template, pLDDT < 50); termini left charged (both intracellular).
- Inter-subunit disulfide C51-C51 in the cap (present in template, conserved).
- Mutants W169L and F241Y were introduced **into the WT model in place** (both protomers; homomeric, as in the oocyte
  GOF recordings), optimising only the mutated side chains (MODELLER mutate recipe), so starting structures differ
  only at the substituted side chains. In vivo the alleles are heterozygous (WT/mutant heterodimers possible); not
  modelled.

## System
- Oriented into the OPM membrane frame of 6WM0 (z = membrane normal, 0 = bilayer centre, extracellular = +z).
- Filter: the 6WM0 K+ positions (S0..S4 at z = 16.4/11.1/8.3/5.2/1.7 A) were used to start with **K+ at S1 and S3,
  water at S2 and S4** (identical in all systems).
- POPC bilayer (254 lipids), 0.15 M KCl, neutralised (packmol-memgen 2025.1.29, `--dist 15 --dist_wat 17.5`,
  `--preoriented`); box 106.9 x 105.4 x 126.1 A (tleap `setBox vdw`, as packmol-memgen does), ~112,270 atoms.
  **All three systems share one packed environment**: the F241Y packing (the only packing that converged) with
  the WT and W169L proteins swapped in (CA fit 0.01 A; Tyr241 is the largest side chain at that site, so no clashes).
  Build log, so the choices are traceable:
  1. MODELLER wrote the model offset from the template frame; prep_system.py now superposes on 6WM0 before applying
     the OPM transform (checked: filter carbonyls centred on the axis, ions inside the filter).
  2. The first WT packing hit packmol's loop limit (`_FORCED` output). Its WT/W169L systems would not minimise
     (+1e6 kcal/mol stuck on a lipid carbon) and were discarded (only ~10 min of T4 time had been used).
  3. The F241Y OH clashed with an oleoyl tail of the WT packing (1.7 A), so F241Y had been packed separately;
     that packing converged and became the common environment.
  4. tleap reorders residues: filter K+ = resid 1-2, chain A = 3-257, chain B = 258-512, filter waters = first
     two waters (1395-1396). Restraint masks and analysis use this numbering.
  5. All three systems contain the same 91 sub-0.9 A lipid-lipid H contacts (packmol artefact). WT and F241Y
     minimised through them on the GPU; W169L's single-precision GPU minimisation stalled, so W169L got 300 steps
     of double-precision CPU minimisation first, then the identical GPU protocol (started ~25 min after the others).
- Force fields: Amber ff14SB (protein), Lipid21, TIP3P, Joung-Cheatham ions (AmberTools 24.8 tleap). ff14SB/Lipid21/
  TIP3P was chosen over ff19SB because ff19SB is meant for OPC water, whose pairing with Lipid21 is less tested.
- Hydrogen mass repartitioning (parmed HMassRepartition) for 4 fs steps.

## Simulation protocol (pmemd.cuda, AMBER 24; identical for all systems)
- Minimise 5000 steps (protein heavy atoms + filter ions/waters restrained 10 kcal/mol/A^2).
- Heat 0 -> 303.15 K, 250 ps NVT, Langevin (gamma 1/ps), same restraints.
- NPT, semi-isotropic (ntp=3, csurften=3, zero surface tension), MC barostat, 1 bar: 0.5 ns at 2 fs (5.0), 0.5 ns at
  2 fs (2.5), 0.5 ns at 4 fs (1.0) on heavy atoms + filter species, then 1 ns (0.5) and 1 ns (0.1) on backbone +
  filter species. Total equilibration 3.75 ns. The box shrinks ~18 % in volume during the first NPT stage as the
  packing vacuum closes (1.42 -> 1.16 million A^3), and pmemd.cuda crashed (illegal memory access) when the next
  stage was restrained to the larger-box minimised structure; so each stage is restrained to the previous stage's
  final structure, eq2 was moved to 2 fs, and a failed GPU stage is retried once.
- W169L minimisation was done on CPU (pmemd.MPI, double precision); some equilibration stages may have run on CPU
  (pmemd.MPI, `cpu_equil.sh`) while the GPU cap was full; same inputs, same order.
- Production: unrestrained NPT, 4 fs, 10 A cutoff, PME; frames every 50 ps; 2 independent replicas per system
  (new Maxwell velocities, seeds 11111 / 22221, same for every system), run in 2.5 ns segments until the GPU
  allocation ends.
- No applied field: a two-fold conductance difference cannot be resolved by counting permeation events at this
  sampling, so the comparison is structural (see Analysis).

## Compute
Explorer cluster, public `gpu` partition only, one GPU in total (a Tesla V100-SXM2-32GB; a first allocation landed
on a T4, which at ~50 ns/day would have left almost no production time, so it was cancelled and a V100 requested);
all 6 runs share it (~55-65 ns/day per process at 2 fs with 2-3 processes). Build and analysis ran on
`short` CPU nodes. Workdir `/scratch/shenoy.am/delphi-md/kcnk5b/` (trajectories stay there; nothing large in git).

## Analysis
(`scripts/analyze.py`) per frame after superposing on TM backbone: diagonal carbonyl-O distances at the four filter
levels (P1-P1 and P2-P2), filter backbone RMSD from the minimised start, K+ and water counts in S0-S4 and the cavity,
lipid-tail carbons in the cavity below the filter (fenestration plugging), closest lipid carbon to the pore axis,
lipid contacts of residues 169 and 241, and a HOLE-like pore-radius profile (HOLE "simple" radii; every 5th frame).
Uncertainty: first 2.5 ns of each replica discarded; 5 blocks per replica; pooled block SEM over both replicas;
replica means reported separately.

## Results

### 1. Structure step (static models; holds regardless of MD length)
Measured on the MODELLER dimer (chain A shown; chain B equivalent), relative to the selectivity-filter centre:

| residue | helix | depth below filter centre | distance from pore axis | contacts (heavy atoms < 4.5 A, excluding i+-1) |
|---|---|---|---|---|
| W169 (WT) | TM2 | 14.5 A | 20.8 A | V165, F166, V173 (TM2); **L233, W237 (TM4)** |
| L169 (W169L) | TM2 | 16.0 A | 21.5 A | V165, F166 only: **the TM2-TM4 contacts are lost** |
| F241 (WT) | TM4 | 17.0 A | 12.0 A | **L167 (TM2)**; W237, L238, W244, N245 (TM4) |
| Y241 (F241Y) | TM4 | 16.7 A | 12.3 A | same as F241; the new OH has **no polar partner** in the protein (< 3.6 A), it points to the lipid (in the first packing it sat 1.7 A from an oleoyl tail) |

- Both alf substitutions sit at **one TM2-TM4 interface in the inner leaflet, both touching TM4 W237**, at the depth of
  the inner cavity, 12-21 A from the pore axis. Neither lines the conduction pathway, so a direct effect on the
  filter or on pore radius in the static model is excluded (the static pore profiles are identical by construction:
  same backbone, and the side chains are far from the axis).
- In K2P channels the TM2-TM4 interface below the P helices forms the lateral fenestrations and couples TM4
  movement to filter (C-type) gating. A structural reading that would fit gain of function: W169L removes TM2-TM4
  packing and F241Y puts a polar group into the lipid-facing TM2/TM4 groove; both would change how TM4 packs
  against TM2 and how lipid enters the fenestration. This is a **hypothesis from the model, not an MD result**.
- Context from the template: in mouse TASK-2 the pH gate is K245 at the cytoplasmic end of TM4 (Li et al. 2020).
  Zebrafish Kcnk5b has N245 there, the neighbour of the F241 contact set (F241 contacts N245). So both alf sites
  are on the same TM4 segment that carries TASK-2's gating machinery.

### 2. MD (WT vs W169L vs F241Y)
(pending; see Status)

## Files
- `scripts/`: every input used (MODELLER, orientation, packing, tleap, mdin generator, run and analysis scripts).
- `data/`: summary.json, per-frame tables, pore profiles. `plots/`: figures.

## Status and hand-off (written 2026-10-31 22:45 EDT)
**Why there is no MD result yet.** The task allows ONE GPU, and our hard cap across all sessions is 2 running GPU
jobs. The GPU job ran on a V100 from 19:18 to 19:38 (minimisation, heating and 0.5 ns NPT for WT and F241Y) and
crashed at the next stage (fixed since; see protocol). By then two sibling jobs (`r54_txt30_f2/f3`, gyorilab H200,
both started 19:18) held the cap, so the rebuilt job has been **held** ever since. When those ended (~22:28),
`r54_txtimg_f3` (dependency) and `mol1-run` started straight away, and more sibling jobs are queued behind them
(`r54_txtimg_f2`, `mol1-pilotA2` array, `r51_*` chain). Note: for those 20 minutes (19:18-19:38) three GPUs were in use
(my V100 plus the two r54 jobs, which started in the same minute as mine; my pre-submit check at 19:17 showed none
running). Nothing of mine has touched a GPU since.

**What runs unattended (all under shenoy.am, default account):**
| job | what |
|---|---|
| 11536511 `kcnk5b-md` (gpu, 1x V100-SXM2, 8 h, HELD) | full protocol, 3 systems x 2 replicas on one GPU; resumable; on start it cancels the CPU equilibration jobs below and continues from their last completed stage |
| 11536512 `kcnk5b-capwatch` (short, 1 core) | every 2 min: releases 11536511 only when fewer than 2 GPU jobs of shenoy.am are RUNNING |
| 11536336 / 11534945 / 11536945 `eqWT/eqF241Y/eqW169L` (short, 32 cores each) | CPU pmemd.MPI equilibration while waiting (~5 ns/day at 2 fs; too slow for production) |
| 11537591 (begins 07:30) and 11537592 (begins 11:00) `kcnk5b-ana` | analysis + plots of all *completed* production segments into `/scratch/shenoy.am/delphi-md/kcnk5b/analysis` and `.../analysis_1100` |

**To finish (hub or whoever picks this up):**
- If the lab decides this job may have a GPU slot: `ssh explorer scontrol release 11536511` (only if that keeps the
  total at 2 or fewer). Expected yield on a V100 after ~1.4 h of equilibration: ~260 ns/day total, i.e. ~10-12 ns per
  replica (6 replicas) in one 8 h job.
- Copy results back (small files only):
  `scp -r explorer:/scratch/shenoy.am/delphi-md/kcnk5b/analysis/{summary.json,frames_*.tsv,profile_*.npy,zgrid.npy,run_log_tail.txt} md/kcnk5b/data/`
  and `scp explorer:/scratch/shenoy.am/delphi-md/kcnk5b/analysis/plots/*.png md/kcnk5b/plots/`
- Stop everything: `ssh explorer scancel 11536511 11536512 11536336 11534945 11536945 11537591 11537592`.
- How to read `summary.json`: per system, `mean` = mean of replica means, `sem` = pooled block SEM, `delta_vs_WT` with
  propagated SE. The structural prediction to test: W169L/F241Y change TM2-TM4 packing, so look first at
  `lip_cav` / `lip_axis` (lipid in the cavity/fenestration), `r_cavity_min`, `r_inner_min`, `lip169`/`lip241`, then
  filter metrics (`dT..dY`, `K_S*`, `filt_rmsd`). A difference smaller than ~2 SE, or not seen in both replicas, is
  not a result.
