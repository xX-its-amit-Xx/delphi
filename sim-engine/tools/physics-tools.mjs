// physics_check: the FIFTH named result as an MCP tool (sim-engine/validate/physics/).
// Same {name, title, description, inputSchema, handler} shape as TOOLS in server.mjs; the registration
// patch for the hub is in tools/PHYSICS-REGISTER.md. server.mjs was NOT edited by this thread.
// http.mjs serves it as POST /tool/physics_check through its own tools/ discovery already.
import { envelope, p } from '../lib/envelope.mjs';
import { physicsCheck, SCOPE, VERSION } from '../validate/physics/index.mjs';
import { flightSupportCheck, SCOPE as FS_SCOPE, VERSION as FS_VERSION } from '../validate/physics/flight-support.mjs';

const ORG = { description: 'Organism: a saved document id, a repository organism/design id (flying-fish, zebrafish-adult, tff, winged-zebrafish, wingless-flying-fish, ff-zf-chimera, ...), or an inline organism document.', anyOf: [{ type: 'string' }, { type: 'object' }] };

export const PHYSICS_TOOLS = [
  {
    name: 'physics_check',
    title: 'Does the design actually do the thing? (physics simulation)',
    description: 'The FIFTH named result, beside genotype_similarity, phenotype_similarity, lean_check and functional_resolution. '
      + 'Runs the engine\'s own scenario modules on the design at every requested life stage and reports, per criterion of the desired function, '
      + 'met / not met / NO MODEL, with the measured metric, the threshold and the limiting factor. '
      + 'KEEP THE DISTINCTION: lean_check says the design BREAKS NO LAW (necessary, never sufficient); this says the design ACTUALLY DOES THE THING. '
      + 'The target function comes from `spec` (a DesignSpec) when given and is then authoritative; with no spec it is inferred from the design\'s declared intent and said to be inferred. '
      + 'Also runs the standing physical checks for the organism as separate NAMED checks (can it reach its own v_min, does its lifting area support its mass, does drag power fit the aerobic ceiling, does the organ volume fit the body, is it stable in pitch) -- never folded into one number. '
      + 'Every check carries a model_confidence stating whether the model behind it is independently validated, rests on assumed inputs, or is CIRCULAR (scored against a number read back from the paper it is compared with); "function achieved" is never reported without it. '
      + 'Where the inputs have a spread, a seeded ensemble over the stated distributions reports the FRACTION of draws in which the function is achieved plus the median and the 5-95 % band: a design that achieves its function in 8 % of draws has not achieved it. '
      + 'A criterion no scenario can model comes back as `no model` and is listed under unchecked_requirements; it is never dropped and never counts as met. '
      + 'It is a GATE, not a score: physics_gate_failed is true when a hard criterion is not met, and nothing here moves the composite score.',
    inputSchema: {
      type: 'object',
      properties: {
        organism: ORG,
        specimen: { type: 'object', description: 'Instead of an organism: a raw specimen record. A specimen has no STATE, so no scenario can be run on it and the result is `ran: false` with the reason.' },
        spec: { type: 'object', description: 'A DesignSpec (lib/spec.mjs): {start_from, base_edits, criteria:[{scenario, params, metric, op, value, unit, stages, hard, weight, source_text}]}. AUTHORITATIVE when given: that IS the desired function. Build one from a text prompt with parse_design_text.' },
        ageDays: { type: 'number', description: 'Pin every criterion to one age instead of its declared stages.' },
        conditions: { type: 'object', description: 'Ambient conditions passed to resolveState (depth_m, altitude_m, temperature_C, headwind_m_s, ...).' },
        draws: { type: 'integer', description: 'Ensemble draws per criterion per stage (default 200). 0 switches the ensemble off, and then no fraction-of-draws figure is reported.' },
        seed: { type: 'string', description: "Ensemble seed (default 'delphi-v1'). The same seed gives the same ensemble." },
        ensemble: { type: 'boolean', description: 'false switches the ensemble off (same as draws: 0).' },
        launch_height_m: { type: 'number', description: 'Launch height for the standing flight checks (default 1 m, the glide scenario\'s own default; kind assumed).' },
      },
    },
    handler: async (args = {}) => {
      const design = args.specimen ? { specimen: args.specimen } : args.organism;
      const r = await physicsCheck(design, args);
      const prov = [
        p('scenario modules run', r.ran ? [...new Set((r.criteria || []).map(c => c.scenario))] : null, 'derived', 'sim-engine/scenarios/*.mjs, run through scenarios/index.mjs runScenario on the resolved STATE'),
        p('target function', r.target_function?.source ?? null, r.target_function?.source === 'spec' ? 'derived' : 'assumed',
          r.target_function?.source === 'spec' ? 'the DesignSpec handed in by the caller (lib/spec.mjs validateSpec)' : `INFERRED from the design's declared intent: ${r.target_function?.why ?? 'n/a'}`),
        p('ensemble distributions', (r.criteria || []).flatMap(c => c.per_stage || []).find(s => s.ensemble)?.ensemble?.source ?? null, 'assumed',
          'dashboard/public/t/physics/sim/creatures.js DISTRIBUTIONS when present, else validate/physics/ensemble.mjs OWN_DISTRIBUTIONS: the launch-speed BAND is measured-secondhand, the lifting-area spread is measured on three stuffed specimens, the mass CV is borrowed, and the sea state, gusts and every distribution SHAPE are assumed'),
        p('model validation statuses', r.model_honesty?.independent_harness ?? null, 'derived', 'sim-engine/validation/studio-results.json (the independent harness) and each scenario\'s own modelCard.validatedAgainst, read at call time'),
        p('physics_check version', VERSION, 'derived', 'sim-engine/validate/physics/INTERFACE.md'),
      ];
      return envelope(r, prov,
        `${SCOPE} This tool is a GATE and not a score: physics_gate_failed is true when a HARD criterion is not met, gate_status is "incomplete" when a hard criterion has NO MODEL, and nothing here moves the composite design score. `
        + `${r.ran && r.model_honesty?.circular_checks?.length ? `${r.model_honesty.circular_checks.length} of the checks in this report rest on a model the independent harness calls circular; see model_honesty.` : ''}`);
    },
  },
  {
    name: 'flight_support_check',
    title: 'Do the wings carry the animal? (any clade, from declared inputs)',
    description: 'The one aerodynamic question, asked of ANY animal: does lift at the stated airspeed carry the stated weight? '
      + 'L = 1/2 rho v^2 S C_L >= m g. Nothing in that is clade-specific except C_L, which is a property of a particular wing and is '
      + 'taken by clade from a named measurement (sim-engine/validate/physics/lift-coefficients.json) -- never defaulted. No sourced '
      + 'coefficient for the clade means NO NUMBER, because the alternative is answering a question about a mouse with a flying fish lift curve. '
      + 'Use this where physics_check refuses: physics_check runs scenario modules over a resolved STATE and the engine holds body-plan '
      + 'parameters for its own teleosts only, so for any other animal it stops before reaching the aerodynamics. '
      + 'EVERY quantity must arrive with a source; a bare number is refused by name, and a range is swept so the verdict covers it. '
      + 'It is a STEADY-STATE AREA CHECK: it cannot answer powered flight (a power question, not an area question) and says so when asked, '
      + 'and it models no control, no stability and no ability to reach the speed in the first place.',
    inputSchema: {
      type: 'object',
      properties: {
        taxon: { type: 'string', description: 'The animal this is about (scientific name or a clade the clade table knows). Decides the lift coefficient; without it there is no coefficient and no answer.' },
        mass_kg: { anyOf: [{ type: 'object', properties: { value: { type: 'number' }, source: { type: 'string' } }, required: ['value', 'source'] }, { type: 'object', properties: { min: { type: 'number' }, max: { type: 'number' }, source: { type: 'string' } }, required: ['min', 'max', 'source'] }], description: 'Body mass. A quantity WITH ITS SOURCE: {value, source} or {min, max, source} for a range, which is swept. A bare number is refused.' },
        lifting_area_m2: { anyOf: [{ type: 'object', properties: { value: { type: 'number' }, source: { type: 'string' } }, required: ['value', 'source'] }, { type: 'object', properties: { min: { type: 'number' }, max: { type: 'number' }, source: { type: 'string' } }, required: ['min', 'max', 'source'] }], description: 'The area that generates lift, measured the same way the coefficient is referred to. A quantity WITH ITS SOURCE: {value, source} or {min, max, source} for a range, which is swept. A bare number is refused.' },
        airspeed_m_s: { anyOf: [{ type: 'object', properties: { value: { type: 'number' }, source: { type: 'string' } }, required: ['value', 'source'] }, { type: 'object', properties: { min: { type: 'number' }, max: { type: 'number' }, source: { type: 'string' } }, required: ['min', 'max', 'source'] }], description: 'The airspeed at which it is asked to be flying. A quantity WITH ITS SOURCE: {value, source} or {min, max, source} for a range, which is swept. A bare number is refused.' },
        air_density_kg_m3: { type: 'object', description: 'Optional {value, source}. ISA sea level (1.225 kg/m3) if omitted, and the result says it was not supplied.' },
        powered: { type: 'boolean', description: 'true if the question is about POWERED flight. The check then refuses and says what a power answer would need, rather than returning an area result to a power question.' },
        question: { type: 'string', description: 'The question as asked, in words. Only read for whether it is about powered flight.' },
      },
      required: ['taxon'],
    },
    handler: async (args = {}) => {
      const r = flightSupportCheck(args);
      const prov = [
        p('maximum lift coefficient', r.lift_coefficient?.C_Lmax ?? null, r.lift_coefficient?.kind ?? 'assumed',
          r.lift_coefficient?.note ?? (r.lift_coefficient?.reason ?? 'none available for this clade')),
        p('mass', r.inputs?.mass_kg ? [r.inputs.mass_kg.min, r.inputs.mass_kg.max] : null, r.inputs?.mass_kg?.kind ?? 'assumed', r.inputs?.mass_kg?.source ?? 'not supplied'),
        p('lifting area', r.inputs?.lifting_area_m2 ? [r.inputs.lifting_area_m2.min, r.inputs.lifting_area_m2.max] : null, r.inputs?.lifting_area_m2?.kind ?? 'assumed', r.inputs?.lifting_area_m2?.source ?? 'not supplied'),
        p('airspeed', r.inputs?.airspeed_m_s ? [r.inputs.airspeed_m_s.min, r.inputs.airspeed_m_s.max] : null, r.inputs?.airspeed_m_s?.kind ?? 'assumed', r.inputs?.airspeed_m_s?.source ?? 'not supplied'),
        p('air density', r.air_density_kg_m3?.value ?? null, 'assumed', r.air_density_kg_m3?.source ?? 'ISA sea level'),
        p('flight_support_check version', FS_VERSION, 'derived', 'sim-engine/validate/physics/flight-support.mjs'),
      ];
      return envelope(r, prov, FS_SCOPE);
    },
  },
];
