# Pre-registration: cs-xenobots (written 2026-11-14T04:17:22Z, before any paper was fetched in this run)

Candidate papers (fixed list from the task): 
- 10.1073/pnas.1910837117 (PNAS 2020), 10.1126/scirobotics.abf1571 (Sci Robot 2021),
  10.1073/pnas.2112672118 (PNAS 2021), 10.1002/advs.202303575 (Adv Sci 2023).

## Holdout rule (cannot be tuned)
Compute sha256 of each lowercase DOI string (no prefix, no newline). Sort ascending.
The TWO papers with the smallest hashes are HELD OUT; the other two are DEVELOPMENT.
Hashes are in doi_hashes.txt (first two lines = held out).
If a paper's text cannot be opened, it is reported as missing; the split is not changed.

## Statements under test (units SI)
S1 low-Reynolds speed bound: v <= mu/(rho*D)  (Re<=1), mu=1.0e-3 Pa s, rho=1000 kg/m3. No free constant.
   Calibrated companion S1c: v <= k_v * D per second, k_v = 2 x the largest v/D seen in development papers.
S2 energy-store lifetime bound: lifespan <= T_max. Free constant T_max = 2 x the longest
   unfed lifespan stated in development papers.
S3 oxygen diffusion size limit: radius R <= sqrt(6*Dox*C0/Q), Dox=2.0e-9 m2/s, C0=0.25 mol/m3,
   Q=1.0e-2 mol/m3/s (high-end tissue uptake) -> R_max = 0.548 mm (diameter 1.10 mm). No free constant.
S4 replication generation bound: generations G <= G_max. Free constant G_max = 2 x largest G in development
   papers; if no development paper reports generations, S4 is UNTESTABLE on calibrated form and is
   reported as such (not silently replaced).

## Final evaluation (run once)
Metric: fraction of held-out measurements that satisfy their bound (coverage), plus median log10 slack
(bound/observed) as tightness. Baseline (trivial model): bound = the largest value of that quantity seen in
development papers (no physics, no safety factor). Broken-input control: rotate the quantity labels of
the held-out records (speed->size->lifespan->...) and rescore; coverage must drop or slack must become absurd.
The factor 2 safety margins above are fixed now and will not be changed after seeing held-out values.

## Honest caveat written in advance
The agent has general prior knowledge of these papers from training (cannot be un-known); the split protects
only against tuning constants on held-out numbers in this run. n will be small.
