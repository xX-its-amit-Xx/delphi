#!/usr/bin/env node
// Compares ESMFold predictions of orthologous proteins: sequence identity from a global alignment and the CA-atom
// RMSD after optimal superposition (Kabsch) on aligned positions. Pure Node, no dependencies.
//   node organism-design/esmfold/compare.mjs --runs P62894-esmatlas,P81459-esmatlas,P00044-esmatlas --out runs/compare-cytochrome-c.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const runs = arg('runs', '').split(',').filter(Boolean);
if (runs.length < 2) { console.error('need --runs a,b[,c]'); process.exit(2); }
const OUT = arg('out', path.join(here, 'runs', 'compare.json'));

const load = r => {
  const dir = path.join(here, 'runs', r);
  const res = JSON.parse(fs.readFileSync(path.join(dir, 'result.json'), 'utf8'));
  if (res.run.status !== 'ok') throw new Error(r + ' has no prediction');
  const pdb = fs.readFileSync(path.join(dir, 'predicted.pdb'), 'utf8');
  const rec = JSON.parse(fs.readFileSync(path.join(here, '../..', res.input.record_file), 'utf8'));
  const [a, b] = res.input.residue_range.split('-').map(Number);
  const seq = rec.sequence.value.slice(a - 1, b);
  const ca = pdb.split('\n').filter(l => l.startsWith('ATOM') && l.slice(12, 16).trim() === 'CA').map(l => [+l.slice(30, 38), +l.slice(38, 46), +l.slice(46, 54)]);
  if (ca.length !== seq.length) throw new Error(`${r}: ${ca.length} CA atoms for ${seq.length} residues`);
  return { run: r, accession: res.input.uniprot_accession, organism: res.input.organism, taxid: res.input.organism_ncbi_taxid, protein: res.input.protein, seq, ca, plddt_mean: res.output.plddt_mean, pdb_sha256: res.output.pdb_sha256 };
};
const P = runs.map(load);

// Needleman-Wunsch, identity scoring (match 1, mismatch -1, gap -2): enough for close orthologs.
function align(a, b) {
  const n = a.length, m = b.length, G = -2;
  const S = Array.from({ length: n + 1 }, () => new Float64Array(m + 1)), T = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1));
  for (let i = 1; i <= n; i++) { S[i][0] = i * G; T[i][0] = 1; }
  for (let j = 1; j <= m; j++) { S[0][j] = j * G; T[0][j] = 2; }
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const d = S[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 1 : -1), u = S[i - 1][j] + G, l = S[i][j - 1] + G;
    if (d >= u && d >= l) { S[i][j] = d; T[i][j] = 0; } else if (u >= l) { S[i][j] = u; T[i][j] = 1; } else { S[i][j] = l; T[i][j] = 2; }
  }
  const pairs = []; let i = n, j = m;
  while (i > 0 || j > 0) { const t = i === 0 ? 2 : j === 0 ? 1 : T[i][j]; if (t === 0) { pairs.push([i - 1, j - 1]); i--; j--; } else if (t === 1) i--; else j--; }
  return pairs.reverse();
}
// Kabsch superposition of two equal-length point sets; returns RMSD.
function kabsch(X, Y) {
  const n = X.length, cx = [0, 0, 0], cy = [0, 0, 0];
  for (let k = 0; k < n; k++) for (let d = 0; d < 3; d++) { cx[d] += X[k][d] / n; cy[d] += Y[k][d] / n; }
  const A = X.map(p => p.map((v, d) => v - cx[d])), B = Y.map(p => p.map((v, d) => v - cy[d]));
  const H = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let k = 0; k < n; k++) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) H[i][j] += A[k][i] * B[k][j];
  // SVD of 3x3 via Jacobi eigen-decomposition of H^T H.
  const HtH = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) HtH[i][j] += H[k][i] * H[k][j];
  const { values, vectors: V } = jacobi(HtH);
  const U = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let c = 0; c < 3; c++) { const s = Math.sqrt(Math.max(values[c], 1e-12)); for (let r = 0; r < 3; r++) { let v = 0; for (let k = 0; k < 3; k++) v += H[r][k] * V[k][c]; U[r][c] = v / s; } }
  // H = U S V^T (columns of V are eigenvectors of H^T H, U = H V S^-1). The rotation taking A onto B is R = V U^T;
  // if it is a reflection, flip the singular vector of the smallest singular value.
  const order = [0, 1, 2].sort((i, j) => values[i] - values[j]);
  let R = mul(V, transpose(U));
  if (det(R) < 0) { const c = order[0]; for (let r = 0; r < 3; r++) U[r][c] = -U[r][c]; R = mul(V, transpose(U)); }
  let ss = 0;
  for (let k = 0; k < n; k++) { const p = [0, 0, 0]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) p[i] += R[i][j] * A[k][j]; for (let d = 0; d < 3; d++) ss += (p[d] - B[k][d]) ** 2; }
  return Math.sqrt(ss / n);
}
const transpose = M => M[0].map((_, j) => M.map(r => r[j]));
const mul = (A, B) => A.map(r => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0)));
const det = M => M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
function jacobi(S) {
  const A = S.map(r => r.slice()), V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 50; sweep++) {
    let off = 0; for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) off += A[i][j] ** 2;
    if (off < 1e-18) break;
    for (let p = 0; p < 3; p++) for (let q = p + 1; q < 3; q++) {
      if (Math.abs(A[p][q]) < 1e-15) continue;
      const th = (A[q][q] - A[p][p]) / (2 * A[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 3; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; }
      for (let k = 0; k < 3; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk; }
      for (let k = 0; k < 3; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
    }
  }
  return { values: [A[0][0], A[1][1], A[2][2]], vectors: V };
}

const pairs = [];
for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
  const a = P[i], b = P[j], al = align(a.seq, b.seq);
  const identical = al.filter(([x, y]) => a.seq[x] === b.seq[y]).length;
  const rmsd = kabsch(al.map(([x]) => a.ca[x]), al.map(([, y]) => b.ca[y]));
  pairs.push({ a: a.accession, b: b.accession, organisms: [a.organism, b.organism], aligned_positions: al.length, identical_positions: identical, substitutions: al.length - identical, identity: +(identical / al.length).toFixed(3), gaps: Math.max(a.seq.length, b.seq.length) - al.length, ca_rmsd_angstrom: +rmsd.toFixed(2) });
}
const out = { tool: 'organism-design/esmfold/compare.mjs', built: new Date().toISOString(), method: { alignment: 'Needleman-Wunsch global alignment, match +1, mismatch -1, gap -2', superposition: 'Kabsch on CA atoms of aligned positions; RMSD in angstrom', note: 'Both proteins are predictions, so RMSD measures how similar the model thinks the folds are, not experimental truth.' }, proteins: P.map(p => ({ run: p.run, accession: p.accession, protein: p.protein, organism: p.organism, taxid: p.taxid, length: p.seq.length, plddt_mean: p.plddt_mean, pdb_sha256: p.pdb_sha256 })), pairs };
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
for (const p of pairs) console.log(`${p.a} vs ${p.b}: ${p.substitutions} substitutions in ${p.aligned_positions} aligned positions (identity ${(100 * p.identity).toFixed(1)}%), CA RMSD ${p.ca_rmsd_angstrom} A`);
