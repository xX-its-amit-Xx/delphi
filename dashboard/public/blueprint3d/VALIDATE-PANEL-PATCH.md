# The Validate panel and perturb.js

**Status, 2026-11-01:** the button is already wired. `perturb.js` has a "Validate & score" button, `#ptValidate`,
and a `#ptValSlot` slot. On click it dynamically imports `validate-panel.js` and calls

```
mountValidate(slot, {doc, geometry_edits, species, manifest, ageDays, scenario, params})
```

`validate-panel.js` accepts that shape: it validates `doc` at `ageDays`. There is nothing more to apply for the
button itself.

## Optional follow-ups for the hub

These are for `perturb.js`, which I did not edit.

1. **Pass partedit containment.** The scorer can count a refused internal-part edit as an organ that does not fit,
   if it receives the refusals. In `mountValidate()` inside `perturb.js`, add this to the object passed:

   ```
   containment: S.peRes && S.peRes.refusedGeo ? [...S.peRes.refusedGeo].map(([e, why]) => ({ part: (e.target && e.target.id) || '?', refused: why })) : []
   ```

   Without it, any enlarged internal part shows as **could-not-run** (containment needs the mesh), never as passed.
2. **Point at a live bridge.** Edited designs need one. Set `globalThis.DELPHI_SIM_API = 'http://127.0.0.1:7341'`,
   or add `<meta name="delphi-sim-api" content="...">`, to a running `node sim-engine/http.mjs`. That serves
   `POST /tool/validate_design` through its `tools/` discovery. With no bridge, the panel shows the static reports
   in `validate-static.json`, which cover only the 7 unedited repository designs. For anything else it says that it
   cannot validate. It does not fall back to a stand-in score.

## What the panel shows

The panel renders what sim-engine returned and computes nothing itself:

- **Scorer card:** the score, the P/L/G/S/E bars with weights, and the limiting term.
- **Closest real relatives:** with the out-of-distribution flag.
- **Checks:** passed, failed, flagged, could-not-run.
- **Lean by component:** accepted-law violations newly caused, shown separately from those a real parent also has
  and from candidate and contested laws.
- **Genotype per edit:** checks, closest species, whether the edited state exists in any real organism, and the
  annotations. It carries the STATE-not-phenotype banner.

The panel never says "valid". `renderValidate(report)` is pure, so it can be tested in node.
