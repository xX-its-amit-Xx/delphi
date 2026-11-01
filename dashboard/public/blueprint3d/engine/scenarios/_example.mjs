// INTERFACE TEST ONLY. Not a model of anything: it exists so the registry, the tools, the CLI and the
// browser engine can be tested before the real scenario modules (written by other agents) land.
// It reports two quantities the STATE already carries, scaled by one parameter, and claims nothing.
export default {
  key: '_example',
  title: 'Interface test (not a scenario)',
  group: 'physiology',
  interface_test: true,
  params: [
    { key: 'factor', label: 'multiplier', unit: '-', default: 1, min: 0, max: 10, kind: 'assumed', source: 'interface test parameter' },
  ],
  requires: ['mass_kg', 'gill_area_m2'],
  metrics: [
    { key: 'gill_area_per_mass', label: 'gill area / mass x factor', unit: 'm2/kg', better: 'higher' },
    { key: 'mass_g', label: 'mass', unit: 'g', better: null },
  ],
  run(state, params) {
    const M = state.mass_kg.value, G = state.gill_area_m2.value;
    return {
      metrics: [
        { key: 'gill_area_per_mass', label: 'gill area / mass x factor', value: (G / M) * params.factor, unit: 'm2/kg', better: 'higher', kind: 'derived', source: `STATE gill_area_m2 (${state.gill_area_m2.kind}) / mass_kg (${state.mass_kg.kind}) x factor` },
        { key: 'mass_g', label: 'mass', value: M * 1000, unit: 'g', better: null, kind: 'derived', source: 'STATE mass_kg x 1000' },
      ],
      survives: null,
      feasible: null,
      limiting: null,
      provenance: [
        { quantity: 'mass_kg', value: M, kind: state.mass_kg.kind, source: state.mass_kg.source },
        { quantity: 'gill_area_m2', value: G, kind: state.gill_area_m2.kind, source: state.gill_area_m2.source },
      ],
      scope: 'INTERFACE TEST. This is arithmetic on two STATE fields, not a physiological model; it says nothing about survival or performance.',
      validity: { inRange: true, notes: 'no validity range: not a model' },
    };
  },
  modelCard: {
    equations: ['gill_area_per_mass = gill_area_m2 / mass_kg x factor'],
    sources: [],
    validity: 'none: interface test',
    validatedAgainst: [],
  },
};
