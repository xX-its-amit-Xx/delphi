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
// Scaling laws handed over by the physics thread (physics/FORMAL-STATEMENTS.md, R2-R8): lean/Delphi/Scaling.lean.
formalized.push({ claim_id: 'scaling-area-law', theorem: 'Delphi.areaLaw_ratio', module: 'lean/Delphi/Scaling.lean', status: buildOk && nonStandard.length === 0 ? 'verified' : 'not verified', derived: true,
  label: 'Area law and wing loading under isometry (R2, R3)', statement: 'In an isometric family an area scales as the square of the linear dimension, S(L2)/S(L1) = (L2/L1)^2, and with the cube law the weight per unit area (wing loading, or stress W/A) scales as L2/L1.',
  notation: 'S ∝ L^2 ; W/S ∝ L', context: 'physics/FORMAL-STATEMENTS.md R2 and R3; Thompson ch. II. Davenport 1992 measured fin area ∝ L^1.834 and wing loading ∝ L^1.236 within one flying-fish species, so isometry is an idealisation there.',
  note: 'Isometry of the area is a named hypothesis (AreaLaw); the theorem says nothing about any family being isometric.', paper: null });
formalized.push({ claim_id: 'scaling-strength-law', theorem: 'Delphi.breakLoad_ratio', module: 'lean/Delphi/Scaling.lean', status: buildOk && nonStandard.length === 0 ? 'verified' : 'not verified', derived: true,
  label: 'Strength scales as L^2: the missing half of Galileo\'s square-cube argument (R7)', statement: 'A member of cross-section A made of material with breaking stress σ fails under axial load σ A. With isometric sections and the same material the breaking load scales as (L2/L1)^2, the static safety factor F_break/W equals σ k3/(k1 L) and falls as 1/L, stress W/A grows as L, and above L_max = σ k3/(k1 n) the member cannot carry n body weights.',
  notation: 'F_break = σ A ∝ L^2 ; F_break/W ∝ 1/L ; L_max = σ k3/(k1 n)', context: 'physics/FORMAL-STATEMENTS.md R7 (Galileo 1638, Two New Sciences). With R1 this lets the checker rule on "a giant of unchanged proportions and material can stand".',
  note: 'Axial loading, isometric sections and constant σ are named hypotheses; real animals thicken bones with size (elastic similarity gives A ∝ L^2.5 under a different hypothesis).', paper: null });
formalized.push({ claim_id: 'scaling-bending-law', theorem: 'Delphi.bendingStress_ratio_body', module: 'lean/Delphi/Scaling.lean', status: buildOk && nonStandard.length === 0 ? 'verified' : 'not verified', derived: true,
  label: 'Bending strength of an isometric member via the section modulus (R9)', statement: 'For a slender linear-elastic beam the maximum bending stress is the moment over the section modulus, σ_b = F ℓ / Z. With similar sections (Z ∝ L^3) and a lever arm ∝ L: if the load scales as the body (F ∝ L^3, R9a) then σ_b scales as L, the bending safety factor σ_max/σ_b equals σ_max k_Z/(k_F k_ℓ L) and above L_max,b = σ_max k_Z/(k_F k_ℓ n) the member cannot carry n times its load; if the load scales as an area (a lamina of constant thickness, F ∝ L^2, R9b) then σ_b is independent of size and no size limit follows.',
  notation: 'σ_b = F ℓ / Z ; R9a: σ_b ∝ L, L_max,b = σ_max k_Z/(k_F k_ℓ n) ; R9b: σ_b ∝ L^0', context: 'physics/FORMAL-STATEMENTS.md R9, written for WP-077/C1 (leaf size): the load exponent is the empirical fork, and the two readings give opposite answers on whether a limit exists.',
  note: 'Slender linear-elastic beam theory, geometrically similar sections, lever arm ∝ L and constant σ_max are named hypotheses; elastic similarity (d ∝ ℓ^(3/2)) and dynamic loads such as wind are not formalised.', paper: null });
// Flight module (lean/Delphi/Flight.lean): allometry, climb, glide range, aerobic power bound, crossover.
formalized.push({ claim_id: 'flight-allometry-law', theorem: 'Delphi.vmin_powerLaw_log', module: 'lean/Delphi/Flight.lean', status: buildOk && nonStandard.length === 0 ? 'verified' : 'not verified', derived: true,
  label: 'General allometry: measured exponents compose (W = a L^b)', statement: 'For power laws f L = a L^b with real exponents: the ratio between two sizes is (L2/L1)^b, the log-log exponent is b, a quotient of power laws is a power law with exponent b1 − b2 (so wing loading W/S has exponent bW − bS), the cube law is the case b = 3, and under power laws for weight and lifting area with constant ρ and C_L,max the minimum-speed exponent is (bW − bS)/2.',
  notation: 'f ∝ L^b ; W/S ∝ L^(bW−bS) ; v_min ∝ L^((bW−bS)/2)', context: 'Replaces the isometric assumption where exponents are measured: Davenport 1992 (mass 2.981, fin area 1.834) and seven fitted FishBase length-weight studies for Exocoetidae (physics/length-weight.csv) give b between 2.908 and 3.011 for five species and 2.208 for Hirundichthys affinis males.',
  note: 'The power-law form with a fixed exponent is itself the hypothesis; nothing here says a species obeys one.', paper: null });
formalized.push({ claim_id: 'flight-climb-glide-law', theorem: 'Delphi.glide_range_le', module: 'lean/Delphi/Flight.lean', status: buildOk && nonStandard.length === 0 ? 'verified' : 'not verified', derived: true,
  label: 'Climb from excess power and the range of a steady glide', statement: 'If available mechanical power is spent on level flight, on raising the weight at vertical speed c, and on non-negative losses, then c ≤ (P_avail − P_req)/W. A steady glide with no thrust, lift equal to weight and L/D ≤ (L/D)max from height h covers at most h (L/D)max horizontally; with drag reduced by a fraction δ near the surface and lift unaffected, at most h (L/D)max/(1 − δ).',
  notation: 'c ≤ (P_avail − P_req)/W ; x ≤ h (L/D)max/(1−δ)', context: 'Needed by the planned simulator and a powered variant. Ground-effect drag reductions of 0.09 to 0.14 were measured by Park and Choi 2010 (physics/ground-effect.json) and enter only as candidate inputs.',
  note: 'Energy and power balances with non-negative losses are the named hypotheses; taxiing thrust, multiple touch-and-go, wind and updrafts are outside the glide model, which is why field glide distances can exceed the bound.', paper: null });
formalized.push({ claim_id: 'aerobic-power-bound', theorem: 'Delphi.sustained_flight_requires', module: 'lean/Delphi/Flight.lean', status: buildOk && nonStandard.length === 0 ? 'verified' : 'not verified', derived: true,
  label: 'Sustained mechanical power is bounded by oxygen delivery (Fick) times efficiency', statement: 'With cardiac output Q, arterial and venous O2 contents Ca ≥ Cv ≥ 0, oxycaloric equivalent E and muscular efficiency 0 ≤ η ≤ 1, aerobic mechanical power is η E Q (Ca − Cv) ≤ η E Q Ca ≤ E Q Ca. A sustained power supplied aerobically is at most η E Q Ca; sustained flight needing P_req = W v/(L/D) requires η E Q Ca ≥ P_req; climb under an aerobic supply is at most (η E Q Ca − P_req)/W. If demand and supply are power laws in size with the supply exponent below the demand exponent there is a size above which supply falls short (crossover), so Thompson\'s size limit holds for any supply exponent below 7/2 without the muscle premise.',
  notation: 'P ≤ η E_O2 Q (Ca − Cv) ≤ η E_O2 Q Ca ; sustained flight ⇒ η E_O2 Q Ca ≥ P_req ; b_supply < 7/2 ⇒ ∃ L*', context: 'The bridge theorem for the physics thread\'s coupled simulator (water O2 → gills → blood → muscle → flight). Replaces R6\'s bare muscle premise with a derived bound whose inputs sourced physiology can fill.',
  note: 'Fick\'s principle, the oxycaloric conversion, aerobic (not burst) power and 0 ≤ η ≤ 1 are named hypotheses; no physiological number for Exocoetidae is in any statement.', paper: null });
try {
  const tc = JSON.parse(fs.readFileSync(path.join(root, 'thompson-growth-form/claims.json'), 'utf8'));
  const tl = id => (Array.isArray(tc) ? tc : tc.claims).find(c => c.id === id);
  const mk = (id, theorem, note) => { const c = tl(id); return { claim_id: id, theorem, module: 'lean/Delphi/Scaling.lean', status: buildOk && nonStandard.length === 0 ? 'verified' : 'not verified', label: c.label, statement: c.claim, notation: c.notation, context: `${c.quote} (On Growth and Form, ch. ${c.chapter}, "${c.section}", lines ${c.lineStart}-${c.lineEnd})`, note, paper: { title: 'On Growth and Form', year: 1917, doi: null, author: "D'Arcy Wentworth Thompson" } }; };
  formalized.push(mk('thompson1917-ch02-06', 'Delphi.powerRequired_log', 'Exact part: lift-supported flight with C_L ≤ C_L,max needs v ≥ v_min = sqrt(2W/(ρ S C_L,max)) (R4, no isometry). Scaling part: under R1, R2, constant ρ, C_L,max and L/D, v_min ∝ L^(1/2) and the power required at v_min ∝ L^(7/2); the power available ∝ L^3 ONLY under Thompson\'s muscle premise (constant muscle fraction and mass-specific power), carried as a named hypothesis MusclePowerLaw and never asserted. Thompson\'s momentum-flux derivation is not formalised; the lift equation stands in for it.'));
  formalized.push(mk('thompson1917-ch02-07', 'Delphi.exists_size_limit', 'Only the existence of a size above which power required exceeds power available is proved, under R1, R2, constant ρ, C_L,max, L/D and the muscle premise. Its value needs f, p, L/D, ρ and C_L,max, which no proof supplies, so nothing here says the ostrich, the moa or a man-sized bird is past it.'));
  formalized.push(mk('thompson1917-ch02-10', 'Delphi.vmin_ratio', 'Two of Thompson\'s three routes: flight (v_min ∝ L^(1/2) under R1, R2, constant ρ and C_L,max) and swimming (Froude: v ∝ (g L)^(1/2) at equal Froude number). The walking (pendulum) route is not formalised.'));
} catch (e) { console.error('thompson flight claims not loaded: ' + e.message); }
// 4b. Proof scope: which decisions the Lean kernel checked, and which are assumptions stated in the
// module header and never proved. Mirrors the module headers; kept here so the page can show both halves.
// Genotype-level checks and two physiology bounds (lean/Delphi/Genotype.lean, lean/Delphi/Physiology.lean),
// written for the Design Studio's genetic edits. No paper states them in these forms.
formalized.push({ claim_id: 'genotype-genetic-code', theorem: 'Delphi.Genotype.claimed_substitutions_rules_out', module: 'lean/Delphi/Genotype.lean', status: buildOk && nonStandard.length === 0 ? 'verified' : 'not verified', derived: true,
  label: 'A claimed amino-acid change is impossible below the code distance',
  statement: 'With the standard genetic code as a 64-codon table and minSubst a b the least number of positions in which a codon for a and a codon for b differ, no codon pair turns a into b in fewer than minSubst a b nucleotide substitutions. A claim of n substitutions with n < minSubst a b is therefore impossible. minSubst is computed over the table, so the kernel evaluates each instance: Phe to Leu takes 1, Trp to Stop 1, Met to Trp 2.',
  notation: 'n < minSubst a b  =>  not exists codons c d, code c = a and code d = b and hamming c d <= n',
  context: 'Needed by the Design Studio, where a genetic edit is shown as an amino-acid change. The flying-fish variant the project records, slc43a2a F326L (Daane et al. 2021), is reachable in one substitution.',
  note: 'The code table is data, not a theorem: mitochondrial and variant codes differ, and selenocysteine and RNA editing are outside it. Reachability in the code is not evidence that a substitution occurred. Prior Lean work formalising the genetic code exists independently (arXiv doi 10.48550/arxiv.2610.36343, cited by the hub and not used here), so no first is claimed.', paper: null });
formalized.push({ claim_id: 'genotype-pleiotropy-closure', theorem: 'Delphi.Genotype.closure_of_check', module: 'lean/Delphi/Genotype.lean', status: buildOk && nonStandard.length === 0 ? 'verified' : 'not verified', derived: true,
  label: 'An edit to a gene must be shown changing every node the map links that gene to',
  statement: 'The Boolean check closureB mapped changed is true exactly when every node in the mapped list occurs in the changed list; its truth implies the inclusion (closure_of_check), and a single mapped node absent from the changed list makes it false (closure_violated). Applied to the genotype map: a view that shows an edit to a gene changing fewer nodes than the map links to that gene is ruled out.',
  notation: 'closureB mapped changed = true  =>  forall n in mapped, n in changed',
  context: 'The map (lean/genotype/gene-nodes.json, from the genotype thread\'s fin subtree) links tbx5a to 8 nodes, shha to 12, fgf24 to 8, kcnk5b and slc43a2a to the pectoral fin alone within that subtree.',
  note: 'A statement about pictures, not about development: it bounds what a view may omit, never how much a node changes. The map records links (expressed in, required for, sufficient for), so a node no source studied is unstudied, not gene-free, and the closure is only as complete as the sources.', paper: null });
formalized.push({ claim_id: 'genotype-developmental-ordering', theorem: 'Delphi.Genotype.devOrdered_of_check', module: 'lean/Delphi/Genotype.lean', status: buildOk && nonStandard.length === 0 ? 'verified' : 'not verified', derived: true,
  label: 'No structure develops from a precursor that appears later than it does',
  statement: 'Taking the developmental stage as the level of a blueprint graph whose edges are develops_from, the Boolean check devOrderedB is true exactly when every edge goes strictly down in stage; its truth implies that every derivative is staged strictly after its precursor and that develops_from is acyclic. The fin subtree\'s own edges are certified by a kernel evaluation of the checker on the recorded stages (lean/Delphi/Certificates/FinDevelopment.lean).',
  notation: 'devOrderedB g = true  =>  (forall edges a b, level b < level a) and Acyclic',
  context: 'The pectoral-fin subtree of the genotype thread: 8 develops_from edges with both stages recorded are certified, 4 more have an unknown stage and are not.',
  note: 'The ZFIN stage-series ids are taken to order the stages. Nothing here is about the flying fish: the subtree is zebrafish anatomy joined to the blueprint by cross-references. An edge with an unknown stage is not certified, not passed.', paper: null });
formalized.push({ claim_id: 'genotype-substitution-time', theorem: 'Delphi.Genotype.expectedWaitingTime_bounds', module: 'lean/Delphi/Genotype.lean', status: buildOk && nonStandard.length === 0 ? 'verified' : 'not verified', derived: true,
  label: 'The time N independent substitutions need lies between N/(M mu) and N/mu',
  statement: 'With M gene copies, mutation rate mu per copy per generation and fixation probability u, the expected time for N substitutions arriving at Kimura\'s rate M mu u is N/(M mu u); for 1/M <= u <= 1 it lies between N/(M mu) and N/mu, and equals N/mu in the neutral case u = 1/M. An available time below N/(M mu), the fastest the model allows because it assumes every single mutant fixes, is ruled out.',
  notation: 'N/(M mu) <= N/(M mu u) <= N/mu ; T < N/(M mu) => False',
  context: 'The time half of the Exocoetidae substitution budget (lean/bound/). The rate itself is Kimura\'s definition, proved in lean/Delphi/Kimura.lean and bounded below for favoured mutants in lean/Delphi/Favored.lean.',
  note: 'An upper bound on speed, and nothing more. It cannot say a trait had too little time unless the number of required substitutions is defined, which it is not for any wing claim in this project; independent sequential fixations with constant M, mu and u exclude linkage, standing variation and recombination of partial solutions by assumption.', paper: null });
formalized.push({ claim_id: 'haldane-cost-of-selection', theorem: 'Delphi.Genotype.haldane_time_lower', module: 'lean/Delphi/Genotype.lean', status: buildOk && nonStandard.length === 0 ? 'verified' : 'not verified', derived: true,
  label: 'From Haldane\'s cost accounting (a hypothesis, not proved here): N substitutions need at least c N / e generations',
  statement: 'HaldaneCost N T e c is the NAMED HYPOTHESIS that N substitutions by selection in T generations cost at most e T / c, with reproductive excess e > 0 and cost per substitution c > 0. From it, T is at least c N / e, and a stated time below c N / e contradicts the hypothesis. The hypothesis itself is never proved.',
  notation: 'HaldaneCost N T e c  =>  c N / e <= T',
  context: 'Haldane 1957 (J. Genet. 55:511) put c at about 30 and read it as about one substitution per 300 generations. Carried here so that a candidate accepting the accounting can be checked against it.',
  note: 'Contested since it was published: soft and truncation selection, standing variation and linked substitutions all change c, and the project takes no position. A candidate that does not accept the accounting is not ruled on by it. What is machine-checked is the arithmetic consequence, never the biology of the cost.', paper: null });
formalized.push({ claim_id: 'physiology-q10', theorem: 'Delphi.Physiology.q10_ratio', module: 'lean/Delphi/Physiology.lean', status: buildOk && nonStandard.length === 0 ? 'verified' : 'not verified', derived: true,
  label: 'Q10 temperature scaling: the ratio between two temperatures is Q10 raised to their difference over ten',
  statement: 'For a rate X(T) = X0 Q10^((T - Tref)/10) with X0 nonzero and Q10 > 0, the ratio X(T2)/X(T1) is Q10^((T2 - T1)/10), and the log of that ratio is (T2 - T1)/10 times log Q10, so a Q10 fit is a straight line in log rate against temperature.',
  notation: 'X(T2)/X(T1) = Q10^((T2-T1)/10)', context: 'The form every physiological rate in the simulator chain uses for temperature; the project\'s conditions file fixes 25 C, so no instance is evaluated here.',
  note: 'Pure consequence of the definition: it says nothing about whether any rate follows a Q10 law, and nothing about a value of Q10. No candidate commits a Q10 yet, so no constraint uses it.', paper: null });
formalized.push({ claim_id: 'physiology-laplace', theorem: 'Delphi.Physiology.laplace_pressure_limit', module: 'lean/Delphi/Physiology.lean', status: buildOk && nonStandard.length === 0 ? 'verified' : 'not verified', derived: true,
  label: 'Laplace wall stress: pressure in a thin-walled vessel is limited by wall strength, thickness and radius',
  statement: 'For a thin-walled sphere the wall stress is P r / (2 t) and for a cylinder P r / t; at fixed pressure and thickness the stress grows with radius, and a wall that holds at most sigma_max limits the pressure to 2 sigma_max t / r (sphere) or sigma_max t / r (cylinder).',
  notation: 'sigma = P r / (2 t) <= sigma_max  =>  P <= 2 sigma_max t / r',
  context: 'The standard thin-wall relation, stated for the circulation (a bigger vessel at the same thickness bears more stress at the same pressure).',
  note: 'Thin-wall idealisation, static, no bending or residual stress. No vessel radius, thickness or wall strength for any fish is in this project, so the bound is proved with no instance; it constrains nothing until those are measured.', paper: null });

formalized.push({ claim_id: 'altitude-coupling', theorem: 'Delphi.Altitude.feasible_downward_closed', module: 'lean/Delphi/Altitude.lean', status: buildOk && nonStandard.length === 0 ? 'verified' : 'not verified', derived: true,
  label: 'Demand rises and supply falls with height together, so the flyable heights reach down to the ground',
  statement: 'In an atmosphere where air density and oxygen partial pressure both fall with height, the minimum speed of lift-supported flight and the power to fly at it are nondecreasing in height, while the aerobic supply (with arterial content nondecreasing in partial pressure, as a Hill curve gives) is nonincreasing. Hence sustained flight possible at a height is possible at every lower height; above an infeasible height every height is infeasible, so the flyable set is an interval from the ground up to a ceiling; and a design that cannot fly at the ground cannot fly at any height. A larger lifting area lowers the power required at a fixed height.',
  notation: 'h1 \u2264 h2 and feasible(h2) implies feasible(h1); not feasible(0) implies not feasible(h) for all h \u2265 0',
  context: 'Written for the physics thread\'s truly-flying fish at 1000 m. The atmosphere is a named hypothesis with no numbers; the altitude profile used by the candidates is the physics thread\'s NASA Glenn troposphere fit (physics/flier/tff/tff.json), an explicit design parameter, while the project\'s conditions file stays at sea level.',
  note: 'The DIRECTION of the effect is proved; its SIZE is data and it is gentle (about 30% more required capacity from 0 to 5000 m, arterial content 0.190 to 0.173 ml/ml), and the real fish sits more than thirty times below every boundary at every height. So nothing here supports reading "the feasible region shrinks with altitude" as the reason a fish cannot fly high: the reason is the oxygen budget at sea level. Compensation an animal might make at altitude (haematocrit, ventilation, cardiac output) is held fixed, and no bird data is used.', paper: null });

const proofScope = {
  'altitude-coupling': {
    kernelChecked: [
      'That the minimum speed and the power required at it are nondecreasing in height, given only that air density falls with height.',
      'That the aerobic supply is nonincreasing in height, given only that oxygen partial pressure falls with height and arterial content is nondecreasing in it.',
      'That the feasible heights are downward closed, that infeasibility propagates upward (a ceiling in that sense), and that infeasibility at the ground forces infeasibility everywhere.',
      'That a larger lifting area lowers the power required at a fixed height.'
    ],
    assumed: [
      'A monotone atmosphere: both density and oxygen partial pressure fall with height. No profile, no numbers; the candidates\' profile is the physics thread\'s NASA Glenn fit.',
      'Arterial content nondecreasing in partial pressure (a Hill curve is, but the Hill equation, the Bohr shift and the Root effect are not formalised).',
      'Everything else held fixed with height: the animal makes no compensation (haematocrit, ventilation, cardiac output), and temperature, humidity and wind are outside the model.',
      'The size of the effect is NOT proved: it is gentle, and the binding constraint for the real fish is the aerobic ceiling at sea level.'
    ]
  },
  'genotype-genetic-code': {
    kernelChecked: [
      'The standard code as a 64-case table, hamming distance on codons, and minSubst as the least distance over the codons of the two amino acids.',
      'That no codon pair realises a to b in fewer than minSubst a b substitutions, so a claim below that count is impossible.',
      'Each instance by kernel evaluation of the table: Phe to Leu 1, Trp to Stop 1, Met to Trp 2.'
    ],
    assumed: [
      'The standard genetic code. Mitochondrial and variant codes differ; selenocysteine insertion and RNA editing are outside the table.',
      'One codon per position, substitutions within that codon; frameshifts, indels and multi-codon changes are not modelled.',
      'That reachability in the code is only reachability: nothing here says a substitution occurred, was favoured, or had the claimed effect.'
    ]
  },
  'genotype-pleiotropy-closure': {
    kernelChecked: ['That the Boolean list-inclusion check is sound (its truth implies every mapped node is changed) and that a single missing node makes it false.'],
    assumed: [
      'That the nodes the genotype map links a gene to are the nodes an edit may change: a bound on what a picture may omit, not a model of development.',
      'That an unstudied node is absent from the map: the closure is only as complete as the sources behind it (ZFIN, Bgee), and the fin subtree is zebrafish anatomy.',
      'Nothing about magnitude: the check cannot say how much any node changes, or in which direction.'
    ]
  },
  'genotype-developmental-ordering': {
    kernelChecked: [
      'That a develops_from graph whose Boolean stage check passes has every derivative staged strictly after its precursor, and is acyclic.',
      'The fin subtree\'s 8 edges with both stages recorded, by kernel evaluation of the checker on those stages.'
    ],
    assumed: [
      'That the ZFIN stage-series ids order development (they are assigned in order for the main series).',
      'That develops_from means the derivative appears no earlier than its precursor.',
      'The 4 edges with an unknown stage are not certified, and nothing here concerns the flying fish.'
    ]
  },
  'genotype-substitution-time': {
    kernelChecked: [
      'That the expected time for N substitutions at rate M mu u is N/(M mu u), and that for 1/M <= u <= 1 it lies between N/(M mu) and N/mu, with equality at N/mu for the neutral u = 1/M.',
      'That an available time below N/(M mu) contradicts the model even with every mutant fixing.'
    ],
    assumed: [
      'Independent sequential fixations at Kimura\'s definition rate with constant M, mu and u: no linkage, no standing variation, no recombination of partial solutions.',
      'That the number of required substitutions is given. It is not defined for any wing claim here, which is why this bound eliminates nothing about the flying fish.',
      'Nothing about whether the required substitutions exist, are favoured, or produce the trait.'
    ]
  },
  'haldane-cost-of-selection': {
    kernelChecked: ['That the hypothesis HaldaneCost N T e c (N <= e T / c, c > 0, e >= 0) with e > 0 implies T >= c N / e, and that a time below c N / e contradicts it.'],
    assumed: [
      'Haldane 1957\'s cost accounting itself, which is NOT proved here and has been contested since publication (soft selection, truncation selection, standing variation and linked substitutions all change the cost).',
      'A value for the cost per substitution c and the reproductive excess e; the project supplies neither for any real population.',
      'That the candidate accepts the accounting: one that rejects it is not ruled on.'
    ]
  },
  'physiology-q10': {
    kernelChecked: ['That X(T) = X0 Q10^((T - Tref)/10) gives ratio Q10^((T2-T1)/10) between two temperatures, and a straight line in log rate against temperature.'],
    assumed: ['That a rate follows a Q10 law at all, and a value of Q10: both are inputs. The project\'s conditions fix 25 C and no candidate commits a Q10, so no instance is evaluated.']
  },
  'physiology-laplace': {
    kernelChecked: ['That thin-wall stress P r/(2t) (sphere) and P r/t (cylinder) grow with radius at fixed pressure and thickness, and that a wall strength sigma_max limits pressure to 2 sigma_max t/r and sigma_max t/r.'],
    assumed: ['The thin-wall idealisation, static loading, no bending or residual stress.', 'A radius, a wall thickness and a wall strength: none exists in this project for any fish, so the bound is proved with no instance.']
  },
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
  'scaling-area-law': {
    kernelChecked: ['If S L = k L^2 for all L > 0 (AreaLaw) then S(L2)/S(L1) = (L2/L1)^2 and log S(L2)/S(L1) = 2 log(L2/L1) (areaLaw_ratio, areaLaw_log).', 'With CubeLaw W: (W/S)(L2)/(W/S)(L1) = L2/L1, exponent 1 (wingLoading_ratio, wingLoading_log).'],
    assumed: ['Isometry of the area and of the mass (constant density): named hypotheses, measured to fail within one flying-fish species (Davenport 1992).', 'Nothing about which family is isometric; the theorems bound only families that are.']
  },
  'scaling-strength-law': {
    kernelChecked: ['F_break = σ A: with AreaLaw A and σ > 0, F_break(L2)/F_break(L1) = (L2/L1)^2 (breakLoad_ratio).', 'With CubeLaw W: F_break/W = σ k3/(k1 L) (safetyFactor_eq); the safety factor of the scaled body is the reference one divided by the length ratio (safetyFactor_scaled); stress W/A scales as L2/L1 (stress_ratio).', 'Above L_max = σ k3/(k1 n) the member cannot carry n body weights (cannot_carry).'],
    assumed: ['Axial loading (bending has the same L^2 dependence with a different constant; not formalised).', 'Isometric load-bearing sections and the same material (constant σ): real animals thicken bones with size.', 'Nothing about any real giant: the checker rules only on a candidate that commits to isometry, the same material and a safety factor.']
  },
  'flight-allometry-law': {
    kernelChecked: ['PowerLaw f a b ⇒ f(L2)/f(L1) = (L2/L1)^b and log exponent b (powerLaw_ratio, powerLaw_log).', 'Quotients: PowerLaw (f/g) (a1/a2) (b1 − b2) (powerLaw_div); CubeLaw is PowerLaw with b = 3 (cubeLaw_powerLaw).', 'Under PowerLaw W and PowerLaw S with constant ρ, C_L,max: the v_min log exponent is (bW − bS)/2 (vmin_powerLaw_log).'],
    assumed: ['That weight and area follow single power laws over the size range in question with the exponents committed; the fitted exponents are separate regressions with their own errors.', 'Nothing measured for Exocoetidae enters a statement; the exponents are candidate inputs.']
  },
  'flight-climb-glide-law': {
    kernelChecked: ['Power balance P_avail = P_req + W c + loss with loss ≥ 0 ⇒ c ≤ (P_avail − P_req)/W (climbRate_le); 0 ≤ (P_avail − P_req)/W ⇔ P_req ≤ P_avail (climb_nonneg_iff).', 'Energy balance W h = D x + loss, loss ≥ 0, lift = W, L/D ≤ (L/D)max ⇒ x ≤ h (L/D)max (glide_range_le); with drag (1 − δ) D ⇒ x ≤ h (L/D)max/(1 − δ) (glide_range_le_groundEffect).'],
    assumed: ['A single steady glide with no thrust and lift equal to weight; taxiing, repeated touch-and-go, wind and updrafts are outside the model.', 'Losses non-negative; the ground-effect fraction δ and (L/D)max are inputs.']
  },
  'aerobic-power-bound': {
    kernelChecked: ['η E Q (Ca − Cv) ≤ η E Q Ca for Cv ≥ 0 (aerobic_le_Ca); ≤ E Q Ca for η ≤ 1 (aerobic_le_metabolic); P ≤ aerobicPower ⇒ P ≤ η E Q Ca (sustained_le).', 'P_req ≤ P ≤ aerobicPower ⇒ P_req ≤ η E Q Ca (sustained_flight_requires); climb under aerobic supply c ≤ (η E Q Ca − P_req)/W (climb_le_aerobic).', 'PowerLaw demand and supply with b_supply < b_demand ⇒ ∃ L* > 0, ∀ L > L*, supply < demand (powerLaw_crossover).'],
    assumed: ['Fick: O2 delivered = Q (Ca − Cv); the oxycaloric equivalent E converts O2 to metabolic power; mechanical power is at most η times it; sustained power is aerobic (anaerobic bursts, oxygen debt, and the glide phase, which needs no muscle power, are outside).', '0 ≤ Cv ≤ Ca, 0 ≤ η ≤ 1, Q, E ≥ 0; the supply exponent is whatever the physiology gives, not derived here.']
  },
  'scaling-bending-law': {
    kernelChecked: ['R9a: with CubeLaw F, LeverLaw ℓ and SectionModulusLaw Z, σ_b(L2)/σ_b(L1) = L2/L1, log exponent 1 (bendingStress_ratio_body, bendingStress_log_body); σ_max/σ_b = σ_max k_Z/(k_F k_ℓ L) (bendingSafety_eq); above σ_max k_Z/(k_F k_ℓ n) the stress at n times the load exceeds σ_max (bending_cannot_carry).', 'R9b: with AreaLaw F instead, σ_b(L2)/σ_b(L1) = 1, log exponent 0 (bendingStress_ratio_sheet, bendingStress_log_sheet): no size limit follows.'],
    assumed: ['Slender linear-elastic (Euler-Bernoulli) beam; σ_b = M_b/Z with a point load at the free end (a distributed load changes the constant, not the L-dependence).', 'Geometrically similar sections (Z = k_Z d^3, d ∝ L) and lever arm ∝ L; elastic similarity (d ∝ ℓ^(3/2)) is a different hypothesis family, not formalised.', 'Constant σ_max; static loads only (wind on a leaf is outside the model); which load family applies (R9a or R9b) is empirical and must be committed by the candidate.']
  },
  'thompson1917-ch02-06': {
    kernelChecked: ['Exact: lift = ½ ρ v² S C_L equal to weight with 0 < C_L ≤ C_L,max implies v ≥ sqrt(2W/(ρ S C_L,max)) (vmin_le).', 'Under R1, R2, constant ρ and C_L,max: v_min(L2)/v_min(L1) = sqrt(L2/L1), log exponent 1/2 (vmin_ratio, vmin_log).', 'With constant L/D, power required at v_min: ratio (L2/L1)^3 sqrt(L2/L1), log exponent 7/2 (powerRequired_ratio, powerRequired_log).', 'Under MusclePowerLaw (named hypothesis) and R1: power available ratio (L2/L1)^3 (powerAvailable_ratio); P_req/P_avail = c sqrt(L) with an explicit c (powerRatio_eq).'],
    assumed: ['Constant C_L,max across sizes (Reynolds effects change it), constant ρ, constant L/D, and flight at v_min rather than a faster, more efficient speed.', 'The muscle premise of Thompson (muscle fraction f and mass-specific power p constant) is contested: contraction frequency falls with size, so the modern expectation is an exponent below 3. It is carried as a hypothesis, never proved or asserted.', 'The physics thread found one Cypselurus hiraii specimen inside its v_min envelope (v_min 9.85 m/s against field speeds 10-20 m/s) but could not test the sqrt(W/S) scaling with its data; the theorems are statements about the model, not confirmed facts.']
  },
  'thompson1917-ch02-07': {
    kernelChecked: ['Under R1, R2, constant ρ, C_L,max, L/D and MusclePowerLaw there is a size L* > 0 such that for every L > L*, P_avail(L) < P_req(L) at v_min (exists_size_limit, with L* = 1/c² for the explicit c of powerRatio_eq).'],
    assumed: ['Everything in thompson1917-ch02-06, and that the family extends to the size in question with unchanged proportions.', 'The value of L* needs f, p, L/D, ρ and C_L,max; the proof supplies none, so nothing here places the ostrich, the moa or a man-sized bird above it.']
  },
  'thompson1917-ch02-10': {
    kernelChecked: ['Flight: v_min(L2)/v_min(L1) = sqrt(L2/L1) under R1, R2, constant ρ and C_L,max (vmin_ratio).', 'Swimming: at equal Froude number v = sqrt(Fr g L), so v(L2)/v(L1) = sqrt(L2/L1) (froude_ratio).'],
    assumed: ['That the compared animals move at equal Froude number, or fly at v_min with the same ρ and C_L,max.', 'The walking route (the leg as a pendulum) is not formalised.']
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
const extraLedgers = [['flier', 'lean/eliminate/ledger.flier.json', 'physics/flier/lean-candidate.json (the physics thread\'s hypothetical flier F1 and the real fish, C9)'], ['physiology', 'lean/eliminate/ledger.physiology.json', 'lean/eliminate/physiology-candidates.json (C14 with the physiology chain\'s own proxies: the question of physics test 4)'], ['empirical', 'lean/eliminate/ledger.empirical.json', 'lean/empirical/empirical-candidates.json (the empirical constraints E2, E3, E4 and E7; every elimination here is conditional on the observation named in the row)'], ['tff', 'lean/eliminate/ledger.tff.json', 'lean/eliminate/tff-candidates.json (the physics thread\'s truly-flying-fish v2 at 1000 m, translated: C9 minimum speed and C14b the aerobic ceiling committed as one number)'], ['genotype', 'lean/eliminate/ledger.genotype.json', 'lean/genotype/genotype-candidates.json (the genotype checks G1-G5: the genetic code, pleiotropy closure, developmental ordering, substitution time and Haldane\'s cost)']]
  .filter(([, f]) => fs.existsSync(path.join(root, f))).map(([name, f, about]) => { const doc = JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')); return { name, file: f, about, summary: doc.summary, ledger: doc.ledger }; });

// 7d. Flying-fish audit (lean/flying-fish/audit.mjs): every theorem against Exocoetidae, and the morphology grounding.
const ffAuditFile = path.join(here, 'flying-fish-audit.json'), ffGroundFile = path.join(here, 'morphology-grounding.json');
const ffAudit = fs.existsSync(ffAuditFile) ? JSON.parse(fs.readFileSync(ffAuditFile, 'utf8')) : null;
const ffGround = fs.existsSync(ffGroundFile) ? JSON.parse(fs.readFileSync(ffGroundFile, 'utf8')) : null;
const flyingFishAudit = ffAudit ? { summary: ffAudit.summary, rows: ffAudit.theorems.map(t => ({ theorem: t.theorem, module: t.module, appliesClass: t.appliesClass, verdict: t.verdict, qualifier: t.qualifier, why: t.why, inputs: t.inputs.map(i => ({ name: i.name, status: (i.status || '').split(' ')[0], value: i.value ?? null })) })), grounding: ffGround ? ffGround.summary : null, files: { audit: 'lean/flying-fish-audit.json', markdown: 'lean/AUDIT-FLYING-FISH.md', grounding: 'lean/morphology-grounding.json' } } : null;

// 7e. Genotype inputs the checks run on: the developmental certificate and the gene reach of the closure check.
const devCertFile = path.join(here, 'genotype/dev-certificate.json'), geneNodesFile = path.join(here, 'genotype/gene-nodes.json');
const genotype = fs.existsSync(devCertFile) || fs.existsSync(geneNodesFile) ? {
  development: fs.existsSync(devCertFile) ? (() => { const d = JSON.parse(fs.readFileSync(devCertFile, 'utf8')); return { file: 'lean/genotype/dev-certificate.json', source: d.source, leanModule: d.leanModule, theorems: d.theorems, stageOrder: d.stageOrder, edges: d.edges, certifiedEdges: d.certifiedEdges, unknownStageEdges: d.unknownStageEdges, compile: d.compile, kernelChecked: d.kernelChecked, assumed: d.assumed }; })() : null,
  geneReach: fs.existsSync(geneNodesFile) ? (() => { const g = JSON.parse(fs.readFileSync(geneNodesFile, 'utf8')); return { file: 'lean/genotype/gene-nodes.json', source: g.source, rule: g.rule, genesInSource: g.allGenes, genes: Object.entries(g.genes).map(([symbol, v]) => ({ symbol, nodeCount: v ? v.nodeCount : null, nodes: v ? v.nodes.map(n => ({ term: n.term, label: n.label, linkTypes: n.linkTypes })) : null, note: v ? null : 'not linked by any direct row in the source' })) }; })() : null,
  code: { file: 'lean/genotype/code.mjs', note: 'the same 64-codon table as lean/Delphi/Genotype.lean, in JavaScript, so the ledger and the browser checker evaluate the function the kernel evaluates; self-checked against the three Lean examples' }
} : null;

// 7f. The empirical layer (lean/empirical.json, lean/Delphi/Empirical.lean): observations carried as Lean
// structures rather than axioms, each with the entry a reader would reject to drop the eliminations that
// depend on it, and the non-vacuity witness that the set is jointly satisfiable.
const empFile = path.join(root, 'lean/empirical.json');
const empirical = fs.existsSync(empFile) ? (() => {
  const E = JSON.parse(fs.readFileSync(empFile, 'utf8'));
  const witness = axioms.find(a => a.theorem === E.nonVacuity.theorem) || null;
  return { built: E.built, module: E.module, framing: E.framing, counts: E.counts, leanNumbersChecked: E.leanNumbersChecked || null,
    nonVacuity: { ...E.nonVacuity, witnessAxioms: witness ? witness.axioms : null, witnessVerified: !!witness && buildOk },
    entries: E.entries.map(e => ({ ...e, leanAxioms: (e.lean && e.lean.theorems ? e.lean.theorems : []).map(t => ({ theorem: t, axioms: (axioms.find(a => a.theorem === t) || {}).axioms ?? null })) })),
    noAxiomDeclared: !/^axiom /m.test(fs.readFileSync(path.join(root, 'lean/Delphi/Empirical.lean'), 'utf8')) };
})() : null;

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
  nanopubs, bound, blueprintCertificates, thompsonTest, constraints, eliminations, eliminationsOpenProblems, extraLedgers, flyingFishAudit, genotype, empirical,
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
    flyingFishAuditTheorems: flyingFishAudit ? flyingFishAudit.rows.length : 0, flyingFishAuditVerdicts: flyingFishAudit ? flyingFishAudit.summary.verdicts : null, morphologyObjects: flyingFishAudit && flyingFishAudit.grounding ? flyingFishAudit.grounding.objects : 0, morphologyObjectsWithTheorems: flyingFishAudit && flyingFishAudit.grounding ? flyingFishAudit.grounding.withTheorems : 0,
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
