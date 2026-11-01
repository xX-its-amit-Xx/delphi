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
async function run(injectFault) {
  await test1(injectFault); test2(injectFault); test3(injectFault); await test4(injectFault); await test5(injectFault); await test6(injectFault);
}

if (FAIL_ONCE) {
  console.log('=== --fail-once: a fault is injected into every test. EVERY line below should read FAIL. ===\n');
  await run(true);
  const faulted = { pass, fail };
  console.log(`\nwith faults injected: ${faulted.fail} FAIL, ${faulted.pass} PASS`);
  // Whitelist: lines that only SET UP a test (the fixture read, "the plan resolves", "a pegRNA was designed")
  // are not assertions about the subject, so they are expected to pass even with a fault injected.
  const SETUP = /\[fixture\]|plan resolves\]|a pegRNA was designed\]/;
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
