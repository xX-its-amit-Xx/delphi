// The unifying validator as an MCP tool: `validate_generation`.
//
// One tool, Amit's signature. Same {name, title, description, inputSchema, handler} shape as the other tool
// modules in this folder. server.mjs is NOT edited here: the patch is in tools/PIPELINE-REGISTER.md.
//
// sim-engine/http.mjs discovers tools/ on its own, so this is already reachable as POST /tool/validate_generation
// before the patch is applied.

import { validateGeneration, VERSION, SCOPE } from '../validate/pipeline/index.mjs';

const DESC = `The unifying design validator. Input: the generated organism, the base organism, and the DESIRED PHENOTYPE AS TEXT (the same prompt the generator was given). It parses the text into a DesignSpec, identifies the closest FUNCTIONAL analogue from the desired function rather than from relatedness and fetches that analogue's genotype, sweeps the functional annotations at every biological scale (sequence/genomic, transcriptomic, proteomic, PTM, pathway, then cell, tissue, organ, organ system, body), then runs functional_resolution, lean_check and physics_check with the spec as the physics target.

Returns five named results side by side, each with its own gate, NEVER summed, plus a per-scale coverage number and a verdict SENTENCE naming what passed, what failed and what could not be assessed.

Be clear about the sequence limit before reading the output: this project has no generated whole genomes. A design is its base plus edits, so when a document or design id is supplied the generated sequence is reconstructed AT THE EDITED LOCI ONLY, and when the design carries no gene-level edit (the usual case) nothing is reconstructed at all. 'sequence_basis' and 'loci_covered' say which of the three cases applies on every call. Any unparsed part of the desired-phenotype text is returned verbatim: an unparsed requirement is an unchecked requirement.

${SCOPE}`;

export const PIPELINE_TOOLS = [
  {
    name: 'validate_generation',
    title: 'Validate a generated organism against the desired phenotype, at every scale',
    description: DESC,
    inputSchema: {
      type: 'object',
      properties: {
        desired_phenotype: { type: 'string', description: 'The desired phenotype as free text -- the same prompt the generator was given. Parsed by lib/parse-text.mjs; whatever cannot be parsed is returned verbatim and marked unchecked.' },
        generated: { description: 'The generated organism: a design id (e.g. "winged-zebrafish"), an inline organism document, a path to an organism-document JSON, or a path to / string of FASTA or plain sequence.', anyOf: [{ type: 'string' }, { type: 'object' }] },
        base: { description: 'The base organism, in any of the same forms (e.g. "zebrafish-adult").', anyOf: [{ type: 'string' }, { type: 'object' }] },
        network: { type: 'boolean', description: 'Allow network lookups (Ensembl, used only to reconstruct sequence at edited loci). Default false.' },
        lawset: { type: 'string', description: 'Lean lawset version for the Lean check. Default "current".' },
        ageDays: { type: 'number', description: 'Evaluate at this age in days instead of the criterion\'s stages.' },
        conditions: { type: 'object', description: 'Ambient conditions override (see conditions/baseline.json for what is otherwise held fixed).' },
        reference_set_excluding: { type: 'array', items: { type: 'string' }, description: 'Leave-out entries for the phenotype reference set (ids, "species:", "family:", "order:", "organism:").' },
        extra_genes: { type: 'array', items: { type: 'string' }, description: 'Extra gene symbols to include in the multi-scale sweep beyond the focal panel and the edited genes.' },
      },
      required: ['desired_phenotype', 'generated', 'base'],
    },
    async handler(args = {}) {
      const r = await validateGeneration({
        generated: args.generated, base: args.base, desired_phenotype: args.desired_phenotype,
        opts: { network: args.network === true, lawset: args.lawset, ageDays: args.ageDays, conditions: args.conditions,
          reference_set_excluding: args.reference_set_excluding, extraGenes: args.extra_genes },
      });
      return r;
    },
  },
];

export const PIPELINE_VERSION = VERSION;
export default PIPELINE_TOOLS;
