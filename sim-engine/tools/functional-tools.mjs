// functional_resolution: the FOURTH named result as an MCP tool.
//
// This file is REGISTRATION ONLY. The ledger is built by `sim-engine/validate/functional/` and consumed
// through `sim-engine/validate/functional-interface.mjs`; neither is touched here. Both of those are other
// threads' folders. All this module does is give the already-stated JS entry point a name, a JSON Schema and
// a provenance envelope, so a collaborator can reach the fourth named result on its own instead of only as
// one field inside `validate_generation`.
//
// Why it exists at all: `validate_generation` returns functional_resolution as one of five gates, but a
// collaborator iterating on a design wants the ledger by itself (it is the slowest-moving of the five and the
// one that names what is NOT accounted for). Before this file there was no tool name for it on any server.
//
// Same {name, title, description, inputSchema, handler} shape as the other tool modules in this folder, so
// http.mjs discovery and server.mjs registration both pick it up unchanged.

import { envelope, p } from '../lib/envelope.mjs';
import { functionalResolutionFor, SCOPE_NOTE, LADDER } from '../validate/functional-interface.mjs';

const ORG = {
  description: 'Organism: a saved document id, a repository organism/design id (zebrafish-adult, flying-fish, winged-zebrafish, tff, wingless-flying-fish, ff-zf-chimera, ...), or an inline organism document.',
  anyOf: [{ type: 'string' }, { type: 'object' }],
};

export const FUNCTIONAL_TOOLS = [
  {
    name: 'functional_resolution',
    title: 'Functional-analogue ledger: how each difference is accounted for',
    description: 'The FOURTH named result, beside genotype_similarity, phenotype_similarity, lean_check and physics_check. '
      + 'It picks the closest FUNCTIONAL analogue from the DESIRED FUNCTION (which real animal is recorded as doing the thing that was asked for) rather than from relatedness or shape, '
      + 'derives that analogue\'s requirement set, and then classifies every difference between the design and the analogue on a six-rung ladder: '
      + `${LADDER.join(' > ')}. `
      + 'DEMONSTRATED resolutions (SAME, ALLELIC, PARALOGUE, ANALOGOUS_SET) and HYPOTHESISED ones (COMPENSATORY) are reported apart and are NEVER summed: "this gap could be compensated" is a claim about an unobserved mechanism, not a resolution. '
      + 'An UNRESOLVED difference is a GATE failure: the design is not functionally accounted for, whatever the similarity scores say. Nothing here moves the composite design score. '
      + 'Read `coverage` before quoting any count. Coverage is partial (roughly 30 % of requirements are assessable on the headline case) and the analogue itself is data-poor: '
      + 'there is no flying-fish expression or functional-assay data at any locus, so `functional_data_we_hold` is the honest denominator, not the ledger length. '
      + 'Supply `desired_phenotype` whenever you have it: with no desired function the analogue is INFERRED from the design\'s declared identity and the result says so.',
    inputSchema: {
      type: 'object',
      properties: {
        organism: ORG,
        desired_phenotype: { type: 'string', description: 'The desired phenotype / function as free text -- the same prompt the generator was given. It is the signal that chooses the analogue. Omit it and the function is inferred from the design\'s identity, and the ledger says it was inferred.' },
        spec: { type: 'object', description: 'A DesignSpec instead of (or beside) the text; its criteria are also read for the function. Build one with parse_design_text.' },
        pectoral_len_over_SL: { type: 'number', description: 'The design\'s pectoral fin length as a fraction of SL, for the functional half of the analogue distance, when the document does not carry it.' },
        ageDays: { type: 'number' },
        conditions: { type: 'object' },
        network: { type: 'boolean', description: 'Allow cached network lookups. Default false; the ledger answers from shipped data and cache.' },
        lawset: { type: 'string' },
        reference_set_excluding: { type: 'array', items: { type: 'string' }, description: 'Leave-out entries, passed through unchanged (ids, "species:", "family:", "order:", "organism:").' },
      },
      required: ['organism'],
    },
    handler: async (args = {}) => {
      const { organism, ...opts } = args;
      const r = await functionalResolutionFor(organism, { ...opts, network: opts.network === true });
      const an = r.closest_functional_analogue;
      const prov = [
        p('functional analogue', an ? `${an.name ?? an.id ?? 'none'} (${an.taxon ?? 'n/a'})` : null,
          an?.no_analogue ? 'derived' : 'measured-secondhand',
          an?.source || 'sim-engine/validate/functional/analogue.mjs: a declared function -> taxon table whose rows cite the papers that record the behaviour'),
        p('desired function', r.ran ? (an?.function ?? null) : null,
          an?.function_signal === 'specified' ? 'derived' : 'assumed',
          an?.function_signal === 'specified' ? 'the desired_phenotype text supplied by the caller' : 'INFERRED from the design\'s declared identity, because no desired phenotype reached this module'),
        p('requirement set', r.requirement_set?.length ?? null, 'derived', 'sim-engine/validate/functional/requirements.mjs, from the analogue\'s recorded values in the named repo data files'),
        p('differences classified', r.resolution?.differences ?? null, 'derived', 'sim-engine/validate/functional/resolve.mjs (the six-rung ladder)'),
        p('functional data held for the analogue', an?.functional_data_we_hold ?? null, 'measured',
          'counted from the repository at call time: there is no flying-fish expression or functional-assay data at any locus'),
      ];
      return envelope(r, prov,
        `${r.scope || SCOPE_NOTE} This is a GATE, not a score: an UNRESOLVED difference fails the gate and nothing in this ledger moves the composite design score. `
        + 'Coverage is partial and stated in `coverage`: a difference that was never classified is absent from every count, so the counts are a floor. '
        + `${r.ran ? '' : 'The ledger did not run on this call; `reason` says why, and nothing was substituted for it.'}`);
    },
  },
];

export default FUNCTIONAL_TOOLS;
