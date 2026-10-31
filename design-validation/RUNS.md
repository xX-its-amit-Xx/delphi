# Run log: design validation (winged zebrafish vs real flying fish)

Pre-registration `design-validation/PREREG.md`, sha256
`ea6f99eb25b48cdba85d2766b20bc4d8797dfa243c7c6dc784ef2815b72aaa76`, hashed 2026-10-31T22:00:34Z. `sha256sum -c
design-validation/PREREG.sha256` verifies. **No number in any part had been produced when that hash was taken.**

## Order of events

| # | time (UTC) | what happened |
|---|---|---|
| 0 | ~21:56 | Read, before the pre-registration was written: `physics/sim/PREREG.md` and `RUNS.md` (the form to follow); `genotype/compare-2x2.json` in full (the design specification, which already states its phenotype is figure-only); `genotype/cache/daane2021_fin_ratios.json`; `anatomy-model/zebrafish/manifest-adult.json`; `development/zebrafish/trajectory.mjs`; `physics/length-weight.csv`; `physics/glide-data.csv`; `physics/allometry.json`; `lean/AUDIT-FLYING-FISH.md`; the exports of `lean/eliminate/browser-check.mjs` and its test; the output of `check({})` on an EMPTY design (the 21 row ids and each row's required input); and the SHEET NAMES plus header rows of `genotype/cache/daane2021_data_s1_mmc2.xlsx`. **No data row of sheets G, I, J, K or M was read, and no design or real fish was passed through `check`.** |
| 1 | 21:58 | The project lead's sharpening arrived while PREREG.md was still unwritten and unhashed: make Part 3 an independently scored GATE with PASSES / FAILS / UNDECIDED, pre-register that UNDECIDED is not a pass, state the joint result as a pair with all four readings written out, name which outcome drops the claim, run the same gate on the real flying fish for side-by-side comparison, classify violations as `shared-with-real` / `design-only` / `passes-what-real-fails`, and report by ablation how many design parameters the gate really depends on. **All of it was folded into PREREG.md before hashing, so it is pre-registered, not an amendment.** |
| 2 | 22:00:34 | `PREREG.md` written and hashed to `PREREG.sha256`. Everything below follows the hash. |
| 3 | 22:02 | **Run 1, Part 2.** `C:\Temp\dval\part2.py` and `part2c.py` read the xlsx as the zip of XML it is (no external library, offline), following the existing pattern in `genotype/fin_ratios_table.py`. Results: (a) = 74, (b) = 1, (c) = 0.0135, (d) = 1. Sheets K and M found to be GO-term enrichment tables with no gene column. |
| 4 | 22:03 | **Run 2, whole-workbook gene search** (`part2b.py`): all 14 sheets searched for `kcnh2`, `lat4`, `slc43a2`, `prrx1`, `longfin`, `dt2`, `nr21`. Confirmed `lat4a` and `slc43a2a` share Ensembl ID `ENSORLG00000009715`, and that `kcnh2a` appears nowhere (only `kcnh2b` in sheet H). |
| 5 | 22:05 | **Run 3, Part 3 gate** (`gate.mjs`): `check()` on the REAL fish, on the DESIGN, and on a POST-HOC matched-input control. Verdicts FAILS / FAILS / UNDECIDED. Pre-registered ablation run in the same pass. |
| 6 | 22:06 | **Run 4, Part 1.** Per-axis table assembled from the files read at step 0. `n_scored` = 1, `n_cannot_score` = 9. |
| 7 | 22:07 | Xu et al. 2021 fetched (PMC8294118) to verify the 23,611 protein-coding gene count used as denominator context. Verified verbatim. |
| 8 | 22:08 | `scorecard.json`, `REPORT.md`, this file and `calls.json` written. |

No run was repeated after seeing its result, no threshold was changed, and no formula was altered after a number
appeared. There was no parameter to tune: Parts 1 and 2 are arithmetic over fixed files, and Part 3 calls an
existing module.

## Deviations from the pre-registration

### Deviation 1 (run 4, Part 1): the "close" default was refused

PREREG.md defines Part 1 FAIL by three triggers - (i) `n_scored >= 3` and median `f < 0.5`, (ii) the pectoral axis
scores FAIL, (iii) `n_scored = 0` - and defines "close" for the joint pair as "Part 1 did not FAIL by its own
criterion".

The actual result is `n_scored = 1`, so **none of the three triggers can fire**: (i) needs 3 scored axes, (ii)
needs the pectoral axis to be scoreable and it is not, (iii) needs zero scored axes and there is one. The letter of
the rule would therefore award **"close" by default** to a design whose only scored axis is a FAIL at `f = 0.00`.

**That reading is refused.** Part 1 is reported as NOT CLOSE / largely UNSHOWN, and the joint pair is
`(NOT CLOSE, FAILS)`.

- Why this is a defect in the pre-registration and not a retro-fit: the flaw is that "close" was defined
  negatively, so a near-total absence of scoreable data reads as success. The thresholds themselves
  (`0.8 <= f <= 1.2` for PASS, `f < 0.5` for FAIL) were **not changed**, and the axis list was **not changed**.
- **This deviation makes the result LESS favourable to the design, not more.** It cannot be a case of choosing a
  metric after seeing the numbers to flatter the design.
- The alternative - reporting "close" on a technicality - would have been the single most misleading sentence this
  thread could have produced.

### Deviation 2 (run 4, axis 7): a specification statement used as the design's value

Axis 7 (body mass vs SL exponent) is scored with `D = Z = 3.22`, on the grounds that the design changes nothing
about body growth and the authors state the nr21 mutant "does not have a statistically decreased body size". Strictly,
PREREG.md says CANNOT SCORE when the design "has no number", and the design has no **measured** exponent.

Scoring it is a deviation. It is recorded because:
- it is the only axis of the ten that can be scored at all, so suppressing it would leave Part 1 with
  `n_scored = 0` and no quantitative content whatsoever;
- the value is labelled in both `scorecard.json` and `REPORT.md` as **"SPECIFICATION STATEMENT, NOT A
  MEASUREMENT"**, so no reader can mistake it for a measurement of the double heterozygote;
- it yields `f = 0.00`, i.e. **FAIL**, so again the deviation is unfavourable to the design.

A reader who rejects this deviation should read Part 1 as `n_scored = 0`, which triggers PREREG FAIL condition
(iii) and makes the phenotypic result "NO RESULT / unshown". Either reading supports the report's conclusion; the
stricter one supports it more strongly.

## Items labelled POST-HOC (exploratory), not pre-registered, excluded from the headline

1. **Part 2 denominator sensitivity.** Adding sheet J (phyloP) to (a) gives (a) = 131, (b) = 1, (c) = 0.0076,
   which crosses from the pre-registered TOKEN band into the NEGLIGIBLE band. Reported because the choice of
   denominator changes the band and a reader is entitled to know. The pre-registered answer (0.0135) stands as the
   result.
2. **Part 3 matched-input control arm.** The real flying fish run through `check()` with only the inputs the design
   supplies (SL, mass, the same genotype edits). Verdict UNDECIDED. Reported because it shows the design's two
   violations come from being a different size from the reference specimen rather than from a defect the real
   animal avoids, which weakens the pre-registered `design-only` label. This is **unfavourable to our own
   constraint gate**, not to the design.
3. **The `prrx1a` adjacency.** `prrx1a` (`ENSORLG00000013440`) is a glider RER gene in sheet I, and the design's
   `kcnh2a lof` (`dt2`) allele is the inversion that places the **prrx1a regulatory region** upstream of the
   `kcnh2a` transcription start site. So the design's second edit acts through a regulatory region whose gene does
   carry a flying-fish signal, even though `kcnh2a` itself carries none. This is a genuinely interesting
   observation and it is **favourable to the design**, which is exactly why it is confined to this log and the
   notes, is labelled POST-HOC, is **not** counted in (b), and does **not** appear in the headline. Counting it
   would require a locus-definition rule that was not pre-registered.

## Things that were deliberately not done

- **Nothing was digitised from a figure.** Daane Figures 4B, 4C, S2A and S2B hold the design's only measurements
  and were left unread as data.
- **No zebrafish pectoral fin ratio was invented**, interpolated, or borrowed from a relative. The gap stands.
- **No bird data.** Class Aves remains the project's frozen holdout; no avian value entered any parameter, target
  or comparison, and none was needed.
- **No `measured` value in any source file was altered**, and no file outside `design-validation/` and
  `C:\Temp\dval\` was written. Nothing was committed.
- **No personal identifier** appeared in any request. The one network call was an unauthenticated GET of a public
  PMC article.

## Reproducing

```
# Part 2 (counts a, b, c, d) - offline, reads the local xlsx only
python -I C:\Temp\dval\part2.py
python -I C:\Temp\dval\part2c.py
python -I C:\Temp\dval\part2b.py      # whole-workbook gene search

# Part 3 (the gate, both arms, plus the ablation)
node C:\Temp\dval\gate.mjs

# assemble
node C:\Temp\dval\build_scorecard.mjs
```

Helper `C:\Temp\dval\xlsx.py` reads the xlsx as a zip of XML, with no external library, offline.
