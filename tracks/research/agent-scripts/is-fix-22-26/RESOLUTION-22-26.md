# Issues #22 to #26 of fractastical/delphi: what was checked and what to apply

Agent is-fix-22-26, 2026-11-13. Nothing was posted, committed or edited in the repo.
None of the five issues had any comments when read (api.github.com/repos/fractastical/delphi/issues/N/comments returned empty lists).
No Lean was run in this pass (time budget); every statement about Lean files below is from reading text, not from the kernel.

## #22 Track 6: evaluation framework on law set 1.8.1 - PARTLY
New file: `certificate-coverage.py` (this folder) -> proposed repo path `tracks/scripts/certificate-coverage.py`.
It scans `tracks/research/lean/*.lean` and `tracks/lean/*.lean` for theorems named `*rules_out*` / `*eliminate*`,
groups them by track prefix, reads the newest file in `lean/registry/lawsets/` and exits 1 if a track has none.
Output on the repo today (exit 1):
- newest law set file: lawset-1.8.1.json
- t1: 0 (HillSeparability.lean has 8 theorems, none is an elimination certificate)
- t2: 1 superlinear_rules_out
- t3: 2 lumen_area_rules_out, rules_out_example
- t4: 1 ld_rules_out
- t5: bilayer_rules_out (tracks/lean/HygromorphCeiling*.lean; mapped to t5 by file name, an assumption of the script)
- t6: 1 glide_range_polar_rules_out
So checkbox 1 is one theorem short: track 1 (reporter / Hill separability) needs a `*_rules_out`.
Checkbox 2 ("automatically"): add one line to the track build so the framework always names the newest set:
`python tracks/scripts/certificate-coverage.py . && python tracks/scripts/lawset-diff.py <previous> <newest>`.
Not done: writing and kernel-checking the t1 certificate; confirming each existing certificate with `tracks/lean/check.sh`.

## #23 Land the checked Timoshenko ceiling in lean/ThompsonLaws - PARTLY (target moved)
Facts checked:
- The application repo no longer has `lean/ThompsonLaws/` (ls fails locally).
- Public `fractastical/leanbio` has `lean/ThompsonLaws/Hygromorphs.lean`; its newest commit (cb92aafc, 2026-11-12)
  says "Move ThompsonLaws (12 modules) and DarwinLaws (4) in from Delphi's claim-sources".
- That public file defines `timoshenkoCoefficient` (line 28) and `bilayerCurvature` (line 32) in namespace
  `ThompsonLaws.Hygromorphs`, and has none of the five ceiling theorems
  (`amgm_step`, `timoshenkoCoefficient_le`, `timoshenkoCoefficient_eq_of_optimal`, `bilayerCurvature_optimal`, `bilayer_rules_out`).
To apply: paste the theorem block of `tracks/lean/HygromorphCeiling.lean` (from `theorem amgm_step` to the end of
`bilayer_rules_out`, lines 66 onward, without its own `import`/`namespace` lines) before the closing
`end ThompsonLaws.Hygromorphs` of leanbio's `lean/ThompsonLaws/Hygromorphs.lean`, then run the axiom audit there.
Not verified: that the two definitions in leanbio are textually identical to those the checked file assumes;
compare them before pasting (the check file was compiled against the old in-repo copy).
Decision still needed from the Lean owner: accept the paste into leanbio (the issue title's path is now in that repo).

## #24 14 of 59 pinned laws have no Lean theorem - PARTLY (ordering proposed)
Reproduced: `python tracks/scripts/lawset-diff.py 1.6.0 1.8.1` prints the same 14 names.
The four proposed-first laws all have `status: proposed` and `lean_ref.module = null` in `lean/registry/laws/<id>.json`.
Suggested order, cheapest first, with what already exists:
1. `aspect-ratio-induced-drag` - the induced-drag term is already used in `tracks/research/lean/t4-glide-law__MaxLiftToDrag.lean`
   (`ld_rules_out`, variables CD0 e AR CL CD) and `t6-flyingfish-law__DragPolarBound.lean`; promote that statement and point `lean_ref` at it.
2. `elastic-similarity` - leanbio already has `lean/ThompsonLaws/LimbBoneSimilarity.lean` (file seen in the tree, content not opened); check for overlap before writing anything new.
3. `fin-length-ratio` - a ratio band; a short inequality theorem.
4. `gene-regulatory-dynamics` - broadest; `t1-reporter-law__HillSeparability.lean` (8 Hill theorems) is the natural seed.
`test-loop-only-density-sanity` is retired: drop it from the "needs a theorem" count (13 real gaps, not 14).
The four `disc-*` entries are discovered empirical regularities; they need a data statement, not a derivation.
Missing single fact: the owner's yes/no on this order.

## #25 Law set drift: leanbio 1.6.0 vs application 1.8.1 - NEEDS-AMIT
Confirmed today from the public tree of fractastical/leanbio: `lean/registry/lawsets/` holds 1.0.0 to 1.6.0 plus `current.json`; no 1.7.0, 1.8.0 or 1.8.1.
The application repo holds 1.5.0 to 1.8.1. Diff 1.6.0 -> 1.8.1 = 6 added
(development-growth-asymptote, fisher-kpp-speed, kimura-heterozygosity, maynardsmith-hawk-dove, turing-ddi, and the retired test-loop-only-density-sanity), 0 removed, 0 status changes.
No path in leanbio contains `fisher-sex`, `hamilton-rule` or `turing-wavelength`, so the three unpinned law files exist only in the application repo.
Ready-to-apply sync (for whoever owns leanbio), from the application repo root:
  copy lean/registry/lawsets/lawset-1.7.0.json, -1.8.0.json, -1.8.1.json and the five lean/registry/proposals/<id>/law.lean files into the same paths in leanbio,
  update lawsets/current.json, add a CHANGELOG line, run leanbio's build.
Missing single fact: is leanbio the source of truth (application repo vendors it) or a mirror (application repo cuts sets and pushes)? Only the project lead can say.

## #26 Lean for Bio question 1: promoter-specific enhancer effects - PARTLY
The formal half exists in the repo, unlanded:
- `tracks/research/lean/q1-theory-lean__EnhancerPromoterRank.lean`: `no_reversal_of_monotone`, `mult_le_strict`, `logAdd_le_mult`,
  `certificate_singleIndex` ... `certificate_all`, `noisy_certificate` (reversal larger than noise bound eps), `twoFactor_reverses`.
- `tracks/research/lean/q1-mechanisms__RankSaturation.lean`: `no_reversal`, `strict_preserved`, `two_latent_reverses`.
Neither file has a theorem with `rules_out` in its name, so the coverage script counts q1 as 0; rename or alias
`certificate_singleIndex` to `single_index_rules_out` to match house style.
Not done here: the noise-only null simulation and the observed reversal rate in public MPRA/STARR-seq data (the "Needed" line of the issue);
no dataset was opened in this pass, so no rate is reported.
