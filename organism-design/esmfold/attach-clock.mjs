#!/usr/bin/env node
// Files the cytochrome c ESMFold runs and their comparison against Kimura's molecular-clock claim as a plain JSON
// record (not a nanopub). Reads runs/compare-cytochrome-c.json and docs/claims.json.
//   node organism-design/esmfold/attach-clock.mjs [--claim kimura-substitution-rate] [--compare runs/compare-cytochrome-c.json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const CLAIM = arg('claim', 'kimura-substitution-rate');
const cmp = JSON.parse(fs.readFileSync(path.join(here, arg('compare', 'runs/compare-cytochrome-c.json')), 'utf8'));
const graph = JSON.parse(fs.readFileSync(path.join(root, 'docs/claims.json'), 'utf8'));
const claim = graph.claims.find(c => c.id === CLAIM);
if (!claim) throw new Error('claim not found: ' + CLAIM);
const runs = cmp.proteins.map(p => JSON.parse(fs.readFileSync(path.join(here, 'runs', p.run, 'result.json'), 'utf8')));

const out = {
  kind: 'model-output-attached-to-claim',
  built: new Date().toISOString(),
  claim: { id: claim.id, statement: claim.statement, thinker: claim.thinker, work: claim.work, nanopub: claim.nanopub, registry: claim.registry, status: claim.status },
  why_this_protein: 'Cytochrome c is the protein on which the molecular clock was first read (Margoliash 1963; Zuckerkandl and Pauling 1965; Fitch and Margoliash 1967): its amino-acid differences between species grow with divergence time while the protein keeps doing the same job. Folding orthologs from cattle, tuna and yeast with the same model shows what the clock\'s substitutions do to the predicted fold.',
  model: { name: runs[0].model.name, host: runs[0].model.host, endpoint: runs[0].model.endpoint, version_reported: runs[0].model.version_reported, docs: runs[0].model.docs, note: 'This is Meta\'s public ESM Atlas endpoint, used because no NVIDIA key was available; the same script calls the BioNeMo NIM when NVIDIA_API_KEY is set.' },
  runs: runs.map(r => ({ uniprot: r.input.uniprot_accession, organism: r.input.organism, ncbi_taxid: r.input.organism_ncbi_taxid, residues: r.input.residue_range, length: r.input.length, sequence_sha256: r.input.sequence_sha256, record_sha256: r.input.record_sha256, started: r.run.started, http_status: r.run.http_status, seconds: r.run.seconds, plddt_mean: r.output.plddt_mean, fraction_plddt_ge_70: r.output.fraction_plddt_ge_70, pdb_sha256: r.output.pdb_sha256, pdb_file: 'organism-design/esmfold/runs/' + r.input.uniprot_accession + '-esmatlas/predicted.pdb' })),
  comparison: { method: cmp.method, pairs: cmp.pairs, file: 'organism-design/esmfold/runs/compare-cytochrome-c.json' },
  what_this_does_and_does_not_show: [
    'It shows that a hosted ESMFold service can be called from this repo on real, checksummed sequences and that the results can be filed against a claim with provenance (model, endpoint, version, time, input hashes).',
    'The numbers are consistent with the neutral theory\'s picture of many substitutions being structurally tolerated: tens of substitutions between orthologs, a predicted fold that superposes within a few angstrom. Consistency is not a test; the claim\'s status is unchanged by this record.',
    'Both structures in every pair are predictions, so the RMSD measures agreement between model outputs, not experimental truth. Experimental cytochrome c structures exist in the PDB and would be the next comparison.',
    'A real test of the clock claim needs substitution counts against divergence times across many lineages, pre-registered; that is a claim test, not a structure prediction.',
    'Nothing genome-related is claimed here.'
  ],
  provenance_for_a_future_nanopub: { 'prov:used': runs.map(r => 'https://www.uniprot.org/uniprotkb/' + r.input.uniprot_accession), 'prov:wasAttributedTo': 'organism-design/esmfold/smoke-test.mjs and compare.mjs', 'delphi:usesModel': 'ESMFold (' + (runs[0].model.version_reported || 'version not reported') + ')', registry_target: 'test registry only, after lint and review' }
};
fs.writeFileSync(path.join(here, 'runs', 'attachment-' + CLAIM + '.json'), JSON.stringify(out, null, 1));
console.log(`attachment-${CLAIM}.json: ${runs.length} runs, ${cmp.pairs.length} pairs`);
