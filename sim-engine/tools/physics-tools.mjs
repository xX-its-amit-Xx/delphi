// physics_check: the FIFTH named result as an MCP tool (sim-engine/validate/physics/).
// Same {name, title, description, inputSchema, handler} shape as TOOLS in server.mjs; the registration
// patch for the hub is in tools/PHYSICS-REGISTER.md. server.mjs was NOT edited by this thread.
// http.mjs serves it as POST /tool/physics_check through its own tools/ discovery already.
import { envelope, p } from '../lib/envelope.mjs';
import { physicsCheck, SCOPE, VERSION } from '../validate/physics/index.mjs';

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
];
