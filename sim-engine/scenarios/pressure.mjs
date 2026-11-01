// pressure.mjs: hydrostatic pressure at depth. Swim-bladder gas compression (Boyle's law) and the buoyancy
// lost by it, and the marine-teleost depth ceiling set by the piezolyte TMAO and internal osmolality
// (Yancey et al. 2014). Pure ESM. Every constant fetched 2026-10-31 (modelCard.sources). No bird data.

// Yancey et al. 2014 PNAS (abstract, NCBI PMC record): muscle TMAO 40 -> 261 mmol/kg from 0 to 4,850 m in teleosts;
// hadal snailfish Notoliparis kermadecensis at 7,000 m: TMAO 386 +/- 18 mmol/kg, osmolality 991 +/- 22 mOsmol/kg;
// shallow species typically 350 mOsmol/kg; sea water 1,100 mOsmol/kg; isosmotic (extrapolated) at ~8,200 m.
const Y = { tmao0: 40, tmao4850: 261, osm0: 350, osm7000: 991, osmSea: 1100,
  cite: 'Yancey PH, Gerringer ME, Drazen JC, Rowden AA, Jamieson A (2014). Marine fish may be biochemically constrained from inhabiting the deepest ocean depths. PNAS 111:4461-4465 (abstract)',
  doi: 'https://doi.org/10.1073/pnas.1322003111' };
const TMAO_SLOPE = (Y.tmao4850 - Y.tmao0) / 4850; // mmol/kg per m
const OSM_SLOPE = (Y.osm7000 - Y.osm0) / 7000;   // mOsmol/kg per m
export const DEPTH_LIMIT_M = (Y.osmSea - Y.osm0) / OSM_SLOPE; // 8,190 m

// Lauridsen et al. 2022 (BMC Biol), Discussion: "most teleost fishes in the neritic zone possess a swim bladder of
// up to 5% of total body volume ... average fish tissue ... is 5% denser than seawater" (both quoted from their refs).
const LAUR = { cite: 'Lauridsen H et al. (2022). Buoyancy and hydrostatic balance in a West Indian Ocean coelacanth Latimeria chalumnae. BMC Biol 20:180', doi: 'https://doi.org/10.1186/s12915-022-01354-8', tissueOverSea: 1.05 };
const SEAWATER = 1025; // kg/m3, dashboard/public/t/physics/sim/params.json rho_water (standard)

const val = (s, k) => (s && s[k] && s[k].value != null ? s[k].value : null);
function metric(key, label, value, unit, better, kind, source, reason) {
  const ok = typeof value === 'number' ? Number.isFinite(value) : typeof value === 'boolean';
  const m = { key, label, value: ok ? value : null, unit, better, kind: ok ? kind : 'assumed', source: ok ? source : 'none' };
  if (!ok) m.reason = reason || 'not computable from the inputs given';
  return m;
}

const METRICS = [
  { key: 'pressure_kPa', label: 'Absolute hydrostatic pressure', unit: 'kPa', better: null },
  { key: 'gas_volume_fraction_of_surface', label: 'Swim-bladder gas volume relative to the surface (no secretion)', unit: '1', better: 'higher' },
  { key: 'body_density_at_depth_kg_m3', label: 'Whole-body density at depth (bladder sized for neutral buoyancy at the surface)', unit: 'kg/m3', better: null },
  { key: 'negative_buoyancy_fraction', label: 'Net sinking force as a fraction of body weight', unit: '1', better: 'lower' },
  { key: 'tmao_required_mmol_kg', label: 'Muscle TMAO of marine teleosts at this depth (trend)', unit: 'mmol/kg', better: null },
  { key: 'osmolality_predicted_mOsm_kg', label: 'Internal osmolality of marine teleosts at this depth (trend)', unit: 'mOsm/kg', better: null },
  { key: 'depth_limit_margin_m', label: 'Distance above the predicted teleost depth ceiling', unit: 'm', better: 'higher' },
];

export const needs = [{ field: 'swimbladder_volume_fraction', why: 'gas volume / body volume at the surface. Absent, it is derived from neutral buoyancy with fish tissue 5% denser than sea water (Lauridsen 2022, second-hand).' }];

export default {
  key: 'pressure',
  title: 'Depth and hydrostatic pressure: swim-bladder compression and the piezolyte depth ceiling',
  group: 'environment',
  params: [
    { key: 'depth_m', label: 'Depth below the surface', unit: 'm', default: 10, min: 0, max: 11000, kind: 'assumed', source: 'design input; 11,000 m is the deepest ocean' },
  ],
  requires: ['has_swimbladder'],
  metrics: METRICS,
  needs,
  run(state, params = {}) {
    const z = params.depth_m ?? 10;
    const amb = (state && state.ambient) || {};
    const sal = amb.salinity_psu && amb.salinity_psu.value != null ? amb.salinity_psu.value : 35;
    const marine = sal > 5;
    const rhoW = amb.water_density_kg_m3 && amb.water_density_kg_m3.value != null ? amb.water_density_kg_m3.value : amb.water_density && amb.water_density.value != null ? amb.water_density.value : marine ? SEAWATER : 998.2; // fresh water 998.21 kg/m3 at 20 degC, NIST WebBook (see current.mjs NIST table)
    const P0 = 101.325;
    const P = P0 + (rhoW * 9.80665 * z) / 1000;
    const notes = [];
    let inRange = true;
    const prov = [
      { quantity: 'water density (kg/m3)', value: rhoW, kind: 'assumed', source: amb.water_density_kg_m3 ? amb.water_density_kg_m3.source || 'state.ambient' : marine ? 'sea water 1025 (standard; params.json rho_water)' : 'fresh water 998.2 at 20 degC (NIST WebBook)' },
      { quantity: 'surface pressure (kPa)', value: P0, kind: 'assumed', source: 'standard sea-level atmosphere' },
      { quantity: 'TMAO 0 / 4850 m (mmol/kg)', value: '40 / 261', kind: 'measured-secondhand', source: `${Y.cite}, ${Y.doi}: abstract summary of earlier teleost data` },
      { quantity: 'osmolality shallow / 7000 m / sea water (mOsm/kg)', value: '350 / 991 / 1100', kind: 'measured', source: `${Y.cite}, ${Y.doi}` },
    ];
    // Swim bladder
    const hasSB = val(state, 'has_swimbladder');
    const ratio = P0 / P;
    let gasFrac = null, rhoZ = null, sink = null, sbReason = null;
    if (hasSB !== true) sbReason = hasSB === false ? 'no swim bladder in this design' : 'has_swimbladder unknown';
    else {
      const rhoT = LAUR.tissueOverSea * SEAWATER; // tissue density, kg/m3
      let phi0, phiKind, phiSrc;
      const given = val(state, 'swimbladder_volume_fraction');
      if (given != null) { phi0 = given; phiKind = state.swimbladder_volume_fraction.kind || 'assumed'; phiSrc = state.swimbladder_volume_fraction.source || 'state'; }
      else if (val(state, 'body_density_kg_m3') != null) { phi0 = 1 - val(state, 'body_density_kg_m3') / rhoT; phiKind = 'derived'; phiSrc = 'from state body density and tissue density 1.05 x 1025 kg/m3'; }
      else { phi0 = 1 - rhoW / rhoT; phiKind = 'derived'; phiSrc = `neutral buoyancy at the surface in water of ${rhoW} kg/m3 with tissue density 1.05 x 1025 kg/m3 (Lauridsen 2022, second-hand)`; }
      prov.push({ quantity: 'tissue density (kg/m3)', value: rhoT, kind: 'measured-secondhand', source: `${LAUR.cite}, ${LAUR.doi}: "average fish tissue ... is 5% denser than seawater" (quoting their ref. 70)` });
      prov.push({ quantity: 'swim-bladder gas fraction at the surface', value: phi0, kind: phiKind, source: phiSrc });
      if (phi0 > 0.08 || phi0 < 0) notes.push(`Surface gas fraction ${phi0.toFixed(3)} is outside 0-0.08 (marine teleosts: up to 5% of body volume, Lauridsen 2022).`);
      gasFrac = ratio;
      rhoZ = (rhoT * (1 - phi0)) / (1 - phi0 + phi0 * ratio);
      sink = (rhoZ - rhoW) / rhoZ;
    }
    // Piezolyte trend (marine teleosts)
    const tmao = Y.tmao0 + TMAO_SLOPE * z;
    const osm = Y.osm0 + OSM_SLOPE * z;
    if (z > 7000) { inRange = false; notes.push('Below 7,000 m the TMAO and osmolality trends are extrapolated past the deepest measurement.'); }
    if (!marine) notes.push('Freshwater animal: the TMAO/osmolality ceiling was derived for MARINE teleosts (isosmotic with sea water at ~8,200 m); it does not set a limit for a freshwater fish, and no pressure-tolerance data for zebrafish were found.');
    notes.push('Boyle\'s law at constant temperature with no gas secretion or resorption: the immediate effect of a depth change. Real fish restore bladder volume over time (gas secretion, or gulping air at the surface), which is not modelled.');
    let survives = null, limiting = null, feasibilityNote = null;
    if (marine && z > DEPTH_LIMIT_M) { survives = false; limiting = `below the predicted teleost ceiling (${DEPTH_LIMIT_M.toFixed(0)} m): internal osmolality would exceed sea water's`; }
    if (sink != null && sink > 0.02) feasibilityNote = `not a survival limit: swim-bladder gas compressed to ${(ratio * 100).toFixed(0)}% of its surface volume: sinking force ${(sink * 100).toFixed(1)}% of body weight must be met by swimming lift`;
    const metrics = [
      metric('pressure_kPa', METRICS[0].label, P, 'kPa', null, 'derived', 'P0 + rho g z'),
      metric('gas_volume_fraction_of_surface', METRICS[1].label, gasFrac, '1', 'higher', 'derived', "Boyle's law V/V0 = P0/P (isothermal)", sbReason),
      metric('body_density_at_depth_kg_m3', METRICS[2].label, rhoZ, 'kg/m3', null, 'derived', 'rho_t (1 - phi0) / (1 - phi0 + phi0 P0/P)', sbReason),
      metric('negative_buoyancy_fraction', METRICS[3].label, sink, '1', 'lower', 'derived', '(rho_body(z) - rho_w) / rho_body(z)', sbReason),
      metric('tmao_required_mmol_kg', METRICS[4].label, tmao, 'mmol/kg', null, 'derived', `linear through 40 (0 m) and 261 (4,850 m) mmol/kg (${Y.cite}); a marine-teleost trend, not this animal`),
      metric('osmolality_predicted_mOsm_kg', METRICS[5].label, osm, 'mOsm/kg', null, 'derived', `linear through 350 (shallow) and 991 (7,000 m) mOsm/kg (${Y.cite})`),
      metric('depth_limit_margin_m', METRICS[6].label, DEPTH_LIMIT_M - z, 'm', 'higher', 'derived', `predicted ceiling ${DEPTH_LIMIT_M.toFixed(0)} m where the osmolality line meets sea water (1,100 mOsm/kg); Yancey 2014 states ~8,200 m. Marine teleosts only`),
    ];
    return {
      metrics, survives, feasible: null, feasibility_note: feasibilityNote, limiting, provenance: prov,
      scope: 'Hydrostatics, Boyle compression of swim-bladder gas, and a marine-teleost biochemical trend. Says nothing about the depth tolerance of zebrafish or flying fish specifically (no data found), about light, temperature, food or oxygen at depth, or about how fast a fish can change depth. survives is false only below the marine-teleost ceiling; otherwise null (unknown), never true.',
      validity: { inRange, notes: notes.join(' ') },
    };
  },
  modelCard: {
    equations: [
      'P(z) = P0 + rho_w g z',
      'V_gas(z)/V_gas(0) = P0/P(z) (Boyle, isothermal, no secretion)',
      'phi0 = 1 - rho_w/rho_t (bladder sized for neutral buoyancy at the surface), rho_t = 1.05 x 1025 kg/m3',
      'rho_body(z) = rho_t (1 - phi0) / (1 - phi0 + phi0 P0/P(z)); sinking fraction = (rho_body - rho_w)/rho_body',
      'TMAO(z) = 40 + 0.04557 z mmol/kg; osmolality(z) = 350 + 0.09157 z mOsm/kg',
      'ceiling: osmolality(z) = 1100 mOsm/kg  =>  z = 8,190 m',
    ],
    sources: [
      { cite: Y.cite, doi_or_url: Y.doi },
      { cite: LAUR.cite, doi_or_url: LAUR.doi },
      { cite: 'Jamieson AJ, Swanborn DJB, Bond T et al. (2026). Faunal biodiversity of the lower abyssal and hadal zones of the Japan, Ryukyu and Izu-Ogasawara trenches (NW Pacific Ocean). Biodiversity Data Journal 14:e182172 (deepest recorded fish, 8,336 m)', doi_or_url: 'https://doi.org/10.3897/BDJ.14.e182172' },
    ],
    validity: 'Depth 0-7,000 m for the TMAO and osmolality trends (deeper is extrapolation, inRange false). The ceiling applies to marine teleosts. Boyle compression is exact physics for the gas but ignores gas secretion and the bladder wall.',
    validatedAgainst: [
      { organism: 'Notoliparis kermadecensis (hadal snailfish), 7,000 m', observation: 'muscle TMAO', predicted: '359 mmol/kg (line fitted only to 0-4,850 m teleost data, extrapolated 2,150 m)', measured: '386 ± 18 mmol/kg (n = 5)', source: `${Y.doi}. PASS within 1.5 SD (-7%); the 7,000 m osmolality point IS used to set the ceiling, so the ceiling itself is not independently tested by it` },
      { organism: 'Pseudoliparis sp. indet. 1 (snailfish), Izu-Ogasawara Trench', observation: 'deepest recorded fish, 8,336 m (Jamieson et al. 2023b, as stated in Jamieson et al. 2026)', predicted: 'no teleost below 8,190 m', measured: 'a fish at 8,336 m', source: 'https://doi.org/10.3897/BDJ.14.e182172 (measured-secondhand). FAIL as a hard limit by 146 m (1.8%); consistent as an approximate ceiling, and with no fish recorded at 8,400-11,000 m (Yancey 2014 abstract)' },
    ],
  },
};
