# kcnk5b WT vs alf: all-atom MD (molecular rung of the kcnk5b fin-size chain)

Status: IN PROGRESS (results section filled when production finishes). Session log, 2026-10-31.

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
- POPC bilayer, 0.15 M KCl, neutralised (packmol-memgen 2025.1.29, `--dist 15 --dist_wat 17.5`). Mutants were
  placed into the identical WT-packed bilayer (protein swap with clash check) so that lipids, water and ions start
  identical across systems.
- Force fields: Amber ff14SB (protein), Lipid21, TIP3P, Joung-Cheatham ions (AmberTools 24.8 tleap). ff14SB/Lipid21/
  TIP3P was chosen over ff19SB because ff19SB is meant for OPC water, whose pairing with Lipid21 is less tested.
- Hydrogen mass repartitioning (parmed HMassRepartition) for 4 fs steps.

## Simulation protocol (pmemd.cuda, AMBER 24; identical for all systems)
- Minimise 5000 steps (protein heavy atoms + filter ions/waters restrained 10 kcal/mol/A^2).
- Heat 0 -> 303.15 K, 250 ps NVT, Langevin (gamma 1/ps), same restraints.
- NPT, semi-isotropic (ntp=3, csurften=3, zero surface tension), MC barostat, 1 bar: 0.5 ns at 2 fs (5.0), 0.5 ns at
  4 fs (2.5), 0.5 ns (1.0) on heavy atoms + filter species, then 1 ns (0.5) and 1 ns (0.1) on backbone + filter
  species. Total equilibration 3.75 ns.
- Production: unrestrained NPT, 4 fs, 10 A cutoff, PME; frames every 50 ps; 2 independent replicas per system
  (new Maxwell velocities, seeds 11111 / 22221, same for every system), run in 2.5 ns segments until the GPU
  allocation ends.
- No applied field: a two-fold conductance difference cannot be resolved by counting permeation events at this
  sampling, so the comparison is structural (see Analysis).

## Compute
Explorer cluster, public `gpu` partition only, one GPU in total; all 6 runs share it. Build and analysis ran on
`short` CPU nodes. Workdir `/scratch/shenoy.am/delphi-md/kcnk5b/` (trajectories stay there; nothing large in git).

## Analysis
(`scripts/analyze.py`) per frame after superposing on TM backbone: diagonal carbonyl-O distances at the four filter
levels (P1-P1 and P2-P2), filter backbone RMSD from the minimised start, K+ and water counts in S0-S4 and the cavity,
lipid-tail carbons in the cavity below the filter (fenestration plugging), closest lipid carbon to the pore axis,
lipid contacts of residues 169 and 241, and a HOLE-like pore-radius profile (HOLE "simple" radii; every 5th frame).
Uncertainty: first 2.5 ns of each replica discarded; 5 blocks per replica; pooled block SEM over both replicas;
replica means reported separately.

## Results
(pending)

## Files
- `scripts/`: every input used (MODELLER, orientation, packing, tleap, mdin generator, run and analysis scripts).
- `data/`: summary.json, per-frame tables, pore profiles. `plots/`: figures.
