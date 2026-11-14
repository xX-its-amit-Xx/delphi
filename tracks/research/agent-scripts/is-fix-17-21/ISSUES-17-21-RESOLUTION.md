# Issues #17 to #21 (fractastical/delphi): what was done, 2026-11-13, agent is-fix-17-21

No issue had any comment when read (api.github.com/repos/fractastical/delphi/issues/N/comments returned []).

## #17 Track 1, RBS-swap separability: PARTLY (scored; the frozen bound FAILS)
Downloads (raw.githubusercontent.com/CIDARLAB/Cello-v2-1-Core/main/library/constraints/):
- Eco1C1G1T1.UCF.json  4834067 bytes  sha256 c702d6b9b11bcd3c4fb9f7a77d24af1b549cecf3e7184b3a36692873735cd6f0
- Eco1C2G2T2.UCF.json  2610885 bytes  sha256 ac3f586d7d60c332037dc2d291802a5b208b255c2f275fe626268c2ec1fd71bc
Scorer: score_rbs_separability.py (proposed path tracks/scripts/score-rbs-separability.py).
Outputs: score_Eco1C1G1T1.json, score_Eco1C2G2T2.json.
- Calibration Eco1C1G1T1: 10 RBS-only pairs, 6 with K moved >= 2-fold, max dn 0.1587 (reproduces the recorded figure).
  Caveat: this library ships n rounded to one decimal.
- Test Eco1C2G2T2: 13 RBS-only pairs, 9 counted, max dn 0.2836 (B1_BM3R1 vs B2_BM3R1, K 10.3-fold) > 0.25 -> FAIL.
  8 of 9 counted pairs are inside the bound. Uncounted P2_PhlF/P3_PhlF (K 1.76-fold) has dn 0.2911.
- Not blind: the 0.2836 figure was already in tracks/research/agents/t1-reporter-deep.json before the bound
  0.25 was written, so this must be reported as declared-not-blind, and as a failure.
- Still open: the pre-registration commit (lead session; this agent may not commit) and a Lean statement
  under tracks/lean/check.sh (not written here).

## #18 Track 2, spatial patterns: PARTLY (law re-map done)
Law set 1.8.1 (dashboard/public/api/lean/lawsets/1.8.1.json, is_current true, 59 laws). Both laws exist as
status "candidate", version 1.1.0, each with a Lean reference:
- turing-ddi: lean/registry/proposals/turing-ddi/law.lean, theorem Delphi.LeanBio.Round2.TuringDDI.turing_instability
- fisher-kpp-speed: lean/registry/proposals/fisher-kpp-speed/law.lean, theorem Delphi.LeanBio.Round2.KppSpeed.kpp_min_speed
So the track map's "missing" is wrong; change both to "candidate, Lean statement present".
Not done: freezing F1 to F5 (a commit) and the 168 MB deposit (over this agent's 20 MB download limit).

## #19 Track 3, lumen geometry: BLOCKED in this run (not reproduced)
No reproduction was attempted in the time allowed. Sources named by the earlier agent: Zenodo record 17055495
and github.com/AlexDunnLab/lumen-shape (lumen_vm.py). The 0.229 vs 0.124 figures remain an agent report.
Do not freeze or open the two quarantined genotypes until the wild-type pilot is re-derived with commands.

## #20 Track 4, glide surrogate: NEEDS-AMIT
A physical measurement. Single missing fact: the immersed weight of each of the three printed control fruits
(plus the ten drop times each). Nothing public can stand in for it.

## #21 Track 5, biomaterial: NEEDS-AMIT
A physical measurement. Single missing fact: the measured swelling strain (length change) of the coupons at
the listed time points; no public value exists for these resins according to the issue itself.
Arithmetic in the issue checked: R = h/(1.5*de) = 0.8/(1.5*0.002) = 266.7 mm; tip deflection over L = 40 mm
is L^2/(2R) = 1600/533.3 = 3.0 mm. Both match the issue text.
