# Pre-registration: cs-somite-morphogen
Timestamp (shell, UTC): 2026-11-14T04:17:29Z
Written BEFORE any paper was opened in this run. (Honest caveat: the agent has textbook-level prior
memory of some headline values in these papers; the split rule is a hash and cannot be tuned to them.)

## Statement A (clock and wavefront): S = v * T
Records: one per temperature condition in Schroter et al. 2008 (zebrafish), id = "schroter2008|T=<temp as printed, e.g. 28.0>".
Extra records from other open papers (other allowed species) get id "<firstauthor><year>|<condition>".
Models compared on held-out somite length S (anterior trunk somites):
 - M_fixed_v : v is one constant fitted on development conditions (v = mean(S/T)); predict S = v*T.
 - M_comp    : baseline, S = mean of development S (wavefront speed scales with clock rate).
 - If the paper gives an independent speed (axis elongation / wavefront velocity) per condition: M_law: S = v_measured*T, no fit.
Also held-out period: Arrhenius fit ln(T) vs 1/Kelvin on development temperatures, baseline = mean development period.

## Statement B (morphogen decay length): lambda = sqrt(D/k)
Records: one per morphogen-paper pair with independently measured D, k (or half-life; k = ln2/t_half) and lambda.
id = "<morphogen lowercase>|<firstauthor><year>". Candidates: dpp|kicheva2007, wg|kicheva2007, fgf8|yu2009,
cyclops|muller2012, squint|muller2012, lefty1|muller2012, lefty2|muller2012, plus any others found (e.g. bicoid).
Model: lambda_pred = c * sqrt(D/k); c = 1 (pure law, nothing fitted) and c fitted on development (geometric mean ratio).
Baseline: geometric mean of development lambdas.

## Split rule (both statements; cannot be tuned)
held out  iff  int(sha256(id).hexdigest()[:8], 16) % 3 == 0.
Fallback if that leaves zero held-out records in a statement: the single record with the smallest sha256 hex.
Whole conditions (temperatures) and whole morphogen records are held out. Held-out values are extracted into the
table but not used in any fit; a single final evaluation is run once.

## Metric
Mean absolute log10 error (MALE) of predicted vs measured, plus mean absolute percent error. n reported.
Negative control: scorer re-run with held-out measured labels permuted (all non-identity permutations if n<=6,
else 1000 seeded shuffles); mean shuffled score must be worse than the true score, else the test is declared broken.

## Exclusions
Frozen holdout clade in holdout/split.json: no data from it, by allow-list (zebrafish, mouse, snake, frog, fruit fly).

## AMENDMENT (shell UTC 2026-11-14T04:22:07Z) - written before any fit or held-out evaluation
What happened: the Schroter 2008 per-temperature table could not be obtained (Wiley 403, not in PMC), and Kicheva 2007 /
Yu 2009 are not open. So the planned temperature hold-out for Statement A is NOT possible. Replacements, same hash rule:
- A: open source data of Zhang et al. 2022 (Commun Biol, PMC8821593, MOESM4 xlsx, sheet WT-growth, 27 C): cumulative tail
  growth (um) at somite stages 8..20 for 8 embryos (columns B..I). Whole embryos held out; id = "zhang2022|WT-growth|tail|<col>".
  Law prediction (nothing fitted): L(n) = (n-7) * v * tau with v = 4.79*(T-14.4) um/h and tau = 5.32/(T-14.4) h, both published
  fits quoted in the paper text (the tau fit is to Schroter 2008 data), giving 25.48 um per somite at any T.
  M_fixed: slope fitted on development embryos. Baseline: constant = mean development L over all stages.
  Disclosure: the pooled Mean column of this sheet was printed on screen before this amendment (about 29.5 um per somite),
  so the direction of the law's error at 27 C was already visible; the embryo split was not.
- B: records (D, k, lambda from papers opened in this run):
  "squint|muller2012+wang2016", "cyclops|muller2012+wang2016" (D by FRAP and k from Muller 2012; lambda from Wang 2016), family nodal;
  "fgf8-wt|gupta2025", "fgf8-gpc4ex|gupta2025", "fgf8-sdc2ex|gupta2025" (D by FCS and lambda; k NOT measured), family fgf8.
  Prediction: lambda = c_family * sqrt(D/k) (k := 1 for fgf8, absorbed in c). c_family = geometric mean of measured/sqrt(D/k) on the
  development records of that family. Pure-law c=1 also reported for nodal. Baseline: geometric mean of development lambdas of the
  family. A held-out record whose family has no development record is reported as not evaluable.
  Disclosure: the measured values were read while extracting them (the nodal pure-law mismatch was visible); the split is by hash
  and was computed only after this text was written.
