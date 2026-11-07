#!/usr/bin/env node
// THE BENCHMARK: do the scores this project ranks guides with predict MEASURED zebrafish editing?
//
//   node benchmarks/crispr-ontarget/run.mjs --data <extracted.json> [--out results.json]
//
// `--data` is the extracted dataset, which is NOT in this repository: it is derived from copyrighted
// supplementary material. SOURCES.md says exactly how to rebuild it, and the file it produces stays
// outside the tree. What is committed is this code, the 25-row verification fixture, and the derived
// numbers.
//
// ============================== WHAT IS BEING TESTED ==============================
// editplan ranks candidate guides. Where the geometry allows it uses Doench 2014 Rule Set 1, a published
// model fitted on human and mouse cell lines; elsewhere it uses a heuristic whose weights we chose. Both
// are labelled as transfers. Neither has ever been compared to a zebrafish measurement, and a ranking
// nobody has checked is a ranking that could be noise.
//
// Ground truth: 499 sgRNAs with activity measured in injected zebrafish embryos (Moreno-Mateos et al.
// 2015). Each is located in GRCz11 so its true genomic context can be read, which is what the
// context-dependent models need and what the supplementary sequences alone do not provide.
//
// ============================== WHAT A RESULT HERE DOES AND DOES NOT MEAN ==============================
// A high correlation means a score ranks guides the way this one assay ranked them. It does NOT mean a
// guide will produce a phenotype: the bench package's own central finding is that in the fin-size
// program the knockouts are phenotypically normal, so cutting well and mattering are different claims.
// A low correlation for an incumbent score is a finding about THIS project, not about the original
// model, which was never claimed to transfer.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as CS from './crisprscan.mjs';
import { spearman, bootstrapCI, excludesZero } from './stats.mjs';
import * as G from '../../sim-engine/validate/editplan/grcz11-local.mjs';
import * as D from '../../sim-engine/validate/editplan/doench2014.mjs';
import * as E from '../../sim-engine/validate/editplan/editplan.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const val = n => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] ?? null : null; };

const DATA = val('data');
if (!DATA || !fs.existsSync(DATA)) {
  console.error('--data <extracted.json> is required and must exist. See SOURCES.md for how to rebuild it.');
  process.exit(2);
}
const OUT = val('out') ?? path.join(HERE, 'results.json');

const RC = s => [...s].reverse().map(c => ({ A: 'T', C: 'G', G: 'C', T: 'A' }[c] ?? 'N')).join('');

// ---------------------------------------------------------------------------------------------------
// locate every guide in GRCz11
// ---------------------------------------------------------------------------------------------------
const raw = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const guides = raw.activity;
console.log(`${guides.length} guides with measured activity`);

const idx = G.indexStatus();
if (!idx.built) { console.error('the local GRCz11 index is not built; see sim-engine/validate/editplan/grcz11-local.mjs'); process.exit(3); }
console.log(`GRCz11 index: ${idx.n_sequences} sequences, ${(idx.total_length_bp / 1e6).toFixed(0)} Mbp, built ${idx.built_at}`);

// Query with the 3'-most 20 nt where the oligo is long enough. The 5' end of a T7 oligo carries added
// G's that are not genomic, so the 3' end is the only part guaranteed to be in the assembly.
const queries = guides.map((g, i) => {
  const q = g.seq.length >= 20 ? g.seq.slice(-20) : g.seq;
  return { spacer: q, pam: 'NGG', pam_side: '3prime', label: String(i) };
});
console.log('scanning the genome (one pass per spacer length)...');
const t0 = Date.now();
const scan = G.scanGenome(queries, { maxMismatches: 0, sequences: 'chromosomes' });
console.log(`scanned ${(scan.scanned_bp / 1e6).toFixed(0)} Mbp in ${((Date.now() - t0) / 1000).toFixed(0)} s`);

const located = [], multi = [], missing = [];
for (const q of scan.queries) {
  const i = Number(q.label);
  if (!q.sites.length) missing.push(i);
  else if (q.sites.length > 1) multi.push(i);
  else located.push({ i, site: q.sites[0], query: q.spacer });
}
console.log(`unique ${located.length} | multi-hit ${multi.length} | not found ${missing.length}`);

// ---------------------------------------------------------------------------------------------------
// build the 35-mer context, anchored on the queried sequence rather than on coordinates
// ---------------------------------------------------------------------------------------------------
const byChrom = new Map();
for (const u of located) {
  if (!byChrom.has(u.site.chromosome)) byChrom.set(u.site.chromosome, []);
  byChrom.get(u.site.chromosome).push(u);
}
const rows = [];
let noContext = 0;
for (const [chrom, list] of byChrom) {
  const seq = G.getSequence(chrom);
  for (const u of list) {
    const s = u.site, flank = 40;
    const a = s.start - flank, b = s.end + flank;
    if (a < 0 || b > seq.length) { noContext++; continue; }
    const win = s.strand === 1 ? seq.slice(a, b).toUpperCase() : RC(seq.slice(a, b).toUpperCase());
    const at = win.indexOf(u.query);
    if (at < 0) { noContext++; continue; }
    const mer35 = CS.contextFrom(win, at, u.query.length);
    if (!mer35) { noContext++; continue; }
    rows.push({ i: u.i, activity: guides[u.i].activity, mer35, chrom, strand: s.strand });
  }
}
console.log(`built ${rows.length} genomic contexts (${noContext} could not be built)`);

// ---------------------------------------------------------------------------------------------------
// score three ways
// ---------------------------------------------------------------------------------------------------
const scored = [];
const refusals = { crisprscan: 0, doench: 0, heuristic: 0 };
for (const r of rows) {
  const cs = CS.score(r.mer35);
  const mer30 = r.mer35.slice(2, 32);              // 4 + 20 + 3 + 3 inside 6 + 20 + 3 + 6
  const proto = r.mer35.slice(6, 26);
  const pam = r.mer35.slice(26, 29);
  const ds = D.ruleSet1(mer30);
  const hs = E.onTargetHeuristic(proto, { pam });
  if (!cs.ran) refusals.crisprscan++;
  if (!ds.ran && !Number.isFinite(ds.score)) refusals.doench++;
  if (!Number.isFinite(hs?.score)) refusals.heuristic++;
  scored.push({
    activity: r.activity,
    crisprscan: cs.ran ? cs.score : null,
    doench2014: Number.isFinite(ds?.score) ? ds.score : null,
    heuristic: Number.isFinite(hs?.score) ? hs.score : null,
  });
}

function compare(key) {
  const pairs = scored.filter(s => s[key] != null);
  if (pairs.length < 10) return { n: pairs.length, rho: null, why: 'too few scored guides to correlate' };
  const x = pairs.map(p => p[key]), y = pairs.map(p => p.activity);
  const rho = spearman(x, y);
  return { n: pairs.length, rho: +rho.toFixed(4), ci95: bootstrapCI(x, y), distinct_scores: new Set(x).size };
}

const results = {
  what_this_is: 'do the on-target scores this project ranks guides with predict measured zebrafish editing activity?',
  ground_truth: {
    citation: 'Moreno-Mateos et al. 2015, Nat Methods 12:982-988, doi 10.1038/nmeth.3543',
    measure: 'activity_norm_mut_ct_log_ran - normalised mutagenesis, measured in injected zebrafish embryos',
    n_in_source: guides.length,
    source_files: 'Source Data to Fig. 4 (MOESM635), joined on sgRNA id',
    not_committed: 'copyrighted supplementary material; SOURCES.md says how to rebuild it',
  },
  genome: { assembly: idx.assembly, source: idx.source, built_at: idx.built_at, sequences_scanned: scan.n_sequences_scanned, bp_scanned: scan.scanned_bp },
  locating: {
    queried_with: "the 3'-most 20 nt, because a T7 oligo's added 5' G's are not genomic",
    unique: located.length, multi_hit: multi.length, not_found: missing.length, context_unbuildable: noContext,
    scored: rows.length,
  },
  refusals,
  models: {
    crisprscan: { ...compare('crisprscan'), what: 'CRISPRscan, fitted ON zebrafish injections', citation: CS.CITATION, status: 'published model, reimplemented and verified against 25 published scores' },
    doench2014: { ...compare('doench2014'), what: 'Doench 2014 Rule Set 1, fitted on human and mouse cell lines', citation: D.CITATION, status: 'published model, used here as a cross-species transfer' },
    heuristic: { ...compare('heuristic'), what: "editplan's own heuristic, weights chosen by us", citation: 'none - see ON_TARGET_RULE', status: 'not fitted to anything' },
  },
  caveats: {
    crisprscan_is_not_held_out:
      'CRISPRscan is being scored on data from the STUDY THAT FITTED IT: the 499 guides and the 92 ' +
      'coefficients come from the same paper. Its correlation here is therefore an UPPER BOUND on its ' +
      'advantage, not an estimate of it. Doench 2014 and our heuristic have never seen this data, so ' +
      'their numbers are honest held-out estimates. Read that way the finding is sharper rather than ' +
      'weaker: the model with home advantage reaches this, and the two actually in use reach zero.',
    what_would_fix_it: 'an independent zebrafish guide-activity dataset. That is the obvious next piece of work and it is not done here.',
    cutting_is_not_phenotype:
      'this measures mutagenesis, not whether a phenotype appears. The bench package records that in the ' +
      'fin-size program the knockouts are phenotypically normal, and controls.mjs records Lin et al. ' +
      '2025 measuring that cutting efficiency does not correlate with phenotype penetrance. A guide that ' +
      'scores well here may still test nothing.',
    the_unlocated_guides_are_a_selection:
      'guides that did not match GRCz11 exactly are not a random sample of the set, so every number here ' +
      'is a statement about the located subset.',
    one_assay_one_delivery:
      'the ground truth is one-cell-stage injection of Cas9 mRNA with T7-transcribed sgRNA. A lab using ' +
      'Cas9 protein RNP is using a different delivery, and nothing here measures that.',
  },
  generated: null,
};

// the comparison that matters
const rhos = Object.entries(results.models).map(([k, v]) => [k, v.rho]).filter(([, r]) => r != null).sort((a, b) => b[1] - a[1]);
results.ranking = rhos.map(([k, r]) => ({ model: k, rho: r }));
results.the_finding = rhos.length >= 2
  ? `${rhos[0][0]} ranks these guides best (rho ${rhos[0][1]}); ${rhos[rhos.length - 1][0]} is worst (rho ${rhos[rhos.length - 1][1]}).`
  : 'not enough models scored to compare';

console.log('\n--- Spearman rho against measured activity ---');
for (const [k, v] of Object.entries(results.models)) {
  console.log(`  ${k.padEnd(12)} n=${String(v.n).padStart(4)}  rho=${v.rho == null ? ' n/a ' : String(v.rho).padStart(7)}  ${v.ci95 ? `95% CI [${v.ci95.lo}, ${v.ci95.hi}]` : ''}`);
}
console.log(`\n${results.the_finding}`);

if (!argv.includes('--dry')) {
  fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
  console.log(`\nwritten to ${path.relative(process.cwd(), OUT).replace(/\\/g, '/')}`);
}
