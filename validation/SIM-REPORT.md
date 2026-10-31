# Simulation check of three Lean results

**Every pre-registered check passed, and no disagreements were found.** Each check compares one of three Lean results with
a stochastic simulation of the model it describes:

- neutral fixation probability `i/M`
- fixation at least `i/M` when `s >= 0`
- the twofold cost of sex

These are idealised models. Nothing here says anything about real organisms.

How the run was set up:

- **Pre-registration:** [`PREREG.md`](PREREG.md), SHA-256 `42a0fad3…90d1`. It was written before any simulation code,
  and the hash is recorded in `sim/results.json`.
- **Code:** [`sim/run.py`](sim/run.py). Master seed `20261031`, with one `SeedSequence` stream per cell.
- **Compute:** 18.6 s of wall time on 2 threads, against a budget of about 30 minutes.
- **Reproducibility:** a second full run gave byte-identical results for every cell.
- **To rerun:** `OMP_NUM_THREADS=2 python validation/sim/run.py` (Python 3, numpy 2.5.3, scipy 1.18.1).

## Results

| check | what it compares | result |
|---|---|---|
| T1, neutral Wright-Fisher | `i/M` inside the Clopper-Pearson interval (99% family-wise, Bonferroni over 15 cells); 40,000 replicates per cell; `M` from 10 to 1000 | **15/15 pass** |
| T1, exact | exact fixation probability of the finite chain, from a linear solve, against `i/M` | largest gap 9.1e-14, so equal to floating-point precision |
| T2, selection `s` in {0.001, 0.01, 0.1} | one-sided upper bound on the fixation fraction is at least `i/M` (99% family-wise, 21 cells) | **21/21 pass** |
| Negative controls, `s = -0.01` and `s = -0.001` | the test should detect fixation below `i/M` | **2/2 detected**: 0.0082 and 0.0821 against `i/M` = 0.1 |
| S, simulator against the exact chain | exact value inside the simulated interval (38 cells) | **38/38 agree**; 0 replicates hit the generation cap |
| T3, C1: per-capita daughters, asexual ÷ sexual | 2 inside the 99% family-wise interval; 12 cells: `K` in {1e3, 1e5}, `f` in {2, 4, 10}, fixed or Poisson fecundity | **12/12 pass**: G from 1.9986 to 2.0015 |
| T3, C2: log-odds growth per generation | `ln 2` inside the interval; the 6 cells with `K = 1e5` | **6/6 pass** |
| T3 variants (expected to differ from 2) | V1 counts sons too, expected 1; V2 has males doubling sexual fecundity, expected 1; V3 has sexual broods 2/3 daughters, expected 1.5 | **3/3 as expected**: 0.9999, 0.9999, 1.4999 |

## Disagreements and diagnosis

There were none. The pre-registered diagnosis protocol was not needed. Four points about what these checks do and do not show:

1. **The T2 bound is true but loose.**
   - With `s = 0.1`, `M = 1000` and one copy, the simulated fixation fraction was 0.174. The exact chain value is
     0.176. The theorem's floor is `1/M = 0.001`.
   - Kimura's diffusion value (0.181) is closer, but it is not what the Lean module proves. Its header says so.
   - A candidate that commits to a fixation probability between `1/M` and the true value is not eliminated by this
     theorem.
2. **The T3 checks are close to a restatement of the model.**
   - The simulation implements the same accounting the theorem assumes: daughters only, equal fecundity, a 1:1 ratio,
     and males that contribute nothing. What it adds is that finite populations, Poisson fecundity and random
     regulation leave the factor at 2.
   - The variants show which inputs the factor depends on. If you count all offspring, the advantage disappears (V1).
     This is a definition point: the "twofold" is in daughters. Paternal investment (V2) or a biased sex ratio (V3)
     changes the factor. That means applying the theorem to a real species needs those assumptions checked first.
3. **T1 is exact.** The exact chain solve matches `i/M` to 1e-13 for `M` up to 1000. The simulated fractions match
   within sampling error.
4. **The simulation checks only the Wright-Fisher model.** The Lean proof (`Delphi.Kimura`) covers any neutral
   absorbing chain. The simulation only checks the binomial (Wright-Fisher) instance.

Raw data: [`sim/results.json`](sim/results.json). For every cell it holds the parameters, seed spawn key, counts,
intervals, exact value and verdict.
