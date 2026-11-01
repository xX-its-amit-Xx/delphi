#!/usr/bin/env node
// Bootstrap the law registry from what the project already has: lean/laws.json (laws and gaps),
// lean/constraints.json (which constraint each law backs), lean/empirical.json (named empirical hypotheses
// with values and sources) and the Lean modules (statement text, hashed). Writes lean/registry/laws/*.json,
// lean/registry/lawsets/lawset-1.0.0.json and lawsets/current.json.
//
// Run ONCE. Afterwards the law files are the source of truth and change only through propose.mjs, a human
// edit (approval), or release.mjs. Re-running refuses to overwrite unless --force (which you should not need).
//   node lean/registry/build-registry.mjs [--force] [--no-lean]
import fs from 'node:fs';
import path from 'node:path';
import { REG, ROOT, LAWS_DIR, LAWSETS_DIR, readJson, writeJson, contentHash, statementText, gitHead, gitClean, leanCheck, parseAxioms, STANDARD_AXIOMS, sha256 } from './registry-lib.mjs';

const force = process.argv.includes('--force');
const noLean = process.argv.includes('--no-lean');
const VERSION = '1.0.0';
const DATE = new Date().toISOString().slice(0, 10);
if (fs.existsSync(path.join(LAWSETS_DIR, 'current.json')) && !force) { console.error('registry already bootstrapped (lawsets/current.json exists); refusing to overwrite. Use propose.mjs / release.mjs.'); process.exit(1); }

const LAWS = readJson(path.join(ROOT, 'lean/laws.json'));
const CONS = readJson(path.join(ROOT, 'lean/constraints.json'));
const EMP = readJson(path.join(ROOT, 'lean/empirical.json'));
const HEAD = gitHead();

// The registry's own witness file must compile, with standard axioms only, before anything is written.
const WITNESS_FILE = 'lean/registry/lean/Witnesses.lean';
let witnessAxioms = {};
if (!noLean) {
  const r = leanCheck(path.join(ROOT, WITNESS_FILE));
  if (!r.ok) { console.error(r.out); throw new Error('Witnesses.lean failed to compile'); }
  witnessAxioms = parseAxioms(r.out);
  for (const [d, ax] of Object.entries(witnessAxioms)) if (ax.some(a => !STANDARD_AXIOMS.includes(a))) throw new Error(`${d} uses non-standard axioms ${ax}`);
}
const W = n => ({ lean: `Delphi.Registry.${n}`, file: WITNESS_FILE });

// kind: physical laws are those about mechanics, geometry, fluids, gases or pressure; the rest are biological.
const PHYSICAL = new Set(['thompson1917-ch03-07', 'scaling-area-law', 'scaling-strength-law', 'scaling-bending-law', 'flight-allometry-law', 'flight-climb-glide-law', 'thompson1917-ch02-06', 'thompson1917-ch02-07', 'thompson1917-ch02-10', 'physiology-laplace', 'altitude-coupling', 'taxiing-thrust', 'aspect-ratio-induced-drag', 'elastic-similarity', 'walking-pendulum-speed']);

// Non-vacuity witnesses for the named hypotheses each theorem takes (lean/registry/lean/Witnesses.lean), or
// the instance inside the module itself.
const WITNESS = {
  'kimura-substitution-rate': { lean: 'Delphi.wrightFisher', statement: 'the Wright-Fisher binomial chain is a NeutralChain for every M > 0 (an instance, defined in the module)' },
  'kimura-fixation-probability': { lean: 'Delphi.wrightFisher', statement: 'the Wright-Fisher binomial chain is a NeutralChain for every M > 0' },
  'favored-fixation-lower-bound': { lean: 'Delphi.wrightFisherSelection', statement: 'Wright-Fisher sampling with relative fitness 1+s, s >= 0, is a FavoredChain' },
  'thompson1917-ch03-07': { ...W('cubeLaw_witness'), statement: 'CubeLaw (fun L => L^3) 1' },
  'scaling-area-law': { ...W('areaLaw_witness'), statement: 'AreaLaw (fun L => L^2) 1 (with CubeLaw from cubeLaw_witness)' },
  'scaling-strength-law': { ...W('areaLaw_witness'), statement: 'AreaLaw and CubeLaw both have instances (areaLaw_witness, cubeLaw_witness)' },
  'scaling-bending-law': { ...W('sectionModulusLaw_witness'), statement: 'SectionModulusLaw and LeverLaw have instances (sectionModulusLaw_witness, leverLaw_witness)' },
  'flight-allometry-law': { ...W('powerLaw_witness'), statement: 'PowerLaw (fun L => L^1.834) 1 1.834' },
  'aerobic-power-bound': { ...W('fick_witness'), statement: 'a positive power below the Fick supply with the measured teleost proxies' },
  'fick-principle': { ...W('fick_witness'), statement: 'a positive power below the Fick supply with the measured teleost proxies' },
  'thompson1917-ch02-06': { ...W('cubeLaw_witness'), statement: 'CubeLaw and AreaLaw have instances' },
  'thompson1917-ch02-07': { ...W('musclePowerLaw_witness'), statement: 'MusclePowerLaw, CubeLaw and AreaLaw have instances' },
  'thompson1917-ch02-10': { ...W('cubeLaw_witness'), statement: 'CubeLaw and AreaLaw have instances' },
  'muscle-power-premise': { ...W('musclePowerLaw_witness'), statement: 'MusclePowerLaw (fun L => L^3) (fun L => L^3) 1 1' },
  'haldane-cost-of-selection': { ...W('haldaneCost_witness'), statement: 'HaldaneCost 1 10 1 1' },
  'blueprint-well-formedness': { lean: 'Delphi.Blueprint.Certificates.aFlyingFish_check', statement: 'the flying-fish blueprint certificate passes the checker (decide +kernel)' },
  'genotype-developmental-ordering': { lean: 'Delphi.Genotype.Certificates.finDev_ordered', statement: 'the fin subtree development certificate' },
};
for (const id of ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7']) WITNESS[id] = { lean: 'Delphi.Empirical.empirical_nonvacuous', statement: 'Nonempty Record: the measured numbers satisfy every empirical entry at once' };

// Shared-scope atoms for laws that constrain observable quantities; proved equivalent to the structures in
// Witnesses.lean (bridge_E1..E5). Quantity units in QUANT.
const QUANT = {
  massExponent: { unit: '1', description: 'log-log slope of body mass on body length (fitted)' },
  areaExponent: { unit: '1', description: 'log-log slope of lateral/pectoral fin area on standard length (within species)' },
  wingLoadingExponent: { unit: '1', description: 'log-log slope of wing loading on standard length (within species)' },
  eta: { unit: '1', description: 'muscle mechanical efficiency' },
  oxycaloric: { unit: 'J/ml O2', description: 'oxycaloric equivalent' },
  cardiacOutput: { unit: 'ml/s', description: 'cardiac output of a 0.06 kg fish' },
  arterialO2: { unit: 'ml O2/ml blood', description: 'arterial O2 content' },
  uptakeInAir: { unit: 'ml O2/s', description: 'gill O2 uptake while airborne' },
  finRatio: { unit: '1', description: 'pectoral fin length / standard length' },
};
const pick = ks => Object.fromEntries(ks.map(k => [k, QUANT[k]]));
const SHARED = {
  E1: { atoms: ['q.areaExponent < 2', '1 < q.wingLoadingExponent', '2.9 ≤ q.massExponent', 'q.massExponent ≤ 3.02'], quantities: pick(['areaExponent', 'wingLoadingExponent', 'massExponent']), bridge: 'Delphi.Registry.bridge_E1', witness_values: { areaExponent: '1.834', wingLoadingExponent: '1.236', massExponent: '2.981' } },
  E2: { atoms: ['2.9 ≤ q.massExponent', 'q.massExponent ≤ 3.02'], quantities: pick(['massExponent']), bridge: 'Delphi.Registry.bridge_E2', witness_values: { massExponent: '2.981' } },
  E3: { atoms: ['0 ≤ q.eta', 'q.eta ≤ 0.15', '0 ≤ q.oxycaloric', 'q.oxycaloric ≤ 19.35', '0 ≤ q.cardiacOutput', 'q.cardiacOutput ≤ 0.075', '0 ≤ q.arterialO2', 'q.arterialO2 ≤ 0.21'], quantities: pick(['eta', 'oxycaloric', 'cardiacOutput', 'arterialO2']), bridge: 'Delphi.Registry.bridge_E3', witness_values: { eta: '0.15', oxycaloric: '19.342857', cardiacOutput: '0.06564129', arterialO2: '0.18723338' } },
  E4: { atoms: ['q.uptakeInAir = 0'], quantities: pick(['uptakeInAir']), bridge: 'Delphi.Registry.bridge_E4', witness_values: { uptakeInAir: '0' } },
  E5: { atoms: ['0.406 ≤ q.finRatio', 'q.finRatio ≤ 0.823'], quantities: pick(['finRatio']), bridge: 'Delphi.Registry.bridge_E5', witness_values: { finRatio: '0.687' } },
};
// Scope, stated from each law's sources. 'any' only where the law is a theorem about a model and the design
// supplies every quantity it uses. Life stages: embryo | larva | juvenile | adult.
const TAXA = {
  E1: ['Exocoetidae'], // Davenport 1992: Exocoetus obtusirostris, one species
  E2: ['Exocoetidae'], // six fitted field length-weight studies of five flying-fish species (physics/length-weight.csv)
  E3: ['Teleostei'],   // teleost proxies (Salmo, Lutjanus, Oncorhynchus), for a 0.06 kg fish
  E4: ['Teleostei'],   // a property of the gill as a water-breathing organ
  E5: ['Exocoetidae'], // 49 museum flying-fish specimens (Daane 2021 Data S1)
  E6: ['any'], E7: ['Danio rerio'], E8: ['Danio rerio'],
  'genotype-pleiotropy-closure': ['Danio rerio'], 'genotype-developmental-ordering': ['Danio rerio'], // ZFA / zebrafish gene map
};
const STAGES = { E2: ['adult'], E4: ['juvenile', 'adult'], E7: ['embryo', 'larva'], E8: ['embryo', 'larva', 'juvenile'] };
const RANGES = { E3: { mass_kg: { min: 0.06, max: 0.06, unit: 'kg', note: 'the cardiac-output ceiling (75 ml/min/kg) was converted to ml/s for a 0.06 kg fish; at any other mass the absolute bound 0.075 ml/s is not the measured one' } } };
const SCOPE_BASIS = {
  E1: 'Davenport 1992 (physics/allometry.json): within-species regressions on Exocoetus obtusirostris',
  E2: 'physics/length-weight.csv: fitted field studies (n 117 to 2769) of fishery-caught flying fish, lengths about 15 to 30 cm',
  E3: 'physiology chain proxies from other teleosts, evaluated for a 0.06 kg fish',
  E4: 'physiology/index.js: gills do not ventilate in air; larval cutaneous uptake is not modelled, so larvae are outside',
  E5: 'Daane 2021 Data S1: preserved flying-fish specimens',
  E7: 'genotype/interventions.json: zebrafish alleles and treatments, death and scoring stages in hours post fertilisation',
};
// Constraint-level scope where the CHECK is narrower than the law. The scaling theorems hold for any isometric
// family, but C7b, C2a, C8e, C9c and C8c are evaluated by comparing the design with ONE reference specimen
// (browser-check REFERENCE: Cypselurus hiraii, Park and Choi 2010 model L3). An exponent implied between a
// zebrafish and a flying fish compares two different body plans, not two members of one isometric family, so
// those rows are out of scope for anything that is not a flying fish. E2 is evaluated the same way and its data
// are flying-fish data.
const REF_SCOPE = { taxa: ['Exocoetidae'], life_stages: [], ranges: {}, basis: 'evaluated against one reference specimen (Cypselurus hiraii, Park and Choi 2010 Table 1 model L3); an isometric family is one body plan, so other clades are out of scope' };
const CSCOPE = { C7b: REF_SCOPE, C2a: REF_SCOPE, C8e: REF_SCOPE, C9c: REF_SCOPE, C8c: REF_SCOPE };

// constraint ids per law: from constraints.json (claim_id), empirical-E2 -> E2
const consByLaw = {};
for (const c of CONS.constraints) { const lid = c.claim_id.replace(/^empirical-/, ''); (consByLaw[lid] ||= []).push(c.id); }

function classify(l) {
  const s = l.status || '';
  if (l.id === 'muscle-power-premise') return { cls: 'named-hypothesis', status: 'retired' };
  if (l.id === 'E8') return { cls: 'empirical-observation', status: 'retired' };
  if (l.id === 'haldane-cost-of-selection') return { cls: 'theorem-from-hypothesis', status: 'contested' };
  if (/^not formalised/.test(s)) return { cls: 'gap', status: 'proposed' };
  if (/^stated-not-proved/.test(s)) return { cls: 'named-hypothesis', status: 'accepted' };
  if (/project convention/.test(s)) return { cls: 'convention', status: 'accepted' };
  if (/^empirical/.test(s)) return { cls: 'empirical-observation', status: 'accepted' };
  if (/^proved/.test(s)) return { cls: 'theorem', status: 'accepted' };
  throw new Error('unclassified status ' + s + ' for ' + l.id);
}

const modCache = {};
const modSrc = m => (modCache[m] ??= fs.existsSync(path.join(ROOT, m)) ? fs.readFileSync(path.join(ROOT, m), 'utf8') : null);
const out = [];
for (const l of LAWS.laws) {
  const { cls, status } = classify(l);
  const emp = EMP.entries.find(e => e.id === l.id);
  // Named hypotheses without an empirical.json entry: the Lean definition that carries them.
  const HYP_DEF = { 'muscle-power-premise': 'Delphi.MusclePowerLaw', 'fick-principle': 'Delphi.aerobicPower' };
  const structure = emp?.lean?.structure || emp?.lean?.definition || HYP_DEF[l.id] || null;
  let module = l.module || null;
  const theorem = l.theorem || null;
  // The statement hashed is the structure (for an empirical hypothesis: the observation itself) or the theorem.
  const declForHash = structure || theorem;
  let stmt = module && declForHash ? statementText(modSrc(module), declForHash) : null;
  if (module && declForHash && !stmt) { // declared in another module (E8 points at a Genotype theorem)
    for (const f of fs.readdirSync(path.join(ROOT, 'lean/Delphi')).filter(f => f.endsWith('.lean'))) {
      const s2 = statementText(modSrc('lean/Delphi/' + f), declForHash); if (s2) { module = 'lean/Delphi/' + f; stmt = s2; break; } } }
  const src = module ? modSrc(module) : null;
  if (declForHash && src && !stmt) console.warn(`warning: statement of ${declForHash} not found in ${module}`);
  const hypotheses = [];
  if (emp) hypotheses.push({ name: structure, statement: emp.statement, value: emp.value ?? null, source: emp.source, observation: emp.observation });
  for (const [i, a] of (l.scope?.assumed || []).entries()) hypotheses.push({ name: `${l.id}#assumed-${i + 1}`, statement: a });
  const sources = [l.source, emp?.source].filter(Boolean);
  const law = {
    law_id: l.id,
    version: '1.0.0',
    kind: PHYSICAL.has(l.id) ? 'physical' : 'biological',
    class: cls,
    status,
    label: l.label || String(l.statement).split(/[.;:]/)[0].slice(0, 90),
    level: l.level,
    lean_ref: { module, theorem, structure, commit: module ? (gitClean(module) ? HEAD : HEAD + '+dirty') : null, statement_sha256: stmt ? sha256(stmt) : null, content_hash: null },
    statement_en: l.statement,
    hypotheses,
    scope: { taxa: TAXA[l.id] || ['any'], life_stages: STAGES[l.id] || [], ranges: RANGES[l.id] || {}, basis: SCOPE_BASIS[l.id] || (TAXA[l.id] ? null : 'a theorem about a model: it applies wherever the design supplies the quantities it uses and accepts the hypotheses in scope.assumed'), kernelChecked: l.scope?.kernelChecked || [], assumed: l.scope?.assumed || [], note: emp?.scope || l.why || null },
    constraint_scopes: Object.fromEntries((consByLaw[l.id] || []).filter(c => CSCOPE[c]).map(c => [c, CSCOPE[c]])),
    shared_scope: SHARED[l.id] || null,
    evidence: { sources, observations: emp?.observation ? [emp.observation] : [], faithfulness: l.faithfulness || null, flyingFishAudit: l.flyingFishAudit || null, rejectable: l.rejectable || emp?.rejectable || null },
    sources,
    non_vacuity_witness: WITNESS[l.id] || (cls === 'gap' ? null : { lean: null, statement: 'a theorem from standard axioms whose hypotheses are plain inequalities or decidable checks on the inputs; no separate witness structure (see scope.kernelChecked)' }),
    constraints: consByLaw[l.id] || l.constraints || [],
    introduced_in: status === 'proposed' ? null : VERSION,
    supersedes: null,
    superseded_by: l.id === 'muscle-power-premise' ? 'aerobic-power-bound' : l.id === 'E8' ? 'genotype-developmental-ordering' : null,
    retired_reason: l.id === 'muscle-power-premise' ? 'Replaced for the Studio by the aerobic bound (lean/laws.json); contested: contraction frequency falls with size. The theorems from MusclePowerLaw stay compiled in lean/Delphi/Scaling.lean, so old results remain reproducible.'
      : l.id === 'E8' ? 'Not an empirical entry: already proved as a theorem about the data (Delphi.Genotype.devOrdered_of_check). Restating it as a hypothesis would weaken a theorem into an assumption.' : null,
    contested_with: l.id === 'haldane-cost-of-selection' ? [{ law_id: 'external:literature', reason: "Haldane 1957's cost accounting is contested since publication (soft selection, truncation selection, standing variation and linked substitutions all change the cost); lean/laws.json carries it as a named hypothesis never proved here." }] : [],
    approval: status === 'accepted' ? { approved_by_role: 'bootstrap-grandfathered', date: DATE, basis: 'in force in lean/constraints.json / lean/laws.json before the registry existed; no per-law human review recorded by the registry' } : null,
    origin: { by_role: 'lean-thread', kind: 'bootstrap', from: 'lean/laws.json' + (emp ? ' + lean/empirical.json' : '') },
    history: [{ version: '1.0.0', date: DATE, change: `bootstrapped from lean/laws.json (status there: "${l.status}")` }],
    content_hash: null,
  };
  if (cls === 'gap') law.why = l.why || null;
  law.content_hash = contentHash(law);
  law.lean_ref.content_hash = law.content_hash;
  out.push(law);
}

fs.mkdirSync(LAWS_DIR, { recursive: true });
for (const law of out) writeJson(path.join(LAWS_DIR, law.law_id + '.json'), law);
const lawset = { version: VERSION, created: new Date().toISOString(), previous: null, commit: HEAD,
  note: 'Bootstrap law set: every law in lean/laws.json at registry creation, with its status. Only accepted (and, if a caller opts in, candidate) laws may produce a red verdict.',
  laws: out.map(l => ({ law_id: l.law_id, version: l.version, content_hash: l.content_hash, status: l.status, kind: l.kind })) };
writeJson(path.join(LAWSETS_DIR, `lawset-${VERSION}.json`), lawset);
writeJson(path.join(LAWSETS_DIR, 'current.json'), { version: VERSION, file: `lawset-${VERSION}.json` });
const count = {}; for (const l of out) { const k = l.kind + '/' + l.status; count[k] = (count[k] || 0) + 1; }
console.log(`lean/registry: ${out.length} laws, lawset ${VERSION}`, count);
