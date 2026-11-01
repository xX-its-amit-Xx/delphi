// MCP tools for the generative backends (sim-engine/generative). Registration: tools/GENERATIVE-REGISTER.md.
// Same {name, title, description, inputSchema, handler} shape as STUDIO_TOOLS / SPEC_TOOLS; http.mjs discovers it.

const lazy = () => import('../generative/index.mjs');

export const generateSchema = {
  type: 'object',
  properties: {
    level: { type: 'string', enum: ['cell', 'tissue', 'organ', 'system', 'body', 'protein'], description: 'Which level to generate at. Only body (local) and protein (NVIDIA NIM, if keyed) can generate; the others return their honest status.' },
    base: { description: 'body: organism id (flying-fish, zebrafish-adult, a design id), a parent list [{organism, weight}], or an organism document. protein: a UniProt accession or amino-acid sequence (DNA for mode dna).',
      anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'object', properties: { organism: { type: 'string' }, weight: { type: 'number' } }, required: ['organism', 'weight'] } }, { type: 'object' }] },
    text: { type: 'string', description: 'How to augment, in words: "a flying fish with a much deeper body", "slightly more slender, heavier", "tuna-like". Fin and organ words are reported as not generated.' },
    conditions: { type: 'object', description: 'body: {model: fm|ddpm, keep_size (default true), shape_family, sd_shift: {depth|width|peduncle_depth|peduncle_width|condition_K|SL|head_depth: k}, observe: {body_depth_over_SL: 0.25, ...}, steps, llm_assist: nebius|vertex}. protein: {mode: inverse_fold|design|dna, contigs, temperature, num_tokens}.' },
    n: { type: 'integer', minimum: 1, maximum: 64, description: 'Number of candidates (default 4).' },
    seed: { type: 'integer', description: 'Sampling seed (default 1); same seed and inputs give the same candidates.' },
  },
};

export const GENERATIVE_TOOLS = [
  {
    name: 'generate_candidates',
    title: 'Generate candidate designs (flow matching / diffusion)',
    description: 'Generate n candidate organisms (body level: a conditional flow-matching or DDPM model trained on 16 123 real teleost specimens from FishShapes v1, returning body parameters AND ready-to-use organism documents) or protein designs (NVIDIA NIM ProteinMPNN/RFdiffusion/Evo2 when NVIDIA_API_KEY works; otherwise a public structure fallback and no generation). Organ, system, tissue and cell levels return "no training data" / "not configured" with the reason. Every candidate carries provenance; generated values are kind "assumed". Feed a candidate\'s `organism` to organism_get, scenario_run or optimize (organism accepts a document) to test or refine it.',
    inputSchema: generateSchema,
    handler: async args => (await lazy()).generateEnvelope(args),
  },
  {
    name: 'generative_backends_status',
    title: 'Generative backends: what is real, configured, reachable',
    description: 'Per level (body, protein, organ, system, tissue, cell) and per provider (NVIDIA NIM, Nebius AI Studio, Google Vertex AI, public AlphaFold DB / ESM Atlas): ok, not configured, auth failed, unreachable, or no training data. Keys are read from the environment only and never returned. Includes the body model\'s held-out metrics.',
    inputSchema: { type: 'object', properties: { fresh: { type: 'boolean', description: 'Bypass the 10-minute health cache.' } } },
    handler: async args => (await lazy()).statusEnvelope(args),
  },
];
