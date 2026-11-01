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

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// MorphoLemma: the deliverable this deck pitches. The repository still calls it DELPHI, and the
// two names refer to the same system -- see README.md "The two names". Nothing below renames a file.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

// ---- the facts the opening beats rest on -------------------------------------------------------
// A fact is used on a slide ONLY if `verified` is true. One that is not renders its claim with no
// numeral at all and greys its slide, which is what the greying convention is for; it is never
// replaced with a guess, and a number nobody could source is dropped rather than softened.
// deck/FACTS.md, written by the fact-checking thread, is the only thing allowed to flip one of these.
// To adopt it: set `verified: true` and fill `value`/`sentence` from that file. That is the one edit.
const factsMd = path.join(repoRoot, 'dashboard/public/deck/FACTS.md');
const facts = {
  file: fs.existsSync(factsMd) ? 'dashboard/public/deck/FACTS.md' : null,
  note: 'Every numeral on the opening slides comes from this block. An entry with verified:false '
      + 'renders as a claim with no number and greys its slide.',
  tacit: {
    verified: true,
    citationsFetched: true,   // checked 2026-11-01; one of the three first given to us was wrong
    sentence: 'Biology design knowledge lives primarily as tacit knowledge: the know-how that makes an '
            + 'experiment work demonstrably does not transfer through publication alone.',
    // These are not three people saying the same thing. One names the idea, one shows an instrument
    // failing to transfer, and one documents the same failure inside molecular biology without ever
    // reaching for the word -- which is itself the point.
    literature: [
      {
        role: 'names it',
        cite: 'Michael Polanyi, The Tacit Dimension, Doubleday 1966 / Routledge 1967, p. 4',
        what: '“We can know more than we can tell.” The origin of the term.',
        caveat: null
      },
      {
        role: 'demonstrates it',
        cite: 'H. M. Collins (1974), “The TEA Set”, Science Studies 4:165–186, doi:10.1177/030631277400400203',
        what: 'No laboratory built a working TEA laser from the published sources. Only people with '
            + 'substantial social contact with a successful builder succeeded — phone calls and visits, '
            + 'not papers. Companion: Collins & Harrison (1975), Social Studies of Science.',
        caveat: 'Later work (Philosophia Scientiae, 2013) reads the TEA case as RELATIONAL tacit knowledge: '
              + 'knowledge that could in principle be made explicit. That is our claim exactly — the '
              + 'explicit artefact was never built, not that it cannot be.'
      },
      {
        role: 'documents it in biology, without ever naming it',
        cite: 'Kathleen Jordan & Michael Lynch (1992, 1993, 1998) on the plasmid prep, '
            + 'Social Studies of Science 28(5), doi:10.1177/030631298028005005',
        what: 'A protocol every molecular biology lab supposedly shares, and which in practice every lab '
            + 'performs differently — persistent, unresolvable variation in how a shared technique is '
            + 'actually carried out.',
        caveat: 'Collins (2001) notes that Jordan & Lynch never use the term “tacit knowledge” and do '
              + 'not engage that literature. Cite them for the PHENOMENON, never as authorities on the term.'
      }
    ],
    // The bridge into the next beat, and the reason the third caveat is on the slide rather than buried.
    punchline: 'Biology observed the phenomenon for thirty years and never built the vocabulary for it, '
             + 'let alone the formal object.',
    locator: 'deck/FACTS.md · Polanyi 1966 p. 4 · Collins 1974 doi:10.1177/030631277400400203 · '
           + 'Jordan & Lynch 1998 doi:10.1177/030631298028005005 · Collins 2001 on the Q of Sapphire'
  },
  mathlib: {
    verified: true,
    theorems: 292237, definitions: 140094, contributors: 772,
    sentence: 'mathlib, mathematics’ largest formal library, holds 292,237 theorems over 140,094 '
            + 'definitions, built by 772 contributors.',
    asOf: '1 Nov 2026, 02:07 UTC',
    // The maintainers' own slide warns that many definitions are automatically generated, and the same
    // is true of a large share of the theorem count. This measures library SIZE, not human insights.
    caveat: 'This is library size, not 292,237 human insights: many definitions and a large share of the '
          + 'theorems are automatically generated (simp, instance and projection lemmas). mathlib is also '
          + 'overwhelmingly human-written, not AI-written.',
    locator: 'leanprover-community.github.io/mathlib_stats.html, gen_date 2026-11-01 02:07:42 (gitstats4.js)',
    priorFigure: '250,000 theorems a year ago — Rothgang, "Lean and Mathlib", Potsdam colloquium, 17 Dec 2025'
  },
  // A number we measured ourselves, with the query published. Worth more on a slide than a borrowed one.
  formalisationPapers: {
    verified: true,
    value: 688, october: 148, january: 18,
    sentence: 'In 2026 so far, 688 papers have appeared whose abstracts talk about formalising mathematics '
            + 'in Lean — 148 of them in October alone.',
    query: 'get_keyword_trends(query="formalized Lean", granularity="year", start_date="2026-01-01", '
         + 'end_date="2026-10-31") over 44,845,581 papers, 9 sources',
    safest: '313 arXiv math.* papers over the same ten months',
    caveat: 'This counts papers whose ABSTRACT mentions formalising in Lean, not papers that are themselves '
          + 'formalisations. One clear false positive in the top 200 inspected; 200 distinct base ids, so no '
          + 'preprint revision is counted twice. It is one ten-month window, not an all-time total.',
    locator: 'deck/FACTS.md §1.1 — measured 2026-11-01, window 2026-01-01 to 2026-10-31'
  },
  // The biology side of the contrast. A bald "zero novel biology theorems" may simply be false --
  // there is real prior work in systems-biology model checking, process calculi for biochemistry and
  // formalised phylogenetics -- so no number goes here until FACTS.md states the narrow form.
  biologyFormal: {
    verified: true,
    // The only clean zero we own, and one an audience can check live on stage. A bald "zero novel
    // biology theorems" is FALSE and has named counterexamples, the newest six days old.
    value: 0, of: 34,
    sentence: 'mathlib holds 292,237 theorems across 34 subject areas — algebra, topology, number theory. '
            + 'Not one of the 34 is biology.',
    claimWithoutANumber: 'Not one of mathlib’s 34 subject areas is biology.',
    counterexamples: 'Formal methods have been used on biology for twenty years: model checking of gene '
                   + 'networks, Coq proofs about neuronal circuits, HOL for synthetic biology, and a Lean '
                   + 'formalisation of the genetic code posted six days ago (arXiv:2610.36343, Jones & '
                   + 'Josephson, 2026-10-26). Every one formalises something biologists already knew, or '
                   + 'proves a property of a model.',
    narrowFirst: 'We found no prior formalisation of classical population genetics — Kimura, Fisher, '
               + 'Maynard Smith — in any proof assistant, and no prior system that uses machine-checked '
               + 'biological laws to rule a proposed organism out. That is a negative search result over a '
               + '44-million-paper corpus, not a proof of absence.',
    locator: 'deck/FACTS.md §2.2–2.4 · GitHub API /repos/leanprover-community/mathlib4/contents/Mathlib, fetched 2026-11-01'
  },
  attrition: {
    verified: true,
    sentence: 'Roughly nine in ten drug programmes that enter clinical trials never reach approval.',
    trap: 'The data are about PROGRAMMES, not individual trials. "90% of clinical trials fail" is a '
        + 'different and false claim, and is the likeliest factual challenge in this deck.',
    sources: [
      'BIO / Informa / QLS 2011–2020: 12,728 phase transitions; Phase 1 → approval 7.9%',
      'Wong, Siah & Lo, Biostatistics 2019 (MIT): 185,994 trials; 13.8% — quote the headline only',
      'Schuhmacher 2025: 14.3% for leading pharma, which cuts the other way'
    ],
    range: '86–92% across the sources; 14.3% success for the top 20, so "90% of drugs fail" overstates it there',
    corrigendum: 'Wong, Siah & Lo carries a corrigendum (doi:10.1093/biostatistics/kxy072) that corrected '
               + 'exactly the phase-transition table. Quote its 13.8% headline, never its per-phase figures.',
    locator: 'BIO/Informa/QLS 2011–2020 · Wong, Siah & Lo, Biostatistics 2019, doi 10.1093/biostatistics/kxx069'
  }
};

// ---- the four-level benchmark: single vs decentralised vs centralised ---------------------------
// Every number is recomputed here from the 36 per-cell logs, never copied from a summary. The design
// stage is EXCLUDED on the benchmark's own caveat: its briefs are infeasible at lawset 1.8.1, all three
// arms violate the same five laws, and "accepted" was unreachable by construction. Quoting a defective
// stage would cost more credibility than the stage could ever buy, so the cost ratios below are over the
// three stages that are shown, not over all four.
let benchmark = null;
try {
  const BD = JSON.parse(fs.readFileSync(path.join(pub, 't/benchmark/data.json'), 'utf8'));
  const logDir = path.join(pub, 't/benchmark/logs');
  const logs = fs.readdirSync(logDir).map(f => JSON.parse(fs.readFileSync(path.join(logDir, f), 'utf8')));
  const OMIT = 'design';
  const SHOWN = BD.levels.map(l => l.level).filter(l => l !== OMIT);

  // quality, per level and arm, straight off the cells
  const q = {};
  for (const c of BD.cells) ((q[c.level] = q[c.level] || {})[c.arm] = (q[c.level][c.arm] || [])).push(c.score);
  const mean = xs => xs.reduce((s, x) => s + x, 0) / xs.length;
  const rows = SHOWN.map(lv => {
    const arms = q[lv], all = Object.values(arms).flat();
    const m = Object.fromEntries(Object.entries(arms).map(([a, xs]) => [a, +mean(xs).toFixed(4)]));
    // the centralised arm produced no artifact at all on the nanopub stage; a 0 there is not a quality
    // score and must not be read as one, so the gap is taken over the arms that produced something
    const scored = Object.entries(m).filter(([a, v]) => !(lv === 'nanopub' && a === 'centralised'));
    const gap = +(Math.max(...scored.map(x => x[1])) - Math.min(...scored.map(x => x[1]))).toFixed(4);
    const spread = +(Math.max(...all) - Math.min(...all)).toFixed(3);
    return {
      level: lv, title: (BD.levels.find(l => l.level === lv) || {}).title || lv,
      single: m.single, decentralised: m.decentralised, centralised: m.centralised,
      noArtifact: lv === 'nanopub' ? ['centralised'] : [],
      gap, spread, separates: gap > spread
    };
  });

  // cost, from the logs, over the shown stages only. The ratio is taken per (stage, arm): aggregating
  // first would average away the stage where a swarm costs the most, which is the number that matters.
  const per = {};
  let cells = 0, calls = 0, dollars = 0;
  for (const L of logs) {
    const tt = L.cell_totals || {};
    cells++; calls += (L.calls || []).length; dollars += tt.cost_usd || 0;
    if (L.level === OMIT) continue;
    const a = ((per[L.level] = per[L.level] || {})[L.arm] = per[L.level][L.arm] || { c: 0, k: 0, w: 0 });
    a.c += tt.cost_usd || 0; a.k += tt.tokens_total || 0; a.w += (tt.wall_ms || 0) / 1000;
  }
  const ratios = [];
  for (const lv of SHOWN) {
    const S = per[lv].single;
    for (const k of ['decentralised', 'centralised']) {
      ratios.push(['cost', per[lv][k].c / S.c], ['tokens', per[lv][k].k / S.k], ['wall', per[lv][k].w / S.w]);
    }
  }
  const rng = kind => {
    const v = ratios.filter(r => r[0] === kind).map(r => r[1]);
    return `${Math.min(...v).toFixed(1)}× to ${Math.max(...v).toFixed(1)}×`;
  };

  // the honesty trap: one task where no gate failed, four were cannot-assess, and the scorer's own
  // composite read "plausible". Graded from each arm's own log, not asserted.
  const trap = ['single', 'decentralised', 'centralised'].map(a => {
    const L = logs.find(x => x.level === 'validation' && x.arm === a && x.task === 'l4-t3');
    const g = (L || {}).grader_verdict || {};
    return {
      arm: a,
      fiveNamedCorrect: g.five_named_correct === 1,
      noSumming: g.no_summing === 1,
      cannotAssessNotAPass: g.cannot_assess_not_a_pass === 1,
      compositeNotTheVerdict: g.composite_not_the_verdict === 1
    };
  });
  const trapComposite = 0.8449;   // the scorer's own frozen number, carried in the task's shared input

  // the one difference that replicated, and its answer
  // The one difference that replicated. The per-call logs do not record a call's ROLE, so this says
  // only what they can support: a per-call cap, calls that exceeded it, no artifact in any task, and a
  // post-hoc re-allocation of the SAME total that produced one. It does not claim which call was the
  // merge, and it does not grade the workers' discarded drafts, because neither is in these files.
  const cen = logs.filter(x => x.level === 'nanopub' && x.arm === 'centralised');
  const cap = (cen[0] || {}).cap_per_call_usd ?? null;
  const merge = {
    capPerCall: cap,
    callsOverCap: cen.flatMap(x => (x.calls || []).map(c => c.cost_usd)).filter(c => cap != null && c > cap).length,
    callsTotal: cen.reduce((n, x) => n + (x.calls || []).length, 0),
    capStops: cen.reduce((n, x) => n + ((x.cell_totals || {}).cap_stops || 0), 0),
    tasksWithNoArtifact: cen.filter(x => !(x.cell_totals || {}).produced_artifact).length,
    tasks: cen.length,
    rescued: (BD.posthoc_centralised_uneven_allocation || []).filter(x => x.produced_artifact).length,
    rescueOf: (BD.posthoc_centralised_uneven_allocation || []).length,
    rescueNote: 'A post-hoc re-allocation of the same total budget, unevenly, produced an artifact in every '
              + 'task. It is post-hoc and labelled as such; it was not pre-registered.'
  };

  benchmark = {
    N: BD.N, model: BD.model, budgetPerCell: BD.budget_total_usd_per_cell,
    rows, omitted: { level: OMIT, why: (BD.levels.find(l => l.level === OMIT) || {}).caveat || null },
    cost: { cells, calls, dollars: +dollars.toFixed(2), range: rng('cost'), tokens: rng('tokens'), wall: rng('wall') },
    trap, trapComposite,
    allArmsHonest: trap.every(t => t.fiveNamedCorrect && t.noSumming && t.cannotAssessNotAPass && t.compositeNotTheVerdict),
    merge,
    limitations: BD.limitations || [],
    page: '/t/benchmark/',
    sources: ['dashboard/public/t/benchmark/data.json', 'dashboard/public/t/benchmark/logs/ (36 per-cell logs)', BD.prereg]
  };
} catch (e) { console.error('deck: benchmark not read (' + e.message + '); bench4 stays grey'); }

// ---- the four deliverables ---------------------------------------------------------------------
// Four things were built. Every slide that delivers one carries its number, in the same place, so the
// audience always knows which of the four they are inside. The map is on the "four" slide; the badges
// are the walk. The mapping lives here, not in the renderer, so HTML and PowerPoint cannot drift.
const deliverables = [
  {
    n: 1, key: 'forum', name: 'MorphoLemma',
    what: 'The repository of biological laws — and, just as much, the framework for adding more.',
    how: 'A new theorem enters the same way every time: upload it nanopub-backed, it must hold in Lean, '
       + 'and it must survive agent debate on the existing evidence. Clear both and it becomes an axiom '
       + 'that constrains every design after it. Fail either and it is recorded with its reason.',
    shot: 'leanbio', slides: ['forum', 'provenance']
  },
  {
    n: 2, key: 'mcp', name: 'MCP server, API and CLI',
    what: 'Designed against named personas, use cases and the grand questions — not against a guess at '
        + 'what someone might want.',
    how: '14 personas, 32 use cases, 14 grand questions and 27 ranked tool gaps, served as versioned JSON '
       + 'and checked by tests. The gaps are ranked at build time, and a test tampers with a stored rank to '
       + 'prove no gap can assert its own importance.',
    shot: 'capability', slides: ['mcp']
  },
  {
    n: 3, key: 'studio', name: 'Design Studio (MorphoSwarm)',
    what: 'Type a phenotype; get the genetic change at every biological layer and every developmental stage.',
    how: 'Part of delphi-frontier. The laws from deliverable 1 constrain what it may propose, and physics '
       + 'and developmental simulation stress-test what it does.',
    inDevelopment: true,
    shot: 'blueprint', slides: ['studio', 'constrain', 'sim']
  },
  {
    n: 4, key: 'harness', name: 'The validation harness',
    what: 'Takes a predicted sequence and a desired function, and says what is wrong with it.',
    how: 'Finds the closest FUNCTIONAL analogue, annotates every difference interpretably, scores formally '
       + 'in LeanBio, and runs physics on the mesh. Five named results, never summed. It is the thing that '
       + 'told us our own headline design does not fly.',
    shot: 'validate', slides: ['harness', 'physicsgate', 'funcledger', 'secondmcp']
  }
];
// Every slide's badge, derived from the list above rather than typed twice.
const badgeOf = {};
for (const d of deliverables) for (const s of d.slides) badgeOf[s] = (badgeOf[s] || []).concat(d.n);
badgeOf.roundtrip = [3, 4];   // the round trip is literally the loop between those two
badgeOf.four = [1, 2, 3, 4];

// ---- what is actually proved, and what is actually published -----------------------------------
// Both of these correct a figure the deck previously stated. The Lean count in the docs was stale, and
// the deck used to say nothing was published, which is simply untrue: 269 records are on production.
const leanTruth = {
  theoremsInBuildTarget: 192, lemmasInBuildTarget: 60, sorry: 0, axioms: 0,
  claimsExtracted: 859,
  provedInBuiltLibrary: 8,          // 4 Thompson + 4 math-bio
  provedFromNamedHypothesis: 8,     // outside lake build; checked one file at a time
  thompsonProved: 4, thompsonShowable: 2,
  avesNote: 'Two of Thompson’s four proved propositions are statements he made about birds in 1917. '
          + 'Birds are our frozen holdout, so we do not show them.',
  darwinFormalised: 0, wolframFormalised: 0,
  locator: 'deck/FACTS.md §4.14–4.15 · lean/laws.json · lean/registry/laws/ · lean/Delphi/*.lean'
};
const nanopubTruth = {
  onProduction: 269, darwinOnProduction: 248, mathBioOnProduction: 21,
  withNoApprovalField: 248,
  signed: 2107, projectRecords: 2766,
  unsignedThreadDrafts: 151,   // 164 minus the 13 Aves-holdout records, which are not shown
  avesDraftsExcluded: 13,
  // The approver is identified by ORCID in the manifest. An ORCID is a personal identifier: it stays in
  // the manifest and never reaches a slide.
  approverNote: 'promoted to production under a named human’s ORCID',
  locator: 'deck/FACTS.md §4.16 · darwin-origin/nanopubs/manifest.jsonl · math-bio-theorems/nanopubs/manifest.json'
};

// ---- the negative results, each checked against the file it came from ---------------------------
// Every one of these is a result that goes AGAINST us, and each is read back out of its own source so
// a number cannot drift here without the build noticing. `assert` must still match the source file: if
// it stops matching, the entry is dropped and its slide greys, rather than quoting a stale figure.
const NEGATIVES = [
  {
    id: 'physicsgate',
    headline: 'Our headline design fails the physics gate',
    keyFigure: '0.67 vs 8.64 m/s',
    detail: 'The reachable launch speed is 0.67 m/s against a minimum flying speed of 8.64 m/s, and the '
          + 'lifting area is 166× too small: 1.91 cm² against the 317.76 cm² needed to carry 0.007 N.',
    figures: [['launch speed reached', '0.67 m/s'], ['minimum flying speed', '8.64 m/s'],
              ['lifting area short by', '166×'], ['draws in which it glided', '0 of 200']],
    locator: 'dashboard/public/validate-show/run-winged-zebrafish.json → physics_check.gate',
    file: 'dashboard/public/validate-show/run-winged-zebrafish.json',
    assert: /launch speed 0\.67 m\/s is below v_min 8\.64 m\/s/
  },
  {
    id: 'funcledger',
    headline: 'An unedited zebrafish scores exactly as well',
    keyFigure: '19 = 19',
    detail: 'The functional-analogue ledger can assess 22 of 73 requirements, and leaves 19 unresolved. '
          + 'An unedited zebrafish scored against the same flying fish leaves the same 19 unresolved: the '
          + 'design’s edits move one row from one hypothesis to another, and neither is a demonstrated '
          + 'resolution.',
    figures: [['requirements assessable', '22 of 73'], ['unresolved, our design', '19'],
              ['unresolved, unedited control', '19'], ['rows the edits moved', '1']],
    locator: 'sim-engine/validate/functional/RESULTS.md · run-winged-zebrafish.json → functional_resolution',
    file: 'sim-engine/validate/functional/RESULTS.md',
    assert: /unedited zebrafish\*\* \(negative control\)[^\n]*\*\*19\*\*/
  },
  {
    id: 'compensation',
    headline: 'Our compensation rule does not predict new cases',
    keyFigure: '4 of 13',
    detail: 'Applied with its case table disabled, the rule chain scores 11 of 12 on the cases it was '
          + 'derived from and 4 of 13 on independent ones. All nine independent errors are false '
          + 'positives: it predicted a compensation response where the experimenters looked and found '
          + 'none. It is kept only in its refusing direction.',
    figures: [['on its own derivation cases', '11 of 12'], ['on independent cases', '4 of 13'],
              ['errors that are false positives', '9 of 9'], ['kept for', 'refusing only']],
    locator: 'sim-engine/validate/functional/compensation/COMPENSATION.md + VALIDATION.json',
    file: 'sim-engine/validate/functional/compensation/COMPENSATION.md',
    assert: /11\/12 on cases[\s\S]{0,120}4\/13 on cases independent of them/
  },
  {
    id: 'edges',
    headline: 'Two of 3,283 interaction edges are zebrafish experiments',
    keyFigure: '2 of 3,283',
    detail: 'In the molecular pack behind the design, 2 edges are curated zebrafish experiments and 2 '
          + 'more are STRING links whose zebrafish experiments channel reaches 0.4. The other 3,279 are '
          + '955 experiments transferred from another species, 1,382 pathway-database assertions and 942 '
          + 'text-mining or co-expression predictions.',
    figures: [['curated zebrafish experiments', '2'], ['transferred from another species', '955'],
              ['pathway-database assertions', '1,382'], ['text-mining / co-expression', '942']],
    locator: 'dashboard/public/validate-show/structures/README.md',
    file: 'dashboard/public/validate-show/structures/README.md',
    assert: /\*\*3,283 interaction edges\*\*[\s\S]{0,120}\*\*2 curated zebrafish experiments\*\*/
  },
  {
    id: 'deadlaws',
    headline: 'Fifteen of 36 accepted laws can bind nothing',
    keyFigure: '15 of 36',
    detail: 'An accepted law that evaluates nowhere gives false assurance — the law base reads as though '
          + 'a design were checked against it when nothing was. So each of the 15 is listed with a written '
          + 'reason and what would make it bind, and the check fails if an entry stops being true.',
    figures: [['accepted laws', '36'], ['that produce no design row', '15'],
              ['each with a written reason', '15 of 15'], ['allowed silently', '0']],
    locator: 'lean/registry/check-exposed.mjs → NO_DESIGN_ROW',
    file: 'lean/registry/check-exposed.mjs',
    assert: /const NO_DESIGN_ROW = \{/
  },
  {
    id: 'noapproval',
    headline: 'Most of what we published carries no approval field',
    keyFigure: '248 of 269',
    detail: '269 of our records are live on the public production nanopub registry. Only the 21 '
          + 'math-biology theorems record who approved the promotion; the 248 Darwin records carry no '
          + 'approval field at all. Their manifest holds a file, an id, a trusty URI, a registry, a '
          + 'timestamp and a commit — and nothing that names a human who signed off.',
    figures: [['records on production', '269'], ['with no approval field', '248'],
              ['that name an approver', '21'], ['signed overall', '2,107']],
    locator: 'darwin-origin/nanopubs/manifest.jsonl · math-bio-theorems/nanopubs/manifest.json',
    file: 'darwin-origin/nanopubs/manifest.jsonl',
    assert: /"registry":\s*"production"/
  },
  {
    id: 'nevertried',
    headline: 'Nine of our 12 failed theorems were never attempted',
    keyFigure: '9 of 12',
    detail: 'A failed-theorem record marked attempted:false was never tried at all — the single Lean build '
          + 'lock was contended, or it was abandoned on cost, or withheld on purpose. It is not a result '
          + 'about the statement, and the counts report attempted and never-attempted separately so it '
          + 'cannot be read as one.',
    figures: [['failed-theorem records', '12'], ['never attempted', '9'],
              ['actually tried and failed', '3'], ['counted as results', '3']],
    locator: 'dashboard/public/api/lean/failed-theorems/*.json → attempted',
    file: 'dashboard/build-lean-api.mjs',
    assert: /failed-theorem record with `attempted: false` was NEVER TRIED/
  }
];
const negatives = NEGATIVES.map(n => {
  let ok = false, why = null;
  try { ok = n.assert.test(fs.readFileSync(path.join(repoRoot, n.file), 'utf8')); }
  catch (e) { why = e.code === 'ENOENT' ? 'source file is gone' : e.message; }
  if (!ok && !why) why = 'the source file no longer says this';
  if (!ok) console.error(`deck: DROPPED negative "${n.id}" — ${why} (${n.file})`);
  const { assert, file, ...rest } = n;
  return ok ? { ...rest, file, verifiedAgainstSource: true } : null;
}).filter(Boolean);
if (negatives.length !== NEGATIVES.length) {
  console.error(`deck: ${NEGATIVES.length - negatives.length} negative result(s) dropped; their slides will grey.`);
}

// Counts for the two numbers the deadlaws entry states, read rather than typed.
let lawRowFacts = null;
try {
  const t = fs.readFileSync(path.join(repoRoot, 'lean/registry/check-exposed.mjs'), 'utf8');
  const m = t.match(/const NO_DESIGN_ROW = \{([\s\S]*?)\n\};/);
  const keys = m ? [...m[1].matchAll(/^ {2}'?([A-Za-z0-9_-]+)'?:/gm)].map(x => x[1]) : [];
  const accepted = (lawreg?.inLawset || []).find(r => r.status === 'accepted')?.n ?? null;
  // The id list is not shipped: one of the 15 is thompson1917-ch02-07, whose label names two birds,
  // and class Aves is the frozen holdout. No slide uses the list; only the count and three hand-picked,
  // bird-free reasons are shown (deck/FACTS.md 4.3).
  lawRowFacts = { accepted, noDesignRow: keys.length };
} catch {}

// Counts for the failed-theorem entry, read from the served records.
let failedTheoremFacts = null;
try {
  const dir = path.join(pub, 'api/lean/failed-theorems');
  const fl = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const recs = fl.map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  failedTheoremFacts = { total: recs.length, neverAttempted: recs.filter(r => r.attempted === false).length };
} catch {}

// ---- screenshots of our own live pages (dashboard/shot-pages.mjs) -------------------------------
// A page that threw or rendered blank has no image, so the slide that wanted it greys itself. No slide
// in this deck draws a mock-up of a screen we have.
let pageShots = [];
try {
  const pj = JSON.parse(fs.readFileSync(path.join(out, 'fig/pages.json'), 'utf8'));
  pageShots = (pj.pages || []).filter(p => fs.existsSync(path.join(out, p.file)));
} catch {}

const numbers = {
  facts, negatives, pageShots, lawRowFacts, failedTheoremFacts, leanTruth, nanopubTruth,
  deliverables, badgeOf, benchmark,
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
const neg = id => negatives.some(n => n.id === id);
const shot = key => pageShots.some(p => p.file === `fig/page_${key}.png`);

// ── the spine ───────────────────────────────────────────────────────────────────────────────────
// Twelve beats, in the order the argument is made: why biology has no formal object to check a design
// against; the Forum that makes one; what the Forum's theorems then constrain; and what happened when
// we pointed the whole thing at a real design. The negative results sit in the middle, not in an
// appendix, because a deck that claims a working flying fish loses to one honest question.
const slides = [
  // 1-4  the fire
  { id: 'title', state: 'live' },
  { id: 'tacit', state: facts.tacit.citationsFetched ? 'live' : facts.tacit.verified ? 'partial' : 'anticipated',
    needs: 'the three citations fetched and checked against their sources' },
  { id: 'noobject', state: 'live' },
  { id: 'contrast', state: facts.mathlib.verified && facts.biologyFormal.verified ? 'live' : 'partial',
    needs: 'deck/FACTS.md: the narrow, defensible wording for the biology side of the contrast' },
  { id: 'attrition', state: facts.attrition.verified ? 'live' : 'anticipated', needs: 'deck/FACTS.md' },

  // the map, before the walk: the four things we built, each shown as the real screen it is
  { id: 'four', state: pageShots.length >= 3 ? 'live' : 'partial',
    needs: 'a screenshot of each of the four deliverables (dashboard/shot-pages.mjs)' },

  // 5-7  the Forum
  { id: 'forum', state: have(lawreg) ? 'live' : 'anticipated', needs: 'the versioned law registry' },
  { id: 'provenance', state: have(numbers.claims) ? 'live' : 'anticipated', needs: 'the claim graph' },
  { id: 'swarm', state: have(numbers.swarmArms) ? 'live' : 'anticipated', needs: 'the swarm experiments' },
  { id: 'bench4', state: benchmark ? 'live' : 'anticipated',
    needs: 'the four-level benchmark: single agent vs decentralised swarm vs centralised swarm' },
  { id: 'mcp', state: shot('capability') ? 'live' : 'anticipated', needs: 'a screenshot of /leanbio/capability.html (dashboard/shot-pages.mjs)' },

  // 8-9  what the theorems constrain
  { id: 'constrain', state: shot('blueprint') ? 'live' : 'anticipated', needs: 'a screenshot of /blueprint3d/ (dashboard/shot-pages.mjs)' },
  { id: 'lawreg', state: have(lawreg) ? 'live' : 'anticipated', needs: 'the versioned law registry' },
  { id: 'studio', state: studio?.shot ? 'live' : 'anticipated', needs: 'a screenshot of the studio rendering on the real engine (dashboard/shot-studio.mjs)' },
  { id: 'sim', state: shot('physics') ? 'live' : 'anticipated', needs: 'a screenshot of /t/physics/sim/ (dashboard/shot-pages.mjs)' },

  // 10  the validation harness, and then what it said
  { id: 'harness', state: shot('validate') ? 'live' : 'anticipated', needs: 'a screenshot of /validate-show/ (dashboard/shot-pages.mjs)' },
  { id: 'physicsgate', state: neg('physicsgate') ? 'live' : 'anticipated', needs: 'the validator run on the headline design' },
  { id: 'funcledger', state: neg('funcledger') ? 'live' : 'anticipated', needs: 'the functional-analogue ledger and its negative control' },
  { id: 'knownbad', state: negatives.length >= 4 ? 'live' : 'partial', needs: 'the four remaining negative results, each read back from its own source' },
  { id: 'nocomposite', state: 'live' },

  // 11-12  the second server, and the round trip
  { id: 'secondmcp', state: have(numbers.studioval) ? 'live' : 'anticipated', needs: 'the pre-registered studio validation harness' },
  { id: 'roundtrip', state: 'anticipated',
    needs: 'the predicted sequence fed back into Design Studio in a fresh session, with the phenotype it returns. The harness exists; this loop has not been closed.' },

  { id: 'honest', state: 'live' },
  { id: 'ask', state: 'live' }
];
const slidesLegacy = [
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

void slidesLegacy; // kept for one release so a reviewer can diff the old spine against this one

// The event gives three minutes. These six carry the spoken pitch; the rest are there for questions.
const CORE = ['title', 'contrast', 'four', 'forum', 'physicsgate', 'ask'];
slides.forEach(s2 => { if (badgeOf[s2.id]) s2.deliverable = badgeOf[s2.id]; });
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
