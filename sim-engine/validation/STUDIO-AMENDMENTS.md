# Amendments to STUDIO-PREREGISTRATION.md, written AFTER results existed

The pre-registration (sha256 on its last line) is unchanged. Everything here was written after the harness
had scored real studio modules, and is labelled that way. The harness reports the pre-registered verdict
and the amended verdict side by side, and never replaces one with the other.

## A1 (2026-11-01, about 02:40 UTC): a value fitted to, or read back from, the target paper is circular

**What prompted it.** The first real runs gave three passes that are not predictions:

- W2 CTmax 40.45 °C and W3 CTmin 8.4 °C (`scenarios/temperature.mjs`): the module draws a straight line
  through Cortemeglia & Beitinger 2005's two acclimation points (39.2/41.7 and 6.2/10.6 °C) and evaluates
  it at 25 °C. That is the very paper the test scores it against. The module labels the metric `derived`;
  its own model card calls the same numbers "the calibration data".
- W1 Ucrit 15.0 BL/s (`scenarios/current.mjs`): `ucrit_m_s` is Plaut 2000's 15.5 SL/s (via Widrick 2018)
  times this animal's SL, and `ucrit_bl_s` divides it back. The test target is Plaut 2000.

The pre-registered "echo" rule (§0) missed all three. It looks for a module constant equal to the predicted
value within 1 % and sourced to the target DOI. Here the prediction is an interpolation between two sourced
constants (W2, W3), or a constant cited by author name rather than DOI and then rescaled by 3 % (W1). The
rule was too narrow. A pass that only reproduces the target data is not evidence, and §0 already says so
in spirit ("a calibrated quantity can never be cited as a result").

**The amended rule.** A pass becomes `circular` if the metric's source string (or the source of a metric it
says it is computed from) names the target paper, **and** either describes an interpolation, fit,
calibration, regression or scaling, **or** quotes the target's own measured value. Author names, DOIs and
values per test are listed in `TARGET_NAMES` and `TARGET_VALUES` in `studio-harness.mjs`. Self-tests
`A1: …` check that it fires on a planted interpolation and a planted read-back, and stays silent for an
independent source.

**What it does not change.** No band, no target and no fail. A1 can only turn a pass into `circular`.

**Independent checks that remain.** The temperature module's own `validatedAgainst` scores its line
against Morgan et al. 2018 (40.97 °C at 28 °C acclimation, a different lab; predicted 41.2 °C) and
Andreassen et al. 2022 (41.0 °C). Those are real out-of-sample checks, and that is where its evidence lies.
They are not this harness's tests, so this file only points to them.

## A2 (2026-11-01, written after results): read `feasible` where the pre-registration said "survives" for a behaviour

**Original pre-registered wording, unchanged in STUDIO-PREREGISTRATION.md:**
- W11: "zebrafish survives sustained current of 0.20 m/s … and does **not** survive 1.10 m/s (2 × Ucrit)".
- W1 fallback: "the harness locates it itself by bisection on `survives`".
- N1: "… or the scenario reports glide as not applicable / survives = false / no glide metric".

**Why.** The studio contract changed to 0.3.0 after the first results. The single `survives` flag was split
into `survives` (the organism lives) and `feasible` (the behaviour asked about is possible: hold station,
glide, aerial escape, grip), with a `feasibility_note`. This harness's own defect D6 had asked for that
split, because `survives` meant different things in different scenarios. Under 0.3.0, `current.mjs`
returns `survives: null`: being swept downstream is not modelled as lethal. So the pre-registered reading
of W11 can no longer be met by any module. What W11 was written to test is "can the fish hold station at
0.20 m/s but not at 1.10 m/s", and that is now `feasible`.

**What changes.** W11, the W1 bisection fallback and N1's escape clause read `feasible` when the module
reports it, and fall back to `survives` when it does not. This is a change in how the result is read: no
band, threshold or test is added. N4 needed no amendment. Its pre-registered wording already says
"`survives` (or flight feasibility)", and it now uses `feasible` when present.

**How it is reported.** The pre-registered verdict stays in `status`. The A2 verdict goes in
`amended_status` with `amendment: 'A2'`, shown side by side. At the first run after the change, W11 is
`fail` under the pre-registered reading (survives = null at both speeds) and `pass` under A2 (feasible =
true at 0.20 m/s, false at 1.10 m/s). N1 passes under both readings (glide_range_total_m = 0 for the adult
zebrafish).

## A3 (2026-11-01, written after results): N5 checks the distance the module declares covered by the Lean theorem

**Original pre-registered wording:** "whenever a scenario reports a glide distance d together with a
launch height h and an L/D, d ≤ h × L/D / (1 − δ)".

**Why.** After this harness reported N5 as failed (defect D2: a single `glide_range_m` of 32.9 m against
a bound of 4.37 m), `glide.mjs` split its distance into three metrics:
- `glide_range_lean_bound_m` (h·(L/D)max, the part covered by `glide_range_le`);
- `kinetic_phase_m` (labelled OUTSIDE the theorem);
- `glide_range_total_m` (labelled "NOT covered by the Lean theorem as a whole").

The pre-registered wording says "a glide distance", which includes the total. The total still exceeds the
bound whenever the kinetic phase is non-zero, so N5 still **fails** under the pre-registered reading.

**The amended reading.** N5 checks the metric the module declares covered by the theorem. It also
requires that any reported distance above the bound carries an explicit "not covered" label, so that the
studio never presents an unproved number as proved. A3 passes only if both hold.

**Caveat, stated so nobody over-reads the A3 pass.** `glide_range_lean_bound_m` is computed as exactly
h·(L/D)max, so checking it against h·(L/D)/(1 − δ) is close to a tautology. What A3 really verifies is the
labelling: that the number exceeding the proved bound is marked as outside it. The physics of the kinetic
phase is not checked by any Lean law.
