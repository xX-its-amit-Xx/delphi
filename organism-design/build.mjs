#!/usr/bin/env node
// Collects everything the organism sub-dashboard shows into dashboard/public/t/organism/data/.
// Every number on the page is computed here from files in organism-design/; the HTML holds no numbers.
//   node organism-design/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const outDir = path.join(root, 'dashboard/public/t/organism/data');
fs.mkdirSync(path.join(outDir, 'examples'), { recursive: true });
const rd = p => JSON.parse(fs.readFileSync(p, 'utf8'));

// Examples: copy each blueprint, and summarise it for the index.
const exDir = path.join(here, 'examples');
const examples = [];
for (const f of fs.existsSync(exDir) ? fs.readdirSync(exDir).filter(f => f.endsWith('.json')).sort() : []) {
  const b = rd(path.join(exDir, f));
  fs.copyFileSync(path.join(exDir, f), path.join(outDir, 'examples', f));
  const nq = Object.keys(b.queries || {}).length;
  examples.push({
    file: 'data/examples/' + f, description: b.input.description, refused: !!b.refused, reason: b.refused ? b.reason : null,
    taxon: b.reading?.taxon ? { label: b.reading.taxon.label, term: b.reading.taxon.term, chosen_because: b.reading.taxon.chosen_because } : null,
    // counts are placements in the hierarchy, counts_distinct are distinct ontology terms. The page
    // shows the distinct ones: a tissue that is part of four organs is one tissue.
    counts: b.counts || null, counts_distinct: b.counts_distinct || b.counts || null,
    conflicts: (b.reading?.conflicts || []).map(c => c.label), queries: nq,
    structures_read: (b.reading?.anatomy_words || []).map(a => ({ matched: a.matched, label: a.label || a.term })),
    words_not_recognised: b.reading?.words_not_recognised || [],
    pruned: b.pruning?.totals || null,
    named_structures_cut: (b.pruning?.named_structures_cut || []).map(x => x.label),
    cells_with_markers: b.genome_sketch?.cells_with_markers ?? null, built: b.built,
    evidence: b.nodes ? { stated: b.nodes.filter(n => n.level === 'organ' && n.taxon_evidence?.startsWith('stated')).length, weak: b.nodes.filter(n => n.level === 'organ' && n.taxon_evidence?.startsWith('weak')).length, none: b.nodes.filter(n => n.level === 'organ' && n.taxon_evidence?.startsWith('none')).length } : null
  });
}

// ESMFold runs (every runs/<dir>/result.json), the ortholog comparison, and the claim attachments.
const esmfold = { runs: [], compare: null, attachments: [] };
const runDir = path.join(here, 'esmfold/runs');
if (fs.existsSync(runDir)) for (const d of fs.readdirSync(runDir, { withFileTypes: true })) {
  if (d.isDirectory()) {
    const f = path.join(runDir, d.name, 'result.json');
    if (!fs.existsSync(f)) continue;
    const r = rd(f);
    const pdb = path.join(runDir, d.name, 'predicted.pdb');
    if (fs.existsSync(pdb)) fs.copyFileSync(pdb, path.join(outDir, d.name + '-predicted.pdb'));
    esmfold.runs.push({ dir: d.name, ...r, pdb_file: fs.existsSync(pdb) ? 'data/' + d.name + '-predicted.pdb' : null });
  } else if (d.name.startsWith('compare') && d.name.endsWith('.json')) esmfold.compare = rd(path.join(runDir, d.name));
  else if (d.name.startsWith('attachment-') && d.name.endsWith('.json')) esmfold.attachments.push(rd(path.join(runDir, d.name)));
}
for (const r of esmfold.runs) { const f = path.join(runDir, r.dir, 'attachment.json'); if (fs.existsSync(f)) esmfold.attachments.push(rd(f)); }
esmfold.runs.sort((a, b) => (a.run.status === 'ok' ? 0 : 1) - (b.run.status === 'ok' ? 0 : 1) || a.dir.localeCompare(b.dir));

// Nanopub records (unsigned drafts): the manifest only, so the page states what exists and its status.
const npManifest = path.join(here, 'nanopubs/manifest.json');
const nanopubs = fs.existsSync(npManifest) ? rd(npManifest) : null;

// Exam predictions (blind), summarised; the full file is copied too.
let exam = null;
const pf = path.join(here, 'exam/aves-predictions.json');
if (fs.existsSync(pf)) {
  const p = rd(pf);
  fs.copyFileSync(pf, path.join(outDir, 'aves-predictions.json'));
  const byStructure = {};
  for (const x of p.predictions) { const e = (byStructure[x.structure_iri] ??= { iri: x.structure_iri, label: x.label, absent: 0, present_stated: 0, present_default: 0 }); if (x.predicted === 'absent') e.absent++; else if (x.confidence === 'stated') e.present_stated++; else e.present_default++; }
  // The holdout thread's verdict on this file, read from its result file; the page links the file rather than copying numbers.
  const rf = path.join(root, 'holdout/exam-results/organism-design/result.run2.json');
  const scored = fs.existsSync(rf) ? rd(rf) : null;
  const verdicts = scored ? Object.fromEntries(Object.entries(scored.exam_measured || {}).map(([k, v]) => [k, v.verdict])) : null;
  exam = { scored: scored ? { file: 'holdout/exam-results/organism-design/result.run2.json', prereg: 'holdout/exam-results/organism-design/PREREG.md', verdicts, leak_check_exit: scored.preconditions?.leak_check_exit ?? null, predictions_sha256: scored.preconditions?.predictions_sha256 || null } : null, built: p.built, clade: p.exam.clade, provisional: p.exam.provisional, sha_matches: p.exam.matches, roster_size: p.exam.roster_size, species_predicted: p.species_predicted, panel_size: p.panel.size, panel_rule: p.panel.rule, tally: p.tally, by_structure: Object.values(byStructure).sort((a, b) => b.absent - a.absent || b.present_stated - a.present_stated || a.label.localeCompare(b.label)), inputs_not_read: p.inputs_not_read, file: 'data/aves-predictions.json' };
}

// Lexicon sizes, so the page can say how much is hand-written.
const lx = rd(path.join(here, 'lexicon.json'));
const n = o => Object.keys(o).filter(k => !k.startsWith('_')).length;
const lexicon = { taxon_words: n(lx.taxon_words), anatomy_words: n(lx.anatomy_words), function_words: n(lx.function_words), habitat_words: n(lx.habitat_words) };

// Cache size: how much of a clean rebuild is reproducible offline.
const cacheDir = path.join(here, 'cache');
const cache = fs.existsSync(cacheDir) ? fs.readdirSync(cacheDir).reduce((a, f) => ({ files: a.files + 1, bytes: a.bytes + fs.statSync(path.join(cacheDir, f)).size }), { files: 0, bytes: 0 }) : { files: 0, bytes: 0 };

const inventory_taxa = rd(path.join(root, 'organisms/merged/taxa.json')).length;
const index = { built: new Date().toISOString(), inventory_taxa, examples, esmfold, exam, nanopubs, lexicon, cache, sources: { ubergraph: 'https://ubergraph.apps.renci.org/sparql', uberon: 'http://obofoundry.org/ontology/uberon.html', cl: 'http://obofoundry.org/ontology/cl.html', inventory: 'organisms/merged/taxa.json', exam: 'holdout/exam.json' } };
fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(index));
console.log(`t/organism/data/index.json: ${examples.length} examples, esmfold runs ${esmfold.runs.map(r => r.dir + ':' + r.run.status).join(' ')}, ${esmfold.attachments.length} attachments, exam ${exam ? exam.panel_size + ' structures x ' + exam.species_predicted + ' species' : 'none'}, nanopubs ${nanopubs ? nanopubs.records + ' unsigned' : 'none'}`);
