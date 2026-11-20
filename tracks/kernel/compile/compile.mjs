#!/usr/bin/env node
// The biological compiler: a behavioural description in, DNA and protocols out, with every choice
// minted through the DELPHI kernel so that nothing comes out that the records do not support.
//
//   node tracks/kernel/compile/compile.mjs tracks/kernel/compile/designs/and2.v
//   node tracks/kernel/compile/compile.mjs <design.v> [--out <dir>] [--store <file>] [--json]
//
// What it does, in order:
//   1. reads the design and lowers it to NOT / NOR / OR gates (hdl.mjs)
//   2. mints the registry into the kernel: one evidence node per quote, one fact node per number
//   3. mints the laws — the Lean file is CHECKED BY THE LEAN KERNEL here, not asserted
//   4. maps gates to repressors, refusing any pair the records call non-orthogonal
//   5. mints a verdict per cascade, per orthogonality pair, and for the parameter set
//   6. asks the kernel for three artifacts. It grants the ones whose verdicts all hold and refuses
//      the others, naming what is missing. The refusals are the useful part: each one is a short
//      list of measurements that would unblock a real build.
//
// Nothing here is a claim that a circuit works. It is a claim about what the published record does
// and does not license, written so that a wet lab can act on the gap.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Kernel, { Refused, ROOT } from '../kernel.mjs';
import { parse, netlist } from './hdl.mjs';
import * as emit from './emit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const JSON_OUT = process.argv.includes('--json');

const designFile = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(HERE, 'designs', 'and2.v');
const OUT = arg('--out', path.join(ROOT, 'tracks/kernel/compile/out'));
const HOST = arg('--host', 'Escherichia coli');
const log = (...a) => { if (!JSON_OUT) console.log(...a); };

// ---------------------------------------------------------------------------------------------------
// 1. the design

const src = fs.readFileSync(designFile, 'utf8');
const mod = parse(src);
const net = netlist(mod);
log(`design   ${path.relative(ROOT, designFile).split(path.sep).join('/')}: module ${net.module}, inputs ${net.inputs.join(', ')}`);
log(`lowered  ${net.gates.length} gate(s) [${net.gates.map((g) => g.kind).join(' ')}], ${net.repressors_needed} repressor(s) needed, ${net.cascades.length} cascade(s)`);

// ---------------------------------------------------------------------------------------------------
// 2. the registry into the kernel

const K = new Kernel({ file: arg('--store', path.join(ROOT, 'tracks/kernel/store/nodes.jsonl')) });
const reg = JSON.parse(fs.readFileSync(path.join(HERE, 'parts.json'), 'utf8'));
const cond = (key) => { const c = reg.conditions[key]; return { host: c.host, strain: c.strain, medium: c.medium, temperature_C: c.temperature_C, reference_standard: c.reference_standard }; };
const cite = (s) => `${reg.sources[s].citation} doi:${reg.sources[s].doi}`;

// fact index: "partId/quantity" -> fact node id
const facts = {};
let nEv = 0, nFact = 0;
for (const part of reg.parts) {
  if (part.sequence && part.sequence_source) {
    K.evidence({ kind: 'doi', ref: reg.sources[part.sequence_source].doi, quote: part.sequence_quote, where: part.sequence_where, retrieved: reg.sources[part.sequence_source].retrieved });
    nEv++;
  }
  for (const m of part.measurements ?? []) {
    const ev = K.evidence({ kind: 'doi', ref: reg.sources[m.source].doi, quote: m.quote, where: m.where, retrieved: reg.sources[m.source].retrieved, note: m.note ?? null });
    nEv++;
    const f = K.fact({
      statement: `${part.id}: ${m.quantity} = ${m.value} ${m.unit}`,
      quantity: m.quantity, value: m.value, unit: m.unit,
      conditions: cond(m.conditions), evidence: [ev.id], note: m.note ?? null,
    });
    facts[`${part.id}/${m.quantity}`] = f.id;
    nFact++;
  }
}
log(`registry ${nEv} evidence node(s), ${nFact} fact node(s) from ${Object.keys(reg.sources).length} source(s)`);

// ---------------------------------------------------------------------------------------------------
// 3. the laws. The Lean file is checked here; a law the kernel cannot audit is not minted.

let lawMargin;
try {
  lawMargin = K.law({
    name: 'cascade_noise_margin',
    informal: "In a cascade, the upstream gate's OFF level must sit below the downstream gate's half-maximal input and its ON level above it. Otherwise the downstream gate cannot tell the two states apart and the circuit's logic is not realised in the cell.",
    lean_file: 'tracks/kernel/lean/CircuitLaws.lean',
    lean_decls: ['Delphi.Circuit.margins_pos', 'Delphi.Circuit.no_margin_of_le'],
  });
  log(`law      ${lawMargin.name}: ${lawMargin.audit.verdict} by ${lawMargin.audit.tool} (${lawMargin.audit.toolchain}), axioms [${lawMargin.audit.axioms.join(', ')}]`);
} catch (e) {
  if (!(e instanceof Refused)) throw e;
  console.error(`law refused: ${e.message}`);
  process.exit(1);
}

// These two were script-checked when the kernel first ran. They are now theorems in the same file,
// so the rule itself is proved and the script only supplies the data it is applied to.
const lawOrtho = K.law({
  name: 'distinct_orthogonal_repressors',
  informal: 'Two gates in one circuit must use repressors that do not bind each other\'s promoters. A repressor used twice, or a pair the record reports as cross-reacting, makes the wiring diagram and the cell disagree.',
  lean_file: 'tracks/kernel/lean/CircuitLaws.lean',
  lean_decls: ['Delphi.Circuit.not_orthogonal_of_reuse', 'Delphi.Circuit.not_orthogonal_of_crossreact'],
  script: 'tracks/kernel/compile/compile.mjs supplies the chosen repressors and the crosstalk groups in parts.json; the rule applied to them is the Lean theorem',
});
const lawParams = K.law({
  name: 'model_parameters_present',
  informal: 'A predictive model of a gate needs four numbers: both output levels, the half-maximal input and the cooperativity. A model built with any of them guessed is not a prediction.',
  lean_file: 'tracks/kernel/lean/CircuitLaws.lean',
  lean_decls: ['Delphi.Circuit.not_complete_of_halfMax_none', 'Delphi.Circuit.not_modelable_of_one_missing', 'Delphi.Circuit.hill_strict_mono'],
  script: 'tracks/kernel/compile/emit.mjs supplies which parameters each gate has; the rule applied to them is the Lean theorem, which also proves the response is monotone so that "the threshold" names one input level',
});
log(`law      ${lawOrtho.name}: ${lawOrtho.audit.verdict}, ${lawOrtho.lean_decls.length} declaration(s) audited`);
log(`law      ${lawParams.name}: ${lawParams.audit.verdict}, ${lawParams.lean_decls.length} declaration(s) audited`);

// ---------------------------------------------------------------------------------------------------
// 4. technology mapping
//
// Upstream positions need a gate whose two OUTPUT levels were measured. Downstream positions need a
// gate whose THRESHOLD was measured. The registry has few of each, on purpose: it holds what the
// papers printed, not what would be convenient.

const haveOut = reg.parts.filter((p) => p.role === 'not_gate' && facts[`${p.id}/output_on_REU`] && facts[`${p.id}/output_off_REU`]);
const haveK = reg.parts.filter((p) => p.role === 'not_gate' && facts[`${p.id}/threshold_REU`]);
const nonOrtho = reg.crosstalk.non_orthogonal_groups;

const assigned = new Map();
const used = new Set();
const clashes = [];
function pick(pool, why) {
  for (const p of pool) {
    if (used.has(p.repressor)) continue;
    const group = nonOrtho.find((g) => g.members.includes(p.repressor) && [...used].some((u) => g.members.includes(u)));
    if (group) { clashes.push({ repressor: p.repressor, with: group.members.filter((m) => used.has(m)), quote: group.quote, where: group.where }); continue; }
    used.add(p.repressor);
    return p;
  }
  return null;
}
// gates that feed another gate are upstream; the rest are terminal
const feeds = new Set(net.cascades.map((c) => c.from.output));
for (const g of net.gates) {
  if (g.kind === 'OR') continue;
  const p = feeds.has(g.output) ? pick(haveOut, 'upstream: needs measured output levels') : pick(haveK, 'terminal: needs a measured threshold');
  if (p) {
    g.repressor = p.repressor;
    g.part = p.id;
    g.params = Object.fromEntries((p.measurements ?? []).map((m) => [m.quantity, m.value]));
    assigned.set(g.output, p);
  } else {
    g.repressor = null;
    g.params = {};
  }
}
log(`mapping  ${[...assigned.entries()].map(([w, p]) => `${w}=${p.repressor}`).join(', ') || 'nothing could be assigned'}`);
if (clashes.length) log(`         avoided ${clashes.length} non-orthogonal choice(s): ${clashes.map((c) => `${c.repressor} with ${c.with.join('/')}`).join('; ')}`);

// ---------------------------------------------------------------------------------------------------
// 5. verdicts

const verdicts = [];

// 5a. every cascade, using the facts as they were measured. The kernel refuses to combine numbers
//     from incompatible conditions, which is where most of these land.
for (const c of net.cascades) {
  const up = assigned.get(c.from.output), down = assigned.get(c.to.output);
  if (!up || !down) {
    verdicts.push(K.verdict({
      law: lawMargin.id, label: `${c.from.output} -> ${c.to.output}`,
      facts: [facts[`${(up ?? down)?.id}/output_on_REU`] ?? facts[`${(up ?? down)?.id}/threshold_REU`]].filter(Boolean),
      requires: ['output_off_REU', 'output_on_REU', 'threshold_REU'],
      apply: () => ({ result: null, detail: 'no gate in the registry had the measurements this position needs' }),
    }));
    continue;
  }
  const fs_ = [facts[`${up.id}/output_off_REU`], facts[`${up.id}/output_on_REU`], facts[`${down.id}/threshold_REU`]].filter(Boolean);
  verdicts.push(K.verdict({
    law: lawMargin.id, label: `${up.repressor} -> ${down.repressor}`,
    facts: fs_,
    requires: ['output_off_REU', 'output_on_REU', 'threshold_REU'],
    apply: (v) => {
      const low = v.threshold_REU - v.output_off_REU, high = v.output_on_REU - v.threshold_REU;
      return {
        result: low > 0 && high > 0 ? 'inside' : 'outside',
        detail: `low margin ${low.toFixed(2)} REU (threshold ${v.threshold_REU} - OFF ${v.output_off_REU}), high margin ${high.toFixed(2)} REU (ON ${v.output_on_REU} - threshold ${v.threshold_REU})`,
        by: 'kernel arithmetic under Delphi.Circuit.margins_pos',
      };
    },
  }));
}

// 5b. the gate set's own envelope, both numbers measured in the same work under the same conditions.
//     This is the check that says something about the published set as a whole.
const envelope = [
  { label: 'worst case in the set: highest OFF against the lowest threshold', off: 'gate_set_envelope/output_off_REU_max', k: 'gate_TarA/threshold_REU', on: 'gate_set_envelope/output_on_REU_min' },
  { label: 'best case in the set: lowest OFF against the highest threshold', off: 'gate_set_envelope/output_off_REU_min', k: 'gate_ButR/threshold_REU', on: 'gate_set_envelope/output_on_REU_min' },
];
for (const e of envelope) {
  const ids = [facts[e.off], facts[e.k], facts[e.on]].filter(Boolean);
  if (ids.length < 3) continue;
  verdicts.push(K.verdict({
    law: lawMargin.id, label: e.label, facts: ids,
    requires: [e.off.split('/')[1], 'threshold_REU', e.on.split('/')[1]],
    apply: (v) => {
      const off = v.output_off_REU_max ?? v.output_off_REU_min, on = v.output_on_REU_min, k = v.threshold_REU;
      const low = k - off, high = on - k;
      return {
        result: low > 0 && high > 0 ? 'inside' : 'outside',
        detail: `low margin ${low.toFixed(2)} REU (threshold ${k} - OFF ${off}), high margin ${high.toFixed(2)} REU (ON ${on} - threshold ${k})`,
        by: 'kernel arithmetic under Delphi.Circuit.margins_pos / no_margin_of_le',
      };
    },
  }));
}

// 5c. orthogonality of what was actually assigned
const pairs = [...assigned.values()].map((p) => p.repressor);
verdicts.push(K.verdict({
  law: lawOrtho.id, label: `the ${pairs.length} repressor(s) chosen`,
  facts: [facts['gate_ButR/dynamic_range_fold'] ?? Object.values(facts)[0]],
  apply: () => {
    const dupes = pairs.filter((r, i) => pairs.indexOf(r) !== i);
    const cross = nonOrtho.filter((g) => g.members.filter((m) => pairs.includes(m)).length > 1);
    return dupes.length || cross.length
      ? { result: 'outside', detail: `${dupes.length ? 'repressor reused: ' + dupes.join(', ') + '. ' : ''}${cross.length ? 'cross-reacting pair chosen: ' + cross.map((g) => g.members.join('/')).join('; ') : ''}`.trim(), by: 'Delphi.Circuit.not_orthogonal_of_reuse/_of_crossreact, over the crosstalk groups in parts.json' }
      : { result: 'inside', detail: `${pairs.join(', ')}: no repressor reused, and no pair appears in a crosstalk group the record reports`, by: 'Delphi.Circuit.not_orthogonal_of_reuse/_of_crossreact, over the crosstalk groups in parts.json' };
  },
}));

// 5d. are the four model parameters present for every gate?
const sbmlTry = emit.sbml({ ...net, host: HOST, slots: [], gates: net.gates }, path.join(OUT, '_probe.xml'));
verdicts.push(K.verdict({
  law: lawParams.id, label: 'the four Hill parameters, every gate',
  facts: [Object.values(facts)[0]],
  apply: () => sbmlTry.refused
    ? { result: 'outside', detail: `${sbmlTry.missing.length} parameter(s) not in any record read: ${sbmlTry.missing.map((m) => `${m.repressor ?? m.gate}.${m.parameter}`).join(', ')}`, by: 'Delphi.Circuit.not_modelable_of_one_missing, over the parameters present in parts.json' }
    : { result: 'inside', detail: 'every gate has both output levels, a threshold and a cooperativity', by: 'Delphi.Circuit.not_modelable_of_one_missing, over the parameters present in parts.json' },
}));

const tally = { inside: 0, outside: 0, 'cannot-assess': 0 };
for (const v of verdicts) tally[v.result]++;
log(`verdicts ${tally.inside} inside, ${tally.outside} outside, ${tally['cannot-assess']} cannot-assess`);
for (const v of verdicts) log(`         ${v.result.padEnd(13)} ${v.law_name} [${v.label}] ${v.detail ?? ''}`);

// ---------------------------------------------------------------------------------------------------
// 6. the artifacts

// the construct's slots, in order along the DNA
const byId = Object.fromEntries(reg.parts.map((p) => [p.id, p]));
const slot = (p, role) => ({
  id: p.id, role: role ?? p.role, gbkey: { constitutive_promoter: 'promoter', rbs: 'RBS', not_gate: 'CDS', reporter: 'CDS', terminator: 'terminator' }[role ?? p.role] ?? 'misc_feature',
  sequence: p.sequence ?? null, sequence_quote: p.sequence_quote ?? null, sequence_where: p.sequence_where ?? null,
  sequence_source_citation: p.sequence_source ? cite(p.sequence_source) : null,
  sequence_open_because: p.sequence_open_because ?? null, sequence_would_be_filled_by: p.sequence_would_be_filled_by ?? null,
});
const slots = [];
for (const g of net.gates.filter((g) => g.kind !== 'OR')) {
  slots.push(slot(byId['BBa_J23101'], 'constitutive_promoter'));
  slots.push(slot(byId['BBa_B0034'], 'rbs'));
  slots.push(g.part ? slot(byId[g.part], 'not_gate') : { id: `repressor_for_${g.output}`, role: 'not_gate', gbkey: 'CDS', sequence: null, sequence_open_because: 'no gate in the registry had the measurements this position needs, so no repressor was chosen', sequence_would_be_filled_by: 'a characterised gate with the missing measurement' });
  slots.push(slot(byId['terminator_slot'], 'terminator'));
}
slots.push(slot(byId['reporter_YFP'], 'reporter'));
slots.push(slot(byId['terminator_slot'], 'terminator'));

const plan = { ...net, host: HOST, slots, build_id: null, stamp: reg.written };
fs.mkdirSync(OUT, { recursive: true });
fs.rmSync(path.join(OUT, '_probe.xml'), { force: true });

const results = [];
const inside = verdicts.filter((v) => v.result === 'inside').map((v) => v.id);

// artifact 1: the assembly plan. Rests on the verdicts that hold.
try {
  const b = K.build({
    artifact: `${net.module}: assembly plan (annotated construct + liquid-handling protocols)`,
    verdicts: inside,
    emit: () => {
      plan.build_id = 'pending';
      return [
        emit.genbank(plan, path.join(OUT, `${net.module}.gb`)),
        emit.opentrons(plan, path.join(OUT, `${net.module}-golden-gate.opentrons.py`)),
        emit.autoprotocol(plan, path.join(OUT, `${net.module}-golden-gate.autoprotocol.json`)),
      ];
    },
  });
  plan.build_id = b.id;
  results.push({ artifact: 'assembly plan', minted: b.id, files: b.emitted.map((f) => f.path) });
  log(`BUILD    ${b.id}: ${b.emitted.length} file(s) — ${b.emitted.map((f) => path.basename(f.path)).join(', ')}`);
} catch (e) {
  if (!(e instanceof Refused)) throw e;
  results.push({ artifact: 'assembly plan', refused: e.because, refusal: e.refusal });
  log(`REFUSED  assembly plan: ${e.because.join(' | ')}`);
}

// artifact 2: a construct somebody could order. Needs every slot filled.
try {
  const b = K.build({
    artifact: `${net.module}: orderable sequence (FASTA)`,
    verdicts: inside,
    emit: () => { const r = emit.fasta(plan, path.join(OUT, `${net.module}.fasta`)); if (r.refused) throw new Refused('FASTA', r.refused); return [r]; },
  });
  results.push({ artifact: 'orderable sequence', minted: b.id, files: b.emitted.map((f) => f.path) });
} catch (e) {
  if (!(e instanceof Refused)) throw e;
  const r = K.append({ type: 'refusal', what: `${net.module}: orderable sequence (FASTA)`, because: e.because, verdicts: inside, facts: [] });
  results.push({ artifact: 'orderable sequence', refused: e.because, refusal: r.id });
  log(`REFUSED  orderable sequence: ${e.because.join(' | ')}`);
}

// artifact 3: the predictive model. Refused while a parameter is missing, and the refusal is turned
// into nanopublication drafts: one per measurement that would unblock it.
const modelVerdict = verdicts.find((v) => v.law_name === 'model_parameters_present');
try {
  const b = K.build({
    artifact: `${net.module}: predictive model (SBML)`,
    verdicts: [...inside, modelVerdict.id],
    emit: () => { const r = emit.sbml(plan, path.join(OUT, `${net.module}.sbml`)); if (r.refused) throw new Refused('SBML', r.refused); return [r]; },
  });
  results.push({ artifact: 'predictive model', minted: b.id, files: b.emitted.map((f) => f.path) });
} catch (e) {
  if (!(e instanceof Refused)) throw e;
  const drafts = emit.nanopubDrafts(sbmlTry.missing ?? [], path.join(OUT, 'nanopub-drafts'), plan);
  results.push({ artifact: 'predictive model', refused: e.because, refusal: e.refusal ?? null, drafts: drafts.map((d) => path.relative(ROOT, d.path).split(path.sep).join('/')) });
  log(`REFUSED  predictive model: ${e.because.join(' | ')}`);
  log(`         wrote ${drafts.length} unsigned nanopublication draft(s), one per missing measurement`);
}

// the justification graph covers everything above, refusals included
const jg = emit.justify(plan, K.all(), path.join(OUT, `${net.module}-justification.jsonld`));
log(`justify  ${path.relative(ROOT, jg.path).split(path.sep).join('/')} (${jg.bytes} bytes)`);

// Which nodes THIS run decided. The store is append-only and keeps every earlier run's nodes too, so
// anything that reports "what the run said" has to name its own nodes rather than read the whole store.
const ids = {
  laws: [lawMargin.id, lawOrtho.id, lawParams.id],
  verdicts: verdicts.map((v) => v.id),
  builds: results.filter((r) => r.minted).map((r) => r.minted),
  refusals: results.filter((r) => r.refusal).map((r) => r.refusal),
};

const summary = { ids, design: path.relative(ROOT, designFile).split(path.sep).join('/'), module: net.module, host: HOST, gates: net.gates.length, cascades: net.cascades.length, mapping: Object.fromEntries([...assigned.entries()].map(([w, p]) => [w, p.repressor])), avoided_non_orthogonal: clashes, verdicts: verdicts.map((v) => ({ law: v.law_name, label: v.label, result: v.result, detail: v.detail })), tally, artifacts: results, slots: { total: slots.length, filled: slots.filter((s) => s.sequence).length }, kernel: K.summary() };
fs.writeFileSync(path.join(OUT, 'last-run.json'), JSON.stringify(summary, null, 1) + '\n');
if (JSON_OUT) console.log(JSON.stringify(summary, null, 1));
else {
  log(`store    ${K.summary().nodes} node(s), ${K.summary().chain_problems} chain problem(s)`);
  log(`\ncompiled ${net.module}: ${results.filter((r) => r.minted).length} artifact(s) built, ${results.filter((r) => r.refused).length} refused, ${slots.filter((s) => s.sequence).length} of ${slots.length} slots filled from primary records`);
}
