// performance_check: what the design ACCOMPLISHES, as an MCP tool.
import { envelope, p } from '../lib/envelope.mjs';
import { performanceCheck, CHECK_KINDS, SCOPE, VERSION } from '../validate/performance/index.mjs';

const Q = d => ({ anyOf: [
  { type: 'object', properties: { value: { type: 'number' }, source: { type: 'string' }, kind: { type: 'string' } }, required: ['value', 'source'] },
  { type: 'object', properties: { min: { type: 'number' }, max: { type: 'number' }, source: { type: 'string' }, kind: { type: 'string' } }, required: ['min', 'max', 'source'] }],
  description: `${d} A quantity WITH ITS SOURCE: {value, source} or {min, max, source}, which is swept. A bare number is refused.` });

export const PERFORMANCE_TOOLS = [
  {
    name: 'performance_check',
    title: 'Does it do the job? (lifespan, manipulation, mass balance)',
    description: 'The layer for what the organism ACCOMPLISHES, as distinct from its shape (the blueprint) or its gait (locomotion_check). '
      + 'Three questions that no other check here can take, each resting on something that cannot be argued with rather than on a declared outcome. '
      + 'kind "lifespan": expected lifetime under a constant two-term hazard, E[T] = 1/(h_intrinsic + h_extrinsic) -- exact arithmetic, and it carries the '
      + 'life-history point that when extrinsic mortality dominates, extending intrinsic lifespan buys almost nothing, with the number saying how little. '
      + 'kind "manipulation": can it move what it was asked to move? Declared thrust against Stokes drag, F = 6*pi*mu*a*v, exact for a sphere in the creeping limit. '
      + 'kind "mass_balance": does the carbon add up? Uptake against biomass plus respiration -- conservation of mass, so a design claiming more biomass carbon '
      + 'than it takes in is reported impossible rather than optimistic. '
      + 'Every quantity must arrive as {value, source} or {min, max, source}; a bare number is refused by name. '
      + 'You may declare an uptake rate or a thrust. You may NOT declare that the organism works: the layer accepts inputs, never outcomes. '
      + 'It models no mechanism -- no pathway, no transporter, no muscle -- so a design it does not contradict has not been shown to work.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { enum: Object.keys(CHECK_KINDS), description: Object.entries(CHECK_KINDS).map(([k, v]) => `${k}: ${v}`).join(' ') },
        taxon: { type: 'string', description: 'What this is about. Carried into the result; not used to choose any constant.' },
        intrinsic_hazard_per_day: Q('lifespan: the baseline organism\'s intrinsic hazard. 1/(mean lifespan in protection, in days) is the usual way to state it.'),
        designed_intrinsic_hazard_per_day: Q('lifespan: the intrinsic hazard the design is asking for.'),
        extrinsic_hazard_per_day: Q('lifespan: death from outside -- predation, starvation, weather. ecology_check names the taxa recorded as eating this clade and which are recorded where you asked; turning that into a rate is a judgement somebody has to make and state.'),
        medium: { enum: ['water', 'seawater', 'air'], description: 'manipulation: the fluid the particle is moved through. Default water.' },
        particle_radius_m: Q('manipulation: the particle to be moved.'),
        transport_speed_m_s: Q('manipulation: how fast it is to be moved.'),
        available_thrust_N: Q('manipulation: the force the design can exert. Not in this repository for any swimmer; declare it or measure it.'),
        particles_per_pile: Q('manipulation: optional, how many are moved at once.'),
        carbon_uptake_mol_per_day: Q('mass_balance: carbon entering the organism.'),
        carbon_into_biomass_mol_per_day: Q('mass_balance: carbon leaving as new biomass.'),
        carbon_respired_mol_per_day: Q('mass_balance: carbon leaving as CO2. Optional, and omitting it makes the check trivially satisfiable -- the result says so.'),
      },
      required: ['kind'],
    },
    handler: async (args = {}) => {
      const r = performanceCheck(args);
      const prov = Object.entries(r.inputs ?? {}).map(([k, v]) => p(k, [v.min, v.max], v.kind, v.source));
      prov.push(p('model', r.model ?? null, 'derived', r.model_caveat ?? 'see the check'));
      prov.push(p('performance_check version', VERSION, 'derived', 'sim-engine/validate/performance/index.mjs'));
      return envelope(r, prov, SCOPE);
    },
  },
];
