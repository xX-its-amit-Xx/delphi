// Node-only: assembles the DATA BUNDLE that the pure-ESM studio modules (organism.mjs, state.mjs,
// scenarios/*.mjs) take as an argument. Nothing here computes science; it reads repository files
// and copies their values with their own kind/source labels. dashboard/build-engine.mjs writes the
// same bundle to dashboard/public/blueprint3d/engine/data/bundle.json so the browser sees the
// identical numbers.
//
// Sources read (none modified):
//   anatomy-model/parametric/organisms/*.json, resolved/*.json, stages.json
//   development/trajectory.mjs (flying fish), development/zebrafish/trajectory.mjs
//   dashboard/public/blueprint3d/model/*-manifest.json (part ids), dashboard/public/blueprint3d/data.json (ontology terms)
//   genotype/map.vetted.slim.json (gene symbols), physiology/haemoglobin.js + muscle.js + index.js (constants)
//   conditions/baseline.json, sim-engine/params/ontogeny.json (if another thread has landed it)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const ROOT = path.resolve(import.meta.dirname, '..', '..');
const rd = rel => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const imp = rel => import(pathToFileURL(path.join(ROOT, rel)).href);

// Reference organism -> growth track and the age (days after hatching) its parameter file describes.
const REF = {
  'flying-fish': { track: 'flying-fish', taxon: 'Exocoetidae', ref_age_days: 365, manifest: 'flying-fish-dev-manifest.json',
    species: 'flying fish (Exocoetidae, generic; adult parameters from Cypselurus hiraii, Park & Choi 2010 L3; growth from Hirundichthys affinis)' },
  'zebrafish-adult': { track: 'zebrafish', taxon: 'Danio rerio', ref_age_days: 180, manifest: 'zebrafish-dev-manifest.json', species: 'Danio rerio' },
  'zebrafish-larva': { track: 'zebrafish', taxon: 'Danio rerio', ref_age_days: 3, manifest: 'zebrafish-dev-manifest.json', species: 'Danio rerio' },
};

let _cache = null;
export async function loadBundle({ fresh = false } = {}) {
  if (_cache && !fresh) return _cache;
  const P = 'anatomy-model/parametric';
  const MD = 'dashboard/public/blueprint3d/model';
  const organisms = {};
  for (const [id, meta] of Object.entries(REF)) {
    const j = rd(`${P}/organisms/${id}.json`);
    organisms[id] = { id, name: j.name, kind: 'reference', hypothetical: false, parents: null, species: meta.species, taxon: meta.taxon,
      track: meta.track, ref_age_days: meta.ref_age_days, manifest: meta.manifest, parameters: j.parameters };
  }
  for (const f of fs.readdirSync(path.join(ROOT, P, 'resolved'))) {
    const id = f.replace(/\.json$/, '');
    if (organisms[id]) continue;
    const j = rd(`${P}/resolved/${f}`);
    organisms[id] = { id, name: j.name, kind: 'design', hypothetical: !!j.hypothetical, parents: j.parents,
      manifest: fs.existsSync(path.join(ROOT, MD, `${id}-manifest.json`)) ? `${id}-manifest.json` : null,
      parameters: j.parameter_detail };
  }

  // Growth tracks: dense samples of the project's own trajectory modules plus the per-stage
  // parameter overrides anatomy-model/parametric/stages.mjs already derived from them.
  const FF = await imp('development/trajectory.mjs');
  const ZF = await imp('development/zebrafish/trajectory.mjs');
  const ages = max => { const a = []; for (let d = 0; d <= 30; d++) a.push(d); for (let d = 35; d <= max; d += 5) a.push(d); if (a.at(-1) !== max) a.push(max); return a; };
  const stagesJson = rd(`${P}/stages.json`);
  const slimStage = s => ({ key: s.key, label: s.label, age_days: s.age_days, stage: s.stage, parameters: s.parameters, shrink: s.shrink });
  const tracks = {
    'flying-fish': {
      source: 'development/trajectory.mjs at(ageDays); stage overrides from anatomy-model/parametric/stages.json',
      range_days: [0, 365], adult_age_days: 365,
      kinds: {
        SL_m: { kind: 'measured-secondhand', source: 'von Bertalanffy fit (Oxenford 1994 via FishBase) x SL/FL 0.927 (development/trajectory.mjs); below 14 d an ASSUMED linear ramp from an assumed 0.4 cm hatch length', early_kind: 'assumed', early_below_days: 14 },
        mass_kg: { kind: 'derived', source: 'W = 0.0116 FL^3.01 (physics/length-weight.csv) applied to the SL curve (development/trajectory.mjs)' },
        fin: { kind: 'measured', source: 'Daane 2021 pooled pectoral/SL fit, valid 1.68-24 cm SL; span and area carried by the fin ratio with the Davenport 1992 exponent 1.834 (an assumed transfer)', out_of_range_kind: 'assumed', valid_SL_m: [0.0168, 0.24] },
        other: { kind: 'assumed', source: 'stage overrides in anatomy-model/parametric/stages.json (schematic where not stated)' },
        swimbladder: { kind: 'assumed', source: 'no flying-fish swim-bladder inflation datum; anatomy-model/parametric/stages.mjs shrinks it below 15 d by assumption' },
      },
      dense: ages(365).map(a => { const s = FF.at(a); return { ageDays: a, stage: s.stage, SL_m: s.SL_m, mass_kg: s.mass_kg, finLength_SL: s.finLength_SL, swimbladder: a >= 15 }; }),
      stages: stagesJson['flying-fish'].stages.map(slimStage),
    },
    zebrafish: {
      source: 'development/zebrafish/trajectory.mjs at(ageDays); stage overrides from anatomy-model/parametric/stages.json',
      range_days: [0, 180], adult_age_days: 180,
      kinds: {
        SL_m: { kind: 'measured', source: 'Parichy 2009 larval rate 0.32 mm/d and a von Bertalanffy fit (development/zebrafish/trajectory.mjs)' },
        mass_kg: { kind: 'derived', source: 'Beaudouin 2015 ln W(mg) = -5.24 + 3.22 ln SL(mm); extrapolated above 15 mm SL' },
        fin: { kind: 'assumed', source: 'no fetched source measures pectoral length/SL in wild-type zebrafish at any size (anatomy-model/parametric/stages.mjs)' },
        other: { kind: 'measured-secondhand', source: 'body depth and head length from Parichy 2009 + FishBase morphometrics; fin presence from Parichy 2009 Table 4 milestones; fin sizes schematic' },
        swimbladder: { kind: 'measured', source: 'Parichy 2009 Table 4 milestone pSB/aSB (swim bladder inflated), via development/zebrafish/trajectory.mjs' },
      },
      dense: ages(180).map(a => { const s = ZF.at(a); const ms = s.parichyMilestonesPassed || []; return { ageDays: a, stage: s.stage, SL_m: s.SL_m, mass_kg: s.mass_kg, finLength_SL: null, swimbladder: ms.includes('pSB') || ms.includes('aSB') }; }),
      stages: stagesJson['zebrafish-adult'].stages.map(slimStage),
    },
  };

  // Part manifests, slimmed but kept in the manifest's own shape ({objects:[{object,...}], parameters,
  // units_and_axes, derived_from_the_mesh}) so dashboard/public/blueprint3d/partedit.js resolveTarget and
  // editableParams read them exactly as they read the full manifest in the browser.
  const manifests = {};
  const KEEP = ['object', 'label', 'level', 'layer', 'organ_system', 'organ_system_id', 'ontology_id', 'zfa_id', 'side', 'driven_by_parameters'];
  for (const f of new Set(Object.values(organisms).map(o => o.manifest).filter(Boolean))) {
    const j = rd(`${MD}/${f}`);
    const d = j.derived_from_the_mesh || {};
    manifests[f] = {
      file: `${MD}/${f}`,
      organism: Object.values(organisms).find(o => o.manifest === f).id, // the organism this mesh was built from
      objects: j.objects.map(o => Object.fromEntries(KEEP.filter(k => o[k] !== undefined).map(k => [k, o[k]]))),
      parameters: j.parameters ? { standard_length_m: j.parameters.standard_length_m } : {},
      units_and_axes: j.units_and_axes || null,
      derived_from_the_mesh: { measured_how: d.measured_how || null, pectoral_span_m: d.pectoral_span_m ?? null, pectoral_area_both_m2: d.pectoral_area_both_m2 ?? null, lifting_area_m2: d.lifting_area_m2 ?? null },
    };
  }

  const dj = rd('dashboard/public/blueprint3d/data.json');
  const terms = dj.terms.map(t => ({ id: t.id, label: t.label, level: t.level, parents: (t.parents || []).map(p => p.id) }));

  const gm = rd('genotype/map.vetted.slim.json');
  const genes = new Set();
  const walk = o => {
    if (Array.isArray(o)) o.forEach(walk);
    else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) {
      if (k === 'symbol' && typeof v === 'string' && /^[A-Za-z][A-Za-z0-9.\-_]*$/.test(v)) genes.add(v); else walk(v);
    }
  };
  walk(gm.layers); walk(gm.focus_genes);

  const HB = await imp('physiology/haemoglobin.js');
  const MU = await imp('physiology/muscle.js');
  const PH = await imp('physiology/index.js');
  const CA = await imp('physiology/cardiac.js');
  const physiology = {
    red_fraction_of_myotome: { ...MU.MUSCLE_PARAMS.red.fraction_of_myotome, module: 'physiology/muscle.js' },
    gill_area_m2_per_kg: { ...PH.GILL_PARAMS.default_gillArea_m2_per_kg, species: 'Scomber scombrus', module: 'physiology/index.js' },
    hb_P50_kPa: { ...HB.HB_PARAMS.P50_kPa, module: 'physiology/haemoglobin.js' },
    cardiac_Q_max_ml_min_kg: { ...CA.CARDIAC_PARAMS.warm.Q_max_ml_min_kg, module: 'physiology/cardiac.js' },
    axial_muscle_fraction_placeholder: { value: 0.5, kind: 'assumed', source: "physiology/index.js createPhysiology: 'assumed 0.5 of body mass; not fetched'", module: 'physiology/index.js' },
    seawater_density_kg_m3: { value: 1023.4, kind: 'assumed', source: 'physiology/index.js o2sat_mg_l: density 1.0234 kg/l for salinity > 0 (assumed there, not fetched); 1000 for fresh water' },
  };

  const ontoPath = path.join(ROOT, 'sim-engine/params/ontogeny.json');
  const ontogeny = fs.existsSync(ontoPath) ? JSON.parse(fs.readFileSync(ontoPath, 'utf8')) : null;

  _cache = {
    built: new Date().toISOString(),
    note: 'Assembled by sim-engine/lib/data-node.mjs from repository files; values carry their own kind/source.',
    organisms, tracks, manifests, terms, genes: [...genes].sort(), physiology,
    conditions: rd('conditions/baseline.json').conditions,
    ontogeny,
  };
  return _cache;
}
