# Worked examples: the Design Studio, end to end

Six scripted walkthroughs. Each one calls the studio's exported handlers (or, for the co-design demo, the MCP server over stdio), writes everything it got back to `output.json`, and generates its own README from those JSON values. So every number quoted in an example README is copied from its output.json together with its provenance kind.
Each script also checks its result against what its README claims, and exits non-zero on anything unexpected, so the set doubles as a regression test.

```bash
node sim-engine/examples/run-all.mjs          # all six; rewrites this file
node sim-engine/examples/d-altitude/run.mjs   # or one at a time
```

## Last run

| example | what it shows | headline (copied from output.json) | checks passed | exit |
|---|---|---|---|---|
| [a-text-to-design](a-text-to-design/README.md) | Text to design: a sentence becomes a spec, then a design, judged criterion by criterion | as written: no design meets the spec; what-if 10 m/s launch (assumed): meets the spec, glide 18.26 m with `body:body.pectoral_area_over_SL2` = 0.1547, `body:body.pectoral_span_over_SL` = 0.6163 | 17/17 | ok |
| [b-impossible-spec](b-impossible-spec/README.md) | The same request made impossible: "no design meets the spec", and the laws that rule it out | no design meets the spec: 57/57 rejected; C15 glide_range violated (bound 4.37 m from 1 m vs 1000 m), P1 thermal violated (CTmax 40.45 °C vs 45 °C) | 12/12 | ok |
| [c-current-timecourse](c-current-timecourse/README.md) | Winged zebrafish vs flying fish against a 0.3 m/s current at every life stage | winged zebrafish fails at 0d,3d,10d,25d and holds from 60d (Ucrit calibrated); flying fish ruled out only at 0d (physical bound), otherwise no Ucrit model (feasible null) | 10/10 | ok |
| [d-altitude](d-altitude/README.md) | TFF vs flying fish from 0 to 5 km, checked against the Lean altitude law | glide ceiling: TFF > 5000 m, flying fish 2165 m; powered flight impossible at every height for both; feasible heights closed downward as Lean altitude-coupling requires | 10/10 | ok |
| [e-predator](e-predator/README.md) | Which organisms can escape a predator by air | aerial escape: yes = flying-fish, tff; no = zebrafish-adult, winged-zebrafish, wingless-flying-fish; no verdict = zebrafish-larva, ff-zf-chimera | 8/8 | ok |
| [codesign-demo](codesign-demo/README.md) | A live co-design session over MCP stdio: physics proposes, genotype comments, a human approves, lean_check | proposal p1 by agent:physics (pectoral_area_over_SL2 0.07126 -> 0.1547), genotype caveat (kcnk5b chain sufficiency), approved by human via session_decide; agent edit and double decision refused; lean_check C15 holds for the Lean-covered glide and violated for the studio total; C14 violated, C16 cannot-evaluate | 19/19 | ok |

Run at 2026-11-01T04:21:13.512Z on v24.13.0. Every check passed.

## Ground rules the examples follow

- Read `weakest_input` / the provenance `kind` before the number. **calibrated** numbers (tuned to reproduce one observation) are never presented as results, and **assumed** inputs (including every what-if) are labelled where they are used.
- Lean verdicts are floating-point evaluations of Lean-backed formulas, not kernel proofs.
- Organism edits are morphology (a shape), not genetics. Nothing here claims a genotype, a viable animal or a breedable one.
- No Aves (bird) data anywhere: Aves is DELPHI's frozen holdout. No credentials. Example scripts write only inside their own folder. The co-design demo points the server's session store at a temp folder.
