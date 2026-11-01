// FRAGMENT spliced into lean/eliminate/browser-check.mjs by lean/eliminate/build-browser-check.mjs.
// It is real JavaScript so it can be syntax-checked on its own; the three placeholders below are replaced
// with data read from the repository at generation time. Do not import this file: it is not a module on its
// own (it uses META, result and KERNEL_NOTE from the generated module).
// The three placeholders, each named for the constant it fills, are: the codon-to-amino-acid table, the
// gene-to-nodes map the closure check reads, and the certified develops_from edges with the uncertified ones.

/** The standard genetic code, the same 64-codon table lean/Delphi/Genotype.lean tabulates. */
export const GENETIC_CODE = __GENETIC_CODE__;
/** Gene -> the nodes the genotype map links it to (direct links only; an absent node is unstudied, not gene-free). */
export const GENE_NODES = __GENE_NODES__;
/** The develops_from edges of the fin subtree, with the stages the kernel certified. */
export const DEVELOPMENT = __DEVELOPMENT__;

const AA3 = { A: 'Ala', R: 'Arg', N: 'Asn', D: 'Asp', C: 'Cys', Q: 'Gln', E: 'Glu', G: 'Gly', H: 'His', I: 'Ile', L: 'Leu', K: 'Lys', M: 'Met', F: 'Phe', P: 'Pro', S: 'Ser', T: 'Thr', W: 'Trp', Y: 'Tyr', V: 'Val', '*': 'Stop' };
const CODONS = Object.keys(GENETIC_CODE);
/** "Leu", "leu", "L" or "*" to the three-letter name; null if it is not an amino acid. */
export function aminoAcid(x) {
  const s = String(x == null ? '' : x).trim();
  if (!s) return null;
  const t = s[0].toUpperCase() + s.slice(1).toLowerCase();
  if (CODONS.some(c => GENETIC_CODE[c] === t)) return t;
  return AA3[s.toUpperCase()] || null;
}
const hammingCodon = (c, d) => (c[0] !== d[0] ? 1 : 0) + (c[1] !== d[1] ? 1 : 0) + (c[2] !== d[2] ? 1 : 0);
/** Least nucleotide substitutions turning a codon of `a` into a codon of `b` (4 if either has no codon). */
export function minSubst(a, b) {
  let m = 4, w = null;
  for (const c of CODONS) if (GENETIC_CODE[c] === a) for (const d of CODONS) if (GENETIC_CODE[d] === b) { const h = hammingCodon(c, d); if (h < m) { m = h; w = { wt: c, mutant: d }; } }
  return { distance: m, witness: w };
}

// Genotype rows. A design may carry:
//   genotype_edits: [{gene, wt_aa, mut_aa, substitutions, nodes_changed: [term, ...]}]
//   developmental_claims: [{derivative, derivative_zfs, precursor, precursor_zfs}]
//   substitution_budget: {required_substitutions, gene_copies_M, mutation_rate, generations_T,
//                         reproductive_excess, cost_per_substitution}
// Each constraint yields ONE row whose verdict is the worst over the items, with the items listed in
// numbers.items so the Studio can point at the edit that failed.
export function checkGenotype(s) {
  const num = x => typeof x === 'number' && Number.isFinite(x);
  const rows = [];
  const edits = Array.isArray(s.genotype_edits) ? s.genotype_edits : [];
  const worst = items => items.some(i => i.verdict === 'violated') ? 'violated' : items.some(i => i.verdict === 'holds') ? 'holds' : 'cannot-evaluate';

  // G1: is the claimed amino-acid change reachable in the claimed number of substitutions?
  {
    const items = edits.map(e => {
      const a = aminoAcid(e.wt_aa), b = aminoAcid(e.mut_aa), n = e.substitutions;
      if (!a || !b) return { gene: e.gene || null, verdict: 'cannot-evaluate', missing: ['wt_aa and mut_aa as amino acids'], wt_aa: e.wt_aa ?? null, mut_aa: e.mut_aa ?? null };
      if (!num(n)) return { gene: e.gene || null, verdict: 'cannot-evaluate', missing: ['substitutions'], wt_amino_acid: a, mutant_amino_acid: b };
      const { distance, witness } = minSubst(a, b);
      return { gene: e.gene || null, verdict: n >= distance ? 'holds' : 'violated', wt_amino_acid: a, mutant_amino_acid: b, claimed_substitutions: n, minSubst: distance, nearest_codon_pair: witness ? witness.wt + ' -> ' + witness.mutant : null };
    });
    rows.push(result('G1', edits.length ? worst(items) : 'cannot-evaluate', { items }, edits.length ? [] : ['genotype_edits'],
      'the standard code decides whether an amino-acid change is reachable in the claimed number of nucleotide substitutions; reachability is not evidence that the substitution happened'));
  }

  // G2: does the edit change every node the map links the gene to?
  {
    const items = edits.map(e => {
      const g = e.gene == null ? null : String(e.gene);
      const mapped = g && GENE_NODES[g] ? GENE_NODES[g] : null;
      if (!mapped) return { gene: g, verdict: 'cannot-evaluate', missing: [g ? 'this gene is not in the map (unstudied here, not unlinked)' : 'gene'] };
      const changed = (Array.isArray(e.nodes_changed) ? e.nodes_changed : []).map(String);
      if (!changed.length) return { gene: g, verdict: 'cannot-evaluate', missing: ['nodes_changed'], mapped_nodes: mapped.length };
      const missed = mapped.filter(n => !changed.includes(n.term));
      return { gene: g, verdict: missed.length ? 'violated' : 'holds', mapped_nodes: mapped.length, changed_nodes: changed.length, missed: missed.map(n => n.term + ' (' + (n.label || '') + ')') };
    });
    rows.push(result('G2', edits.length ? worst(items) : 'cannot-evaluate', { items, genes_in_map: Object.keys(GENE_NODES).length }, edits.length ? [] : ['genotype_edits'],
      'an edit must be shown changing every node the map links the gene to; the map records links, not dynamics, so this bounds what a view may omit, never how much a node changes'));
  }

  // G3: is anything claimed to appear before the precursor it develops from?
  {
    const claims = Array.isArray(s.developmental_claims) ? s.developmental_claims : [];
    const items = claims.map(c => {
      const d = c.derivative_zfs, p = c.precursor_zfs;
      if (!num(d) || !num(p)) return { verdict: 'cannot-evaluate', missing: ['derivative_zfs and precursor_zfs (the number of the ZFIN stage id)'], derivative: c.derivative ?? null, precursor: c.precursor ?? null };
      return { verdict: p < d ? 'holds' : 'violated', derivative: c.derivative ?? null, precursor: c.precursor ?? null, derivative_stage_zfs: d, precursor_stage_zfs: p };
    });
    rows.push(result('G3', claims.length ? worst(items) : 'cannot-evaluate', { items, certified_edges: DEVELOPMENT.certified, uncertified_edges: DEVELOPMENT.unknownStage, recorded: DEVELOPMENT.edges }, claims.length ? [] : ['developmental_claims'],
      'stages compare by the ZFIN stage series; the fin subtree\'s own edges are certified by a kernel evaluation, and edges with an unknown stage are not certified'));
  }

  // G4 and G5: the substitution-time budget and Haldane's cost, from one budget block.
  {
    const b = s.substitution_budget || {};
    const N = b.required_substitutions, M = b.gene_copies_M, mu = b.mutation_rate, T = b.generations_T;
    const miss = [];
    for (const [k, v] of [['required_substitutions', N], ['gene_copies_M', M], ['mutation_rate', mu], ['generations_T', T]]) if (!num(v)) miss.push('substitution_budget.' + k);
    if (miss.length) rows.push(result('G4', 'cannot-evaluate', {}, miss, 'no requirement in substitutions is defined for any wing claim in this project, so this row is normally empty'));
    else if (!(M > 0) || !(mu > 0)) rows.push(result('G4', 'cannot-evaluate', { gene_copies_M: M, mutation_rate: mu }, ['a positive M and mutation rate']));
    else {
      const fastest = N / (M * mu), neutral = N / mu;
      rows.push(result('G4', geTol(T, fastest) ? 'holds' : 'violated', { required_substitutions: N, gene_copies_M: M, mutation_rate: mu, generations_T: T, fastest_generations_every_mutant_fixes: fastest, neutral_generations: neutral }, [],
        'the fastest the model allows is every single mutant fixing; holding here is very weak, since the neutral case needs M times longer and nothing says the substitutions exist or help',
        { needed: { generations: fastest }, available: { generations: T } }));
    }
    const e = b.reproductive_excess, c = b.cost_per_substitution;
    const miss5 = [];
    for (const [k, v] of [['required_substitutions', N], ['generations_T', T], ['reproductive_excess', e], ['cost_per_substitution', c]]) if (!num(v)) miss5.push('substitution_budget.' + k);
    if (miss5.length) rows.push(result('G5', 'cannot-evaluate', {}, miss5, 'Haldane\'s accounting is a contested hypothesis; a design that does not accept it is not ruled on by it'));
    else if (!(e > 0) || !(c > 0)) rows.push(result('G5', 'cannot-evaluate', { reproductive_excess: e, cost_per_substitution: c }, ['a positive reproductive excess and cost per substitution']));
    else {
      const need = c * N / e;
      rows.push(result('G5', geTol(T, need) ? 'holds' : 'violated', { required_substitutions: N, cost_per_substitution: c, reproductive_excess: e, generations_needed: need, generations_T: T }, [],
        'conditional on Haldane 1957\'s cost accounting, which this project neither proves nor endorses; soft and truncation selection and standing variation all change the cost',
        { needed: { generations: need }, available: { generations: T } }));
    }
  }
  return rows;
}
