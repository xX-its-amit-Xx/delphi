#!/usr/bin/env node
// Writes lean/registry/proposals/<law_id>/meta.json for the laws of lean/Delphi/Perturb.lean (the perturbation
// thread's module; read here, never edited) and runs each through propose.mjs --write. They enter as
// 'candidate' (they were not in force when lawset 1.0.0 was bootstrapped); acceptance needs a human approval.
//   node lean/registry/perturb-metas.mjs [--no-run]
import fs from 'node:fs';
import path from 'node:path';
import { REG, ROOT, readJson, writeJson } from './registry-lib.mjs';
import { propose } from './propose.mjs';

const PS = readJson(path.join(ROOT, 'lean/perturb-sources.json'));
const src = ids => ids.map(k => { const v = PS.sources[k]; return v ? `${v.authors || ''} ${v.year || ''}, ${v.title || ''} (PMID ${v.pmid}${v.doi ? ', doi:' + v.doi : ''}); lean/perturb-sources.json#${k}` : `lean/perturb-sources.json#${k}`; });
const W = 'Delphi.Perturb.perturb_nonvacuous';
const LAWS = [
  { law_id: 'perturb-thermal', kind: 'biological', theorem: 'Delphi.Perturb.thermal_rules_out', constraints: ['P1', 'P1b'], srcs: ['schulte2015', 'rome1992b', 'romeswank1992', 'morgan2018'],
    statement_en: 'Under the thermal-performance hypothesis (sustained power zero outside [CTmin, CTmax], and at most P_ref Q10^((T - T_ref)/10) inside), no positive sustained power is possible outside the thermal window, and sustained power never exceeds the Q10 bound.',
    taxa: ['Teleostei'], basis: 'thermal performance curves of ectotherms (Schulte 2015); Q10 values from teleost red muscle (scup, carp; Rome 1992). CTmin, CTmax, Q10 and P_ref are design inputs.' },
  { law_id: 'perturb-current', kind: 'biological', theorem: 'Delphi.Perturb.no_station_above_ucrit', constraints: ['P2', 'P2b'], srcs: ['plaut2001', 'rome1992a'],
    statement_en: 'Under the swim-limit hypothesis (sustained swimming at most U_crit; drag power rho C_d A U^3 / 2 paid aerobically), no design holds station in a current faster than U_crit, or in one whose drag power exceeds its aerobic ceiling eta E Q Ca.',
    taxa: ['Teleostei'], basis: 'critical swimming speed protocol for fishes (Plaut 2001); scup red-muscle top speed (Rome 1992)' },
  { law_id: 'perturb-pressure', kind: 'physical', theorem: 'Delphi.Perturb.closed_bladder_rules_out', constraints: ['P3'], srcs: ['yancey2020', 'kerr2023'],
    statement_en: 'Boyle\'s law for a closed swim bladder at fixed temperature with hydrostatic pressure p0 + k d: the volume at depth d is V0 p0 / P(d), so a closed bladder claiming more volume at depth is ruled out (quasi-static only).',
    taxa: ['any'], basis: 'gas physics (Boyle) with 1 atm per 10 m of seawater (Yancey 2020); quasi-static only: fails for rapid decompression (Kerr 2023)' },
  { law_id: 'perturb-depth-cap', kind: 'biological', theorem: 'Delphi.Perturb.no_teleost_below', constraints: ['P3b'], srcs: ['yancey2014', 'yancey2020'],
    statement_en: 'Under the osmolyte hypothesis (teleost internal osmolality rises linearly with depth via TMAO and cannot exceed seawater), no teleost lives deeper than the isosmotic depth, at most 8200 m.',
    taxa: ['Teleostei'], basis: 'TMAO-depth relation in marine teleosts (Yancey et al. 2014); not for elasmobranchs or invertebrates' },
  { law_id: 'perturb-isa-vmin', kind: 'physical', theorem: 'Delphi.Perturb.vmin_isa_mono', constraints: ['P4'], srcs: ['narayanan2022'],
    statement_en: 'In the ISA troposphere air density falls with height, and the minimum flight speed sqrt(2W/(rho S C_Lmax)) rises with height (v_min proportional to 1/sqrt(rho)).',
    taxa: ['any'], basis: 'standard atmosphere (Narayanan and Osechas 2022); troposphere only (h < T0/beta)' },
  { law_id: 'perturb-wind-glide', kind: 'physical', theorem: 'Delphi.Perturb.wind_glide_rules_out', constraints: ['P4b'], srcs: [], witness: 'Delphi.Registry.windGlide_model_witness', witness_file: 'lean/registry/lean/Witnesses.lean',
    statement_en: 'A steady glide from height h in an along-track wind w (positive tailwind) covers at most h (L/D)max (1 + w/u) over the ground; a longer claimed ground range is ruled out.',
    taxa: ['any'], basis: 'pure kinematics; no source needed' },
  { law_id: 'perturb-energy-balance', kind: 'biological', theorem: 'Delphi.Perturb.energy_rules_out', constraints: ['P5'], srcs: ['bihun2024', 'mcleodclark2016', 'secor2009'],
    statement_en: 'Under daily energy conservation eps dm = a I - (R + Act + s a I) with SDA coefficient s, a design that does not take in at least (R + Act) / (a (1 - s)) loses mass; a claim to hold or gain mass on less is ruled out.',
    taxa: ['Teleostei'], basis: 'SDA coefficients from walleye (Bihun 2024) and larval clownfish (McLeod and Clark 2016); energy conservation itself is general' },
];

export function metas() {
  return LAWS.map(l => ({
    law_id: l.law_id, kind: l.kind, class: 'theorem-from-hypothesis', statement_en: l.statement_en,
    lean: l.witness ? { theorem: l.theorem, witness: l.witness, witness_file: l.witness_file } : { theorem: l.theorem, witness: W },
    hypotheses: [{ name: 'see theorem statement', statement: 'the named hypothesis structure(s) in the theorem statement; instantiated with fetched numbers in Delphi.Perturb.measured' }],
    scope: { taxa: l.taxa, life_stages: [], ranges: {}, basis: l.basis },
    evidence: { sources: src(l.srcs), observations: [] }, sources: src(l.srcs), constraints: l.constraints,
    origin: { by_role: 'perturbation-thread', kind: 'agent', from: 'lean/Delphi/Perturb.lean (registered by the registry thread)' },
  }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(REG, 'perturb-metas.mjs')) {
  const file = path.join(ROOT, 'lean/Delphi/Perturb.lean');
  for (const m of metas()) {
    writeJson(path.join(REG, 'proposals', m.law_id, 'meta.json'), m);
    if (process.argv.includes('--no-run')) continue;
    const r = await propose(file, m, { write: true });
    console.log(m.law_id, r.status, JSON.stringify(r.reasons), 'mutants', (r.steps.mutants.results || []).map(x => x.rejected ? 'R' : 'S').join(''));
  }
}
