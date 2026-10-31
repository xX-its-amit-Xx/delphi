// protein_structure: fetch an AlphaFold DB model for a UniProt accession, and optionally fold a
// missense variant against its wild type with Meta's public ESMFold endpoint.
//
// Everything here is a STRUCTURE PREDICTION. None of it measures function. A variant that moves a
// backbone by 0.4 A may abolish a channel's conductance, and one that moves it by 4 A may do
// nothing; RMSD does not know which. Every result says so.
//
// Public endpoints, no credentials:
//   AlphaFold DB   https://alphafold.ebi.ac.uk/api/prediction/{accession}
//   UniProt        https://rest.uniprot.org/uniprotkb/{accession}.fasta
//   ESM Atlas      https://api.esmatlas.com/foldSequence/v1/pdb/   (<= 400 residues)

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { envelope, p } from '../lib/provenance.mjs';

const cacheDir = path.join(import.meta.dirname, '..', 'cache');
fs.mkdirSync(cacheDir, { recursive: true });
const ESM_MAX = 400;

async function cached(key, fn) {
  const f = path.join(cacheDir, crypto.createHash('sha256').update(key).digest('hex') + '.json');
  if (fs.existsSync(f)) return { ...JSON.parse(fs.readFileSync(f, 'utf8')), cached: true };
  const data = await fn();
  const rec = { key: key.slice(0, 300), retrieved: new Date().toISOString(), data };
  fs.writeFileSync(f, JSON.stringify(rec));
  return { ...rec, cached: false };
}

const get = async (url, as = 'text') => {
  const r = await fetch(url, { headers: { 'User-Agent': 'delphisci-sim-engine/0.1' } });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}: ${(await r.text()).slice(0, 160)}`);
  return as === 'json' ? r.json() : r.text();
};

// pLDDT is stored in the B-factor column of AlphaFold and ESMFold PDB output.
export function caAtoms(pdb) {
  const out = [];
  for (const line of pdb.split(/\r?\n/)) {
    if (!line.startsWith('ATOM') || line.slice(12, 16).trim() !== 'CA') continue;
    out.push({ resSeq: +line.slice(22, 26), x: +line.slice(30, 38), y: +line.slice(38, 46),
               z: +line.slice(46, 54), b: +line.slice(60, 66) });
  }
  return out;
}
const mean = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);

// Kabsch superposition. A missense variant is the same length as its wild type, so CA atoms
// correspond one to one by index and no sequence alignment is needed.
export function rmsdKabsch(A, B) {
  const n = Math.min(A.length, B.length);
  if (!n) return null;
  const ca = (S, k) => mean(S.slice(0, n).map(a => a[k]));
  const cA = { x: ca(A, 'x'), y: ca(A, 'y'), z: ca(A, 'z') }, cB = { x: ca(B, 'x'), y: ca(B, 'y'), z: ca(B, 'z') };
  const P = A.slice(0, n).map(a => [a.x - cA.x, a.y - cA.y, a.z - cA.z]);
  const Q = B.slice(0, n).map(b => [b.x - cB.x, b.y - cB.y, b.z - cB.z]);
  // H = P^T Q, then the optimal rotation from its SVD. Jacobi eigen-decomposition of H^T H is used
  // instead of a full SVD to keep this dependency-free.
  const H = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) H[a][b] += P[i][a] * Q[i][b];
  const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) for (let c = 0; c < 3; c++) M[a][b] += H[c][a] * H[c][b];
  let V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], Aj = M.map(r => r.slice());
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if (a !== b) off += Aj[a][b] ** 2;
    if (off < 1e-20) break;
    for (let a = 0; a < 2; a++) for (let b = a + 1; b < 3; b++) {
      if (Math.abs(Aj[a][b]) < 1e-18) continue;
      const th = (Aj[b][b] - Aj[a][a]) / (2 * Aj[a][b]);
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      const R = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
      R[a][a] = c; R[b][b] = c; R[a][b] = s; R[b][a] = -s;
      const mul = (X, Y) => X.map((r, i) => Y[0].map((_, j) => r.reduce((acc, v, k) => acc + v * Y[k][j], 0)));
      const Rt = R[0].map((_, i) => R.map(r => r[i]));
      Aj = mul(mul(Rt, Aj), R); V = mul(V, R);
    }
  }
  const evals = [Aj[0][0], Aj[1][1], Aj[2][2]].map(v => Math.max(v, 0));
  const trace = evals.map(Math.sqrt).reduce((a, b) => a + b, 0);
  let sumsq = 0;
  for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) sumsq += P[i][a] ** 2 + Q[i][a] ** 2;
  // det correction: if the rotation would be a reflection, the smallest singular value flips sign.
  const det = H[0][0] * (H[1][1] * H[2][2] - H[1][2] * H[2][1]) - H[0][1] * (H[1][0] * H[2][2] - H[1][2] * H[2][0]) + H[0][2] * (H[1][0] * H[2][1] - H[1][1] * H[2][0]);
  const sorted = evals.map(Math.sqrt).sort((a, b) => a - b);
  const corrected = det < 0 ? trace - 2 * sorted[0] : trace;
  return { rmsd: Math.sqrt(Math.max(0, (sumsq - 2 * corrected) / n)), n_atoms: n };
}

export const schema = {
  title: 'Protein structure from AlphaFold DB, or a variant folded with ESMFold',
  description:
    'Given a UniProt accession, fetches the AlphaFold DB model and reports mean pLDDT with metadata. Given a missense variant as well, folds wild type and variant with Meta public ESMFold and reports CA RMSD and both pLDDTs. Structure prediction only: it says nothing about function.',
  inputSchema: {
    type: 'object',
    properties: {
      accession: { type: 'string', description: 'UniProt accession, e.g. P02769.' },
      variant: { type: 'string', description: 'Missense variant in the form F326L (wild-type residue, 1-based position, variant residue). Omit for the AlphaFold model alone.' },
      fold_variant: { type: 'boolean', default: true, description: 'Call ESMFold when a variant is given. Requires sequence length <= 400.' },
    },
    required: ['accession'],
  },
};

export async function run(args = {}) {
  const acc = (args.accession || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{6,10}$/.test(acc)) throw new Error('accession must look like a UniProt accession');
  const prov = [];
  const result = { accession: acc };

  // 1. Sequence.
  const fasta = await cached(`uniprot:${acc}`, () => get(`https://rest.uniprot.org/uniprotkb/${acc}.fasta`));
  const seq = fasta.data.split(/\r?\n/).slice(1).join('').replace(/[^A-Z]/g, '');
  if (!seq) throw new Error(`no sequence for ${acc}`);
  result.length_aa = seq.length;
  result.sequence_sha256 = crypto.createHash('sha256').update(seq).digest('hex');
  prov.push(p('amino-acid sequence', `${seq.length} aa, sha256 ${result.sequence_sha256.slice(0, 16)}`, 'measured',
    `UniProt ${acc} <https://rest.uniprot.org/uniprotkb/${acc}.fasta>, retrieved ${fasta.retrieved}`));

  // 2. AlphaFold DB model.
  try {
    const meta = await cached(`afdb:${acc}`, () => get(`https://alphafold.ebi.ac.uk/api/prediction/${acc}`, 'json'));
    const entry = Array.isArray(meta.data) ? meta.data[0] : meta.data;
    if (entry?.pdbUrl) {
      const pdb = await cached(`afdb-pdb:${entry.pdbUrl}`, () => get(entry.pdbUrl));
      const atoms = caAtoms(pdb.data);
      result.alphafold = {
        entry_id: entry.entryId, uniprot_start: entry.uniprotStart, uniprot_end: entry.uniprotEnd,
        model_version: entry.latestVersion ?? entry.modelCreatedDate ?? null,
        mean_plddt: mean(atoms.map(a => a.b)), residues_modelled: atoms.length,
        fraction_confident_plddt_over_70: atoms.length ? atoms.filter(a => a.b > 70).length / atoms.length : null,
        pdb_url: entry.pdbUrl,
      };
      prov.push(p('AlphaFold mean pLDDT', result.alphafold.mean_plddt, 'derived',
        `Mean of the B-factor column of the AlphaFold DB model for ${acc} <${entry.pdbUrl}>, retrieved ${pdb.retrieved}`));
    }
  } catch (e) {
    result.alphafold = { error: e.message };
    prov.push(p('AlphaFold model', null, 'assumed', `Not retrieved: ${e.message}`));
  }

  // 3. Variant, folded against the wild type.
  if (args.variant) {
    const m = /^([A-Z])(\d+)([A-Z])$/.exec(args.variant.trim().toUpperCase());
    if (!m) throw new Error('variant must look like F326L');
    const [, wtAa, posStr, varAa] = m, pos = +posStr;
    const observed = seq[pos - 1];
    result.variant = { notation: args.variant.toUpperCase(), position: pos, wild_type: wtAa, substitution: varAa,
                       sequence_has: observed, matches_sequence: observed === wtAa };
    // A variant whose wild-type residue does not match the sequence is reported, never silently applied.
    if (observed !== wtAa) {
      result.variant.error = `position ${pos} of ${acc} is ${observed}, not ${wtAa}; the variant was NOT applied`;
      prov.push(p('variant check', result.variant.error, 'measured', `UniProt ${acc} sequence`));
    } else if (args.fold_variant === false) {
      result.variant.note = 'fold_variant was false; no structure was predicted';
    } else if (seq.length > ESM_MAX) {
      // Refused rather than truncated: a truncated fold is a different protein.
      result.variant.error = `sequence is ${seq.length} aa and the public ESM Atlas endpoint accepts at most ${ESM_MAX}; refused rather than truncated, because folding a fragment answers a different question`;
      prov.push(p('ESMFold prediction', null, 'assumed', result.variant.error));
    } else {
      const mutSeq = seq.slice(0, pos - 1) + varAa + seq.slice(pos);
      // The public endpoint returns a 504 under load often enough that one attempt is not a fair
      // test of it. Retries are for transient server errors only; a 4xx is the server saying no and
      // is not retried.
      const fold = async s => {
        let last;
        for (let attempt = 1; attempt <= 4; attempt++) {
          try {
            const r = await fetch('https://api.esmatlas.com/foldSequence/v1/pdb/', {
              method: 'POST', headers: { 'Content-Type': 'text/plain', 'User-Agent': 'delphisci-sim-engine/0.1' }, body: s });
            if (!r.ok) {
              const body = (await r.text()).slice(0, 160);
              if (r.status < 500) throw new Error(`HTTP ${r.status}: ${body}`);
              throw Object.assign(new Error(`HTTP ${r.status}: ${body}`), { transient: true });
            }
            const t = await r.text();
            if (!/^(HEADER|ATOM)/m.test(t)) throw Object.assign(new Error('response was not a PDB'), { transient: true });
            return t;
          } catch (e) {
            last = e;
            if (!e.transient || attempt === 4) throw e;
            await new Promise(r2 => setTimeout(r2, 4000 * attempt));
          }
        }
        throw last;
      };
      try {
        const wtPdb = await cached(`esmfold:${result.sequence_sha256}`, () => fold(seq));
        const mutPdb = await cached(`esmfold:${crypto.createHash('sha256').update(mutSeq).digest('hex')}`, () => fold(mutSeq));
        const A = caAtoms(wtPdb.data), B = caAtoms(mutPdb.data);
        const sup = rmsdKabsch(A, B);
        result.variant.esmfold = {
          wild_type_mean_plddt: mean(A.map(a => a.b)), variant_mean_plddt: mean(B.map(a => a.b)),
          ca_rmsd_angstrom: sup?.rmsd ?? null, atoms_compared: sup?.n_atoms ?? 0,
          local_plddt_at_site: { wild_type: A[pos - 1]?.b ?? null, variant: B[pos - 1]?.b ?? null },
        };
        prov.push(p('ESMFold wild-type and variant structures', result.variant.esmfold.ca_rmsd_angstrom, 'derived',
          'Meta public ESM Atlas endpoint https://api.esmatlas.com/foldSequence/v1/pdb/ ; CA RMSD after Kabsch superposition, residues matched one to one because a missense substitution preserves length'));
      } catch (e) {
        result.variant.error = e.message;
        prov.push(p('ESMFold prediction', null, 'assumed', `Not retrieved: ${e.message}`));
      }
    }
  }

  return envelope(result, prov,
    'STRUCTURE PREDICTION, NOT FUNCTION. pLDDT is the model confidence in its own coordinates, not ' +
    'evidence that the fold is right, and CA RMSD between a wild type and a variant measures backbone ' +
    'displacement only. Neither quantity predicts whether a channel conducts, a binding site works, or ' +
    'a phenotype appears: a substitution that barely moves the backbone can abolish function, and a ' +
    'large RMSD in a disordered region can mean nothing. Side chains, ligands, membranes, multimers ' +
    'and post-translational modification are absent from both models.');
}
