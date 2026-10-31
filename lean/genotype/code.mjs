// The standard genetic code, in JavaScript, mirroring the 64-case table of lean/Delphi/Genotype.lean so the
// ledger and the browser checker evaluate the same function the kernel evaluates. Shared by
// lean/eliminate/eliminate.mjs and lean/eliminate/build-browser-check.mjs (which inlines it).
//   node lean/genotype/code.mjs           # self-check against the Lean examples
export const BASES = ['A', 'C', 'G', 'U'];
// Codon -> amino acid (three-letter names; Stop for the three stop codons), standard code.
export const CODE = (() => {
  const t = {};
  const put = (s, aa) => { for (const b1 of s[0] === '*' ? BASES : [s[0]]) for (const b2 of s[1] === '*' ? BASES : [s[1]]) for (const b3 of s[2] === '*' ? BASES : [s[2]]) t[b1 + b2 + b3] = aa; };
  put('UUU', 'Phe'); put('UUC', 'Phe'); put('UUA', 'Leu'); put('UUG', 'Leu');
  put('UC*', 'Ser');
  put('UAU', 'Tyr'); put('UAC', 'Tyr'); put('UAA', 'Stop'); put('UAG', 'Stop');
  put('UGU', 'Cys'); put('UGC', 'Cys'); put('UGA', 'Stop'); put('UGG', 'Trp');
  put('CU*', 'Leu'); put('CC*', 'Pro');
  put('CAU', 'His'); put('CAC', 'His'); put('CAA', 'Gln'); put('CAG', 'Gln');
  put('CG*', 'Arg');
  put('AUU', 'Ile'); put('AUC', 'Ile'); put('AUA', 'Ile'); put('AUG', 'Met');
  put('AC*', 'Thr');
  put('AAU', 'Asn'); put('AAC', 'Asn'); put('AAA', 'Lys'); put('AAG', 'Lys');
  put('AGU', 'Ser'); put('AGC', 'Ser'); put('AGA', 'Arg'); put('AGG', 'Arg');
  put('GU*', 'Val'); put('GC*', 'Ala');
  put('GAU', 'Asp'); put('GAC', 'Asp'); put('GAA', 'Glu'); put('GAG', 'Glu');
  put('GG*', 'Gly');
  return t;
})();
export const AMINO_ACIDS = ['Ala', 'Arg', 'Asn', 'Asp', 'Cys', 'Gln', 'Glu', 'Gly', 'His', 'Ile', 'Leu', 'Lys', 'Met', 'Phe', 'Pro', 'Ser', 'Thr', 'Trp', 'Tyr', 'Val', 'Stop'];
export const ONE_LETTER = { A: 'Ala', R: 'Arg', N: 'Asn', D: 'Asp', C: 'Cys', Q: 'Gln', E: 'Glu', G: 'Gly', H: 'His', I: 'Ile', L: 'Leu', K: 'Lys', M: 'Met', F: 'Phe', P: 'Pro', S: 'Ser', T: 'Thr', W: 'Trp', Y: 'Tyr', V: 'Val', '*': 'Stop' };
/** Accepts "Leu", "leu", "L" or "*"; returns the three-letter name or null. */
export const aminoAcid = x => { const s = String(x ?? '').trim(); if (!s) return null; const t = s[0].toUpperCase() + s.slice(1).toLowerCase(); if (AMINO_ACIDS.includes(t)) return t; return ONE_LETTER[s.toUpperCase()] || null; };
export const ALL_CODONS = Object.keys(CODE).sort();
export const codonsOf = aa => ALL_CODONS.filter(c => CODE[c] === aa);
export const hamming = (c, d) => (c[0] !== d[0] ? 1 : 0) + (c[1] !== d[1] ? 1 : 0) + (c[2] !== d[2] ? 1 : 0);
/** Least nucleotide substitutions turning a codon of `a` into a codon of `b`; 4 when either has no codon. */
export const minSubst = (a, b) => { let m = 4; for (const c of codonsOf(a)) for (const d of codonsOf(b)) m = Math.min(m, hamming(c, d)); return m; };
/** A witnessing codon pair at distance minSubst(a, b), or null. */
export const witness = (a, b) => { const m = minSubst(a, b); for (const c of codonsOf(a)) for (const d of codonsOf(b)) if (hamming(c, d) === m) return { wt: c, mutant: d, distance: m }; return null; };
export const LEAN_AA = aa => `Delphi.Genotype.AminoAcid.${aa}`;

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('code.mjs')) {
  const cases = [['Phe', 'Leu', 1], ['Trp', 'Stop', 1], ['Met', 'Trp', 2], ['Phe', 'Phe', 0]];
  const bad = cases.filter(([a, b, n]) => minSubst(a, b) !== n);
  console.log(`${ALL_CODONS.length} codons; ${new Set(Object.values(CODE)).size} amino acids incl. Stop; Lean examples ${bad.length ? 'MISMATCH ' + JSON.stringify(bad) : 'all match (phe_leu_one, trp_stop_one, met_trp_two)'}`);
  if (bad.length) process.exit(1);
}
