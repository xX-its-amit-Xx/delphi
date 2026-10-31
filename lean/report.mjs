#!/usr/bin/env node
// Builds the Lean project and writes a machine-readable report for the lean sub-dashboard:
//   node lean/report.mjs            -> dashboard/public/t/lean/lean.json
// Every number on dashboard/public/t/lean/index.html comes from this file, which comes from
// running the Lean compiler. Nothing is typed by hand.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const outDir = path.join(root, 'dashboard/public/t/lean');
fs.mkdirSync(outDir, { recursive: true });

// Find elan/lake. Prefer PATH, then the standard elan home, then the hack box's C:\Temp install.
const candidates = [process.env.ELAN_HOME, path.join(process.env.USERPROFILE || process.env.HOME || '', '.elan'), 'C:/Temp/elan'].filter(Boolean);
let bin = '';
for (const c of candidates) { const d = path.join(c, 'bin'); if (fs.existsSync(path.join(d, process.platform === 'win32' ? 'lake.exe' : 'lake'))) { bin = d; break; } }
const env = { ...process.env, PATH: (bin ? bin + path.delimiter : '') + process.env.PATH };
if (bin && !process.env.ELAN_HOME) env.ELAN_HOME = path.dirname(bin);
const run = (cmd, args) => {
  const t0 = Date.now();
  const r = spawnSync(cmd, args, { cwd: here, env, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024 });
  return { cmd: [cmd, ...args].join(' '), exit: r.status, seconds: +((Date.now() - t0) / 1000).toFixed(1), out: (r.stdout || '') + (r.stderr || '') };
};

const versions = {
  lean: run('lean', ['--version']).out.trim(),
  toolchain: fs.readFileSync(path.join(here, 'lean-toolchain'), 'utf8').trim(),
  mathlib: (() => { try { const m = JSON.parse(fs.readFileSync(path.join(here, 'lake-manifest.json'), 'utf8')); const p = m.packages.find(p => p.name === 'mathlib'); return { rev: p.rev, inputRev: p.inputRev }; } catch { return null; } })(),
  repoCommit: (() => { const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }); return r.status === 0 ? r.stdout.trim() : null; })()
};

// 1. Build.
const build = run('lake', ['build']);
const buildOk = build.exit === 0;
const warnings = (build.out.match(/warning:/g) || []).length;
const errors = (build.out.match(/error:/g) || []).length;

// 2. Axiom audit: which axioms each headline theorem depends on. `sorryAx` would mean a sorry.
const audit = run('lake', ['env', 'lean', 'Delphi/Audit.lean']);
const axioms = [];
for (const m of audit.out.matchAll(/'(.+?)' depends on axioms: \[([^\]]*)\]/g)) axioms.push({ theorem: m[1], axioms: m[2].split(',').map(s => s.trim()).filter(Boolean) });
for (const m of audit.out.matchAll(/'(.+?)' does not depend on any axioms/g)) axioms.push({ theorem: m[1], axioms: [] });
const standard = new Set(['propext', 'Classical.choice', 'Quot.sound']);
const nonStandard = axioms.flatMap(a => a.axioms.filter(x => !standard.has(x)).map(x => ({ theorem: a.theorem, axiom: x })));

// 3. Source scan: declarations, docstrings, sorry count, per module.
const srcDir = path.join(here, 'Delphi');
const modules = [];
let sorryTotal = 0;
for (const f of fs.readdirSync(srcDir).filter(f => f.endsWith('.lean')).sort()) {
  const text = fs.readFileSync(path.join(srcDir, f), 'utf8');
  const lines = text.split(/\r?\n/);
  // count `sorry` in code only: strip block comments and line comments first
  const code = text.replace(/\/-[\s\S]*?-\//g, '').replace(/--.*$/gm, '');
  const sorries = (code.match(/\bsorry\b/g) || []).length;
  sorryTotal += sorries;
  const header = (text.match(/^\/-\n([\s\S]*?)\n-\/\n/) || [])[1] || '';
  const decls = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(?:noncomputable )?(theorem|lemma|def|structure) ([A-Za-z0-9_.']+)/);
    if (!m) continue;
    // docstring directly above
    let doc = '';
    if (i > 0 && lines[i - 1].trim().endsWith('-/')) {
      let j = i - 1; const buf = [];
      while (j >= 0) { buf.unshift(lines[j]); if (lines[j].includes('/--')) break; j--; }
      doc = buf.join('\n').replace(/^\s*\/--\s*/, '').replace(/\s*-\/\s*$/, '').replace(/\s+/g, ' ').trim();
    }
    // statement: from the declaration line to the first line ending in ':=' / ':= by' / 'where'
    const stmt = [];
    for (let k = i; k < lines.length && k < i + 12; k++) { stmt.push(lines[k]); if (/(:=\s*(by)?\s*$|\bwhere\s*$|:=\s*$)/.test(lines[k])) break; }
    decls.push({ kind: m[1], name: m[2], line: i + 1, doc, statement: stmt.join('\n').replace(/\s*:=\s*(by)?\s*$/, '').replace(/\s+where\s*$/, '') });
  }
  modules.push({ file: 'lean/Delphi/' + f, lines: lines.length, sorries, header, decls });
}

const theorems = modules.flatMap(m => m.decls.filter(d => d.kind === 'theorem').map(d => ({ ...d, file: m.file })));
const lemmas = modules.flatMap(m => m.decls.filter(d => d.kind === 'lemma').map(d => ({ ...d, file: m.file })));

// 4. Claims these modules formalize, read from the repo's key-claims file so names and DOIs are never retyped.
const key = JSON.parse(fs.readFileSync(path.join(root, 'math-bio-theorems/claims/key-claims.json'), 'utf8')).claims;
const formalized = [
  { claim_id: 'kimura-substitution-rate', theorem: 'Delphi.neutral_substitution_rate', module: 'lean/Delphi/Kimura.lean', status: buildOk && nonStandard.length === 0 ? 'verified' : 'not verified' },
  { claim_id: 'kimura-fixation-probability', theorem: 'Delphi.NeutralChain.fixedBy_tendsto', module: 'lean/Delphi/Kimura.lean', status: buildOk && nonStandard.length === 0 ? 'verified' : 'not verified', note: 'Neutral case only (s = 0), exact Wright-Fisher chain rather than the diffusion approximation.' },
  { claim_id: 'fisher-ftns', theorem: 'Delphi.fisher_fundamental_theorem', module: 'lean/Delphi/Fisher.lean', status: buildOk && nonStandard.length === 0 ? 'verified' : 'not verified', note: 'One haploid or clonal locus with finitely many types, fitnesses held fixed (partial change). In that population the variance in fitness is the additive genetic variance. The diploid average-effect version is not formalised.' },
  { claim_id: 'maynardsmith-twofold-cost', theorem: 'Delphi.twofold_cost_of_sex', module: 'lean/Delphi/MaynardSmith.lean', status: buildOk && nonStandard.length === 0 ? 'verified' : 'not verified', note: 'Deterministic odds identity under equal fecundity, 1:1 sex ratio and males contributing nothing; iterated form gives odds x 2^n after n generations.' }
].map(f => { const c = key.find(k => k.id === f.claim_id) || {}; return { ...f, label: c.label, statement: c.statement, notation: c.notation, context: c.context, paper: c.paper }; });
// Not a key claim: an extension proved for the flying-fish feasibility question (lean/bound/). Its text lives
// here because no paper states it in this form; it is the neutral case of Kimura 1962 relaxed to an inequality.
formalized.push({ claim_id: 'favored-fixation-lower-bound', theorem: 'Delphi.FavoredChain.fixationProbability_ge', module: 'lean/Delphi/Favored.lean', status: buildOk && nonStandard.length === 0 ? 'verified' : 'not verified',
  derived: true, label: 'Fixation is at least i/M when selection does not oppose the mutant',
  statement: 'In an absorbing chain on 0..M gene copies whose expected copy number never decreases (neutral, or selection for the mutant), a lineage present in i copies is eventually fixed with probability at least i/M. Wright-Fisher sampling with mutant relative fitness 1+s, s >= 0, is such a chain. Hence the expected number of substitutions over T generations is at least mu T (and at most M mu T), whatever M.',
  notation: 'E[X_{t+1} | X_t = i] >= i  =>  u(i) >= i/M ;  mu T <= M mu u T <= M mu T',
  context: 'Proved for the Exocoetidae substitution budget (lean/bound/). Kimura 1962 gives u ~ 2s for a selected mutant in the diffusion limit; that formula is not formalised. This is the exact, weaker statement that selection for the mutant cannot make fixation rarer than neutral drift does.',
  note: 'A lower bound only. Neutral chains are favored chains, and for them the bound is attained, so no upper bound in terms of s follows from this module.', paper: null });
// Blueprint well-formedness (lean/Delphi/Blueprint.lean + generated certificates): structural, not biological.
formalized.push({ claim_id: 'blueprint-well-formedness', theorem: 'Delphi.Blueprint.wellFormed_of_check', module: 'lean/Delphi/Blueprint.lean', status: buildOk && nonStandard.length === 0 ? 'verified' : 'not verified',
  derived: true, label: 'An emitted anatomical blueprint graph is well-formed under its own rules',
  statement: 'For a finite graph of ontology terms with a body root, a level per node and part_of edges (part, whole): if every edge goes strictly down in level, every edge joins two nodes, and every non-root node has a whole, then part_of is acyclic (its transitive closure is transitive and strictly decreases the level, so nothing is part of itself) and every node reaches the root. With pinned taxon statements: no never_in_taxon on a kept term, a superclass or a whole names a taxon containing the blueprint taxon, and every in_taxon or stated_in_taxon names a containing taxon. A Boolean checker decides all of this, and its truth implies the well-formedness (wellFormed_of_check); each emitted blueprint gets a certificate the kernel evaluates by decide.',
  notation: 'LevelsDown ∧ Closed ∧ (∀ a ≠ root, ∃ b, a part_of b) ⟹ Acyclic ∧ Rooted ; check g D = true ⟹ WellFormed g D',
  context: 'Built for the organism thread\'s text-to-blueprint tool (organism-design/blueprint.mjs). The certificate fixes the distinct-term counts per level, which is the count whose placement-versus-term confusion (343 placements against 257 distinct cell types) the organism thread fixed by hand on 2026-10-31.',
  note: 'Structural only. The certificate says the emitted structure is internally coherent under its stated rules; it does not say the organism is real, that the anatomy is correct or complete, that Uberon or the Cell Ontology are right, or anything about a transition between forms.', paper: null });
// Thompson's cube law (thompson-growth-form/claims.json), with the claims thread's measured exponents pointed to, not derived.
try {
  const tc = JSON.parse(fs.readFileSync(path.join(root, 'thompson-growth-form/claims.json'), 'utf8'));
  const tl = (Array.isArray(tc) ? tc : tc.claims).find(c => c.id === 'thompson1917-ch03-07');
  formalized.push({ claim_id: 'thompson1917-ch03-07', theorem: 'Delphi.cubeLaw_loglog_exponent', module: 'lean/Delphi/Thompson.lean', status: buildOk && nonStandard.length === 0 ? 'verified' : 'not verified',
    label: tl.label, statement: tl.claim, notation: tl.notation, context: `${tl.quote} (On Growth and Form, ch. ${tl.chapter}, "${tl.section}", lines ${tl.lineStart}-${tl.lineEnd})`,
    note: 'Exact form only: W = k L^3 (isometric growth at constant density) gives a log-log exponent of exactly 3 and weight ratio (L2/L1)^3; a measured exponent other than 3 refutes the exact law on that interval. Thompson\'s "mainly (though not wholly)" and the claim test\'s tolerance band are outside the theorem.',
    paper: { title: 'On Growth and Form', year: 1917, doi: null, author: "D'Arcy Wentworth Thompson" } });
} catch (e) { console.error('thompson claim not loaded: ' + e.message); }
// 4b. Proof scope: which decisions the Lean kernel checked, and which are assumptions stated in the
// module header and never proved. Mirrors the module headers; kept here so the page can show both halves.
const proofScope = {
  'kimura-substitution-rate': {
    kernelChecked: [
      'A neutral absorbing chain on {0..M} copies (stochastic, mean-preserving, both ends absorbing, positive one-step escape from every interior state) fixes a mutant with probability i/M, with an explicit geometric error bound at every finite time t.',
      'The Wright-Fisher binomial kernel is such a chain (row sums, mean preservation and absorption proved from Bernstein polynomial identities).',
      'With u = 1/M the defined substitution rate M * mu * u equals mu, also in the diploid 2N form and as the t -> infinity limit.'
    ],
    assumed: [
      'Strict neutrality of the mutations.',
      'Constant population size and Wright-Fisher reproduction (non-overlapping generations, multinomial sampling).',
      'Independent fates of mutants: the substitution rate is DEFINED, as in Kimura 1968, as (new mutants per generation) x (fixation probability of one mutant). Interference between lineages is excluded by that definition, not proved absent.',
      'The mutation rate mu per copy per generation is a free parameter; nothing here measures it.'
    ]
  },
  'kimura-fixation-probability': {
    kernelChecked: ['Fixation probability i/M for any neutral absorbing chain, hence for the exact finite Wright-Fisher chain (Delphi.NeutralChain.fixedBy_tendsto).'],
    assumed: ['Neutral case only (s = 0). Kimura 1962 with selection in the diffusion limit is not formalised.']
  },
  'fisher-ftns': {
    kernelChecked: [
      'For one locus with finitely many types, frequencies p (nonneg, summing to 1), fixed fitnesses w and mean fitness > 0: selection p_next = p w / wbar yields wbar_next - wbar = Var(w)/wbar exactly.',
      'Corollary: mean fitness never decreases under fixed fitnesses.'
    ],
    assumed: [
      'Haploid or clonal inheritance, so the variance in fitness IS the additive genetic variance; the diploid average-effect version is not formalised.',
      'Fitnesses constant within the step (partial change): no dominance, epistasis, frequency dependence or environmental change.',
      'Infinite population: deterministic frequencies, no drift, no mutation.'
    ]
  },
  'favored-fixation-lower-bound': {
    kernelChecked: [
      'For any absorbing chain on {0..M} copies with E[X_{t+1} | X_t = i] >= i (stochastic, both ends absorbing, positive one-step escape from every interior state), P(fixed by t) is nondecreasing and bounded, its limit u(i) exists, and u(i) >= i/M (Delphi.FavoredChain.fixationProbability_ge); also u(i) <= 1.',
      'Wright-Fisher sampling with success probability (1+s) i / (M + s i), s >= 0, is such a chain (Delphi.wrightFisherSelection), so a single new mutant fixes with probability at least 1/M.',
      'The defined expected count M mu u T equals mu T for the neutral Wright-Fisher chain, is at least mu T for any favored chain, and is at most M mu T for any u <= 1.'
    ],
    assumed: [
      'The expected count is a DEFINITION (rate x generations, independent fates, Kimura 1968); linkage, interference, changing M, changing s and overlapping generations are excluded by it, not shown absent.',
      'Selection enters only through the sampling probability (1+s) i / (M + s i), constant in time and across sites.',
      'mu, T, M are free parameters; the module measures nothing. Which mutations are favored, how many a trait needs, and in what order, are outside it.'
    ]
  },
  'blueprint-well-formedness': {
    kernelChecked: [
      'Generic (any node type): edges strictly down in level ⟹ the part_of closure is transitive, strictly decreases the level, and is acyclic (Graph.acyclic_of_levelsDown, Graph.transGen_trans, Graph.transGen_level_lt).',
      'Generic: edges closed and every non-root node has a whole ⟹ every node reaches the root (Graph.rooted_of, strong induction on level).',
      'Generic: the Boolean checker is sound for LevelsDown, Closed, Acyclic, Rooted and the taxon conditions (wellFormed_of_check).',
      'Per blueprint: the kernel evaluates the checker on the emitted graph and the pinned taxon rows (decide +kernel), and fixes the distinct-term counts per level and the graph size (lean/Delphi/Certificates/*.lean).'
    ],
    assumed: [
      'That Uberon and the Cell Ontology are correct and that Ubergraph served their part_of, subClassOf, never_in_taxon and in_taxon statements correctly and completely on the retrieval date: the graph and the taxon rows are data, pinned by hash and query.',
      'That the five levels (body, organ system, organ, tissue, cell) are the right notion of depth; the theorems use only that edges strictly decrease it.',
      'Nothing about any organism: not that it is real, that the anatomy is correct or complete, that any part was measured, or anything about a transition between forms.'
    ]
  },
  'thompson1917-ch03-07': {
    kernelChecked: [
      'If W L = k L^3 for all L > 0 with k > 0, then for L1 ≠ L2 the log-log slope (log W L2 − log W L1)/(log L2 − log L1) equals exactly 3 (cubeLaw_loglog_exponent) and W L2 / W L1 = (L2/L1)^3 (cubeLaw_ratio).',
      'Contrapositive: two sizes with a log-log slope b ≠ 3 rule out W = k L^3 for every k (not_cubeLaw_of_exponent_ne_three).'
    ],
    assumed: [
      'A single linear dimension L and mass W of one body family; fixed shape and constant density are what W = k L^3 encodes.',
      `Thompson's "mainly (though not wholly)" is not formalised: the theorem is exact, the law is approximate, and the tolerance band [2.5, 3.5] the claim test uses is a decision rule outside the module.`,
      `No data enters the module; the measured exponents are read from the claims thread's result files and pointed to.`
    ]
  },
  'maynardsmith-twofold-cost': {
    kernelChecked: [
      'For 0 < q < 1 and fecundity f > 0 the odds of asexual to sexual females satisfy odds(q_next) = 2 odds(q), and f cancels.',
      'Iterated n generations the odds are 2^n times the initial odds.'
    ],
    assumed: [
      'Anisogamy: males contribute nothing to offspring number or survival.',
      'Equal fecundity and viability of sexual and asexual females and of their daughters.',
      'Primary sex ratio exactly 1:1 in sexual broods; discrete non-overlapping generations; infinite population (deterministic fractions).'
    ]
  }
};
for (const f of formalized) f.proofScope = proofScope[f.claim_id] || null;


// 5. Faithfulness assessments by non-Anthropic models (lean/assessment/results/*.json), if any.
const resDir = path.join(here, 'assessment/results');
const assessments = fs.existsSync(resDir) ? fs.readdirSync(resDir).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(resDir, f), 'utf8'))) : [];
for (const f of formalized) {
  f.assessments = assessments.filter(a => a.claim_id === f.claim_id).map(a => ({ provider: a.assessor.provider, model: a.assessor.model, date: a.assessor.date, scores: a.scores, verdict: a.verdict, rationale: a.rationale }));
  f.providers = [...new Set(f.assessments.map(a => a.provider))];
  // The literal verdicts, as the assessors wrote them. The summary label is the weakest verdict across
  // assessors (unfaithful > faithful-with-narrower-scope > faithful), never rounded up; the provider
  // count is appended because the project needs two providers before a nanopub can carry it.
  const rank = v => v === 'unfaithful' ? 2 : v === 'faithful' ? 0 : 1;
  const worst = f.assessments.length ? f.assessments.map(a => a.verdict).sort((a, b) => rank(b) - rank(a))[0] : null;
  f.verdicts = f.assessments.map(a => ({ provider: a.provider, model: a.model, verdict: a.verdict }));
  f.faithfulness = worst === null ? 'not assessed' : `${worst} (${f.providers.length} provider${f.providers.length === 1 ? '' : 's'}: ${f.providers.join(', ')})`;
  f.assessmentComplete = f.providers.length >= 2 && worst !== 'unfaithful';
}

// 6. Mutation evidence (lean/mutate.mjs -> lean/mutations.json) and nanopub draft status (lean/nanopubs/manifest.json), if present.
const mutFile = path.join(here, 'mutations.json');
const mutations = fs.existsSync(mutFile) ? JSON.parse(fs.readFileSync(mutFile, 'utf8')) : null;
for (const f of formalized) f.mutations = mutations ? mutations.results.filter(r => r.kind === 'mutation' && r.claim_id === f.claim_id).map(r => ({ id: r.id, theorem: r.theorem, description: r.description, outcome: r.outcome, errors: r.errors, firstError: r.firstError, seconds: r.seconds })) : [];
const npFile = path.join(here, 'nanopubs/manifest.json');
const npManifest = fs.existsSync(npFile) ? JSON.parse(fs.readFileSync(npFile, 'utf8')) : null;
const chkFile = path.join(here, 'nanopubs/check.json');
const npCheck = fs.existsSync(chkFile) ? JSON.parse(fs.readFileSync(chkFile, 'utf8')) : null;
const nanopubs = npManifest ? { built: npManifest.built, check: npCheck ? { ...npCheck.summary, perFile: npCheck.results.map(r => ({ file: r.file, parsed: r.parsed, npValid: r.ok, notes: r.npCheck.issues.length })) } : null, templateConformance: npManifest.templateConformance || null, commitPinned: npManifest.commitPinned, status: npManifest.publishing.status, policy: npManifest.publishing.policy, drafts: npManifest.nanopubs.length, byKind: Object.fromEntries([...new Set(npManifest.nanopubs.map(n => n.kind))].map(k => [k, npManifest.nanopubs.filter(n => n.kind === k).length])), signed: npManifest.nanopubs.filter(n => n.trustyUri).length, published: npManifest.nanopubs.filter(n => n.registry).length, files: npManifest.nanopubs.map(n => ({ file: n.file, kind: n.kind, status: n.status, publishable: n.publishable || null })) } : null;

// 7a. Blueprint certificates (lean/blueprint/certify.mjs): one per emitted blueprint, with the audit of its theorems.
const certDir = path.join(here, 'blueprint/certificates');
const blueprintCertificates = fs.existsSync(certDir) ? fs.readdirSync(certDir).filter(f => f.endsWith('.json')).map(f => {
  const c = JSON.parse(fs.readFileSync(path.join(certDir, f), 'utf8'));
  const au = Object.fromEntries(Object.entries(c.theorems).map(([k, n]) => [k, axioms.find(a => a.theorem === n) || null]));
  const audited = Object.values(au).every(a => a && a.axioms.every(x => standard.has(x)));
  return { ...c, audit: au, verified: buildOk && c.compile.ok && audited, blueprintSha256Now: (() => { try { return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, c.blueprint.file))).digest('hex'); } catch { return null; } })() };
}).map(c => ({ ...c, current: c.blueprintSha256Now === c.blueprint.sha256 })) : [];
// 7b. Thompson cube-law test results (claims thread), pointed to from the record: exponents measured against 3.
let thompsonTest = null;
try {
  const dir = path.join(root, 'claim-tests/thompson-growth-form/thompson1917-ch03-07');
  const res = JSON.parse(fs.readFileSync(path.join(dir, 'result.json'), 'utf8'));
  const sum = JSON.parse(fs.readFileSync(path.join(dir, 'derived/summary.json'), 'utf8'));
  const cx = JSON.parse(fs.readFileSync(path.join(dir, 'derived/cross_check.json'), 'utf8'));
  const w = cx.theirs.slope_by_age_window;
  thompsonTest = {
    source: 'claim-tests/thompson-growth-form/thompson1917-ch03-07 (result.json, derived/summary.json, derived/cross_check.json)', verdict: res.verdict, confidence: res.confidence, passCriterion: res.fail_criterion,
    exponents: [
      { label: 'males, age-bin means 2-19 y (this test)', b: sum.male.free_exponent_b, ci95: sum.male.b_ci95, n: sum.male.n_participants, cubicR2: sum.male.cubic_model_r2_original_scale },
      { label: 'females, age-bin means 2-19 y (this test)', b: sum.female.free_exponent_b, ci95: sum.female.b_ci95, n: sum.female.n_participants, cubicR2: sum.female.cubic_model_r2_original_scale },
      { label: 'pooled individuals 2-19 y, OLS (cross-check)', b: cx.ours_individual_level.pooled.ols_exponent, ci95: cx.ours_individual_level.pooled.ci95, n: cx.ours_individual_level.pooled.n_individuals },
      { label: 'pooled individuals 0-19 y, OLS (earlier run, NHANES 2007-2018)', b: cx.theirs.pooled_0_19_individuals.ols_slope, ci95: cx.theirs.pooled_0_19_individuals.ols_slope_ci95, n: cx.theirs.pooled_0_19_individuals.n },
      ...Object.entries(w).map(([k, v]) => ({ label: `window ${k}, OLS (earlier run)`, b: v.ols_slope, ci95: v.ols_slope_ci95, n: v.n }))
    ],
    cycles: sum.cycles, caveats: res.caveats
  };
} catch (e) { thompsonTest = { error: String(e.message) }; }

// 7c. Constraints and the elimination ledger (lean/eliminate/): theorems as filters, candidates in three states.
const constraintsFile = path.join(here, 'constraints.json'), ledgerFile = path.join(here, 'eliminate/ledger.json');
const constraintsDoc = fs.existsSync(constraintsFile) ? JSON.parse(fs.readFileSync(constraintsFile, 'utf8')) : null;
const ledgerDoc = fs.existsSync(ledgerFile) ? JSON.parse(fs.readFileSync(ledgerFile, 'utf8')) : null;
const constraints = constraintsDoc ? { built: constraintsDoc.built, framing: constraintsDoc.framing, quantities: constraintsDoc.quantities, assumptions: constraintsDoc.assumptions,
  list: constraintsDoc.constraints.map(c => ({ id: c.id, claim_id: c.claim_id, label: c.label, lemma: c.lemma, law: c.law, module: c.module, property: c.property, relation: c.relation, symbols: c.symbols, requires: c.requires, appliesWhen: c.appliesWhen, rule: c.rule, canEliminate: c.canEliminate, kernelCheckable: c.kernelCheckable, lemmaAxioms: axioms.find(a => a.theorem === c.lemma)?.axioms ?? null, lawAxioms: axioms.find(a => a.theorem === c.law)?.axioms ?? null, faithfulness: c.faithfulness, proofScope: c.proofScope })) } : null;
const eliminations = ledgerDoc ? { summary: ledgerDoc.summary, ledger: ledgerDoc.ledger } : null;
const opLedgerFile = path.join(here, 'eliminate/ledger.open-problems.json');
const opDoc = fs.existsSync(opLedgerFile) ? JSON.parse(fs.readFileSync(opLedgerFile, 'utf8')) : null;
const eliminationsOpenProblems = opDoc ? { summary: opDoc.summary, ledger: opDoc.ledger, translations: 'lean/eliminate/translations.json', formal: 'open-problems/candidates.formal.json' } : null;

// 7. Flying-fish substitution budget (lean/bound/compute.mjs): applies the audited theorems to sourced parameters.
let bound = null;
try {
  const { computeBound } = await import('./bound/compute.mjs');
  const P = JSON.parse(fs.readFileSync(path.join(here, 'bound/parameters.json'), 'utf8'));
  const partial = { built: null, build: { ok: buildOk }, sorryTotal, audit: { theorems: axioms } };
  bound = computeBound(partial, P);
  fs.writeFileSync(path.join(here, 'bound/result.json'), JSON.stringify(bound, null, 1));
} catch (e) { bound = { verified: false, error: String(e.message) }; }

const report = {
  built: new Date().toISOString(),
  versions,
  build: { ok: buildOk, exit: build.exit, seconds: build.seconds, warnings, errors, tail: build.out.trim().split(/\r?\n/).slice(-6) },
  audit: { ok: audit.exit === 0 && axioms.length > 0 && nonStandard.length === 0, theorems: axioms, nonStandard, raw: audit.out.trim() },
  sorryTotal, modules, theorems, lemmas, formalized,
  mutations: mutations ? { summary: mutations.summary, results: mutations.results } : null,
  nanopubs, bound, blueprintCertificates, thompsonTest, constraints, eliminations, eliminationsOpenProblems,
  summary: {
    theoremsCompiling: buildOk ? theorems.length : 0,
    lemmas: lemmas.length,
    modules: modules.length,
    sourceLines: modules.reduce((s, m) => s + m.lines, 0),
    claimsVerified: formalized.filter(f => f.status === 'verified' && !f.derived).length,
    extensionsVerified: formalized.filter(f => f.status === 'verified' && f.derived).length,
    boundVerdict: bound && bound.verified ? bound.comparison.verdict : null,
    blueprintCertificates: blueprintCertificates.length, blueprintCertificatesVerified: blueprintCertificates.filter(c => c.verified && c.current).length,
    openProblemCandidatesChecked: eliminationsOpenProblems ? eliminationsOpenProblems.summary.candidates : 0, openProblemCandidatesEliminated: eliminationsOpenProblems ? eliminationsOpenProblems.summary.eliminated : 0, openProblemCandidatesConsistent: eliminationsOpenProblems ? eliminationsOpenProblems.summary.consistent : 0, openProblemCandidatesCannotRule: eliminationsOpenProblems ? eliminationsOpenProblems.summary.unconstrained : 0, openProblemCandidatesNotFormalised: eliminationsOpenProblems ? eliminationsOpenProblems.summary.candidatesWithNotFormalisedClaims : 0,
    constraints: constraints ? constraints.list.length : 0, candidatesChecked: eliminations ? eliminations.summary.candidates : 0, candidatesEliminated: eliminations ? eliminations.summary.eliminated : 0, candidatesConsistent: eliminations ? eliminations.summary.consistent : 0, candidatesUnconstrained: eliminations ? eliminations.summary.unconstrained : 0, kernelCheckedEliminations: eliminations ? eliminations.summary.kernelCheckedEliminations : 0,
    claimsAssessed: formalized.filter(f => f.assessments.length > 0).length,
    assessmentsRun: assessments.length,
    assessorProviders: [...new Set(assessments.map(a => a.assessor.provider))],
    assessorModels: [...new Set(assessments.map(a => a.assessor.provider + ' / ' + a.assessor.model))],
    verdictCounts: Object.fromEntries([...new Set(assessments.map(a => a.verdict))].map(v => [v, assessments.filter(a => a.verdict === v).length])),
    claimsWithTwoProviders: formalized.filter(f => f.providers.length >= 2).length,
    mutantsTried: mutations ? mutations.summary.mutations : 0,
    mutantsRejected: mutations ? mutations.summary.rejected : 0,
    mutationControlsPassed: mutations ? `${mutations.summary.controlsPassed}/${mutations.summary.controls}` : null,
    nanopubDrafts: nanopubs ? nanopubs.drafts : 0,
    nanopubsSigned: nanopubs ? nanopubs.signed : 0,
    nanopubsPublished: nanopubs ? nanopubs.published : 0
  }
};
fs.writeFileSync(path.join(outDir, 'lean.json'), JSON.stringify(report, null, 1));
console.log(`lean.json: build ${buildOk ? 'ok' : 'FAILED'} in ${build.seconds}s, ${theorems.length} theorems, ${lemmas.length} lemmas, ${sorryTotal} sorry, axioms ${report.audit.ok ? 'standard only' : 'NON-STANDARD: ' + JSON.stringify(nonStandard)}`);
if (!buildOk || !report.audit.ok) process.exitCode = 1;
