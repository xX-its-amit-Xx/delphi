#!/usr/bin/env node
// Tests for analogues/align.mjs -- the aligner and the CRISPR cassette layout.
//
//   node analogues/test-align.mjs [--fail-once]
//
// Four things are checked harder than the arithmetic, because they are the four ways this module could
// do quiet damage.
//
//   1. AFFINE GAPS. A linear gap penalty does not crash; it returns an alignment with the same number
//      of gap residues scattered into several runs, which is a different biological hypothesis (six
//      indels, not one) and which looks wrong to anyone who has seen an alignment. The affine/linear
//      pair below is one sequence pair scored two ways: 1 gap run or 2, from the same residues.
//   2. PERCENT IDENTITY. The same alignment reads 100%, 75% or 60% depending only on the denominator,
//      and the number is almost never reported with its denominator. The test asserts all three on one
//      alignment so the spread is on the record.
//   3. BLOSUM62 TRANSCRIPTION. A slipped row or a dropped minus sign is silent: the aligner still runs
//      and still returns a score. Symmetry plus spot checks on entries that are hard to get right by
//      accident is the only thing standing between a typo and a wrong alignment.
//   4. THE CUT SITE. SpCas9 cuts 3 bp 5' of the PAM. Every cassette coordinate is measured from there,
//      so an off-by-one designs an integration one base off and nothing downstream complains.
//
// --fail-once injects one fault into every assertion by inverting its predicate. Every line must then
// FAIL. An assertion that survives its own inversion is asserting nothing.
import * as A from './align.mjs';

const FAULT = process.argv.includes('--fail-once');
let pass=0, fail=0;
const check=(name,cond,detail='')=>{ if(cond){pass++;console.log(`  ok   ${name}`);} else {fail++;console.log(`  FAIL ${name}${detail?` - ${detail}`:''}`);} };
const f=(real,broken)=>(FAULT?broken:real);

const DNA = { match: 1, mismatch: -1, gapOpen: 2, gapExtend: 1 };
const near = (x, y, eps = 1e-9) => Math.abs(x - y) < eps;

// ===================================================================================================
console.log('\n-- identical sequences --');
// The floor case. If this is wrong nothing else means anything.
{
  const s = 'ACGTACGTAC';
  const r = A.needlemanWunsch(s, s, DNA);
  check('identical: score is match x length (10)',
    f(r.score === 10, r.score !== 10), `score ${r.score}`);
  check('identical: no gap runs',
    f(r.gapRuns === 0, r.gapRuns !== 0), `gapRuns ${r.gapRuns}`);
  check('identical: no gap columns',
    f(r.gapColumns === 0, r.gapColumns !== 0), `gapColumns ${r.gapColumns}`);
  const p = A.percentIdentity(r);
  check('identical: 100% on ALL THREE denominators (the only case where they agree)',
    f(p.overAlignedColumns === 100 && p.overShorter === 100 && p.overAlignmentLength === 100,
      !(p.overAlignedColumns === 100 && p.overShorter === 100 && p.overAlignmentLength === 100)),
    `${p.overAlignedColumns}/${p.overShorter}/${p.overAlignmentLength}`);
  check('identical: every column classed match',
    f(r.classes.every(c => c === 'match'), !r.classes.every(c => c === 'match')));
}

// ===================================================================================================
console.log('\n-- score symmetry --');
// score(a,b) must equal score(b,a). The three-matrix recursion is only symmetric if the Ix and Iy
// initialisations and the (disallowed) Ix<->Iy transitions are symmetric too; get one of those wrong
// and the aligner quietly prefers one argument order.
{
  const a = 'ACGTTGCAAGGT', b = 'ACTTGGCAAT';
  const ab = A.needlemanWunsch(a, b, DNA).score, ba = A.needlemanWunsch(b, a, DNA).score;
  check('NW: score(a,b) === score(b,a)', f(ab === ba, ab !== ba), `${ab} vs ${ba}`);
  const sab = A.smithWaterman(a, b, DNA).score, sba = A.smithWaterman(b, a, DNA).score;
  check('SW: score(a,b) === score(b,a)', f(sab === sba, sab !== sba), `${sab} vs ${sba}`);

  // A deterministic sweep, because one hand-picked pair can be symmetric by luck.
  let seed = 20261106;
  const rand = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const rnd = n => Array.from({ length: n }, () => 'ACGT'[Math.floor(rand() * 4)]).join('');
  let asym = 0;
  for (let k = 0; k < 250; k++) {
    const x = rnd(3 + Math.floor(rand() * 15)), y = rnd(3 + Math.floor(rand() * 15));
    if (A.needlemanWunsch(x, y, DNA).score !== A.needlemanWunsch(y, x, DNA).score) asym++;
    if (A.smithWaterman(x, y, DNA).score !== A.smithWaterman(y, x, DNA).score) asym++;
  }
  check('NW+SW: 0 asymmetric scores over 250 random pairs (500 comparisons)',
    f(asym === 0, asym !== 0), `${asym} asymmetric`);
}

// ===================================================================================================
console.log('\n-- hand-computed exact scores --');
// GATTACA vs GATACA, match=+2, mismatch=-1, gapOpen=3, gapExtend=1.
// The lengths differ by 1, so exactly one gap residue is forced and the best case is to lose no match:
//     G A T T A C A
//     G A - T A C A
// 6 identities x (+2) = +12, one gap run of length 1 = -(gapOpen + 0*gapExtend) = -3.  Total = +9.
// No alignment can beat it: 6 is the maximum number of identities available (b has 6 residues), and
// any alignment with 6 identities needs at least one gap, which costs at least 3. 12 - 3 = 9.
{
  const r = A.needlemanWunsch('GATTACA', 'GATACA', { match: 2, mismatch: -1, gapOpen: 3, gapExtend: 1 });
  check('hand case GATTACA/GATACA: score is exactly 9 (= 6x2 - 3)',
    f(r.score === 9, r.score !== 9), `score ${r.score}`);
  check('hand case: one gap run of length 1', f(r.gapRuns === 1 && r.gapColumns === 1,
    !(r.gapRuns === 1 && r.gapColumns === 1)), `runs ${r.gapRuns}, columns ${r.gapColumns}`);
  check('hand case: rows are GATTACA / GA-TACA',
    f(r.rowA === 'GATTACA' && r.rowB === 'GA-TACA', !(r.rowA === 'GATTACA' && r.rowB === 'GA-TACA')),
    `${r.rowA} / ${r.rowB}`);

  // ACGT vs AGT, match=+1, mismatch=-1, gapOpen=2, gapExtend=1. Enumerate all three sensible layouts:
  //   A C G T / A - G T  -> +1 -2 +1 +1 = +1      <- best
  //   A C G T / A G - T  -> +1 -1 -2 +1 = -1
  //   A C G T / A G T -  -> +1 -1 -1 -2 = -3
  const m = A.needlemanWunsch('ACGT', 'AGT', DNA);
  check('hand case ACGT/AGT: score is exactly 1', f(m.score === 1, m.score !== 1), `score ${m.score}`);
  check('hand case ACGT/AGT: gap placed at the C (A-GT)',
    f(m.rowB === 'A-GT', m.rowB !== 'A-GT'), m.rowB);

  // ACGTA vs ACTTA, same scoring, equal lengths. Ungapped: 4 identities + 1 mismatch = +3. Any gap pair
  // costs at least 2+2=4 to buy back 1 point of mismatch, so the ungapped alignment wins.
  const u = A.needlemanWunsch('ACGTA', 'ACTTA', DNA);
  check('hand case ACGTA/ACTTA: score is exactly 3, ungapped, one mismatch',
    f(u.score === 3 && u.gapRuns === 0 && u.classes.filter(c => c === 'mismatch').length === 1,
      !(u.score === 3 && u.gapRuns === 0 && u.classes.filter(c => c === 'mismatch').length === 1)),
    `score ${u.score}, runs ${u.gapRuns}`);
}

// ===================================================================================================
console.log('\n-- affine gaps vs linear: the gap RUN count --');
// One sequence pair, two scorings. a = 'AAAAAA' (6), b = 'AAXAAXAA' (8): b is 2 longer, so exactly 2
// gap residues are forced into a, and there are two ways to spend them.
//
//   SPLIT, two runs of 1, each placed on an X:      MERGED, one run of 2:
//     A A - A A - A A                                 A - - A A A A A
//     A A X A A X A A                                 A A X A A X A A
//     6 identities, 0 mismatches                      5 identities, 1 mismatch
//
//   linear (gapOpen = gapExtend = 1):  split 6 - 1 - 1 = +4   merged 5 - 1 - (1+1) = +2  -> SPLIT wins
//   affine (gapOpen = 5, gapExtend = 1): split 6 - 5 - 5 = -4  merged 5 - 1 - (5+1) = -2 -> MERGED wins
//
// So the same residues give 2 gap runs under a linear penalty and 1 under an affine one. That is the
// whole argument for affine gaps, asserted on the gap COUNT rather than on an eyeball.
{
  const a = 'AAAAAA', b = 'AAXAAXAA';
  const aff = A.needlemanWunsch(a, b, { match: 1, mismatch: -1, gapOpen: 5, gapExtend: 1 });
  const lin = A.needlemanWunsch(a, b, { match: 1, mismatch: -1, gapOpen: 1, gapExtend: 1 });

  check('affine (open 5, extend 1): exactly ONE gap run',
    f(aff.gapRuns === 1, aff.gapRuns !== 1), `gapRuns ${aff.gapRuns}, rowA ${aff.rowA}`);
  check('affine: that run is 2 residues long, contiguous',
    f(/-{2}/.test(aff.rowA) && aff.gapColumns === 2, !(/-{2}/.test(aff.rowA) && aff.gapColumns === 2)),
    `rowA ${aff.rowA}`);
  check('affine: score is exactly -2 (5 identities - 1 mismatch - (5+1) gap)',
    f(aff.score === -2, aff.score !== -2), `score ${aff.score}`);

  check('linear (open === extend === 1): TWO gap runs on the same residues',
    f(lin.gapRuns === 2, lin.gapRuns !== 2), `gapRuns ${lin.gapRuns}, rowA ${lin.rowA}`);
  check('linear: score is exactly +4 (6 identities - 1 - 1)',
    f(lin.score === 4, lin.score !== 4), `score ${lin.score}`);
  check('linear: same total gap residues as affine, just scattered',
    f(lin.gapColumns === aff.gapColumns, lin.gapColumns !== aff.gapColumns),
    `${lin.gapColumns} vs ${aff.gapColumns}`);
  check('scoring report flags the linear case as linear',
    f(lin.scoring.linear === true && aff.scoring.linear === false,
      !(lin.scoring.linear === true && aff.scoring.linear === false)));
}

// ===================================================================================================
console.log('\n-- percent identity: three denominators, three numbers --');
// ACGTACGT vs TTACGTAC, match=+1, mismatch=-1, gapOpen=2, gapExtend=1. The optimal alignment slides the
// two sequences past each other by 2, leaving a terminal gap at each end:
//
//     - - A C G T A C G T      6 identities
//     T T A C G T A C - -      6 columns with no gap, 8 residues in the shorter (both are 8), 10 columns
//
//   identities / aligned columns   = 6/6  = 100.0%   <- ignores both indels entirely
//   identities / shorter sequence  = 6/8  =  75.0%
//   identities / alignment length  = 6/10 =  60.0%   <- charges for the terminal gaps
//
// One alignment, a 40-point spread, and the figure legend usually says only "% identity".
{
  const r = A.needlemanWunsch('ACGTACGT', 'TTACGTAC', DNA);
  const p = A.percentIdentity(r);
  check('terminal-gap case: alignment is --ACGTACGT / TTACGTAC--',
    f(r.rowA === '--ACGTACGT' && r.rowB === 'TTACGTAC--',
      !(r.rowA === '--ACGTACGT' && r.rowB === 'TTACGTAC--')), `${r.rowA} / ${r.rowB}`);
  check('terminal-gap case: 6 identities, 6 ungapped columns, 8 shorter, 10 columns',
    f(p.identities === 6 && p.alignedColumns === 6 && p.shorterLength === 8 && p.alignmentLength === 10,
      !(p.identities === 6 && p.alignedColumns === 6 && p.shorterLength === 8 && p.alignmentLength === 10)),
    `${p.identities}/${p.alignedColumns}/${p.shorterLength}/${p.alignmentLength}`);
  check('overAlignedColumns is exactly 100.0%', f(near(p.overAlignedColumns, 100), !near(p.overAlignedColumns, 100)), `${p.overAlignedColumns}`);
  check('overShorter is exactly 75.0%', f(near(p.overShorter, 75), !near(p.overShorter, 75)), `${p.overShorter}`);
  check('overAlignmentLength is exactly 60.0%', f(near(p.overAlignmentLength, 60), !near(p.overAlignmentLength, 60)), `${p.overAlignmentLength}`);
  check('the three denominators give THREE DIFFERENT numbers on this alignment',
    f(new Set([p.overAlignedColumns, p.overShorter, p.overAlignmentLength]).size === 3,
      new Set([p.overAlignedColumns, p.overShorter, p.overAlignmentLength]).size !== 3));
  check('and they are ordered: aligned-columns >= shorter >= alignment-length',
    f(p.overAlignedColumns > p.overShorter && p.overShorter > p.overAlignmentLength,
      !(p.overAlignedColumns > p.overShorter && p.overShorter > p.overAlignmentLength)));
  check('each denominator ships its own explanation',
    f(Object.values(p.denominators).every(s => typeof s === 'string' && s.length > 40),
      !Object.values(p.denominators).every(s => typeof s === 'string' && s.length > 40)));
}
{
  // A second case, hand-built column by column, where the SHORTER sequence also carries gaps, so
  // alignedColumns (5) < shorterLength (6) and the first two denominators separate for a different
  // reason than above:
  //   col:  1  2  3  4  5  6  7  8
  //   a:    A  C  G  T  -  A  C  -     (6 residues)
  //   b:    A  C  G  A  T  -  C  G     (7 residues)
  //   ungapped columns: 1,2,3,4,7 -> 5 of them; identities: A,C,G,C -> 4 (col 4 is T/A, a mismatch)
  //   4/5 = 80.0%   4/6 = 66.67%   4/8 = 50.0%
  const p = A.percentIdentity({ rowA: 'ACGT-AC-', rowB: 'ACGAT-CG' });
  check('internal+terminal gaps: 4 identities over 5 ungapped columns, 6 shorter, 8 columns',
    f(p.identities === 4 && p.alignedColumns === 5 && p.shorterLength === 6 && p.alignmentLength === 8,
      !(p.identities === 4 && p.alignedColumns === 5 && p.shorterLength === 6 && p.alignmentLength === 8)),
    `${p.identities}/${p.alignedColumns}/${p.shorterLength}/${p.alignmentLength}`);
  check('internal+terminal gaps: 80.0 / 66.67 / 50.0',
    f(near(p.overAlignedColumns, 80) && near(p.overShorter, 400 / 6) && near(p.overAlignmentLength, 50),
      !(near(p.overAlignedColumns, 80) && near(p.overShorter, 400 / 6) && near(p.overAlignmentLength, 50))),
    `${p.overAlignedColumns}/${p.overShorter}/${p.overAlignmentLength}`);
  const bad = A.percentIdentity({ rowA: 'ACGT', rowB: 'ACG' });
  check('percentIdentity refuses ragged rows instead of returning a plausible number',
    f(bad.refused === true && bad.rule === 'ragged_rows', !(bad.refused === true && bad.rule === 'ragged_rows')),
    JSON.stringify(bad.rule));
}

// ===================================================================================================
console.log('\n-- BLOSUM62 --');
{
  const M = A.BLOSUM62;
  check('BLOSUM62 is 24 x 24 over the NCBI alphabet ARNDCQEGHILKMFPSTWYVBZX*',
    f(M.alphabet === 'ARNDCQEGHILKMFPSTWYVBZX*' && M.scores.length === 24 && M.scores.every(r => r.length === 24),
      !(M.alphabet === 'ARNDCQEGHILKMFPSTWYVBZX*' && M.scores.length === 24 && M.scores.every(r => r.length === 24))));

  let asym = [];
  for (let i = 0; i < 24; i++) for (let j = 0; j < 24; j++) if (M.scores[i][j] !== M.scores[j][i]) asym.push(`${M.alphabet[i]}${M.alphabet[j]}`);
  check('BLOSUM62 is symmetric: 0 of 576 entries disagree with their transpose',
    f(asym.length === 0, asym.length !== 0), asym.slice(0, 8).join(','));

  // Entries chosen because a transcription slip would change them and they are not guessable:
  // the two extreme diagonals (W, C), the conservative-substitution pairs, and one strongly negative
  // off-diagonal.
  const known = [['W','W',11],['C','C',9],['H','H',8],['P','P',7],['Y','Y',7],['A','A',4],
                 ['L','I',2],['I','L',2],['K','R',2],['D','E',2],['W','Y',2],['F','Y',3],
                 ['S','T',1],['P','F',-4],['G','W',-2],['*','*',1]];
  const wrong = known.filter(([x, y, v]) => M.get(x, y) !== v).map(([x, y, v]) => `${x}${y}=${M.get(x, y)}!=${v}`);
  check(`BLOSUM62 known entries (${known.length} spot checks incl. W/W=11, C/C=9, L/I=2, F/Y=3, P/F=-4)`,
    f(wrong.length === 0, wrong.length !== 0), wrong.join(' '));
  check('BLOSUM62 diagonal is positive for every real residue (not the ambiguity codes)',
    f([...'ARNDCQEGHILKMFPSTWYV'].every(c => M.get(c, c) > 0),
      ![...'ARNDCQEGHILKMFPSTWYV'].every(c => M.get(c, c) > 0)));
  check('BLOSUM62 falls back (-4) for a symbol outside the alphabet rather than returning undefined',
    f(M.get('J', 'A') === -4, M.get('J', 'A') !== -4), `${M.get('J', 'A')}`);
}
{
  // The scoringMatrix option must actually reach the inner loop. Aligning a peptide with itself under
  // BLOSUM62 must score the sum of its diagonal entries, which is nothing like match=1 would give.
  const pep = 'MKWVTFISLL';
  const expect = [...pep].reduce((s, c) => s + A.BLOSUM62.get(c, c), 0);
  const r = A.needlemanWunsch(pep, pep, { scoringMatrix: A.BLOSUM62, gapOpen: 11, gapExtend: 1 });
  check(`scoringMatrix option is used: self-alignment scores the BLOSUM62 diagonal sum (${expect})`,
    f(r.score === expect, r.score !== expect), `score ${r.score}`);
  check('scoringMatrix: that score differs from the match/mismatch default (so the option is not ignored)',
    f(expect !== pep.length, expect === pep.length), `${expect} vs ${pep.length}`);
  check('scoringMatrix is named in the returned scoring report',
    f(r.scoring.scoringMatrix === 'BLOSUM62', r.scoring.scoringMatrix !== 'BLOSUM62'), `${r.scoring.scoringMatrix}`);
  // A conservative substitution should cost less than a radical one, which is the point of the matrix.
  const cons = A.needlemanWunsch('MKWVTFISLL', 'MKWVTFISII', { scoringMatrix: A.BLOSUM62, gapOpen: 11, gapExtend: 1 });
  const rad  = A.needlemanWunsch('MKWVTFISLL', 'MKWVTFISPP', { scoringMatrix: A.BLOSUM62, gapOpen: 11, gapExtend: 1 });
  check('BLOSUM62 ranks L->I (conservative) above L->P (radical)',
    f(cons.score > rad.score, !(cons.score > rad.score)), `${cons.score} vs ${rad.score}`);
}

// ===================================================================================================
console.log('\n-- local alignment --');
{
  // A shared 8-mer buried in unrelated flanks. Global alignment has to pay for the flanks; local must
  // return the motif alone, with the right coordinates in both inputs.
  const a = 'TTTTACGTACGTTTTT', b = 'GGGGACGTACGTGGGG';
  const sw = A.smithWaterman(a, b, DNA);
  check('SW recovers the shared 8-mer exactly',
    f(sw.rowA === 'ACGTACGT' && sw.rowB === 'ACGTACGT', !(sw.rowA === 'ACGTACGT' && sw.rowB === 'ACGTACGT')),
    `${sw.rowA} / ${sw.rowB}`);
  check('SW score is 8 (8 identities, no gaps)', f(sw.score === 8, sw.score !== 8), `score ${sw.score}`);
  check('SW reports the span in BOTH inputs (a[5..12], b[5..12], 1-based)',
    f(sw.span.aStart === 5 && sw.span.aEnd === 12 && sw.span.bStart === 5 && sw.span.bEnd === 12,
      !(sw.span.aStart === 5 && sw.span.aEnd === 12 && sw.span.bStart === 5 && sw.span.bEnd === 12)),
    JSON.stringify(sw.span));
  const g = A.needlemanWunsch(a, b, DNA);
  check('SW score exceeds the global score on this pair (the flanks are pure cost globally)',
    f(sw.score > g.score, !(sw.score > g.score)), `${sw.score} vs ${g.score}`);
  const none = A.smithWaterman('AAAAAA', 'TTTTTT', DNA);
  check('SW on two sequences with nothing in common scores 0 and returns an empty alignment',
    f(none.score === 0 && none.rowA === '', !(none.score === 0 && none.rowA === '')),
    `score ${none.score}, rowA "${none.rowA}"`);
}

// ===================================================================================================
console.log('\n-- alignmentBlocks: the renderer contract --');
{
  const r = A.needlemanWunsch('ACGTACGT', 'TTACGTAC', DNA);  // 10 columns, gaps at both ends
  const b = A.alignmentBlocks(r, 4);
  check('blocks: 10 columns at width 4 gives 3 blocks (4+4+2)',
    f(b.blocks.length === 3 && b.blocks[2].columns.length === 2,
      !(b.blocks.length === 3 && b.blocks[2].columns.length === 2)),
    `${b.blocks.length} blocks`);
  const cols = b.blocks.flatMap(x => x.columns);
  check('blocks: every alignment column appears exactly once, in order',
    f(cols.length === 10 && cols.every((c, i) => c.col === i),
      !(cols.length === 10 && cols.every((c, i) => c.col === i))), `${cols.length} columns`);
  // The load-bearing claim: the coordinate on each column really indexes back into the INPUT string.
  const mapsBack = cols.every(c =>
    (c.posA === null ? c.charA === '-' : r.a[c.posA - 1] === c.charA) &&
    (c.posB === null ? c.charB === '-' : r.b[c.posB - 1] === c.charB));
  check('blocks: posA/posB are 1-based indices that recover the input residue for EVERY column',
    f(mapsBack, !mapsBack));
  check('blocks: a gap column carries null for the gapped row, a position for the other',
    f(cols.filter(c => c.charA === '-').every(c => c.posA === null && c.posB !== null),
      !cols.filter(c => c.charA === '-').every(c => c.posA === null && c.posB !== null)));
  const clsOk = cols.every(c => c.cls === (c.charA === '-' || c.charB === '-' ? 'gap' : c.charA === c.charB ? 'match' : 'mismatch'));
  check('blocks: every column class agrees with its two characters',
    f(clsOk, !clsOk));
  check('blocks: midline is | . and space, one glyph per column',
    f(b.blocks.every(x => x.midline.length === x.columns.length && /^[|. ]*$/.test(x.midline)),
      !b.blocks.every(x => x.midline.length === x.columns.length && /^[|. ]*$/.test(x.midline))));
  check('blocks: per-block coordinate ranges are null only where that row is all gaps',
    f(b.blocks[0].rangeA !== null && b.blocks[0].rangeA.from === 1 && b.blocks[0].rangeB.from === 1,
      !(b.blocks[0].rangeA !== null && b.blocks[0].rangeA.from === 1 && b.blocks[0].rangeB.from === 1)),
    JSON.stringify(b.blocks[0].rangeA));
  const badw = A.alignmentBlocks(r, 0);
  check('blocks: refuses a non-positive width', f(badw.refused === true, badw.refused !== true));
}

// ===================================================================================================
console.log('\n-- the O(n*m) size limit refuses, it does not hang --');
{
  const n = 3000;  // 3001 x 3001 = 9,006,001 cells, over MAX_CELLS = 4,000,000
  const t0 = Date.now();
  const r = A.needlemanWunsch('A'.repeat(n), 'A'.repeat(n), DNA);
  const ms = Date.now() - t0;
  check('oversized input: refused, not attempted',
    f(r.refused === true && r.rule === 'size_limit', !(r.refused === true && r.rule === 'size_limit')),
    JSON.stringify(r.rule));
  check('oversized input: the refusal states the cell count and the limit it is enforcing',
    f(r.cells === (n + 1) * (n + 1) && r.limit === A.MAX_CELLS,
      !(r.cells === (n + 1) * (n + 1) && r.limit === A.MAX_CELLS)), `cells ${r.cells}, limit ${r.limit}`);
  check('oversized input: refusal is immediate (<500 ms), i.e. it did not allocate and grind',
    f(ms < 500, !(ms < 500)), `${ms} ms`);
  const ok = A.needlemanWunsch('ACGT'.repeat(25), 'ACGT'.repeat(25), DNA);
  check('well-sized input just below the limit still aligns',
    f(ok.refused === false && ok.score === 100, !(ok.refused === false && ok.score === 100)), `score ${ok.score}`);
  const sign = A.needlemanWunsch('ACGT', 'ACGT', { ...DNA, gapOpen: -2 });
  check('a negative gap penalty is refused (they are positive magnitudes that get subtracted)',
    f(sign.refused === true && sign.rule === 'gap_penalty_sign', !(sign.refused === true && sign.rule === 'gap_penalty_sign')));
}

// ===================================================================================================
console.log('\n-- SpCas9 cut site: 3 bp 5\' of the PAM --');
// Worked example. Target strand, 0-based indices:
//
//   index:  0123   4...................23  242526  27..30
//   seq:    AAAA   GTCACCTCCAATGACTAGGG    TGG     CCCC
//           flank  <------ protospacer -->  PAM     flank
//
// The PAM starts at index 24. SpCas9 cuts bluntly 3 bp 5' of it, so exactly three bases -- indices 21,
// 22, 23, which are the spacer's last three, "GGG" -- lie between the break and the PAM. The break is
// therefore the bond between index 20 and index 21, i.e. between spacer positions 17 and 18 counting
// from the PAM-distal end. Off by one in either direction and the cassette integrates one base over.
const SPACER = 'GTCACCTCCAATGACTAGGG';
const LOCUS  = 'AAAA' + SPACER + 'TGG' + 'CCCC';
const PAM_AT = 24;
{
  const c = A.cutSite(SPACER, PAM_AT);
  check('cutSite: first base 3\' of the break is index 21 (= pamIndex - 3)',
    f(c.cutIndex === 21, c.cutIndex !== 21), `cutIndex ${c.cutIndex}`);
  check('cutSite: the break is the bond between index 20 and index 21',
    f(c.bluntCut.left === 20 && c.bluntCut.right === 21, !(c.bluntCut.left === 20 && c.bluntCut.right === 21)),
    JSON.stringify(c.bluntCut));
  check('cutSite: EXACTLY 3 bases of the locus lie between the break and the PAM',
    f(LOCUS.slice(c.cutIndex, c.pamIndex).length === 3, LOCUS.slice(c.cutIndex, c.pamIndex).length !== 3),
    `"${LOCUS.slice(c.cutIndex, c.pamIndex)}"`);
  check('cutSite: those 3 bases are the spacer\'s last three, GGG',
    f(LOCUS.slice(c.cutIndex, c.pamIndex) === 'GGG' && c.basesBetweenCutAndPam === 'GGG',
      !(LOCUS.slice(c.cutIndex, c.pamIndex) === 'GGG' && c.basesBetweenCutAndPam === 'GGG')),
    c.basesBetweenCutAndPam);
  check('cutSite: the base immediately 3\' of the break is spacer position 18 (0-based 17)',
    f(LOCUS[c.cutIndex] === SPACER[17], LOCUS[c.cutIndex] !== SPACER[17]), `${LOCUS[c.cutIndex]} vs ${SPACER[17]}`);
  check('cutSite: break falls between spacer positions 17 and 18, PAM-distal numbering',
    f(c.betweenSpacerPositions[0] === 17 && c.betweenSpacerPositions[1] === 18,
      !(c.betweenSpacerPositions[0] === 17 && c.betweenSpacerPositions[1] === 18)),
    JSON.stringify(c.betweenSpacerPositions));
  check('cutSite: bpFromPam is 3 and the number is labelled mechanistic with a source',
    f(c.bpFromPam === 3 && c.basis === 'mechanistic' && c.source.length > 40,
      !(c.bpFromPam === 3 && c.basis === 'mechanistic' && c.source.length > 40)), `bpFromPam ${c.bpFromPam}`);
  check('cutSite: the protospacer span ends where the PAM begins (indices 4..23)',
    f(c.protospacer.start === 4 && c.protospacer.end === 23 && c.protospacer.end + 1 === PAM_AT,
      !(c.protospacer.start === 4 && c.protospacer.end === 23 && c.protospacer.end + 1 === PAM_AT)),
    JSON.stringify(c.protospacer));
  check('cutSite: the break is blunt (SpCas9), not staggered',
    f(c.blunt === true && c.nuclease === 'SpCas9', !(c.blunt === true && c.nuclease === 'SpCas9')));

  const s19 = A.cutSite(SPACER.slice(0, 19), PAM_AT);
  check('cutSite: refuses a 19 nt spacer, stating the number 20',
    f(s19.refused === true && s19.rule === 'spacer_length' && s19.number === 20,
      !(s19.refused === true && s19.rule === 'spacer_length' && s19.number === 20)),
    JSON.stringify([s19.rule, s19.number]));
  const off = A.cutSite(SPACER, 10);
  check('cutSite: refuses a pamIndex too small for the protospacer to fit',
    f(off.refused === true && off.rule === 'pam_index_range', !(off.refused === true && off.rule === 'pam_index_range')));
}

// ===================================================================================================
console.log('\n-- validateSpacer --');
{
  const good = A.validateSpacer(SPACER);
  check('validateSpacer: the worked-example spacer passes with no hard problems',
    f(good.ok === true && good.problems.length === 0, !(good.ok === true && good.problems.length === 0)),
    JSON.stringify(good.problems.map(p => p.rule)));
  check('validateSpacer: GC is 55% and sits inside the conventional 40-80% band',
    f(good.gcPercent === 55 && good.gcBand.min === 40 && good.gcBand.max === 80,
      !(good.gcPercent === 55 && good.gcBand.min === 40 && good.gcBand.max === 80)), `GC ${good.gcPercent}`);
  check('validateSpacer: reports that the spacer ends in GG',
    f(good.endsInGG === true, good.endsInGG !== true));

  // The poly-T failure. 'GTCACC TTTT ATGACTAGGG' is a valid-looking 20-mer with a run of 4 T at
  // position 7. Pol III terminates there, so a U6-driven guide is truncated or never made.
  const polyT = A.validateSpacer('GTCACCTTTTATGACTAGGG');
  check('validateSpacer: a spacer with a run of 4 T is REJECTED (Pol III termination)',
    f(polyT.ok === false, polyT.ok !== false));
  check('validateSpacer: the poly-T rejection names the number 4 and labels it mechanistic',
    f(polyT.problems.some(p => p.rule === 'poly_t_run' && p.number === 4 && p.basis === 'mechanistic'),
      !polyT.problems.some(p => p.rule === 'poly_t_run' && p.number === 4 && p.basis === 'mechanistic')),
    JSON.stringify(polyT.problems.map(p => [p.rule, p.number])));
  check('validateSpacer: reports where the run starts (position 7) and how long it is',
    f(polyT.polyTRun.at === 7 && polyT.polyTRun.length === 4,
      !(polyT.polyTRun.at === 7 && polyT.polyTRun.length === 4)), JSON.stringify(polyT.polyTRun));
  // Three T is not a terminator. The threshold has to be a threshold, not "lots of T looks risky".
  const threeT = A.validateSpacer('GTCACCTTTAATGACTAGGG');
  check('validateSpacer: a run of only 3 T is NOT rejected (the signal is 4+, not "some T")',
    f(threeT.ok === true && threeT.polyTRun === null, !(threeT.ok === true && threeT.polyTRun === null)),
    JSON.stringify(threeT.problems.map(p => p.rule)));

  const short = A.validateSpacer(SPACER.slice(0, 19));
  check('validateSpacer: a 19 nt spacer is refused, stating the number 20',
    f(short.ok === false && short.problems.some(p => p.rule === 'length' && p.number === 20),
      !(short.ok === false && short.problems.some(p => p.rule === 'length' && p.number === 20))),
    JSON.stringify(short.problems.map(p => [p.rule, p.number])));
  const ambiguous = A.validateSpacer('GTCACCTCCAATGACTANGG'.slice(0, 20));
  check('validateSpacer: an IUPAC ambiguity code is refused (a spacer is unambiguous DNA)',
    f(ambiguous.ok === false && ambiguous.problems.some(p => p.rule === 'alphabet'),
      !(ambiguous.ok === false && ambiguous.problems.some(p => p.rule === 'alphabet'))));

  // GC outside the band is a CONVENTION, so it must be a note and not a rejection. Collapsing the two
  // would make the module throw away usable guides on the strength of a design-tool filter.
  const lowGC = A.validateSpacer('ATATATATATATATATATGG');
  check('validateSpacer: out-of-band GC is a NOTE, not a rejection (it is a convention)',
    f(lowGC.ok === true && lowGC.notes.some(n => n.rule === 'gc_band' && n.basis === 'conventional'),
      !(lowGC.ok === true && lowGC.notes.some(n => n.rule === 'gc_band' && n.basis === 'conventional'))),
    `ok ${lowGC.ok}, GC ${lowGC.gcPercent}`);
}

// ===================================================================================================
console.log('\n-- CASSETTE_PARTS vocabulary --');
{
  const P = A.CASSETTE_PARTS, ids = Object.keys(P);
  check('CASSETTE_PARTS covers all 11 parts: 8 donor parts + the 3-part sgRNA unit',
    f(ids.length === 11 && A.DONOR_PART_ORDER.length === 8 && A.SGRNA_PART_ORDER.length === 3,
      !(ids.length === 11 && A.DONOR_PART_ORDER.length === 8 && A.SGRNA_PART_ORDER.length === 3)),
    `${ids.length} parts`);
  check('CASSETTE_PARTS: both homology arms, promoter, cds, linker, tag, terminator, marker present',
    f(['homology_arm_5','promoter','cds','linker','tag','terminator','selection_marker','homology_arm_3'].every(k => k in P),
      !['homology_arm_5','promoter','cds','linker','tag','terminator','selection_marker','homology_arm_3'].every(k => k in P)));
  check('CASSETTE_PARTS: the sgRNA expression unit is separate (promoter + spacer + scaffold)',
    f(['sgrna_promoter','spacer','sgrna_scaffold'].every(k => k in P) && A.SGRNA_PART_ORDER.every(k => !A.DONOR_PART_ORDER.includes(k)),
      !(['sgrna_promoter','spacer','sgrna_scaffold'].every(k => k in P) && A.SGRNA_PART_ORDER.every(k => !A.DONOR_PART_ORDER.includes(k)))));
  check('CASSETTE_PARTS: every part states a role, a typical length range and a basis',
    f(ids.every(k => P[k].role.length > 20 && Number.isFinite(P[k].typicalLength.min) && Number.isFinite(P[k].typicalLength.max) && P[k].typicalLength.max >= P[k].typicalLength.min && P[k].basis),
      !ids.every(k => P[k].role.length > 20 && Number.isFinite(P[k].typicalLength.min) && Number.isFinite(P[k].typicalLength.max) && P[k].typicalLength.max >= P[k].typicalLength.min && P[k].basis)));
  check('CASSETTE_PARTS: every part says what goes wrong if it is omitted or mis-sized',
    f(ids.every(k => typeof P[k].failure === 'string' && P[k].failure.length > 60),
      !ids.every(k => typeof P[k].failure === 'string' && P[k].failure.length > 60)),
    ids.filter(k => (P[k].failure || '').length <= 60).join(','));
  check('CASSETTE_PARTS: the terminator entry actually names read-through as the failure',
    f(/read-?through/i.test(P.terminator.failure), !/read-?through/i.test(P.terminator.failure)));
  check('CASSETTE_PARTS: the homology-arm entries name HDR collapse as the failure',
    f(/HDR/.test(P.homology_arm_5.failure) && /arm/i.test(P.homology_arm_3.failure),
      !(/HDR/.test(P.homology_arm_5.failure) && /arm/i.test(P.homology_arm_3.failure))));
  check('CASSETTE_PARTS is frozen (a vocabulary, not a scratchpad)',
    f(Object.isFrozen(P) && Object.isFrozen(P.cds), !(Object.isFrozen(P) && Object.isFrozen(P.cds))));

  const L = A.CASSETTE_LIMITS, labels = ['definitional', 'mechanistic', 'conventional'];
  check('every enforced number carries one of the three bases and a non-empty source',
    f(Object.values(L).every(x => labels.includes(x.basis) && typeof x.source === 'string' && x.source.length > 40),
      !Object.values(L).every(x => labels.includes(x.basis) && typeof x.source === 'string' && x.source.length > 40)));
  check('every `conventional` number names its convention rather than just asserting a threshold',
    f(Object.values(L).filter(x => x.basis === 'conventional').every(x => /onvention|protocol|design tool/i.test(x.source)),
      !Object.values(L).filter(x => x.basis === 'conventional').every(x => /onvention|protocol|design tool/i.test(x.source))));
  check('the module states that it predicts no HDR efficiency number',
    f(A.WHAT_THIS_DOES_NOT_PREDICT.some(s => /HDR efficiency/i.test(s)),
      !A.WHAT_THIS_DOES_NOT_PREDICT.some(s => /HDR efficiency/i.test(s))));
}

// ===================================================================================================
console.log('\n-- layoutCassette --');
const donor = (over = {}) => ({
  locus: { name: 'DEMO_LOCUS', sequence: LOCUS, pamIndex: PAM_AT },
  spacer: SPACER,
  donorType: 'dsDNA',
  parts: [
    { id: 'homology_arm_5', length: over.arm5 ?? 600 },
    { id: 'promoter', length: 400 },
    { id: 'cds', length: over.cds ?? 720 },
    { id: 'linker', length: 45 },
    { id: 'tag', length: 27 },
    { id: 'terminator', length: 225 },
    { id: 'selection_marker', length: 1200 },
    { id: 'homology_arm_3', length: over.arm3 ?? 600 },
  ],
  ...over.spec,
});
{
  const L = A.layoutCassette(donor());
  check('layout: the well-formed cassette is accepted',
    f(L.refused === false, L.refused !== false), JSON.stringify(L.violations?.map(v => v.rule)));
  check('layout: total length is 3817 bp and the insert between the arms is 2617 bp',
    f(L.totalLength === 3817 && L.insertLength === 2617, !(L.totalLength === 3817 && L.insertLength === 2617)),
    `total ${L.totalLength}, insert ${L.insertLength}`);
  check('layout: parts come back in DONOR_PART_ORDER',
    f(L.parts.map(p => p.id).join(',') === A.DONOR_PART_ORDER.join(','),
      L.parts.map(p => p.id).join(',') !== A.DONOR_PART_ORDER.join(',')), L.parts.map(p => p.id).join(','));
  const contiguous = L.parts.every((p, i) => (i === 0 ? p.start === 0 : p.start === L.parts[i - 1].end + 1) && p.end - p.start + 1 === p.length);
  check('layout: coordinates are cumulative and contiguous, with no gap or overlap between parts',
    f(contiguous && L.parts.at(-1).end === L.totalLength - 1,
      !(contiguous && L.parts.at(-1).end === L.totalLength - 1)),
    L.parts.map(p => `${p.id}:${p.start}-${p.end}`).join(' '));
  check('layout: insertSpan starts after the 5\' arm and ends before the 3\' arm',
    f(L.insertSpan.start === 600 && L.insertSpan.end === 3216,
      !(L.insertSpan.start === 600 && L.insertSpan.end === 3216)), JSON.stringify(L.insertSpan));
  check('layout: one junction per part boundary (8 parts -> 7 junctions)',
    f(L.junctions.length === 7, L.junctions.length !== 7), `${L.junctions.length}`);
  check('layout: the cut site is carried through, 3 bp 5\' of the PAM',
    f(L.cut.cutIndex === 21 && L.cut.bpFromPam === 3, !(L.cut.cutIndex === 21 && L.cut.bpFromPam === 3)),
    JSON.stringify(L.cut && [L.cut.cutIndex, L.cut.bpFromPam]));
  check('layout: arms flagged symmetric when equal, and the enforced numbers are reported',
    f(L.arms.asymmetric === false && L.enforced.some(e => e.rule === 'homology_arm_too_short' && e.number === 300),
      !(L.arms.asymmetric === false && L.enforced.some(e => e.rule === 'homology_arm_too_short' && e.number === 300))));

  // With real sequence, junction sequences must be the actual flanking bases, not a placeholder.
  const seqSpec = {
    locus: { name: 'DEMO_LOCUS', sequence: LOCUS, pamIndex: PAM_AT }, spacer: SPACER, donorType: 'ssODN',
    junctionFlank: 4,
    parts: [{ id: 'homology_arm_5', sequence: 'A'.repeat(40) }, { id: 'tag', sequence: 'CCCGGGTTT' }, { id: 'homology_arm_3', sequence: 'T'.repeat(40) }],
  };
  const S = A.layoutCassette(seqSpec);
  check('layout: ssODN donor is checked against the 30 nt arm floor, not the 300 bp one',
    f(S.refused === false && S.enforced.some(e => e.rule === 'homology_arm_too_short' && e.number === 30),
      !(S.refused === false && S.enforced.some(e => e.rule === 'homology_arm_too_short' && e.number === 30))),
    JSON.stringify(S.violations?.map(v => v.rule)));
  check('layout: junction sequence is the real flanking bases (AAAA|CCCG)',
    f(S.junctions[0].sequence === 'AAAACCCG' && S.junctions[0].sequenceKnown === true,
      !(S.junctions[0].sequence === 'AAAACCCG' && S.junctions[0].sequenceKnown === true)),
    `${S.junctions[0].sequence}`);
  check('layout: a junction with no sequence available says so instead of inventing one',
    f(L.junctions[0].sequence === null && L.junctions[0].sequenceKnown === false,
      !(L.junctions[0].sequence === null && L.junctions[0].sequenceKnown === false)));
}

console.log('\n-- layoutCassette refusals (each states its number and where it comes from) --');
{
  const hasNumber = (r, rule, n) => r.refused === true && r.violations.some(v => v.rule === rule && v.number === n && typeof v.source === 'string' && v.source.length > 40);

  const shortArm = A.layoutCassette(donor({ arm5: 100 }));
  check('refusal: a 100 bp homology arm is refused, stating the 300 bp floor and its source',
    f(hasNumber(shortArm, 'homology_arm_too_short', 300), !hasNumber(shortArm, 'homology_arm_too_short', 300)),
    JSON.stringify(shortArm.violations?.map(v => [v.rule, v.number])));
  check('refusal: the arm refusal also says what goes wrong (HDR collapse, one-sided integration)',
    f(/HDR/.test(shortArm.violations[0].detail), !/HDR/.test(shortArm.violations[0].detail)));

  const noArm = A.layoutCassette({ ...donor(), parts: donor().parts.filter(p => p.id !== 'homology_arm_3') });
  check('refusal: a missing homology arm is refused, not silently laid out',
    f(noArm.refused === true && noArm.violations.some(v => v.rule === 'homology_arm_missing'),
      !(noArm.refused === true && noArm.violations.some(v => v.rule === 'homology_arm_missing'))));

  const bigInsert = A.layoutCassette({ ...donor(), parts: [{ id: 'homology_arm_5', length: 600 }, { id: 'cds', length: 9000 }, { id: 'homology_arm_3', length: 600 }] });
  check('refusal: a 9000 bp insert is refused, stating the 5000 bp practical ceiling',
    f(hasNumber(bigInsert, 'insert_too_large', 5000), !hasNumber(bigInsert, 'insert_too_large', 5000)),
    JSON.stringify(bigInsert.violations?.map(v => [v.rule, v.number])));
  check('refusal: the insert ceiling is labelled conventional, not presented as measured',
    f(bigInsert.violations.find(v => v.rule === 'insert_too_large').basis === 'conventional',
      bigInsert.violations.find(v => v.rule === 'insert_too_large').basis !== 'conventional'));

  const s19 = A.layoutCassette({ ...donor(), spacer: SPACER.slice(0, 19) });
  check('refusal: a 19 nt spacer is refused, stating the number 20',
    f(hasNumber(s19, 'spacer_length', 20), !hasNumber(s19, 'spacer_length', 20)),
    JSON.stringify(s19.violations?.map(v => [v.rule, v.number])));

  const polyT = A.layoutCassette({ ...donor(), spacer: 'GTCACCTTTTATGACTAGGG', locus: { name: 'x', sequence: 'AAAA' + 'GTCACCTTTTATGACTAGGG' + 'TGG' + 'CCCC', pamIndex: PAM_AT } });
  check('refusal: a spacer with a poly-T run is refused by the layout too, stating the number 4',
    f(hasNumber(polyT, 'spacer_poly_t_run', 4), !hasNumber(polyT, 'spacer_poly_t_run', 4)),
    JSON.stringify(polyT.violations?.map(v => [v.rule, v.number])));

  const noPam = A.layoutCassette({ ...donor(), locus: { name: 'x', sequence: 'AAAA' + SPACER + 'TAA' + 'CCCC', pamIndex: PAM_AT } });
  check('refusal: no NGG PAM adjacent to the cut site is refused, naming the motif it requires',
    f(noPam.refused === true && noPam.violations.some(v => v.rule === 'pam_missing' && v.number === 'NGG'),
      !(noPam.refused === true && noPam.violations.some(v => v.rule === 'pam_missing' && v.number === 'NGG'))),
    JSON.stringify(noPam.violations?.map(v => [v.rule, v.number])));
  const noLocus = A.layoutCassette({ ...donor(), locus: {} });
  check('refusal: a locus with no sequence or pamIndex is refused (there is no cut site to build against)',
    f(noLocus.refused === true && noLocus.violations.some(v => v.rule === 'pam_missing'),
      !(noLocus.refused === true && noLocus.violations.some(v => v.rule === 'pam_missing'))));

  // The spacer must actually be where the layout thinks it is, or the coordinates are fiction.
  const wrongPlace = A.layoutCassette({ ...donor(), locus: { name: 'x', sequence: 'AAAA' + 'ACGTACGTACGTACGTACGT' + 'TGG' + 'CCCC', pamIndex: PAM_AT } });
  check('refusal: a spacer that is not the 20 nt 5\' of the PAM is refused',
    f(wrongPlace.refused === true && wrongPlace.violations.some(v => v.rule === 'spacer_not_at_pam'),
      !(wrongPlace.refused === true && wrongPlace.violations.some(v => v.rule === 'spacer_not_at_pam'))),
    JSON.stringify(wrongPlace.violations?.map(v => v.rule)));

  const mixedUp = A.layoutCassette({ ...donor(), parts: [...donor().parts, { id: 'sgrna_scaffold', length: 76 }] });
  check('refusal: an sgRNA-unit part placed inside the donor cassette is refused',
    f(mixedUp.refused === true && mixedUp.violations.some(v => v.rule === 'part_not_in_donor'),
      !(mixedUp.refused === true && mixedUp.violations.some(v => v.rule === 'part_not_in_donor'))));
  const unknown = A.layoutCassette({ ...donor(), parts: [...donor().parts, { id: 'kozak', length: 6 }] });
  check('refusal: a part id outside the frozen vocabulary is refused rather than ignored',
    f(unknown.refused === true && unknown.violations.some(v => v.rule === 'unknown_part'),
      !(unknown.refused === true && unknown.violations.some(v => v.rule === 'unknown_part'))));
}

// ===================================================================================================
console.log('\n-- homologyArmAdvice --');
{
  const tiny = A.homologyArmAdvice(30), mid = A.homologyArmAdvice(700), big = A.homologyArmAdvice(4000);
  check('advice: a 30 bp edit gets the ssODN regime with 30-60 nt arms',
    f(tiny.donorType === 'ssODN' && tiny.armLength.min === 30 && tiny.armLength.max === 60,
      !(tiny.donorType === 'ssODN' && tiny.armLength.min === 30 && tiny.armLength.max === 60)),
    JSON.stringify([tiny.donorType, tiny.armLength]));
  check('advice: a 700 bp insert gets a dsDNA donor with 300-800 bp arms',
    f(mid.donorType === 'dsDNA' && mid.armLength.min === 300 && mid.armLength.max === 800,
      !(mid.donorType === 'dsDNA' && mid.armLength.min === 300 && mid.armLength.max === 800)),
    JSON.stringify([mid.donorType, mid.armLength]));
  check('advice: a 4 kb insert gets a plasmid donor with 500-1000 bp arms',
    f(big.donorType === 'plasmid' && big.armLength.min === 500 && big.armLength.max === 1000,
      !(big.donorType === 'plasmid' && big.armLength.min === 500 && big.armLength.max === 1000)),
    JSON.stringify([big.donorType, big.armLength]));
  check('advice: arm length rises (or holds) with insert length across the three regimes',
    f(tiny.armLength.min <= mid.armLength.min && mid.armLength.min <= big.armLength.min,
      !(tiny.armLength.min <= mid.armLength.min && mid.armLength.min <= big.armLength.min)));
  check('advice: every regime is labelled `conventional` and names its source',
    f([tiny, mid, big].every(x => x.basis === 'conventional' && x.source.length > 40),
      ![tiny, mid, big].every(x => x.basis === 'conventional' && x.source.length > 40)));
  check('advice: the caveat says the guidance is organism- and method-dependent',
    f([tiny, mid, big].every(x => /organism/i.test(x.caveat) && /method|delivery/i.test(x.caveat)),
      ![tiny, mid, big].every(x => /organism/i.test(x.caveat) && /method|delivery/i.test(x.caveat))));
  check('advice: no efficiency percentage is asserted anywhere in the guidance text',
    f([tiny, mid, big].every(x => !/\d+\s*%/.test(x.source + x.caveat)),
      ![tiny, mid, big].every(x => !/\d+\s*%/.test(x.source + x.caveat))));
  const bad = A.homologyArmAdvice(-5);
  check('advice: refuses a negative insert length', f(bad.refused === true, bad.refused !== true));
}

// ===================================================================================================
console.log(`\n${pass} pass, ${fail} fail`);
if (FAULT) {
  console.log(`\n--fail-once: every assertion above had its predicate inverted. ${pass} survived.`);
  console.log(pass === 0
    ? 'No survivors: every assertion is load-bearing.'
    : 'SURVIVORS. Those assertions assert nothing about their subject and are not tests.');
}
process.exit(fail && !FAULT ? 1 : 0);
