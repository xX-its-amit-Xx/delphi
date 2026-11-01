#!/usr/bin/env node
// Checks candidates against the formalised constraints and writes a ledger with three states per
// (candidate, constraint): eliminated, consistent, cannot-rule.
//   node lean/eliminate/eliminate.mjs <candidates.json> [--out <ledger.json>] [--lean <Certificates/Name.lean>]
// Input: { candidates: [ { id, problem, description, source?, accepts: [assumption flags], commits: { quantity: value } } ] }
// where a value is a number, an exact decimal or fraction string ("1e-9", "4/103"), or {low, high}.
// Arithmetic is exact (BigInt rationals). For every elimination whose constraint is marked kernelCheckable,
// a theorem is generated in lean/Delphi/Certificates/<Name>.lean that instantiates the matching lemma of
// lean/Delphi/Constraints.lean with the candidate's numbers and discharges the arithmetic by norm_num; the
// file is compiled and each elimination records whether the kernel accepted its theorem.
// "consistent" means only "not ruled out by these constraints"; nothing here says a candidate is possible.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const leanDir = path.resolve(here, '..');
const root = path.resolve(here, '../..');
const argv = process.argv.slice(2);
const file = argv.find(a => !a.startsWith('--'));
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
if (!file) { console.error('usage: node lean/eliminate/eliminate.mjs <candidates.json> [--out ledger.json] [--lean Certificates/Eliminations.lean]'); process.exit(2); }
const outFile = opt('out', path.join(here, 'ledger.json'));
const leanRel = opt('lean', 'Delphi/Certificates/Eliminations.lean');
const CONSTRAINTS = JSON.parse(fs.readFileSync(path.join(root, 'lean/constraints.json'), 'utf8'));
const CAND = JSON.parse(fs.readFileSync(file, 'utf8'));
// The standard genetic code (the same table lean/Delphi/Genotype.lean tabulates) and the gene -> nodes map.
const { aminoAcid, minSubst, witness, LEAN_AA } = await import('../genotype/code.mjs');
const geneNodesFile = path.join(root, 'lean/genotype/gene-nodes.json');
const GENE_NODES = fs.existsSync(geneNodesFile) ? JSON.parse(fs.readFileSync(geneNodesFile, 'utf8')) : { genes: {} };
const leanStrList = xs => '[' + xs.map(x => JSON.stringify(String(x))).join(', ') + ']';

// ---- exact rationals ----
const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
const Q = (n, d = 1n) => { if (d === 0n) throw new Error('zero denominator'); if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d) || 1n; return { n: n / g, d: d / g }; };
const parseQ = v => {
  if (typeof v === 'number') v = v.toString();
  if (typeof v !== 'string') throw new Error('not a number: ' + JSON.stringify(v));
  const f = v.match(/^\s*([+-]?\d+)\s*\/\s*(\d+)\s*$/); if (f) return Q(BigInt(f[1]), BigInt(f[2]));
  const m = v.match(/^\s*([+-])?(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?\s*$/); if (!m) throw new Error('cannot parse number: ' + v);
  const sign = m[1] === '-' ? -1n : 1n, ip = m[2], fp = m[3] || '', ex = Number(m[4] || 0);
  let n = BigInt(ip + fp) * sign, d = 10n ** BigInt(fp.length);
  if (ex >= 0) n *= 10n ** BigInt(ex); else d *= 10n ** BigInt(-ex);
  return Q(n, d);
};
const cmp = (a, b) => { const l = a.n * b.d, r = b.n * a.d; return l < r ? -1 : l > r ? 1 : 0; };
const mul = (a, b) => Q(a.n * b.n, a.d * b.d), sub = (a, b) => Q(a.n * b.d - b.n * a.d, a.d * b.d), div = (a, b) => Q(a.n * b.d, a.d * b.n);
const powQ = (a, k) => { let r = Q(1n); for (let i = 0; i < k; i++) r = mul(r, a); return r; };
const fromInt = k => Q(BigInt(k));
const str = q => q.d === 1n ? q.n.toString() : `${q.n}/${q.d}`;
const lean = q => q.d === 1n ? `(${q.n} : ℝ)` : `(${q.n} / ${q.d} : ℝ)`;
const interval = v => (v && typeof v === 'object' && !Array.isArray(v)) ? { low: parseQ(v.low), high: parseQ(v.high) } : (() => { const q = parseQ(v); return { low: q, high: q }; })();
const isPoint = v => !(v && typeof v === 'object' && !Array.isArray(v)) || String(v.low) === String(v.high);
const natural = v => { const q = parseQ(v); if (q.d !== 1n || q.n < 0n) throw new Error('not a natural number: ' + v); return q.n; };

// ---- per-constraint rules; each returns {state, reason, numbers?, violated?, cert?} ----
const need = (c, cand, qs) => { for (const q of qs) if (!(q in cand.commits)) return `cannot rule: missing input ${q} (${CONSTRAINTS.quantities[q]?.unit || ''})`; return null; };
const accepts = (c, cand) => { for (const a of c.appliesWhen) if (!(cand.accepts || []).includes(a)) return `cannot rule: the candidate does not commit to the model assumption ${a} (${CONSTRAINTS.assumptions[a]})`; return null; };
const expRule = (c, cand, tn, qty, target, targetStr, build) => {
  const b = interval(cand.commits[qty]); const numbers = { exponent: [str(b.low), str(b.high)] };
  if (cmp(b.high, target) < 0 || cmp(target, b.low) < 0) return { state: 'eliminated', reason: `under the stated hypotheses the exponent is exactly ${targetStr}`, violated: cmp(b.high, target) < 0 ? `b ≤ ${str(b.high)} < ${targetStr}` : `${targetStr} < ${str(b.low)} ≤ b`, numbers, cert: build(b) };
  return { state: 'consistent', reason: `the committed exponent interval contains ${targetStr}`, numbers };
};
const ptRatio = (c, cand, tn, qty, pow, build, lenCheck) => {
  if (!isPoint(cand.commits[qty]) || !isPoint(cand.commits.length_ratio)) return { state: 'cannot-rule', reason: `cannot rule: ${c.id} needs exact (point) values for length_ratio and ${qty}` };
  const r = parseQ(cand.commits[qty]), l = parseQ(cand.commits.length_ratio);
  if (cmp(l, Q(0n)) <= 0) return { state: 'cannot-rule', reason: 'cannot rule: length_ratio must be positive' };
  const target = powQ(l, pow); const numbers = { [qty]: str(r), length_ratio: str(l), [`length_ratio^${pow}`]: str(target) };
  if (cmp(r, target) === 0) return { state: 'consistent', reason: `the committed ratio equals length_ratio^${pow}, as the theorem gives`, numbers };
  return { state: 'eliminated', reason: `under the stated hypotheses the ratio is exactly length_ratio^${pow}`, violated: `${qty} = ${str(r)} ≠ ${str(target)} = length_ratio^${pow}`, numbers, cert: build(r, l) };
};
const sqRatio = (c, cand, tn, qty, build) => {
  if (!isPoint(cand.commits[qty]) || !isPoint(cand.commits.length_ratio)) return { state: 'cannot-rule', reason: `cannot rule: ${c.id} needs exact (point) values for length_ratio and ${qty}` };
  const r = parseQ(cand.commits[qty]), l = parseQ(cand.commits.length_ratio);
  if (cmp(l, Q(0n)) <= 0 || cmp(r, Q(0n)) < 0) return { state: 'cannot-rule', reason: 'cannot rule: length_ratio must be positive and the speed ratio nonnegative' };
  const r2 = powQ(r, 2); const numbers = { [qty]: str(r), [`${qty}^2`]: str(r2), length_ratio: str(l) };
  if (cmp(r2, l) === 0) return { state: 'consistent', reason: 'the committed ratio is the square root of the length ratio, as the theorem gives', numbers };
  return { state: 'eliminated', reason: 'under the stated hypotheses the ratio is exactly sqrt(length_ratio)', violated: `${qty}^2 = ${str(r2)} ≠ ${str(l)} = length_ratio`, numbers, cert: build(r, l) };
};
const rules = {
  E2(c, cand, tn) {
    const band = { lo: Q(29n, 10n), hi: Q(302n, 100n) };
    const bint = interval(cand.commits.loglog_exponent);
    const numbers = { exponent: [str(bint.low), str(bint.high)], band: ['29/10', '302/100'] };
    if (cmp(bint.high, band.lo) < 0 || cmp(band.hi, bint.low) < 0) return { state: 'eliminated', reason: 'no fitted flying-fish study in the project\'s table has a mass exponent there (the band is [2.90, 3.02] over six fitted rows, the male-only outlier excluded and named)', violated: cmp(bint.high, band.lo) < 0 ? `b \u2264 ${str(bint.high)} < 2.90` : `3.02 < ${str(bint.low)} \u2264 b`, numbers,
      cert: `theorem ${tn} : \u00ac \u2203 M : Delphi.Empirical.MassExponentBand, ${lean(bint.low)} \u2264 M.b \u2227 M.b \u2264 ${lean(bint.high)} := by\n  rintro \u27e8M, h1, h2\u27e9\n  have hlo := M.lo\n  have hhi := M.hi\n  norm_num at h1 h2 hlo hhi\n  linarith` };
    return { state: 'consistent', reason: 'the committed exponent interval meets the measured band', numbers };
  },
  E3(c, cand, tn) {
    // E3 v2.0.0 (law set 1.6.0): eta <= 0.23, Q*Ca <= 0.0187 ml O2/s at 0.06 kg (measured zebrafish MO2max, Palstra 2010,
    // scaled to 60 g), ceiling 0.0833 W. v1.0.0 (0.0458 W, "every teleost") was withdrawn: physics/FICK-CEILING-CHECK.md.
    if (!isPoint(cand.commits.power_required_W)) return { state: 'cannot-rule', reason: 'cannot rule: E3 needs an exact power required' };
    const preq = parseQ(cand.commits.power_required_W), ceil = Q(833n, 10000n);
    const numbers = { 'power required (W)': str(preq), 'ceiling inside the widened E3 v2 ranges at 0.06 kg (W)': '0.0833' };
    if (cmp(ceil, preq) < 0) return { state: 'eliminated', reason: 'above the sustained aerobic ceiling of every animal inside the E3 v2 ranges at this mass (efficiency up to 0.23, O2 delivery up to the measured zebrafish MO2max scaled to 60 g), not only of the proxies a candidate happens to commit', violated: `P_req = ${str(preq)} W > 0.0833 W`, numbers,
      cert: `theorem ${tn} (T : Delphi.Empirical.TeleostAerobicV2) (W v LD P Q Ca Cv : \u211d) (hQ : 0 \u2264 Q) (hCv : 0 \u2264 Cv)\n    (hdel : Q * Ca \u2264 T.o2Delivery)\n    (hsus : P \u2264 Delphi.aerobicPower T.eta T.oxycaloric Q Ca Cv)\n    (hfl : Delphi.powerRequired W v LD \u2264 P) (hval : Delphi.powerRequired W v LD = ${lean(preq)}) : False :=\n  Delphi.Empirical.no_aerobic_flight_above_ceiling_v2 T hQ hCv hdel hsus hfl (by rw [hval]; norm_num)` };
    return { state: 'consistent', reason: 'within the ceiling the E3 v2 ranges allow; nothing about burst power or about whether this animal exists', numbers };
  },
  E4(c, cand, tn) {
    const q = ['power_required_W', 'oxycaloric_equivalent_J_per_unit_O2', 'o2_store_ml', 'flight_duration_s'];
    if (!q.every(x => isPoint(cand.commits[x]))) return { state: 'cannot-rule', reason: 'cannot rule: E4 needs exact (point) values' };
    const [preq, Eo2, S, t] = q.map(x => parseQ(cand.commits[x]));
    if (cmp(t, Q(0n)) <= 0) return { state: 'cannot-rule', reason: 'cannot rule: the flight duration must be positive' };
    const bound = div(mul(Eo2, S), t);
    const numbers = { 'power required (W)': str(preq), 'store (ml O2)': str(S), 'oxycaloric (J/ml)': str(Eo2), 'duration (s)': str(t), 'E S / t (W)': str(bound) };
    if (cmp(bound, preq) < 0) return { state: 'eliminated', reason: 'with no gill uptake in air, the store carried into the air cannot pay for this power over this duration (aerobically; burst power on white-muscle stores is outside the model)', violated: `P_req = ${str(preq)} W > E S / t = ${str(bound)} W`, numbers,
      cert: `theorem ${tn} (U : Delphi.Empirical.NoAerialUptake) (P : \u211d) (hspend : P * ${lean(t)} \u2264 ${lean(Eo2)} * ${lean(S)}) (hclaim : ${lean(preq)} \u2264 P) : False :=\n  absurd (le_trans hclaim (Delphi.Empirical.stored_power_le U (by norm_num) hspend)) (by norm_num)` };
    return { state: 'consistent', reason: 'the store covers the claimed flight at this power', numbers };
  },
  E7(c, cand, tn) {
    const d = Number(natural(cand.commits.death_stage_hpf)), s = Number(natural(cand.commits.phenotype_scored_hpf));
    const numbers = { death_hpf: d, scored_hpf: s };
    if (d <= s) return { state: 'eliminated', reason: 'the source reports the animal dead at or before the stage at which the phenotype is scored, so no living animal shows it', violated: `death at ${d} hpf \u2264 scoring at ${s} hpf`, numbers,
      cert: `theorem ${tn} : \u00ac Delphi.Empirical.CanScore ${d} ${s} := Delphi.Empirical.cannot_score_of_lethal_before (by norm_num)` };
    return { state: 'consistent', reason: 'the animal is alive at the scoring stage, so the phenotype can be scored', numbers };
  },
  C14b(c, cand, tn) {
    const q = ['aerobic_ceiling_W', 'power_required_W'];
    if (!q.every(x => isPoint(cand.commits[x]))) return { state: 'cannot-rule', reason: 'cannot rule: C14b needs exact (point) values' };
    const [ceil, preq] = q.map(x => parseQ(cand.commits[x]));
    if (cmp(ceil, Q(0n)) < 0) return { state: 'cannot-rule', reason: 'cannot rule: the ceiling must be nonnegative' };
    const numbers = { 'aerobic ceiling (W)': str(ceil), 'power required (W)': str(preq), 'shortfall factor': cmp(ceil, Q(0n)) > 0 ? (Number(preq.n) / Number(preq.d)) / (Number(ceil.n) / Number(ceil.d)) : null };
    if (cmp(ceil, preq) < 0) return { state: 'eliminated', reason: 'the oxygen budget cannot pay for the power this flight needs; sustained flight cannot be aerobic at these numbers', violated: `ceiling = ${str(ceil)} W < P_req = ${str(preq)} W`, numbers,
      cert: `theorem ${tn} : ∀ P Cv : ℝ, 0 ≤ Cv → P ≤ Delphi.aerobicPower 1 1 1 ${lean(ceil)} Cv → ${lean(preq)} ≤ P → False :=\n  fun P Cv hCv hsus hfl => absurd (le_trans hfl (Delphi.sustained_le (by norm_num) (by norm_num) (by norm_num) hCv hsus)) (by norm_num)` };
    return { state: 'consistent', reason: 'the committed ceiling covers the committed power required; nothing about burst power, drag estimates or heat', numbers };
  },
  G1(c, cand, tn) {
    const a = aminoAcid(cand.commits.wt_amino_acid), b = aminoAcid(cand.commits.mutant_amino_acid);
    if (!a || !b) return { state: 'cannot-rule', reason: 'cannot rule: G1 needs both amino acids named as in the standard code (three-letter, one-letter, or Stop)' };
    const n = Number(natural(cand.commits.claimed_substitutions));
    const m = minSubst(a, b), w = witness(a, b);
    const numbers = { wt_amino_acid: a, mutant_amino_acid: b, claimed_substitutions: n, minSubst: m, nearest_codon_pair: w ? `${w.wt} -> ${w.mutant}` : null };
    if (n < m) return { state: 'eliminated', reason: `the standard code needs at least ${m} nucleotide substitution(s) to turn any codon of ${a} into any codon of ${b}`, violated: `claimed ${n} < minSubst(${a}, ${b}) = ${m}`, numbers,
      cert: `theorem ${tn} : ¬ ∃ c d : Delphi.Genotype.Codon, Delphi.Genotype.code c = ${LEAN_AA(a)} ∧ Delphi.Genotype.code d = ${LEAN_AA(b)} ∧ Delphi.Genotype.hamming c d ≤ ${n} :=\n  Delphi.Genotype.claimed_substitutions_rules_out (by decide +kernel)` };
    return { state: 'consistent', reason: `the code allows ${a} to ${b} in ${m} substitution(s) (${w ? w.wt + ' to ' + w.mutant : 'some codon pair'}), within the claimed ${n}; reachability in the code is not evidence that this substitution happened`, numbers };
  },
  G2(c, cand, tn) {
    const g = String(cand.commits.gene);
    const entry = GENE_NODES.genes ? GENE_NODES.genes[g] : null;
    if (!entry) return { state: 'cannot-rule', reason: `cannot rule: the gene map (lean/genotype/gene-nodes.json) records no direct link for ${g}; an unlisted gene is unstudied in these sources, not unlinked` };
    const changed = Array.isArray(cand.commits.changed_nodes) ? cand.commits.changed_nodes.map(String) : null;
    if (!changed) return { state: 'cannot-rule', reason: 'cannot rule: changed_nodes must be a list of anatomy terms' };
    const mapped = entry.nodes.map(n => n.term);
    const label = t => (entry.nodes.find(n => n.term === t) || {}).label || t;
    const missed = mapped.filter(t => !changed.includes(t));
    const numbers = { gene: g, mapped_nodes: mapped.length, changed_nodes: changed.length, missed_nodes: missed.length, missed: missed.map(t => `${t} (${label(t)})`) };
    if (missed.length) return { state: 'eliminated', reason: `the map links ${g} to ${mapped.length} node(s); an edit shown as changing only ${changed.length} hides ${missed.length} of them`, violated: `${missed.map(t => label(t)).join('; ')} not among the changed nodes`, numbers,
      cert: `theorem ${tn} : Delphi.Genotype.closureB ${leanStrList(mapped)} ${leanStrList(changed)} = false :=\n  @Delphi.Genotype.closure_violated ${leanStrList(mapped)} ${leanStrList(changed)} ${JSON.stringify(missed[0])} (by decide) (by decide)` };
    return { state: 'consistent', reason: `every node the map links to ${g} is among the changed nodes (${mapped.map(label).join('; ')}); the closure says nothing about how much each node changes`, numbers };
  },
  G3(c, cand, tn) {
    const d = Number(natural(cand.commits.derivative_stage_zfs)), p = Number(natural(cand.commits.precursor_stage_zfs));
    const numbers = { derivative_stage_zfs: d, precursor_stage_zfs: p };
    if (!(p < d)) return { state: 'eliminated', reason: 'a structure cannot be staged at or before the precursor it develops from', violated: `precursor stage ${p} is not earlier than derivative stage ${d}`, numbers,
      cert: `theorem ${tn} : Delphi.Genotype.devOrderedB ({ nodes := [0, 1], root := 1, level := fun i => ([${d}, ${p}] : List ℕ).getD i 0, partOf := [(0, 1)] } : Delphi.Blueprint.Graph ℕ) = false := by decide +kernel` };
    return { state: 'consistent', reason: 'the derivative is staged strictly after its precursor, as develops_from requires', numbers };
  },
  G4(c, cand, tn) {
    const N = parseQ(cand.commits.required_substitutions), M = natural(cand.commits.gene_copies_M), mu = interval(cand.commits.mutation_rate), T = parseQ(cand.commits.generations_T);
    if (M <= 0n || cmp(mu.high, Q(0n)) <= 0) return { state: 'cannot-rule', reason: 'cannot rule: M > 0 and a positive mutation rate are needed' };
    const muFast = mu.high; // the fastest rate the candidate allows: the most generous reading
    const bound = div(N, mul(Q(M), muFast));
    const numbers = { required_substitutions: str(N), gene_copies_M: M.toString(), 'mutation_rate (fastest committed)': str(muFast), 'N/(M mu), every mutant fixed': str(bound), generations_T: str(T), 'N/mu, neutral': str(div(N, muFast)) };
    if (cmp(T, bound) < 0) return { state: 'eliminated', reason: 'the stated time is below the fastest the model allows, which is every single mutant fixing (u = 1)', violated: `T = ${str(T)} < N/(M mu) = ${str(bound)}`, numbers,
      cert: `theorem ${tn} : ∀ u : ℝ, 1 / ((${M} : ℕ) : ℝ) ≤ u → u ≤ 1 → Delphi.Genotype.expectedWaitingTime ${lean(N)} ${M} ${lean(muFast)} u ≤ ${lean(T)} → False :=\n  fun u hu1 hu2 hclaim => Delphi.Genotype.too_little_time_rules_out (by norm_num) ${M} (by norm_num) ${lean(muFast)} (by norm_num) hu1 hu2 hclaim (by norm_num)` };
    return { state: 'consistent', reason: `the time exceeds N/(M mu) = ${str(bound)}; a very weak consistency, since the neutral case needs N/mu = ${str(div(N, muFast))} and nothing here says the substitutions exist or help`, numbers };
  },
  G5(c, cand, tn) {
    const N = parseQ(cand.commits.required_substitutions), T = parseQ(cand.commits.generations_T), e = parseQ(cand.commits.reproductive_excess), cps = parseQ(cand.commits.cost_per_substitution);
    if (cmp(e, Q(0n)) <= 0 || cmp(cps, Q(0n)) <= 0) return { state: 'cannot-rule', reason: 'cannot rule: a positive reproductive excess and a positive cost per substitution are needed' };
    const bound = div(mul(cps, N), e);
    const numbers = { required_substitutions: str(N), cost_per_substitution: str(cps), reproductive_excess: str(e), 'c N / e': str(bound), generations_T: str(T) };
    if (cmp(T, bound) < 0) return { state: 'eliminated', reason: "Haldane's accounting cannot hold with these numbers: the cost of the substitutions exceeds what the reproductive excess can pay in the stated time (the accounting itself is a hypothesis, contested since 1957)", violated: `T = ${str(T)} < c N / e = ${str(bound)}`, numbers,
      cert: `theorem ${tn} : ¬ Delphi.Genotype.HaldaneCost ${lean(N)} ${lean(T)} ${lean(e)} ${lean(cps)} :=\n  fun h => Delphi.Genotype.haldane_rules_out h (by norm_num) (by norm_num)` };
    return { state: 'consistent', reason: `the stated time exceeds c N / e = ${str(bound)}, so Haldane's accounting is not violated by these numbers`, numbers };
  },
  C13(c, cand, tn) {
    const bW = interval(cand.commits.weight_loglog_exponent), bS = interval(cand.commits.area_loglog_exponent), bWS = interval(cand.commits.stress_loglog_exponent);
    const diff = { low: sub(bW.low, bS.high), high: sub(bW.high, bS.low) };
    const numbers = { bW: [str(bW.low), str(bW.high)], bS: [str(bS.low), str(bS.high)], 'bW - bS': [str(diff.low), str(diff.high)], bWS: [str(bWS.low), str(bWS.high)] };
    if (cmp(bWS.high, diff.low) < 0 || cmp(diff.high, bWS.low) < 0) return { state: 'eliminated', reason: 'wing loading is the quotient of weight and area, so its exponent must be bW − bS', violated: `bWS ∈ [${str(bWS.low)}, ${str(bWS.high)}] is disjoint from bW − bS ∈ [${str(diff.low)}, ${str(diff.high)}]`, numbers,
      cert: `theorem ${tn} : ∀ (W S : ℝ → ℝ) (aW bW aS bS bWS L₁ L₂ : ℝ), Delphi.PowerLaw W aW bW → Delphi.PowerLaw S aS bS → 0 < L₁ → 0 < L₂ → L₁ ≠ L₂ →\n    Real.log ((W L₂ / S L₂) / (W L₁ / S L₁)) = bWS * Real.log (L₂ / L₁) → (${lean(bW.low)} ≤ bW ∧ bW ≤ ${lean(bW.high)}) → (${lean(bS.low)} ≤ bS ∧ bS ≤ ${lean(bS.high)}) → (${lean(bWS.low)} ≤ bWS ∧ bWS ≤ ${lean(bWS.high)}) → False :=\n  fun W S aW bW aS bS bWS L₁ L₂ hW hS h₁ h₂ hne hb rW rS rWS => Delphi.Constraints.allometry_consistency_rules_out hW hS h₁ h₂ hne hb (fun h => by linarith [rW.1, rW.2, rS.1, rS.2, rWS.1, rWS.2])` };
    return { state: 'consistent', reason: 'the committed intervals overlap', numbers };
  },
  C14(c, cand, tn) {
    const q = ['muscular_efficiency', 'oxycaloric_equivalent_J_per_unit_O2', 'cardiac_output', 'arterial_O2_content', 'weight_N', 'airspeed_m_s', 'lift_to_drag'];
    if (!q.every(x => isPoint(cand.commits[x]))) return { state: 'cannot-rule', reason: 'cannot rule: C14 needs exact (point) values' };
    const [eta, E, Qc, Ca, W, v, LD] = q.map(x => parseQ(cand.commits[x]));
    if (cmp(eta, Q(0n)) < 0 || cmp(E, Q(0n)) < 0 || cmp(Qc, Q(0n)) < 0 || cmp(LD, Q(0n)) <= 0) return { state: 'cannot-rule', reason: 'cannot rule: η, E, Q ≥ 0 and L/D > 0 are needed' };
    const supply = mul(mul(mul(eta, E), Qc), Ca), preq = div(mul(W, v), LD); const numbers = { 'η E Q Ca': str(supply), 'P_req = W v/(L/D)': str(preq) };
    if (cmp(supply, preq) < 0) return { state: 'eliminated', reason: 'oxygen delivery times efficiency is below the power level flight needs; sustained flight cannot be aerobic', violated: `η E Q Ca = ${str(supply)} < P_req = ${str(preq)}`, numbers,
      cert: `theorem ${tn} : ∀ (P Cv : ℝ), 0 ≤ Cv → P ≤ Delphi.aerobicPower ${lean(eta)} ${lean(E)} ${lean(Qc)} ${lean(Ca)} Cv → Delphi.powerRequired ${lean(W)} ${lean(v)} ${lean(LD)} ≤ P → False :=\n  fun P Cv hCv hsus hfl => Delphi.Constraints.aerobic_flight_rules_out (by norm_num) (by norm_num) (by norm_num) hCv hsus hfl (by unfold Delphi.powerRequired; norm_num)` };
    return { state: 'consistent', reason: 'η E Q Ca ≥ P_req: the oxygen budget can pay for level flight at this speed (nothing about burst power, drag estimates or heat)', numbers };
  },
  C15(c, cand, tn) {
    const q = ['glide_distance_m', 'glide_height_m', 'lift_to_drag_max', 'ground_effect_drag_reduction'];
    if (!q.every(x => isPoint(cand.commits[x]))) return { state: 'cannot-rule', reason: 'cannot rule: C15 needs exact (point) values' };
    const [x, h, LD, d] = q.map(y => parseQ(cand.commits[y]));
    if (cmp(h, Q(0n)) < 0 || cmp(d, Q(0n)) < 0 || cmp(d, Q(1n)) >= 0) return { state: 'cannot-rule', reason: 'cannot rule: h ≥ 0 and 0 ≤ δ < 1 are needed' };
    const bound = div(mul(h, LD), sub(Q(1n), d)); const numbers = { x: str(x), h: str(h), '(L/D)max': str(LD), 'δ': str(d), 'h (L/D)max/(1-δ)': str(bound) };
    if (cmp(bound, x) < 0) return { state: 'eliminated', reason: 'one steady unpowered glide cannot exceed the energy bound; the claimed distance needs thrust, repeated touch-and-go, wind, or a higher L/D', violated: `x = ${str(x)} > h (L/D)max/(1−δ) = ${str(bound)}`, numbers,
      cert: `theorem ${tn} : ∀ (W D loss Lift : ℝ), 0 < W → 0 < D → Lift = W → Lift / D ≤ ${lean(LD)} → W * ${lean(h)} = (1 - ${lean(d)}) * D * ${lean(x)} + loss → 0 ≤ loss → False :=\n  fun W D loss Lift hW hD hl hLD he hlo => Delphi.Constraints.glide_range_rules_out hW hD (by norm_num) (by norm_num) (by norm_num) hl hLD he hlo (by norm_num)` };
    return { state: 'consistent', reason: 'the claimed distance is within the energy bound of one steady glide', numbers };
  },
  C16(c, cand, tn) {
    const q = ['climb_rate_m_s', 'power_available_W', 'power_required_W', 'weight_N'];
    if (!q.every(x => isPoint(cand.commits[x]))) return { state: 'cannot-rule', reason: 'cannot rule: C16 needs exact (point) values' };
    const [cr, Pa, Pr, W] = q.map(y => parseQ(cand.commits[y]));
    if (cmp(W, Q(0n)) <= 0) return { state: 'cannot-rule', reason: 'cannot rule: weight must be positive' };
    const bound = div(sub(Pa, Pr), W); const numbers = { c: str(cr), '(P_avail - P_req)/W': str(bound) };
    if (cmp(bound, cr) < 0) return { state: 'eliminated', reason: 'the climb rate exceeds what the excess power can lift', violated: `c = ${str(cr)} > (P_avail − P_req)/W = ${str(bound)}`, numbers,
      cert: `theorem ${tn} : ∀ loss : ℝ, (${lean(Pa)} : ℝ) = ${lean(Pr)} + ${lean(W)} * ${lean(cr)} + loss → 0 ≤ loss → False :=\n  fun loss hbal hloss => Delphi.Constraints.climb_rules_out (by norm_num) hbal hloss (by unfold Delphi.climbRate; norm_num)` };
    return { state: 'consistent', reason: 'the claimed climb rate is within the excess power', numbers };
  },
  C12: (c, cand, tn) => expRule(c, cand, tn, 'bending_stress_loglog_exponent', Q(1n), '1', b => `theorem ${tn} : ∀ (F ℓ Z : ℝ → ℝ) (kF kℓ kZ L₁ L₂ b : ℝ), Delphi.CubeLaw F kF → Delphi.LeverLaw ℓ kℓ → Delphi.SectionModulusLaw Z kZ → 0 < L₁ → 0 < L₂ → L₁ ≠ L₂ →\n    Real.log (Delphi.bendingStress F ℓ Z L₂ / Delphi.bendingStress F ℓ Z L₁) = b * Real.log (L₂ / L₁) → (${lean(b.low)} ≤ b ∧ b ≤ ${lean(b.high)}) → False :=\n  fun F ℓ Z kF kℓ kZ L₁ L₂ b hF hℓ hZ h₁ h₂ hne hb hr => Delphi.Constraints.bending_exponent_rules_out hF hℓ hZ h₁ h₂ hne hb (fun h => by linarith [hr.1, hr.2])`),
  C12b: (c, cand, tn) => ptRatio(c, cand, tn, 'bending_stress_ratio', 1, (r, l) => `theorem ${tn} : ∀ (F ℓ Z : ℝ → ℝ) (kF kℓ kZ L₁ L₂ : ℝ), Delphi.CubeLaw F kF → Delphi.LeverLaw ℓ kℓ → Delphi.SectionModulusLaw Z kZ → 0 < L₁ → 0 < L₂ →\n    Delphi.bendingStress F ℓ Z L₂ / Delphi.bendingStress F ℓ Z L₁ = ${lean(r)} → L₂ / L₁ = ${lean(l)} → False :=\n  fun F ℓ Z kF kℓ kZ L₁ L₂ hF hℓ hZ h₁ h₂ hr hq => Delphi.Constraints.bending_ratio_rules_out hF hℓ hZ h₁ h₂ hr hq (by norm_num)`),
  C12c: (c, cand, tn) => expRule(c, cand, tn, 'bending_stress_loglog_exponent', Q(0n), '0', b => `theorem ${tn} : ∀ (F ℓ Z : ℝ → ℝ) (kF kℓ kZ L₁ L₂ b : ℝ), Delphi.AreaLaw F kF → Delphi.LeverLaw ℓ kℓ → Delphi.SectionModulusLaw Z kZ → 0 < L₁ → 0 < L₂ → L₁ ≠ L₂ →\n    Real.log (Delphi.bendingStress F ℓ Z L₂ / Delphi.bendingStress F ℓ Z L₁) = b * Real.log (L₂ / L₁) → (${lean(b.low)} ≤ b ∧ b ≤ ${lean(b.high)}) → False :=\n  fun F ℓ Z kF kℓ kZ L₁ L₂ b hF hℓ hZ h₁ h₂ hne hb hr => Delphi.Constraints.bending_exponent_sheet_rules_out hF hℓ hZ h₁ h₂ hne hb (fun h => by linarith [hr.1, hr.2])`),
  C2a: (c, cand, tn) => expRule(c, cand, tn, 'area_loglog_exponent', Q(2n), '2', b => `theorem ${tn} : ∀ (S : ℝ → ℝ) (k L₁ L₂ b : ℝ), Delphi.AreaLaw S k → 0 < L₁ → 0 < L₂ → L₁ ≠ L₂ →\n    Real.log (S L₂ / S L₁) = b * Real.log (L₂ / L₁) → (${lean(b.low)} ≤ b ∧ b ≤ ${lean(b.high)}) → False :=\n  fun S k L₁ L₂ b hS h₁ h₂ hne hb hr => Delphi.Constraints.area_exponent_rules_out hS h₁ h₂ hne hb (fun h => by linarith [hr.1, hr.2])`),
  C2b: (c, cand, tn) => ptRatio(c, cand, tn, 'area_ratio', 2, (r, l) => `theorem ${tn} : ∀ (S : ℝ → ℝ) (k L₁ L₂ : ℝ), Delphi.AreaLaw S k → 0 < L₁ → 0 < L₂ →\n    S L₂ / S L₁ = ${lean(r)} → L₂ / L₁ = ${lean(l)} → False :=\n  fun S k L₁ L₂ hS h₁ h₂ hr hℓ => Delphi.Constraints.area_ratio_rules_out hS h₁ h₂ hr hℓ (by norm_num)`),
  C8(c, cand, tn) {
    const q = ['breaking_stress_Pa', 'cross_section_m2', 'weight_N', 'load_in_body_weights'];
    if (!q.every(x => isPoint(cand.commits[x]))) return { state: 'cannot-rule', reason: 'cannot rule: C8 needs exact (point) values' };
    const [sg, A, W, n] = q.map(x => parseQ(cand.commits[x])); const F = mul(sg, A), nW = mul(n, W);
    const numbers = { 'σ': str(sg), A: str(A), W: str(W), n: str(n), 'σA': str(F), 'nW': str(nW) };
    if (cmp(F, nW) < 0) return { state: 'eliminated', reason: 'the member breaks under axial load σ A, which is below the claimed load n W', violated: `σ A = ${str(F)} < n W = ${str(nW)}`, numbers,
      cert: `theorem ${tn} : ∀ F : ℝ, F = ${lean(sg)} * ${lean(A)} → ${lean(n)} * ${lean(W)} ≤ F → False :=\n  fun F hF hclaim => Delphi.Constraints.axial_strength_rules_out hF hclaim (by norm_num)` };
    return { state: 'consistent', reason: 'σ A ≥ n W: the stated member can carry the stated load (nothing about bending, fatigue or buckling)', numbers };
  },
  C8b: (c, cand, tn) => ptRatio(c, cand, tn, 'breaking_load_ratio', 2, (r, l) => `theorem ${tn} : ∀ (A : ℝ → ℝ) (k₃ σ L₁ L₂ : ℝ), Delphi.AreaLaw A k₃ → 0 < σ → 0 < L₁ → 0 < L₂ →\n    Delphi.breakLoad σ A L₂ / Delphi.breakLoad σ A L₁ = ${lean(r)} → L₂ / L₁ = ${lean(l)} → False :=\n  fun A k₃ σ L₁ L₂ hA hσ h₁ h₂ hr hℓ => Delphi.Constraints.strength_ratio_rules_out hA hσ h₁ h₂ hr hℓ (by norm_num)`),
  C8c(c, cand, tn) {
    const q = ['length_ratio', 'reference_safety_factor', 'claimed_safety_factor'];
    if (!q.every(x => isPoint(cand.commits[x]))) return { state: 'cannot-rule', reason: 'cannot rule: C8c needs exact (point) values' };
    const [l, n0, n] = q.map(x => parseQ(cand.commits[x])); const nl = mul(n, l);
    const numbers = { length_ratio: str(l), n0: str(n0), n: str(n), 'n × length_ratio': str(nl) };
    if (cmp(n0, nl) < 0) return { state: 'eliminated', reason: 'the scaled body\'s safety factor is the reference one divided by the length ratio, below the claimed load', violated: `n0 = ${str(n0)} < n × ℓ = ${str(nl)}`, numbers,
      cert: `theorem ${tn} : ∀ (W A : ℝ → ℝ) (k₁ k₃ σ L₁ L₂ : ℝ), Delphi.CubeLaw W k₁ → Delphi.AreaLaw A k₃ → 0 < L₁ → 0 < L₂ → L₂ / L₁ = ${lean(l)} →\n    Delphi.breakLoad σ A L₁ / W L₁ = ${lean(n0)} → ${lean(n)} * W L₂ ≤ Delphi.breakLoad σ A L₂ → False :=\n  fun W A k₁ k₃ σ L₁ L₂ hW hA h₁ h₂ hℓ hn₀ hclaim => Delphi.Constraints.giant_rules_out hW hA h₁ h₂ hℓ hn₀ hclaim (by norm_num)` };
    return { state: 'consistent', reason: 'the reference safety factor divided by the length ratio still covers the claimed load', numbers };
  },
  C8d: (c, cand, tn) => ptRatio(c, cand, tn, 'stress_ratio', 1, (r, l) => `theorem ${tn} : ∀ (W A : ℝ → ℝ) (k₁ k₃ L₁ L₂ : ℝ), Delphi.CubeLaw W k₁ → Delphi.AreaLaw A k₃ → 0 < L₁ → 0 < L₂ →\n    (W L₂ / A L₂) / (W L₁ / A L₁) = ${lean(r)} → L₂ / L₁ = ${lean(l)} → False :=\n  fun W A k₁ k₃ L₁ L₂ hW hA h₁ h₂ hr hℓ => Delphi.Constraints.stress_ratio_rules_out hW hA h₁ h₂ hr hℓ (by norm_num)`),
  C8e: (c, cand, tn) => expRule(c, cand, tn, 'stress_loglog_exponent', Q(1n), '1', b => `theorem ${tn} : ∀ (W A : ℝ → ℝ) (k₁ k₃ L₁ L₂ b : ℝ), Delphi.CubeLaw W k₁ → Delphi.AreaLaw A k₃ → 0 < L₁ → 0 < L₂ → L₁ ≠ L₂ →\n    Real.log ((W L₂ / A L₂) / (W L₁ / A L₁)) = b * Real.log (L₂ / L₁) → (${lean(b.low)} ≤ b ∧ b ≤ ${lean(b.high)}) → False :=\n  fun W A k₁ k₃ L₁ L₂ b hW hA h₁ h₂ hne hb hr => Delphi.Constraints.stress_exponent_rules_out hW hA h₁ h₂ hne hb (fun h => by linarith [hr.1, hr.2])`),
  C9(c, cand, tn) {
    const q = ['airspeed_m_s', 'weight_N', 'lifting_area_m2', 'air_density_kg_m3', 'max_lift_coefficient'];
    if (!q.every(x => isPoint(cand.commits[x]))) return { state: 'cannot-rule', reason: 'cannot rule: C9 needs exact (point) values' };
    const [v, W, S, rho, Cm] = q.map(x => parseQ(cand.commits[x]));
    if (cmp(v, Q(0n)) < 0 || cmp(S, Q(0n)) <= 0 || cmp(rho, Q(0n)) <= 0 || cmp(Cm, Q(0n)) <= 0) return { state: 'cannot-rule', reason: 'cannot rule: v ≥ 0 and S, ρ, C_L,max > 0 are needed' };
    const lhs = powQ(v, 2), rhs = div(mul(Q(2n), W), mul(mul(rho, S), Cm));
    const numbers = { v: str(v), 'v^2': str(lhs), '2W/(ρ S C_L,max)': str(rhs) };
    if (cmp(lhs, rhs) < 0) return { state: 'eliminated', reason: 'lift at this airspeed cannot reach the weight even at C_L,max: v is below v_min', violated: `v^2 = ${str(lhs)} < 2W/(ρ S C_L,max) = ${str(rhs)}`, numbers,
      cert: `theorem ${tn} : ∀ C : ℝ, 0 < C → C ≤ ${lean(Cm)} → Delphi.lift ${lean(rho)} ${lean(v)} ${lean(S)} C = ${lean(W)} → False :=\n  fun C hC hCm hlift => Delphi.Constraints.vmin_rules_out (by norm_num) (by norm_num) hC hCm (by norm_num) hlift (by norm_num)` };
    return { state: 'consistent', reason: 'v ≥ v_min: the stated airspeed can carry the stated weight at some C_L ≤ C_L,max (nothing about drag, power or stability)', numbers };
  },
  C9b: (c, cand, tn) => sqRatio(c, cand, tn, 'vmin_ratio', (r, l) => `theorem ${tn} : ∀ (W S : ℝ → ℝ) (k₁ k₂ ρ Cmax L₁ L₂ : ℝ), Delphi.CubeLaw W k₁ → Delphi.AreaLaw S k₂ → 0 < ρ → 0 < Cmax → 0 < L₁ → 0 < L₂ →\n    Delphi.vmin ρ Cmax (W L₂) (S L₂) / Delphi.vmin ρ Cmax (W L₁) (S L₁) = ${lean(r)} → L₂ / L₁ = ${lean(l)} → False :=\n  fun W S k₁ k₂ ρ Cmax L₁ L₂ hW hS hρ hC h₁ h₂ hr hℓ => Delphi.Constraints.vmin_scaling_rules_out hW hS hρ hC h₁ h₂ hr hℓ (by norm_num) (by norm_num)`),
  C9c: (c, cand, tn) => expRule(c, cand, tn, 'vmin_loglog_exponent', Q(1n, 2n), '1/2', b => `theorem ${tn} : ∀ (W S : ℝ → ℝ) (k₁ k₂ ρ Cmax L₁ L₂ b : ℝ), Delphi.CubeLaw W k₁ → Delphi.AreaLaw S k₂ → 0 < ρ → 0 < Cmax → 0 < L₁ → 0 < L₂ → L₁ ≠ L₂ →\n    Real.log (Delphi.vmin ρ Cmax (W L₂) (S L₂) / Delphi.vmin ρ Cmax (W L₁) (S L₁)) = b * Real.log (L₂ / L₁) → (${lean(b.low)} ≤ b ∧ b ≤ ${lean(b.high)}) → False :=\n  fun W S k₁ k₂ ρ Cmax L₁ L₂ b hW hS hρ hC h₁ h₂ hne hb hr => Delphi.Constraints.vmin_exponent_rules_out hW hS hρ hC h₁ h₂ hne hb (fun h => by linarith [hr.1, hr.2])`),
  C10: (c, cand, tn) => expRule(c, cand, tn, 'power_required_loglog_exponent', Q(7n, 2n), '7/2', b => `theorem ${tn} : ∀ (W S : ℝ → ℝ) (k₁ k₂ ρ Cmax LD L₁ L₂ b : ℝ), Delphi.CubeLaw W k₁ → Delphi.AreaLaw S k₂ → 0 < ρ → 0 < Cmax → 0 < LD → 0 < L₁ → 0 < L₂ → L₁ ≠ L₂ →\n    Real.log (Delphi.powerRequired (W L₂) (Delphi.vmin ρ Cmax (W L₂) (S L₂)) LD / Delphi.powerRequired (W L₁) (Delphi.vmin ρ Cmax (W L₁) (S L₁)) LD) = b * Real.log (L₂ / L₁) → (${lean(b.low)} ≤ b ∧ b ≤ ${lean(b.high)}) → False :=\n  fun W S k₁ k₂ ρ Cmax LD L₁ L₂ b hW hS hρ hC hLD h₁ h₂ hne hb hr => Delphi.Constraints.powerRequired_exponent_rules_out hW hS hρ hC hLD h₁ h₂ hne hb (fun h => by linarith [hr.1, hr.2])`),
  C11: (c, cand, tn) => sqRatio(c, cand, tn, 'froude_speed_ratio', (r, l) => `theorem ${tn} : ∀ (Fr g L₁ L₂ : ℝ), 0 < Fr → 0 < g → 0 < L₁ → 0 < L₂ →\n    Delphi.froudeSpeed Fr g L₂ / Delphi.froudeSpeed Fr g L₁ = ${lean(r)} → L₂ / L₁ = ${lean(l)} → False :=\n  fun Fr g L₁ L₂ hFr hg h₁ h₂ hr hℓ => Delphi.Constraints.froude_rules_out hFr hg h₁ h₂ hr hℓ (by norm_num) (by norm_num)`),
  C1b(c, cand, tn) {
    if (!isPoint(cand.commits.mutation_rate_ratio) || !isPoint(cand.commits.neutral_substitution_rate_ratio)) return { state: 'cannot-rule', reason: 'cannot rule: C1b needs exact (point) ratios' };
    const mr = parseQ(cand.commits.mutation_rate_ratio), kr = parseQ(cand.commits.neutral_substitution_rate_ratio);
    const numbers = { 'mu_2/mu_1': str(mr), 'k_2/k_1': str(kr) };
    if (cmp(mr, Q(1n)) !== 0) return { state: 'cannot-rule', reason: 'cannot rule: the lemma applies to lineages with equal mutation rates (ratio exactly 1); the candidate commits a different ratio', numbers };
    if (cmp(kr, Q(1n)) !== 0) return { state: 'eliminated', reason: 'two neutral lineages with the same mutation rate have the same substitution rate (k = mu in each); the committed ratio is not 1', violated: `k_2/k_1 = ${str(kr)} ≠ 1 while mu_2/mu_1 = 1`, numbers,
      cert: `theorem ${tn} : ∀ (M₁ M₂ : ℕ) (h₁ : 0 < M₁) (h₂ : 0 < M₂) (μ₁ μ₂ : ℝ), μ₁ = μ₂ → 0 < μ₁ →\n    Delphi.substitutionRate M₂ μ₂ ((Delphi.wrightFisher M₂ h₂).fixationProbability (Delphi.oneCopy M₂ h₂)) =\n      ${lean(kr)} * Delphi.substitutionRate M₁ μ₁ ((Delphi.wrightFisher M₁ h₁).fixationProbability (Delphi.oneCopy M₁ h₁)) → False :=\n  fun M₁ M₂ h₁ h₂ μ₁ μ₂ hμ hpos hk => Delphi.Constraints.kimura_rate_ratio_rules_out M₁ M₂ h₁ h₂ μ₁ μ₂ ${lean(kr)} hμ hpos hk (by norm_num)` };
    return { state: 'consistent', reason: 'equal mutation rates and equal substitution rates, as the theorem gives', numbers };
  },
  C4c(c, cand, tn) {
    if (!isPoint(cand.commits.variance_fitness)) return { state: 'cannot-rule', reason: 'cannot rule: C4c needs an exact (point) variance' };
    const V = parseQ(cand.commits.variance_fitness), sign = String(cand.commits.mean_fitness_change_sign);
    if (!['positive', 'zero', 'negative'].includes(sign)) return { state: 'cannot-rule', reason: 'cannot rule: mean_fitness_change_sign must be positive, zero or negative' };
    const numbers = { V: str(V), sign };
    if (cmp(V, Q(0n)) !== 0) return { state: 'cannot-rule', reason: 'cannot rule: the lemma applies to zero variance; the candidate commits a nonzero variance (see C4 / C4b)', numbers };
    if (sign === 'zero') return { state: 'consistent', reason: 'zero variance gives zero change in mean fitness, as the theorem says', numbers };
    const hyp = sign === 'positive' ? '0 < Δ' : 'Δ < 0', ne = sign === 'positive' ? 'ne_of_gt hs' : 'ne_of_lt hs';
    return { state: 'eliminated', reason: 'with zero variance in fitness one round of selection leaves mean fitness unchanged', violated: `V = 0 but delta_wbar is ${sign}`, numbers,
      cert: `theorem ${tn} : ∀ {ι : Type} [Fintype ι] (p w : ι → ℝ), Delphi.IsFreq p → 0 < Delphi.meanFitness p w → Delphi.variance p w = 0 →\n    ∀ Δ : ℝ, Delphi.meanFitness (Delphi.select p w) w - Delphi.meanFitness p w = Δ → ${hyp} → False :=\n  fun p w hp hm hV Δ hΔ hs => Delphi.Constraints.fisher_zero_variance_rules_out hp hm hV hΔ (${ne})` };
  },
  C5b(c, cand, tn) {
    if (!isPoint(cand.commits.asexual_odds_growth_factor)) return { state: 'cannot-rule', reason: 'cannot rule: C5b needs an exact (point) factor' };
    const r = parseQ(cand.commits.asexual_odds_growth_factor); const numbers = { factor: str(r) };
    if (cmp(r, Q(2n)) === 0) return { state: 'consistent', reason: 'the committed factor is the theorem\'s 2', numbers };
    return { state: 'eliminated', reason: 'under equal fecundity and a 1:1 sex ratio the odds of asexual females grow by exactly 2 per generation', violated: `factor = ${str(r)} ≠ 2`, numbers,
      cert: `theorem ${tn} : ∀ (q f : ℝ), 0 < q → q < 1 → 0 < f → Delphi.odds (Delphi.asexualNext q f) = ${lean(r)} * Delphi.odds q → False :=\n  fun q f hq0 hq1 hf hr => Delphi.Constraints.twofold_factor_rules_out hq0 hq1 hf hr (by norm_num)` };
  },
  C1(c, cand, tn) {
    const k = interval(cand.commits.neutral_substitution_rate), mu = interval(cand.commits.mutation_rate);
    const numbers = { k: [str(k.low), str(k.high)], mu: [str(mu.low), str(mu.high)] };
    const elim = cmp(k.high, mu.low) < 0 || cmp(mu.high, k.low) < 0;
    if (!elim) return { state: 'consistent', reason: 'the committed intervals for k and mu overlap', numbers };
    const viol = cmp(k.high, mu.low) < 0 ? `k ≤ ${str(k.high)} < ${str(mu.low)} ≤ mu` : `mu ≤ ${str(mu.high)} < ${str(k.low)} ≤ k`;
    return { state: 'eliminated', reason: 'k = mu under neutral Wright-Fisher, but the committed intervals are disjoint', violated: viol, numbers,
      cert: `theorem ${tn} : ∀ (M : ℕ) (hM : 0 < M) (μ : ℝ),\n    (${lean(k.low)} ≤ Delphi.substitutionRate M μ ((Delphi.wrightFisher M hM).fixationProbability (Delphi.oneCopy M hM)) ∧\n      Delphi.substitutionRate M μ ((Delphi.wrightFisher M hM).fixationProbability (Delphi.oneCopy M hM)) ≤ ${lean(k.high)}) →\n    (${lean(mu.low)} ≤ μ ∧ μ ≤ ${lean(mu.high)}) → False :=\n  fun M hM μ hk hμ => Delphi.Constraints.kimura_rate_rules_out M hM μ hk hμ (by norm_num)` };
  },
  C2(c, cand, tn) {
    const M = natural(cand.commits.gene_copies_M), u = interval(cand.commits.fixation_probability);
    if (M === 0n) return { state: 'cannot-rule', reason: 'cannot rule: gene_copies_M must be positive' };
    const inv = Q(1n, M); const numbers = { M: M.toString(), '1/M': str(inv), u: [str(u.low), str(u.high)] };
    if (cmp(u.high, inv) < 0 || cmp(inv, u.low) < 0) return { state: 'eliminated', reason: 'a new neutral mutant fixes with probability exactly 1/M, which lies outside the committed interval', violated: cmp(u.high, inv) < 0 ? `u ≤ ${str(u.high)} < 1/M = ${str(inv)}` : `1/M = ${str(inv)} < ${str(u.low)} ≤ u`, numbers,
      cert: `theorem ${tn} : ∀ (hM : 0 < ${M}),\n    (${lean(u.low)} ≤ (Delphi.wrightFisher ${M} hM).fixationProbability (Delphi.oneCopy ${M} hM) ∧\n      (Delphi.wrightFisher ${M} hM).fixationProbability (Delphi.oneCopy ${M} hM) ≤ ${lean(u.high)}) → False :=\n  fun hM hu => Delphi.Constraints.neutral_fixation_rules_out ${M} hM hu (by norm_num)` };
    return { state: 'consistent', reason: '1/M lies inside the committed interval', numbers };
  },
  C3(c, cand, tn) {
    if (cand.commits.selection_coefficient_nonnegative !== true) return { state: 'cannot-rule', reason: 'cannot rule: the candidate does not commit to selection_coefficient_nonnegative = true' };
    const M = natural(cand.commits.gene_copies_M), u = interval(cand.commits.fixation_probability);
    if (M === 0n) return { state: 'cannot-rule', reason: 'cannot rule: gene_copies_M must be positive' };
    const inv = Q(1n, M); const numbers = { M: M.toString(), '1/M': str(inv), u_high: str(u.high) };
    if (cmp(u.high, inv) < 0) return { state: 'eliminated', reason: 'a mutant selection does not oppose fixes with probability at least 1/M', violated: `u ≤ ${str(u.high)} < 1/M = ${str(inv)}`, numbers,
      cert: `theorem ${tn} : ∀ (s : ℝ) (hs : 0 ≤ s),\n    (Delphi.wrightFisherSelection ${M} (by norm_num) s hs).fixationProbability (Delphi.oneCopy ${M} (by norm_num)) ≤ ${lean(u.high)} → False :=\n  fun s hs hu => Delphi.Constraints.favored_fixation_rules_out ${M} (by norm_num) s hs hu (by norm_num)` };
    return { state: 'consistent', reason: 'the committed upper end of u is not below 1/M (no upper bound in s is proved, so nothing rules on the high side)', numbers };
  },
  C3b(c, cand, tn) {
    const E = interval(cand.commits.expected_substitutions_total), G = parseQ(cand.commits.sites_G), M = natural(cand.commits.gene_copies_M), mu = interval(cand.commits.mutation_rate), T = natural(cand.commits.generations_T);
    if (cmp(G, Q(0n)) < 0 || cmp(mu.low, Q(0n)) < 0) return { state: 'cannot-rule', reason: 'cannot rule: sites_G and mutation_rate must be nonnegative' };
    const supply = mul(mul(mul(G, fromInt(M)), mu.high), fromInt(T)); const numbers = { G: str(G), M: M.toString(), mu_high: str(mu.high), T: T.toString(), 'G*M*mu*T': str(supply), E_low: str(E.low) };
    if (cmp(supply, E.low) < 0) return { state: 'eliminated', reason: 'the expected number of substitutions cannot exceed the mutation supply G * M * mu * T', violated: `G*M*mu*T = ${str(supply)} < ${str(E.low)} ≤ E`, numbers,
      cert: `theorem ${tn} : ∀ (μ u : ℝ), 0 ≤ μ → μ ≤ ${lean(mu.high)} → u ≤ 1 →\n    ${lean(E.low)} ≤ ${lean(G)} * Delphi.expectedSubstitutions ${M} μ u ${T} → False :=\n  fun μ u hμ hμh hu hc => Delphi.Constraints.supply_rules_out' ${M} μ u hμ hu ${T} (by norm_num) hμh hc (by norm_num)` };
    return { state: 'consistent', reason: 'the committed expectation does not exceed the mutation supply', numbers };
  },
  C4(c, cand, tn) {
    const vals = ['mean_fitness_change', 'mean_fitness', 'variance_fitness'];
    if (!vals.every(q => isPoint(cand.commits[q]))) return { state: 'cannot-rule', reason: 'cannot rule: C4 needs exact (point) values for mean_fitness_change, mean_fitness and variance_fitness; interval commitments are checked by C4b only' };
    const D = parseQ(cand.commits.mean_fitness_change), m = parseQ(cand.commits.mean_fitness), V = parseQ(cand.commits.variance_fitness);
    if (cmp(m, Q(0n)) <= 0) return { state: 'cannot-rule', reason: 'cannot rule: mean_fitness must be positive' };
    const prod = mul(D, m); const numbers = { delta_wbar: str(D), wbar: str(m), V: str(V), 'delta_wbar*wbar': str(prod) };
    if (cmp(prod, V) !== 0) return { state: 'eliminated', reason: 'one round of selection with fixed fitnesses changes mean fitness by exactly V / wbar', violated: `delta_wbar * wbar = ${str(prod)} ≠ V = ${str(V)}`, numbers,
      cert: `theorem ${tn} : ∀ {ι : Type} [Fintype ι] (p w : ι → ℝ), Delphi.IsFreq p → 0 < Delphi.meanFitness p w →\n    Delphi.meanFitness (Delphi.select p w) w - Delphi.meanFitness p w = ${lean(D)} → Delphi.variance p w = ${lean(V)} →\n    Delphi.meanFitness p w = ${lean(m)} → False :=\n  fun p w hp hm hΔ hV hmm => Delphi.Constraints.fisher_rules_out hp hm hΔ hV hmm (by norm_num)` };
    return { state: 'consistent', reason: 'the committed values satisfy delta_wbar * wbar = V', numbers };
  },
  C4b(c, cand, tn) {
    const D = interval(cand.commits.mean_fitness_change); const numbers = { delta_wbar_high: str(D.high) };
    if (cmp(D.high, Q(0n)) < 0) return { state: 'eliminated', reason: 'mean fitness cannot fall under one round of selection with fixed fitnesses', violated: `delta_wbar ≤ ${str(D.high)} < 0`, numbers,
      cert: `theorem ${tn} : ∀ {ι : Type} [Fintype ι] (p w : ι → ℝ), Delphi.IsFreq p → 0 < Delphi.meanFitness p w →\n    Delphi.meanFitness (Delphi.select p w) w - Delphi.meanFitness p w ≤ ${lean(D.high)} → False :=\n  fun p w hp hm hΔ => Delphi.Constraints.fisher_decline_rules_out hp hm hΔ (by norm_num)` };
    return { state: 'consistent', reason: 'the committed change in mean fitness is not negative', numbers };
  },
  C5(c, cand, tn) {
    if (!['asexual_fraction_initial', 'asexual_fraction_after'].every(q => isPoint(cand.commits[q]))) return { state: 'cannot-rule', reason: 'cannot rule: C5 needs exact (point) fractions' };
    const q0 = parseQ(cand.commits.asexual_fraction_initial), qn = parseQ(cand.commits.asexual_fraction_after), n = natural(cand.commits.generations_n);
    if (cmp(q0, Q(0n)) <= 0 || cmp(q0, Q(1n)) >= 0 || cmp(qn, Q(1n)) >= 0) return { state: 'cannot-rule', reason: 'cannot rule: fractions must satisfy 0 < q0 < 1 and q_n < 1' };
    const odds = q => div(q, sub(Q(1n), q)); const lhs = odds(qn), rhs = mul(powQ(Q(2n), Number(n)), odds(q0));
    const numbers = { q0: str(q0), n: n.toString(), q_n: str(qn), 'odds(q_n)': str(lhs), '2^n*odds(q0)': str(rhs) };
    if (cmp(lhs, rhs) !== 0) return { state: 'eliminated', reason: 'under equal fecundity and a 1:1 sex ratio the odds of asexual females are exactly 2^n times the initial odds', violated: `odds(q_n) = ${str(lhs)} ≠ 2^${n} * odds(q0) = ${str(rhs)}`, numbers,
      cert: `theorem ${tn} : ∀ (f : ℝ), 0 < f → Delphi.asexualAfter ${lean(q0)} f ${n} = ${lean(qn)} → False :=\n  fun f hf hqn => Delphi.Constraints.twofold_rules_out (by norm_num) (by norm_num) hf ${n} hqn (by norm_num [Delphi.odds])` };
    return { state: 'consistent', reason: 'the committed fractions follow the twofold doubling exactly', numbers };
  },
  C6(c, cand) {
    const bp = String(cand.commits.blueprint_file); const name = path.basename(bp, '.json');
    const certFile = path.join(leanDir, 'blueprint/certificates', `${name}.json`);
    if (!fs.existsSync(certFile)) return { state: 'cannot-rule', reason: `cannot rule: no certificate for ${bp}; run node lean/blueprint/fetch-taxon.mjs ${bp} && node lean/blueprint/certify.mjs ${bp}` };
    const cert = JSON.parse(fs.readFileSync(certFile, 'utf8'));
    const sha = fs.existsSync(path.join(root, bp)) ? crypto.createHash('sha256').update(fs.readFileSync(path.join(root, bp))).digest('hex') : null;
    if (sha !== cert.blueprint.sha256) return { state: 'cannot-rule', reason: `cannot rule: the certificate was generated for a different version of ${bp} (sha256 ${cert.blueprint.sha256.slice(0, 12)} vs ${(sha || 'missing').slice(0, 12)}); regenerate it` };
    if (cert.compile.ok) return { state: 'consistent', reason: `the kernel accepted ${cert.theorems.wellFormed} on this file (sha256 ${sha.slice(0, 12)}): acyclic part_of, every term reaches the body root, pinned taxon statements exclude nothing. Structural only.`, numbers: { terms: cert.graph.distinctTerms, edges: cert.graph.distinctEdges }, certificateTheorem: cert.theorems.wellFormed, kernelChecked: true };
    return { state: 'eliminated', reason: 'the checker rejected the design (plain computation: the failing condition is in the certificate compile output; completeness of the checker is not proved)', violated: (cert.compile.tail || []).join(' | ') };
  },
  C7(c, cand, tn) {
    const r = interval(cand.commits.weight_ratio), l = interval(cand.commits.length_ratio);
    if (cmp(l.low, Q(0n)) < 0) return { state: 'cannot-rule', reason: 'cannot rule: length_ratio must be nonnegative' };
    const c3 = powQ(l.low, 3), d3 = powQ(l.high, 3); const numbers = { weight_ratio: [str(r.low), str(r.high)], length_ratio: [str(l.low), str(l.high)], 'length_ratio^3': [str(c3), str(d3)] };
    if (cmp(r.high, c3) < 0 || cmp(d3, r.low) < 0) return { state: 'eliminated', reason: 'under isometric scaling at constant density the weight ratio is exactly the cube of the length ratio (mass side of the square-cube argument only)', violated: cmp(r.high, c3) < 0 ? `W2/W1 ≤ ${str(r.high)} < (L2/L1)^3 ≥ ${str(c3)}` : `(L2/L1)^3 ≤ ${str(d3)} < ${str(r.low)} ≤ W2/W1`, numbers,
      cert: `theorem ${tn} : ∀ (W : ℝ → ℝ) (k L₁ L₂ : ℝ), Delphi.CubeLaw W k → 0 < L₁ → 0 < L₂ →\n    (${lean(r.low)} ≤ W L₂ / W L₁ ∧ W L₂ / W L₁ ≤ ${lean(r.high)}) → (${lean(l.low)} ≤ L₂ / L₁ ∧ L₂ / L₁ ≤ ${lean(l.high)}) → False :=\n  fun W k L₁ L₂ h h₁ h₂ hr hℓ => Delphi.Constraints.cubeLaw_rules_out' h h₁ h₂ hr hℓ (by norm_num) (by norm_num)` };
    return { state: 'consistent', reason: 'the committed weight ratio is compatible with the cube of the length ratio; nothing here rules on strength', numbers };
  },
  C7b(c, cand, tn) {
    const b = interval(cand.commits.loglog_exponent); const numbers = { exponent: [str(b.low), str(b.high)] };
    if (cmp(b.high, Q(3n)) < 0 || cmp(Q(3n), b.low) < 0) return { state: 'eliminated', reason: 'under isometric scaling at constant density the log-log exponent is exactly 3', violated: cmp(b.high, Q(3n)) < 0 ? `b ≤ ${str(b.high)} < 3` : `3 < ${str(b.low)} ≤ b`, numbers,
      cert: `theorem ${tn} : ∀ (W : ℝ → ℝ) (L₁ L₂ : ℝ), 0 < L₁ → 0 < L₂ → L₁ ≠ L₂ →\n    (${lean(b.low)} ≤ Delphi.logSlope W L₁ L₂ ∧ Delphi.logSlope W L₁ L₂ ≤ ${lean(b.high)}) → ∀ k, ¬ Delphi.CubeLaw W k :=\n  fun W L₁ L₂ h₁ h₂ hne hb => Delphi.Constraints.exponent_rules_out h₁ h₂ hne hb (by norm_num)` };
    return { state: 'consistent', reason: 'the committed exponent interval contains 3', numbers };
  }
};

const codeOf = reason => { const m = String(reason).match(/^(not-formalised|premise-rejected|outside-model|adopts-theorem|no-graph|untranslatable)/); return m ? m[1] : null; };
const certs = []; const ledger = [];
for (const cand of CAND.candidates) {
  const rows = [];
  cand.commits = cand.commits || {};
  const overrides = cand.cannotRule || {};
  for (const c of CONSTRAINTS.constraints) {
    let r;
    if (cand.untranslatable) r = { state: 'cannot-rule', reason: 'untranslatable: ' + cand.untranslatable, reasonCode: codeOf(cand.untranslatable) || 'untranslatable' };
    else if (overrides[c.id]) r = { state: 'cannot-rule', reason: 'cannot rule: ' + overrides[c.id], reasonCode: codeOf(overrides[c.id]) };
    else if (need(c, cand, c.requires) || accepts(c, cand)) r = { state: 'cannot-rule', reason: need(c, cand, c.requires) || accepts(c, cand), reasonCode: need(c, cand, c.requires) ? 'missing-input' : 'assumption-not-accepted' };
    else {
      const tn = `elim_${cand.id.replace(/[^A-Za-z0-9]+/g, '_')}_${c.id}`;
      try { r = rules[c.id](c, cand, tn); } catch (e) { r = { state: 'cannot-rule', reason: 'cannot rule: ' + e.message }; }
      if (r.cert) { certs.push({ candidate: cand.id, constraint: c.id, theorem: `Delphi.Constraints.Eliminations.${tn}`, text: r.cert }); r.certificateTheorem = `Delphi.Constraints.Eliminations.${tn}`; delete r.cert; }
    }
    rows.push({ constraint: c.id, claim_id: c.claim_id, lemma: c.lemma, relation: c.relation, under: c.appliesWhen, faithfulness: c.faithfulness, ...r,
      ...(c.empirical ? { conditionalOn: c.empirical, conditionalNote: `conditional on the observation ${c.empirical} of lean/empirical.json, which a reader may reject; the arithmetic is kernel-checked either way` } : {}) });
  }
  const meta = Object.fromEntries(Object.entries(cand).filter(([k]) => !['id', 'problem', 'description', 'source', 'accepts', 'commits', 'cannotRule', 'notFormalised', 'untranslatable'].includes(k)));
  const notFormalisedRows = rows.filter(x => x.reasonCode === 'not-formalised').map(x => x.constraint);
  ledger.push({ id: cand.id, problem: cand.problem || null, description: cand.description || cand.original_statement || null, source: cand.source || cand.original_source || null, accepts: cand.accepts || [], commits: cand.commits,
    untranslatable: cand.untranslatable || null, notFormalised: [...(cand.notFormalised || []), ...notFormalisedRows.map(cid => `${cid}: ${overrides[cid]}`)],
    provenance: cand.provenance || (cand.origin || null), uses_illustrative_values: cand.uses_illustrative_values ?? null,
    eliminationCaveat: rows.some(x => x.state === 'eliminated') ? (cand.uses_illustrative_values ? 'ELIMINATES ILLUSTRATIVE NUMBERS chosen to make the candidate concrete, not a published hypothesis' : cand.origin && cand.origin !== 'source' ? cand.origin === 'source-hypothesis+formalized-here' ? 'eliminates the quantitative form given here to a source hypothesis, under the committed inputs (proxies where so labelled), not the source itself' : 'eliminates a proposed-here candidate (written in this project, not a published hypothesis)' : null) : null,
    meta,
    conditionalEliminations: rows.filter(x => x.state === 'eliminated' && x.conditionalOn).map(x => ({ constraint: x.constraint, conditionalOn: x.conditionalOn })),
    summary: { eliminated: rows.filter(x => x.state === 'eliminated').map(x => x.constraint), consistent: rows.filter(x => x.state === 'consistent').map(x => x.constraint), cannotRule: rows.filter(x => x.state === 'cannot-rule').length, notFormalised: notFormalisedRows.length + (cand.notFormalised || []).length },
    verdict: rows.some(x => x.state === 'eliminated') ? 'eliminated' : rows.some(x => x.state === 'consistent') ? 'consistent (not ruled out by these theorems; not shown feasible)' : cand.untranslatable ? 'cannot-rule (untranslatable)' : 'cannot-rule (no constraint could rule)', results: rows });
}

// Generate and compile the certificate file.
let compile = null;
if (certs.length) {
  const text = `import Delphi.Constraints\nimport Delphi.Blueprint\nimport Delphi.Scaling\nimport Delphi.Flight\nimport Delphi.Genotype\nimport Delphi.Empirical\n/-!\nGENERATED by lean/eliminate/eliminate.mjs from ${path.relative(root, path.resolve(file)).replace(/\\/g, '/')} (${new Date().toISOString()}).\nOne theorem per elimination: the matching lemma of lean/Delphi/Constraints.lean instantiated with the candidate's\ncommitted numbers, the arithmetic discharged by norm_num. Do not edit; regenerate.\n-/\n\nset_option maxRecDepth 1000000\n\nnamespace Delphi.Constraints.Eliminations\n\n${certs.map(c => `/-- Candidate \`${c.candidate}\`, constraint ${c.constraint}. -/\n${c.text}`).join('\n\n')}\n\nend Delphi.Constraints.Eliminations\n`;
  fs.mkdirSync(path.dirname(path.join(leanDir, leanRel)), { recursive: true });
  fs.writeFileSync(path.join(leanDir, leanRel), text);
  const candidates = [process.env.ELAN_HOME, path.join(process.env.USERPROFILE || process.env.HOME || '', '.elan'), 'C:/Temp/elan'].filter(Boolean);
  let bin = ''; for (const c of candidates) { const d = path.join(c, 'bin'); if (fs.existsSync(path.join(d, process.platform === 'win32' ? 'lake.exe' : 'lake'))) { bin = d; break; } }
  const env = { ...process.env, PATH: (bin ? bin + path.delimiter : '') + process.env.PATH }; if (bin && !process.env.ELAN_HOME) env.ELAN_HOME = path.dirname(bin);
  const t0 = Date.now();
  const r = spawnSync('lake', ['env', 'lean', leanRel], { cwd: leanDir, env, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024 });
  const out = (r.stdout || '') + (r.stderr || '');
  const errs = out.split(/\r?\n/).filter(l => /error:/.test(l));
  compile = { file: `lean/${leanRel}`, ok: r.status === 0 && errs.length === 0, exit: r.status, seconds: +((Date.now() - t0) / 1000).toFixed(1), errors: errs.slice(0, 10), theorems: certs.length };
  // Per-theorem: an error line names the line number; map failing lines back to theorems.
  const failedTheorems = new Set();
  for (const e of errs) { const m = e.match(/:(\d+):\d+: error/); if (m) { const line = Number(m[1]); const upto = text.split(/\r?\n/).slice(0, line).join('\n'); const last = [...upto.matchAll(/theorem (elim_[A-Za-z0-9_]+)/g)].pop(); if (last) failedTheorems.add(`Delphi.Constraints.Eliminations.${last[1]}`); } }
  for (const row of ledger) for (const x of row.results) if (x.certificateTheorem && x.state === 'eliminated') x.kernelChecked = compile.ok ? true : !failedTheorems.has(x.certificateTheorem) && r.status === 0;
}
// A candidate file declares itself illustrative (or is the recorded examples file); the word appearing in a
// note is not enough, since a file may carry real candidates and say that its controls are labelled per candidate.
const illustrative = CAND.illustrative === true || path.basename(file) === 'examples.json';
const reasonCounts = {}; for (const l of ledger) for (const x of l.results) if (x.state === 'cannot-rule') reasonCounts[x.reasonCode || 'other'] = (reasonCounts[x.reasonCode || 'other'] || 0) + 1;
const summary = { run: new Date().toISOString(), illustrative, label: illustrative ? 'illustrative candidates constructed by the lean thread to exercise the checker; counts are a property of that construction, not a finding' : (CAND.label || 'candidates supplied by the open-problems enumerator'), candidates: ledger.length, eliminated: ledger.filter(l => l.verdict === 'eliminated').length, eliminatedOfIllustrativeOrProposed: ledger.filter(l => l.verdict === 'eliminated' && l.eliminationCaveat).length, consistent: ledger.filter(l => l.verdict.startsWith('consistent')).length, unconstrained: ledger.filter(l => l.verdict.startsWith('cannot-rule')).length, untranslatable: ledger.filter(l => l.untranslatable).length, candidatesWithNotFormalisedClaims: ledger.filter(l => l.notFormalised.length).length, cannotRuleReasonCounts: reasonCounts, rankingNote: 'Rank nothing by elimination count: a problem with more eliminated candidates is not more solved; it only had more candidates these theorems happen to touch.', eliminations: certs.length, kernelCheckedEliminations: ledger.flatMap(l => l.results).filter(x => x.state === 'eliminated' && x.kernelChecked).length, compile, constraintsBuilt: CONSTRAINTS.built, input: path.relative(root, path.resolve(file)).replace(/\\/g, '/'), inputSha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') };
fs.writeFileSync(outFile, JSON.stringify({ summary, ledger }, null, 1));
console.log(JSON.stringify(summary));
for (const l of ledger) console.log(`${l.id}: ${l.verdict}${l.eliminationCaveat ? ' [' + l.eliminationCaveat + ']' : ''}${l.summary.eliminated.length ? ' by ' + l.summary.eliminated.join(', ') : ''}; consistent with ${l.summary.consistent.join(', ') || 'none'}; cannot rule ${l.summary.cannotRule}`);
if (compile && !compile.ok) { console.error(compile.errors.join('\n')); process.exitCode = 1; }
