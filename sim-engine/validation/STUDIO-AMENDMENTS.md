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
