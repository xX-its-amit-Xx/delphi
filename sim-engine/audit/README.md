# Constants audit tooling

Produces `sim-engine/scenarios/CONSTANTS-AUDIT.json` and `CONSTANTS-AUDIT.md` (one record per numeric constant in the
scenario modules and `lib/state.mjs`, with its source, quote, locator and verdict). Kept outside `scenarios/`
because the scenario registry loads every `.mjs` there.

- `parse.mjs` lists the constants in the modules on disk.
- `merge.mjs <work-dir> <repo-root>` merges the parse with the per-group fetch records in `<work-dir>` (the
  2026-11-01 run's work dir was a session scratchpad; constants added since then come out `unreviewed`).
- `md.mjs <repo-root>` renders CONSTANTS-AUDIT.md.

Verdicts: confirmed, corrected, design-choice, unsourceable, unverified (real citation, full text not fetchable).
