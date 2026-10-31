#!/usr/bin/env node
// Scores organism-design/exam/aves-predictions.json against the rule in PREREG.md (same folder).
// Run by the assessor only, after building stops. Writes result.json beside this file.
//
//   node holdout/exam-results/organism-design/score.mjs --predictions organism-design/exam/aves-predictions.json \
//        --avonet <avonet-extract.csv> [--out result.json] [--assessor-model <model id>]
//
// Ground truth: NCBI Taxonomy lineage (fetched, cached in ncbi-lineage.cache.json) for test A,
// AVONET Primary.Lifestyle (CSV from avonet-extract.py) for test B. See PREREG.md for the mapping.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const predPath = path.resolve(root, opt('--predictions', 'organism-design/exam/aves-predictions.json'));
const avonetPath = opt('--avonet') ? path.resolve(opt('--avonet')) : null;
const outPath = path.resolve(here, opt('--out', 'result.json'));
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');

// ---- preconditions -------------------------------------------------------------------------
const verify = spawnSync(process.execPath, [path.join(root, 'holdout/make-split.mjs'), '--verify'], { cwd: root, encoding: 'utf8' });
if (verify.status !== 0) { console.error(verify.stdout); console.error('split not intact; refusing to score'); process.exit(1); }
// --json keeps the output small (the folder's SPARQL cache produces tens of thousands of weak-word warnings).
const leaks = spawnSync(process.execPath, [path.join(root, 'holdout/check-leaks.mjs'), path.join(root, 'organism-design'), '--json'], { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const sums = JSON.parse(fs.readFileSync(path.join(root, 'holdout/CHECKSUMS.json'), 'utf8'));
const exam = JSON.parse(fs.readFileSync(path.join(root, 'holdout/exam.json'), 'utf8'));
if (!fs.existsSync(predPath)) { console.error(`no predictions at ${predPath}`); process.exit(1); }
const predRaw = fs.readFileSync(predPath);
const pred = JSON.parse(predRaw.toString('utf8'));
const rosterSha = sums.outputs['exam.json'].sha256;
const meta = JSON.stringify(Object.fromEntries(Object.entries(pred).filter(([k]) => !['predictions', 'queries'].includes(k))));
const predSha = (meta.match(/[0-9a-f]{64}/g) || []).find(h => h === rosterSha) || null;
const shaMatches = predSha === rosterSha;

// ---- normalise predictions: per taxid -> structures ---------------------------------------
// Accepts either {species:[{taxid, predictions:[{structure_iri,label,predicted}]}]} or a flat list.
const byTaxid = {};
const items = Array.isArray(pred) ? pred : pred.species || pred.predictions || pred.roster || [];
for (const sp of items) {
  const taxid = Number(sp.taxid ?? sp.ncbi_taxid ?? sp.ids?.ncbi);
  if (!taxid) continue;
  const list = sp.predictions || sp.structures || (sp.structure_iri ? [sp] : []);
  (byTaxid[taxid] ||= { conflicts: sp.conflicts ?? sp.reading?.conflicts ?? null, structures: [] }).structures.push(...list);
}
const term = (s, res) => res.some(re => re.test(String(s.structure_iri || '')) || re.test(String(s.label || '')));
const KEEL = [/UBERON[_:]0010292/i, /carina/i, /keel/i];
const WEB = [/interdigital web/i, /webbed foot/i, /webbing/i, /UBERON[_:]0003134/i, /UBERON[_:]0006797/i];
const predictedFor = (taxid, res) => { const s = (byTaxid[taxid]?.structures || []).find(x => term(x, res)); return s ? String(s.predicted || s.presence || '').toLowerCase() : null; };

// ---- ground truth A: NCBI lineage ----------------------------------------------------------
const cachePath = path.join(here, 'ncbi-lineage.cache.json');
const cache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf8')) : {};
const RATITE_ORDERS = ['Struthioniformes', 'Rheiformes', 'Casuariiformes', 'Apterygiformes'];
async function lineage(taxid) {
  if (cache[taxid]) return cache[taxid];
  const r = await fetch(`https://api.ncbi.nlm.nih.gov/datasets/v2/taxonomy/taxon/${taxid}`, { headers: { 'user-agent': 'delphisci-holdout-exam' } });
  if (!r.ok) throw new Error(`NCBI ${taxid}: ${r.status}`);
  const j = await r.json();
  const node = j.taxonomy_nodes?.[0]?.taxonomy;
  const names = [];
  for (const id of node?.lineage || []) names.push(id);
  // The v2 endpoint returns lineage as taxids; resolve names in one call.
  const rr = await fetch(`https://api.ncbi.nlm.nih.gov/datasets/v2/taxonomy/taxon/${names.join(',')}`, { headers: { 'user-agent': 'delphisci-holdout-exam' } });
  const jj = rr.ok ? await rr.json() : { taxonomy_nodes: [] };
  const lineageNames = (jj.taxonomy_nodes || []).map(n => n.taxonomy?.organism_name).filter(Boolean);
  cache[taxid] = { name: node?.organism_name, lineage: lineageNames, retrieved: new Date().toISOString() };
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 1));
  await new Promise(r => setTimeout(r, 400));
  return cache[taxid];
}

// ---- ground truth B: AVONET lifestyle ------------------------------------------------------
let avonet = null, avonetSha = null;
if (avonetPath && fs.existsSync(avonetPath)) {
  const raw = fs.readFileSync(avonetPath, 'utf8'); avonetSha = sha256(raw);
  const [h, ...lines] = raw.split(/\r?\n/).filter(Boolean);
  const cols = h.split(','); const si = cols.indexOf('Species1'), li = cols.indexOf('Primary.Lifestyle');
  avonet = {};
  for (const l of lines) { const c = l.split(','); avonet[c[si]] = c[li]; }
}

const roster = exam.roster.filter(r => r.rank === 'species');
const A = { scored: [], not_predicted: [] }, B = { scored: [], not_predicted: [], not_in_avonet: [], generalist: [] }, C = { ok: 0, conflicts: 0, missing: 0, not_reported: 0 };
for (const r of roster) {
  const taxid = r.ids.ncbi; if (!taxid) continue;
  const lin = await lineage(taxid);
  const truthA = RATITE_ORDERS.some(o => lin.lineage.includes(o)) ? 'absent' : 'present';
  const pA = predictedFor(taxid, KEEL);
  if (pA === 'present' || pA === 'absent') A.scored.push({ name: r.name, taxid, truth: truthA, predicted: pA, correct: pA === truthA }); else A.not_predicted.push(r.name);
  const pB = predictedFor(taxid, WEB);
  if (!avonet) { /* no ground truth loaded */ }
  else if (!(r.name in avonet)) B.not_in_avonet.push(r.name);
  else {
    const life = avonet[r.name];
    const truthB = life === 'Aquatic' ? 'present' : ['Terrestrial', 'Insessorial', 'Aerial'].includes(life) ? 'absent' : null;
    if (truthB === null) B.generalist.push(r.name);
    else if (pB === 'present' || pB === 'absent') B.scored.push({ name: r.name, taxid, lifestyle: life, truth: truthB, predicted: pB, correct: pB === truthB });
    else B.not_predicted.push(r.name);
  }
  const bt = byTaxid[taxid];
  if (!bt) C.missing++; else if (!Array.isArray(bt.conflicts)) C.not_reported++; else if (bt.conflicts.length) C.conflicts++; else C.ok++;
}
const acc = s => s.length ? s.filter(x => x.correct).length / s.length : null;
const verdictFor = (s) => s.length < 10 ? 'inconclusive' : acc(s) >= 0.8 ? 'supports' : acc(s) < 0.6 ? 'refutes' : 'mixed';
const vA = verdictFor(A.scored), vB = avonet ? verdictFor(B.scored) : 'inconclusive', vC = C.not_reported + C.missing === roster.length ? 'inconclusive' : C.ok >= 40 ? 'supports' : 'refutes';
const overall = [vA, vB].includes('refutes') ? 'refutes' : [vA, vB].includes('inconclusive') ? 'inconclusive' : [vA, vB, vC].every(v => v === 'supports') ? 'supports' : 'mixed';
// Exploratory, not pre-registered: how many distinct prediction vectors the tool produced across the roster.
const vectors = new Set(Object.values(byTaxid).map(b => b.structures.map(x => `${x.structure_iri}=${x.predicted}`).sort().join(';')));
const panelLabels = [...new Set(Object.values(byTaxid).flatMap(b => b.structures.map(x => x.label)))];
const panelHas = { keel: panelLabels.filter(l => KEEL.some(re => re.test(l))), webbing: panelLabels.filter(l => WEB.some(re => re.test(l))) };
const ratites = A.scored.filter(x => x.truth === 'absent');
let ratitesOnRoster = 0; for (const r of roster) { const l = r.ids.ncbi && cache[r.ids.ncbi]; if (l && RATITE_ORDERS.some(o => l.lineage.includes(o))) ratitesOnRoster++; }

const result = {
  claim_id: 'organism-design text-to-blueprint, Aves roster',
  builder_result: path.relative(root, predPath).replace(/\\/g, '/'),
  builder_verdict: null,
  exam_clade: 'Aves',
  exam_roster_sha256: rosterSha,
  preconditions: { split_verified: true, leak_check_exit: leaks.status, predictions_sha256: sha256(predRaw), predictions_cite_roster_sha: shaMatches, allowlisted_files: ['organism-design/exam/'] },
  command: `node holdout/exam-results/organism-design/score.mjs --predictions ${path.relative(root, predPath).replace(/\\/g, '/')}${avonetPath ? ' --avonet ' + path.basename(avonetPath) : ''}`,
  ground_truth: { ncbi_lineage_cache: 'ncbi-lineage.cache.json', avonet_extract_sha256: avonetSha },
  exam_measured: {
    A_keel: { accuracy: acc(A.scored), n_scored: A.scored.length, n_not_predicted: A.not_predicted.length, ratites_on_roster: ratitesOnRoster, ratites_scored: ratites.length, ratites_correct: ratites.filter(x => x.correct).length, verdict: vA },
    B_webbing: { accuracy: acc(B.scored), n_scored: B.scored.length, n_not_predicted: B.not_predicted.length, n_not_in_avonet: B.not_in_avonet.length, n_generalist_unscored: B.generalist.length, verdict: vB },
    C_conflict_free: { ok: C.ok, with_conflicts: C.conflicts, missing: C.missing, not_reported: C.not_reported, of: roster.length, verdict: vC }
  },
  exploratory_not_preregistered: { distinct_prediction_vectors_across_roster: vectors.size, species_with_predictions: Object.keys(byTaxid).length, panel_structures: panelLabels.length, panel_terms_matching_keel: panelHas.keel, panel_terms_matching_webbing: panelHas.webbing, predictions_by_confidence: pred.tally || null },
  pass_criterion: 'PREREG.md: A and B accuracy >= 0.80 with >= 10 scored species each; C holds for >= 40 of 48',
  fail_criterion: 'PREREG.md: accuracy < 0.60 on A or B with >= 10 scored species',
  exam_verdict: overall,
  agrees_with_builder: null,
  caveats: [
    shaMatches ? null : 'predictions file does not cite the frozen exam.json SHA-256',
    leaks.status === 0 ? null : 'leak check on organism-design/ did not exit 0',
    avonet ? null : 'no AVONET extract given: test B not run',
    panelHas.keel.length ? null : 'the panel contains no sternal-keel term, so test A has no predictions to score',
    panelHas.webbing.length ? null : 'the panel contains no foot-webbing term, so test B has no predictions to score',
    C.not_reported ? 'the prediction file reports no reading.conflicts, so test C is not evaluable' : null
  ].filter(Boolean),
  details: { A: A.scored, B: B.scored, not_predicted: { A: A.not_predicted, B: B.not_predicted } },
  assessor: { kind: 'session', id: 'scienceclaw-93', model: opt('--assessor-model', 'claude-fable-5-1'), date: new Date().toISOString().slice(0, 10) }
};
// The exam is written once. A rerun never overwrites: it goes to result.runN.json with the reason given on the command line.
let finalPath = outPath;
if (fs.existsSync(outPath)) {
  let n = 2;
  while (fs.existsSync(outPath.replace(/\.json$/, `.run${n}.json`))) n++;
  finalPath = outPath.replace(/\.json$/, `.run${n}.json`);
  result.supersedes = path.basename(n === 2 ? outPath : outPath.replace(/\.json$/, `.run${n - 1}.json`));
  result.rerun_reason = opt('--reason', 'not stated');
}
fs.writeFileSync(finalPath, JSON.stringify(result, null, 1) + '\n');
console.log('wrote', path.relative(root, finalPath));
console.log(JSON.stringify({ verdict: overall, A: result.exam_measured.A_keel, B: result.exam_measured.B_webbing, C: result.exam_measured.C_conflict_free, caveats: result.caveats }, null, 1));
