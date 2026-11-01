// grip.mjs — climbing / grip strength. Fish mostly have no gripping organ. This scenario only models a
// structure the design actually carries: a suction (adhesive) disc found in STATE.parts or given as an
// area. Without one it says so and returns no numbers. Suction adhesion F = sigma x A, capped by ambient
// pressure (Wainwright et al. 2013; Ditsche & Summers 2019); clingfish and climbing gobies are the
// measured references. Pure ESM, no imports. No bird data.

const SRC = {
  wainwright2013: 'Wainwright DK, Kleinteich T, Kleinteich A, Gorb SN, Summers AP 2013. Stick tight: suction adhesion on irregular surfaces in the northern clingfish. Biol Lett 9:20130234. doi:10.1098/rsbl.2013.0234 (PMC3645053, full text read)',
  ditsche2019: 'Ditsche P, Summers A 2019. Learning from Northern clingfish (Gobiesox maeandricus): bioinspired suction cups attach to rough surfaces. Phil Trans R Soc B 374:20190204. doi:10.1098/rstb.2019.0204 (PMC6745484, full text read)',
  schoenfuss2026: 'Schoenfuss HL, Diamond KM, Lagarde R, Blob RW 2026. Ontogenetic change in performance: do innovations constrain performance in gobiid fishes? Integr Org Biol 8:obag044. doi:10.1093/iob/obag044 (PMC13494557, Table 1)',
  blob2019: 'Blob RW et al. 2019. Functional diversity of evolutionary novelties: insights from waterfall-climbing kinematics. Integr Org Biol 1:obz029. doi:10.1093/iob/obz029 (PMC7671142, Table 1)',
  mcfarland2026: 'McFarland EP et al. 2026. The convergent evolution of the pelvic suction cup. Sci Adv 12:eaeh7851. doi:10.1126/sciadv.aeh7851 (PMC13544227): "the pelvic suction cup originated independently three times" (clingfishes, snailfishes/lumpsuckers, rock-climbing gobies)',
};
const G = 9.81;
const V = (s, k) => { const f = s?.[k]; return f && typeof f === 'object' && 'value' in f ? f.value : (f ?? null); };
const amb = (s, k) => { const a = s?.ambient; const f = a?.[k]; return f && typeof f === 'object' && 'value' in f ? f.value : (f ?? null); };
const r3 = x => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000);
const PART_RE = /sucker|suction|adhes|cling|(^|_)dis[ck]($|_)|oral_disc|pelvic_disc/i;
const METRICS = [
  { key: 'has_gripping_structure', label: 'Gripping (suction/adhesive) structure present', unit: 'bool', better: 'higher' },
  { key: 'adhesive_force_N', label: 'Suction adhesive force', unit: 'N', better: 'higher' },
  { key: 'safety_factor_body_weights', label: 'Adhesive force / body weight', unit: 'body weights', better: 'higher' },
  { key: 'ceiling_safety_factor', label: 'Upper bound at full ambient-pressure suction', unit: 'body weights', better: 'higher' },
  { key: 'net_climbing_speed_m_s', label: 'Net climbing speed (goby-type inching, incl. rests)', unit: 'm/s', better: 'higher' },
];
const L = k => METRICS.find(m => m.key === k);
const met = (k, value, kind, source, extra = {}) => {
  const v = value == null || (typeof value === 'number' && !Number.isFinite(value)) ? null : value;
  return { key: k, label: L(k).label, value: v, unit: L(k).unit, better: L(k).better, kind: v == null ? 'assumed' : kind, source: v == null ? `no value: ${extra.reason || source}` : source, ...extra };
};
const nul = (k, reason) => met(k, null, 'assumed', reason, { reason });

export default {
  key: 'grip',
  title: 'Climbing and grip: suction adhesion, only where a structure exists',
  group: 'behaviour',
  requires: ['mass_kg'],
  needs: ['parts (a part id matching sucker/suction/adhesive/disc)', 'adhesive_disc_area_m2', 'SL_m', 'ambient.pressure_kPa'],
  params: [
    { key: 'disc_area_m2', label: 'Adhesive disc area (null = from STATE)', unit: 'm^2', default: null, min: 0, max: 0.05, kind: 'assumed', source: 'design input; clingfish discs measured 3.9-12.3 cm^2 at 70-120 mm SL (Wainwright 2013)' },
    { key: 'adhesive_stress_kPa', label: 'Sustained suction stress at failure', unit: 'kPa', default: 30, min: 0.1, max: 101.3, kind: 'borrowed', source: 'clingfish: "peak stress ranged from 20 to 50 kPa" (Wainwright 2013); whole disc on smooth surfaces 30-40 kPa (Ditsche & Summers 2019). Climbing-goby pelvic suction is far lower: 0.63-1.5 kPa (Schoenfuss 2026 Table 1, e.g. S. stimpsoni 1.5 kPa) — set 1.5 for a goby-type sucker' },
    { key: 'surface_Ra_um', label: 'Surface roughness Ra', unit: 'µm', default: 15, min: 0, max: 2000, kind: 'measured', source: 'clingfish adhere equally well from Ra 15 to 269 µm (Wainwright 2013 abstract); validity bound, not a force modifier' },
  ],
  metrics: METRICS,

  run(state, params) {
    const prov = []; const notes = []; let inRange = true;
    const P = (quantity, value, kind, source) => prov.push({ quantity, value, kind, source });
    const M = V(state, 'mass_kg'); const SL = V(state, 'SL_m');
    const parts = state?.parts && typeof state.parts === 'object' ? state.parts : {};
    const found = Object.entries(parts).filter(([id, p]) => PART_RE.test(id) && !(p && typeof p.scale === 'number' && p.scale <= 0));
    const stateArea = V(state, 'adhesive_disc_area_m2');
    const partArea = found.map(([, p]) => p?.area_m2).find(a => typeof a === 'number');
    const has = found.length > 0 || stateArea != null || params.disc_area_m2 != null;
    if (!has) {
      const reason = 'no gripping structure: the design has no suction or adhesive part. Pelvic suction cups evolved only in clingfishes, snailfishes/lumpsuckers and rock-climbing gobies (McFarland 2026), not in zebrafish or flying fish (inference by absence; a larval cement gland is reported in the related giant danio)';
      return {
        metrics: [met('has_gripping_structure', false, 'derived', 'STATE.parts has no part matching sucker/suction/adhesive/disc; ' + SRC.mcfarland2026), ...METRICS.slice(1).map(m => nul(m.key, 'no gripping structure'))],
        survives: null, feasible: false, limiting: reason, provenance: [{ quantity: 'gripping structure', value: false, kind: 'derived', source: SRC.mcfarland2026 }],
        scope: 'survives is null: failing to hold on is not modelled as death; feasible = the design can hold its weight on a vertical surface. Only suction adhesion from a structure present in the design is modelled. Friction of fins or body, wriggling up wet surfaces, and powered leaps are not modelled, so "no grip" means no modelled mechanism, not proof the animal cannot get up any slope.',
        validity: { inRange: true, notes: 'nothing to model' },
      };
    }
    const area = params.disc_area_m2 ?? stateArea ?? partArea ?? null;
    const aKind = params.disc_area_m2 != null ? 'assumed' : stateArea != null ? (state.adhesive_disc_area_m2.kind || 'assumed') : 'derived';
    if (area == null) {
      const reason = `an adhesive part is present (${found.map(f => f[0]).join(', ')}) but its area is unknown; set disc_area_m2`;
      return { metrics: [met('has_gripping_structure', true, 'derived', 'STATE.parts'), ...METRICS.slice(1).map(m => nul(m.key, reason))],
        survives: null, feasible: null, limiting: reason, provenance: [], scope: 'Force needs an area; none is invented.', validity: { inRange: false, notes: reason } };
    }
    const pAmb = amb(state, 'pressure_kPa') ?? 101.325;
    if (amb(state, 'pressure_kPa') == null) P('ambient pressure', 101.325, 'assumed', 'standard sea-level pressure');
    const sigma = Math.min(params.adhesive_stress_kPa, pAmb);
    if (params.adhesive_stress_kPa > pAmb) notes.push(`stress capped at ambient pressure ${r3(pAmb)} kPa (suction cannot exceed it; cavitation limits it near 100 kPa at sea level, Ditsche & Summers 2019).`);
    const F = sigma * 1000 * area; const W = M * G;
    const SF = F / W; const SFmax = pAmb * 1000 * area / W;
    P('disc area', area, aKind, params.disc_area_m2 != null ? 'user parameter' : 'STATE');
    P('suction stress', sigma, 'borrowed', SRC.wainwright2013 + '; ' + SRC.ditsche2019);
    if (params.surface_Ra_um > 269) { inRange = false; notes.push(`surface Ra ${params.surface_Ra_um} µm beyond the 269 µm tested in clingfish; large clingfish attach to 500-1000 µm grain (Ditsche & Summers 2019).`); }
    if (params.adhesive_stress_kPa > 50) notes.push('stress above the 20-50 kPa measured in clingfish.');
    const ok = SF >= 1;
    let climb = null, climbReason = null;
    if (!ok) climbReason = 'cannot hold its own weight on a vertical surface';
    else if (SL == null) climbReason = 'SL_m is null';
    else { climb = 0.10 * SL; P('net climbing speed', 0.10, 'borrowed', 'climbing gobies: "five showed net climbing speeds between 0.10 and 0.14 BL s-1" (juveniles; Blob 2019); adults 0.037-0.13 BL/s (Schoenfuss 2026); lower end used; ' + SRC.blob2019); }
    return {
      metrics: [
        met('has_gripping_structure', true, 'derived', found.length ? `STATE.parts: ${found.map(f => f[0]).join(', ')}` : 'area given'),
        met('adhesive_force_N', r3(F), 'derived', `F = sigma x A = ${r3(sigma)} kPa x ${area} m^2`),
        met('safety_factor_body_weights', r3(SF), 'derived', 'F / (m g), full weight (out of water, conservative)'),
        met('ceiling_safety_factor', r3(SFmax), 'derived', 'p_ambient x A / (m g): physical maximum (Wainwright 2013: measured stresses "are 20-50% of the maximum suction adhesion that is possible at atmospheric pressure (approx. 101 kPa)")'),
        climb == null ? nul('net_climbing_speed_m_s', climbReason) : met('net_climbing_speed_m_s', r3(climb), 'borrowed', 'goby net climbing 0.10 BL/s x SL (Blob 2019)'),
      ],
      survives: null, feasible: ok,
      limiting: ok ? `adhesion holds ${r3(SF)} body weights` : `adhesion holds only ${r3(SF)} body weights (< 1)`,
      provenance: prov,
      scope: 'survives is null (not a survival test); feasible = adhesion holds at least one body weight. Static suction adhesion on a vertical surface. No peeling or shear failure, no water flow loading (flow raised the goby safety factor 51% in one study), no fatigue, no muscle cost of re-attachment, no mucus/biofilm effects (biofilm cut clingfish tenacity by up to ~25%). The climbing speed is a goby number, valid only for goby-style inching.',
      validity: { inRange, notes: notes.join(' ') || 'within clingfish-measured stresses and roughness' },
    };
  },

  modelCard: {
    equations: [
      'sigma_eff = min(sigma, p_ambient)',
      'F = sigma_eff x A_disc;   SF = F / (m g);   ceiling SF = p_ambient A_disc / (m g)',
      'feasible (holds on a vertical surface) = SF >= 1;  survives = null (not a survival test)',
      'net climbing speed = 0.10 BL/s x SL (goby, only if SF >= 1)',
      'no gripping part -> all forces null, feasible = false',
    ],
    sources: [
      { cite: 'Wainwright et al. 2013, Biol Lett 9:20130234 (clingfish 20-50 kPa; 80-230 x BW; disc 3.9-12.3 cm^2; 8.2-42 g)', doi_or_url: 'https://doi.org/10.1098/rsbl.2013.0234' },
      { cite: 'Ditsche & Summers 2019, Phil Trans R Soc B 374:20190204 (30-40 kPa; cavitation ~100 kPa)', doi_or_url: 'https://doi.org/10.1098/rstb.2019.0204' },
      { cite: 'Schoenfuss et al. 2026, Integr Org Biol 8:obag044 (goby pelvic suction 0.63-1.5 kPa; adult climbing speeds)', doi_or_url: 'https://doi.org/10.1093/iob/obag044' },
      { cite: 'Blob et al. 2019, Integr Org Biol 1:obz029 (juvenile goby net climbing 0.10-0.14 BL/s)', doi_or_url: 'https://doi.org/10.1093/iob/obz029' },
      { cite: 'McFarland et al. 2026, Sci Adv 12:eaeh7851 (pelvic suction cup evolved three times)', doi_or_url: 'https://doi.org/10.1126/sciadv.aeh7851' },
    ],
    validity: 'Suction discs with clingfish-like sealing on surfaces up to Ra 269 µm, sea-level to shallow water. Goby-type suckers need adhesive_stress_kPa about 1.5.',
    validatedAgainst: [
      { organism: 'Gobiesox maeandricus (northern clingfish)', observation: 'adhesive force as multiples of body weight', predicted: '60-242 body weights from 20-50 kPa x 3.9-12.3 cm^2 over 8.2-42 g (extreme pairings)', measured: '"80 to 230 times body weight"', source: 'doi:10.1098/rsbl.2013.0234 — consistent, but close to an identity: the paper computed stress from the same forces and areas, so this checks the arithmetic, not the physics' },
      { organism: 'climbing gobies (Sicyopterus stimpsoni etc.)', observation: 'safety factor', predicted: 'not computable: no disc area or mass paired with the 1.5 kPa suction in fetched text', measured: 'absolute safety factor not found', source: 'doi:10.1093/iob/obag044 — no validation' },
    ],
  },
};
