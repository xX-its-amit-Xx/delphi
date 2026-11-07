#!/usr/bin/env node
// Real sequence alignment, and the data a CRISPR knock-in cassette figure needs.
//
// Two unrelated jobs live here because the dashboard panel that shows them is one panel: an alignment
// of a candidate coding sequence against its ortholog, and the cassette that would knock the edited
// version in. Neither half draws anything. Both halves return data a renderer can lay out.
//
// PART 1 -- alignment
//   needlemanWunsch(a, b, opts)   global, affine gaps (Gotoh, three matrices)
//   smithWaterman(a, b, opts)     local, same scoring
//   percentIdentity(aln)          all three denominators, named, because "% identity" is ambiguous
//   alignmentBlocks(aln, width)   per-column rows, classes and coordinates in BOTH inputs
//   BLOSUM62                      a real substitution matrix, as data (see test-align.mjs for the
//                                 symmetry and spot checks that catch a transcription slip)
//
// WHY AFFINE GAPS, stated plainly: with a linear penalty the optimal alignment of two sequences that
// differ by one indel is frequently NOT one gap. Splitting a gap costs the same per residue under a
// linear penalty, so the optimiser spends gap residues wherever they buy a match, and the result is a
// row of scattered single-base gaps. That is a worse biological hypothesis (one indel event, not six)
// and it looks wrong to anyone who has seen an alignment. Affine gaps charge for the EVENT (gapOpen)
// and then per residue (gapExtend), so one indel comes out as one gap. test-align.mjs asserts exactly
// this: the same pair of sequences, scored affine, yields 1 gap run; scored linear, 2.
//
// COST, honestly: both aligners are O(n*m) time and O(n*m) memory. Three score matrices (Float64) and
// three pointer matrices (Uint8) per alignment is 27 bytes per cell. That is comfortable up to roughly
// 2000 x 2000 (4e6 cells, ~110 MB). MAX_CELLS below is the hard stop; above it the aligner RETURNS A
// REFUSAL rather than allocating and hanging. There is no banded or linear-space (Hirschberg/WFA) path
// here -- if you need megabase sequence, this is the wrong module and it says so instead of trying.
//
// PART 2 -- CRISPR HDR knock-in cassette
//   CASSETTE_PARTS        frozen part vocabulary: role, typical length, and what breaks if omitted
//   layoutCassette(spec)  ordered parts, cumulative coordinates, total length, junction sequences
//   cutSite(spacer, pam)  SpCas9 blunt DSB, 3 bp 5' of the PAM
//   validateSpacer(s)     length, alphabet, GC band, poly-T run, 3'-GG
//   homologyArmAdvice(n)  arm length guidance, with its basis and its caveat
//
// NUMBERS AND WHERE THEY COME FROM. Three kinds appear below and they are labelled, never blended:
//   basis: 'mechanistic'   follows from how the enzyme or the polymerase works (SpCas9 cuts 3 bp 5' of
//                          the PAM; a run of 4+ T is a Pol III termination signal)
//   basis: 'definitional'  a sequence feature is what it is (SpCas9 protospacer is 20 nt; PAM is NGG)
//   basis: 'conventional'  a threshold design tools and protocols agree on, NOT a measured cliff. The
//                          convention is named. No efficiency percentage is asserted anywhere in this
//                          file, because this module has measured none.

// ===================================================================================================
// PART 1 -- alignment
// ===================================================================================================

// Hard stop for the O(n*m) DP. (n+1)*(m+1) cells; see the cost note above.
export const MAX_CELLS = 4_000_000;
const NEG = -Infinity;

// States of the three-matrix (Gotoh) recursion.
const S_M = 0; // last column aligned a residue to a residue
const S_X = 1; // last column was a gap in b  (consumed a residue of a)
const S_Y = 2; // last column was a gap in a  (consumed a residue of b)
const FRESH = 3; // local only: M was clamped to 0 here, so the traceback stops

export const DEFAULT_SCORING = Object.freeze({
  match: 1,
  mismatch: -1,
  // Penalties are POSITIVE magnitudes, subtracted. A gap run of length L costs
  //     gapOpen + (L - 1) * gapExtend
  // i.e. gapOpen is charged for the FIRST gap residue, not in addition to it. (This is the EMBOSS
  // needle/water convention. The other common convention charges gapOpen + L*gapExtend; the numbers in
  // a published alignment mean nothing without knowing which, so this module states it.)
  gapOpen: 2,
  gapExtend: 1,
  scoringMatrix: null,
});

const refuse = (rule, fields) => Object.freeze({ refused: true, rule, ...fields });

// Resolve the substitution score function once, so the inner loop does no branching on options.
function substitutionFn(opts) {
  const m = opts.scoringMatrix;
  if (!m) {
    const { match, mismatch } = opts;
    return (x, y) => (x === y ? match : mismatch);
  }
  const idx = m.index, rows = m.scores, fb = m.fallback;
  return (x, y) => {
    const i = idx[x], j = idx[y];
    if (i === undefined || j === undefined) {
      if (fb === undefined) throw new Error(`scoringMatrix has no entry for ${x}/${y} and no fallback`);
      return fb;
    }
    return rows[i][j];
  };
}

function normalise(a, b, opts) {
  const o = { ...DEFAULT_SCORING, ...(opts || {}) };
  if (typeof a !== 'string' || typeof b !== 'string') return { bad: refuse('input_type', { detail: 'a and b must be strings' }) };
  // Case is folded, for DNA and for protein alike: BLOSUM62 is indexed on upper case and 'a' vs 'A'
  // is never a biological mismatch. Lower case as a soft-masking convention is therefore LOST here --
  // if you are passing repeat-masked sequence, mask it with N before calling.
  const A = a.toUpperCase();
  const B = b.toUpperCase();
  if (!(o.gapOpen >= 0) || !(o.gapExtend >= 0)) {
    return { bad: refuse('gap_penalty_sign', { detail: 'gapOpen and gapExtend are positive magnitudes that get subtracted', gapOpen: o.gapOpen, gapExtend: o.gapExtend }) };
  }
  const cells = (A.length + 1) * (B.length + 1);
  if (cells > MAX_CELLS) {
    return {
      bad: refuse('size_limit', {
        detail: `O(n*m) dynamic programme: ${A.length} x ${B.length} needs ${cells} cells, over the ${MAX_CELLS} limit. Refusing instead of allocating ~${Math.round(cells * 27 / 1e6)} MB and appearing to hang. Use a banded or linear-space aligner for sequences this long.`,
        cells, limit: MAX_CELLS, lengths: [A.length, B.length],
      }),
    };
  }
  return { A, B, o, cells };
}

// --- Gotoh core ------------------------------------------------------------------------------------
// Three matrices, as the affine recursion requires:
//   M[i][j] best score for a[1..i] vs b[1..j] with a[i] aligned to b[j]
//   X[i][j] ... ending in a gap in b (a[i] against '-')
//   Y[i][j] ... ending in a gap in a ('-' against b[j])
//
//   M[i][j] = s(a_i,b_j) + max( M[i-1][j-1], X[i-1][j-1], Y[i-1][j-1] )
//   X[i][j] = max( M[i-1][j] - gapOpen, X[i-1][j] - gapExtend )
//   Y[i][j] = max( M[i][j-1] - gapOpen, Y[i][j-1] - gapExtend )
//
// X <-> Y transitions are NOT allowed, which is the classic three-state model. The consequence is
// stated rather than hidden: an alignment column pair of the form (a residue against a gap)
// immediately beside (a gap against a residue) is not representable. Collapsing such a pair into one
// substitution column is better whenever a mismatch costs less than two gap opens, which holds for
// every scoring scheme in this file and for every published DNA/protein scheme we know of. If you set
// a mismatch penalty worse than 2*gapOpen, this aligner is no longer guaranteed optimal; it is not a
// regime anyone scores in, but it is a real restriction and so it is stated here rather than hidden.
function gotoh(A, B, o, local) {
  const n = A.length, m = B.length, w = m + 1;
  const sub = substitutionFn(o);
  const go = o.gapOpen, ge = o.gapExtend;
  const size = (n + 1) * w;
  const M = new Float64Array(size), X = new Float64Array(size), Y = new Float64Array(size);
  const pM = new Uint8Array(size), pX = new Uint8Array(size), pY = new Uint8Array(size);
  M.fill(NEG); X.fill(NEG); Y.fill(NEG);

  if (local) {
    for (let i = 0; i <= n; i++) { M[i * w] = 0; pM[i * w] = FRESH; }
    for (let j = 0; j <= m; j++) { M[j] = 0; pM[j] = FRESH; }
  } else {
    M[0] = 0;
    for (let i = 1; i <= n; i++) { X[i * w] = -(go + (i - 1) * ge); pX[i * w] = i === 1 ? S_M : S_X; }
    for (let j = 1; j <= m; j++) { Y[j] = -(go + (j - 1) * ge); pY[j] = j === 1 ? S_M : S_Y; }
  }

  let bestScore = local ? 0 : NEG, bi = 0, bj = 0, bstate = S_M;
  for (let i = 1; i <= n; i++) {
    const ai = A[i - 1], row = i * w, prev = row - w;
    for (let j = 1; j <= m; j++) {
      const d = prev + j - 1;
      // M
      let from = S_M, best = M[d];
      if (X[d] > best) { best = X[d]; from = S_X; }
      if (Y[d] > best) { best = Y[d]; from = S_Y; }
      let mv = best === NEG ? NEG : best + sub(ai, B[j - 1]);
      if (local && !(mv > 0)) { mv = 0; from = FRESH; }
      M[row + j] = mv; pM[row + j] = from;
      // X: gap in b, consumes a
      const xOpen = M[prev + j] === NEG ? NEG : M[prev + j] - go;
      const xExt = X[prev + j] === NEG ? NEG : X[prev + j] - ge;
      if (xExt > xOpen) { X[row + j] = xExt; pX[row + j] = S_X; } else { X[row + j] = xOpen; pX[row + j] = S_M; }
      // Y: gap in a, consumes b
      const yOpen = M[row + j - 1] === NEG ? NEG : M[row + j - 1] - go;
      const yExt = Y[row + j - 1] === NEG ? NEG : Y[row + j - 1] - ge;
      if (yExt > yOpen) { Y[row + j] = yExt; pY[row + j] = S_Y; } else { Y[row + j] = yOpen; pY[row + j] = S_M; }

      if (local && M[row + j] > bestScore) { bestScore = M[row + j]; bi = i; bj = j; bstate = S_M; }
    }
  }

  if (!local) {
    const end = n * w + m;
    bestScore = M[end]; bstate = S_M; bi = n; bj = m;
    if (X[end] > bestScore) { bestScore = X[end]; bstate = S_X; }
    if (Y[end] > bestScore) { bestScore = Y[end]; bstate = S_Y; }
  }

  // --- traceback ---
  let i = bi, j = bj, st = bstate;
  const ra = [], rb = [], pa = [], pb = [];
  const push = (ca, cb, ia, ib) => { ra.push(ca); rb.push(cb); pa.push(ia); pb.push(ib); };
  for (;;) {
    if (local) {
      if (st === S_M && (i === 0 || j === 0 || pM[i * w + j] === FRESH)) break;
    } else if (i === 0 && j === 0) break;

    if (st === S_M) {
      if (i === 0) { st = S_Y; continue; }
      if (j === 0) { st = S_X; continue; }
      push(A[i - 1], B[j - 1], i, j);
      st = pM[i * w + j]; i--; j--;
    } else if (st === S_X) {
      push(A[i - 1], '-', i, null);
      st = pX[i * w + j]; i--;
    } else {
      push('-', B[j - 1], null, j);
      st = pY[i * w + j]; j--;
    }
  }
  ra.reverse(); rb.reverse(); pa.reverse(); pb.reverse();
  return { score: bestScore, rowA: ra.join(''), rowB: rb.join(''), posA: pa, posB: pb, endA: bi, endB: bj };
}

// Count contiguous gap RUNS (not gap residues) in a gapped row. One indel event is one run; this is
// the number the affine-vs-linear test asserts on.
const gapRuns = row => (row.match(/-+/g) || []).length;

function finish(algorithm, A, B, o, tb, local) {
  const classes = [];
  for (let k = 0; k < tb.rowA.length; k++) {
    const ca = tb.rowA[k], cb = tb.rowB[k];
    classes.push(ca === '-' || cb === '-' ? 'gap' : ca === cb ? 'match' : 'mismatch');
  }
  const firstA = tb.posA.find(p => p !== null) ?? null;
  const firstB = tb.posB.find(p => p !== null) ?? null;
  const lastA = [...tb.posA].reverse().find(p => p !== null) ?? null;
  const lastB = [...tb.posB].reverse().find(p => p !== null) ?? null;
  return Object.freeze({
    refused: false,
    algorithm,
    local,
    a: A, b: B,
    score: tb.score,
    rowA: tb.rowA, rowB: tb.rowB,
    posA: tb.posA, posB: tb.posB,   // 1-based position in each input per column, null where that row has a gap
    classes,
    span: { aStart: firstA, aEnd: lastA, bStart: firstB, bEnd: lastB },
    gapRunsA: gapRuns(tb.rowA),
    gapRunsB: gapRuns(tb.rowB),
    gapRuns: gapRuns(tb.rowA) + gapRuns(tb.rowB),
    gapColumns: classes.filter(c => c === 'gap').length,
    scoring: Object.freeze({
      match: o.match, mismatch: o.mismatch, gapOpen: o.gapOpen, gapExtend: o.gapExtend,
      gapCost: 'gapOpen + (L-1)*gapExtend',
      linear: o.gapOpen === o.gapExtend,   // the degenerate case: affine with open == extend IS linear
      scoringMatrix: o.scoringMatrix ? (o.scoringMatrix.name || 'custom') : null,
    }),
  });
}

/** Global alignment, affine gaps. Returns an aln object, or a refusal object (`refused: true`). */
export function needlemanWunsch(a, b, opts) {
  const nz = normalise(a, b, opts);
  if (nz.bad) return nz.bad;
  return finish('needleman-wunsch', nz.A, nz.B, nz.o, gotoh(nz.A, nz.B, nz.o, false), false);
}

/** Local alignment, affine gaps, same scoring options. Returns an aln object or a refusal object. */
export function smithWaterman(a, b, opts) {
  const nz = normalise(a, b, opts);
  if (nz.bad) return nz.bad;
  return finish('smith-waterman', nz.A, nz.B, nz.o, gotoh(nz.A, nz.B, nz.o, true), true);
}

// --- percent identity -----------------------------------------------------------------------------
/**
 * "% identity" names three different numbers. Which one a paper used is usually not stated, and the
 * three can differ by tens of points on the same alignment (see test-align.mjs, where one alignment
 * gives 80.0 / 66.7 / 50.0). This returns all three, named, with the denominator spelled out. It does
 * not pick one, because picking one silently is how the ambiguity does its damage.
 *
 * Accepts an aln from needlemanWunsch/smithWaterman, or a bare `{ rowA, rowB }` pair of gapped strings.
 */
export function percentIdentity(aln) {
  if (!aln || typeof aln.rowA !== 'string' || typeof aln.rowB !== 'string') {
    return refuse('input_type', { detail: 'percentIdentity needs an aln (or {rowA, rowB}) of equal-length gapped strings' });
  }
  const { rowA, rowB } = aln;
  if (rowA.length !== rowB.length) return refuse('ragged_rows', { detail: `rowA ${rowA.length} vs rowB ${rowB.length}`, lengths: [rowA.length, rowB.length] });
  let identities = 0, alignedColumns = 0, lenA = 0, lenB = 0;
  for (let k = 0; k < rowA.length; k++) {
    const ca = rowA[k], cb = rowB[k];
    if (ca !== '-') lenA++;
    if (cb !== '-') lenB++;
    if (ca !== '-' && cb !== '-') { alignedColumns++; if (ca === cb) identities++; }
  }
  const shorterLength = Math.min(lenA, lenB);
  const pct = (num, den) => (den > 0 ? (100 * num) / den : null);
  return Object.freeze({
    refused: false,
    identities,
    alignedColumns, shorterLength, alignmentLength: rowA.length,
    residuesA: lenA, residuesB: lenB,
    overAlignedColumns: pct(identities, alignedColumns),
    overShorter: pct(identities, shorterLength),
    overAlignmentLength: pct(identities, rowA.length),
    denominators: Object.freeze({
      overAlignedColumns: 'identities / columns where NEITHER row has a gap. Highest of the three. Ignores every indel, so a 30-residue match inside a 3 kb alignment reads as high identity.',
      overShorter: 'identities / length of the shorter input sequence. The usual choice when one sequence is a fragment of the other.',
      overAlignmentLength: 'identities / total alignment columns, terminal gaps included. Lowest of the three; penalises the length difference itself.',
    }),
  });
}

// --- renderer-facing block layout -----------------------------------------------------------------
/**
 * The data an alignment renderer needs, and nothing it does not: fixed-width blocks, a per-column
 * class, and the 1-based coordinate in BOTH inputs for EVERY column (null where that row is a gap) so
 * a UI can map a click straight back to a residue position in either sequence.
 */
export function alignmentBlocks(aln, width = 60) {
  if (!aln || typeof aln.rowA !== 'string' || typeof aln.rowB !== 'string') {
    return refuse('input_type', { detail: 'alignmentBlocks needs an aln from needlemanWunsch/smithWaterman' });
  }
  if (!Number.isInteger(width) || width < 1) return refuse('bad_width', { detail: 'width must be a positive integer', width });
  const { rowA, rowB } = aln;
  if (rowA.length !== rowB.length) return refuse('ragged_rows', { lengths: [rowA.length, rowB.length] });
  const posA = aln.posA || derivePositions(rowA);
  const posB = aln.posB || derivePositions(rowB);
  const cls = aln.classes || [...rowA].map((ca, k) => (ca === '-' || rowB[k] === '-' ? 'gap' : ca === rowB[k] ? 'match' : 'mismatch'));

  const blocks = [];
  for (let start = 0; start < rowA.length; start += width) {
    const end = Math.min(start + width, rowA.length);
    const columns = [];
    for (let k = start; k < end; k++) {
      columns.push({ col: k, charA: rowA[k], charB: rowB[k], cls: cls[k], posA: posA[k], posB: posB[k] });
    }
    const seen = key => columns.map(c => c[key]).filter(p => p !== null && p !== undefined);
    const sa = seen('posA'), sb = seen('posB');
    blocks.push(Object.freeze({
      index: blocks.length,
      firstCol: start, lastCol: end - 1,
      textA: rowA.slice(start, end),
      textB: rowB.slice(start, end),
      // The middle line of a classic alignment print: '|' identity, '.' substitution, ' ' gap.
      midline: columns.map(c => (c.cls === 'match' ? '|' : c.cls === 'mismatch' ? '.' : ' ')).join(''),
      rangeA: sa.length ? { from: sa[0], to: sa[sa.length - 1] } : null,
      rangeB: sb.length ? { from: sb[0], to: sb[sb.length - 1] } : null,
      columns: Object.freeze(columns),
    }));
  }
  return Object.freeze({ refused: false, width, totalColumns: rowA.length, blocks: Object.freeze(blocks) });
}

function derivePositions(row) {
  let p = 0;
  return [...row].map(c => (c === '-' ? null : ++p));
}

// --- BLOSUM62 --------------------------------------------------------------------------------------
// Transcribed in the NCBI column order. A transcription slip here is silent -- the aligner still runs
// and still returns a number -- so test-align.mjs checks the matrix is symmetric and spot-checks
// entries that are hard to get right by accident (W/W=11, C/C=9, L/I=2, F/Y=3, K/R=2, D/E=2, P/F=-4).
const B62_ALPHABET = 'ARNDCQEGHILKMFPSTWYVBZX*';
const B62_ROWS = [
  [4, -1, -2, -2, 0, -1, -1, 0, -2, -1, -1, -1, -1, -2, -1, 1, 0, -3, -2, 0, -2, -1, 0, -4], // A
  [-1, 5, 0, -2, -3, 1, 0, -2, 0, -3, -2, 2, -1, -3, -2, -1, -1, -3, -2, -3, -1, 0, -1, -4], // R
  [-2, 0, 6, 1, -3, 0, 0, 0, 1, -3, -3, 0, -2, -3, -2, 1, 0, -4, -2, -3, 3, 0, -1, -4], // N
  [-2, -2, 1, 6, -3, 0, 2, -1, -1, -3, -4, -1, -3, -3, -1, 0, -1, -4, -3, -3, 4, 1, -1, -4], // D
  [0, -3, -3, -3, 9, -3, -4, -3, -3, -1, -1, -3, -1, -2, -3, -1, -1, -2, -2, -1, -3, -3, -2, -4], // C
  [-1, 1, 0, 0, -3, 5, 2, -2, 0, -3, -2, 1, 0, -3, -1, 0, -1, -2, -1, -2, 0, 3, -1, -4], // Q
  [-1, 0, 0, 2, -4, 2, 5, -2, 0, -3, -3, 1, -2, -3, -1, 0, -1, -3, -2, -2, 1, 4, -1, -4], // E
  [0, -2, 0, -1, -3, -2, -2, 6, -2, -4, -4, -2, -3, -3, -2, 0, -2, -2, -3, -3, -1, -2, -1, -4], // G
  [-2, 0, 1, -1, -3, 0, 0, -2, 8, -3, -3, -1, -2, -1, -2, -1, -2, -2, 2, -3, 0, 0, -1, -4], // H
  [-1, -3, -3, -3, -1, -3, -3, -4, -3, 4, 2, -3, 1, 0, -3, -2, -1, -3, -1, 3, -3, -3, -1, -4], // I
  [-1, -2, -3, -4, -1, -2, -3, -4, -3, 2, 4, -2, 2, 0, -3, -2, -1, -2, -1, 1, -4, -3, -1, -4], // L
  [-1, 2, 0, -1, -3, 1, 1, -2, -1, -3, -2, 5, -1, -3, -1, 0, -1, -3, -2, -2, 0, 1, -1, -4], // K
  [-1, -1, -2, -3, -1, 0, -2, -3, -2, 1, 2, -1, 5, 0, -2, -1, -1, -1, -1, 1, -3, -1, -1, -4], // M
  [-2, -3, -3, -3, -2, -3, -3, -3, -1, 0, 0, -3, 0, 6, -4, -2, -2, 1, 3, -1, -3, -3, -1, -4], // F
  [-1, -2, -2, -1, -3, -1, -1, -2, -2, -3, -3, -1, -2, -4, 7, -1, -1, -4, -3, -2, -2, -1, -2, -4], // P
  [1, -1, 1, 0, -1, 0, 0, 0, -1, -2, -2, 0, -1, -2, -1, 4, 1, -3, -2, -2, 0, 0, 0, -4], // S
  [0, -1, 0, -1, -1, -1, -1, -2, -2, -1, -1, -1, -1, -2, -1, 1, 5, -2, -2, 0, -1, -1, 0, -4], // T
  [-3, -3, -4, -4, -2, -2, -3, -2, -2, -3, -2, -3, -1, 1, -4, -3, -2, 11, 2, -3, -4, -3, -2, -4], // W
  [-2, -2, -2, -3, -2, -1, -2, -3, 2, -1, -1, -2, -1, 3, -3, -2, -2, 2, 7, -1, -3, -2, -1, -4], // Y
  [0, -3, -3, -3, -1, -2, -2, -3, -3, 3, 1, -2, 1, -1, -2, -2, 0, -3, -1, 4, -3, -2, -1, -4], // V
  [-2, -1, 3, 4, -3, 0, 1, -1, 0, -3, -4, 0, -3, -3, -2, 0, -1, -4, -3, -3, 4, 1, -1, -4], // B
  [-1, 0, 0, 1, -3, 3, 4, -2, 0, -3, -3, 1, -1, -3, -1, 0, -1, -3, -2, -2, 1, 4, -1, -4], // Z
  [0, -1, -1, -1, -2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -2, 0, 0, -2, -1, -1, -1, -1, -1, -4], // X
  [-4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4, 1], // *
];

export const BLOSUM62 = Object.freeze({
  name: 'BLOSUM62',
  alphabet: B62_ALPHABET,
  index: Object.freeze(Object.fromEntries([...B62_ALPHABET].map((c, i) => [c, i]))),
  scores: Object.freeze(B62_ROWS.map(r => Object.freeze(r))),
  fallback: -4,             // anything outside the alphabet scores as the '*' row does
  basis: 'published substitution matrix (BLOSUM62, the NCBI BLAST protein default)',
  note: 'Entries are log-odds, scaled in half-bits. B, Z and X are the ambiguity codes; * is the stop/unmatched row.',
  get(x, y) {
    const i = this.index[x.toUpperCase()], j = this.index[y.toUpperCase()];
    return i === undefined || j === undefined ? this.fallback : this.scores[i][j];
  },
});

// ===================================================================================================
// PART 2 -- the CRISPR HDR knock-in cassette
// ===================================================================================================

// Enforced numbers, gathered in one place so the refusal messages and the docs cannot drift apart.
export const CASSETTE_LIMITS = Object.freeze({
  spacerLength: Object.freeze({
    value: 20, unit: 'nt', basis: 'definitional',
    source: 'SpCas9 protospacer length. A 20 nt spacer is what the sgRNA scaffold and the PAM geometry below are defined against.',
  }),
  pam: Object.freeze({
    value: 'NGG', length: 3, basis: 'definitional',
    source: 'SpCas9 PAM, immediately 3\' of the protospacer on the same strand. No PAM, no cut.',
  }),
  cutOffsetFromPam: Object.freeze({
    value: 3, unit: 'bp', basis: 'mechanistic',
    source: 'SpCas9 makes a BLUNT double-strand break 3 bp 5\' of the PAM, i.e. between protospacer positions 17 and 18 counting from the PAM-distal end of a 20 nt spacer.',
  }),
  minHomologyArm: Object.freeze({
    value: 300, unit: 'bp', basis: 'conventional',
    source: 'Floor for a double-stranded (plasmid or long dsDNA) donor. Convention: dsDNA knock-in protocols specify arms in the 500-1000 bp range and treat a few hundred bp as the point below which HDR stops being worth attempting; 300 bp is the permissive floor, not a target. Short single-stranded oligo (ssODN) donors are a DIFFERENT regime with 30-60 nt arms -- pass donorType: "ssODN" to be checked against that floor instead.',
  }),
  minHomologyArmSsodn: Object.freeze({
    value: 30, unit: 'nt', basis: 'conventional',
    source: 'Floor for an ssODN donor, where arms of 30-60 nt per side are the convention.',
  }),
  maxInsert: Object.freeze({
    value: 5000, unit: 'bp', basis: 'conventional',
    source: 'Practical ceiling for the sequence placed BETWEEN the homology arms with a dsDNA/plasmid donor. Convention, not a measured cliff: knock-in protocols are written for inserts of a few kb and switch to other strategies (integrase, recombinase landing pad, serial knock-in) beyond that. This module asserts NO efficiency number for any insert size.',
  }),
  polyTRun: Object.freeze({
    value: 4, unit: 'consecutive T', basis: 'mechanistic',
    source: 'A run of 4 or more T is an RNA polymerase III termination signal. In a U6-driven sgRNA the guide is truncated or not made at all. Commonly missed because the spacer still looks like a valid 20-mer.',
  }),
  gcBand: Object.freeze({
    min: 40, max: 80, unit: '%', basis: 'conventional',
    source: 'The GC window that common sgRNA design tools filter on. Convention, named as such: guides outside it are deprioritised, not known to fail. No efficiency figure attaches to it here.',
  }),
  sgrnaScaffold: Object.freeze({
    value: 76, unit: 'nt', basis: 'definitional',
    source: 'Length of the standard single-guide scaffold (the fused crRNA repeat / tracrRNA) appended 3\' of the spacer.',
  }),
});

const part = (id, name, role, min, max, unit, failure, basis, source) =>
  Object.freeze({ id, name, role, typicalLength: Object.freeze({ min, max, unit }), failure, basis, source });

/**
 * The parts of a homology-directed-repair knock-in cassette, plus the separate sgRNA expression unit.
 * Each entry says what the part DOES, the length range it usually has, and -- the part that actually
 * saves a build -- what goes wrong when it is left out or sized wrong.
 */
export const CASSETTE_PARTS = Object.freeze({
  // ---- donor: the HDR cassette itself, 5' to 3' ----
  homology_arm_5: part(
    'homology_arm_5', "5' homology arm",
    'Matches the genome immediately 5\' of the cut. The strand-invasion substrate: this is what makes the repair homology-directed rather than end-joining.',
    500, 1000, 'bp',
    'Omitted: there is no HDR at all -- the donor cannot be templated in, and the cut repairs by NHEJ/MMEJ into indels. Too short: HDR efficiency collapses and the surviving events are enriched for partial or one-sided integration, which genotyping with a single junction PCR will score as correct.',
    'conventional',
    'Arms of 500-1000 bp per side are the dsDNA-donor convention; see CASSETTE_LIMITS.minHomologyArm for the enforced floor and its caveats.'),
  promoter: part(
    'promoter', 'promoter',
    'Drives transcription of the inserted coding sequence when the insert is meant to be expressed independently of the host locus.',
    200, 2000, 'bp',
    'Omitted: nothing is transcribed -- unless the design is an in-frame fusion knock-in, where the HOST promoter drives the insert and adding one is the error (you get a second, unregulated transcript). Mis-sized: truncating a promoter usually removes the distal regulatory elements first, so expression survives in the cell line you test and fails in the tissue you care about.',
    'conventional',
    'Range spans a minimal core promoter to a full regulatory region; which end you need is a design decision, not a number this module can supply.'),
  cds: part(
    'cds', 'coding sequence',
    'The protein-coding insert. In a fusion knock-in this is the payload spliced in frame with the host coding sequence.',
    300, 4000, 'bp',
    'Mis-sized is the real hazard, not omission: an insert whose length is not a multiple of 3 at a fusion junction shifts the frame of everything downstream, and the construct still assembles, still sequences, and produces nothing. Check the junction frame, not just the total length.',
    'definitional',
    'Length is whatever the protein is; the multiple-of-3 constraint at a fusion junction is definitional.'),
  linker: part(
    'linker', 'linker',
    'Flexible peptide spacer between the coding sequence and a tag, so the two domains fold independently.',
    15, 90, 'bp',
    'Omitted: the tag is fused directly to the protein terminus and can occlude an active site, a targeting signal or a binding face -- the fusion expresses and localises wrongly, which reads as a biological result. Too short: same failure, partially.',
    'conventional',
    'Glycine-serine linkers of roughly 5-30 residues (15-90 nt) are the convention.'),
  tag: part(
    'tag', 'tag',
    'Epitope or fluorescent domain for detection, purification or imaging.',
    24, 750, 'bp',
    'Omitted: the knock-in is untrackable without an antibody to the native protein. Mis-sized: a tag cloned without its stop-codon context, or out of frame by one, silently produces an untagged or truncated product.',
    'definitional',
    'Short epitope tags are tens of nt; a fluorescent protein is ~700 nt. The number is the tag you chose.'),
  terminator: part(
    'terminator', 'polyA / terminator',
    'Ends transcription and adds the polyadenylation signal.',
    100, 800, 'bp',
    'Omitted: READ-THROUGH. Transcription runs past the cassette into the downstream genomic sequence, giving long chimeric transcripts, unstable (non-polyadenylated) mRNA, and interference with the next gene along. This is the classic omission because the cassette still looks complete without it.',
    'conventional',
    'Common polyA signals (SV40, bGH) sit in the 130-250 bp range; the wider band covers larger terminator regions.'),
  selection_marker: part(
    'selection_marker', 'selection marker',
    'Antibiotic-resistance or fluorescent selection cassette, with its own promoter and terminator, used to enrich edited cells.',
    800, 2000, 'bp',
    'Omitted: nothing is wrong mechanistically, but you must screen rather than select, so the edited fraction has to be found by genotyping. Included carelessly: the marker counts towards the insert size (see maxInsert) and, if not flanked by excisable sites, stays in the genome and can act on neighbouring transcription.',
    'conventional',
    'Size is the marker you chose plus its own promoter and terminator.'),
  homology_arm_3: part(
    'homology_arm_3', "3' homology arm",
    'Matches the genome immediately 3\' of the cut. The second strand-invasion substrate.',
    500, 1000, 'bp',
    'Same failure mode as the 5\' arm, and asymmetric arms are a specific trap: a long 5\' arm with a short 3\' arm gives one clean junction and one ragged one, so the usual 5\'-junction PCR calls the clone correct.',
    'conventional',
    'See CASSETTE_LIMITS.minHomologyArm.'),

  // ---- the separate sgRNA expression unit (NOT part of the donor) ----
  sgrna_promoter: part(
    'sgrna_promoter', 'sgRNA promoter (U6 or T7)',
    'Drives sgRNA transcription. U6 is an RNA polymerase III promoter for expression in cells; T7 is for in-vitro transcription of the guide before delivery as RNA.',
    17, 250, 'bp',
    'Omitted: no guide, so no cut, so the donor is simply a piece of DNA in the nucleus. Choosing wrong rather than omitting is the common error: a T7 unit delivered as plasmid DNA is not transcribed in the cell, and a U6 unit used for in-vitro transcription is not transcribed in the tube. U6 also constrains the spacer -- Pol III terminates on a run of 4+ T (CASSETTE_LIMITS.polyTRun) and prefers a G at +1.',
    'definitional',
    'Human U6 is ~241 bp; a T7 core promoter is ~17-20 bp.'),
  spacer: part(
    'spacer', 'spacer (guide sequence)',
    'The 20 nt that base-pairs with the protospacer and sets where the cut lands.',
    20, 20, 'nt',
    'Wrong length: shortening or lengthening the spacer changes the cut geometry the whole cassette is positioned against, so the insert integrates off-target by exactly that offset -- and the construct still looks correct. Wrong sequence features: see validateSpacer (poly-T run, GC band, 3\' GG).',
    'definitional',
    'SpCas9 protospacer length; see CASSETTE_LIMITS.spacerLength.'),
  sgrna_scaffold: part(
    'sgrna_scaffold', 'sgRNA scaffold',
    'The constant structural RNA 3\' of the spacer that Cas9 binds.',
    76, 82, 'nt',
    'Omitted: Cas9 has nothing to load -- the spacer alone is an inert 20-mer. Mutated or truncated in the stem-loops: loading fails or is weakened, and the usual symptom is "the guide does not work", chased in the spacer rather than in the scaffold.',
    'definitional',
    'See CASSETTE_LIMITS.sgrnaScaffold; extended-scaffold variants run a few nt longer.'),
});

export const DONOR_PART_ORDER = Object.freeze([
  'homology_arm_5', 'promoter', 'cds', 'linker', 'tag', 'terminator', 'selection_marker', 'homology_arm_3',
]);
export const SGRNA_PART_ORDER = Object.freeze(['sgrna_promoter', 'spacer', 'sgrna_scaffold']);

const DNA = /^[ACGT]+$/;
const gcPercent = s => (100 * ([...s].filter(c => c === 'G' || c === 'C').length)) / s.length;

/**
 * SpCas9 blunt cut position.
 *
 * `pamIndex` is the 0-based index, in whatever target-strand coordinate system you are using, of the
 * FIRST base of the PAM. The protospacer occupies [pamIndex - spacer.length, pamIndex - 1]. The blunt
 * double-strand break falls 3 bp 5' of the PAM: in the phosphodiester bond between index pamIndex - 4
 * and index pamIndex - 3, leaving exactly 3 bases between the break and the PAM.
 *
 * An off-by-one here is invisible downstream: the cassette coordinates are all measured from the cut,
 * so a cut placed one base over designs an insertion one base off and nothing complains.
 */
export function cutSite(spacer, pamIndex) {
  const L = CASSETTE_LIMITS.spacerLength, O = CASSETTE_LIMITS.cutOffsetFromPam;
  if (typeof spacer !== 'string' || spacer.length !== L.value) {
    return refuse('spacer_length', {
      number: L.value, unit: L.unit, basis: L.basis, source: L.source,
      detail: `cutSite is SpCas9 geometry and is defined for a ${L.value} nt spacer; got ${typeof spacer === 'string' ? spacer.length : typeof spacer}.`,
    });
  }
  if (!Number.isInteger(pamIndex) || pamIndex < spacer.length) {
    return refuse('pam_index_range', {
      number: spacer.length, unit: 'nt',
      detail: `pamIndex must be an integer >= the spacer length (${spacer.length}); the protospacer would otherwise run off the 5' end. Got ${pamIndex}.`,
    });
  }
  const right = pamIndex - O.value;      // 0-based index of the first base 3' of the break
  return Object.freeze({
    refused: false,
    nuclease: 'SpCas9',
    blunt: true,
    pamIndex,
    protospacer: Object.freeze({ start: pamIndex - spacer.length, end: pamIndex - 1, length: spacer.length }),
    // The break is a bond, so it has two neighbouring indices rather than one position.
    bluntCut: Object.freeze({ left: right - 1, right }),
    cutIndex: right,
    bpFromPam: O.value,
    // 1-based positions within the spacer, numbered from the PAM-DISTAL end, that the break falls between.
    betweenSpacerPositions: Object.freeze([spacer.length - 3, spacer.length - 2]),
    basesBetweenCutAndPam: spacer.slice(spacer.length - O.value),
    basis: O.basis,
    source: O.source,
  });
}

/** Spacer sanity checks. Returns a report; `ok` is false when any hard rule fails. */
export function validateSpacer(spacer) {
  const L = CASSETTE_LIMITS.spacerLength, T = CASSETTE_LIMITS.polyTRun, G = CASSETTE_LIMITS.gcBand;
  const problems = [], notes = [];
  if (typeof spacer !== 'string') {
    return Object.freeze({ ok: false, refused: true, rule: 'input_type', problems: Object.freeze([{ rule: 'input_type', detail: 'spacer must be a string' }]) });
  }
  const s = spacer.toUpperCase();
  if (s.length !== L.value) problems.push({ rule: 'length', number: L.value, unit: L.unit, basis: L.basis, source: L.source, detail: `spacer is ${s.length} nt, not ${L.value} nt` });
  if (!DNA.test(s)) problems.push({ rule: 'alphabet', number: null, basis: 'definitional', source: 'A spacer is unambiguous DNA; IUPAC ambiguity codes mean you have not chosen a guide yet.', detail: `spacer must be ACGT only, got "${spacer}"` });

  const polyT = s.match(/T{4,}/);
  if (polyT) {
    problems.push({
      rule: 'poly_t_run', number: T.value, unit: T.unit, basis: T.basis, source: T.source,
      detail: `run of ${polyT[0].length} T at position ${polyT.index + 1}: RNA polymerase III terminates here, so a U6-driven guide with this spacer is truncated or absent. Hard reject.`,
    });
  }

  const gc = DNA.test(s) && s.length ? gcPercent(s) : null;
  if (gc !== null && (gc < G.min || gc > G.max)) {
    notes.push({ rule: 'gc_band', number: [G.min, G.max], unit: G.unit, basis: G.basis, source: G.source, detail: `GC is ${gc.toFixed(1)}%, outside the conventional ${G.min}-${G.max}% window. Deprioritise, do not reject: this is a convention, and no efficiency figure is claimed for it.` });
  }
  const endsInGG = s.endsWith('GG');
  if (!endsInGG) notes.push({ rule: 'three_prime_gg', number: null, basis: 'conventional', source: 'A G at the two PAM-proximal spacer positions is a preference used by common design tools, not a requirement.', detail: 'spacer does not end in GG' });

  return Object.freeze({
    ok: problems.length === 0,
    refused: problems.length > 0,
    rule: problems.length ? problems[0].rule : null,
    spacer: s,
    length: s.length,
    gcPercent: gc,
    gcBand: G,
    polyTRun: polyT ? Object.freeze({ length: polyT[0].length, at: polyT.index + 1 }) : null,
    endsInGG,
    problems: Object.freeze(problems),   // hard rules: a guide failing one of these will not work
    notes: Object.freeze(notes),         // conventions: deprioritise, do not reject
  });
}

/**
 * Homology arm length guidance for a given insert length, with its basis and its caveat.
 * Returns a band, not a number, and labels it `conventional` because that is what it is.
 */
export function homologyArmAdvice(insertLength) {
  if (!Number.isFinite(insertLength) || insertLength < 0) {
    return refuse('input_type', { detail: 'insertLength must be a non-negative number of bp' });
  }
  const regimes = [
    { upTo: 50, donorType: 'ssODN', arm: [30, 60], unit: 'nt',
      note: 'Point edits and short epitope tags. A single-stranded oligo donor with short arms is the convention in this regime; long dsDNA arms are not needed and the oligo route avoids plasmid cloning.' },
    { upTo: 1000, donorType: 'dsDNA', arm: [300, 800], unit: 'bp',
      note: 'Short inserts (a fluorescent protein, a small marker). Arms in the few-hundred-bp range are conventional; going longer is not harmful, just more cloning.' },
    { upTo: Infinity, donorType: 'plasmid', arm: [500, 1000], unit: 'bp',
      note: 'Multi-kb inserts. 500-1000 bp per arm is the standard plasmid-donor specification; approaching CASSETTE_LIMITS.maxInsert, arm length stops being the limiting factor.' },
  ];
  const r = regimes.find(x => insertLength <= x.upTo);
  return Object.freeze({
    refused: false,
    insertLength,
    donorType: r.donorType,
    armLength: Object.freeze({ min: r.arm[0], max: r.arm[1], unit: r.unit }),
    symmetric: true,
    basis: 'conventional',
    source: `Standard knock-in protocol specifications for a ${r.donorType} donor. ${r.note}`,
    caveat: 'ORGANISM- AND METHOD-DEPENDENT. HDR rates and the arm length that is "enough" vary with species, cell type, cell-cycle state, delivery (RNP vs plasmid vs virus), donor form (ssODN vs dsDNA vs AAV), locus chromatin, and whether NHEJ is suppressed. These bands are what protocols specify, not a measured optimum, and no efficiency number is asserted for any of them. Treat them as a starting point to be titrated in your system.',
    enforcedFloor: r.donorType === 'ssODN' ? CASSETTE_LIMITS.minHomologyArmSsodn : CASSETTE_LIMITS.minHomologyArm,
  });
}

const partLength = p => (typeof p.sequence === 'string' ? p.sequence.length : (Number.isFinite(p.length) ? p.length : null));

/**
 * Lay out an HDR knock-in cassette: ordered parts with cumulative coordinates, total length, and the
 * junction sequences a renderer (or a primer designer) needs.
 *
 * spec = {
 *   locus:  { name, sequence, pamIndex },   // target-strand sequence containing protospacer + PAM
 *   spacer: '20 nt',
 *   parts:  [{ id, sequence } | { id, length }],   // donor parts, any subset of DONOR_PART_ORDER
 *   donorType?: 'dsDNA' | 'plasmid' | 'ssODN',
 *   limits?: { minHomologyArm, maxInsert }   // explicit overrides; the defaults are stated numbers
 * }
 *
 * Returns the layout, or `{ refused: true, violations: [...] }`. Every violation carries the NUMBER it
 * enforces, its `basis`, and the `source` of that number.
 */
export function layoutCassette(spec) {
  if (!spec || typeof spec !== 'object') return refuse('input_type', { detail: 'layoutCassette needs a spec object' });
  const violations = [];
  const L = CASSETTE_LIMITS;
  const donorType = spec.donorType || 'dsDNA';
  const armFloor = donorType === 'ssODN' ? L.minHomologyArmSsodn : L.minHomologyArm;
  const minArm = Number.isFinite(spec.limits?.minHomologyArm) ? spec.limits.minHomologyArm : armFloor.value;
  const maxInsert = Number.isFinite(spec.limits?.maxInsert) ? spec.limits.maxInsert : L.maxInsert.value;

  // --- rule 1: spacer must be exactly 20 nt (and must otherwise be a usable guide) ---
  const sv = validateSpacer(spec.spacer);
  for (const p of sv.problems) violations.push({ rule: `spacer_${p.rule}`, number: p.number, unit: p.unit, basis: p.basis, source: p.source, detail: p.detail, where: 'spec.spacer' });

  // --- rule 2: a PAM must sit immediately 3' of the protospacer, at the cut site ---
  const locus = spec.locus || {};
  const lseq = typeof locus.sequence === 'string' ? locus.sequence.toUpperCase() : null;
  const pamIndex = locus.pamIndex;
  let cut = null;
  if (!lseq || !Number.isInteger(pamIndex)) {
    violations.push({
      rule: 'pam_missing', number: L.pam.length, unit: 'bp', basis: L.pam.basis, source: L.pam.source,
      detail: 'locus.sequence (target strand) and locus.pamIndex (0-based index of the first PAM base) are both required: without them there is no cut site to place the cassette against.',
      where: 'spec.locus',
    });
  } else {
    const pam = lseq.slice(pamIndex, pamIndex + L.pam.length);
    if (pam.length !== L.pam.length || !/^[ACGT]GG$/.test(pam)) {
      violations.push({
        rule: 'pam_missing', number: L.pam.value, unit: 'motif', basis: L.pam.basis, source: L.pam.source,
        detail: `expected the ${L.pam.value} PAM at locus.sequence[${pamIndex}..${pamIndex + 2}], found "${pam || '(past the end)'}". SpCas9 does not cut without it, so the cut site this cassette is positioned against does not exist.`,
        where: `spec.locus.sequence[${pamIndex}]`,
      });
    }
    if (sv.length === L.spacerLength.value) {
      const observed = lseq.slice(pamIndex - sv.length, pamIndex);
      if (observed !== sv.spacer) {
        violations.push({
          rule: 'spacer_not_at_pam', number: sv.length, unit: 'nt', basis: 'definitional',
          source: 'The protospacer is the 20 nt immediately 5\' of the PAM on the target strand. If the spacer is not there, the guide does not cut where this layout assumes.',
          detail: `locus.sequence[${pamIndex - sv.length}..${pamIndex - 1}] is "${observed}", not the given spacer "${sv.spacer}".`,
          where: 'spec.locus.sequence',
        });
      }
      const c = cutSite(sv.spacer, pamIndex);
      if (!c.refused) cut = c;
    }
  }

  // --- parts: order, lengths, cumulative coordinates ---
  const given = Array.isArray(spec.parts) ? spec.parts : [];
  for (const p of given) {
    if (!p || !CASSETTE_PARTS[p.id]) {
      violations.push({ rule: 'unknown_part', number: null, basis: 'definitional', source: 'CASSETTE_PARTS is the frozen vocabulary; an id outside it is a typo or a part this module does not model.', detail: `unknown part id ${JSON.stringify(p?.id)}`, where: 'spec.parts' });
    } else if (!DONOR_PART_ORDER.includes(p.id)) {
      violations.push({ rule: 'part_not_in_donor', number: null, basis: 'definitional', source: 'The sgRNA expression unit is a SEPARATE construct from the donor; see SGRNA_PART_ORDER. Putting the spacer or the scaffold inside the donor cassette is a real and recoverable design error, so it is refused rather than laid out.', detail: `part ${p.id} belongs to the sgRNA unit, not the donor`, where: 'spec.parts' });
    } else if (partLength(p) === null) {
      violations.push({ rule: 'part_length_unknown', number: null, basis: 'definitional', source: 'A coordinate layout needs a length for every part.', detail: `part ${p.id} has neither a sequence nor a length`, where: 'spec.parts' });
    }
  }
  const usable = given.filter(p => p && CASSETTE_PARTS[p.id] && DONOR_PART_ORDER.includes(p.id) && partLength(p) !== null);
  const ordered = [...usable].sort((x, y) => DONOR_PART_ORDER.indexOf(x.id) - DONOR_PART_ORDER.indexOf(y.id));
  const reordered = ordered.map(p => p.id).join(',') !== usable.map(p => p.id).join(',');

  // --- rule 3: homology arms present and at or above the stated floor ---
  for (const armId of ['homology_arm_5', 'homology_arm_3']) {
    const p = ordered.find(q => q.id === armId);
    if (!p) {
      violations.push({
        rule: 'homology_arm_missing', number: minArm, unit: armFloor.unit, basis: armFloor.basis, source: armFloor.source,
        detail: `${CASSETTE_PARTS[armId].name} is absent. ${CASSETTE_PARTS[armId].failure}`,
        where: armId,
      });
      continue;
    }
    const len = partLength(p);
    if (len < minArm) {
      violations.push({
        rule: 'homology_arm_too_short', number: minArm, unit: armFloor.unit, basis: armFloor.basis, source: armFloor.source,
        detail: `${CASSETTE_PARTS[armId].name} is ${len} ${armFloor.unit}, below the enforced floor of ${minArm} ${armFloor.unit} for a ${donorType} donor. ${CASSETTE_PARTS[armId].failure}`,
        where: armId, observed: len,
      });
    }
  }

  // --- rule 4: insert (everything between the arms) within the stated practical HDR ceiling ---
  const insertParts = ordered.filter(p => p.id !== 'homology_arm_5' && p.id !== 'homology_arm_3');
  const insertLength = insertParts.reduce((s, p) => s + partLength(p), 0);
  if (insertLength > maxInsert) {
    violations.push({
      rule: 'insert_too_large', number: maxInsert, unit: L.maxInsert.unit, basis: L.maxInsert.basis, source: L.maxInsert.source,
      detail: `the sequence between the homology arms totals ${insertLength} ${L.maxInsert.unit}, over the ${maxInsert} ${L.maxInsert.unit} practical ceiling. This is a conventional limit, not a measured one; above it, use a different integration strategy rather than a larger HDR donor.`,
      where: 'insert', observed: insertLength,
    });
  }

  if (violations.length) {
    return Object.freeze({
      refused: true,
      rule: violations[0].rule,
      number: violations[0].number,
      violations: Object.freeze(violations),
      summary: violations.map(v => `${v.rule}: ${v.detail}`).join(' | '),
    });
  }

  // --- layout ---
  let at = 0;
  const laid = ordered.map(p => {
    const len = partLength(p);
    const row = Object.freeze({
      id: p.id,
      name: CASSETTE_PARTS[p.id].name,
      role: CASSETTE_PARTS[p.id].role,
      start: at,                // 0-based, inclusive, in cassette coordinates
      end: at + len - 1,        // inclusive
      length: len,
      sequence: typeof p.sequence === 'string' ? p.sequence.toUpperCase() : null,
      inInsert: p.id !== 'homology_arm_5' && p.id !== 'homology_arm_3',
    });
    at += len;
    return row;
  });
  const totalLength = at;

  // Junctions: the boundary between consecutive parts, with the flanking sequence when we have it.
  // These are what you design verification primers against and where a frame slip shows up.
  const flank = Number.isFinite(spec.junctionFlank) ? spec.junctionFlank : 12;
  const junctions = [];
  for (let k = 0; k + 1 < laid.length; k++) {
    const left = laid[k], right = laid[k + 1];
    const ls = left.sequence ? left.sequence.slice(Math.max(0, left.length - flank)) : null;
    const rs = right.sequence ? right.sequence.slice(0, flank) : null;
    junctions.push(Object.freeze({
      index: junctions.length,
      between: Object.freeze([left.id, right.id]),
      at: right.start,
      left: ls, right: rs,
      sequence: ls !== null && rs !== null ? ls + rs : null,
      sequenceKnown: ls !== null && rs !== null,
      flank,
    }));
  }

  const insertSpan = insertParts.length
    ? Object.freeze({ start: laid.find(p => p.inInsert).start, end: [...laid].reverse().find(p => p.inInsert).end })
    : null;

  return Object.freeze({
    refused: false,
    locus: Object.freeze({ name: locus.name ?? null, pamIndex, strand: locus.strand ?? '+' }),
    spacer: sv.spacer,
    spacerNotes: sv.notes,            // conventions the spacer misses; not refusals
    cut,
    donorType,
    parts: Object.freeze(laid),
    reordered,                        // true when the spec listed parts out of DONOR_PART_ORDER and we sorted them
    totalLength,
    insertLength,
    insertSpan,
    arms: Object.freeze({
      five: laid.find(p => p.id === 'homology_arm_5').length,
      three: laid.find(p => p.id === 'homology_arm_3').length,
      asymmetric: laid.find(p => p.id === 'homology_arm_5').length !== laid.find(p => p.id === 'homology_arm_3').length,
    }),
    junctions: Object.freeze(junctions),
    advice: homologyArmAdvice(insertLength),
    enforced: Object.freeze([
      { rule: 'spacer_length', number: L.spacerLength.value, unit: L.spacerLength.unit, basis: L.spacerLength.basis, source: L.spacerLength.source },
      { rule: 'pam_missing', number: L.pam.value, basis: L.pam.basis, source: L.pam.source },
      { rule: 'homology_arm_too_short', number: minArm, unit: armFloor.unit, basis: armFloor.basis, source: armFloor.source },
      { rule: 'insert_too_large', number: maxInsert, unit: L.maxInsert.unit, basis: L.maxInsert.basis, source: L.maxInsert.source },
      { rule: 'poly_t_run', number: L.polyTRun.value, unit: L.polyTRun.unit, basis: L.polyTRun.basis, source: L.polyTRun.source },
    ]),
  });
}

// What this module does NOT know, kept next to what it does so a dashboard cannot imply otherwise.
export const WHAT_THIS_DOES_NOT_PREDICT = Object.freeze([
  'HDR efficiency. No number here predicts it. Every threshold is labelled definitional, mechanistic or conventional, and the conventional ones are design-tool filters, not measured cliffs.',
  'On-target cutting activity of a given spacer. validateSpacer rejects guides that cannot work (wrong length, poly-T) and flags conventions; it does not score activity.',
  'Off-target sites. Nothing here searches the genome. A spacer that passes validateSpacer may still cut elsewhere.',
  'Whether the insert is in frame at a fusion junction. layoutCassette reports junction coordinates and sequences; it does not translate.',
  'Alignment statistics. needlemanWunsch/smithWaterman return a score, not an E-value; a local alignment score has no significance attached here.',
]);
