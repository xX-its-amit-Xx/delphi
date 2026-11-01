#!/usr/bin/env node
// The empirical hypothesis layer, as a machine-readable record:
//   node lean/empirical/build-empirical.mjs -> lean/empirical.json
// One entry per observation: the Lean proposition that carries it, the observation itself, the source and
// value, the taxa measured, the scope, the constraint ids that depend on it, and status "empirical" -
// distinct from "proved", so a reader can reject an entry and recompute the ledger without it.
// Every number here is read from the file that holds it, never typed in twice; the module
// lean/Delphi/Empirical.lean states the same numbers in Lean and the two are checked against each other.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const J = p => JSON.parse(read(p));
const sha = p => crypto.createHash('sha256').update(read(p)).digest('hex').slice(0, 16);
const lean = read('lean/Delphi/Empirical.lean');
// Pull the numbers the Lean module commits, so a drift between file and module is visible.
const leanNum = (re) => { const m = lean.match(re); return m ? Number(m[1]) : null; };

// --- E1: within-species allometry (Davenport 1992) ---
const allo = J('physics/allometry.json');
const entryOf = re => (allo.entries || []).find(e => re.test(e.quantity || '')) || null;
const expOf = re => { const e = entryOf(re); return e ? e.exponent : null; };
const E1 = { area: expOf(/fin area vs standard length/i), loading: expOf(/wing loading vs standard length/i), mass: expOf(/body mass vs standard length/i),
  species: (entryOf(/fin area vs standard length/i) || {}).species || null,
  entries: (allo.entries || []).filter(e => /vs standard length/i.test(e.quantity || '')).map(e => ({ quantity: e.quantity, exponent: e.exponent, species: e.species, source_id: e.source_id, locator: e.locator, note: e.note })) };
for (const [k, v] of Object.entries({ area: E1.area, loading: E1.loading, mass: E1.mass })) if (typeof v !== 'number') throw new Error('E1: no exponent read from physics/allometry.json for ' + k);

// --- E2: fitted mass exponents (physics/length-weight.csv) ---
const csv = read('physics/length-weight.csv').split(/\r?\n/).filter(Boolean);
const head = csv[0].replace(/^﻿/, '').split(',');
const parseRow = l => { const c = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { c.push(cur); cur = ''; } else cur += ch; } c.push(cur); return Object.fromEntries(head.map((h, i) => [h, c[i] ?? ''])); };
const rows = csv.slice(1).map(parseRow);
const fitted = rows.filter(r => /fitted study/.test(r.note || ''));
const male = fitted.filter(r => /male/.test(r.sex || '') && !/female/.test(r.sex || ''));
const kept = fitted.filter(r => !male.includes(r));
const bs = kept.map(r => Number(r.b));
const E2 = { rows: kept.map(r => ({ species: r.species, sex: r.sex, b: Number(r.b), n: r.n, lengthType: r.length_type, locality: r.locality })), min: Math.min(...bs), max: Math.max(...bs), species: [...new Set(kept.map(r => r.species))].length,
  excluded: male.map(r => ({ species: r.species, sex: r.sex, b: Number(r.b), n: r.n, why: 'a male-only fit far below every other row; named here rather than silently dropped' })) };

// --- E3: the measured teleost aerobic ranges (physiology/) ---
const chain = J('lean/eliminate/physiology-candidates.json').chain_inputs;
const cardiac = read('physiology/cardiac.js'), muscle = read('physiology/muscle.js'), hb = read('physiology/haemoglobin.js');
const grab = (text, re) => { const m = text.match(re); return m ? m[0].replace(/\s+/g, ' ').slice(0, 300) : null; };
const E3 = {
  bounds: { eta: leanNum(/eta_le : eta ≤ ([0-9.]+)/), oxycaloric_J_per_ml: leanNum(/oxy_le : oxycaloric ≤ ([0-9.]+)/), cardiacOutput_ml_per_s: leanNum(/q_le : cardiacOutput ≤ ([0-9.]+)/), arterialO2_ml_per_ml: leanNum(/ca_le : arterialO2 ≤ ([0-9.]+)/) },
  ceiling_W: leanNum(/aerobicCeiling_le[\s\S]*?≤ ([0-9.]+) := by/),
  from: { efficiency: grab(muscle, /efficiency: \{[^}]*\}/), oxycaloric: grab(muscle, /oxycalorific_J_per_mgO2: \{[^}]*\}/), cardiacRange: grab(cardiac, /Q_range_ml_min_kg: \{[^}]*\}/), haemoglobinCapacity: grab(hb, /cap_ml_per_ml: \{[^}]*\}/) },
  massUsed_kg: 0.06, chainValues: Object.fromEntries(Object.entries(chain).map(([k, v]) => [k, v.value])) };

// --- E5: the measured fin-ratio range (Daane 2021) ---
const fr = J('genotype/cache/daane2021_fin_ratios.json');
const ff = fr.groups['flying fish'];

// --- E7: lethality before the scoring stage (genotype/interventions.json) ---
const iv = J('genotype/interventions.json').interventions;
const lethalStated = iv.filter(i => typeof i.lethality === 'string' && /^LETHAL/.test(i.lethality));
const E7 = { evaluated: [
    { id: 'ezh2-loss-MZ-fin', gene: 'ezh2', parameter: (iv.find(i => i.id === 'ezh2-loss-MZ-fin') || {}).parameter, death_hpf: 48, scored_hpf: 48, quote: (iv.find(i => i.id === 'ezh2-loss-MZ-fin') || {}).lethality },
    { id: 'wls-c186-pectoral-fin-small', gene: 'wls', parameter: 'lepidotrichium (ray) length, segment and branching', death_hpf: 288, scored_hpf: 1080, quote: (iv.find(i => i.id === 'wls-c186-pectoral-fin-small') || {}).lethality,
      conversion: 'death "by approximately 12 dpf" = 288 h; the ray parameters exist only from Juvenile:Days 45-89, taken as 45 dpf = 1080 h' }],
  statedLethalButNotEvaluated: lethalStated.filter(i => !['ezh2-loss-MZ-fin', 'wls-c186-pectoral-fin-small'].includes(i.id)).map(i => i.id),
  notEvaluated: { count: iv.length - 2, why: 'the genotype thread records lethality as free text (58 rows say "not reported"); only rows that state BOTH a time of death and a scoring stage in hours are instantiated here, and no time is parsed out of prose beyond those two' } };


// The Lean module states these numbers too (in `measured`). Check the two against each other, so the
// header's claim that they agree is tested rather than asserted; a drift fails the build loudly.
const leanField = (re) => { const x = lean.match(re); return x ? Number(x[1]) : null; };
const leanAgrees = [
  ['E1 area exponent', E1.area, leanField(/areaExponent := ([0-9.]+)/)],
  ['E1 wing loading exponent', E1.loading, leanField(/wingLoadingExponent := ([0-9.]+)/)],
  ['E1 mass exponent', E1.mass, leanField(/massExponent := ([0-9.]+)/)],
  ['E5 fin ratio median', ff.pectoral_over_SL_median, leanField(/finRatio := \u27e8([0-9.]+)/)],
  ['E5 fin ratio lower bound', ff.pectoral_over_SL_min, leanField(/measuredFinRatio \(r : \u211d\) : Prop := ([0-9.]+)/)],
  ['E7 ezh2 death hour', E7.evaluated[0].death_hpf, leanField(/ezh2_cannot_be_scored : \u00ac CanScore ([0-9]+)/)],
  ['E7 wls death hour', E7.evaluated[1].death_hpf, leanField(/wls_rays_cannot_be_scored : \u00ac CanScore ([0-9]+)/)]
];
const drift = leanAgrees.filter(([, a, b]) => b === null || Math.abs(a - b) > 1e-9);
if (drift.length) throw new Error('lean/Delphi/Empirical.lean disagrees with the data files: ' + drift.map(([k, a, b]) => `${k}: file ${a}, module ${b}`).join('; '));

const entries = [
  { id: 'E1', status: 'empirical', title: 'Isometry fails within a species',
    lean: { structure: 'Delphi.Empirical.WithinSpeciesAllometry', theorems: ['Delphi.Empirical.not_isometric_area', 'Delphi.Empirical.loading_rises'] },
    statement: 'areaExponent < 2 and 1 < wingLoadingExponent, with the mass exponent in [2.90, 3.02].',
    observation: `Within one species, pectoral fin area grows as SL^${E1.area} and wing loading as SL^${E1.loading} (mass as SL^${E1.mass}): fin area falls behind the isometric square and wing loading outruns the isometric first power, so a bigger fish of the same species is more heavily loaded than isometry predicts.`,
    source: 'physics/allometry.json (Davenport 1992, as the physics thread recorded it)', value: E1,
    taxa: `${E1.species}, one species, within-species regressions (the exponents are the three 'vs standard length' entries of the file)`,
    scope: 'Three separate regressions, no confidence intervals, and NOT mutually consistent: 2.981 - 1.834 = 1.147 against the fitted 1.236. That inconsistency is why C13 needs intervals, and it is the reason nine audit rows read "violated" rather than a defect of those theorems.',
    constraints: [], usedBy: 'the flying-fish audit (lean/AUDIT-FLYING-FISH.md): the rows whose isometry hypotheses this observation contradicts',
    rejectable: 'Reject it and the audit rows that read "violated" become "cannot evaluate"; nothing proved elsewhere changes.' },
  { id: 'E2', status: 'empirical', title: 'The fitted mass exponent lies in [2.90, 3.02]',
    lean: { structure: 'Delphi.Empirical.MassExponentBand', theorems: ['Delphi.Empirical.weight_ratio_band', 'Delphi.Empirical.weight_ratio_rules_out'] },
    statement: '2.90 <= b <= 3.02; hence for a weight following one power law, r^2.90 <= W(L2)/W(L1) <= r^3.02 when r = L2/L1 >= 1.',
    observation: `The ${E2.rows.length} fitted field length-weight studies of ${E2.species} flying-fish species in the project's own table give exponents from ${E2.min} to ${E2.max}.`,
    source: 'physics/length-weight.csv (FishBase length-weight list page, rows with a locality and n)', value: E2,
    taxa: E2.rows.map(r => r.species + (r.sex && r.sex !== 'unsexed' ? ' (' + r.sex + ')' : '')).join('; '),
    scope: `The ${E2.excluded.length} male-only row (Hirundichthys affinis, b = ${E2.excluded.map(r => r.b).join(', ')}) is EXCLUDED and named: including it would widen the band to 2.21. Length types differ across rows (SL, FL, TL) and the FishBase page does not show the references. Eighteen further rows with b exactly 3.000 and n of 2 to 6 are unverified estimates and are not used.`,
    constraints: ['E2'], rejectable: 'Reject it and a scaled design\'s weight is unconstrained by the record; the exact cube law (C7b) still rules under isometry.' },
  { id: 'E3', status: 'empirical', title: 'Efficiency, cardiac output and arterial O2 lie in the measured teleost ranges',
    lean: { structure: 'Delphi.Empirical.TeleostAerobic', theorems: ['Delphi.Empirical.aerobicCeiling_le', 'Delphi.Empirical.no_aerobic_flight_above_ceiling', 'Delphi.Empirical.measured_ceiling_le'] },
    statement: `eta <= ${E3.bounds.eta}, oxycaloric <= ${E3.bounds.oxycaloric_J_per_ml} J/ml, cardiac output <= ${E3.bounds.cardiacOutput_ml_per_s} ml/s and arterial O2 <= ${E3.bounds.arterialO2_ml_per_ml} ml/ml imply an aerobic ceiling of at most ${E3.ceiling_W} W.`,
    observation: `No teleost in the ranges the physiology chain cites has a sustained aerobic ceiling above ${E3.ceiling_W} W at the measured mass (${E3.massUsed_kg} kg). This is what makes the C14 eliminations binding: they hold for every animal the measured record allows, not only for one choice of proxies.`,
    source: 'physiology/muscle.js (efficiency, oxycaloric), physiology/cardiac.js (cardiac output range), physiology/haemoglobin.js (blood O2 capacity), as cited in lean/eliminate/physiology-candidates.json', value: E3,
    taxa: 'Every value is a PROXY from another teleost: Salmo salar ventricular muscle (efficiency), Lutjanus apodus and Oncorhynchus mykiss (cardiac output), Oncorhynchus mykiss (blood O2). No Exocoetidae physiology exists in this project.',
    scope: `The bound is an upper bound at one mass, and the cardiac output ceiling is the maximum of a secondary range (20 to 75 ml/min/kg, gerry2014 Discussion). It bounds SUSTAINED AEROBIC power only: burst power on white-muscle stores is outside it, and that is what a flying fish is understood to use. Scaling it to another mass requires the cardiac output per kg, not this number.`,
    constraints: ['E3'], rejectable: 'Reject it and C14 still rules, but only on the particular proxies a candidate commits, not on every teleost.' },
  { id: 'E4', status: 'empirical', title: 'Gills do not ventilate in air',
    lean: { structure: 'Delphi.Empirical.NoAerialUptake', theorems: ['Delphi.Empirical.stored_power_le'] },
    statement: 'uptakeInAir = 0; hence over a flight of duration t the mean aerobic power is at most E S / t for an O2 store S.',
    observation: 'O2 uptake is zero while airborne, so airborne aerobic work is paid for out of the store carried into the air, and the airborne aerobic ceiling falls as the flight lengthens.',
    source: 'physiology/index.js (the chain sets uptake to zero in air) and its self-test, where the store drains', value: { uptakeInAir: 0 },
    taxa: 'A property of the gill as a water-breathing organ, not of a species; the chain applies it to its flying-fish model.',
    scope: 'Bounds the AEROBIC part only, and takes the store and the oxycaloric equivalent as inputs: neither is measured for Exocoetidae here. Cutaneous and buccal exchange in air are not modelled, and burst (anaerobic) power is outside it.',
    constraints: ['E4'], rejectable: 'Reject it and the airborne ceiling is whatever the circulation can deliver, i.e. C14 with no time limit.' },
  { id: 'E5', status: 'empirical (provenance, not impossibility)', title: 'The observed pectoral/SL range',
    lean: { definition: 'Delphi.Empirical.measuredFinRatio', theorems: ['Delphi.Empirical.finRatio_outside'] },
    statement: `0.406 <= pectoral/SL <= 0.823 for a measured specimen; a design outside the range is above or below it.`,
    observation: `Across ${ff.n_specimens} flying-fish specimens, pectoral fin length over standard length runs from ${ff.pectoral_over_SL_min} to ${ff.pectoral_over_SL_max}, median ${ff.pectoral_over_SL_median} (standard lengths ${ff.SL_cm_min} to ${ff.SL_cm_max} cm).`,
    source: `genotype/cache/daane2021_fin_ratios.json (Daane 2021 Data S1, sha256 ${sha('genotype/cache/daane2021_fin_ratios.json')})`, value: ff,
    taxa: 'Beloniform museum specimens: flying fish only in this entry (the file also records flying halfbeaks 0.175-0.388, halfbeaks 0.115-0.177, needlefish 0.071-0.106).',
    scope: 'A statement about the RECORD. A design outside the range is outside everything measured, which is weaker than impossible, and no theorem here says such a fish cannot exist. Preserved museum specimens, lengths only: no mass, no fin area, no glide data. It is deliberately NOT a constraint in the ledger, so that nothing is ever reported as eliminated by it; it is a flag in the Design Studio.',
    constraints: [], rejectable: 'Reject it and the Studio loses a provenance flag; no verdict anywhere changes.' },
  { id: 'E6', status: 'project convention (not an observation)', title: '"required for" is never propagated down part_of',
    lean: { definition: 'Delphi.Empirical.requiredForNotPropagatedB', theorems: ['Delphi.Empirical.requiredFor_not_propagated_of_check'] },
    statement: 'No row of the map whose link type is "required for" is derived by propagating a link down a part_of edge.',
    observation: 'Not an observation at all: a rule this project adopted for building the genotype map (the hub\'s idea-gp-propagation-rules). A gene required for a whole need not be required for each part.',
    source: 'the genotype map\'s own propagation_rules (genotype/map.vetted.json) and the hub\'s adopted rule', value: { ruleKind: 'convention', checkable: true },
    taxa: 'none: a rule about the map, not about animals',
    scope: 'A convention, so it can be wrong only in the sense of being a bad choice. Labelled as such wherever it appears, and it licenses no biological conclusion.',
    constraints: [], rejectable: 'Reject it and the map may carry downward "required for" links; the closure check (G2) then propagates an edit to more nodes, not fewer.' },
  { id: 'E7', status: 'empirical', title: 'A lever lethal before the scoring stage cannot produce the phenotype',
    lean: { definition: 'Delphi.Empirical.CanScore', theorems: ['Delphi.Empirical.cannot_score_of_lethal_before', 'Delphi.Empirical.ezh2_cannot_be_scored', 'Delphi.Empirical.wls_rays_cannot_be_scored'] },
    statement: 'death_hpf <= scored_hpf implies the phenotype cannot be scored in a living animal.',
    observation: 'Two levers in the project\'s own intervention table state both times: ezh2 dies at 48 hpf, the stage at which its fin absence is scored, and wls dies by 12 dpf while the ray parameters exist only from 45 dpf.',
    source: 'genotype/interventions.json (the genotype thread\'s own lethality notes, quoted in the value)', value: E7,
    taxa: 'Danio rerio (zebrafish) alleles and treatments; nothing here is measured on a flying fish.',
    scope: `Only the ${E7.evaluated.length} rows that state both a death time and a scoring stage in hours are instantiated. ${E7.notEvaluated.why} Lethality of a homozygote says nothing about a heterozygote, a mosaic, a conditional allele or a rescue, and a lever lethal in zebrafish may not be in another species.`,
    constraints: ['E7'], rejectable: 'Reject it and a design may claim a phenotype from a lever whose animal does not reach the stage; nothing proved elsewhere changes.' },
  { id: 'E8', status: 'not an empirical entry: already proved', title: 'A part cannot appear before its precursor',
    lean: { theorems: ['Delphi.Genotype.devOrdered_of_check', 'Delphi.Genotype.Certificates.finDev_ordered'] },
    statement: 'Every develops_from edge goes strictly later in stage, and the relation is acyclic.',
    observation: 'The stages are data (ZFIN); the ordering is a THEOREM about that data, certified by a kernel evaluation on the fin subtree. Restating it as an empirical hypothesis would weaken a theorem into an assumption, so it is not in this layer.',
    source: 'genotype/fin-subtree.json, certified in lean/Delphi/Certificates/FinDevelopment.lean', value: J('lean/genotype/dev-certificate.json').edges,
    taxa: 'Danio rerio anatomy (ZFA), joined to the blueprint by cross-reference', scope: 'See the law genotype-developmental-ordering in lean/laws.json.',
    constraints: ['G3'], rejectable: 'The ZFIN stage order is the assumption; reject it and the certificate says nothing.' }
];

// --- E3 version 2.0.0 (law set 1.6.0): the v1 entry above is kept as history, the v2 numbers are read from the
// TeleostAerobicV2 block of the Lean module. v1 said "no teleost above 0.0458 W"; measured adult zebrafish
// (Palstra et al. 2010, PMC3013094: 2630 mg O2 kg^-1 h^-1 at Ucrit) exceed its per-kg delivery envelope about 2x
// (physics/FICK-CEILING-CHECK.md), so v2 bounds O2 delivery Q*Ca directly and is scoped to its sources.
{
  const v2block = (lean.match(/structure TeleostAerobicV2 where[\s\S]*?del_le : o2Delivery ≤ [0-9.]+/) || [''])[0];
  const v2num = re => { const m = v2block.match(re); return m ? Number(m[1]) : null; };
  const E3v2 = { bounds: { eta: v2num(/eta_le : eta ≤ ([0-9.]+)/), oxycaloric_J_per_ml: v2num(/oxy_le : oxycaloric ≤ ([0-9.]+)/), o2Delivery_ml_O2_per_s: v2num(/del_le : o2Delivery ≤ ([0-9.]+)/) },
    ceiling_W: leanNum(/aerobicCeilingV2_le[\s\S]*?≤ ([0-9.]+) := by/) };
  for (const [k, v] of Object.entries({ ...E3v2.bounds, ceiling_W: E3v2.ceiling_W })) if (typeof v !== 'number') throw new Error('E3 v2: no ' + k + ' read from the TeleostAerobicV2 block of lean/Delphi/Empirical.lean');
  const i = entries.findIndex(x => x.id === 'E3');
  const v1 = entries[i];
  const T = {"title": "Efficiency and O2 delivery lie in the ranges the cited sources allow (widened after measured zebrafish, v2)", "observation": "Within the ranges the cited sources support (skeletal-muscle aerobic efficiency up to 0.23, Gladman and Askew 2024; O2 delivery up to the measured adult zebrafish MO2max at Ucrit, Palstra et al. 2010, scaled allometrically to 0.06 kg), the sustained aerobic ceiling at 0.06 kg is at most 0.0833 W. Version 1 claimed \"no teleost above 0.0458 W\"; measured zebrafish (2630 mg O2 kg^-1 h^-1) exceed v1’s delivery envelope (1350 mg O2 kg^-1 h^-1) about 2x per kg, so that wording was withdrawn. Powered flight at 10 m/s needs 1.346 W, about 16x this ceiling, so the C14 elimination survives.", "source": "Palstra AP et al. (2010) PLoS One 5:e14483, doi:10.1371/journal.pone.0014483, PMC3013094, Results \"Swimming economy\" (82.18 umol g^-1 h^-1 = 2630 mg O2 kg^-1 h^-1 at Ucrit, 0.43 g, 28 C); Gladman NW and Askew GN (2024) J Exp Biol 227, PMC11583979 (contractile efficiency 0.27 to 0.37 x oxidative recovery 0.61); physiology/muscle.js (oxycaloric 13.54 J/mg). Analysis: physics/FICK-CEILING-CHECK.md section 5.", "taxa": "Bounds are cross-taxon transfers: Danio rerio (measured MO2max, scaled to 60 g), Sepia/Scyliorhinus muscle (efficiency), and the physiology chain’s oxycaloric value. No Exocoetidae respirometry exists in this project.", "scope": "Scoped to the sources named, not to every teleost: high-performance pelagic teleosts (tunas) were not fetched and may exceed it. The bound is at one mass (0.06 kg). It bounds SUSTAINED AEROBIC power only: burst power on white-muscle stores is outside it, and that is what a flying fish is understood to use.", "rejectable": "Reject it and C14 still rules, but only on the particular proxies a candidate commits.", "value": {"derivation": "1600 mg O2 kg^-1 h^-1 x 0.06 kg / 3600 s / 1.429 mg/ml = 0.01867 ml O2/s, rounded up to 0.0187; 0.23 x 19.35 x 0.0187 = 0.0832 W, stated as 0.0833", "massUsed_kg": 0.06, "shortfall_at_10_m_s": {"power_required_W": 1.346, "factor": 16.2}, "corrected_range": {"low": 10, "central": 20, "high": 29, "unit": "x", "basis": "physics/FICK-CEILING-CHECK.md section 5 table: O2 x1.4 to x2.5, eta 0.15 to 0.23; 38x with the original snapper-based chain proxies"}}, "withdrawn_because": "measured adult zebrafish MO2max at Ucrit (Palstra 2010, 2630 mg O2 kg^-1 h^-1) is about 2x the per-kg delivery envelope v1 allowed (Q <= 75 ml/min/kg x Ca <= 0.21 = 1350 mg O2 kg^-1 h^-1); see physics/FICK-CEILING-CHECK.md", "change": "widened: eta <= 0.23, Q*Ca <= 0.0187 ml O2/s at 0.06 kg; ceiling 0.0458 -> 0.0833 W; wording rescoped to its sources (law set 1.6.0)"};
  entries[i] = { ...v1, version: '2.0.0', title: T.title,
    lean: { structure: 'Delphi.Empirical.TeleostAerobicV2', theorems: ['Delphi.Empirical.aerobicCeilingV2_le', 'Delphi.Empirical.no_aerobic_flight_above_ceiling_v2', 'Delphi.Empirical.teleostAerobicV2_nonvacuous'], superseded: v1.lean },
    statement: `eta <= ${E3v2.bounds.eta}, oxycaloric <= ${E3v2.bounds.oxycaloric_J_per_ml} J/ml and O2 delivery Q*Ca <= ${E3v2.bounds.o2Delivery_ml_O2_per_s} ml O2/s (1600 mg O2 kg^-1 h^-1 at 0.06 kg) imply an aerobic ceiling of at most ${E3v2.ceiling_W} W.`,
    observation: T.observation, source: T.source,
    value: { ...T.value, bounds: E3v2.bounds, ceiling_W: E3v2.ceiling_W, chainValues: v1.value.chainValues },
    taxa: T.taxa, scope: T.scope, rejectable: T.rejectable,
    history: [{ version: '1.0.0', date: '2026-11-01', ceiling_W: v1.value.ceiling_W, statement: v1.statement, observation: v1.observation, value: v1.value, withdrawn_because: T.withdrawn_because },
      { version: '2.0.0', date: '2026-11-01', change: T.change }] };
}

const out = { built: new Date().toISOString(), tool: 'lean/empirical/build-empirical.mjs', module: 'lean/Delphi/Empirical.lean',
  leanNumbersChecked: leanAgrees.map(([k, f, l]) => ({ what: k, file: f, leanModule: l, agree: true })),
  framing: 'An observation is not a mathematical truth, so this layer declares NO axiom. Each entry is a Lean structure whose fields are the measured numbers and whose proof obligations are the inequalities the observation asserts; a theorem that needs an observation takes the structure as an argument, exactly as the scaling modules take AreaLaw and CubeLaw. #print axioms therefore still reports only propext, Classical.choice and Quot.sound for every theorem in the development (lean/Delphi/Audit.lean). Status "empirical" is distinct from "proved": a reader may reject an entry, and the ledger says which eliminations were conditional on it.',
  nonVacuity: { theorem: 'Delphi.Empirical.empirical_nonvacuous', witness: 'Delphi.Empirical.measured',
    why: 'An inconsistent set of observations would let the checker eliminate every candidate, and that failure would look exactly like success. The witness instantiates every entry with the project\'s measured numbers at once; if two entries contradicted each other it would not type-check.',
    mutation: 'lean/mutate.mjs: empirical-witness-outside-band moves a band so the measured value falls outside it, and the witness must then fail to compile.' },
  entries, counts: { total: entries.length, empirical: entries.filter(e => e.status.startsWith('empirical')).length, conventions: entries.filter(e => e.status.startsWith('project convention')).length, alreadyProved: entries.filter(e => e.status.startsWith('not an empirical')).length, withConstraints: entries.filter(e => e.constraints.length).length } };
fs.writeFileSync(path.join(root, 'lean/empirical.json'), JSON.stringify(out, null, 1));
console.log(`lean/empirical.json: ${entries.length} entries (${out.counts.empirical} empirical, ${out.counts.conventions} convention, ${out.counts.alreadyProved} already proved); constraints ${entries.flatMap(e => e.constraints).join(', ')}`);
console.log(`E1 ${JSON.stringify(E1)}; E2 band [${E2.min}, ${E2.max}] over ${E2.rows.length} rows, excluded ${E2.excluded.length}; E3 ceiling ${entries.find(x => x.id === 'E3').value.ceiling_W} W (v2; v1 was ${E3.ceiling_W} W); E5 [${ff.pectoral_over_SL_min}, ${ff.pectoral_over_SL_max}] n=${ff.n_specimens}`);
