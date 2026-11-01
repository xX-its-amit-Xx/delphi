#!/usr/bin/env node
// Run the functional-resolution ledger on every case and write functional/results.json.
// Cases: the headline (winged zebrafish vs flying fish), the TFF, the 50:50 chimera, and the two negative
// controls Amit asked for - an unedited zebrafish vs the flying fish (a large honest unresolved count is the
// right answer: a zebrafish is not a glider) and the real flying fish against itself (everything resolved).
import fs from 'node:fs';
import path from 'node:path';
import { functionalResolution } from './index.mjs';
import { functionalResolutionFor } from '../functional-interface.mjs';

const CASES = [
  { id: 'winged-zebrafish', role: 'HEADLINE', desired_phenotype: 'a zebrafish with wings: enlarged pectoral fins that let it glide over the water like a flying fish' },
  { id: 'tff', role: 'no analogue exists', desired_phenotype: 'a truly flying fish: sustained powered flight under its own power, not just a glide' },
  { id: 'ff-zf-chimera', role: 'no genome', desired_phenotype: 'glides over the water like a flying fish' },
  { id: 'zebrafish-adult', role: 'NEGATIVE CONTROL: an unedited zebrafish against the flying fish', desired_phenotype: 'glides over the water like a flying fish' },
  { id: 'flying-fish', role: 'POSITIVE CONTROL: the real flying fish against itself', desired_phenotype: 'glides over the water like a flying fish' },
  { id: 'wingless-flying-fish', role: 'SUBTRACTION', desired_phenotype: 'a flying fish with ordinary fins that no longer glides' },
];

const out = { built: new Date().toISOString(), tool: 'sim-engine/validate/functional/run-cases.mjs', cases: {} };
for (const c of CASES) {
  const L = await functionalResolution(c.id, { spec: { desired_phenotype: c.desired_phenotype } });
  const normalised = await functionalResolutionFor(c.id, { spec: { desired_phenotype: c.desired_phenotype } });
  out.cases[c.id] = { role: c.role, desired_phenotype: c.desired_phenotype, ledger: L, as_the_scorer_sees_it: {
    ran: normalised.ran, counts: normalised.counts, resolution: normalised.resolution, gate: normalised.gate,
    unknown_classes: normalised.unknown_classes, counts_disagreed_with_module: normalised.counts_disagreed_with_module || null } };
  const g = L.ran === false ? `FAILED: ${L.reason}` : `${L.closest_functional_analogue.direction} | assessable ${L.coverage.requirements_assessable}/${L.coverage.requirements_total} | ${JSON.stringify(L.counts)} | gate: ${normalised.gate?.slice(0, 60)}`;
  console.log(`${c.id.padEnd(22)} ${g}`);
}
fs.writeFileSync(path.join(import.meta.dirname, 'results.json'), JSON.stringify(out, null, 1));
console.log('wrote sim-engine/validate/functional/results.json');
