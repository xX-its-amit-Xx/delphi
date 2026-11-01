# Example (d): altitude, 0 to 5 km

**Question.** Move the TFF design (a hypothetical "truly flying fish") and the reference flying fish from sea level to 5 km (a lake or launch site at altitude).
Where can each still glide, can either sustain powered flight, and does the Lean altitude law hold on the studio's numbers?
`scenario_run` altitude, every 250 m from 0 to 5000 m, launch height 1 m, each organism's own launch speed (no what-if).

**Headline.**
- **TFF** glides at every sampled height up to 5000 m (at 5000 m: v_min 6.463 m/s (derived) vs launch 10 m/s (borrowed)).
- **Reference flying fish** glides from sea level up to 2165 m (bisection on the scenario to 10 m; first infeasible at 2173 m, where v_min 10 m/s (derived) exceeds launch 10 m/s (borrowed)).
  Thinner air raises v_min as 1/sqrt(rho); the launch speed is each organism's own sourced leap speed (kind in the tables), so the ceiling is where the two cross.
- **Neither can sustain powered flight anywhere**: the aerobic power available is at most 0.0478 of the power required (Fick bound), and that ratio only falls with height.
- **Both would still survive as swimmers** in surface water at 5 km: hypoxia margin 5.524 kPa (borrowed) at 5000 m. That margin uses a cross-species mean Pcrit, so it is *borrowed*.

**The Lean law.** `altitude-coupling` v1.0.0 (accepted; theorem `Delphi.Altitude.feasible_downward_closed` in `lean/Delphi/Altitude.lean`, pin ok):
"In an atmosphere where air density and oxygen partial pressure both fall with height, the minimum speed of lift-supported flight and the power to fly at it are nondecreasing in height, while the aerobic supply (with arterial content nondecreasing in partial pressure, as a Hill curve gives) is nonincreasing. Hence sustained flight possible at a height is possible at every lower height; above an infeasible height every height is infeasible, so the flyable set is an interval from the ground up to a ceiling; and a design that cannot fly at the ground cannot fly at any height. A larger lifting area lowers the power required at a fixed height."
On the studio's numbers, for both organisms the glide-feasible heights form one interval from the ground up (TFF 21 of 21 sampled heights, flying fish 9 of 21); v_min never decreases and aerobic supply never increases with height; sustained powered flight is infeasible at the ground and so, as the theorem requires, at every height.
This is a check that the scenario's numbers have the shape the theorem says they must have. It is not a kernel proof of this case.
Related: `perturb-isa-vmin` (candidate, theorem `Delphi.Perturb.vmin_isa_mono`): "In the ISA troposphere air density falls with height, and the minimum flight speed sqrt(2W/(rho S C_Lmax)) rises with height (v_min proportional to 1/sqrt(rho))."

## TFF

| altitude m | air density kg/m3 | v_min | launch speed | glide feasible | Lean-covered glide | kinetic phase (outside Lean) | aerobic / required power | water hypoxia margin | survives (swimmer) |
|---|---|---|---|---|---|---|---|---|---|
| 0 | 1.225 | 5.012 m/s (derived) | 10 m/s (borrowed) | true | 4.37 m (derived) | 16.68 m (derived) | 0.0478 (derived) | 15.43 kPa (borrowed) | true |
| 1000 | 1.112 | 5.261 m/s (derived) | 10 m/s (borrowed) | true | 4.37 m (derived) | 16.11 m (derived) | 0.045 (derived) | 13.03 kPa (borrowed) | true |
| 2000 | 1.007 | 5.528 m/s (derived) | 10 m/s (borrowed) | true | 4.37 m (derived) | 15.47 m (derived) | 0.0421 (derived) | 10.86 kPa (borrowed) | true |
| 2500 | 0.9572 | 5.67 m/s (derived) | 10 m/s (borrowed) | true | 4.37 m (derived) | 15.11 m (derived) | 0.0407 (derived) | 9.853 kPa (borrowed) | true |
| 3000 | 0.9095 | 5.816 m/s (derived) | 10 m/s (borrowed) | true | 4.37 m (derived) | 14.74 m (derived) | 0.0393 (derived) | 8.895 kPa (borrowed) | true |
| 4000 | 0.8196 | 6.127 m/s (derived) | 10 m/s (borrowed) | true | 4.37 m (derived) | 13.91 m (derived) | 0.0365 (derived) | 7.121 kPa (borrowed) | true |
| 5000 | 0.7367 | 6.463 m/s (derived) | 10 m/s (borrowed) | true | 4.37 m (derived) | 12.97 m (derived) | 0.0337 (derived) | 5.524 kPa (borrowed) | true |

## Flying fish

| altitude m | air density kg/m3 | v_min | launch speed | glide feasible | Lean-covered glide | kinetic phase (outside Lean) | aerobic / required power | water hypoxia margin | survives (swimmer) |
|---|---|---|---|---|---|---|---|---|---|
| 0 | 1.225 | 8.989 m/s (derived) | 10 m/s (borrowed) | true | 4.37 m (derived) | 4.275 m (derived) | 0.0267 (derived) | 15.43 kPa (borrowed) | true |
| 1000 | 1.112 | 9.436 m/s (derived) | 10 m/s (borrowed) | true | 4.37 m (derived) | 2.443 m (derived) | 0.0251 (derived) | 13.03 kPa (borrowed) | true |
| 2000 | 1.007 | 9.916 m/s (derived) | 10 m/s (borrowed) | true | 4.37 m (derived) | 0.3746 m (derived) | 0.0235 (derived) | 10.86 kPa (borrowed) | true |
| 2500 | 0.9572 | 10.17 m/s (derived) | 10 m/s (borrowed) | false | 0 m (derived) | 0 m (derived) | 0.0227 (derived) | 9.853 kPa (borrowed) | true |
| 3000 | 0.9095 | 10.43 m/s (derived) | 10 m/s (borrowed) | false | 0 m (derived) | 0 m (derived) | 0.0219 (derived) | 8.895 kPa (borrowed) | true |
| 4000 | 0.8196 | 10.99 m/s (derived) | 10 m/s (borrowed) | false | 0 m (derived) | 0 m (derived) | 0.0203 (derived) | 7.121 kPa (borrowed) | true |
| 5000 | 0.7367 | 11.59 m/s (derived) | 10 m/s (borrowed) | false | 0 m (derived) | 0 m (derived) | 0.0188 (derived) | 5.524 kPa (borrowed) | true |

All 21 sampled heights per organism are in output.json (`sweep`). The glide ceiling bisection is in `ceilings`.
Lean violations reported by scenario_run: none (rows the unedited base also violates included).
The "Lean-covered glide" column is h (L/D)max from the glide polar. It drops to 0 once the fish cannot reach v_min. The kinetic phase is the studio's own addition and lies outside the theorem's hypotheses.

## Checks this script enforces (exit code 1 if any fails)

| check | last run |
|---|---|
| every altitude ran for both organisms | pass |
| Lean altitude-coupling: glide-feasible heights form an interval from the ground (both) | pass |
| Lean altitude-coupling: infeasible at the ground => infeasible at every height (both) | pass |
| TFF (lighter wing loading) glides at least as high as the flying fish | pass |
| reference flying fish has a glide ceiling inside 0-5 km | pass |
| v_min nondecreasing with height (both) | pass |
| aerobic power available nonincreasing with height (both) | pass |
| powered flight impossible at every height (margin < 1, both) | pass |
| water hypoxia margin positive to 5 km (survives as a swimmer) | pass |
| altitude-coupling law is accepted (theorem feasible_downward_closed) | pass |

---
Generated by `node sim-engine/examples/d-altitude/run.mjs` on 2026-11-01T03:07:14.095Z from `output.json` in this folder. Numbers are rounded to 4 significant figures; full precision and every provenance record are in output.json. Provenance kinds: measured, measured-secondhand, borrowed, derived, calibrated (tuned to reproduce one observation: never a result), assumed (a placeholder). Lean verdicts are floating-point evaluations of Lean-backed formulas, not kernel proofs. No Aves data used.
