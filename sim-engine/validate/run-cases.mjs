#!/usr/bin/env node
// Runs validate_design on the four named designs and writes results.json + the case tables in RESULTS.md
// (between the CASES markers; the prose around them is hand-written).
//   node sim-engine/validate/run-cases.mjs
import fs from 'node:fs';
import path from 'node:path';
import { loadBundle } from '../lib/data-node.mjs';
import * as O from '../lib/organism.mjs';
import { validateDesign } from './score.mjs';

const DIR = import.meta.dirname;
const bundle = await loadBundle();
const g = (id, value, why) => ({ target: { level: 'gene', id }, param: 'allele', op: 'set', value, author: 'agent:validate', reason: why });
let winged = { ...O.docFor(bundle, 'winged-zebrafish'), id: 'winged-zebrafish-with-genotype', notes: 'repository winged-zebrafish design plus the two loci of the Daane 2021 double heterozygote (sequences/engineered-diff.json)' };
winged = O.appendEdit(bundle, winged, g('slc43a2a', 'p.T200K/+', 'lat4a nr21 (Daane 2021), heterozygous'));
winged = O.appendEdit(bundle, winged, g('kcnh2a', 'longfin t2 cis-regulatory inversion', 'kcnh2a lof dt2 inversion (Daane 2021), heterozygous; 0 amino acids'));
const CASES = [
  ['unedited zebrafish', 'zebrafish-adult'],
  ['winged zebrafish (repository design + its 2 gene edits)', winged],
  ['TFF (truly flying fish design)', 'tff'],
  ['50:50 flying fish x zebrafish chimera', 'ff-zf-chimera'],
];
const out = [];
for (const [label, organism] of CASES) {
  const r = (await validateDesign({ organism, swarm: label.startsWith('TFF') })).result;
  out.push({ label, result: r });
}
fs.writeFileSync(path.join(DIR, 'results.json'), JSON.stringify(out.map(o => ({ label: o.label, ...o.result })), null, 1));
// Static fallback for the Validate panel (dashboard/public/blueprint3d/validate-panel.js) when no live bridge runs:
// unedited repository designs only, keyed by id. Identity tables trimmed to the closest 5 rows to keep it small.
const reports = [];
for (const id of ['zebrafish-adult', 'zebrafish-larva', 'flying-fish', 'winged-zebrafish', 'tff', 'ff-zf-chimera', 'wingless-flying-fish']) {
  const r = (await validateDesign({ organism: id })).result;
  for (const e of r.closest_relative_genotype.edits) if (e.comparison?.identity_table) e.comparison.identity_table = e.comparison.identity_table.slice(0, 5);
  reports.push({ design_key: id, report: r });
}
fs.writeFileSync(path.resolve(DIR, '../../dashboard/public/blueprint3d/validate-static.json'), JSON.stringify({ built: new Date().toISOString(), by: 'sim-engine/validate/run-cases.mjs', reports }));

const f = (x, d = 3) => (x == null ? '-' : typeof x === 'number' ? (Math.abs(x) < 1e-3 && x !== 0 ? x.toExponential(2) : x.toFixed(d)) : String(x));
let md = '';
md += '| design | score | plausible | P | L | G | E | limiting term | closest real relative (body) | distance | body p | closest on pectoral length | fin p | fin envelope p | OOD |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n';
for (const { label, result: r } of out) {
  const C = r.score.components, ph = r.closest_relative_phenotype;
  md += `| ${label} | **${f(r.score.value)}** | ${r.score.plausible ? 'yes' : 'no'} | ${f(C.P.value)} | ${C.L.value} | ${f(C.G.value, 2)} | ${C.E.value} (${C.E.weakest_kind}) | ${C.P.limiting} | ${ph.body.nearest?.[0]?.name || '-'} | ${f(ph.body.distance)} | ${f(ph.body.p_value)} | ${ph.fin.nearest?.[0]?.name || '-'} | ${f(ph.fin.p_value)} | ${f(ph.fin_envelope.p_value)} | ${ph.ood ? 'yes' : 'no'} |\n`;
}
md += '\n';
for (const { label, result: r } of out) {
  md += `### ${label}\n\n${r.verdict.statement}\n\n`;
  const ph = r.closest_relative_phenotype;
  md += `- Body nearest 3: ${ph.body.nearest.slice(0, 3).map(n => `${n.name} (${n.taxon}; d ${f(n.distance)}; dominant ${n.dominant_features.map(x => `${x.feature} ${Math.round(x.share * 100)} %`).join(', ')})`).join('; ')}\n`;
  if (ph.fin_envelope.outside.length) md += `- Fin features outside the real range (uncalibrated envelope): ${ph.fin_envelope.outside.map(o => `${o.feature} ${o.design} vs [${o.min}, ${o.max}]`).join('; ')}\n`;
  md += `- Failed: ${r.verdict.failed.join(', ') || 'none'}. Flagged: ${r.verdict.flagged.join(', ') || 'none'}. Could not run: ${r.verdict.could_not_run.join('; ') || 'none'}.\n`;
  const L = r.lean_by_component;
  md += `- Lean (${L.lawset_version}): ${JSON.stringify(L.counts)}; accepted newly caused: ${L.accepted.newly_caused.map(v => v.constraint).join(', ') || 'none'}; candidate ${L.candidate.length}, contested ${L.contested.length}. Components: ${L.components.map(c => `${c.component.level}:${c.component.label || c.component.id} ${JSON.stringify(c.summary)}`).join('; ')}\n`;
  for (const e of r.closest_relative_genotype.edits) {
    const c = e.comparison || {};
    md += `- Gene **${e.edit.gene}** \`${e.edit.raw}\`: ${e.checks.map(x => `${x.id} ${x.status}`).join(', ')}. ${c.closest_species ? `Closest species ${c.closest_species.species} (${f(c.closest_species.identity_after, 2)} % identity after the edit; ${c.closest_species_rule || ''}). ` : ''}${c.identity_to_unedited_zebrafish != null ? `Identity to the unedited zebrafish protein ${c.identity_to_unedited_zebrafish} %. ` : ''}${c.alt_state_in_real_organisms ? `Edited state in a natural orthologue: ${c.alt_state_in_real_organisms.in_natural_orthologues.map(x => x.species).join(', ') || 'none'}; known alleles: ${(c.alt_state_in_real_organisms.known_lab_or_natural_alleles || []).map(x => x.id).join(', ') || 'none'}. ` : ''}Causal chain: ${e.annotations.causal_chain ? `${e.annotations.causal_chain.chain_strength} (weakest ${e.annotations.causal_chain.weakest_grade})` : 'none'}; ${e.annotations.interventions.length} interventions; ${e.annotations.pathways.n} pathway terms.\n`;
  }
  md += '\n';
}
const RES = path.join(DIR, 'RESULTS.md');
const cur = fs.existsSync(RES) ? fs.readFileSync(RES, 'utf8') : '<!-- CASES:BEGIN -->\n<!-- CASES:END -->\n';
fs.writeFileSync(RES, cur.replace(/<!-- CASES:BEGIN -->[\s\S]*<!-- CASES:END -->/, `<!-- CASES:BEGIN (generated by run-cases.mjs ${new Date().toISOString()}) -->\n${md}<!-- CASES:END -->`));
for (const { label, result: r } of out) console.log(label, r.score.value, r.verdict.closest_real_relative?.name, r.verdict.closest_real_relative?.distance);
