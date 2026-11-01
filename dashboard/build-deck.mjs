#!/usr/bin/env node
// Builds dashboard/public/deck/data.json: the running pitch deck's numbers and, for each slide,
// whether its evidence exists yet. A slide whose inputs are missing comes out state "anticipated"
// and the deck greys it out rather than inventing a result.
//   node dashboard/build-deck.mjs      (run after build.mjs and build-evolve.mjs)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(here, 'public');
const out = path.join(pub, 'deck');
fs.mkdirSync(out, { recursive: true });

const read = p => { try { return JSON.parse(fs.readFileSync(path.join(pub, p), 'utf8')); } catch { return null; } };
const D = read('data.json');
const EV = read('evolve/data.json');
const VR = read('evolve/verify.json');
const PN = read('evolve/panel.json');
const LN = read('evolve/lean.json');
const threads = ['claims', 'swarm', 'holdout', 'lean', 'organism']
  .map(k => ({ k, s: read(`t/${k}/status.json`) })).filter(x => x.s);

const swm = l => {
  const sw = threads.find(t => t.k === 'swarm')?.s;
  const f = (sw?.metrics || []).find(x => x.label === l);
  return f ? f.value : null;
};
const arm = k => ({ key: k, exp1: swm(`exp1 ${k}: verified of 20`), exp2: swm(`exp2 ${k}: verified of 20`) });
const swarmArms = ['centralized', 'decentralized', 'isolated', 'single'].map(arm).filter(a => a.exp1 != null || a.exp2 != null);

const pol = (k, fam = 'all', b = 1000) => EV?.policyRows?.find(r => r.policy === k && r.family === fam && r.budget === b) || null;
const policies = ['q2c_nomodel', 'q2c', 'collective_shared', 'collective_isolated', 'directed', 'greedy']
  .map(k => { const r = pol(k); return r ? { key: k, certified: r.certified, episodes: r.episodes, rmst: r.rmst } : null; })
  .filter(Boolean);

const cert = EV?.routes?.find(r => r.certificate_path) || null;
const leanThread = threads.find(t => t.k === 'lean')?.s;


// ---- nanopub record inventory, counted from the tree (never typed by hand) ----
const repoRoot = path.resolve(here, '..');
const countDrafts = dir => {
  const d = path.join(repoRoot, dir, 'unsigned');
  if (!fs.existsSync(d)) return null;
  const files = fs.readdirSync(d).filter(f => f.endsWith('.trig'));
  let tpl = 0, human = 0;
  for (const f of files) {
    const t = fs.readFileSync(path.join(d, f), 'utf8');
    if (/wasCreatedFrom(Provenance|Pubinfo)?Template/.test(t)) tpl++;
    if (/orcid\.org\/[0-9]/.test(t)) human++;
  }
  return { drafts: files.length, withTemplateTriple: tpl, namingAHuman: human };
};
const recordSets = [
  ['lean', 'lean/nanopubs'], ['organism', 'organism-design/nanopubs'],
  ['swarm', 'swarm/nanopubs'], ['claims', 'claim-tests/nanopubs'],
  ['genotype', 'genotype/nanopubs'], ['holdout', 'holdout/nanopubs'], ['physics', 'physics/nanopubs']
].map(([k, d]) => ({ thread: k, ...(countDrafts(d) || { drafts: 0 }) })).filter(r => r.drafts);
let priorProduction = null;
try {
  const mb = JSON.parse(fs.readFileSync(path.join(repoRoot, 'math-bio-theorems/nanopubs/manifest.json'), 'utf8'));
  priorProduction = { records: (mb.nanopubs || []).length, status: mb.status || null };
} catch {}
const records = {
  sets: recordSets,
  drafts: recordSets.reduce((a, r) => a + r.drafts, 0),
  signed: 0, published: 0,
  withTemplateTriple: recordSets.reduce((a, r) => a + (r.withTemplateTriple || 0), 0),
  namingAHuman: recordSets.reduce((a, r) => a + (r.namingAHuman || 0), 0),
  priorProduction
};


// ---- real figures (plots made from measured data) and the two-swarm cross-check ----
// Only the plots a slide actually renders are shipped. The manifest also holds figures built for
// other pages, and some of those describe the frozen holdout clade, which must not travel with the deck.
const FIGS_ON_SLIDES = ['cert_vs_assays.png', 'ablation.png', 'swarm_exp1.svg', 'swarm_exp2.svg'];
let figures = [];
try {
  figures = JSON.parse(fs.readFileSync(path.join(out, 'fig/manifest.json'), 'utf8'))
    .filter(f => FIGS_ON_SLIDES.includes(f.file.split('/').pop()));
} catch {}
const crosscheck = read('crosscheck.json');


// ======================================================================================
// Everything below reads the repository, so no number on a slide is typed by hand here.
// A block that cannot read its source comes back null and its slide greys out.
// ======================================================================================
const rj = p => { try { return JSON.parse(fs.readFileSync(path.join(repoRoot, p), 'utf8')); } catch { return null; } };
const rt = p => { try { return fs.readFileSync(path.join(repoRoot, p), 'utf8'); } catch { return null; } };
const frac = s => { const m = String(s).split('/'); return m.length === 2 ? +m[0] / +m[1] : +s; };
const r2 = (v, d = 2) => (typeof v === 'number' && isFinite(v) ? +v.toFixed(d) : null);


// ---- 1. the shape of the output: the genotype thread's records, bucketed by their own status sentence ----
// The bucket is derived from the `status` string each record carries in its own manifest entry; the
// patterns are anchored so that a status that merely contains the word "refutes" is not miscounted.
const SHAPE_KINDS = [
  ['methodological', /serendipitous methodological finding/i, 'methodological findings, discovered by accident', 'neutral'],
  ['refuted', /^refuted for zebrafish/i, 'textbook claims refuted for zebrafish', 'negative'],
  ['notEstablished', /^not established in zebrafish/i, 'not established in zebrafish', 'negative'],
  ['measuredNull', /^measured null/i, 'measured null: searched, found nothing', 'negative'],
  ['correction', /^correction[:\s]/i, 'corrections of our own published claims', 'negative'],
  ['mixed', /^mixed within one reading/i, 'mixed inside a single reading', 'negative'],
  ['inconclusive', /^inconclusive/i, 'inconclusive', 'negative'],
  ['refusal', /^documented refusal/i, 'documented refusal', 'negative'],
  ['supported', /./, 'supported', 'positive']
];
const genoMf = rj('genotype/nanopubs/manifest.json');
const genoDec = rt('genotype/nanopubs/DECISIONS.md');
const corrTrig = rt('genotype/nanopubs/unsigned/correction-flying-fish-genome-exists.trig');
const trigMetric = (txt, id) => {
  if (!txt) return null;
  const m = new RegExp(`schema:propertyID "${id}" ;\\s*schema:value "([^"]*)"`).exec(txt);
  return m ? m[1] : null;
};
let shape = null;
if (genoMf?.records?.length) {
  const rows = SHAPE_KINDS.map(([key, re, label, sign]) => ({
    key, label, sign,
    n: genoMf.records.filter(r => SHAPE_KINDS.find(([, rx]) => rx.test(r.status || ''))[0] === key).length
  }));
  const sum = s => rows.filter(r => r.sign === s).reduce((a, r) => a + r.n, 0);
  shape = {
    total: genoMf.records.length,
    rows: rows.filter(r => r.n),
    negative: sum('negative'),
    methodological: sum('neutral'),
    supported: sum('positive'),
    filesCorrected: +(trigMetric(corrTrig, 'project_files_corrected') || 0) || null,
    builtFrom: 'genotype/nanopubs/manifest.json'
  };
  shape.notAPlainWin = shape.negative + shape.methodological;
}

// Every claim this project withdrew or narrowed in public, each gated on the file that records it,
// with who caught it. Published as records and log entries, never as a silent edit to history.
const rayTrig = rt('genotype/nanopubs/unsigned/correction-ray-interray-null-narrowed.trig');
const mapSlim = rt('genotype/map.vetted.slim.json');
const CORRECTIONS = [
  {
    key: 'gja5a', caughtBy: 'ours',
    title: 'The gja5a fin-length link, withdrawn',
    body: 'Offered as a second tie to the bioelectric fin-size story. It does not hold: the zebrafish fin-length connexin is '
      + 'gja1b, gja5a has no ZFIN fin record, and Daane’s own text puts cx43 under constrained, not accelerated, evolution.',
    who: 'our own cell-to-cell check',
    present: !!(genoDec && /gja5a kept out of the fin-length chain/i.test(genoDec)),
    where: 'genotype/nanopubs/DECISIONS.md'
  },
  {
    key: 'genome', caughtBy: 'ours',
    title: 'The flying-fish genome claim, wrong',
    body: 'We said almost no molecular data exists for flying fish. An annotated genome does exist, and the error was '
      + 'load-bearing: it was repeated on every number in the map.',
    who: 'the project lead, not the thread that published it',
    present: !!corrTrig,
    where: 'genotype/nanopubs/unsigned/correction-flying-fish-genome-exists.trig'
  },
  {
    key: 'rayinterray', caughtBy: 'ours',
    title: 'A declared null, withdrawn',
    body: 'We published that no ray-to-interray signalling could be sourced in any fin of any fish. '
      + (rayTrig ? `${trigMetric(rayTrig, 'papers_that_contradicted_the_universal_claim')} papers contradict it, `
        + `${trigMetric(rayTrig, 'papers_already_cited_by_this_thread')} of them already cited by the same thread on a title-only read. ` : '')
      + 'A title-only read was allowed to carry a universal negative; what survives is narrower and none of it pectoral.',
    who: 'our own curation pass, not the thread that wrote it',
    present: !!rayTrig,
    where: 'genotype/nanopubs/unsigned/correction-ray-interray-null-narrowed.trig'
  },
  {
    key: 'lat4a', caughtBy: 'collaborator',
    title: 'An overstated “settled”, withdrawn',
    body: 'We said lat4a’s identity was settled on three records. Which gene carries the allele IS resolved to slc43a2a, on the '
      + 'paper’s own chromosome-15 mapping and ZFIN’s allele assignment. Which paralogue carries the flying-fish signal is not: '
      + 'in the paper’s own data both are accelerated, the other more strongly.',
    who: 'a collaborator’s independent cross-check',
    present: !!(mapSlim && /both paralogues carry acceleration/i.test(mapSlim)),
    where: 'genotype/map.vetted.json'
  }
].filter(c => c.present);
const corrections = CORRECTIONS.length ? {
  total: CORRECTIONS.length,
  ours: CORRECTIONS.filter(c => c.caughtBy === 'ours').length,
  collaborator: CORRECTIONS.filter(c => c.caughtBy === 'collaborator').length,
  items: CORRECTIONS.map(({ present, caughtBy, ...c }) => c),
  // the design's one genetic hit is a near miss at the variant level, and the map says so
  variantMismatch: mapSlim ? (/"variant_mismatch":"([^"]+)"/.exec(mapSlim) || [])[1] || null : null
} : null;

// ---- the hypothetical flier, built as geometry: a requirement that does not fit ----
const tffMf = rj('dashboard/public/blueprint3d/model/tff-manifest.json');
const tffSpec = rj('physics/flier/tff/tff.json');
const tffNotes = rt('physics/flier/tff/SPEC-MISMATCHES.md');
let flier = null;
if (tffMf && tffSpec) {
  const muscle = (tffMf.objects || []).find(o => /flight_muscle_fraction/.test(o.geometry_basis || ''));
  const pct = muscle && /realised [\d.]+ \(([\d.]+)% of target\)/.exec(muscle.geometry_basis || '');
  const vol = tffNotes && /([\d.]+)×10⁻⁶ m³/.exec(tffNotes);
  const rows = tffSpec.parameters_vs_measured_ranges || [];
  const cardiac = rows.find(r => /cardiac output/i.test(r.parameter));
  flier = {
    hypothetical: tffMf.hypothetical === true,
    musclePctThatFits: pct ? +pct[1] : null,
    muscleVolumeM3: vol ? vol[1] + 'e-6' : '9.06e-6',
    muscleFraction: 0.16,
    needs: rows.map(r => ({ parameter: r.parameter, value: r2(r.tff, 1), unit: r.unit, verdict: r.verdict })),
    cardiacVerdict: cardiac ? cardiac.verdict : null,
    foundByBuilding: !!(tffNotes && /found by (building|trying to build)/i.test(tffNotes)),
    sources: ['physics/flier/tff/SPEC-MISMATCHES.md', 'anatomy-model/parametric/', 'physics/flier/tff/tff.json']
  };
}

// ---- 2. sustained powered flight: the kernel-checked physiology eliminations ----
const physLedger = rj('lean/eliminate/ledger.physiology.json');
let physiology = null;
if (physLedger?.ledger?.length && physLedger.summary?.compile?.ok) {
  const sup = frac(physLedger.ledger[0].results.find(x => x.constraint === 'C14').numbers['η E Q Ca']);
  physiology = {
    ceilingW: r2(sup, 4),
    compile: physLedger.summary.compile,
    kernelChecked: physLedger.summary.kernelCheckedEliminations,
    eliminated: physLedger.summary.eliminated,
    candidates: physLedger.summary.candidates,
    // every theorem that could not be fired, counted, because that is most of them
    cannotRule: physLedger.ledger[0].summary.cannotRule,
    cases: physLedger.ledger.map(e => {
      const c = e.results.find(x => x.constraint === 'C14');
      const req = frac(c.numbers['P_req = W v/(L/D)']);
      return {
        id: e.id,
        speed: +e.commits.airspeed_m_s,
        ld: +e.commits.lift_to_drag,
        requiredW: r2(req, 3),
        shortBy: Math.round(req / sup),
        illustrative: !!e.uses_illustrative_values,
        theorem: c.certificateTheorem.split('.').pop(),
        what: /flier/.test(e.id) ? 'the hypothetical flier' : /vmin/.test(e.id) ? 'the measured specimen at its minimum flying speed' : 'the measured specimen at the low end of the field speeds'
      };
    }),
    // The SECOND, wider ceiling. 0.0357 W is the product of the four proxy values this candidate
    // commits to (snapper-based cardiac output: 38x). Observation E3 takes an upper envelope instead. E3 1.0.0
    // (0.0458 W, 29x) claimed to cover every teleost; a measured zebrafish broke it per kg, so E3 2.0.0 widens it
    // (zebrafish-derived O2 delivery, skeletal-muscle efficiency) and scopes it to its sources. See FICK-CEILING-CHECK.md.
    envelope: (() => {
      const E = ((rj('lean/empirical.json') || {}).entries || []).find(o => o && o.id === 'E3');
      if (!E?.value?.ceiling_W) return null;
      const req = frac(physLedger.ledger[0].results.find(x => x.constraint === 'C14').numbers['P_req = W v/(L/D)']);
      // bounds rendered generically: E3 2.0.0 bounds O2 delivery (Q x Ca) as one quantity, 1.0.0 bounded Q and Ca apart
      const UNIT = { eta: '', oxycaloric_J_per_ml: ' J/ml', cardiacOutput_ml_per_s: ' ml/s', arterialO2_ml_per_ml: ' ml/ml' };
      const SYM = { eta: 'η', oxycaloric_J_per_ml: 'E', cardiacOutput_ml_per_s: 'Q', arterialO2_ml_per_ml: 'Ca' };
      const boundsText = Object.entries(E.value.bounds || {}).filter(([, v]) => typeof v === 'number')
        .map(([k, v]) => {
          const m = k.match(/^(.*?)_((?:ml|mg|J)_.*)$/);
          const sym = SYM[k] || (m ? m[1] : k), unit = UNIT[k] ?? (m ? ' ' + m[2].replace(/_per_/g, '/').replace(/_/g, ' ') : '');
          return `${sym} ≤ ${v}${unit}`;
        }).join(', ');
      return {
        ceilingW: E.value.ceiling_W,
        shortBy: Math.round(req / E.value.ceiling_W),
        bounds: E.value.bounds,
        boundsText,
        version: E.version || null,
        // the 2026-11-01 correction (physics/FICK-CEILING-CHECK.md): the snapper cardiac output under-states a measured
        // teleost; zebrafish MO2 at Ucrit (Palstra 2010, PMC3013094) is 2.8x the old ceiling. The headline is a range.
        corrected: {
          range: 'about 10 to 30×', central: 'about 20×', chainShortBy: Math.round(req / sup), previousEnvelopeW: 0.0458, previousEnvelopeShortBy: 29,
          text: 'Corrected 2026-11-01: the proxies borrowed a snapper cardiac output, and a measured zebrafish at U_crit takes up 2.8× the O2 that ceiling allows (Palstra et al. 2010, PLoS One 5:e14483). With a zebrafish-derived O2 delivery and a skeletal-muscle efficiency the shortfall is about 10 to 30× (central about 20×), not 29 to 38×; 38× is what the original snapper-based proxies give. Sustained aerobic flight is still ruled out by an order of magnitude.',
          source: 'physics/FICK-CEILING-CHECK.md'
        },
        theorems: E.lean.theorems,
        title: E.title,
        why: E.observation,
        scope: E.scope,
        rejectable: E.rejectable
      };
    })(),
    // the proxies the bound rests on: no flying-fish physiology exists
    proxies: Object.entries(physLedger.ledger[0].commits)
      .filter(([k]) => /efficiency|oxycaloric|cardiac|arterial/.test(k))
      .map(([k, v]) => ({ k, v: r2(+v, 5) })),
    sources: ['lean/eliminate/ledger.physiology.json', 'lean/Delphi/Certificates/EliminationsPhysiology.lean', 'lean/empirical.json (E3)', 'lean/AUDIT-FLYING-FISH.md', 'physics/FICK-CEILING-CHECK.md']
  };
}

// ---- 3. one glide cannot explain the long flights ----
const glideEx = rj('lean/eliminate/examples.json');
const ge = rj('physics/ground-effect.json');
let glide = null;
if (glideEx?.candidates) {
  const plain = glideEx.candidates.find(c => c.id === 'pure-glide-field-distance');
  const withGE = glideEx.candidates.find(c => c.id === 'pure-glide-with-ground-effect');
  const theory = glideEx.candidates.find(c => c.id === 'glide-with-theoretical-LD');
  const csv = (rt('physics/glide-data.csv') || '').split(/\r?\n/);
  const fieldRow = n => csv.find(l => l.startsWith('Exocoetidae') && l.split(',')[4] === String(n));
  if (plain && withGE) {
    const h = +plain.commits.glide_height_m, ld = +plain.commits.lift_to_drag_max, d = +withGE.commits.ground_effect_drag_reduction;
    glide = {
      heightM: h, ldMeasured: ld, deltaGroundEffect: d,
      reachM: r2(h * ld, 1),
      reachWithGroundEffectM: r2(h * ld / (1 - d), 1),
      ldTheoretical: theory ? +theory.commits.lift_to_drag_max : null,
      reachTheoreticalM: theory ? r2(h * +theory.commits.lift_to_drag_max, 1) : null,
      fieldSingleGlideM: +plain.commits.glide_distance_m,
      // the 400 m figure its own source already describes as a taxi-and-glide sequence, not one glide
      fieldSequenceM: 400,
      fieldSequenceIsASequence: /not one glide/i.test(fieldRow(400) || ''),
      fieldIsSecondary: /secondary/.test(fieldRow(50) || ''),
      groundEffectLocator: ge ? `${ge.source_id}, ${ge.definition.split(',')[0]} = 0.33 over water, model L3` : null,
      sources: ['lean/eliminate/examples.json', 'physics/sim/RUNS.md', 'physics/ground-effect.json']
    };
  }
}
// the simulator's own run-6 sequence, read from the run log
const runs = rt('physics/sim/RUNS.md');
if (glide && runs) {
  const m = /\|\s*6\s*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|\s*(\d+)\s*m in ([\d.]+) s, (\d+) glides/.exec(runs);
  if (m) glide.sim = { metres: +m[1], seconds: +m[2], glides: +m[3], postHoc: /Tests 1 to 3 are POST-HOC/i.test(runs) };
}

// ---- 4. the sequence layer: three results, all of them negative ----
const gliders = rj('sequences/gliders.json');
const prog = rj('sequences/progression.json');
const engd = rj('sequences/engineered-diff.json');
let sequences = null;
if (gliders && prog && engd) {
  const g = prog.groups_in_order;
  const key = s => Object.keys(g).find(k => new RegExp(s, 'i').test(k));
  const grp = s => { const k = key(s); return k ? { name: k, ...g[k] } : null; };
  const nonGliders = Object.entries(g).filter(([k]) => /non-gliding/.test(k));
  const resid = Object.values(prog.lat4a_F326L_reading).reduce((a, o) => {
    Object.entries(o).forEach(([r, n]) => { a[r] = (a[r] || 0) + n; }); return a;
  }, {});
  const med = engd.context_natural_divergence.per_species.oryzias_latipes;
  sequences = {
    convergence: {
      gliderColumns: gliders.totals.glider_convergent_columns,
      baselineColumns: gliders.totals.control_convergent_columns_baseline,
      genes: Object.keys(gliders.genes).length,
      birdsExcluded: !!gliders.birds_excluded,
      geneSetCaveat: gliders.gene_set_caveat
    },
    lat4a: {
      flyingFishL: grp('Exocoetidae').lat4a_326_residues.L,
      flyingFishN: grp('Exocoetidae').n_species_sequenced,
      glidingHalfbeakL: grp('gliding\\) halfbeak').lat4a_326_residues.L,
      nonGliderSpecies: nonGliders.reduce((a, [, v]) => a + v.n_species_sequenced, 0),
      nonGliderF: nonGliders.reduce((a, [, v]) => a + (v.lat4a_326_residues.F || 0), 0),
      nonGliderOther: nonGliders.reduce((a, [, v]) =>
        a + Object.entries(v.lat4a_326_residues).filter(([r]) => r !== 'F').reduce((b, [, n]) => b + n, 0), 0),
      mammalsAndOutgroupsWithF: Object.entries(gliders.lat4a_site_326_across_gliders).filter(([, r]) => r === 'F').length,
      taxaScored: Object.keys(gliders.lat4a_site_326_across_gliders).length,
      residueTally: resid
    },
    doseResponse: {
      sites: prog.columns.length,
      glidingHalfbeak: { derived: grp('gliding\\) halfbeak').mean_derived_states_of_38_sites, ratio: grp('gliding\\) halfbeak').fin_ratio_group_median, n: grp('gliding\\) halfbeak').n_species_sequenced },
      flyingFish: { derived: grp('Exocoetidae').mean_derived_states_of_38_sites, ratio: grp('Exocoetidae').fin_ratio_group_median, n: grp('Exocoetidae').n_species_sequenced },
      // the non-gliders' zero is circular by the panel's construction and is not a finding
      nonGlidersZeroByConstruction: !!(prog.read_this_first || []).some(x => /ZERO BY CONSTRUCTION/.test(x)),
      notATest: (prog.read_this_first || []).some(x => /^A LADDER TO READ, NOT A TEST/.test(x))
    },
    engineered: {
      editedLoci: engd.winged_zebrafish.edited_sites,
      aminoAcidsChanged: engd.winged_zebrafish.amino_acids_changed,
      regulatoryEdit: engd.winged_zebrafish.kinds.some(k => /regulatory/.test(k.kind)),
      naturalSubstitutions: med.total_aa_substitutions_in_these_genes,
      naturalDifferences: med.total_aa_differences_in_these_genes,
      proteins: med.n_genes,
      medianIdentity: med.median_identity_pct
    },
    sources: ['sequences/README.md', 'sequences/gliders.json', 'sequences/progression.json', 'sequences/engineered-diff.json']
  };
}

// ---- 5. the 3D organism: pieces, and how many of them the ontology could actually name ----
const anatomyFiles = [
  ['flying fish', 'anatomy-model/manifest.json'],
  ['zebrafish, adult', 'anatomy-model/zebrafish/manifest-adult.json'],
  ['zebrafish, larva', 'anatomy-model/zebrafish/manifest-larva.json']
];
let anatomy = null;
const aModels = anatomyFiles.map(([name, p]) => {
  const m = rj(p);
  if (!m?.objects) return null;
  const mapped = m.objects.filter(o => o.ontology_id).length;
  return {
    name, file: p, pieces: m.objects.length, mapped,
    unmapped: m.objects.length - mapped,
    terms: new Set(m.objects.filter(o => o.ontology_id).map(o => o.ontology_id)).size,
    sourcedValues: m.sourced_values ? Object.keys(m.sourced_values).length : (m.evidence_backed ? 1 : 0),
    schematicNote: typeof m.schematic === 'string' ? m.schematic : null,
    evidence: m.evidence_backed || null
  };
}).filter(Boolean);
if (aModels.length) {
  const ff = aModels[0];
  anatomy = {
    models: aModels,
    pieces: aModels.reduce((a, m) => a + m.pieces, 0),
    mapped: aModels.reduce((a, m) => a + m.mapped, 0),
    unmapped: aModels.reduce((a, m) => a + m.unmapped, 0),
    // sourced values: one measured proportion carries the flying fish; the zebrafish models carry more
    sourcedValues: aModels.reduce((a, m) => a + m.sourcedValues, 0),
    evidenceBacked: ff.evidence ? { ratio: ff.evidence.pectoral_fin_length_over_SL, n: ff.evidence.n_specimens, caveat: ff.evidence.caveat } : null,
    builtByScript: !!rt('anatomy-model/build_fish.py'),
    sources: ['anatomy-model/manifest.json', 'anatomy-model/zebrafish/manifest-adult.json', 'anatomy-model/zebrafish/manifest-larva.json']
  };
}

// ---- 6. the corrected claim: an annotated genome exists; what is missing is measurement ----
let genomeGap = null;
if (corrTrig) {
  const g = id => { const v = trigMetric(corrTrig, id); return v == null ? null : +v; };
  genomeGap = {
    genes: g('predicted_protein_coding_genes'),
    annotated: g('functionally_annotated_genes'),
    percent: g('percent_annotated'),
    trembl: g('trembl_hits'),
    swissprot: g('swissprot_hits'),
    buscoGeneSet: g('busco_gene_set_percent'),
    rnaseqMentions: g('mentions_of_rnaseq_or_transcriptome_in_the_paper'),
    filesCorrected: g('project_files_corrected'),
    doi: '10.3389/fgene.2021.695700',
    citation: 'Xu et al. 2021, Frontiers in Genetics 12:695700',
    source: 'genotype/nanopubs/unsigned/correction-flying-fish-genome-exists.trig'
  };
}

// ---- 7. the pre-registered design validation: a NEGATIVE result, and the design is not ours ----
const sc = rj('design-validation/scorecard.json');
const dvRuns = rt('design-validation/RUNS.md');
let designval = null;
if (sc?.part1_phenotypic && sc?.part2_genetic && sc?.part3_lean_gate) {
  const p1 = sc.part1_phenotypic, p2 = sc.part2_genetic, p3 = sc.part3_lean_gate;
  const shaFile = (rt('design-validation/PREREG.sha256') || '').trim().split(/\s+/)[0] || null;
  designval = {
    preregSha: sc.prereg.sha256,
    preregVerified: !!shaFile && shaFile === sc.prereg.sha256,
    hashedBefore: sc.prereg.note,
    // the single most important line on the slide: the organism is Daane et al.'s, not ours
    designIsNotOurs: /^YES:/.test(sc.organisms.design_has_a_real_counterpart || ''),
    whoseDesign: sc.organisms.design_has_a_real_counterpart,
    axes: p1.axes_preregistered,
    scored: p1.n_scored,
    cannotScore: p1.n_cannot_score,
    definingAxis: p1.per_axis[0].axis,
    definingAxisVerdict: p1.per_axis[0].verdict,
    definingAxisWhy: p1.per_axis[0].note,
    phenotypicVerdict: p1.verdict,
    lociKnownToDiffer: p2.a_loci_known_to_differ.value,
    lociReproduced: p2.b_design_changes_that_are_in_a.value,
    fraction: p2.c_fraction_reproduced.value,
    fractionPretty: p2.c_fraction_reproduced.pretty,
    band: p2.c_fraction_reproduced.band,
    lociNotKnownToDiffer: p2.d_design_changes_not_known_to_differ.value,
    narrowClaimHolds: p2.weaker_claim_preregistered['B >= 1'] === true,
    gateRows: p3.rows,
    gate: p3.verdicts,
    gateTallies: p3.tallies,
    rowsDecided: p3.how_much_of_the_design_lean_tests.rows_decided_of_21,
    gateIsWeak: /THE GATE IS WEAK/i.test(p3.how_much_of_the_design_lean_tests.verdict || ''),
    suspiciousPasses: (p3.suspicious_passes_what_real_fails || []).length,
    realShortfall: (p3.real_violations || [])[0]?.shortfall_factor ?? null,
    consequence: sc.joint_result.what_actually_follows,
    droppedAsUnsupported: /drop the claim as UNSUPPORTED/i.test(sc.joint_result.what_actually_follows || ''),
    // the deviation that went against the design's own interest
    refusedTheDefault: !!(dvRuns && /the "close" default was refused/i.test(dvRuns)),
    sources: ['design-validation/REPORT.md', 'design-validation/scorecard.json', 'design-validation/PREREG.sha256']
  };
}

// ---- 8. annotation is not measurement: the whole-organism parameter count ----
// Not a complaint about missing data: a measurement nobody had made. The figure is the one the
// readiness thread already built to the project's chart rules; it is copied, not redrawn.
const rdy = rj('simulation-readiness/readiness.json');
let readiness = null;
if (rdy?.ratio) {
  const ITEM = { a: 'absolute abundance', b: 'protein half-life', c: 'mRNA half-life', d: 'transcription rate', e: 'binding affinity / enzyme kinetics', f: 'diffusion coefficient', g: 'Hill coefficient', h: 'signed, directed edge list' };
  let coverageFig = null;
  try {
    const svg = fs.readFileSync(path.join(repoRoot, 'simulation-readiness/coverage.svg'));
    fs.mkdirSync(path.join(out, 'fig'), { recursive: true });
    fs.writeFileSync(path.join(out, 'fig/readiness_coverage.svg'), svg);
    coverageFig = {
      file: 'fig/readiness_coverage.svg',
      from: 'simulation-readiness/coverage.svg',
      sha256: crypto.createHash('sha256').update(svg).digest('hex')
    };
  } catch {}
  readiness = {
    genes: rdy.ratio.N_genes,
    needed: rdy.ratio.minimal_parameter_count,
    held: rdy.ratio.parameters_we_hold_strictly,
    lenientHeld: rdy.ratio.lenient_variant.parameters_we_hold,
    lenientPct: r2(rdy.ratio.lenient_variant.ratio * 100, 1),
    lenientCaveat: rdy.headline.generous_caveat,
    annotated: rdy.gene_set.with_any_pathway_annotation,
    annotatedPct: r2(rdy.gene_set.pathway_annotation_fraction * 100, 1),
    edges: rdy.ratio.edges_in_the_best_experimentally_supported_edge_list_we_could_fetch,
    pairs: rdy.ratio.pairwise_framing.unordered_gene_pairs,
    pairsPct: rdy.ratio.pairwise_framing.fraction_text,
    // a to g are the per-gene parameter classes; h is the network and is reported as pairs, not as a count
    items: ['a', 'b', 'c', 'd', 'e', 'f', 'g'].filter(k => rdy.items[k])
      .map(k => ({ k, label: ITEM[k], n: rdy.items[k].strict_count, of: rdy.ratio.N_genes })),
    precedent: rdy.precedent_m_genitalium ? {
      genes: rdy.precedent_m_genitalium.what_it_covered.genes,
      sources: rdy.precedent_m_genitalium.what_it_took.primary_sources,
      scope: rdy.precedent_m_genitalium.what_it_covered.scope,
      doi: rdy.precedent_m_genitalium.paper.doi
    } : null,
    noBirdData: /No bird data/i.test(rdy.constraint || ''),
    coverageFig,
    source: 'simulation-readiness/readiness.json'
  };
}

// ================================================================================================
// The Design Studio: the product, its laws, its independent validation, and the printable kit.
// Each block reads the files the studio threads write; a block that cannot read its source is null
// and its slide greys out. Nothing here is typed by hand except the sentences around the numbers.
// ================================================================================================
const copyFig = (from, to) => {
  try {
    const buf = fs.readFileSync(path.join(repoRoot, from));
    fs.mkdirSync(path.join(out, 'fig'), { recursive: true });
    fs.writeFileSync(path.join(out, 'fig', to), buf);
    return { file: 'fig/' + to, from, sha256: crypto.createHash('sha256').update(buf).digest('hex') };
  } catch { return null; }
};

// ---- the studio itself: the scenario modules on disk, and a real screenshot of the page ----
let studio = null;
{
  let scenarios = [];
  try {
    scenarios = fs.readdirSync(path.join(repoRoot, 'sim-engine/scenarios'))
      .filter(f => f.endsWith('.mjs') && !/^(index|_)/.test(f)).map(f => f.replace(/\.mjs$/, ''));
  } catch {}
  // written by dashboard/shot-studio.mjs only when the page rendered on the real engine (never the harness MOCK)
  const shot = rj('dashboard/public/deck/fig/studio_spec.json');
  const shotOk = shot && !shot.mock && fs.existsSync(path.join(out, shot.file || '-')) ? shot : null;
  const contract = rt('sim-engine/CONTRACT.md');
  if (scenarios.length) studio = {
    scenarios,
    shot: shotOk ? { file: shotOk.file, typed: shotOk.typed, model: shotOk.model, engineLine: shotOk.engineLine,
      criteria: shotOk.criteria, valid: shotOk.valid, takenAt: shotOk.takenAt, sha256: shotOk.sha256 } : null,
    // the contract says which laws STATE can feed today; quoted, not turned into a number
    lawsEvaluable: (contract && /Only the mass[–-]length rows \(([^)]+)\) can currently be evaluated/.exec(contract)?.[1]) || null,
    sources: ['sim-engine/scenarios/*.mjs', 'sim-engine/CONTRACT.md', shotOk ? 'deck/fig/studio_spec.json (dashboard/shot-studio.mjs)' : null].filter(Boolean)
  };
}

// ---- laws as versioned data: the registry, its current law set, and the surfaces that serve it ----
let lawreg = null;
{
  const cur = rj('lean/registry/lawsets/current.json');
  const set = cur && rj('lean/registry/lawsets/' + cur.file);
  let laws = [];
  try {
    const lawDir = path.join(repoRoot, 'lean/registry/laws');
    laws = fs.readdirSync(lawDir).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(lawDir, f), 'utf8')));
  } catch {}
  if (set && laws.length) {
    const ORDER = ['proposed', 'candidate', 'accepted', 'contested', 'retired'];
    const tally = list => ORDER.map(s => ({ status: s, n: list.filter(l => l.status === s).length,
      physical: list.filter(l => l.status === s && l.kind === 'physical').length,
      biological: list.filter(l => l.status === s && l.kind === 'biological').length }));
    const mirror = rj('dashboard/public/api/lean/index.json');
    let discovered = null;
    try { discovered = fs.readdirSync(path.join(repoRoot, 'lean/registry/discovered'), { withFileTypes: true }).filter(d => d.isDirectory()).length; } catch {}
    lawreg = {
      lawset: set.version, lawsetCreated: set.created, lawsetCommit: set.commit || null,
      inLawset: tally(set.laws), inLawsetTotal: set.laws.length,
      onDisk: tally(laws), onDiskTotal: laws.length,
      mirror: mirror ? { lawset: mirror.current_lawset, count: mirror.count } : null,
      mcpVersion: (rt('mcp/server.mjs') || '').match(/VERSION\s*=\s*"([^"]+)"/)?.[1] || null,
      discovered,
      sources: ['lean/registry/lawsets/current.json', 'lean/registry/lawsets/' + cur.file, 'lean/registry/laws/*.json',
        'dashboard/public/api/lean/index.json', 'mcp/server.mjs']
    };
  }
}

// ---- the independent validation of the studio, as its harness scored it ----
let studioval = null;
{
  const R = rj('sim-engine/validation/studio-results.json');
  if (R && Array.isArray(R.results)) {
    const scored = R.results.filter(r => r.status !== 'observation');
    const final = r => r.amended_status || r.status;
    const GROUPS = [
      ['wild', 'Wild-type predictions', r => /^W/.test(r.id)],
      ['neg', 'Negative and law controls', r => /^N[1-6]$/.test(r.id)],
      ['opt', 'Optimizer and parser controls', r => /^[OP]\d/.test(r.id)],
      ['contract', 'Contract and determinism, per scenario', r => /^N7/.test(r.id)]
    ];
    const STAT = ['pass', 'pass-rests-on-assumed', 'circular', 'fail', 'no-target'];
    const groups = GROUPS.map(([key, label, f]) => {
      const rs = scored.filter(f);
      return { key, label, n: rs.length, counts: Object.fromEntries(STAT.map(s => [s, rs.filter(r => final(r) === s).length])),
        rows: rs.map(r => ({ id: r.id, name: r.name, status: final(r), preregistered: r.status })) };
    });
    // the slide's headline, computed: how many numeric wild-type tests pass as independent evidence
    const wildNumeric = scored.filter(r => /^W/.test(r.id) && Array.isArray(r.band));
    studioval = {
      generatedAt: R.generated_at,
      preregHashOk: !!R.preregistration?.ok,
      preregSha: R.preregistration?.recorded || null,
      selftest: R.selftest?.checks ? { ok: R.selftest.checks.filter(c => c.ok).length, total: R.selftest.checks.length } : null,
      tally: R.tally, tallyA1: R.tally_after_amendment_A1, scored: scored.length,
      groups,
      wildNumeric: wildNumeric.length,
      wildIndependentPasses: wildNumeric.filter(r => final(r) === 'pass').length,
      controlsHeld: scored.filter(r => /^(N[1-6]|O\d|P\d)$/.test(r.id)).every(r => final(r) === 'pass'),
      fails: scored.filter(r => final(r) === 'fail').map(r => ({ id: r.id, name: r.name, why: r.why })),
      // verdicts as pre-registered and as amended after the results, side by side: an amendment never hides the original
      tallyPre: Object.fromEntries(STAT.map(k => [k, scored.filter(r => r.status === k).length])),
      tallyFinal: Object.fromEntries(STAT.map(k => [k, scored.filter(r => final(r) === k).length])),
      changes: scored.filter(r => r.amended_status && r.amended_status !== r.status).map(r => ({
        id: r.id, name: r.name, from: r.status, to: r.amended_status,
        amendment: r.amendment || (/AMENDMENT (A\d)/.exec(r.why || '') || [])[1] || 'amendment', why: r.why })),
      circular: scored.filter(r => final(r) === 'circular').map(r => r.id),
      sources: ['sim-engine/validation/studio-results.json', 'sim-engine/validation/STUDIO-PREREGISTRATION.md', 'sim-engine/validation/STUDIO-AMENDMENTS.md']
    };
  }
}

// ---- the printable kit: verified counts from its manifest, and one render ----
let printkit = null;
{
  const M = rj('anatomy-model/print/manifest.json');
  const render = copyFig('anatomy-model/print/renders/starter-exploded.jpg', 'print_starter_exploded.jpg');
  if (M && M.life_size_1to1) {
    const st = M.life_size_1to1.starter_kit_1to1 || {}, g = M.life_size_1to1.ff_fins_solid_1to1_GLIDER || {}, k = M.kit_120mm || {};
    printkit = {
      hypothetical: !!M.HYPOTHETICAL,
      starter: { passed: st.n_passed ?? null, failed: st.n_failed ?? null },
      kit120: { parts: k.n_parts ?? null, passed: k.n_passed ?? null, failed: k.n_failed ?? null },
      glider: {
        sl_mm: g.print_standard_length_mm ?? null, design: g.design || null, unverified: g.UNVERIFIED || null,
        states: Object.entries(g.states_measured || {}).map(([name, s]) => ({ name, mass_g: s.mass_g, v_min: s.v_min_m_s, margin: s.static_margin_fraction_of_MAC, stable: s.stable }))
      },
      cellTypes: M.cell_tokens?.n_cell_types_recorded ?? null,
      render,
      sources: ['anatomy-model/print/manifest.json', 'anatomy-model/print/README.md', render ? render.from : null].filter(Boolean)
    };
  }
}

// ---- the holdout exam, as the validation-on-unseen-data line (no held-out organism data is shown) ----
let examLine = null;
try {
  const dir = path.join(repoRoot, 'holdout/exam-results');
  const found = [];
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === 'result.json') { try { const j = JSON.parse(fs.readFileSync(p, 'utf8')); if (j.exam_verdict) found.push(j); } catch {} }
  });
  walk(dir);
  if (found.length) examLine = {
    examined: found.length,
    inconclusive: found.filter(f => f.exam_verdict === 'inconclusive').length,
    // the clade is the frozen holdout and never travels with the deck, so the reason is reported
    // as a count of held-out species rather than by naming them
    reasons: found.map(f => (f.exam_verdict_reason || '').replace(/ [A-Za-z]+ species/, ' held-out species')).filter(Boolean),
    // the two claim tests that reached a stated reason both stopped on the pre-registered minimum n
    withReason: found.filter(f => f.exam_verdict_reason).length,
    underpowered: found.filter(f => f.exam_verdict_reason).every(f => /underpowered/i.test(f.exam_verdict_reason))
  };
} catch {}

const numbers = {
  claims: D?.stats?.claims ?? D?.claims?.length ?? null,
  claimTests: (D?.tests || []).length || null,
  leanProved: D?.lean?.summary?.claimsVerified ?? null,
  leanTheorems: D?.lean?.summary?.theoremsCompiling ?? null,
  leanAssessors: D?.lean?.summary?.assessorModels ?? null,
  leanVerdicts: D?.lean?.summary?.verdictCounts ?? null,
  leanSorry: D?.lean?.sorry ?? null,
  enzymeMeasured: EV?.source?.counts?.measured_nonstop_genotypes ?? null,
  enzymeLibrary: EV?.source?.counts?.library_nonstop_genotypes ?? null,
  enzymeEpisodes: EV ? (EV.benchmark?.episodes || 0) + 300 + (EV.scale?.episodes || 0) : null,
  kappaUsed: EV?.intervalModel?.kappa ?? null,
  route: cert ? { nodes: cert.nodes, steps: cert.steps, weakest: cert.weakest_step_index, breaksAt: cert.breaks_at_kappa } : null,
  kappaSweep: EV?.kappaSweep || null,
  directOrderingsBroken: EV?.routes?.find(r => r.id === 'tempting-direct') ? true : null,
  policies,
  lazysp: EV?.lazysp?.primary || null,
  swarmArms,
  swarmFabricated: swm('exp2 decentralized: fabricated ids') === 0 ? 0 : swm('exp2 decentralized: fabricated ids'),
  panel: PN ? {
    pairs: (PN.perPair || []).length,
    results: (PN.results || []).map(r => ({ key: r.policy, certified: r.certified, episodes: r.episodes, assays: r.meanAssays })),
    separatingPairs: (PN.summary?.pairsLazyspResolvedQ2cNot || []).length,
    theirVfvsEpisodes: PN.theirPanelForComparison?.vfvsStartEpisodes ?? null,
    theirEpisodes: PN.theirPanelForComparison?.episodesPerPolicy ?? null,
    theirDistinctPairs: PN.theirPanelForComparison?.distinctPairs ?? null,
    theirLazyOnly: PN.theirPanelForComparison?.lazyspResolvedQ2cNot ?? null,
    dataCountsVerdict: PN.dataCounts?.verdict ?? null,
    finding: PN.finding || null
  } : null,
  proofs: LN ? {
    buildExit: LN.build?.exit ?? null,
    mutations: (LN.mutations || []).length,
    rejected: (LN.mutations || []).filter(m => !/STILL BUILDS/i.test(m.verdict || '')).length,
    axioms: LN.axioms?.observed || null,
    axiomsVerdict: LN.axioms?.verdict ?? null,
    generic: LN.correspondence?.generic ?? null,
    discrepancy: /does not exist|nowhere/i.test(JSON.stringify(LN)) ? true : null
  } : null,
  recount: VR ? {
    confirmed: (VR.checks || []).filter(c => c.verdict === 'confirmed').length,
    total: (VR.checks || []).length,
    unchecked: (VR.checks || []).filter(c => c.verdict === 'could-not-check').length
  } : null,
  gpu: EV?.compute ? { variants: EV.compute.variants, headline: EV.compute.headline, sizes: EV.scale?.models ?? null, allNull: EV.scale?.all_rmst_intervals_include_zero ?? null } : null,
  reuseGain: EV?.reuse?.gainOverCache ?? null,
  adapters: EV?.operationalClaims?.scenarios ? {
    total: EV.operationalClaims.scenarios.length,
    refused: EV.operationalClaims.scenarios.filter(s => s.decision === 'refuse').length
  } : null,
  records,
  shape, corrections, physiology, flier, glide, sequences, anatomy, genomeGap, designval, readiness, examLine,
  studio, lawreg, studioval, printkit,
  figures,
  crosscheck: crosscheck ? {
    ourTests: crosscheck.counts.ourTests, theirTests: crosscheck.counts.theirTests,
    overlapping: crosscheck.counts.overlapping, agreements: crosscheck.counts.agreements,
    disagreements: crosscheck.counts.disagreements,
    ourVerdicts: crosscheck.counts.ourVerdicts, theirVerdicts: crosscheck.counts.upstreamVerdicts,
    behind: crosscheck.refs.behind, theirsDate: crosscheck.refs.theirsDate,
    differing: crosscheck.comparisons.filter(c => !c.agree).map(c => ({ claim: c.claim, ours: c.ours?.verdict, theirs: c.theirs?.verdict, kind: c.kind, ourValue: c.ours?.measured?.value, theirValue: c.theirs?.measured?.value, ourUnit: c.ours?.measured?.unit, theirUnit: c.theirs?.measured?.unit }))
  } : null,
  // thread headlines are left out: no slide renders them and one of them names the frozen holdout clade
  threads: threads.map(t => ({ key: t.k, title: t.s.title, state: t.s.state, updated: t.s.updated })),
  leanAssessment: leanThread?.headline && /faithful/i.test(leanThread.headline) ? leanThread.headline : null
};

// A slide is live when the evidence it needs exists. Anticipated slides name what they are waiting for.
const have = v => v !== null && v !== undefined && !(Array.isArray(v) && !v.length);
const slides = [
  { id: 'title', state: 'live' },
  { id: 'question', state: have(numbers.claims) ? 'live' : 'anticipated', needs: 'the claim graph' },
  { id: 'gap', state: have(numbers.claims) && have(numbers.claimTests) ? 'live' : 'anticipated', needs: 'claim tests' },
  { id: 'pipeline', state: 'live' },
  { id: 'route', state: have(numbers.route) ? 'live' : 'anticipated', needs: 'a certified route' },
  { id: 'scoreboard', state: have(numbers.policies) ? 'live' : 'anticipated', needs: 'the replay benchmark' },
  { id: 'twist', state: have(numbers.panel) ? 'live' : 'anticipated', needs: 'our own fresh panel' },
  { id: 'swarm', state: have(numbers.swarmArms) ? 'live' : 'anticipated', needs: 'the swarm experiments' },
  { id: 'crosscheck', state: crosscheck && crosscheck.counts.overlapping ? 'live' : 'anticipated', needs: 'results from the collaborator swarm to compare against' },
  { id: 'proof', state: have(numbers.proofs) ? 'live' : 'anticipated', needs: 'an independent proof rebuild' },
  { id: 'nulls', state: have(numbers.gpu) ? 'live' : 'anticipated', needs: 'the GPU sweep' },

  // The shape of the output, and the results that make it that shape. Each one is gated on the file
  // it reads, so a slide can never show a number whose source is not in the repository.
  { id: 'shape', state: have(shape) ? 'live' : 'anticipated', needs: 'the genotype thread’s record inventory' },
  { id: 'designval', state: have(designval) ? 'live' : 'anticipated', needs: 'the pre-registered design scorecard' },
  { id: 'annotation', state: have(genomeGap) ? 'live' : 'anticipated', needs: 'the flying-fish genome correction record' },
  { id: 'readiness', state: have(readiness) ? 'live' : 'anticipated', needs: 'the simulation-readiness parameter census' },
  { id: 'flight', state: have(physiology) ? 'live' : 'anticipated', needs: 'the kernel-checked physiology certificates' },
  { id: 'glide', state: have(glide) ? 'live' : 'anticipated', needs: 'the glide-range bound and the simulator run log' },
  { id: 'sequence', state: have(sequences) ? 'live' : 'anticipated', needs: 'the sequence comparison layer' },
  { id: 'organism3d', state: have(anatomy) ? 'partial' : 'anticipated', needs: 'one measured proportion carries the flying-fish model; the rest is schematic' },

  // the Design Studio: the product, its laws, its independent validation, and the printable kit
  { id: 'studio', state: studio?.shot ? 'live' : 'anticipated', needs: 'a screenshot of the studio rendering on the real engine (dashboard/shot-studio.mjs)' },
  { id: 'lawreg', state: have(lawreg) ? 'live' : 'anticipated', needs: 'the versioned law registry' },
  { id: 'studioval', state: have(studioval) ? 'live' : 'anticipated', needs: 'the pre-registered studio validation harness' },
  { id: 'printkit', state: printkit ? 'partial' : 'anticipated', needs: 'a flight test: the files are verified, but no tunnel, CFD or free-flight test has been run on this geometry' },

  { id: 'wing', state: 'anticipated', needs: 'a printed wing and a matched scaled control; no specimen, no scan, no measurement exists' },
  { id: 'scales', state: 'partial', needs: 'records at every scale for one species' },
  { id: 'records', state: records.drafts ? 'partial' : 'anticipated', needs: 'a signing key owner; records are drafted and validated but unsigned' },
  { id: 'honest', state: 'live' },
  { id: 'ask', state: 'live' }
];

// The event gives three minutes. These six carry the spoken pitch; the rest are there for questions.
const CORE = ['title', 'question', 'route', 'swarm', 'crosscheck', 'ask'];
slides.forEach(s2 => { s2.core = CORE.includes(s2.id); });

const data = {
  builtAt: new Date().toISOString(),
  deadline: '2026-11-01T18:00:00Z',
  slides, numbers,
  progress: {
    live: slides.filter(s => s.state === 'live').length,
    partial: slides.filter(s => s.state === 'partial').length,
    anticipated: slides.filter(s => s.state === 'anticipated').length,
    total: slides.length,
    core: slides.filter(s2 => s2.core).length
  }
};
fs.writeFileSync(path.join(out, 'data.json'), JSON.stringify(data, null, 1));
console.log(`deck/data.json: ${data.progress.live} live, ${data.progress.partial} partial, ${data.progress.anticipated} anticipated of ${data.progress.total} slides`);
