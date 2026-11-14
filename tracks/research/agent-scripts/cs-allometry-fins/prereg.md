# Pre-registration: cs-allometry-fins
Written (UTC, from shell): 2026-11-14T04:17:22Z -- before any kinematics data was downloaded or opened.

## Statements
A. Cruising swimmers have Strouhal number St = f*A/U in [0.2, 0.4] (f tail-beat frequency Hz, A peak-to-peak tail amplitude, U speed).
B. Tail-beat frequency is linear in length-specific speed: f = a + b*(U/L) (Bainbridge 1958 form U/L = 0.75*(f - 4/3), i.e. f = 4/3 + (4/3)*U/L).

## Held-out split (cannot be tuned)
Unit = whole SPECIES. A species is HELD OUT iff int(sha256(species_key), 16) % 5 == 0, where
species_key = binomial name, lower-cased, whitespace collapsed to one space, first two words only.
All records of a held-out species are untouched until one final evaluation.
Records are kept only if their taxonomic class is on an allow-list (ray-finned fishes, cartilaginous fishes, mammals, amphibians, reptiles, lampreys); everything else is dropped unseen.
Larval zebrafish (intermediate Reynolds number) are reported as a separate, pre-declared stratum, not pooled into the adult statement-A number.

## Metrics (fixed now)
A: fraction of held-out records with 0.2 <= St <= 0.4, with n, plus Wilson 95% interval. Baseline: fraction inside an equal-log-width band centred on the development median St (a band tuned on dev). Broken-input control: permute f across held-out records, recompute St; coverage must fall.
B: RMSE of predicted f (Hz) on held-out records, model fitted on development species only (ordinary least squares f ~ U/L). Baselines: (i) development-mean f; (ii) Bainbridge published line f = 4/3 + (4/3)*U/L, no fitting. Broken-input control: permute held-out f; RMSE must rise.
If a dataset lacks amplitude, A is evaluated only on records that report St or (f, A, U); this is stated, not patched with simulated values.

## Log
- 2026-11-14T04:20:32Z dev stage done (results_dev.json). Format-forced choices made before any held-out outcome was seen: underscores in species names treated as spaces; hagfish and lungfish rows (not on the pre-registered allow-list) dropped; statement A evaluated only on the one dataset that reports amplitude (Di Santo 2021); statement B primary = all held-out records pooled, fishes-only secondary. Final stage run once, next.
