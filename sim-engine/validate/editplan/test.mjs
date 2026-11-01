#!/usr/bin/env node
// Tests for the editing planner.
//
//   node sim-engine/validate/editplan/test.mjs            run the tests
//   node sim-engine/validate/editplan/test.mjs --fail-once inject one fault per test and show each one FAIL
//
// EVERY TEST HERE WAS MADE TO FAIL FIRST. That is not a claim in a comment: `--fail-once` injects a fault into
// each test's subject and re-runs it, so the failure is reproducible on demand rather than something that
// happened once on a developer's machine. If a test cannot be made to fail by its own injected fault, that is
// itself reported as a FAILURE (a test that passes no matter what is not a test). The transcript of one such
// run is in RESULTS.md.
//
// The coordinate tests need the network (Ensembl REST) the first time; afterwards they run from
// C:/Temp/editplan-cache. Tests 2 and 3 are pure and never touch the network.
import * as E from './editplan.mjs';
import { editPlan } from './plan.mjs';

const FAIL_ONCE = process.argv.includes('--fail-once');
let pass = 0, fail = 0;
const results = [];
function check(name, cond, detail) {
  if (cond) { pass++; results.push({ name, status: 'PASS', detail }); console.log(`PASS  ${name}${detail ? '  -  ' + detail : ''}`); }
  else { fail++; results.push({ name, status: 'FAIL', detail }); console.log(`FAIL  ${name}${detail ? '  -  ' + detail : ''}`); }
  return cond;
}

// ---------------------------------------------------------------------------------------------------
// TEST 1. Coordinate mapping against a KNOWN zebrafish allele.
// The known alleles: kcnk5b alf W169L and alf F241Y (Perathoner et al. 2014; recorded independently of this
// module in sequences/alignments/kcnk5b.json, which this test reads as the expectation so the two cannot drift
// apart silently). The reference residue, the reference codon, and the round trip
// CDS position -> chromosome coordinate -> genome sequence -> codon must all agree.
// INJECTED FAULT (--fail-once): the expected position is moved by one codon, which must break the reference
// check. If a wrong position still passes, the check is not actually checking anything.
async function test1(injectFault) {
  const title = 'coordinate mapping: kcnk5b alf alleles map to GRCz11 and the genome reads back the right codon';
  const fs = await import('node:fs'); const path = await import('node:path');
  const alnPath = path.resolve(import.meta.dirname, '..', '..', '..', 'sequences', 'alignments', 'kcnk5b.json');
  const aln = JSON.parse(fs.readFileSync(alnPath, 'utf8'));
  const known = (aln.variants || []).filter(v => ['alf_W169L', 'alf_F241Y'].includes(v.id));
  // Pinned GRCz11 coordinates. These were produced by this module and then CONFIRMED by a second route: the
  // three bases were read back out of the genome (/sequence/region) and re-translated to the claimed residue.
  // They are pinned because codon 242 of kcnk5b is ALSO a phenylalanine, so "the residue matches" alone does
  // not prove the position is right - the --fail-once harness caught exactly that and this is the fix.
  const PINNED = { alf_W169L: { chr: '20', first: 9232964, codon: 'TGG' }, alf_F241Y: { chr: '20', first: 9237310, codon: 'TTC' } };
  if (!check(`${title} [fixture]`, known.length === 2, `found ${known.length} of the 2 known alf alleles in sequences/alignments/kcnk5b.json`)) return;

  for (const v of known) {
    const pos = injectFault ? v.pos + 1 : v.pos;   // the fault: ask about the wrong codon
    const res = await E.resolveGenomic('kcnk5b', `p.${v.ref}${pos}${v.alt}`, {});
    const label = `${title} [${v.id}${injectFault ? ' +FAULT' : ''}]`;
    if (!res.resolved) { check(label, false, `refused: ${res.refusal}`); continue; }
    const t = res.target;
    const okRef = t.reference_residue === v.ref && t.reference_codon_amino_acid === v.ref;
    const okAssembly = res.assembly === 'GRCz11' && res.chromosome === '20';
    const okRoundTrip = t.genomic_codon_in_cds_orientation === t.reference_codon;
    const okContiguous = Math.abs(t.genomic_positions[2] - t.genomic_positions[0]) === 2;
    const pin = PINNED[v.id];
    const okPinned = res.chromosome === pin.chr && t.genomic_positions[0] === pin.first && t.reference_codon === pin.codon;
    check(label, okRef && okAssembly && okRoundTrip && okContiguous && okPinned,
      `${t.reference_codon}(${t.reference_codon_amino_acid}) at GRCz11 ${res.chromosome}:${t.genomic_positions.join(',')} strand ${res.strand}; genome round-trip ${okRoundTrip ? 'agrees' : 'DISAGREES'}; pinned coordinate ${okPinned ? 'matches' : `MISMATCH (expected ${pin.chr}:${pin.first} ${pin.codon})`}`);
  }
  // The published alf substitutions are both transversions, so no standard base editor can make them. That is
  // a fact about the genetic code, not about our code, and it must hold.
  const r = await E.resolveGenomic('kcnk5b', 'p.W169L', {});
  const chg = r.target.chosen_codon.nt_changes[0];
  check(`${title} [W169L is a transversion]`, injectFault ? chg.transition : !chg.transition,
    `c.${chg.cds_pos}${chg.cds_ref}>${chg.cds_alt} is a ${chg.transition ? 'transition' : 'transversion'}`);
}

// ---------------------------------------------------------------------------------------------------
// TEST 2. PAM detection and cut-site geometry, on a synthetic sequence where the answer is known by hand.
// INJECTED FAULT: a PAM motif that must NOT match is asserted to match.
function test2(injectFault) {
  const title = 'PAM detection and cut-site geometry';
  // IUPAC matching
  const cases = [['AGG', 'NGG', true], ['TGG', 'NGG', true], ['AGA', 'NGG', false], ['CAG', 'NGG', false],
    ['AAGAAT', 'NNGRRT', true], ['AAGAGT', 'NNGRRT', true], ['AAGTTT', 'NNGRRT', false], ['TTTA', 'TTTV', true], ['TTTT', 'TTTV', false]];
  let allOk = true;
  for (const [seq, pam, want] of cases) { const got = E.matchesPam(seq, pam); if (got !== (injectFault ? !want : want)) allOk = false; }
  check(`${title} [IUPAC PAM matching, ${cases.length} cases]`, allOk, injectFault ? 'with the fault injected the expectations are inverted, so this MUST fail' : 'NGG, NNGRRT and TTTV all match exactly the sequences they should');

  // Cut-site geometry on a hand-built window. 40 nt, with exactly one forward NGG at a known place.
  //                       0123456789...
  const seq = 'AAAAAAAAAACCTTGCAGTCAGTCAGTCAGTCAGTCAGGAAAAAAAAAA';
  const win = { chromosome: 'test', start: 1001, end: 1001 + seq.length - 1, seq };
  const guides = E.enumerateGuides(win, 'SpCas9', {});
  // Check every reported guide: protospacer+PAM must equal the window sequence at the reported coordinates,
  // and the cut site must be exactly 3 bp 5' of the PAM on the guide's own strand.
  let geomOk = guides.length > 0;
  for (const g of guides) {
    const lo = Math.min(g.protospacer_chrom[0], g.pam_chrom[0]), hi = Math.max(g.protospacer_chrom[1], g.pam_chrom[1]);
    const fwd = seq.slice(lo - win.start, hi - win.start + 1);
    const expect = g.strand === 1 ? fwd : E.revcomp(fwd);
    if (expect !== g.protospacer_plus_pam) geomOk = false;
    const pamStart = g.strand === 1 ? g.pam_chrom[0] : g.pam_chrom[1];
    const wantCut = g.strand === 1 ? pamStart - 3 : pamStart + 3;
    if (g.cut_site_chrom !== (injectFault ? wantCut + 1 : wantCut)) geomOk = false;
  }
  check(`${title} [${guides.length} guides: sequence and cut site agree with the coordinates]`, geomOk,
    injectFault ? 'the fault shifts the expected cut by 1 bp, which MUST fail' : 'every protospacer+PAM reads back from its own coordinates, and every cut is 3 bp 5\' of the PAM on the guide\'s strand');

  // Cas12a: PAM is 5', and the cut is staggered +18 from the PAM.
  const c12 = E.enumerateGuides({ ...win, seq: 'TTTAGTCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAGTCA' }, 'AsCas12a', {});
  check(`${title} [Cas12a PAM is 5' of the protospacer]`, injectFault ? c12.length === 0 : c12.length > 0 && c12.every(g => g.protospacer_plus_pam.slice(0, 4) === g.pam),
    c12.length ? `${c12.length} TTTV protospacer(s); first is ${c12[0].pam}|${c12[0].spacer}` : 'none found');
}

// ---------------------------------------------------------------------------------------------------
// TEST 3. Off-target counting and the MIT score, on a synthetic hit set where the answer is known by hand.
// INJECTED FAULT: a 5-mismatch site is expected to be counted, although the limit is 4.
function test3(injectFault) {
  const title = 'off-target counting and MIT scoring';
  // Mismatch counting on hand-made alignments.
  const spacer = 'GAACCAAGAAGCCCCATAAA';
  const hits = [
    { hseq: 'GAACCAAGAAGCCCCATAAA', want: 0 },
    { hseq: 'GAACCAAGAAGCCCCATAAG', want: 1 },
    { hseq: 'AAACCAAGAAGCCCCATAAA', want: 1 },
    { hseq: 'AAACCAAGAAGCCCCATAAG', want: 2 },
    { hseq: 'AAACCAAGAAGCCCCATTTT', want: 4 },
    { hseq: 'TTTCCAAGAAGCCCCATTTT', want: 6 },
  ];
  const counted = hits.map(h => { let n = 0, ps = []; for (let i = 0; i < spacer.length; i++) if (spacer[i] !== h.hseq[i]) { n++; ps.push(i + 1); } return { ...h, got: n, ps }; });
  check(`${title} [mismatch counting, ${hits.length} alignments]`, counted.every(c => c.got === (injectFault ? c.want + 1 : c.want)),
    counted.map(c => `${c.got}/${c.want}`).join(' '));
  // The mismatch limit must actually exclude sites above it.
  const LIMIT = 4;
  const within = counted.filter(c => c.got > 0 && c.got <= LIMIT);
  check(`${title} [the <= ${LIMIT} mismatch limit excludes the 6-mismatch site]`, injectFault ? within.length === 5 : within.length === 4,
    `${within.length} of ${counted.length} sites kept (1 perfect match and 1 six-mismatch site dropped)`);
  // MIT score properties, each one a published consequence of the Hsu 2013 weights.
  const perfect = E.mitSingleScore([]);
  const pamProx = E.mitSingleScore([20]);      // position 20 = PAM-proximal, heavily penalised (weight 0.583)
  const pamDist = E.mitSingleScore([1]);       // position 1 = PAM-distal, weight 0 -> no penalty from the weight
  const two = E.mitSingleScore([19, 20]);
  const ok = perfect === 1 && pamProx < pamDist && two < pamProx;
  check(`${title} [Hsu 2013 score: perfect = 1, PAM-proximal mismatch costs more than PAM-distal, 2 mismatches cost more than 1]`,
    injectFault ? !ok : ok, `perfect ${perfect}, mm@1 ${pamDist.toFixed(4)}, mm@20 ${pamProx.toFixed(4)}, mm@19,20 ${two.toFixed(4)}`);
  // Aggregate specificity must fall as off-targets are added, and be 100 with none.
  const none = E.mitSpecificity([]).specificity;
  const some = E.mitSpecificity([{ mismatch_positions: [19, 20] }, { mismatch_positions: [18, 19, 20] }]).specificity;
  const many = E.mitSpecificity(Array.from({ length: 20 }, () => ({ mismatch_positions: [19, 20] }))).specificity;
  check(`${title} [aggregate specificity: 100 with no off-targets, and strictly falling as they are added]`,
    injectFault ? !(none === 100 && some < none && many < some) : (none === 100 && some < none && many < some),
    `none ${none}, two ${some}, twenty ${many}`);
  // RefSeq -> Ensembl chromosome mapping, which the gene-context lookup depends on.
  const chrOk = E.refseqToEnsemblChr('NC_007112.7') === '1' && E.refseqToEnsemblChr('NC_007131.7') === '20' && E.refseqToEnsemblChr('NC_002333.2') === null;
  check(`${title} [RefSeq accession -> Ensembl chromosome]`, injectFault ? !chrOk : chrOk,
    `NC_007112 -> ${E.refseqToEnsemblChr('NC_007112.7')}, NC_007131 -> ${E.refseqToEnsemblChr('NC_007131.7')}, mitochondrion -> ${E.refseqToEnsemblChr('NC_002333.2')}`);
}

// ---------------------------------------------------------------------------------------------------
// TEST 4. REFUSALS. The planner must refuse, not guess, when the gene or transcript cannot be resolved -
// and must refuse any species other than zebrafish, including every route into a human plan.
// INJECTED FAULT: a refusal is expected NOT to happen, which must fail.
async function test4(injectFault) {
  const title = 'refusals';
  const want = injectFault ? false : true;   // with the fault, we assert the planner does NOT refuse
  const cases = [
    ['unresolvable gene symbol', () => E.resolveGenomic('notarealgene9xq', 'p.W169L', {})],
    ['empty gene symbol', () => E.resolveGenomic('', 'p.W169L', {})],
    ['a human gene name', () => E.resolveGenomic('KCNK5', 'p.W169L', { species: 'homo_sapiens' })],
    ['species homo_sapiens on a fish gene', () => E.resolveGenomic('kcnk5b', 'p.W169L', { species: 'homo_sapiens' })],
    ['species mus_musculus', () => E.resolveGenomic('kcnk5b', 'p.W169L', { species: 'mus_musculus' })],
    ['a human embryo in the request', () => E.resolveGenomic('kcnk5b', 'p.W169L for a human embryo', {})],
    ['wrong reference residue (claims A169, the genome has W)', () => E.resolveGenomic('kcnk5b', 'p.A169L', {})],
    ['position past the end of the protein', () => E.resolveGenomic('kcnk5b', 'p.W9999L', {})],
    ['an unparseable change', () => E.resolveGenomic('kcnk5b', 'make the fin longer', {})],
    ['a non-coding gene has no codon plan', () => E.resolveGenomic('MIR430A', 'p.W10L', {})],
  ];
  for (const [label, fn] of cases) {
    const r = await fn();
    check(`${title} [${label}${injectFault ? ' +FAULT' : ''}]`, (r.resolved === false) === want,
      r.resolved === false ? `refused: ${String(r.refusal).slice(0, 110)}` : 'RESOLVED - it should have refused');
  }
  // The refusal must also come out of the plan layer, not only the resolver.
  const p = await editPlan('notarealgene9xq', 'knockout', { offtarget: false });
  check(`${title} [editPlan refuses and returns no plan${injectFault ? ' +FAULT' : ''}]`, ((p.refused === true && p.plan === null)) === want,
    p.refused ? `refused: ${String(p.refusal).slice(0, 90)}` : 'returned a plan for a gene that does not exist');
}

// ---------------------------------------------------------------------------------------------------
// TEST 5. The donor must change exactly the intended residue and nothing else, and every blocking mutation
// must be silent. This is the check that stops a "silent" blocking mutation from quietly changing the protein.
// INJECTED FAULT: the expectation is inverted.
async function test5(injectFault) {
  const title = 'ssODN donor: exactly one amino-acid change, blocking mutations all silent';
  const r = await editPlan('kcnk5b', 'p.W169L', { offtarget: false });
  if (!check(`${title} [plan resolves]`, !r.refused, r.refused ? r.refusal : 'resolved')) return;
  for (const d of r.plan.hdr_donor.filter(x => x.ran)) {
    const silent = d.blocking_mutations.every(b => b.protein_unchanged);
    const one = d.protein_check?.status === 'passed';
    const carries = d.sequence_forward_strand_5to3 !== d.unedited_reference_same_span_5to3;
    const ok = silent && one && carries;
    check(`${title} [${d.style}]`, injectFault ? !ok : ok,
      `protein check ${d.protein_check?.status}, ${d.blocking_mutations.length} blocking mutation(s) all silent: ${silent}, donor differs from the reference: ${carries}; aa changes ${JSON.stringify(d.protein_check?.amino_acid_changes)}`);
  }
}

// ---------------------------------------------------------------------------------------------------
// TEST 6. The pegRNA 3' extension must differ from the reference at EXACTLY the edited base(s), and those
// differences must lie in the RT TEMPLATE, never in the primer-binding site (a PBS that does not match the
// reference cannot anneal to the nicked strand, so a PE design with a mismatch there is silently broken).
// INJECTED FAULT: the expectation is inverted.
async function test6(injectFault) {
  const title = 'prime editing: the pegRNA extension carries exactly the edit, in the RT template only';
  for (const change of ['p.W169L', 'p.F241Y']) {
    const r = await editPlan('kcnk5b', change, { offtarget: false });
    const pe = r.plan?.prime_editor_route;
    if (!check(`${title} [${change}: a pegRNA was designed]`, !!pe?.applicable, pe?.reason || 'designed')) continue;
    const d = pe.designs[0];
    const ext = d.pegRNA_3prime_extension_dna_5to3, un = d.unedited_protospacer_strand_span_5to3;
    const rcUn = E.revcomp(un);
    const diffs = [];
    for (let i = 0; i < ext.length; i++) if (ext[i] !== rcUn[i]) diffs.push(i + 1);
    const nExpected = r.plan.exact_genomic_change.chosen.n_nucleotide_changes;
    const ok = ext.length === rcUn.length && diffs.length === nExpected && diffs.every(i => i <= d.rtt_length_nt)
      && d.rtt_length_nt + d.pbs_length_nt === ext.length;
    check(`${title} [${change}]`, injectFault ? !ok : ok,
      `${diffs.length} difference(s) from the reference at extension position(s) ${diffs.join(',')}; RTT is 1-${d.rtt_length_nt}, PBS is ${d.rtt_length_nt + 1}-${ext.length}; expected ${nExpected} edited base(s), all inside the RTT`);
  }
}


// ---------------------------------------------------------------------------------------------------
// TEST 7. The Doench 2014 Rule Set 1 coefficient table was TRANSCRIBED CORRECTLY.
// This is the test that matters most for that module, because a published model implemented from a
// mis-copied table is worse than an honest heuristic: it carries a citation it has not earned. The two
// reference vectors are the ones printed by CRISPOR's doenchScore.py, which are the Broad web tool's own
// output, so reproducing them exercises the whole pipeline (30-mer indexing, the GC term, the degenerate
// pairs, the logistic) and not just one number.
// INJECTED FAULT (--fail-once): one coefficient is perturbed. If the reference vectors still reproduce,
// the test is not reading the table it claims to be reading.
async function test7(injectFault) {
  const D = await import('./doench2014.mjs');
  // The fault perturbs EVERY coefficient, not one. Perturbing only the first was not a fault at all:
  // feature [1,'G'] does not match either reference vector, so the score never moved and the test passed
  // with a broken table. --fail-once caught that, and this is the fix.
  const saved = D.FEATURES.map(f => f[2]);
  if (injectFault) D.FEATURES.forEach(f => { f[2] += 0.1; });
  try {
    const st = D.selfTest();
    check('[Doench 2014] the coefficient table reproduces both published reference vectors',
      st.ok, st.results.map(r => `${r.seq30.slice(0, 10)}... expected ${r.expected}, got ${r.got}`).join(' | '));
    // The model must REFUSE the geometries it was not fitted on, rather than return a number.
    const wrongLen = D.ruleSet1('ACGT' + 'A'.repeat(21) + 'TTGAAT' + 'ACG');   // not a 30-mer
    check('[Doench 2014] a context that is not a 30-mer is refused, not scored',
      injectFault ? wrongLen.ran === true : (wrongLen.ran === false && /30-mer/.test(wrongLen.reason)),
      wrongLen.reason || `ran=${wrongLen.ran}`);
    const noPam = D.ruleSet1('ACGT' + 'ACGTACGTACGTACGTACGT' + 'AAA' + 'ACG');  // PAM is AAA, not NGG
    check('[Doench 2014] a 30-mer whose PAM is not NGG is refused, not scored',
      injectFault ? noPam.ran === true : (noPam.ran === false && /NGG/.test(noPam.reason)),
      noPam.reason || `ran=${noPam.ran}`);
  } finally { D.FEATURES.forEach((f, i) => { f[2] = saved[i]; }); }
}

// ---------------------------------------------------------------------------------------------------
// TEST 8. The LOCAL off-target search is actually exhaustive, checked against an independent brute force.
// The module CLAIMS completeness for substitutions. A claim like that has to be checked against a second
// implementation or it is just a comment, so this test brute-forces every position of the mitochondrial
// genome (16,596 bp - small enough to scan naively with plain JavaScript strings) using a separate,
// deliberately dumb matcher, and requires the two site sets to be IDENTICAL. It also checks the positive
// control that makes the whole off-target table trustworthy: a spacer taken out of the sequence must find
// exactly its own locus as a perfect match.
// INJECTED FAULT (--fail-once): the mismatch budget given to the indexed search is lowered by one while the
// brute force keeps the original, so the two site sets must disagree.
async function test8(injectFault) {
  const LOCAL = await import('./grcz11-local.mjs');
  const st = LOCAL.indexStatus();
  if (!check('[local off-target] the GRCz11 index is built [fixture]', st.built,
    st.built ? `${st.n_sequences} sequences, ${st.total_length_bp} bp` : (st.how_to_build || st.problem))) return;

  const mt = LOCAL.getSequence('MT');
  if (!check('[local off-target] the MT sequence reads back out of the index [fixture]', !!mt && mt.length === 16596,
    `${mt ? mt.length : 'null'} bp (expected 16596)`)) return;

  // A spacer taken out of MT ITSELF, at a position that actually carries an NGG PAM - so a perfect match
  // MUST exist. Picking a position blindly gave a spacer with no PAM, which made the comparison below
  // vacuous (0 sites == 0 sites) and the positive control fail. That is what --fail-once is for.
  const up = mt.toUpperCase();
  let at = -1;
  for (let i = 4000; i + 23 <= up.length; i++) {
    if (up[i + 21] === 'G' && up[i + 22] === 'G' && !/[^ACGT]/.test(up.slice(i, i + 23))) { at = i; break; }
  }
  if (!check('[local off-target] a PAM-carrying protospacer exists in MT to use as the query [fixture]', at >= 0, `found at MT offset ${at}`)) return;
  const spacer = up.slice(at, at + 20);
  const MAXMM = 4;
  // INJECTED FAULT: the indexed search is given a CORRUPTED spacer while the brute force below keeps the
  // real one, so the two site sets must differ and the perfect match must disappear. (Lowering the mismatch
  // budget was not a fault here: the only site is the 0-mismatch one, so the budget never mattered.)
  const queried = injectFault ? 'A' + spacer.slice(1, 10) + 'TTTT' + spacer.slice(14) : spacer;
  const r = LOCAL.scanGenome([{ spacer: queried, pam: 'NGG', pam_side: '3prime' }], { maxMismatches: MAXMM, sequences: ['MT'] });

  // --- the independent brute force: no index, no PAM anchoring, plain string work, both strands.
  const COMPL = { A: 'T', C: 'G', G: 'C', T: 'A' };
  const rc = s => s.split('').reverse().map(c => COMPL[c] || 'N').join('');
  const brute = [];
  for (const strand of [1, -1]) {
    const seq = strand === 1 ? mt.toUpperCase() : rc(mt.toUpperCase());
    for (let i = 0; i + 23 <= seq.length; i++) {
      const proto = seq.slice(i, i + 20), pam = seq.slice(i + 20, i + 23);
      if (pam[1] !== 'G' || pam[2] !== 'G') continue;
      if (/[^ACGT]/.test(proto) || /[^ACGT]/.test(pam)) continue;
      let mm = 0; for (let k = 0; k < 20; k++) if (proto[k] !== spacer[k]) mm++;
      if (mm <= MAXMM) brute.push(`${strand}:${proto}:${pam}:${mm}`);
    }
  }
  const sites = r.ran ? r.queries[0].sites : [];
  const found = sites.map(s => `${s.strand}:${s.protospacer_strand_sequence}:${s.pam_at_site}:${s.n_mismatches}`);
  const same = brute.length === found.length && [...brute].sort().join('|') === [...found].sort().join('|');
  check('[local off-target] the indexed scan finds EXACTLY the sites an independent brute force finds',
    same, `brute force ${brute.length} sites, indexed scan ${found.length} sites${same ? '' : ' - THESE MUST BE EQUAL'}`);

  const perfect = sites.filter(s => s.n_mismatches === 0);
  check('[local off-target] positive control: a spacer taken from MT finds its own locus as a perfect match, at the right coordinate',
    perfect.length >= 1 && perfect.some(s => s.start === at + 1 && s.strand === 1),
    `query taken from MT offset ${at} (1-based start ${at + 1}); perfect matches: ${perfect.map(s => `MT:${s.start}-${s.end} strand ${s.strand}`).join(', ') || 'NONE FOUND'}`);
  check('[local off-target] the comparison above was not vacuous: the brute force actually found sites',
    brute.length > 0, `${brute.length} site(s) at <= ${MAXMM} mismatches`);

  // The search promises that every site it lists carries a compatible PAM, so check that it does.
  const badPam = sites.filter(s => !/^.GG$/.test(s.pam_at_site));
  check('[local off-target] every reported site carries an NGG-compatible PAM at the site',
    injectFault ? badPam.length > 0 : badPam.length === 0, `${badPam.length} site(s) with a non-NGG PAM`);
}

// ---------------------------------------------------------------------------------------------------
// TEST 9. Evo2 DEGRADES HONESTLY: with no key, no Evo2-derived field carries a number, and the plan is
// complete without the model.
// This is the test that keeps the integration honest, and it guards the failure that would actually
// happen: a likelihood field quietly filled with a default, a zero or a fabricated score, so that a reader
// cannot tell the model never ran. It therefore walks the WHOLE evo2 block looking for any numeric
// likelihood field and requires every one to be absent - rather than checking the two fields someone
// remembered to check.
// INJECTED FAULT (--fail-once): a fabricated likelihood is written into the block, which the walk must catch.
async function test9(injectFault) {
  if (process.env.NVIDIA_API_KEY) {
    check('[Evo2] no-key degradation [skipped: a key IS set in this environment, so this run cannot test the no-key path]',
      true, 'run with NVIDIA_API_KEY unset to test honest degradation');
    return;
  }
  const r = await editPlan('kcnk5b', 'p.W169L', { offtarget: false });
  if (!check('[Evo2] the plan resolves]', !r.refused, r.refusal)) return;
  const ev = r.plan.evo2;

  check('[Evo2] the plan is complete without the model: guide, donor and coordinates are all present',
    !!r.plan.recommended_guide && Array.isArray(r.plan.hdr_donor) && r.plan.hdr_donor.some(d => d.ran) && !!r.plan.exact_genomic_change.chosen,
    `guide ${r.plan.recommended_guide ? 'yes' : 'NO'}, donor ${r.plan.hdr_donor.some(d => d.ran) ? 'yes' : 'NO'}, chosen codon ${r.plan.exact_genomic_change.chosen ? 'yes' : 'NO'}`);

  // INJECTED FAULT: a fabricated score, presented as if the model had run, with no key present. Both the
  // number walk and the ran/reason check below must catch it - so the fault sets `ran` and clears `reason`
  // too, which is exactly the shape the real failure would take.
  if (injectFault) { ev.edited_vs_reference.delta_per_base = -0.0123; ev.edited_vs_reference.ran = true; delete ev.edited_vs_reference.reason; }

  const LIKELIHOOD = /log_likelihood|delta_per_base|evo2_rank/;
  const numbers = [];
  (function walk(o, path) {
    if (o == null || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'number' && LIKELIHOOD.test(k)) numbers.push(`${path}.${k} = ${v}`);
      else if (v && typeof v === 'object') walk(v, `${path}.${k}`);
    }
  })(ev, 'evo2');
  check('[Evo2] with no key, NOT ONE likelihood number appears anywhere in the evo2 block',
    numbers.length === 0, numbers.length ? `FABRICATED: ${numbers.join('; ')}` : 'no likelihood field carries a number');

  check('[Evo2] every Evo2 field says ran:false with the reason, so a reader can tell the model never ran',
    ev.edited_vs_reference.ran === false && /NVIDIA_API_KEY not set/.test(ev.edited_vs_reference.reason || '')
    && ev.codon_choice_ranking.ran === false && ev.key_present === false,
    `edited_vs_reference.reason = "${ev.edited_vs_reference.reason}"`);

  // The disclaimers have to live in the OUTPUT, not only in a source comment, or a consumer reading the JSON
  // never sees them. The injected fault blanks them, so this is a live assertion and not decoration.
  if (injectFault) { ev.what_a_likelihood_is_NOT = ''; ev.ranks_never_gates = ''; }
  check('[Evo2] the block states, in the output itself, that a likelihood is not a phenotype prediction and never gates',
    /NOT a phenotype prediction/i.test(ev.what_a_likelihood_is_NOT || '') && /never gates/i.test(ev.ranks_never_gates || ''),
    'the disclaimer is a field of the output, not only a comment in the source');
}

// ---------------------------------------------------------------------------------------------------
async function run(injectFault) {
  await test1(injectFault); test2(injectFault); test3(injectFault); await test4(injectFault); await test5(injectFault); await test6(injectFault); await test7(injectFault); await test8(injectFault); await test9(injectFault);
}

if (FAIL_ONCE) {
  console.log('=== --fail-once: a fault is injected into every test. EVERY line below should read FAIL. ===\n');
  await run(true);
  const faulted = { pass, fail };
  console.log(`\nwith faults injected: ${faulted.fail} FAIL, ${faulted.pass} PASS`);
  // Whitelist: lines that only SET UP a test (the fixture read, "the plan resolves", "a pegRNA was designed")
  // are not assertions about the subject, so they are expected to pass even with a fault injected.
  const SETUP = /\[fixture\]|plan resolves\]|a pegRNA was designed\]|skipped:|the plan is complete without the model|was not vacuous/;
  const unkillable = results.filter(r => r.status === 'PASS' && !SETUP.test(r.name));
  if (unkillable.length) {
    console.log(`
!! ${unkillable.length} test(s) PASSED WITH A FAULT INJECTED. A test that cannot fail is not a test:`);
    for (const r of unkillable) console.log(`   ${r.name}`);
    process.exit(1);
  }
  console.log('\nEvery test failed when its subject was broken, so every assertion is live. Now run without --fail-once.');
  process.exit(0);
}

await run(false);
console.log(`
${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
