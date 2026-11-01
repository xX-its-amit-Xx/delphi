// PROTEIN level. Generation needs a hosted generative model; the only ones wired are NVIDIA NIM (ProteinMPNN inverse
// folding, RFdiffusion backbone design, Evo2 DNA generation, ESMFold folding). Without a working NVIDIA_API_KEY the
// level does NOT generate: it says 'not configured' and falls back to the public, no-key endpoints for STRUCTURE
// (AlphaFold DB lookup for a UniProt accession; Meta's ESMFold at api.esmatlas.com for a sequence <= 400 aa). Folding
// a given sequence is prediction, not generation, and the result says so.

import { nimHealth, nimCall } from './providers.mjs';
import { p } from '../../lib/envelope.mjs';

const ACC = /^[OPQ][0-9][A-Z0-9]{3}[0-9]$|^[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2}$/;
const AA = /^[ACDEFGHIKLMNPQRSTVWY]+$/;
// AlphaFold DB answers 403 to the default undici User-Agent; send one, as tools/protein-structure.mjs does.
const UA = { 'User-Agent': 'delphisci-sim-engine/0.1' };
const fetchT = (url, opt = {}, ms = 60000) => fetch(url, { ...opt, headers: { ...UA, ...(opt.headers || {}) }, signal: AbortSignal.timeout(ms) });

export function meanPlddt(pdb) {
  const b = pdb.split('\n').filter(l => l.startsWith('ATOM') && l.slice(12, 16).trim() === 'CA').map(l => parseFloat(l.slice(60, 66))).filter(Number.isFinite);
  if (!b.length) return null;
  const m = b.reduce((a, x) => a + x, 0) / b.length;
  return +(m <= 1 ? m * 100 : m).toFixed(2); // ESM Atlas writes pLDDT on 0-1, AlphaFold DB on 0-100
}

async function afdb(acc) {
  const r = await fetchT(`https://alphafold.ebi.ac.uk/api/prediction/${acc}`);
  if (!r.ok) throw new Error(`AlphaFold DB: HTTP ${r.status} for ${acc}`);
  const m = (await r.json())[0];
  const pdb = await (await fetchT(m.pdbUrl)).text();
  return { accession: acc, sequence: m.uniprotSequence, pdbUrl: m.pdbUrl, pdb, mean_plddt: meanPlddt(pdb), model_version: m.latestVersion ?? null };
}
async function esmAtlasFold(seq) {
  if (seq.length > 400) throw new Error(`ESM Atlas folds <= 400 residues (got ${seq.length})`);
  const r = await fetchT('https://api.esmatlas.com/foldSequence/v1/pdb/', { method: 'POST', body: seq }, 120000);
  if (!r.ok) throw new Error(`ESM Atlas: HTTP ${r.status}`);
  const pdb = await r.text(); return { pdb, mean_plddt: meanPlddt(pdb) };
}

export async function status() {
  const nim = await nimHealth();
  return { level: 'protein', generation: nim.status === 'ok' ? 'ok (NVIDIA NIM)' : `not available: NVIDIA NIM ${nim.status}`, nim,
    fallback: 'structure only, no key: AlphaFold DB (accession) and ESMFold at api.esmatlas.com (sequence <= 400 aa)',
    note: 'NIM endpoint payloads follow the build.nvidia.com model cards and have NOT been exercised against a live key from this box (the key provided was a Brev bak- key, rejected with HTTP 401).' };
}

/**
 * generate({base, conditions, n, seed}) at the protein level.
 *   base: a UniProt accession (e.g. 'Q9W6V4') or an amino-acid sequence.
 *   conditions.mode: 'inverse_fold' (default; ProteinMPNN on the AFDB structure, each design re-folded by ESMFold NIM),
 *                    'design' (RFdiffusion; needs conditions.contigs), 'dna' (Evo2; base = DNA, conditions.num_tokens).
 */
export async function generateProtein({ base, conditions = {}, n = 4, seed = 1 }) {
  const mode = conditions.mode || 'inverse_fold';
  const b = String(base || '').trim().toUpperCase();
  const isAcc = ACC.test(b), isSeq = !isAcc && AA.test(b);
  if (!isAcc && !isSeq && mode !== 'dna') throw new Error('protein generation needs `base`: a UniProt accession or an amino-acid sequence');
  const nim = await nimHealth();
  const prov = [];
  if (nim.status !== 'ok') {
    // Honest fallback: structure for the base, no generated candidates.
    const fallback = {};
    try {
      if (isAcc) { const a = await afdb(b); fallback.alphafold_db = { accession: b, mean_plddt: a.mean_plddt, pdbUrl: a.pdbUrl, length: a.sequence.length }; prov.push(p('mean pLDDT (AlphaFold DB)', a.mean_plddt, 'derived', `AlphaFold DB model for ${b}: a prediction, not an experimental structure`)); }
      else if (isSeq) { const f = await esmAtlasFold(b); fallback.esmfold = { length: b.length, mean_plddt: f.mean_plddt, pdb_chars: f.pdb.length, pdb: f.pdb }; prov.push(p('mean pLDDT (ESMFold)', f.mean_plddt, 'derived', 'ESMFold via api.esmatlas.com (public): a prediction')); }
    } catch (e) { fallback.error = e.message; }
    return { status: `not configured (NVIDIA NIM: ${nim.status})`, candidates: [], fallback, backend: 'public-structure-fallback', nim, provenance: prov,
      scope: 'No protein was GENERATED: generation needs a working NVIDIA_API_KEY (nvapi-). The fallback returns the predicted structure of the base only (AlphaFold DB or ESMFold), which is prediction of a given sequence, not design.' };
  }
  const candidates = [];
  if (mode === 'inverse_fold') {
    if (!isAcc) throw new Error('inverse_fold needs a UniProt accession (the backbone comes from AlphaFold DB)');
    const a = await afdb(b);
    const out = await nimCall('proteinmpnn', { input_pdb: a.pdb, ca_only: false, use_soluble_model: false, num_seq_per_target: n, sampling_temp: [conditions.temperature ?? 0.1], random_seed: seed });
    const seqs = String(out.mfasta || '').split('\n').filter(l => l && !l.startsWith('>')).slice(1, n + 1); // first record is the input
    for (const s of seqs) {
      let fold = null; try { const f = await nimCall('esmfold', { sequence: s }); const pdb = f.pdbs?.[0] || f.pdb || ''; fold = { mean_plddt: meanPlddt(pdb), pdb }; } catch (e) { fold = { error: e.message }; }
      const ident = [...s].filter((c, i) => c === a.sequence[i]).length / Math.max(1, a.sequence.length);
      candidates.push({ sequence: s, identity_to_base: +ident.toFixed(3), structure: fold,
        provenance: [p('designed sequence', 'ProteinMPNN', 'assumed', `NVIDIA NIM ProteinMPNN on the AlphaFold DB model of ${b}; an untested design`)] });
    }
  } else if (mode === 'design') {
    if (!conditions.contigs) throw new Error('design mode needs conditions.contigs (RFdiffusion contig string, e.g. "A20-60/0 50-80")');
    const a = isAcc ? await afdb(b) : null;
    for (let i = 0; i < n; i++) {
      const out = await nimCall('rfdiffusion', { input_pdb: a?.pdb, contigs: conditions.contigs, hotspot_res: conditions.hotspot_res || [], diffusion_steps: conditions.diffusion_steps || 15, random_seed: seed + i });
      candidates.push({ structure: { pdb: out.output_pdb }, provenance: [p('designed backbone', 'RFdiffusion', 'assumed', 'NVIDIA NIM RFdiffusion; a backbone with no sequence until inverse-folded')] });
    }
  } else if (mode === 'dna') {
    for (let i = 0; i < n; i++) {
      const out = await nimCall('evo2', { sequence: String(base), num_tokens: conditions.num_tokens || 200, temperature: conditions.temperature ?? 0.7, top_k: 4, random_seed: seed + i });
      candidates.push({ sequence: out.sequence, provenance: [p('generated DNA', 'Evo2', 'assumed', 'NVIDIA NIM Evo2 40B continuation; not tested')] });
    }
  } else throw new Error(`unknown protein mode "${mode}"`);
  return { status: 'ok', candidates, backend: 'nvidia-nim', model: mode, provenance: prov,
    scope: 'Designed sequences/backbones from hosted generative models. A design with a high predicted pLDDT is a prediction that it folds, not evidence that it expresses, folds, or functions; nothing here was made or measured.' };
}
