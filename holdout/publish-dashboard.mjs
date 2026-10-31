#!/usr/bin/env node
// Copies what the holdout sub-dashboard needs into dashboard/public/t/holdout/data.json.
// Run after make-split.mjs. Every number on the page comes from this file.
//   node holdout/publish-dashboard.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const split = rd('holdout/split.json');
const exam = rd('holdout/exam.json');
const sums = rd('holdout/CHECKSUMS.json');
const altP = 'holdout/alt/Mammalia/split.json';
const burned = fs.existsSync(path.join(root, 'holdout/burned.json')) ? rd('holdout/burned.json').claims : [];
const alt = fs.existsSync(path.join(root, altP)) ? rd(altP) : null;

const byClass = {};
for (const t of split.taxa) {
  const k = t.class || (t.phylum ? `(${t.phylum}, no class)` : '(no class)');
  byClass[k] ||= { holdout: 0, train: 0, excluded: 0 };
  byClass[k][t.assignment]++;
}
const levels = {};
for (const r of exam.roster) { const k = r.genome ? (r.genome.best_level || 'no assembly') : 'no NCBI taxid'; levels[k] = (levels[k] || 0) + 1; }

// Leak check: run check-leaks.mjs --json; it exits 1 when it finds a hit, which is still a valid report.
let leaks = null;
{
  const r = spawnSync(process.execPath, [path.join(root, 'holdout/check-leaks.mjs'), '--json'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  try { leaks = JSON.parse(r.stdout.trim().split(/\r?\n/).pop()); } catch { leaks = { error: (r.stderr || '').slice(0, 300) }; }
  if (leaks && leaks.hits) {
    const byFile = {};
    for (const h of leaks.hits) (byFile[h.file] ||= { file: h.file, n: 0, what: new Set() }).n++, byFile[h.file].what.add(h.what.replace(/ \(.*$/, ''));
    leaks.files = Object.values(byFile).map(f => ({ file: f.file, n: f.n, what: [...f.what].slice(0, 6) })).sort((a, b) => b.n - a.n);
    delete leaks.hits;
  }
}

// Exam results written by run-claim-exam.mjs / score.mjs
const examResults = [];
const er = path.join(root, 'holdout/exam-results');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : /^result(\.run\d+)?\.json$/.test(e.name) ? [path.join(d, e.name)] : []);
const latestPerDir = files => { const m = {}; for (const f of files) { const d = path.dirname(f); const n = Number((path.basename(f).match(/run(\d+)/) || [0, 1])[1]); if (!m[d] || n > m[d].n) m[d] = { f, n }; } return Object.values(m).map(x => x.f); };
if (fs.existsSync(er)) for (const f of latestPerDir(walk(er))) {
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (r.exam_measured && r.exam_measured.A_keel) { const m = r.exam_measured; r.exam_measured = { value: `A keel: ${m.A_keel.n_scored} scored; B webbing: ${m.B_webbing.n_scored} scored; C conflicts: ${m.C_conflict_free.not_reported ? 'not reported' : m.C_conflict_free.ok + ' clean'}`, unit: 'pre-registered tests A, B, C (PREREG.md)', n: 48, extra: r.exploratory_not_preregistered || null }; r.builder_measured = { value: `${r.exploratory_not_preregistered?.distinct_prediction_vectors_across_roster ?? '?'} distinct vectors`, unit: 'exploratory: distinct prediction vectors across the 48 roster species (not pre-registered)', n: 48 }; r.builder_verdict = 'n/a (blueprint tool)'; r.exam_verdict_reason = (r.caveats || []).join(' '); }
  examResults.push({ file: path.relative(root, f).split(path.sep).join('/'), claim_id: r.claim_id, builder_result: r.builder_result, builder_verdict: r.builder_verdict, builder_measured: r.builder_measured ? { value: r.builder_measured.value, unit: r.builder_measured.unit, n: r.builder_measured.n } : null, exam_measured: r.exam_measured ? { value: r.exam_measured.value, unit: r.exam_measured.unit, n: r.exam_measured.n, extra: r.exam_measured.extra || null } : null, exam_verdict: r.exam_verdict, reason: r.exam_verdict_reason || null, agrees: r.agrees_with_builder, date: r.assessor?.date, leak_check_exit: r.preconditions?.leak_check_exit });
}

const powerP = path.join(root, 'holdout/power-analysis.json');
const power = fs.existsSync(powerP) ? JSON.parse(fs.readFileSync(powerP, 'utf8')) : null;

const naP = path.join(root, 'holdout/exam-results/not-applicable.json');
const notApplicable = fs.existsSync(naP) ? JSON.parse(fs.readFileSync(naP, 'utf8')).tests : [];

// Nanopub records (drafts until the key owner decides): holdout/nanopubs/manifest.json
const npP = path.join(root, 'holdout/nanopubs/manifest.json');
const nanopubs = fs.existsSync(npP) ? (() => { const m = JSON.parse(fs.readFileSync(npP, 'utf8')); return { status: m.status, built: m.built, ontology: m.ontology, note: m.note, lint_exemptions: Object.keys(m.lint_exemptions || {}).length, records: m.nanopubs.map(n => ({ file: n.file, kind: n.kind, introduces: n.introduces, verdict: n.verdict || null, registry: n.registry, trustyUri: n.trustyUri, bytes: fs.existsSync(path.join(root, n.file)) ? fs.statSync(path.join(root, n.file)).size : null })) }; })() : null;

const out = {
  built: new Date().toISOString(),
  clade: split.clade, label: split.label, provisional: split.provisional,
  decision: split.decision || null, first_frozen_at: sums.first_frozen_at || sums.frozen_at,
  previous_freeze: sums.previous_freeze ? { frozen_at: sums.previous_freeze.frozen_at, provisional: sums.previous_freeze.provisional, exam_json_sha256: sums.previous_freeze.outputs?.['exam.json']?.sha256, roster_unchanged: sums.previous_freeze.roster_unchanged, superseded_because: sums.previous_freeze.superseded_because } : null,
  rule: split.rule, rules_for_builders: exam.rules_for_builders, what_is_tested: exam.what_is_tested,
  frozen_at: sums.frozen_at, checksums: sums,
  summary: split.summary,
  alt: alt ? { clade: alt.clade, summary: alt.summary } : null,
  byClass, levels,
  roster: exam.roster,
  higher: exam.higher_taxa_also_held_out,
  excluded: split.taxa.filter(t => t.assignment === 'excluded').map(t => ({ name: t.name, rank: t.rank, reason: t.reason })),
  claims: exam.claims_mentioning_holdout,
  burned,
  examResults,
  notApplicable,
  power,
  nanopubs,
  leaks
};
const dir = path.join(root, 'dashboard/public/t/holdout');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(out));
console.log(`leak check: ${leaks?.files ? leaks.files.length + ' file(s) name a held-out organism' : 'failed'}`);
console.log(`t/holdout/data.json: ${out.roster.length} roster species, ${Object.keys(byClass).length} classes, frozen ${out.frozen_at}`);
