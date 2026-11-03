// locomotion_check: the 4D layer as an MCP tool. Same {name, title, description, inputSchema, handler}
// shape as the other tool modules; registered in mcp/server.mjs.
import { envelope, p } from '../lib/envelope.mjs';
import { locomotionCheck, MODES, SCOPE, VERSION } from '../validate/locomotion/index.mjs';

const Q = d => ({ anyOf: [
  { type: 'object', properties: { value: { type: 'number' }, source: { type: 'string' }, kind: { type: 'string' } }, required: ['value', 'source'] },
  { type: 'object', properties: { min: { type: 'number' }, max: { type: 'number' }, source: { type: 'string' }, kind: { type: 'string' } }, required: ['min', 'max', 'source'] }],
  description: `${d} A quantity WITH ITS SOURCE: {value, source} or {min, max, source} for a range, which is swept. A bare number is refused.` });

export const LOCOMOTION_TOOLS = [
  {
    name: 'locomotion_check',
    title: 'How does it move? (the layer beside the blueprint)',
    description: 'The locomotion layer: not what the organism is made of, but how it moves. A blueprint describes one instant; '
      + 'an organism asked to swim, walk or fly is being asked for a CYCLE, repeated, that carries the body through a fluid, and two designs '
      + 'with identical part lists can differ in whether they go anywhere. '
      + 'Three kinds of result, kept strictly apart because they are different kinds of claim. '
      + 'THEOREM: a result holding for every organism meeting its conditions, with no fitted parameter -- the Purcell scallop theorem, which can '
      + 'return `impossible` for a time-reversible stroke at low Reynolds number, because in the Stokes limit such a stroke returns the body exactly '
      + 'where it started at any beat frequency. ARITHMETIC: inequalities over declared quantities, such as whether cycle frequency times distance '
      + 'per cycle is the stated speed. REGIME: empirical indicators (Reynolds, Froude) that say which physics dominates and what comparable animals '
      + 'do -- REPORTED AND NEVER FAILING A DESIGN, because equal Froude number is necessary and not sufficient for dynamic similarity and a threshold '
      + 'borrowed across clades is the failure this repository keeps removing. '
      + 'Flight is not reimplemented here: the flight modes delegate to flight_support_check, so there is one lift-coefficient policy and not two. '
      + 'It models no muscle, no metabolism, no control and no energy budget: a design it does not contradict has not been shown to move.',
    inputSchema: {
      type: 'object',
      properties: {
        taxon: { type: 'string', description: 'What this is about. Needed for the flight modes, which choose a lift coefficient by clade.' },
        mode: { enum: Object.keys(MODES), description: Object.entries(MODES).map(([k, v]) => `${k}: ${v.what}`).join('; ') },
        medium: { enum: ['water', 'seawater', 'air'], description: "The fluid. Defaults to the mode's own medium and the result says which was used. Properties come from sim-engine/validate/locomotion/media.json with their sources; note that mucus, biofilm and cytoplasm are far more viscous than water, so a Reynolds number computed in water is an upper bound for a swimmer in any of them." },
        body_length_m: Q('The length along the direction of travel.'),
        speed_m_s: Q('The speed the design is asked to reach.'),
        gait: { type: 'object', description: 'How the cycle works. { reciprocal: boolean, degrees_of_freedom: number, cycle_hz: Q, distance_per_cycle_m: Q, description: string, source: string }. '
          + '`reciprocal` says the stroke retraces its own path in configuration space (a single opening-and-closing hinge); one degree of freedom implies it. `source` is required for the theorem to be applied, because whether a stroke is time-reversible is a claim about the design and is not inferred here. '
          + '`distance_per_cycle_m` is NET displacement per cycle, not the path the appendage sweeps.' },
        mass_kg: Q('Flight modes only: passed to flight_support_check.'),
        lifting_area_m2: Q('Flight modes only: passed to flight_support_check.'),
        question: { type: 'string', description: 'The question as asked, in words. Only read for whether it is about powered flight.' },
      },
      required: ['mode'],
    },
    handler: async (args = {}) => {
      const r = locomotionCheck(args);
      const prov = [
        p('medium', r.medium?.label ?? null, r.medium?.kind ?? 'assumed', r.medium?.source ?? 'no medium resolved'),
        p('body length', r.inputs?.body_length_m ? [r.inputs.body_length_m.min, r.inputs.body_length_m.max] : null, r.inputs?.body_length_m?.kind ?? 'assumed', r.inputs?.body_length_m?.source ?? 'not supplied'),
        p('speed', r.inputs?.speed_m_s ? [r.inputs.speed_m_s.min, r.inputs.speed_m_s.max] : null, r.inputs?.speed_m_s?.kind ?? 'assumed', r.inputs?.speed_m_s?.source ?? 'not supplied'),
        p('scallop theorem', r.checks?.find(c => c.id === 'reciprocal_stroke_at_low_reynolds')?.verdict ?? null, 'derived',
          'Purcell EM 1977, Life at low Reynolds number, Am J Phys 45(1):3-11, doi 10.1119/1.10903. A theorem about the Stokes limit, not a measurement of any organism.'),
        p('locomotion_check version', VERSION, 'derived', 'sim-engine/validate/locomotion/index.mjs'),
      ];
      return envelope(r, prov, SCOPE);
    },
  },
];
