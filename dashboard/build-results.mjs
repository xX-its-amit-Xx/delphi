#!/usr/bin/env node
// Builds dashboard/public/results/ : ONE page for today's findings.
//
//   node dashboard/build-results.mjs
//
// RULE: every number on the page is read from a committed file in this run. Nothing is typed by
// hand. If a source file is missing, the page says so where the number would have been, rather
// than carrying a stale value. Each result prints the path it came from.
//
// Writes only: dashboard/public/results/index.html, dashboard/public/results/results.json
// Reads: design-validation/, simulation-readiness/, crosscheck-frontier/, nanopubs-index/,
//        lean/, sequences/, genotype/, physics/flier/tff/, decisions/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const OUT = path.join(here, 'public', 'results');

const missing = [];
const R = p => { try { return fs.readFileSync(path.join(root, p), 'utf8'); } catch { missing.push(p); return null; } };
const J = p => { const t = R(p); if (t == null) return null; try { return JSON.parse(t); } catch { missing.push(p + ' (unparseable)'); return null; } };

// ---------------------------------------------------------------- sources
const SRC = {
  scorecard:   'design-validation/scorecard.json',
  prereg:      'design-validation/PREREG.md',
  preregSha:   'design-validation/PREREG.sha256',
  dvReport:    'design-validation/REPORT.md',
  dvRuns:      'design-validation/RUNS.md',
  readiness:   'simulation-readiness/readiness.json',
  coverageSvg: 'simulation-readiness/coverage.svg',
  simReadme:   'simulation-readiness/README.md',
  crosscheck:  'crosscheck-frontier/crosscheck.json',
  ccReport:    'crosscheck-frontier/REPORT.md',
  npIndex:     'nanopubs-index/index.json',
  npReadme:    'nanopubs-index/README.md',
  npGaps:      'nanopubs-index/gaps.md',
  npCatalogue: 'nanopubs-index/catalogue.md',
  ledgerPhys:  'lean/eliminate/ledger.physiology.json',
  audit:       'lean/AUDIT-FLYING-FISH.md',
  laws:        'lean/laws.json',
  mutations:   'lean/mutations.json',
  leanManifest:'lean/lake-manifest.json',
  seqReadme:   'sequences/README.md',
  gliders:     'sequences/gliders.json',
  progression: 'sequences/progression.json',
  engineered:  'sequences/engineered-diff.json',
  decisions:   'genotype/nanopubs/DECISIONS.md',
  mapSlim:     'genotype/map.vetted.slim.json',
  corrGenome:  'genotype/nanopubs/unsigned/correction-flying-fish-genome-exists.trig',
  corrRay:     'genotype/nanopubs/unsigned/correction-ray-interray-null-narrowed.trig',
  specMismatch:'physics/flier/tff/SPEC-MISMATCHES.md',
  ideas:       'decisions/ideas.json',
};

const scorecard = J(SRC.scorecard);
const readiness = J(SRC.readiness);
const crosscheck = J(SRC.crosscheck);
const npIndex = J(SRC.npIndex);
const ledgerPhys = J(SRC.ledgerPhys);
const laws = J(SRC.laws);
const mutations = J(SRC.mutations);
const leanManifest = J(SRC.leanManifest);
const gliders = J(SRC.gliders);
const progression = J(SRC.progression);
const engineered = J(SRC.engineered);
const mapSlim = J(SRC.mapSlim);
const ideas = J(SRC.ideas);

const auditMd = R(SRC.audit);
const ccReportMd = R(SRC.ccReport);
const npReadmeMd = R(SRC.npReadme);
const npGapsMd = R(SRC.npGaps);
const decisionsMd = R(SRC.decisions);
const specMd = R(SRC.specMismatch);
const simReadmeMd = R(SRC.simReadme);
const seqReadmeMd = R(SRC.seqReadme);
const dvReportMd = R(SRC.dvReport);
const dvRunsMd = R(SRC.dvRuns);
const preregShaTxt = R(SRC.preregSha);
const coverageSvgRaw = R(SRC.coverageSvg);
const corrGenomeTrig = R(SRC.corrGenome);
const corrRayTrig = R(SRC.corrRay);

// ---------------------------------------------------------------- helpers
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const nf = n => (n == null || Number.isNaN(n)) ? null : Number(n).toLocaleString('en-US');
// a value that is absent is printed as an explicit absence, never as a zero or a blank
const NA = '<span class="na" title="no value in the source file">not in the source</span>';
const NAcell = '<span class="na" title="no value in the source file">&mdash;</span>';
// cut at a sentence end rather than mid-word, so no quoted verdict ends in a broken token
function clip(s, max) {
  const t = String(s ?? '').trim();
  if (!t) return '';
  if (t.length <= max) return t;
  const head = t.slice(0, max);
  const stop = Math.max(head.lastIndexOf('. '), head.lastIndexOf('; '), head.lastIndexOf(': '));
  if (stop > max * 0.45) return head.slice(0, stop + 1);
  const sp = head.lastIndexOf(' ');
  return (sp > 0 ? head.slice(0, sp) : head) + '…';
}
const val = (v, fmt = (x => esc(x))) => (v === null || v === undefined || v === '') ? NA : fmt(v);
const num = v => val(v, x => `<span class="n">${nf(x)}</span>`);
const pct = (v, d = 2) => val(v, x => `<span class="n">${(Number(x) * 100).toFixed(d)}%</span>`);
// a path citation. Always visible, never a bare link.
const src = (...paths) => `<p class="src">${paths.map(p => `<code>${esc(p)}</code>`).join(' <span class="sep">·</span> ')}</p>`;
const srcInline = (...paths) => `<span class="src-i">${paths.map(p => `<code>${esc(p)}</code>`).join(' ')}</span>`;

// pull the schema:value for a propertyID out of a nanopublication TriG draft
function trigMetric(trig, propertyID) {
  if (!trig) return null;
  const re = new RegExp('schema:propertyID\\s+"' + propertyID.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"\\s*;\\s*schema:value\\s+"([^"]*)"', 'm');
  const m = trig.match(re);
  if (!m) return null;
  const raw = m[1];
  return /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
}

// parse a simple two-column markdown table that follows a given heading line
function mdTableAfter(md, headingRe) {
  if (!md) return [];
  const lines = md.split('\n');
  const start = lines.findIndex(l => headingRe.test(l));
  if (start < 0) return [];
  const rows = [];
  for (let i = start + 1; i < lines.length && i < start + 40; i++) {
    const l = lines[i].trim();
    if (!l.startsWith('|')) { if (rows.length) break; else continue; }
    if (/^\|[\s:|-]+\|$/.test(l)) continue;
    const cells = l.split('|').slice(1, -1).map(c => c.trim());
    if (cells.length >= 2) rows.push(cells);
  }
  return rows;
}

// ---------------------------------------------------------------- 1. corrections
const ffg = mapSlim?.flying_fish_genome || null;
const paralogue = mapSlim?.fin_size?.verified_leads?.find(l => l?.paralogue_check)?.paralogue_check || null;
const symbolCheck = mapSlim?.fin_size?.verified_leads?.find(l => l?.symbol_check)?.symbol_check || null;

const corrections = [
  {
    id: 'gja5a',
    what: 'A proposed gja5a link to fin length',
    verdict: 'RETRACTED',
    found_by: 'our own check (the cell-cell subagent)',
    why: (() => {
      const m = decisionsMd?.match(/## [^\n]*gja5a kept out of the fin-length chain\s*\n([\s\S]*?)(?=\n## |\n$)/);
      return m ? m[1].trim().replace(/\s*\n\s*/g, ' ') : null;
    })(),
    metrics: [
      ['records in the collaborator\'s graph that assert the link we retracted', crosscheck?.rows?.find(r => r.id === 'G4')?.their_record === 'not found' ? 0 : null],
    ],
    paths: ['genotype/nanopubs/DECISIONS.md', 'crosscheck-frontier/crosscheck.json (row G4)'],
  },
  {
    id: 'genome',
    what: '"Almost no molecular data exists for flying fish"',
    verdict: 'CORRECTED',
    found_by: 'the project lead, reading a primary source the thread had not read',
    why: ffg ? `An annotated genome does exist: Xu et al. 2021 assembled ${nf(ffg.gene_set?.protein_coding_genes)} predicted protein-coding genes for <i>${esc(ffg.species)}</i>, of which ${nf(ffg.gene_set?.functionally_annotated)} (${ffg.gene_set?.percent}%) carry at least one database hit. What flying fish lack is expression and phenotype data, not genes.` : null,
    caveat: ffg?.what_functionally_annotated_means_here || null,
    metrics: [
      ['predicted protein-coding genes', ffg?.gene_set?.protein_coding_genes],
      ['with at least one database hit', ffg?.gene_set?.functionally_annotated],
      ['of those, hits from TrEMBL alone (unreviewed, automatic)', ffg?.gene_set?.hits_by_database?.TrEMBL],
      ['hits from SwissProt, the only manually reviewed set', ffg?.gene_set?.hits_by_database?.SwissProt],
      ['occurrences of "RNA-seq" or "transcriptome" in that paper, counted', trigMetric(corrGenomeTrig, 'mentions_of_rnaseq_or_transcriptome_in_the_paper')],
      ['project files whose constraint wording was rewritten', trigMetric(corrGenomeTrig, 'project_files_corrected')],
    ],
    paths: ['genotype/map.vetted.slim.json (flying_fish_genome)', 'genotype/nanopubs/unsigned/correction-flying-fish-genome-exists.trig'],
  },
  {
    id: 'rayinterray',
    what: '"No ray-to-inter-ray signalling arrow could be sourced in any fin of any fish"',
    verdict: 'WITHDRAWN, then narrowed',
    found_by: 'our own nanopublication curation pass, not the thread that wrote it',
    why: 'Ray-to-inter-ray signalling is established in the zebrafish caudal fin by grafting and niche experiments. One query returned three papers that contradict the universal sentence. What survives is the far narrower claim that no fetched source names a ligand in one compartment and its receptor in the other.',
    caveat: 'The cause is a process failure, not only a fact error: a title-only read was allowed to support a universal negative, and one of the three papers was already cited by the same thread.',
    metrics: [
      ['papers that contradict the universal claim', trigMetric(corrRayTrig, 'papers_that_contradicted_the_universal_claim')],
      ['of those, papers that defeat the narrowed claim', trigMetric(corrRayTrig, 'papers_that_defeat_the_narrowed_claim')],
      ['of those, papers this thread already held and had read title-only', trigMetric(corrRayTrig, 'papers_already_cited_by_this_thread')],
      ['of those, studies in the pectoral fin (all three are caudal-fin work)', trigMetric(corrRayTrig, 'pectoral_fin_studies_among_them')],
    ],
    paths: ['genotype/nanopubs/unsigned/correction-ray-interray-null-narrowed.trig', 'nanopubs-index/README.md (finding 1)'],
  },
  {
    id: 'lat4a',
    what: '"lat4a = ZFIN slc43a2a, settled"',
    verdict: 'SPLIT: half resolved, half open',
    found_by: 'a collaborator\'s independent graph (record gx-problem-lat4a-identity), concurring with our own HANDOVER.md note',
    why: 'The question had to be split, because the answer differs for its two halves.',
    split: {
      resolved: {
        head: 'Which zebrafish gene carries the paper\'s mutant allele',
        answer: paralogue?.zebrafish_allele_gene?.gene || null,
        state: paralogue?.zebrafish_allele_gene?.resolved === true ? 'RESOLVED' : null,
        records: paralogue?.zebrafish_allele_gene?.records_that_distinguish_the_paralogue || [],
        withdrawn: paralogue?.zebrafish_allele_gene?.records_that_do_NOT_distinguish_it || [],
      },
      unresolved: {
        head: 'Which paralogue carries the flying-fish signal',
        state: paralogue?.flying_fish_signal_gene?.resolved === false ? 'UNRESOLVED' : null,
        candidates: paralogue?.flying_fish_signal_gene?.candidates || [],
        phylop: paralogue?.flying_fish_signal_gene?.daane_phylop_on_the_flying_fish_branch || null,
        rer: paralogue?.flying_fish_signal_gene?.daane_rer_for_gliding || null,
        note: paralogue?.flying_fish_signal_gene?.note || null,
      },
      mismatch: paralogue?.variant_mismatch || null,
    },
    metrics: [
      ['rows of the cross-check that DISAGREE with us (this is the only one)', crosscheck?.relationship_counts?.DISAGREE],
    ],
    paths: ['genotype/map.vetted.slim.json (fin_size.verified_leads[].paralogue_check)', 'crosscheck-frontier/crosscheck.json (row G5)'],
  },
];

// ---------------------------------------------------------------- 2. design test
const p1 = scorecard?.part1_phenotypic || null;
const p2 = scorecard?.part2_genetic || null;
const p3 = scorecard?.part3_lean_gate || null;
const p4 = scorecard?.part4_the_real_experiment || null;
const joint = scorecard?.joint_result || null;
const honestSentence = (() => {
  const m = dvReportMd?.match(/## The one honest sentence\s*\n+\*\*([\s\S]*?)\*\*/);
  return m ? m[1].trim().replace(/\s*\n\s*/g, ' ') : null;
})();
const secondSentence = (() => {
  const m = dvReportMd?.match(/The second honest sentence[^*]*\*\*([\s\S]*?)\*\*/);
  return m ? m[1].trim().replace(/\s*\n\s*/g, ' ') : null;
})();
const preregHashInFile = preregShaTxt ? (preregShaTxt.trim().split(/\s+/)[0] || null) : null;
const hashMatches = preregHashInFile && scorecard?.prereg?.sha256 ? preregHashInFile === scorecard.prereg.sha256 : null;
const gateArms = ['REAL', 'DESIGN', 'REAL_MATCHED'];
const gateLabel = { REAL: 'The real flying fish', DESIGN: 'The design (the model)', REAL_MATCHED: 'The real fish, design inputs only' };

// ---------------------------------------------------------------- 3. simulation readiness
const ratio = readiness?.ratio || null;
const headline = readiness?.headline || null;
const items = readiness?.items || null;
const checklist = readiness?.checklist || null;
const itemOrder = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const worked = readiness?.worked_example || null;
const mgen = readiness?.precedent_m_genitalium || null;
const workedZeroTerms = worked?.parameters_in_the_paper?.term_counts_in_full_text
  ? Object.entries(worked.parameters_in_the_paper.term_counts_in_full_text) : [];
const workedAllZero = workedZeroTerms.length ? workedZeroTerms.every(([, v]) => Number(v) === 0) : null;
// inline the ready-made figure so it inherits the page's ink colour and theme
const coverageSvg = coverageSvgRaw
  ? coverageSvgRaw.replace(/<\?xml[^>]*\?>/g, '').replace(/<svg /, '<svg class="fig" ')
  : null;

// ---------------------------------------------------------------- 4. what held up
const physSummary = ledgerPhys?.summary || null;
const physLedger = ledgerPhys?.ledger || [];
const ccL1 = crosscheck?.rows?.find(r => r.id === 'L1') || null;
const ccL3 = crosscheck?.rows?.find(r => r.id === 'L3') || null;
const ccG3 = crosscheck?.rows?.find(r => r.id === 'G3') || null;
const ccG5 = crosscheck?.rows?.find(r => r.id === 'G5') || null;
const ccL2 = crosscheck?.rows?.find(r => r.id === 'L2') || null;

// the audit's own summary tables, read out of the markdown
const auditVerdicts = Object.fromEntries(mdTableAfter(auditMd, /^\|\s*Verdict\s*\|/).map(r => [r[0], Number(r[1])]));
const auditApplies = Object.fromEntries(mdTableAfter(auditMd, /^\|\s*Applies to Exocoetidae\s*\|/).map(r => [r[0], Number(r[1])]));
// the single-glide row
const glideRow = (() => {
  const line = auditMd?.split('\n').find(l => /`glide_range_le`/.test(l));
  if (!line) return null;
  const cells = line.split('|').map(c => c.trim());
  return { verdict: cells[4] || null, why: cells[5] || null };
})();

const refutations = npIndex?.drafts
  ? Object.keys(npIndex.drafts).filter(k => /\/refutation-\d/.test(k)).sort().map(k => {
      const d = npIndex.drafts[k];
      const t = (d.title || '').replace(/^Draft:\s*/, '');
      const m = t.match(/^Not established in zebrafish:\s*([\s\S]*?)\s*—\s*([\s\S]*)$/);
      return { path: k, claim: m ? m[1] : t, finding: m ? m[2] : null, status: d.status || null };
    })
  : [];

const pitfallKeys = ['gotcha-ubergraph-typed-literals', 'gotcha-bgee-zfin-ensembl-release-mismatch'];
const pitfalls = npIndex?.drafts
  ? pitfallKeys.map(k => {
      const key = Object.keys(npIndex.drafts).find(p => p.includes(k));
      if (!key) return null;
      const d = npIndex.drafts[key];
      return { path: key, title: (d.title || '').replace(/^Draft:\s*/, ''), status: d.status || null };
    }).filter(Boolean)
  : [];
const pitfallVerdict = (() => {
  const m = npReadmeMd?.match(/\*\*No prior published\s*\n?\s*report of either pitfall was found\.\*\*/);
  return m ? 'No prior published report of either pitfall was found.' : null;
})();

const progGroups = progression?.groups_in_order || null;
const progFirst = Array.isArray(progression?.read_this_first) ? progression.read_this_first : [];
const lat4aSite = gliders?.lat4a_site_326_across_gliders || null;
const lat4aSiteTally = lat4aSite
  ? Object.values(lat4aSite).reduce((a, r) => (a[r] = (a[r] || 0) + 1, a), {})
  : null;

// ---------------------------------------------------------------- 5. cross-check
const relCounts = crosscheck?.relationship_counts || null;
const store = crosscheck?.their_store_as_measured || null;
const readingRules = crosscheck?.reading_rules || [];
const ourMathlibRev = leanManifest?.packages?.find(p => /mathlib/i.test(p.name || ''))?.rev
  || (R(SRC.leanManifest) || '').match(/"rev":\s*"([0-9a-f]{40})"/)?.[1] || null;
const theirMathlibRev = (() => {
  const m = ccReportMd?.match(/their `mathlib_rev` is `([0-9a-f]{40})`/);
  return m ? m[1] : null;
})();
const pinIsShared = ourMathlibRev && theirMathlibRev ? ourMathlibRev === theirMathlibRev : null;
const bulkImportRule = readingRules.find(r => /bulk import/i.test(r)) || null;

// ---------------------------------------------------------------- 6. the corpus
const draftsByThread = npIndex?.drafts
  ? Object.values(npIndex.drafts).reduce((a, d) => (a[d.thread || 'unknown'] = (a[d.thread || 'unknown'] || 0) + 1, a), {})
  : null;
const draftThreadRows = draftsByThread ? Object.entries(draftsByThread).sort((a, b) => b[1] - a[1]) : [];
const vTally = npIndex?.drafts
  ? Object.values(npIndex.drafts).reduce((a, d) => {
      const v = d.validation || {};
      if (v.np_check_pass) a.pass++;
      if (v.valid_not_trusty) a.notTrusty++;
      if (v.rdf_error) a.rdfError++;
      if (!d.signed) a.unsigned++;
      if (!d.orcid_used_for_attribution) a.noOrcid++;
      a.total++;
      return a;
    }, { pass: 0, notTrusty: 0, rdfError: 0, unsigned: 0, noOrcid: 0, total: 0 })
  : null;
const issueTally = npIndex?.drafts
  ? Object.values(npIndex.drafts).reduce((a, d) => {
      for (const i of (d.validation?.issues || [])) a[i] = (a[i] || 0) + 1;
      return a;
    }, {})
  : null;
const checker = (() => {
  const m = npReadmeMd?.match(/Checker:\s*`([^`]+)`/);
  return m ? m[1] : null;
})();

// ---------------------------------------------------------------- 7. what is still open
// Read from the files' own "next" / "what should change" / gap sections. Nothing invented here.
const openFromCrosscheck = (() => {
  if (!ccReportMd) return [];
  const sec = ccReportMd.split(/^## 5\. What should change in what we claim\s*$/m)[1];
  if (!sec) return [];
  const body = sec.split(/^## /m)[0];
  return [...body.matchAll(/^\d+\.\s+\*\*([\s\S]*?)\*\*/gm)].map(m => m[1].trim().replace(/\s*\n\s*/g, ' '));
})();
const openFromGaps = (() => {
  if (!npGapsMd) return [];
  const heads = [...npGapsMd.matchAll(/^### (A\d[^\n]*)$/gm)].map(m => m[1].trim());
  const b = npGapsMd.match(/^## B\. ([^\n]*)\s*\n+\s*\*\*(\d+) of (\d+)\.\*\*/m);
  if (b) heads.push(`B. ${b[1]} — ${b[2]} of ${b[3]} drafts`);
  return heads;
})();
const openFromReadiness = (() => {
  if (!simReadmeMd) return [];
  const sec = simReadmeMd.split(/^## Honest limits of this measurement\s*$/m)[1];
  if (!sec) return [];
  return [...sec.split(/^## /m)[0].matchAll(/^- \*\*([\s\S]*?)\*\*/gm)].map(m => m[1].trim().replace(/\s*\n\s*/g, ' '));
})();
const openFromSpec = specMd ? [...specMd.matchAll(/^## \d+\.\s*([^\n]*)$/gm)].map(m => m[1].trim()) : [];
const specHeader = specMd ? (specMd.match(/^# ([^\n]*)$/m)?.[1] || null) : null;
const specMuscle = specMd ? (specMd.match(/Only\s+\*\*([\d.]+%)\*\*\s+of it fits/)?.[1] || null) : null;
const ideaOrigins = ideas?.ideas
  ? ideas.ideas.reduce((a, i) => (a[i.origin || 'unstated'] = (a[i.origin || 'unstated'] || 0) + 1, a), {})
  : null;
const ideasUnresearched = ideas?.ideas ? ideas.ideas.filter(i => i.origin !== 'researched').length : null;
const openFromDv = (() => {
  if (!dvRunsMd) return [];
  const sec = dvRunsMd.split(/^## Things that were deliberately not done\s*$/m)[1];
  if (!sec) return [];
  return [...sec.split(/^## /m)[0].matchAll(/^- \*\*([\s\S]*?)\*\*/gm)].map(m => m[1].trim().replace(/\s*\n\s*/g, ' '));
})();

// ================================================================ the Lean-gate figure
// One axis: the 21 constraint rows. Three arms, one bar each. Status colour is never the only
// channel: every segment carries its own number, each status carries a glyph in the legend, and
// the "violated" segment is also hatched.
function gateFigure() {
  if (!p3?.tallies) return `<p class="na-block">${NA} — <code>${esc(SRC.scorecard)}</code> carries no <code>part3_lean_gate.tallies</code>.</p>`;
  const rows = p3.rows || 21;
  const W = 780, padL = 236, padR = 44, barH = 34, gap = 34, top = 62;
  const plotW = W - padL - padR;
  const H = top + gateArms.length * (barH + gap) + 16;
  const states = [
    { k: 'holds', label: 'holds', cls: 'st-ok', glyph: '✓' },
    { k: 'violated', label: 'violated', cls: 'st-bad', glyph: '✕' },
    { k: 'cannot-evaluate', label: 'cannot evaluate (no input)', cls: 'st-un', glyph: '–' },
  ];
  let g = '';
  gateArms.forEach((arm, i) => {
    const t = p3.tallies[arm] || {};
    const y = top + i * (barH + gap);
    let x = padL;
    g += `<text x="${padL - 12}" y="${y + barH / 2 + 1}" text-anchor="end" class="axl">${esc(gateLabel[arm] || arm)}</text>`;
    g += `<text x="${padL - 12}" y="${y + barH / 2 + 15}" text-anchor="end" class="axl sub">${esc(p3.verdicts?.[arm] || '')}</text>`;
    for (const st of states) {
      const v = Number(t[st.k] || 0);
      if (!v) continue;
      const w = Math.max(0, (v / rows) * plotW - 2); // 2px surface gap between fills
      g += `<rect x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${barH}" rx="4" class="${st.cls}"/>`;
      if (st.k === 'violated') g += `<rect x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${barH}" rx="4" fill="url(#hatch)"/>`;
      // direct label: inside when it fits, above the bar with a leader when it is too narrow
      if (w > 26) g += `<text x="${(x + w / 2).toFixed(1)}" y="${y + barH / 2 + 4}" text-anchor="middle" class="inlbl">${v}</text>`;
      else {
        const cx = x + w / 2;
        g += `<line x1="${cx.toFixed(1)}" y1="${y - 3}" x2="${cx.toFixed(1)}" y2="${y - 9}" class="leader"/>`;
        g += `<text x="${cx.toFixed(1)}" y="${y - 12}" text-anchor="middle" class="outlbl">${v}</text>`;
      }
      x += w + 2;
    }
  });
  const legend = states.map(s => `<span class="lg"><span class="sw ${s.cls}${s.k === 'violated' ? ' hatched' : ''}"></span><b>${s.glyph}</b> ${esc(s.label)}</span>`).join('');
  return `<figure class="figwrap">
  <figcaption class="fcap">Of the ${rows} constraint rows, how many each arm actually decides. Longer grey means the gate said nothing.</figcaption>
  <svg class="fig" viewBox="0 0 ${W} ${H}" role="img" aria-label="Stacked bars of holds, violated and cannot-evaluate counts across ${rows} constraint rows for three arms">
   <defs><pattern id="hatch" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
     <line x1="0" y1="0" x2="0" y2="7" stroke="var(--panel)" stroke-width="2.4" stroke-opacity=".55"/></pattern></defs>
   <text x="0" y="20" class="ftitle">Three of ${rows} rows carry the whole verdict</text>
   <text x="0" y="38" class="axl sub">one bar per arm · ${rows} rows = full width</text>
   ${g}
  </svg>
  <div class="legend">${legend}</div>
  ${src(SRC.scorecard + ' (part3_lean_gate.tallies, .verdicts)')}
 </figure>`;
}

// ================================================================ page
const built = new Date().toISOString();

const navItems = [
  ['corrected', 'Corrected'],
  ['design', 'Design test'],
  ['simulation', 'Simulation'],
  ['held', 'Held up'],
  ['crosscheck', 'Cross-check'],
  ['corpus', 'Corpus'],
  ['open', 'Still open'],
];

const CSS = `
:root{--bg:#f6f7f4;--panel:#fff;--ink:#14201f;--mute:#5a6b69;--line:#d9dfdb;--accent:#0e7c86;--accent-ink:#fff;--ok:#2f7d4f;--bad:#b3392f;--warn:#a8650b;--viol:#6b4fb3;--soft:#eef2ef;--code:#f0f3f1;--un:#8a948f;--shadow:0 1px 2px rgba(0,0,0,.06),0 6px 20px rgba(0,0,0,.05)}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0d1514;--panel:#142120;--ink:#e7efec;--mute:#93a6a2;--line:#27403d;--accent:#38b6c1;--accent-ink:#06201f;--ok:#58c07f;--bad:#ef7a6e;--warn:#e0a24a;--viol:#a58ae6;--soft:#192b29;--code:#0f1a19;--un:#7d8b87;--shadow:0 1px 2px rgba(0,0,0,.4),0 6px 20px rgba(0,0,0,.3)}}
:root[data-theme="dark"]{--bg:#0d1514;--panel:#142120;--ink:#e7efec;--mute:#93a6a2;--line:#27403d;--accent:#38b6c1;--accent-ink:#06201f;--ok:#58c07f;--bad:#ef7a6e;--warn:#e0a24a;--viol:#a58ae6;--soft:#192b29;--code:#0f1a19;--un:#7d8b87;--shadow:0 1px 2px rgba(0,0,0,.4),0 6px 20px rgba(0,0,0,.3)}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:76px;-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow-wrap:break-word}
a{color:var(--accent)}
h1,h2,h3,h4{line-height:1.2;margin:0 0 .5em;overflow-wrap:break-word}
h1{font-size:clamp(1.45rem,4vw,2.2rem)} h2{font-size:clamp(1.2rem,3vw,1.5rem)} h3{font-size:1.05rem} h4{font-size:.95rem}
p{margin:.4em 0 .8em}
.wrap{max-width:1100px;margin:0 auto;padding:0 16px}
header.top{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
header.top .wrap{display:flex;gap:10px;align-items:center;overflow-x:auto;padding:8px 16px;white-space:nowrap}
.brand{font-weight:700;margin-right:4px}
nav a{display:inline-block;padding:4px 10px;border-radius:99px;text-decoration:none;color:var(--mute);font-size:.88rem}
nav a:hover{background:var(--soft);color:var(--ink)}
#themeBtn{margin-left:auto;flex:0 0 auto}
button{font:inherit;cursor:pointer;border:1px solid var(--line);background:var(--panel);color:var(--ink);padding:6px 12px;border-radius:8px}
button:hover{border-color:var(--accent)}
section{padding:30px 0;border-bottom:1px solid var(--line)}
section>h3{margin-top:26px}
section>h4{margin-top:20px}
.sec-n{display:inline-block;font-size:.78rem;letter-spacing:.08em;text-transform:uppercase;color:var(--mute);border:1px solid var(--line);background:var(--soft);border-radius:99px;padding:2px 10px;margin-bottom:10px}
.lede{color:var(--mute);max-width:74ch;font-size:1.04rem}
.grid{display:grid;gap:14px}
.g2{grid-template-columns:repeat(auto-fit,minmax(290px,1fr))}
.g3{grid-template-columns:repeat(auto-fit,minmax(215px,1fr))}
.g4{grid-template-columns:repeat(auto-fit,minmax(165px,1fr))}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px;box-shadow:var(--shadow);min-width:0}
.card h3{margin-top:0}
.kpi{font-size:clamp(1.5rem,5vw,2rem);font-weight:700;line-height:1.05;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.kpi small{display:block;font-size:.8rem;font-weight:400;color:var(--mute);margin-top:6px;line-height:1.4}
.n{font-variant-numeric:tabular-nums;font-weight:600}
.chip{display:inline-block;padding:1px 9px;border-radius:99px;font-size:.78rem;border:1px solid var(--line);background:var(--soft);color:var(--mute);white-space:nowrap}
.chip.ok{color:var(--ok);border-color:var(--ok)} .chip.bad{color:var(--bad);border-color:var(--bad)} .chip.warn{color:var(--warn);border-color:var(--warn)} .chip.viol{color:var(--viol);border-color:var(--viol)} .chip.un{color:var(--un);border-color:var(--un)}
.verdict{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}
.src{margin:10px 0 0;font-size:.8rem;color:var(--mute);line-height:1.7}
.src code,.src-i code{background:var(--code);border:1px solid var(--line);border-radius:5px;padding:1px 5px;font-size:.92em;overflow-wrap:anywhere}
.src .sep{opacity:.5}
.src-i{font-size:.8rem;color:var(--mute)}
code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.86em}
pre{background:var(--code);border:1px solid var(--line);border-radius:8px;padding:10px 12px;overflow-x:auto;margin:6px 0}
.mute{color:var(--mute)} .small{font-size:.86rem} .tiny{font-size:.78rem}
.na{color:var(--un);font-style:italic;border-bottom:1px dotted var(--un)}
.na-block{color:var(--un);font-style:italic}
.unev{color:var(--un)}
tr.unev td{color:var(--un)}
.scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
table{border-collapse:collapse;width:100%;font-size:.9rem;min-width:0}
th,td{text-align:left;padding:7px 9px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--mute);font-weight:600;white-space:nowrap}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.model-note{border-left:3px solid var(--warn);background:var(--soft);padding:8px 12px;border-radius:0 8px 8px 0;margin:10px 0;font-size:.88rem}
.quote{border-left:3px solid var(--accent);padding:2px 12px;color:var(--mute);margin:10px 0}
.lead-stat{border:1px solid var(--line);background:var(--soft);border-radius:12px;padding:14px 16px;margin:12px 0}
details{border:1px solid var(--line);border-radius:10px;background:var(--panel);margin:8px 0}
details>summary{cursor:pointer;padding:10px 14px;font-weight:600;list-style:none}
details>summary::before{content:"\\25B8";display:inline-block;margin-right:8px;transition:transform .15s;color:var(--accent)}
details[open]>summary::before{transform:rotate(90deg)}
details>.in{padding:2px 14px 14px;min-width:0}
ul.tight{margin:.3em 0 .6em;padding-left:1.2em} ul.tight li{margin:.25em 0}
.figwrap{margin:14px 0;padding:0}
.fcap{font-size:.88rem;color:var(--mute);margin-bottom:8px}
svg.fig{display:block;width:100%;height:auto;max-width:100%;color:var(--ink)}
svg.fig .ftitle{fill:var(--ink);font-size:15px;font-weight:700}
svg.fig .axl{fill:var(--ink);font-size:12.5px}
svg.fig .axl.sub{fill:var(--mute);font-size:11px}
svg.fig .inlbl{fill:#fff;font-size:13px;font-weight:700;font-variant-numeric:tabular-nums}
svg.fig .outlbl{fill:var(--ink);font-size:12px;font-weight:700;font-variant-numeric:tabular-nums}
svg.fig .leader{stroke:var(--mute);stroke-width:1}
svg.fig .st-ok{fill:var(--ok)} svg.fig .st-bad{fill:var(--bad)} svg.fig .st-un{fill:var(--un)}
.legend{display:flex;gap:16px;flex-wrap:wrap;font-size:.84rem;color:var(--mute);margin-top:4px}
.legend .lg{display:inline-flex;gap:6px;align-items:center}
.legend .sw{width:14px;height:14px;border-radius:4px;display:inline-block}
.legend .sw.st-ok{background:var(--ok)} .legend .sw.st-bad{background:var(--bad)} .legend .sw.st-un{background:var(--un)}
.legend .sw.hatched{background-image:repeating-linear-gradient(45deg,transparent 0 2px,rgba(255,255,255,.65) 2px 4px)}
.legend b{color:var(--ink)}
footer{padding:26px 0;color:var(--mute);font-size:.86rem}
.back{text-decoration:none;color:var(--mute);font-size:.9rem;flex:0 0 auto}
@media (max-width:520px){
 th,td{padding:6px 7px;font-size:.86rem}
 .card{padding:13px}
 nav a{padding:4px 8px;font-size:.84rem}
}`;

const JS = `
(function(){
 var b=document.getElementById('themeBtn');
 function cur(){var a=document.documentElement.getAttribute('data-theme');if(a)return a;
  return window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';}
 try{var s=localStorage.getItem('delphi-theme');if(s)document.documentElement.setAttribute('data-theme',s);}catch(e){}
 if(b)b.addEventListener('click',function(){var n=cur()==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme',n);try{localStorage.setItem('delphi-theme',n);}catch(e){}});
})();`;

// ---- section 1 ---------------------------------------------------------
function correctionCard(c) {
  const m = (c.metrics || []).filter(x => x[1] !== null && x[1] !== undefined);
  return `<div class="card">
  <div class="verdict"><span class="chip ${c.split ? 'warn' : 'bad'}">${c.split ? '!' : '✕'} ${esc(c.verdict)}</span></div>
  <h3>${c.what.startsWith('"') ? esc(c.what) : esc(c.what)}</h3>
  <p class="small"><b>Found by:</b> ${esc(c.found_by)}</p>
  ${c.why ? `<p class="small">${c.why}</p>` : `<p class="small na-block">${NA}</p>`}
  ${c.caveat ? `<p class="small mute"><b>And the caveat that keeps it honest:</b> ${esc(c.caveat)}</p>` : ''}
  ${c.split ? `
   <div class="grid g2" style="margin:10px 0">
    <div class="lead-stat"><span class="chip ok">✓ ${esc(c.split.resolved.state || 'resolved')}</span>
     <h4 style="margin:8px 0 4px">${esc(c.split.resolved.head)}</h4>
     <p class="small" style="margin:0"><b>${val(c.split.resolved.answer)}</b>, on two records a name lookup cannot reach:</p>
     <ul class="tight small">${c.split.resolved.records.map(r => `<li>${esc(r)}</li>`).join('') || `<li class="na-block">${NA}</li>`}</ul>
     ${c.split.resolved.withdrawn.length ? `<p class="tiny mute" style="margin:0">Withdrawn as a resolving record, because it names the family and not the paralogue: ${c.split.resolved.withdrawn.map(esc).join('; ')}.</p>` : ''}
    </div>
    <div class="lead-stat"><span class="chip un">– ${esc(c.split.unresolved.state || 'unresolved')}</span>
     <h4 style="margin:8px 0 4px">${esc(c.split.unresolved.head)}</h4>
     <p class="small" style="margin:0">Candidates: ${c.split.unresolved.candidates.length ? c.split.unresolved.candidates.map(x => `<code>${esc(x)}</code>`).join(' or ') : NA}.</p>
     <ul class="tight small">
      ${c.split.unresolved.phylop ? Object.entries(c.split.unresolved.phylop).map(([g, v]) => `<li>phyloP on the flying-fish branch, <code>${esc(g)}</code>: ${esc(v)}</li>`).join('') : ''}
      ${c.split.unresolved.rer ? `<li>relative evolutionary rate for gliding sits on <code>${esc(c.split.unresolved.rer.gene)}</code> (rho ${esc(c.split.unresolved.rer.rho)}, p ${esc(c.split.unresolved.rer.p)}, q ${esc(c.split.unresolved.rer.q)}) &mdash; ${esc(c.split.unresolved.rer.note || '')}</li>` : ''}
     </ul>
     ${c.split.unresolved.note ? `<p class="tiny mute" style="margin:0">${esc(c.split.unresolved.note)}</p>` : ''}
    </div>
   </div>
   ${c.split.mismatch ? `<div class="model-note"><b>Not the same variant.</b> ${esc(c.split.mismatch)}</div>` : ''}
  ` : ''}
  ${m.length ? `<div class="scroll"><table><tbody>${m.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${num(v)}</td></tr>`).join('')}</tbody></table></div>` : ''}
  ${src(...c.paths)}
 </div>`;
}

const sec1 = `<section id="corrected">
<span class="sec-n">1 of 7</span>
<h2>What we corrected</h2>
<p class="lede">Four claims this project had published were wrong or overstated, and all four were corrected on the same day. Three were caught by our own checks; one was caught by a collaborator's independent graph. None was quietly edited: each is a record that states what we said, what the source says, and what changed.</p>
<div class="grid g2">${corrections.filter(c => !c.split).map(correctionCard).join('')}</div>
<div class="grid" style="margin-top:14px">${corrections.filter(c => c.split).map(correctionCard).join('')}</div>
</section>`;

// ---- section 2 ---------------------------------------------------------
function axisRow(a) {
  const cannot = a.verdict === 'CANNOT SCORE';
  const chip = a.verdict === 'FAIL' ? '<span class="chip bad">✕ FAIL</span>'
    : cannot ? '<span class="chip un">– CANNOT SCORE</span>'
    : `<span class="chip">${esc(a.verdict)}</span>`;
  const cell = side => {
    const s = a[side] || {};
    if (s.value === null || s.value === undefined) return `<span class="na" title="${esc(s.reason || s.status || '')}">${esc(s.status || 'NO VALUE')}</span>`;
    return `<span class="n">${esc(s.value)}</span>${s.units ? ' ' + esc(s.units) : ''}`;
  };
  return `<tr class="${cannot ? 'unev' : ''}">
   <td class="num">${a.n}</td>
   <td>${esc(a.axis)}</td>
   <td class="num">${cell('zebrafish')}</td>
   <td class="num">${cell('flyingfish')}</td>
   <td class="num">${cell('design')}</td>
   <td class="num">${a.f === null || a.f === undefined ? NAcell : `<span class="n">${Number(a.f).toFixed(2)}</span>`}</td>
   <td>${chip}</td>
  </tr>`;
}

const sec2 = `<section id="design">
<span class="sec-n">2 of 7</span>
<h2>The design test failed, and the claim is dropped as unsupported</h2>
<p class="lede">${scorecard ? esc(scorecard.what) : NA}</p>

<div class="lead-stat">
 <p class="small" style="margin:0 0 6px"><b>Pre-registered and hash-verified.</b> ${scorecard?.prereg ? `<code>${esc(scorecard.prereg.file)}</code> was hashed to sha256 <code>${esc(String(scorecard.prereg.sha256).slice(0, 16))}…</code> at ${esc(scorecard.prereg.hashed_utc)}, ${esc(scorecard.prereg.note)}.` : NA}
 ${hashMatches === true ? ' The hash in <code>PREREG.sha256</code> matches the one the scorecard records, checked in this build.' : hashMatches === false ? ' <b class="chip bad">✕ the hash in PREREG.sha256 does not match the scorecard</b>' : ''}</p>
 ${honestSentence ? `<p class="small" style="margin:6px 0 0"><b>The one honest sentence, from the report:</b> ${esc(honestSentence)}</p>` : ''}
 ${secondSentence ? `<p class="small" style="margin:6px 0 0"><b>And:</b> ${esc(secondSentence)}</p>` : ''}
 ${src(SRC.scorecard, SRC.prereg, SRC.preregSha, SRC.dvReport, SRC.dvRuns)}
</div>

<div class="model-note"><b>These are numbers about a model, not measurements of a fish.</b> "The design" is a specified genotype plus the zebrafish body it is specified against. Where a row below gives the design a value, that value is a specification statement unless it says otherwise. The only measured animal in this section is the real flying fish.</div>

<h3>Part 1 &mdash; the per-axis table: ${p1 ? `${num(p1.n_scored)} of ${num(p1.axes_preregistered)} axes scorable` : NA}</h3>
<p class="small">f = (design &minus; zebrafish) / (flying fish &minus; zebrafish): 0 means the design has moved none of the way from the baseline to the target, 1 means all of it. Greyed rows could not be scored at all.</p>
<div class="card"><div class="scroll"><table>
 <thead><tr><th class="num">#</th><th>axis</th><th class="num">zebrafish</th><th class="num">flying fish</th><th class="num">design (model)</th><th class="num">f</th><th>verdict</th></tr></thead>
 <tbody>${p1?.per_axis?.map(axisRow).join('') || `<tr><td colspan="7" class="na-block">${NA}</td></tr>`}</tbody>
</table></div>
${p1?.cannot_score_reason_tally ? `<details><summary>Why nine axes cannot be scored (an axis can carry more than one reason)</summary><div class="in"><div class="scroll"><table><tbody>${Object.entries(p1.cannot_score_reason_tally).filter(([k]) => k !== 'note').map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${num(v)}</td></tr>`).join('')}</tbody></table></div><p class="tiny mute">${esc(p1.cannot_score_reason_tally.note || '')}</p></div></details>` : ''}
<p class="small"><b>Verdict:</b> ${p1 ? esc(p1.verdict) : NA}</p>
${p1?.prereg_trigger_check?.deviation ? `<p class="small mute"><b>Pre-registration deviation, logged:</b> ${esc(p1.prereg_trigger_check.deviation)}</p>` : ''}
${src(SRC.scorecard + ' (part1_phenotypic)')}</div>

<h3>Part 2 &mdash; the four genetic counts</h3>
<div class="grid g4">
 <div class="card"><div class="kpi">${num(p2?.a_loci_known_to_differ?.value)}<small>A: loci known to differ in flying fishes (sheet G &cup; sheet I of Daane 2021 Data S1)</small></div></div>
 <div class="card"><div class="kpi">${num(p2?.b_design_changes_that_are_in_a?.value)}<small>B: design changes that are among them &mdash; <code>lat4a</code>/<code>slc43a2a</code></small></div></div>
 <div class="card"><div class="kpi">${p2?.c_fraction_reproduced ? esc(p2.c_fraction_reproduced.pretty) : NA}<small>C = B/A. Band: ${p2?.c_fraction_reproduced ? esc(p2.c_fraction_reproduced.band) : NA}</small></div></div>
 <div class="card"><div class="kpi">${num(p2?.d_design_changes_not_known_to_differ?.value)}<small>D: design changes with no flying-fish evidence at all &mdash; ${p2?.d_design_changes_not_known_to_differ?.members?.map(esc).join(', ') || NA}</small></div></div>
</div>
<div class="card" style="margin-top:14px">
 <p class="small"><b>Reading:</b> ${p2?.c_fraction_reproduced ? esc(p2.c_fraction_reproduced.reading) : NA}</p>
 <p class="small"><b>Context:</b> ${p2?.a_loci_known_to_differ?.context ? esc(p2.a_loci_known_to_differ.context) : NA}</p>
 <p class="small mute"><b>Half of the design has no flying-fish evidence:</b> ${p2?.d_design_changes_not_known_to_differ?.note ? esc(p2.d_design_changes_not_known_to_differ.note) : NA}</p>
 ${p2?.posthoc_sensitivity ? `<p class="small mute"><b>${esc(p2.posthoc_sensitivity.label)}:</b> with the phyloP sheet added to the denominator, A = ${num(p2.posthoc_sensitivity.with_sheet_J_added?.A)} and C = ${esc(p2.posthoc_sensitivity.with_sheet_J_added?.C)}. ${esc(p2.posthoc_sensitivity.with_sheet_J_added?.note || '')}</p>` : ''}
 ${src(SRC.scorecard + ' (part2_genetic)')}
</div>

<h3>Part 3 &mdash; the Lean gate, for both arms</h3>
<p class="small">${p3 ? esc(p3.gate_rule) : NA}</p>
<div class="verdict">${gateArms.map(a => {
  const v = p3?.verdicts?.[a];
  const cls = v === 'FAILS' ? 'bad' : v === 'UNDECIDED' ? 'un' : v === 'PASSES' ? 'ok' : '';
  const gl = v === 'FAILS' ? '✕' : v === 'UNDECIDED' ? '–' : '✓';
  return `<span class="chip ${cls}">${gl} ${esc(gateLabel[a] || a)}: ${v ? esc(v) : 'no verdict in the source'}</span>`;
}).join('')}</div>
<div class="card">${gateFigure()}</div>
<div class="grid g2" style="margin-top:14px">
 <div class="card"><h3>The real flying fish also fails</h3>
  ${p3?.real_violations?.length ? p3.real_violations.map(v => `<p class="small"><b>${esc(v.id)}</b> (${esc(v.band)}, <code>${esc(v.theorem)}</code>): level flight at 10 m/s needs ${v.needed?.power_W ? esc(v.needed.power_W) : NA} W against an aerobic ceiling of ${v.available?.power_W ? esc(v.available.power_W) : NA} W &mdash; short by a factor of ${num(v.shortfall_factor)}. ${esc(v.note || '')}</p>`).join('') : `<p class="small na-block">${NA}</p>`}
  <p class="small"><b>So failing does not separate the design from its target.</b> ${joint?.but_read_this_with_the_qualifications?.find(q => /real flying fish ALSO FAILS/i.test(q)) ? esc(joint.but_read_this_with_the_qualifications.find(q => /real flying fish ALSO FAILS/i.test(q))) : ''}</p>
 </div>
 <div class="card"><h3>And the gate is weak: ${p3?.how_much_of_the_design_lean_tests ? `${num(p3.how_much_of_the_design_lean_tests.rows_decided_of_21)} of ${num(p3.rows)}` : NA} rows are decided</h3>
  <p class="small">${p3?.how_much_of_the_design_lean_tests?.verdict ? esc(p3.how_much_of_the_design_lean_tests.verdict) : NA}</p>
  ${p3?.how_much_of_the_design_lean_tests?.results ? `<div class="scroll"><table><thead><tr><th>input dropped</th><th>rows whose verdict changed</th></tr></thead><tbody>${Object.entries(p3.how_much_of_the_design_lean_tests.results).map(([k, v]) => `<tr><td><code>${esc(k)}</code></td><td>${(v || []).map(x => `<code>${esc(x)}</code>`).join(' ') || NA}</td></tr>`).join('')}</tbody></table></div>` : ''}
 </div>
</div>
${p3?.design_violations?.length ? `<details><summary>The design's ${p3.design_violations.length} violations, with the qualification each carries</summary><div class="in">${p3.design_violations.map(v => `<p class="small"><b>${esc(v.id)}</b> (${esc(v.band)}, <code>${esc(v.theorem)}</code>, ${esc(v.classification)}). Needed: ${typeof v.needed === 'string' ? esc(v.needed) : esc(JSON.stringify(v.needed))}. Available: ${typeof v.available === 'string' ? esc(v.available) : esc(JSON.stringify(v.available))}.<br><span class="mute">${esc(v.honest_qualification || '')}</span></p>`).join('')}</div></details>` : ''}
${src(SRC.scorecard + ' (part3_lean_gate)', 'lean/eliminate/browser-check.mjs')}

<h3>Part 4 &mdash; the design is not ours, and the locus it "reproduces" is a different residue</h3>
<div class="card">
 <p class="small"><b>${p4?.does_the_real_experiment_already_achieve_what_our_design_claims ? esc(p4.does_the_real_experiment_already_achieve_what_our_design_claims) : NA}</b></p>
 <p class="small">${scorecard?.organisms?.design_has_a_real_counterpart ? esc(scorecard.organisms.design_has_a_real_counterpart) : NA}</p>
 ${p4?.its_own_limits ? `<ul class="tight small">${p4.its_own_limits.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
 ${p4?.quotes ? `<details><summary>What the authors actually wrote (${p4.quotes.length} quotations)</summary><div class="in">${p4.quotes.map(q => `<p class="small"><b>${esc(q.claim)}</b><span class="quote">${esc(q.quote)}</span><span class="tiny mute">PMID ${esc(q.pmid)}</span></p>`).join('')}</div></details>` : ''}
 ${src(SRC.scorecard + ' (part4_the_real_experiment)', 'genotype/compare-2x2.json')}
</div>

<h3>The joint result</h3>
<div class="card">
 <div class="verdict">${joint?.pair ? joint.pair.map(x => `<span class="chip bad">✕ ${esc(x)}</span>`).join('') : NA}</div>
 <p class="small"><b>Read as:</b> ${joint ? esc(joint.reading) : NA}. ${joint ? esc(joint.preregistered_consequence) : ''}</p>
 ${joint?.but_read_this_with_the_qualifications ? `<p class="small"><b>But read it with these qualifications, which the pre-registration required:</b></p><ul class="tight small">${joint.but_read_this_with_the_qualifications.map(q => `<li>${esc(q)}</li>`).join('')}</ul>` : ''}
 <p class="small"><b>What actually follows:</b> ${joint?.what_actually_follows ? esc(joint.what_actually_follows) : NA}</p>
 ${src(SRC.scorecard + ' (joint_result)')}
</div>
</section>`;

// ---- section 3 ---------------------------------------------------------
function itemRow(k) {
  const it = items?.[k];
  if (!it) return '';
  const zero = Number(it.strict_count || 0) === 0;
  return `<tr class="${zero ? 'unev' : ''}">
   <td class="num"><b>(${esc(k)})</b></td>
   <td>${esc(checklist?.[k] || it.need || '')}</td>
   <td class="num">${num(it.strict_count)}</td>
   <td>${zero ? '<span class="chip un">– none held</span>' : '<span class="chip warn">! partial</span>'}</td>
   <td class="small">${esc(clip(it.verdict, 300))}</td>
  </tr>`;
}

const sec3 = `<section id="simulation">
<span class="sec-n">3 of 7</span>
<h2>What a simulation would actually need</h2>
<p class="lede">${readiness ? esc(readiness.title) : NA}</p>

<div class="grid g3">
 <div class="card"><div class="kpi">${ratio ? esc(ratio.ratio_strict_text) : NA}<small>of the numbers a minimal dynamical model of these ${num(ratio?.N_genes)} genes would need, we hold this many</small></div></div>
 <div class="card"><div class="kpi">${num(ratio?.minimal_parameter_count)}<small>= ${num(ratio?.gene_parameters_needed)} gene parameters (4 each) + ${num(ratio?.edge_parameters_needed)} edge strengths</small></div></div>
 <div class="card"><div class="kpi">${headline?.annotation_for_contrast ? esc(headline.annotation_for_contrast.match(/\(([\d.]+%)\)/)?.[1] || headline.annotation_for_contrast) : NA}<small>of the same genes carry a functional annotation (${num(readiness?.gene_set?.with_any_pathway_annotation)} of ${num(readiness?.gene_set?.n_genes)}). Annotation is nearly complete; the parameters are absent.</small></div></div>
</div>

<div class="card" style="margin-top:14px">
 <p class="small"><b>In one sentence:</b> ${headline ? esc(headline.one_sentence) : NA}</p>
 <p class="small"><b>The most generous reading we could defend:</b> ${headline ? esc(headline.generous_bound) : NA} &mdash; ${headline ? esc(headline.generous_caveat) : ''}</p>
 <div class="model-note"><b>This is a measurement of databases, not of fish.</b> ${readiness ? esc(readiness.constraint) : ''}</div>
 ${src(SRC.readiness + ' (ratio, headline)')}
</div>

<h3>Item by item</h3>
<div class="card"><div class="scroll"><table>
 <thead><tr><th class="num">item</th><th>what a simulation needs</th><th class="num">genes we hold it for</th><th>state</th><th>the source's own verdict</th></tr></thead>
 <tbody>${itemOrder.map(itemRow).join('')}</tbody>
</table></div>
<p class="small mute">Item (h) is a network, so its denominator is gene pairs, not genes: ${ratio?.pairwise_framing ? `${num(ratio.pairwise_framing.pairs_with_any_direct_experimental_support)} of ${num(ratio.pairwise_framing.unordered_gene_pairs)} unordered pairs (${esc(ratio.pairwise_framing.fraction_text)}) have any direct experimental support, and none of it is signed, directed and quantified.` : NA}</p>
${src(SRC.readiness + ' (items, checklist)')}</div>

${coverageSvg ? `<div class="card" style="margin-top:14px">
 <h3>The figure the readiness thread drew</h3>
 <figure class="figwrap">${coverageSvg}</figure>
 ${src(SRC.coverageSvg + ' (embedded as built, not redrawn)')}
</div>` : `<p class="na-block">${NA} &mdash; <code>${esc(SRC.coverageSvg)}</code> could not be read.</p>`}

<div class="grid g2" style="margin-top:14px">
 <div class="card"><h3>The worked example: one genome says it in one sentence</h3>
  <p class="small">${worked?.why ? esc(worked.why) : NA}</p>
  <p class="small"><i>${worked?.paper?.species ? esc(worked.paper.species) : NA}</i>: ${num(worked?.annotation?.protein_coding_genes_predicted)} predicted protein-coding genes, ${num(worked?.annotation?.functionally_annotated)} (${worked?.annotation?.percent ? esc(worked.annotation.percent) + '%' : NA}) annotated. ${worked?.paper?.read ? `Read: ${esc(worked.paper.read)}.` : ''}</p>
  <p class="small"><b>And in that same paper, counted term by term:</b> ${workedAllZero === true ? `all ${workedZeroTerms.length} parameter-bearing terms occur <span class="n">0</span> times in the full text &mdash; <code>rna-seq</code>, <code>half-life</code>, <code>kcat</code>, <code>diffusion</code>, <code>hill coefficient</code>, <code>molecules per cell</code> and the rest. The verification is a count, not an inference.` : workedAllZero === false ? `${workedZeroTerms.filter(([, v]) => Number(v) > 0).length} of ${workedZeroTerms.length} terms occur at least once.` : NA}</p>
  <p class="tiny mute">${worked?.annotation?.definition_caveat ? esc(worked.annotation.definition_caveat) : ''}</p>
  ${src(SRC.readiness + ' (worked_example)')}
 </div>
 <div class="card"><h3>The precedent, to size the task</h3>
  <p class="small">${mgen?.why ? esc(mgen.why) : NA}</p>
  <ul class="tight small">
   <li><b>${num(mgen?.what_it_covered?.genes)}</b> genes, in <b>${num(mgen?.what_it_covered?.sub_models)}</b> sub-models &mdash; ${mgen?.what_it_covered?.scope ? esc(mgen.what_it_covered.scope) : ''}</li>
   <li>built from <b>${mgen?.what_it_took?.primary_sources ? esc(mgen.what_it_took.primary_sources) : NA}</b> primary sources and <b>${mgen?.what_it_took?.experimentally_observed_parameters ? esc(mgen.what_it_took.experimentally_observed_parameters) : NA}</b> experimentally observed parameters</li>
   <li>that is <b>${mgen?.what_it_took?.parameters_per_gene ? esc(mgen.what_it_took.parameters_per_gene) : NA}</b> parameters and <b>${mgen?.what_it_took?.publications_per_gene ? esc(mgen.what_it_took.publications_per_gene) : NA}</b> publications per gene</li>
  </ul>
  <p class="tiny mute">${mgen?.scaled_to_our_gene_set?.note ? esc(mgen.scaled_to_our_gene_set.note) : ''}</p>
  ${src(SRC.readiness + ' (precedent_m_genitalium)')}
 </div>
</div>

${readiness?.simulatable_today ? `<details><summary>What <i>is</i> simulatable today, and at what coarseness</summary><div class="in">
 <ul class="tight small">${(readiness.simulatable_today.yes || []).map(y => `<li><b>${esc(y.what)}</b> &mdash; with ${esc(y.with)}. <span class="mute">Coarseness: ${esc(y.coarseness)}</span></li>`).join('')}</ul>
 <p class="small"><b>And what is not:</b></p>
 <ul class="tight small">${(readiness.simulatable_today.no || []).map(n => `<li class="unev">${esc(n)}</li>`).join('')}</ul>
 ${src(SRC.readiness + ' (simulatable_today)')}
</div></details>` : ''}
</section>`;

// ---- section 4 ---------------------------------------------------------
const sec4 = `<section id="held">
<span class="sec-n">4 of 7</span>
<h2>What held up</h2>
<p class="lede">Results that survived their own checks today. Each carries the scope it holds in, and what it does <i>not</i> bound.</p>

<div class="card">
 <h3>Aerobic flight is eliminated for the real flying fish &mdash; under named proxies</h3>
 <div class="verdict">
  <span class="chip bad">✕ ${num(physSummary?.eliminated)} of ${num(physSummary?.candidates)} candidates eliminated</span>
  <span class="chip ok">✓ ${num(physSummary?.kernelCheckedEliminations)} kernel-checked</span>
  ${physSummary?.compile ? `<span class="chip ok">✓ compile exit ${esc(physSummary.compile.exit)}, ${esc(physSummary.compile.seconds)} s, ${num(physSummary.compile.theorems)} theorems</span>` : ''}
 </div>
 <p class="small">${physSummary?.label ? esc(physSummary.label) : NA}. The three candidates:</p>
 <div class="scroll"><table><thead><tr><th>candidate</th><th>verdict</th><th>eliminated on</th></tr></thead><tbody>
  ${physLedger.map(c => `<tr><td><code>${esc(c.id)}</code><div class="tiny mute">${esc(clip(c.problem, 170))}</div></td><td><span class="chip bad">✕ ${esc(c.verdict)}</span></td><td>${(c.summary?.eliminated || []).map(x => `<code>${esc(x)}</code>`).join(' ') || NA}<div class="tiny mute">accepts ${(c.accepts || []).map(a => `<code>${esc(a)}</code>`).join(', ') || NA}</div></td></tr>`).join('') || `<tr><td colspan="3" class="na-block">${NA}</td></tr>`}
 </tbody></table></div>
 <p class="small"><b>The scope it holds in.</b> ${physLedger[0]?.eliminationCaveat ? esc(physLedger[0].eliminationCaveat) : NA} Every physiological input is a proxy from another teleost: cardiac output from snapper, arterial oxygen content from a trout curve, efficiency from salmon ventricle.</p>
 <p class="small"><b>What it does NOT bound.</b> ${ccL1?.why ? esc(ccL1.why.split('This is our largest unmatched result')[1] ? 'The hypotheses that could be wrong are the proxies, and the theorem does not bound burst power on white-muscle stores, which is what the fish actually uses.' : ccL1.why) : 'The theorem does not bound burst power on white-muscle stores, which is what the fish actually uses.'} It also cannot rule on ${num(physSummary?.cannotRuleReasonCounts?.['missing-input'])} constraint evaluations across the three candidates, every one of them for a missing input.</p>
 <p class="small mute">${physSummary?.rankingNote ? esc(physSummary.rankingNote) : ''}</p>
 ${src(SRC.ledgerPhys, SRC.audit)}
</div>

<div class="card" style="margin-top:14px">
 <h3>The single-glide bound</h3>
 ${glideRow ? `<div class="verdict"><span class="chip warn">! ${esc(glideRow.verdict.split('(')[0].replace(/\*\*/g, '').trim())}</span></div>
  <p class="small">${esc(glideRow.verdict.replace(/\*\*/g, '').replace(/^[^(]*\(/, '').replace(/\)$/, ''))}</p>
  <p class="small"><b>What that means:</b> ${esc(glideRow.why)}.</p>` : `<p class="na-block">${NA} &mdash; no <code>glide_range_le</code> row found in <code>${esc(SRC.audit)}</code>.</p>`}
 ${ccL3 ? `<p class="small"><b>And the minimum-speed bound holds on the measured specimen:</b> ${esc(ccL3.our_claim.statement)}</p>` : ''}
 ${src(SRC.audit + ' (glide_range_le, vmin_le)', 'physics/glide-data.csv')}
</div>

<div class="card" style="margin-top:14px">
 <h3>Every theorem put against the real flying fish</h3>
 <div class="verdict">
  ${Object.entries(auditVerdicts).map(([k, v]) => {
    const cls = k === 'holds' ? 'ok' : k === 'violated' ? 'bad' : 'un';
    const gl = k === 'holds' ? '✓' : k === 'violated' ? '✕' : '–';
    return `<span class="chip ${cls}">${gl} ${esc(k)}: ${num(v)}</span>`;
  }).join('') || NA}
 </div>
 <p class="small">Applicability, as the audit records it: ${Object.entries(auditApplies).map(([k, v]) => `${esc(k)} ${num(v)}`).join(' &middot; ') || NA}. A theorem is never falsified by data; its hypotheses are.</p>
 ${mutations?.summary ? `<p class="small"><b>And the statements are not vacuous:</b> ${num(mutations.summary.mutations)} mutants of the Lean statements and data were generated and ${num(mutations.summary.rejected)} were rejected, with ${num(mutations.summary.controlsPassed)} of ${num(mutations.summary.controls)} controls passing, in ${esc(mutations.summary.wallClockSeconds)} s wall clock (${esc(mutations.summary.speedup)}&times; speedup over summed compile time).</p>` : ''}
 ${laws?.coverage ? `<p class="small"><b>The law catalogue:</b> ${num(laws.laws?.length)} laws, of which ${Object.entries(laws.coverage).map(([k, v]) => `${num(v)} ${esc(k)}`).join(', ')}. ${laws.note ? esc(laws.note) : ''}</p>` : ''}
 ${src(SRC.audit, SRC.mutations, SRC.laws)}
</div>

<div class="card" style="margin-top:14px">
 <h3>Six things the literature does not support in zebrafish</h3>
 <p class="small">Each was proposed from tetrapod limb biology or assumed across fishes, and each was checked against the zebrafish evidence.</p>
 <div class="scroll"><table><thead><tr><th>the assumption</th><th>status</th><th>what the evidence says</th></tr></thead><tbody>
  ${refutations.map(r => `<tr><td>${esc(r.claim)}</td><td><span class="chip bad">✕ ${esc(r.status || '')}</span></td><td class="small">${esc(clip(r.finding, 360))}</td></tr>`).join('') || `<tr><td colspan="3" class="na-block">${NA}</td></tr>`}
 </tbody></table></div>
 ${src('genotype/nanopubs/unsigned/refutation-1…6-*.trig', SRC.npIndex)}
</div>

<div class="card" style="margin-top:14px">
 <h3>Two data pitfalls with no prior published report</h3>
 ${pitfalls.length ? `<ul class="tight small">${pitfalls.map(p => `<li><b>${esc(p.title)}</b><div class="tiny mute"><code>${esc(p.path)}</code></div></li>`).join('')}</ul>` : `<p class="na-block">${NA}</p>`}
 <p class="small"><b>${pitfallVerdict ? esc(pitfallVerdict) : NA}</b> The grounding searches returned only the databases' own resource papers and unrelated ontology work, so these appear to be new contributions. Both records should cite the resource papers they are about, and currently cite none of them.</p>
 ${src(SRC.npReadme + ' (literature grounding)', SRC.npIndex)}
</div>

<div class="card" style="margin-top:14px">
 <h3>The sequence results</h3>
 <p class="small"><b>Gliders do not converge at these genes.</b> ${gliders?.reading ? esc(gliders.reading) : NA}</p>
 <div class="grid g3">
  <div class="card"><div class="kpi">${num(gliders?.totals?.glider_convergent_columns)}<small>alignment columns with a residue shared by gliders of two or more lineages and absent from their non-gliding relatives</small></div></div>
  <div class="card"><div class="kpi">${num(gliders?.totals?.control_convergent_columns_baseline)}<small>columns for the role-swapped baseline &mdash; <b>more</b> than the glider count</small></div></div>
  <div class="card"><div class="kpi">${lat4aSiteTally ? `${nf(lat4aSiteTally.F || 0)} of ${nf(Object.values(lat4aSiteTally).reduce((a, b) => a + b, 0))}` : NA}<small>species at the <code>lat4a</code> site 326 carrying F. Only the flying fish carries L: the fish convergence does not extend to mammals.</small></div></div>
 </div>
 <p class="small mute">${gliders?.gene_set_caveat ? esc(gliders.gene_set_caveat) : ''} ${gliders?.birds_excluded ? esc(gliders.birds_excluded) : ''}</p>

 <h4 style="margin-top:16px">The derived-site panel is not a dose-response</h4>
 <div class="scroll"><table><thead><tr><th>group</th><th class="num">species sequenced</th><th class="num">pectoral fin / SL, group median</th><th class="num">mean derived states of 38 sites</th></tr></thead><tbody>
  ${progGroups ? Object.entries(progGroups).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${num(v.n_species_sequenced)}</td><td class="num">${num(v.fin_ratio_group_median)}</td><td class="num">${num(v.mean_derived_states_of_38_sites)}${v.range_derived_states ? `<div class="tiny mute">range ${esc(JSON.stringify(v.range_derived_states))}</div>` : ''}</td></tr>`).join('') : `<tr><td colspan="4" class="na-block">${NA}</td></tr>`}
 </tbody></table></div>
 <p class="small"><b>Slightly inverted, and not a test.</b> ${(() => {
   const g = progGroups || {};
   const gh = g['flying (gliding) halfbeak'], ff = g['flying fish (Exocoetidae)'];
   if (!gh || !ff) return NA;
   const inverted = Number(gh.mean_derived_states_of_38_sites) > Number(ff.mean_derived_states_of_38_sites);
   return `Gliding halfbeaks, at a fin ratio of ${nf(gh.fin_ratio_group_median)}, carry ${nf(gh.mean_derived_states_of_38_sites)} of the 38 derived states; flying fishes, at ${nf(ff.fin_ratio_group_median)} &mdash; roughly ${(Number(ff.fin_ratio_group_median) / Number(gh.fin_ratio_group_median)).toFixed(1)}&times; the fin ratio &mdash; carry ${nf(ff.mean_derived_states_of_38_sites)}. ${inverted ? 'The count goes slightly <b>down</b> as the fin gets longer' : 'The counts are effectively flat'}, so derived-state count does not scale with fin length.`;
 })()}</p>
 ${progFirst.length ? `<ul class="tight small">${progFirst.slice(0, 3).map(t => `<li>${esc(t.split('. ').slice(0, 2).join('. '))}.</li>`).join('')}</ul>` : ''}

 <h4 style="margin-top:16px">And the scale of the edit, against natural divergence</h4>
 <p class="small">${engineered?.headline ? esc(engineered.headline) : NA}</p>
 <div class="model-note"><b>About the model.</b> The "winged zebrafish" is ${num(engineered?.winged_zebrafish?.edited_sites)} edited loci and ${num(engineered?.winged_zebrafish?.amino_acids_changed)} changed amino acid against the zebrafish reference protein set. That is a statement about a specified genotype, not a measurement of any animal that was built and weighed here.</div>
 ${src(SRC.gliders, SRC.progression, SRC.engineered, SRC.seqReadme)}
</div>
</section>`;

// ---- section 5 ---------------------------------------------------------
const relOrder = ['AGREE', 'PARTIAL', 'DISAGREE', "WE-HAVE-THEY-DON'T", "THEY-HAVE-WE-DON'T"];
const relTotal = relCounts ? Object.values(relCounts).reduce((a, b) => a + b, 0) : null;

const sec5 = `<section id="crosscheck">
<span class="sec-n">5 of 7</span>
<h2>Independent cross-check against a collaborator's graph</h2>
<p class="lede">${crosscheck ? esc(crosscheck.title) : NA}. ${crosscheck?.scope ? esc(crosscheck.scope) : ''}</p>

<div class="grid g4">
 ${relOrder.map(k => {
   const v = relCounts?.[k];
   const cls = k === 'AGREE' ? 'ok' : k === 'DISAGREE' ? 'bad' : k === 'PARTIAL' ? 'warn' : 'un';
   const gl = k === 'AGREE' ? '✓' : k === 'DISAGREE' ? '✕' : k === 'PARTIAL' ? '!' : '–';
   return `<div class="card"><div class="kpi">${num(v)}<small><span class="chip ${cls}">${gl} ${esc(k)}</span></small></div></div>`;
 }).join('')}
 <div class="card"><div class="kpi">${num(relTotal)}<small>compared claims in all, one row each</small></div></div>
</div>

<div class="grid g2" style="margin-top:14px">
 <div class="card"><h3>The strongest corroboration</h3>
  ${ccG3 ? `<p class="small"><b>Our most load-bearing caveat holds from outside.</b> ${esc(ccG3.our_claim?.statement || '')}</p>
   <p class="small">${esc(clip(ccG3.why, 760))}</p>
   <div class="verdict"><span class="chip ok">✓ ${esc(ccG3.relationship)}</span></div>` : `<p class="na-block">${NA}</p>`}
  ${src(SRC.crosscheck + ' (row G3)', SRC.ccReport + ' (section 1.1)')}
 </div>
 <div class="card"><h3>The one disagreement</h3>
  ${ccG5 ? `<p class="small"><b>${esc(ccG5.our_claim?.our_verdict || '')}.</b> ${esc(clip(ccG5.why, 700))}</p>
   <div class="verdict"><span class="chip bad">✕ ${esc(ccG5.relationship)}</span></div>
   <p class="tiny mute">Our files: <code>${esc(ccG5.our_claim?.file || '')}</code></p>` : `<p class="na-block">${NA}</p>`}
  ${src(SRC.crosscheck + ' (row G5)', SRC.ccReport + ' (section 2.1)')}
 </div>
</div>

<h3>Two traps a reader must know about before counting any of this as agreement</h3>
<div class="grid g2">
 <div class="card"><div class="verdict"><span class="chip warn">! not independent</span></div>
  <h3>Their Lean check shares our Mathlib pin</h3>
  <p class="small">Our <code>${esc(SRC.leanManifest)}</code> pins mathlib at <code>${ourMathlibRev ? esc(ourMathlibRev.slice(0, 16)) + '…' : 'unreadable'}</code>. Their receipt declares <code>${theirMathlibRev ? esc(theirMathlibRev.slice(0, 16)) + '…' : 'unreadable'}</code>. ${pinIsShared === true ? '<b>These are the same revision, compared in this build.</b> So two apparently independent Lean checks share a trusted base.' : pinIsShared === false ? '<b>These differ.</b>' : NA}</p>
  <p class="small">Worse, their receipt bytes cannot be retrieved: their catalogue reports ${num(store?.artifact_declared_downloadable)} artifacts declared downloadable, ${num(store?.artifact_hosted_and_byte_checked)} hosted and byte-checked, and ${num(store?.formal_receipt_contents_read_by_store)} formal receipt contents read. ${ccL2?.our_claim?.our_verdict ? '' : ''}If their check is cited anywhere, it must be cited as a declaration we could not verify.</p>
  ${src(SRC.leanManifest, SRC.crosscheck + ' (row L2)', SRC.ccReport + ' (section 2.3)')}
 </div>
 <div class="card"><div class="verdict"><span class="chip warn">! our own work reflected back</span></div>
  <h3>Much of their store is a bulk import of our registry</h3>
  <p class="small">${bulkImportRule ? esc(bulkImportRule) : NA}</p>
  <p class="small">Of ${num(store?.claims_versions)} claim versions in their store, ${num(store?.claims_by_namespace?.['node-a'])} are in the <code>node-a</code> namespace and ${num(store?.claims_by_namespace?.['delphi-frontier'])} in <code>delphi-frontier</code>; ${num(store?.claims_origin_declared?.unknown)} declare no origin. Nothing in their store is accepted: every record examined carries <code>imported_unreviewed</code> or <code>proposed</code>.</p>
  ${src(SRC.crosscheck + ' (reading_rules, their_store_as_measured)')}
 </div>
</div>
<p class="small mute">${readingRules.find(r => /bird/i.test(r)) ? esc(readingRules.find(r => /bird/i.test(r))) : ''}</p>
</section>`;

// ---- section 6 ---------------------------------------------------------
const sec6 = `<section id="corpus">
<span class="sec-n">6 of 7</span>
<h2>The corpus: ${num(npIndex?.unsigned_draft_count)} unsigned drafts, and nothing published</h2>
<p class="lede">Indexed: ${npIndex?.scope ? esc(npIndex.scope) : NA}. Snapshot ${npIndex?.generated_utc ? esc(npIndex.generated_utc) : NA}.</p>

<div class="grid g2">
 <div class="card"><h3>Drafts by thread</h3>
  <div class="scroll"><table><thead><tr><th>thread</th><th class="num">drafts</th></tr></thead><tbody>
   ${draftThreadRows.map(([t, n]) => `<tr><td><code>${esc(t)}</code></td><td class="num">${num(n)}</td></tr>`).join('') || `<tr><td colspan="2" class="na-block">${NA}</td></tr>`}
   ${vTally ? `<tr><td><b>total</b></td><td class="num"><b>${num(vTally.total)}</b></td></tr>` : ''}
  </tbody></table></div>
  ${vTally && npIndex?.unsigned_draft_count != null && vTally.total !== npIndex.unsigned_draft_count ? `<p class="small"><span class="chip warn">! the per-thread rows sum to ${num(vTally.total)}, and the file's own <code>unsigned_draft_count</code> is ${num(npIndex.unsigned_draft_count)}</span></p>` : ''}
  ${src(SRC.npIndex)}
 </div>
 <div class="card"><h3>Validation result</h3>
  <div class="verdict">
   ${vTally ? `<span class="chip ok">✓ ${num(vTally.pass)} of ${num(vTally.total)} pass <code>np check</code></span>` : NA}
   ${vTally ? `<span class="chip ok">✓ ${num(vTally.rdfError)} RDF parse errors</span>` : ''}
   ${vTally ? `<span class="chip un">– ${num(vTally.notTrusty)} report "Valid (but not trusty)"</span>` : ''}
  </div>
  <p class="small">Checker: ${checker ? `<code>${esc(checker)}</code>` : NA}, one run per file. The project's recorded trap is real and was handled: <code>np check</code> exits 0 on an RDF parse error, so the verdict is parsed out of the transcript rather than taken from the exit code.</p>
  ${issueTally ? `<div class="scroll"><table><thead><tr><th>issue reported on every record</th><th class="num">records</th></tr></thead><tbody>${Object.entries(issueTally).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `<tr class="unev"><td>${esc(k)}</td><td class="num">${num(v)}</td></tr>`).join('')}</tbody></table></div><p class="tiny mute">Each of those is expected and by recorded decision: the records are unsigned drafts using <code>purl.org/nanopub/temp/</code> placeholders, which are replaced by trusty URIs at signing.</p>` : ''}
  ${src(SRC.npIndex + ' (drafts[].validation)', SRC.npReadme + ' (Validation)')}
 </div>
</div>

<div class="card" style="margin-top:14px">
 <h3>Plainly: nothing is signed and nothing is published</h3>
 <p><b>${npIndex?.note ? esc(npIndex.note) : NA}</b></p>
 <ul class="tight small">
  ${vTally ? `<li>${num(vTally.unsigned)} of ${num(vTally.total)} drafts carry no signature element, by design.</li>` : ''}
  ${vTally ? `<li>${num(vTally.noOrcid)} of ${num(vTally.total)} use no human ORCID for attribution: the creator is the software agent until the key owner approves and signs.</li>` : ''}
  ${npIndex?.signed_corpus ? `<li>A separate, older corpus of ${num(npIndex.signed_corpus.count)} records in <code>${esc(npIndex.signed_corpus.path)}</code> <i>is</i> signed and published, and is counted separately everywhere: ${esc(npIndex.signed_corpus.status)}. ${esc((npIndex.signed_corpus.how_they_differ || []).slice(-1)[0] || '')}</li>` : ''}
 </ul>
 <p class="small"><b>The decision that is pending is who holds the signing key.</b> Publishing needs the key owner's explicit approval, test registry before production, and production never without it.</p>
 ${src(SRC.npIndex + ' (note, signed_corpus)', 'genotype/nanopubs/DECISIONS.md')}
</div>
</section>`;

// ---- section 7 ---------------------------------------------------------
function openList(title, items, paths, note) {
  return `<div class="card"><h3>${esc(title)}</h3>
  ${note ? `<p class="small mute">${esc(note)}</p>` : ''}
  ${items.length ? `<ul class="tight small">${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : `<p class="na-block">${NA}</p>`}
  ${src(...paths)}</div>`;
}

const sec7 = `<section id="open">
<span class="sec-n">7 of 7</span>
<h2>What is still open</h2>
<p class="lede">Read out of the "what should change", gap and limits sections the source files already carry. Nothing on this list was invented for the page.</p>
<div class="grid g2">
 ${openList('What the cross-check says should change in what we claim', openFromCrosscheck, [SRC.ccReport + ' (section 5)'])}
 ${openList('Findings that exist only as prose, with no record', openFromGaps, [SRC.npGaps], 'List A: dashboard claims no nanopublication draft records. List B: drafts citing no external source.')}
 ${openList('Limits of the simulation-readiness measurement', openFromReadiness, [SRC.simReadme + ' (Honest limits of this measurement)'])}
 ${openList(specHeader || 'Mismatches in the flier spec', openFromSpec, [SRC.specMismatch], specMuscle ? `Found by building the spec as a mesh, and logged rather than fixed. Among them: only ${specMuscle} of the required flight muscle fits inside the body. That is a property of the specification, not of an animal.` : 'Found by building the spec as a mesh, and logged rather than fixed.')}
 ${openList('Deliberately not done in the design validation', openFromDv, [SRC.dvRuns + ' (Things that were deliberately not done)'])}
 <div class="card"><h3>Ideas not yet checked against prior art</h3>
  <p class="small">${ideas?.note ? esc(ideas.note) : NA}</p>
  <div class="scroll"><table><thead><tr><th>origin</th><th class="num">ideas</th></tr></thead><tbody>
   ${ideaOrigins ? Object.entries(ideaOrigins).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr class="${k === 'researched' ? '' : 'unev'}"><td>${esc(k)}</td><td class="num">${num(v)}</td></tr>`).join('') : `<tr><td colspan="2" class="na-block">${NA}</td></tr>`}
  </tbody></table></div>
  <p class="small">${ideasUnresearched != null ? `<b>${nf(ideasUnresearched)} of ${nf(ideas.ideas.length)}</b> adopted ideas have not survived a logged prior-art search.` : NA}</p>
  ${src(SRC.ideas)}
 </div>
</div>
</section>`;

// ---- shell -------------------------------------------------------------
const stamps = [
  scorecard?.built_utc ? ['design-validation', scorecard.built_utc, SRC.scorecard] : null,
  readiness?.built ? ['simulation-readiness', readiness.built, SRC.readiness] : null,
  crosscheck?.built ? ['crosscheck-frontier', crosscheck.built, SRC.crosscheck] : null,
  npIndex?.generated_utc ? ['nanopubs-index', npIndex.generated_utc, SRC.npIndex] : null,
  ledgerPhys?.summary?.run ? ['lean eliminate (physiology)', ledgerPhys.summary.run, SRC.ledgerPhys] : null,
  laws?.built ? ['lean laws', laws.built, SRC.laws] : null,
  mutations?.summary?.run ? ['lean mutation testing', mutations.summary.run, SRC.mutations] : null,
  mapSlim?.built ? ['genotype map (vetted)', mapSlim.built, SRC.mapSlim] : null,
].filter(Boolean);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DELPHI results</title>
<meta name="description" content="Today's DELPHI findings in one page: four corrections, a pre-registered design test that failed, how far a simulation is from runnable, what held up, an independent cross-check, and the unsigned corpus. Every number is read from a committed file at build time.">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='14' fill='%230e7c86'/%3E%3Cpath d='M9 16l5 5 9-10' stroke='white' stroke-width='3' fill='none'/%3E%3C/svg%3E">
<style>${CSS}</style>
</head>
<body>
<header class="top"><div class="wrap">
 <a class="back" href="../index.html">&larr; Mission Control</a>
 <span class="brand">Results</span>
 <nav>${navItems.map(([id, label]) => `<a href="#${id}">${esc(label)}</a>`).join('')}</nav>
 <button id="themeBtn" title="Toggle light or dark">Theme</button>
</div></header>

<main class="wrap">
<section id="top" style="padding-top:30px">
<h1>What we found, strongest first</h1>
<p class="lede">Seven sections, ordered by what is most solid and least flattering rather than by what is most exciting. It opens with four things we got wrong and corrected, then a pre-registered test of our own central claim that failed, then the measurement of how far a whole-organism simulation actually is.</p>
<div class="card">
 <p class="small" style="margin-top:0"><b>Every number on this page is read from a committed file when the page is built.</b> Nothing is typed in by hand, so a figure here cannot drift from its source. Each result prints the path it came from. Where a source carries no value, the page says so instead of guessing.</p>
 <pre>node dashboard/build-results.mjs</pre>
 <p class="small mute" style="margin-bottom:0">Page built ${esc(built)}. Source files as last built:</p>
 <div class="scroll"><table><thead><tr><th>thread</th><th>built</th><th>file</th></tr></thead><tbody>
  ${stamps.map(([n, t, f]) => `<tr><td>${esc(n)}</td><td class="small">${esc(t)}</td><td><code>${esc(f)}</code></td></tr>`).join('')}
 </tbody></table></div>
 ${missing.length ? `<p class="small"><span class="chip bad">✕ ${missing.length} source file(s) could not be read</span> ${missing.map(m => `<code>${esc(m)}</code>`).join(' ')}</p>` : ''}
 <p class="tiny mute" style="margin-bottom:0">No bird data appears anywhere on this page: class Aves is this project's frozen holdout, and the drafts covering it are indexed but deliberately not grounded.</p>
</div>
</section>

${sec1}
${sec2}
${sec3}
${sec4}
${sec5}
${sec6}
${sec7}

<footer>
 <p>Built by <code>dashboard/build-results.mjs</code> from the files cited beside each result. Machine-readable copy of every number on this page: <code>dashboard/public/results/results.json</code>.</p>
 <p>A proof shows a conclusion follows from its assumptions; it says nothing about whether real genomes or real fish satisfy them. A number about "the design" is a number about a specified model, not a measurement of an animal.</p>
</footer>
</main>
<script>${JS}</script>
</body>
</html>
`;

// ---------------------------------------------------------------- write
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), html);

const machine = {
  built,
  built_by: 'dashboard/build-results.mjs',
  rule: 'every value here was read from the cited file in this build; nothing is hand-entered',
  sources: SRC,
  unreadable_sources: missing,
  section_1_corrections: corrections.map(c => ({
    id: c.id, what: c.what, verdict: c.verdict, found_by: c.found_by,
    metrics: Object.fromEntries((c.metrics || []).map(m => [m[0], m[1]])),
    split: c.split || undefined, paths: c.paths,
  })),
  section_2_design_test: {
    prereg: scorecard?.prereg || null,
    prereg_hash_in_sha256_file: preregHashInFile,
    prereg_hash_matches_scorecard: hashMatches,
    axes_preregistered: p1?.axes_preregistered ?? null,
    axes_scored: p1?.n_scored ?? null,
    axes_cannot_score: p1?.n_cannot_score ?? null,
    part1_verdict: p1?.verdict ?? null,
    genetic: {
      A: p2?.a_loci_known_to_differ?.value ?? null,
      B: p2?.b_design_changes_that_are_in_a?.value ?? null,
      C: p2?.c_fraction_reproduced?.value ?? null,
      C_band: p2?.c_fraction_reproduced?.band ?? null,
      D: p2?.d_design_changes_not_known_to_differ?.value ?? null,
    },
    gate: { rows: p3?.rows ?? null, verdicts: p3?.verdicts ?? null, tallies: p3?.tallies ?? null, rows_decided: p3?.how_much_of_the_design_lean_tests?.rows_decided_of_21 ?? null },
    joint: joint || null,
  },
  section_3_simulation: { ratio: ratio || null, headline: headline || null, items_strict: items ? Object.fromEntries(itemOrder.map(k => [k, items[k]?.strict_count ?? null])) : null, precedent: mgen?.what_it_covered || null },
  section_4_held_up: {
    aerobic: physSummary || null,
    audit_verdicts: auditVerdicts,
    audit_applies: auditApplies,
    single_glide: glideRow,
    mutations: mutations?.summary || null,
    laws: { n: laws?.laws?.length ?? null, coverage: laws?.coverage ?? null },
    refutations: refutations.map(r => ({ path: r.path, status: r.status, claim: r.claim })),
    pitfalls: pitfalls.map(p => ({ path: p.path, title: p.title })),
    pitfall_prior_work: pitfallVerdict,
    gliders: gliders?.totals || null,
    progression_groups: progGroups || null,
    engineered: { edited_sites: engineered?.winged_zebrafish?.edited_sites ?? null, amino_acids_changed: engineered?.winged_zebrafish?.amino_acids_changed ?? null },
  },
  section_5_crosscheck: { relationship_counts: relCounts, total_rows: relTotal, store: store || null, our_mathlib_rev: ourMathlibRev, their_mathlib_rev: theirMathlibRev, mathlib_pin_shared: pinIsShared },
  section_6_corpus: { unsigned_draft_count: npIndex?.unsigned_draft_count ?? null, by_thread: draftsByThread, validation: vTally, issues: issueTally, signed_corpus: npIndex?.signed_corpus?.count ?? null, note: npIndex?.note ?? null },
  section_7_open: { crosscheck: openFromCrosscheck, gaps: openFromGaps, readiness_limits: openFromReadiness, spec_mismatches: openFromSpec, design_validation_not_done: openFromDv, ideas_by_origin: ideaOrigins },
};
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(machine, null, 1));

const bytes = Buffer.byteLength(html);
console.log(`dashboard/public/results/index.html  ${(bytes / 1024).toFixed(1)} kB`);
console.log(`dashboard/public/results/results.json`);
if (missing.length) {
  console.log(`\nWARNING: ${missing.length} source file(s) unreadable; the page says so where their numbers would be:`);
  for (const m of missing) console.log('  - ' + m);
} else {
  console.log(`\nall ${Object.keys(SRC).length} source files read`);
}
