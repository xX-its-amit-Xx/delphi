#!/usr/bin/env node
// Attaches the ESMFold smoke-test result to one DELPHI claim as a plain JSON record (not a nanopub; publishing goes
// through the normal test-then-production path later). Reads runs/<accession>/result.json and docs/claims.json.
//   node organism-design/esmfold/attach.mjs [--accession P02769] [--claim thompson1917-ch09-06]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const ACC = arg('accession', 'P02769');
const CLAIM = arg('claim', 'thompson1917-ch09-06');
const result = JSON.parse(fs.readFileSync(path.join(here, 'runs', ACC, 'result.json'), 'utf8'));
const graph = JSON.parse(fs.readFileSync(path.join(root, 'docs/claims.json'), 'utf8'));
const claim = graph.claims.find(c => c.id === CLAIM);
if (!claim) throw new Error('claim not found: ' + CLAIM);
const rec = JSON.parse(fs.readFileSync(path.join(root, result.input.record_file), 'utf8'));
const fn = (rec.comments || []).find(c => c.commentType === 'FUNCTION')?.texts?.[0]?.value || null;
const caSites = (rec.features || []).filter(f => f.type === 'Binding site' && /Ca\(2\+\)/.test(f.ligand?.name || '')).map(f => f.location.start.value);
const pdbs = (rec.uniProtKBCrossReferences || []).filter(x => x.database === 'PDB').map(x => x.id);

const out = {
  kind: 'model-output-attached-to-claim',
  built: new Date().toISOString(),
  claim: { id: claim.id, statement: claim.statement, quote: claim.quote, thinker: claim.thinker, work: claim.work, nanopub: claim.nanopub, registry: claim.registry, status: claim.status },
  why_this_protein: 'Thompson attributes the solubility of skeletal calcium salts to "albuminous solution" and "the proteids of the organism". Serum albumin is the albumin that carries calcium in blood: UniProt annotates it as the major plasma calcium transporter with annotated Ca(2+) binding sites. This record anchors the claim\'s named substance to a concrete molecule and its predicted structure.',
  protein: { uniprot: result.input.uniprot_accession, name: result.input.protein, organism: result.input.organism, ncbi_taxid: result.input.organism_ncbi_taxid, residue_range_modelled: result.input.residue_range, uniprot_function_annotation: fn, annotated_ca_binding_sites: caSites, experimental_structures_in_pdb: pdbs, record_sha256: result.input.record_sha256 },
  model: result.model,
  run: result.run,
  prediction: result.output ? { pdb_file: 'organism-design/esmfold/runs/' + ACC + '/' + result.output.pdb_file, pdb_sha256: result.output.pdb_sha256, residues_modelled: result.output.residues_modelled, plddt_mean: result.output.plddt_mean, fraction_plddt_ge_70: result.output.fraction_plddt_ge_70, fraction_plddt_ge_90: result.output.fraction_plddt_ge_90 } : null,
  what_this_does_and_does_not_show: [
    'It shows that a hosted BioNeMo model can be called from this repo on a real, checksummed sequence and that the result can be filed against a claim with provenance (model, endpoint, version, time, input hash).',
    'A predicted structure does not test Thompson\'s claim about solubility; the claim\'s status is unchanged by this record.',
    'The next real step would be a pre-registered claim test against solubility measurements, not more structure predictions.',
    'Anything genome-related is out of scope here and would be labelled a sketch.'
  ],
  provenance_for_a_future_nanopub: { 'prov:used': ['https://www.uniprot.org/uniprotkb/' + ACC], 'prov:wasAttributedTo': 'organism-design/esmfold/smoke-test.mjs calling the hosted ESMFold NIM', 'delphi:usesModel': 'ESMFold (' + (result.model.version_reported || 'version not reported by the API') + ')', registry_target: 'test registry only, after lint and review' }
};
fs.writeFileSync(path.join(here, 'runs', ACC, 'attachment.json'), JSON.stringify(out, null, 1));
console.log(`attachment.json: ${CLAIM} <- ${ACC} (${result.run.status})`);
