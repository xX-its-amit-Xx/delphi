#!/usr/bin/env node
// Read the DESIGN side of each residue-level requirement: what does the zebrafish reference protein carry at the
// site the analogue has a derived residue at?
//
// Without this the ledger could only say "the design does not edit this locus", which leaves open the possibility
// that zebrafish already carries the analogue's state ancestrally - in which case the requirement is SAME and
// there is no difference to resolve at all. Sheet G is defined as substitutions absent from the beloniform
// OUTGROUPS, and zebrafish is not in that panel, so this has to be checked, not assumed.
//
// Method: pairwise global alignment (Needleman-Wunsch, BLOSUM62, affine gaps 11/1 - the BLAST defaults) of the
// Daane source protein (medaka / platyfish / Poecilia, from the sequences thread's cache) against the Ensembl
// Compara Danio rerio orthologue protein, then read the Danio residue in the column that carries the source site.
// An alignment column where the design side is a gap is reported as a GAP, never as a match.
//
// Writes functional/data/design-residues.json. Network: Ensembl REST /sequence/id (protein), cached per protein.
import fs from 'node:fs';
import path from 'node:path';

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const CACHE = process.env.FUNCTIONAL_CACHE_DIR || 'C:/Temp/functional-cache';
const SEQ_CACHE = process.env.SEQUENCES_CACHE_DIR || 'C:/Temp/sequences';
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const UA = { 'User-Agent': 'delphisci-validate-functional/0.1 (research; no credentials)', Accept: 'application/json' };

const REQ = read(path.join(HERE, '..', 'data', 'analogue-requirements.json'));
const SRC = read(path.join(SEQ_CACHE, 'sheetG_proteins.json')).genes;

fs.mkdirSync(path.join(CACHE, 'protein'), { recursive: true });
async function protein(id) {
  const f = path.join(CACHE, 'protein', `${id}.json`);
  if (fs.existsSync(f)) return read(f);
  const r = await fetch(`https://rest.ensembl.org/sequence/id/${id}?type=protein`, { headers: UA });
  const v = r.ok ? await r.json() : { error: `HTTP ${r.status}` };
  fs.writeFileSync(f, JSON.stringify(v));
  await new Promise(s => setTimeout(s, 150));            // polite: well under the 15 req/s Ensembl limit
  return v;
}

// ---- BLOSUM62 (NCBI matrix, 20 standard residues; anything else scores as the minimum)
const AA = 'ARNDCQEGHILKMFPSTWYV';
const B62 = `4 -1 -2 -2 0 -1 -1 0 -2 -1 -1 -1 -1 -2 -1 1 0 -3 -2 0
-1 5 0 -2 -3 1 0 -2 0 -3 -2 2 -1 -3 -2 -1 -1 -3 -2 -3
-2 0 6 1 -3 0 0 0 1 -3 -3 0 -2 -3 -2 1 0 -4 -2 -3
-2 -2 1 6 -3 0 2 -1 -1 -3 -4 -1 -3 -3 -1 0 -1 -4 -3 -3
0 -3 -3 -3 9 -3 -4 -3 -3 -1 -1 -3 -1 -2 -3 -1 -1 -2 -2 -1
-1 1 0 0 -3 5 2 -2 0 -3 -2 1 0 -3 -1 0 -1 -2 -1 -2
-1 0 0 2 -4 2 5 -2 0 -3 -3 1 -2 -3 -1 0 -1 -3 -2 -2
0 -2 0 -1 -3 -2 -2 6 -2 -4 -4 -2 -3 -3 -2 0 -2 -2 -3 -3
-2 0 1 -1 -3 0 0 -2 8 -3 -3 -1 -2 -1 -2 -1 -2 -2 2 -3
-1 -3 -3 -3 -1 -3 -3 -4 -3 4 2 -3 1 0 -3 -2 -1 -3 -1 3
-1 -2 -3 -4 -1 -2 -3 -4 -3 2 4 -2 2 0 -3 -2 -1 -2 -1 1
-1 2 0 -1 -3 1 1 -2 -1 -3 -2 5 -1 -3 -1 0 -1 -3 -2 -2
-1 -1 -2 -3 -1 0 -2 -3 -2 1 2 -1 5 0 -2 -1 -1 -1 -1 1
-2 -3 -3 -3 -2 -3 -3 -3 -1 0 0 -3 0 6 -4 -2 -2 1 3 -1
-1 -2 -2 -1 -3 -1 -1 -2 -2 -3 -3 -1 -2 -4 7 -1 -1 -4 -3 -2
1 -1 1 0 -1 0 0 0 -1 -2 -2 0 -1 -2 -1 4 1 -3 -2 -2
0 -1 0 -1 -1 -1 -1 -2 -2 -1 -1 -1 -1 -2 -1 1 5 -2 -2 0
-3 -3 -4 -4 -2 -2 -3 -2 -2 -3 -2 -3 -1 1 -4 -3 -2 11 2 -3
-2 -2 -2 -3 -2 -1 -2 -3 2 -1 -1 -2 -1 3 -3 -2 -2 2 7 -1
0 -3 -3 -3 -1 -2 -2 -3 -3 3 1 -2 1 -1 -2 -2 0 -3 -1 4`.split('\n').map(l => l.trim().split(/\s+/).map(Number));
const IDX = Object.fromEntries([...AA].map((c, i) => [c, i]));
const sc = (a, b) => { const i = IDX[a], j = IDX[b]; return i == null || j == null ? -4 : B62[i][j]; };

/** Global alignment with affine gaps (Gotoh). Returns the index in b that aligns to each index in a (-1 = gap). */
export function align(a, b, { open = 11, ext = 1 } = {}) {
  const n = a.length, m = b.length, NEG = -1e9;
  // Row-wise DP with traceback pointers packed into a byte per cell per state.
  const M = new Float64Array(m + 1), Ix = new Float64Array(m + 1), Iy = new Float64Array(m + 1);
  const tb = new Uint8Array((n + 1) * (m + 1));          // bits 0-1 M from, 2-3 Ix from, 4-5 Iy from
  M[0] = 0; Ix[0] = NEG; Iy[0] = NEG;
  for (let j = 1; j <= m; j++) { M[j] = NEG; Ix[j] = NEG; Iy[j] = -open - (j - 1) * ext; tb[j] |= 1 << 4; }
  for (let i = 1; i <= n; i++) {
    let pM = M[0], pIx = Ix[0], pIy = Iy[0];
    M[0] = NEG; Ix[0] = -open - (i - 1) * ext; Iy[0] = NEG; tb[i * (m + 1)] |= 1 << 2;
    for (let j = 1; j <= m; j++) {
      const s = sc(a[i - 1], b[j - 1]);
      const cand = [pM + s, pIx + s, pIy + s];
      let best = 0; for (let k = 1; k < 3; k++) if (cand[k] > cand[best]) best = k;
      const nM = cand[best];
      const ix = [M[j] - open, Ix[j] - ext, Iy[j] - open];        // gap in b (consume a)
      let bx = 0; for (let k = 1; k < 3; k++) if (ix[k] > ix[bx]) bx = k;
      const iy = [M[j - 1] - open, Ix[j - 1] - open, Iy[j - 1] - ext]; // gap in a (consume b)
      let by = 0; for (let k = 1; k < 3; k++) if (iy[k] > iy[by]) by = k;
      pM = M[j]; pIx = Ix[j]; pIy = Iy[j];
      M[j] = nM; Ix[j] = ix[bx]; Iy[j] = iy[by];
      tb[i * (m + 1) + j] = best | (bx << 2) | (by << 4);
    }
  }
  let i = n, j = m;
  let state = 0, bestv = M[m]; if (Ix[m] > bestv) { state = 1; bestv = Ix[m]; } if (Iy[m] > bestv) { state = 2; bestv = Iy[m]; }
  const mapAtoB = new Int32Array(n).fill(-1);
  while (i > 0 || j > 0) {
    const t = tb[i * (m + 1) + j];
    if (state === 0) { mapAtoB[i - 1] = j - 1; state = t & 3; i--; j--; }
    else if (state === 1) { state = (t >> 2) & 3; i--; }
    else { state = (t >> 4) & 3; j--; }
    if (i === 0 && j > 0) state = 2; if (j === 0 && i > 0) state = 1;
  }
  let ident = 0, aligned = 0;
  for (let k = 0; k < n; k++) if (mapAtoB[k] >= 0) { aligned++; if (a[k] === b[mapAtoB[k]]) ident++; }
  return { mapAtoB, score: bestv, aligned_pairs: aligned, percent_identity: aligned ? +(100 * ident / aligned).toFixed(2) : null };
}

const out = {};
for (const r of REQ.requirements) {
  if (r.level !== 'residue') continue;
  const srcId = r.locus.source_id;
  const dp = r.all_danio_orthologues?.length ? null : null;
  const prot = r.zebrafish.none ? null : (r.all_danio_orthologues.find(h => h.type === 'ortholog_one2one') || r.all_danio_orthologues[0]);
  if (!prot) { out[r.id] = { read: false, why: 'no Danio rerio orthologue' }; continue; }
  const src = SRC[srcId];
  if (!src?.seq) { out[r.id] = { read: false, why: `no source protein sequence cached for ${srcId}` }; continue; }
  // the orthologue record carries the Danio PROTEIN id; recover it from the ortho cache
  const oc = read(path.join(CACHE, 'ortho', `${srcId}.json`));
  const h = (oc.homologies || []).find(x => x.danio_gene === prot.ensembl_gene);
  const pid = h?.danio_protein;
  if (!pid) { out[r.id] = { read: false, why: 'the Compara record carries no Danio protein id' }; continue; }
  const p = await protein(pid);
  if (!p?.seq) { out[r.id] = { read: false, why: `Ensembl returned no protein sequence for ${pid}: ${p?.error || 'unknown'}` }; continue; }
  const al = align(src.seq, p.seq);
  const k = r.locus.pos - 1;
  const j = k < al.mapAtoB.length ? al.mapAtoB[k] : -2;
  out[r.id] = {
    read: true, source_protein: src.translation, source_species: src.species, source_residue_at_site: src.seq[k] || null,
    danio_protein: pid, danio_gene: prot.ensembl_gene, danio_symbol: prot.symbol || null,
    percent_identity: al.percent_identity, aligned_pairs: al.aligned_pairs,
    danio_position: j >= 0 ? j + 1 : null,
    danio_residue: j >= 0 ? p.seq[j] : null,
    gap: j === -1,
    reference_residue_matches_sheet: (src.seq[k] || null) === r.locus.ref,
    carries_derived_state: j >= 0 ? p.seq[j] === r.locus.alt : null,
    method: 'Needleman-Wunsch global alignment, BLOSUM62, affine gaps 11/1 (functional/scripts/read-design-residues.mjs align())',
  };
  process.stderr.write(`${r.locus.source_symbol} ${r.locus.substitution}: danio ${out[r.id].danio_residue ?? 'GAP'} at ${out[r.id].danio_position ?? '-'} (pid ${al.percent_identity}%)\n`);
}

const file = path.join(HERE, '..', 'data', 'design-residues.json');
fs.writeFileSync(file, JSON.stringify({
  title: 'The zebrafish (design base) residue at each flying-fish convergent site',
  built: new Date().toISOString(), tool: 'sim-engine/validate/functional/scripts/read-design-residues.mjs',
  method: 'pairwise global alignment (Needleman-Wunsch, BLOSUM62, affine 11/1) of the Daane source protein against the Ensembl Compara Danio rerio orthologue protein; the Danio residue in the column carrying the source site is reported, and a gap is reported as a gap',
  caveat: 'A pairwise alignment between proteins ~75-80 % identical is reliable in conserved blocks and much less so near indels. The percent identity and the aligned-pair count are given per locus so a reader can discount a weak one. This is a SEQUENCE STATE, never a phenotype.',
  source_proteins: 'C:/Temp/sequences/sheetG_proteins.json (sequences/ thread, Ensembl 116)',
  danio_proteins: 'Ensembl REST /sequence/id/<ENSDARP>?type=protein, cached in C:/Temp/functional-cache/protein/',
  n: Object.keys(out).length, read: Object.values(out).filter(x => x.read).length, residues: out,
}, null, 1));
console.log('wrote', file, Object.values(out).filter(x => x.read).length, 'of', Object.keys(out).length, 'read');
