#!/usr/bin/env node
// The catalogue of biological laws the Design Studio needs, with explicit coverage:
//   node lean/laws/build-laws.mjs -> lean/laws.json, lean/LAWS.md
// Every "proved" entry is read from lean.json (the compiler's output) and constraints.json; the "stated-not-proved"
// and "not formalised" entries are written here so that the gaps are named, never implied closed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const R = JSON.parse(fs.readFileSync(path.join(root, 'dashboard/public/t/lean/lean.json'), 'utf8'));
const C = JSON.parse(fs.readFileSync(path.join(root, 'lean/constraints.json'), 'utf8'));
const byClaim = {}; for (const c of C.constraints) (byClaim[c.claim_id] ||= []).push(c);
const LEVEL = { 'kimura-substitution-rate': 'genotype', 'kimura-fixation-probability': 'genotype', 'favored-fixation-lower-bound': 'genotype', 'genotype-genetic-code': 'genotype', 'genotype-substitution-time': 'genotype', 'haldane-cost-of-selection': 'genotype', 'genotype-pleiotropy-closure': 'genotype-to-phenotype', 'genotype-developmental-ordering': 'developmental', 'blueprint-well-formedness': 'phenotype (structure)', 'fisher-ftns': 'population', 'maynardsmith-twofold-cost': 'population', 'thompson1917-ch03-07': 'phenotype', 'scaling-area-law': 'phenotype', 'scaling-strength-law': 'phenotype', 'scaling-bending-law': 'phenotype', 'thompson1917-ch02-06': 'phenotype', 'thompson1917-ch02-07': 'phenotype', 'thompson1917-ch02-10': 'phenotype', 'flight-allometry-law': 'phenotype', 'flight-climb-glide-law': 'phenotype', 'aerobic-power-bound': 'physiology', 'altitude-coupling': 'phenotype+physiology', 'physiology-q10': 'physiology', 'physiology-laplace': 'physiology' };
// Studio fields per quantity (browser-check.mjs aliases) so a law says what it checks in the Studio.
const STUDIO = { length_ratio: 'SL_m (vs reference)', weight_ratio: 'mass_kg (vs reference)', loglog_exponent: 'mass_kg, SL_m', area_loglog_exponent: 'fin_area_m2, SL_m', area_ratio: 'fin_area_m2', stress_loglog_exponent: 'mass_kg, fin_area_m2, SL_m', stress_ratio: 'mass_kg, fin_area_m2', airspeed_m_s: 'airspeed_m_s', weight_N: 'mass_kg', lifting_area_m2: 'fin_area_m2', air_density_kg_m3: 'conditions/baseline.json (and the altitude parameter, part B)', max_lift_coefficient: 'CL_max', lift_to_drag: 'LD_max', aerobic_ceiling_W: 'computed from cardiacOutput, arterialO2, efficiency and oxycaloric, or committed directly', vmin_ratio: 'mass_kg, fin_area_m2, SL_m', vmin_loglog_exponent: 'mass_kg, fin_area_m2, SL_m', glide_height_m: 'glideHeight_m', glide_distance_m: 'glideDistance_m', lift_to_drag_max: 'LD_max', ground_effect_drag_reduction: 'groundEffect', power_available_W: 'muscle_fraction × musclePowerPerKg_W (R6, hypothesis) or powerAvailable_W', power_required_W: 'mass_kg, airspeed_m_s, LD_max', climb_rate_m_s: 'climbRate_m_s', muscular_efficiency: 'efficiency', oxycaloric_equivalent_J_per_unit_O2: 'oxycaloric', cardiac_output: 'cardiacOutput', arterial_O2_content: 'arterialO2 (gill_area_m2 is not enough: the gill link is not formalised)', reference_safety_factor: 'referenceSafetyFactor', claimed_safety_factor: '(scaled design must stand)', breaking_stress_Pa: 'breaking_stress_Pa', cross_section_m2: 'cross_section_m2', load_in_body_weights: 'load_in_body_weights', breaking_load_ratio: '(scaling)', bending_stress_loglog_exponent: '(fin rays as beams; no Studio field yet)', bending_stress_ratio: '(fin rays as beams; no Studio field yet)', blueprint_file: 'the emitted blueprint (organism-design)', wt_amino_acid: 'genotype_edits[].wt_aa', mutant_amino_acid: 'genotype_edits[].mut_aa', claimed_substitutions: 'genotype_edits[].substitutions', gene: 'genotype_edits[].gene', changed_nodes: 'genotype_edits[].nodes_changed', derivative_stage_zfs: 'developmental_claims[].derivative_zfs', precursor_stage_zfs: 'developmental_claims[].precursor_zfs', required_substitutions: 'required_substitutions', gene_copies_M: 'gene_copies_M', mutation_rate: 'mutation_rate', generations_T: 'generations_T', reproductive_excess: 'reproductive_excess', cost_per_substitution: 'cost_per_substitution' };
// Where "proved" alone would mislead, the status says what was proved and from what.
const STATUS_NOTE = {
  'haldane-cost-of-selection': 'proved FROM a named hypothesis (HaldaneCost is never proved here, and has been contested since 1957)',
  'genotype-substitution-time': 'proved (a bound on speed only; it eliminates nothing unless the number of required substitutions is defined, and it is not for any wing claim here)',
  'physiology-q10': 'proved, no instance (no candidate commits a Q10; the conditions file fixes 25 C)',
  'physiology-laplace': 'proved, no instance (no vessel radius, thickness or wall strength for any fish exists in this project)',
  'genotype-pleiotropy-closure': 'proved (a statement about what a view may omit, not about development)'
};
const laws = [];
for (const f of R.formalized) {
  const cs = byClaim[f.claim_id] || [];
  const fields = [...new Set(cs.flatMap(c => c.requires))];
  laws.push({ id: f.claim_id, level: LEVEL[f.claim_id] || 'phenotype', statement: f.statement, label: f.label, status: f.status === 'verified' ? (STATUS_NOTE[f.claim_id] || 'proved') : 'not verified', module: f.module, theorem: f.theorem, source: f.paper ? `${f.paper.title} (${f.paper.year})` : 'proved in this project; no paper states it in this form',
    constraints: cs.map(c => c.id), studioFields: fields.map(q => `${q}: ${STUDIO[q] || '(no Studio field)'}`), scope: f.proofScope ? { kernelChecked: f.proofScope.kernelChecked, assumed: f.proofScope.assumed } : null, faithfulness: f.faithfulness || null, flyingFishAudit: (R.flyingFishAudit ? R.flyingFishAudit.rows.filter(r => r.module === f.module).map(r => r.verdict) : []).reduce((a, v) => (a[v] = (a[v] || 0) + 1, a), {}) });
}
// Hypotheses carried, never proved: named in modules, stated here as such.
laws.push({ id: 'muscle-power-premise', level: 'physiology', statement: 'Power available = f p M with muscle fraction f and mass-specific power p constant (Thompson 1917, ch. II).', status: 'stated-not-proved (named hypothesis MusclePowerLaw in lean/Delphi/Scaling.lean; replaced for the Studio by the aerobic bound)', module: 'lean/Delphi/Scaling.lean', theorem: null, constraints: [], studioFields: ['muscle_fraction, musclePowerPerKg_W (only to form P_avail for C16, flagged as the premise)'], scope: { kernelChecked: [], assumed: ['contested: contraction frequency falls with size, so the modern expectation is an exponent below 3'] } });
laws.push({ id: 'fick-principle', level: 'physiology', statement: 'O2 delivered to tissue = cardiac output × (arterial − venous O2 content).', status: 'stated-not-proved (the aerobic bound takes it as its named hypothesis fick_aerobic_supply)', module: 'lean/Delphi/Flight.lean', theorem: null, constraints: ['C14'], studioFields: ['cardiacOutput, arterialO2, efficiency, oxycaloric'], scope: { kernelChecked: [], assumed: ['conservation of O2 in the circulation; aerobic power only'] } });
for (const [id, level, statement, why] of [
  ['gill-o2-uptake', 'physiology', 'Arterial O2 content as a function of water O2, gill area and ventilation (the first link of the simulator chain).', 'not formalised: the counter-current model in physiology/countercurrent.js is numerical; the Studio must commit arterialO2 directly'],
  ['taxiing-thrust', 'phenotype', 'Thrust from the caudal fin during taxiing, which the field glide distances require beyond one unpowered glide.', 'not formalised: no model of tail-beat thrust in lean/; the glide bound shows it is needed'],
  ['aspect-ratio-induced-drag', 'phenotype', 'Induced drag falls with aspect ratio; L/D depends on fin shape.', 'not formalised: L/D enters only as a committed number'],
  ['elastic-similarity', 'phenotype', 'Bones thicken with size (d ∝ ℓ^(3/2)) rather than isometrically.', 'not formalised: R7 and R9 use isometric sections'],
  ['walking-pendulum-speed', 'phenotype', 'Walking speed ∝ √L from the leg as a pendulum (Thompson ch. II, third route).', 'not formalised'],
  ['fin-length-ratio', 'phenotype', 'What sets pectoral fin length relative to body length (0.687 measured, Daane 2021).', 'no theorem constrains fin length; it is an input the model carries'],
  ['gene-regulatory-dynamics', 'genotype-to-phenotype', 'How a gene edit changes a structure quantitatively (bioelectric kcnk5b, slc43a2a transport).', 'not formalised: the map records links (expressed in, required for, sufficient for), not dynamics; the Studio may only propagate an edit to every linked node (G2)'],
]) laws.push({ id, level, statement, status: 'not formalised', module: null, theorem: null, constraints: [], studioFields: [], scope: null, why });

// The empirical layer: observations, not laws. They are listed here so that a reader of the catalogue sees
// what the checker leans on besides theorems, with status "empirical" and the cost of rejecting each.
const EMPIRICAL = fs.existsSync(path.join(root, 'lean/empirical.json')) ? JSON.parse(fs.readFileSync(path.join(root, 'lean/empirical.json'), 'utf8')) : null;
if (EMPIRICAL) for (const e of EMPIRICAL.entries) laws.push({ id: e.id, level: 'empirical observation', statement: e.statement, label: e.title, status: e.status, module: EMPIRICAL.module,
  theorem: (e.lean && e.lean.theorems ? e.lean.theorems[0] : null) || (e.lean && e.lean.definition) || null, source: e.source, constraints: e.constraints,
  studioFields: e.constraints.map(cid => (byClaim['empirical-' + cid.replace(/^E/, 'E')] || []).length ? cid : cid), scope: null, observation: e.observation, taxa: e.taxa, why: e.scope, rejectable: e.rejectable });

// Buckets, not the first word of a status sentence: a law is proved, proved from a hypothesis, an
// observation, a convention, or not formalised at all.
const bucket = l => /^not formalised/.test(l.status) ? 'not formalised' : /^empirical/.test(l.status) ? 'empirical observation' : /^project convention/.test(l.status) ? 'project convention' : /^not an empirical/.test(l.status) ? 'proved (listed with the observations)' : /^stated-not-proved/.test(l.status) ? 'stated-not-proved (a named hypothesis)' : /hypothesis/.test(l.status) ? 'proved from a named hypothesis' : /^proved/.test(l.status) ? 'proved' : l.status;
const counts = laws.reduce((a, l) => (a[bucket(l)] = (a[bucket(l)] || 0) + 1, a), {});
const out = { built: new Date().toISOString(), tool: 'lean/laws/build-laws.mjs', leanReport: R.built, constraintsBuilt: C.built, coverage: counts, note: 'Coverage is explicit: "proved" entries come from the compiler\'s report and the constraints file; "stated-not-proved" entries are hypotheses the modules carry by name; "not formalised" entries are gaps the Studio must not treat as checked. "All the biological laws" is not a closed set; this file is what the project has, and every law not here is unchecked.', laws };
fs.writeFileSync(path.join(root, 'lean/laws.json'), JSON.stringify(out, null, 1));
let md = `# Laws the Design Studio can check, and the ones it cannot\n\nGenerated ${out.built} by \`lean/laws/build-laws.mjs\` from \`lean.json\` (built ${R.built}) and \`lean/constraints.json\`. ${out.note}\n\n| Status | Laws |\n|---|---|\n${Object.entries(counts).map(([k, v]) => `| ${k} | ${v} |`).join('\n')}\n\n`;
for (const grp of ['empirical observation', 'genotype', 'genotype-to-phenotype', 'developmental', 'population', 'phenotype (structure)', 'phenotype', 'physiology', 'phenotype+physiology']) {
  const ls = laws.filter(l => l.level === grp); if (!ls.length) continue;
  md += `## ${grp}\n\n${grp === 'empirical observation' ? 'Observations the checker may use, carried as Lean structures and NOT as axioms (lean/Delphi/Empirical.lean declares none). An elimination that depends on one is reported as conditional on it, and a reader who rejects the observation drops that elimination and keeps every proved one. Non-vacuity: `Delphi.Empirical.empirical_nonvacuous` instantiates every entry with the measured numbers at once.\n\n' : ''}| Law | Status | Statement | Constraints | Studio fields | Scope |\n|---|---|---|---|---|---|\n`;
  for (const l of ls) md += `| \`${l.id}\`${l.theorem ? `<br>\`${l.theorem.replace(/^Delphi\./, '')}\`` : ''} | ${l.status} | ${l.statement.replace(/\|/g, '\\|')} | ${l.constraints.join(', ') || '—'} | ${l.studioFields.join('; ').replace(/\|/g, '\\|') || '—'} | ${l.scope ? `kernel-checked: ${l.scope.kernelChecked.length}; assumed: ${l.scope.assumed.length}` : (l.why || '').replace(/\|/g, '\\|')} |\n`;
  md += '\n';
}
fs.writeFileSync(path.join(root, 'lean/LAWS.md'), md);
// A copy the sub-dashboard can fetch (the page may only read files under dashboard/public).
fs.writeFileSync(path.join(root, 'dashboard/public/t/lean/laws.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ laws: laws.length, coverage: counts }));
