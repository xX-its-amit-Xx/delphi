// The scale ladder: one organism, at every level the repository can say anything about, in one object.
//
// A run under runs/ produces a blueprint (what parts there are), a set of check results (what each layer
// concluded) and a Design Studio session (what was said when). Those three live in different shapes and
// nothing joined them to each other, or to the Lean laws, or to a position in space. This module is that
// join, and it is deliberately the only place where the join happens, so that a wrong answer in the theatre
// view is traceable to one function here rather than to a page.
//
//   scaleLadder({ run, generation, blueprint, gen, journal, laws, chain, frames, partLaws, getState })
//     -> { organism, frame, parts, unplaced, molecules, chain, checks, timeline, counts, honesty }
//
// THE RULE THIS FILE IS BUILT AROUND. Four kinds of statement end up on the same part, and a person must be
// able to tell them apart at a glance or the whole thing is worse than nothing:
//
//   proof       a Lean theorem, kernel-checked, with a module and a line
//   check       arithmetic in sim-engine/validate/, resting on something undisputed but not formalised
//   literature  a graded, quoted link from a paper, in some other species
//   declared    a number a person typed, with a source string saying they typed it
//
// Every law, check, link and quantity this module emits carries its `basis` as one of those four words, and
// nothing is allowed out without one. The page colours by that field.
import fs from 'node:fs';
import path from 'node:path';

export const CONTRACT_VERSION = '0.11.0';

export const LEVELS = ['molecule', 'pathway', 'cell', 'cell_cell', 'tissue', 'organ', 'organ_system', 'body'];

// Which check tool is about which part. The left side is a tool name as registered in mcp/server.mjs; the
// right side is matched the same way a frame slot is matched, against the part's label and ontology id.
//
// A tool with `parts: null` is about the WHOLE ORGANISM and is attached to the body, not spread over parts:
// a lifespan is not a property of a wing, and an ecology verdict is not a property of a gut. Pretending
// otherwise is how a dashboard ends up implying that a check examined something it never looked at.
export const TOOL_TARGETS = {
  blueprint: { parts: null, layer: 'blueprint', about: 'which parts the ontologies place in this taxon at all' },
  physics_check: { parts: ['wing', 'patagium', 'membrane', 'fin', 'blade', 'muscle', 'skelet', 'bone', 'limb'], layer: 'physics', about: 'standing checks over the resolved STATE' },
  flight_support_check: { parts: ['wing', 'patagium', 'membrane', 'flight membrane', 'pectoral fin', 'fin', 'interdigital', 'web', 'blade'], layer: 'physics', about: 'whether the lifting area can hold the mass up' },
  locomotion_check: { parts: ['wing', 'patagium', 'fin', 'flagell', 'cilia', 'leg', 'limb', 'muscle', 'paddle', 'hinge'], layer: 'locomotion', about: 'whether the declared gait moves the body at all' },
  performance_check: { parts: null, layer: 'performance', about: 'what the design accomplishes, for the whole organism' },
  ecology_check: { parts: null, layer: 'ecology', about: 'where the organism could be, and what else is there' },
  lean_check: { parts: null, layer: 'lean', about: 'the resolved state against a released lawset' },
  functional_resolution: { parts: null, layer: 'functional', about: 'the nearest real organism performing the same function' },
  closest_relative_phenotype: { parts: null, layer: 'phenotype', about: 'the nearest real body' },
  organism_get: { parts: null, layer: 'state', about: 'the resolved STATE at an age' },
  parse_design_text: { parts: null, layer: 'routing', about: 'which requirement goes to which layer' },
  genome_sketch: { parts: ['cell'], layer: 'genotype', about: 'gene products annotated to a cell type' },
};

const rd = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const lower = s => String(s ?? '').toLowerCase();

/** Deterministic small offset from a string, so a molecule lands in the same place on every rebuild. */
function jitter(id, scale = 0.06) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  const a = ((h >>> 0) % 1000) / 1000, b = ((h >>> 10) % 1000) / 1000, c = ((h >>> 20) % 1000) / 1000;
  return { x: (a - 0.5) * scale, y: (b - 0.5) * scale, z: (c - 0.5) * scale };
}

/** Load the two data files, from an explicit directory or from beside this module. */
export function loadScaleData(dir = null) {
  const here = dir ?? path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'scales');
  return { frames: rd(path.join(here, 'body-frames.json')), partLaws: rd(path.join(here, 'part-laws.json')) };
}

/**
 * Pick a body plan. A construct takes the construct frame whatever its donor is -- that is the whole point
 * of the construct layer, and placing a xenobot's cells on a frog is the error this chooses not to make.
 */
export function frameFor({ taxon = null, ancestors = [], isConstruct = false }, frames) {
  if (isConstruct) return { name: 'construct', frame: frames.frames.construct, why: 'base.made_from is set: a construct has no body plan to inherit, so its shape is declared rather than looked up' };
  const chain = [taxon, ...ancestors].filter(Boolean);
  for (const [name, f] of Object.entries(frames.frames)) {
    const hit = (f.applies_to_clade ?? []).find(c => chain.some(t => t === c || t.startsWith(c + ' <')));
    if (hit) return { name, frame: f, why: `${taxon} is inside ${hit}, by the NCBITaxon closure in lib/lean-taxonomy.mjs` };
  }
  return { name: 'unknown', frame: frames.frames.unknown, why: `no frame declares a clade containing ${taxon ?? 'an unnamed taxon'}; the clade path checked was ${chain.slice(0, 6).join(' < ') || '(empty)'}` };
}

function matchSlot(part, frame) {
  const id = String(part.id ?? '').replace('http://purl.obolibrary.org/obo/', '');
  const label = lower(part.label);
  for (const s of frame.slots ?? []) {
    if ((s.uberon ?? []).includes(id)) return { slot: s, matched_by: `uberon ${id}` };
  }
  for (const s of frame.slots ?? []) {
    if (!(s.match_level_ok ?? true)) continue;
    for (const p of s.match ?? []) {
      if (p === '.') continue;
      if (new RegExp(p, 'i').test(label)) return { slot: s, matched_by: `label pattern /${p}/ on "${part.label}"` };
    }
  }
  return null;
}

/** Does a law's own scope admit this organism? The law record decides; this function never overrides it. */
function scopeAdmits(lawRecord, { taxon, ancestors }) {
  const taxa = lawRecord?.scope?.taxa ?? null;
  if (!taxa || !taxa.length) return { ok: true, why: 'the law record names no taxon scope' };
  if (taxa.includes('any')) return { ok: true, why: 'scope.taxa is "any": a theorem about a model, applying wherever the design supplies its quantities' };
  const chain = [taxon, ...ancestors].filter(Boolean);
  const hit = taxa.find(t => chain.some(c => c === t || c.startsWith(t + ' <') || t.startsWith(c + ' <')));
  if (hit) return { ok: true, why: `scope.taxa includes ${hit}, which contains ${taxon}` };
  return { ok: false, why: `scope.taxa is [${taxa.join(', ')}], and ${taxon ?? 'this organism'} is in none of them. Its numbers are another clade's.` };
}

/**
 * The laws that reach one part, each with a status that depends on the run, not on the table.
 *
 * `available` is the set of quantity names the design actually has, with how it got each one. A law whose
 * `needs` are not all available comes back `constrains-but-not-evaluated` WITH THE MISSING ONES NAMED,
 * because "we did not check" and "it is fine" must never render the same.
 */
export function lawsForPart(part, { partLaws, lawRecords = {}, taxon, ancestors, available = {}, verdicts = {}, verdictFrom = {}, inapplicable = [] }) {
  const out = [];
  const label = lower(part.label);
  for (const e of partLaws.entries) {
    if (!(e.match_level ?? []).includes(part.level)) continue;
    const hit = (e.match_body && part.level === 'body')
      || (e.match ?? []).some(p => p === '.' ? true : new RegExp(p, 'i').test(label));
    if (!hit) continue;
    const rec = lawRecords[e.law_id] ?? null;
    const scope = scopeAdmits(rec, { taxon, ancestors });
    const missing = (e.needs ?? []).filter(n => !(n in available));
    const Q = partLaws.quantities?.fields ?? {};
    const whereOf = n => Q[n]?.where ?? 'nowhere';
    const nowhere = missing.filter(n => whereOf(n) === 'nowhere');
    const explainMissing = () => {
      if (nowhere.length) return `NO FIELD ANYWHERE IN THIS REPOSITORY CAN HOLD ${nowhere.join(', ')}, so no design can satisfy this law yet. That is a capability gap, not something the designer left out.`;
      const by = w => missing.filter(n => whereOf(n) === w);
      const parts = [];
      if (by('state').length) parts.push(`the design does not declare ${by('state').map(n => `${n} (STATE field ${Q[n]?.state_field ?? n})`).join(', ')}`);
      if (by('table').length) parts.push(`no clade-scoped table entry gives ${by('table').join(', ')} for this organism`);
      if (by('check-input').length) parts.push(`${by('check-input').join(', ')} ${by('check-input').length > 1 ? 'are lean_check inputs' : 'is a lean_check input'} rather than part of the organism, and this run did not pass ${by('check-input').length > 1 ? 'them' : 'it'}`);
      if (by('document').length) parts.push(`the organism document carries no ${by('document').join(', ')}`);
      return parts.join('; ');
    };
    const bad = inapplicable.find(i => (i.clade ?? []).some(c => [taxon, ...ancestors].includes(c)) && (i.laws ?? []).includes(e.law_id));

    let status, because;
    if (bad) { status = 'wrong-quantity'; because = bad.why; }
    else if (!scope.ok) { status = 'out-of-scope'; because = scope.why; }
    else if (e.theorem == null) { status = 'constrains-but-not-evaluated'; because = `${e.law_id} is ${rec?.status ?? 'not formalised'}: there is no theorem to evaluate. ${e.how}`; }
    else if (missing.length) { status = 'constrains-but-not-evaluated'; because = explainMissing(); }
    else if (verdicts[e.law_id]) { status = verdicts[e.law_id] === 'violated' ? 'violates' : 'supports'; because = verdictFrom[e.law_id] ?? `a check returned ${verdicts[e.law_id]}`; }
    else { status = 'constrains-but-not-evaluated'; because = 'the quantities are there and no check in this run evaluated this law against them'; }

    out.push({
      law_id: e.law_id, label: rec?.label ?? e.law_id, level: e.level, status, because,
      basis: e.theorem ? 'proof' : 'declared',
      formal_status: rec?.status ?? rec?.class ?? 'unknown',
      about: e.about, how: e.how,
      theorem: e.theorem, module: rec?.lean_ref?.module ?? rec?.lean?.module ?? null, line: rec?.lean?.line ?? null,
      needs: e.needs ?? [], missing, missing_where: Object.fromEntries(missing.map(n => [n, whereOf(n)])),
      cannot_be_supplied: nowhere,
      supplied: (e.needs ?? []).filter(n => n in available).map(n => ({ field: n, ...available[n] })),
      // Universal means EVERY part at EVERY level. A "." pattern restricted to the body level is a whole-body
      // law (the cube law, a size limit), and hoisting it as universal put it on a wing as if it were about wings.
      universal: (e.match ?? []).length === 1 && e.match[0] === '.'
        && ['body', 'organ_system', 'organ', 'tissue', 'cell'].every(l => (e.match_level ?? []).includes(l)),
      proof_link: e.theorem ? `../../api/lean/laws/${e.law_id}.json` : null,
      claim_link: rec?.claim_id ? `../../proofs/#${rec.claim_id}` : null,
      nanopub: rec ? `lean/nanopubs/unsigned/law-${e.law_id}.trig` : null,
      pin: rec?.pin?.status ?? null,
    });
  }
  return out;
}

// Returns INDICES into the ladder's `checks`, not copies: a check's body and numbers are stored once per
// generation, and a part says which of them looked at it.
function checksForPart(part, checks) {
  const label = lower(part.label);
  return checks.map((c, i) => [c, i]).filter(([c]) => {
    const t = TOOL_TARGETS[c.tool];
    if (!t) return false;
    if (t.parts == null) return part.level === 'body';
    return t.parts.some(p => new RegExp(p, 'i').test(label));
  }).map(([, i]) => i);
}

function chainForPart(part, chain) {
  if (!chain?.links) return [];
  const id = String(part.id ?? '').replace('http://purl.obolibrary.org/obo/', '');
  const label = lower(part.label);
  return chain.links.filter(l => {
    const lo = l.lands_on ?? {};
    if (lo.ontology_id && String(lo.ontology_id).replace(/:/g, '_') === id) return true;
    // Exact label only. Substring matching put a link about "fibroblast" on every fibroblast in the body
    // (spleen, mammary gland, meninges). An unmatched link becomes a ghost instead, which is honest.
    if (lo.label && lower(lo.label).trim() === label.trim()) return true;
    return false;
  }).map(l => ({ ...l, basis: 'literature' }));
}

/**
 * The developmental axis.
 *
 * This is the part most at risk of claiming more than it has, so it claims the least it can. A time point is
 * an AGE at which the engine resolved a STATE. Part sizes at that age are the body's own length ratio raised
 * to the exponent the scaling law gives for that part's kind -- UNDER ISOMETRY, which is a hypothesis about
 * the design and not a fact about any organism, and which E1 shows is false for the one body here that has
 * been measured. Nothing about the ORDER in which parts appear is modelled, because nothing in this
 * repository models it: the only law about time certifies that a DECLARED ordering is consistent.
 */
export function timeline({ states = [], stages = [], parts = [] }) {
  const t = states.map(s => {
    // SL_m is the engine's length field (standard length). It is named here rather than guessed at: an
    // earlier version of this function read `length_m`, which no STATE has ever had, so every length came
    // back null and the growth track was silently flat.
    // organism_get returns a FLATTENED state -- { values, nulls, flags, taxon } -- not the
    // { value, kind, source } field shape resolveState() builds internally. Both are read here, because the
    // builder may be handed either, and an earlier version read neither: it asked for `length_m`, which no
    // STATE has ever had, so every length came back null and the growth track was silently flat.
    const v = s?.state?.values ?? null;
    const L = v ? v.SL_m ?? null : (s?.state?.SL_m?.value ?? null);
    const M = v ? v.mass_kg ?? null : (s?.state?.mass_kg?.value ?? null);
    return { age_days: s.age_days, length_m: L, mass_kg: M, stage: s.stage ?? null,
             declared_here: s.declared_here ?? [],
             basis: v ? 'declared' : (s?.state?.SL_m?.kind ?? s?.state?.mass_kg?.kind ?? 'unknown'),
             fields_null: v ? Object.entries(v).filter(([, x]) => x == null).map(([k]) => k)
               : Object.entries(s?.state ?? {}).filter(([, x]) => x?.value == null).map(([k]) => k) };
  });
  // The linear ratio the body is drawn at. A declared length gives it directly. With only a declared mass,
  // it comes from the cube law -- (M/M0)^(1/3) -- which is a kernel-checked theorem here
  // (thompson1917-ch03-07, Delphi.cubeLaw_loglog_exponent) and holds UNDER ISOMETRY AT CONSTANT DENSITY,
  // both hypotheses of the design rather than facts about the animal. Which of the two was used is recorded
  // on every point, because a reader looking at a body growing deserves to know whether the growth was
  // stated or inferred.
  const L0 = t.find(x => x.length_m != null)?.length_m ?? null;
  const M0 = t.find(x => x.mass_kg != null)?.mass_kg ?? null;
  for (const x of t) {
    if (L0 && x.length_m != null) { x.length_ratio = x.length_m / L0; x.ratio_from = 'a declared length'; }
    else if (M0 && x.mass_kg != null) { x.length_ratio = Math.cbrt(x.mass_kg / M0); x.ratio_from = 'a declared mass, through the cube law, under isometry at constant density'; }
    else { x.length_ratio = null; x.ratio_from = 'neither a length nor a mass is declared at this age, so the body is drawn at one size and the age axis changes nothing visible'; }
  }
  return {
    points: t,
    stages: stages.map(s => ({ ...s, basis: 'declared' })),
    scaling: {
      how: 'A part is drawn at (L/L0)^e, with e = 1 for a length, 2 for a surface and 3 for a volume.',
      basis: 'proof',
      under: 'isometry, a HYPOTHESIS the design makes and not a property of any organism',
      laws: ['thompson1917-ch03-07', 'scaling-area-law'],
      falsified_for: 'E1 records that measured fin area in Cypselurus hiraii does NOT scale isometrically, so for that one body this hypothesis is known to be false and the drawing is known to be wrong in a named way.',
    },
    order_of_appearance: {
      modelled: false,
      why: 'Nothing in sim-engine or the Lean law set predicts when a part appears. genotype-developmental-ordering certifies that a DECLARED ordering has no cycle; E7 says a trait appearing after a lethal stage cannot be scored. Neither supplies an order.',
      what_would_be_needed: 'a staged expression or morphology dataset for the organism, and a rule mapping a stage to a part. For every organism in these runs that dataset does not exist.',
    },
    not_a_simulation: 'This is a declared growth track being drawn, not development being simulated. No cell divides, no tissue forms and nothing moves; the body is redrawn larger.',
  };
}

/** Build the whole ladder for one generation. */
export function scaleLadder({
  run, generation, asked = null, blueprint = null, gen = null, journal = [],
  lawRecords = {}, chain = null, frames, partLaws, taxonomy = null, states = [], inapplicable = [],
  madeFrom = null, declared = null, taxonAudit = null, tableQuantities = null,
}) {
  const honesty = [];
  const node0 = blueprint?.nodes?.find(n => n.level === 'body') ?? null;
  const taxon = gen?.phenotype?.taxon ?? gen?.organism?.taxon_label ?? node0?.taxon_label ?? blueprint?.reading?.taxon_label ?? null;
  const isConstruct = Boolean(madeFrom ?? gen?.organism?.made_from ?? gen?.construct ?? blueprint?.input?.made_from);
  const ancestors = (taxonomy?.TAXA?.[taxon]?.ancestors ?? []);
  if (taxon && !taxonomy?.TAXA?.[taxon]) honesty.push(`"${taxon}" is not in the clade table, so no law scope could be checked against its ancestry and every law scoped to a clade comes back out-of-scope. Rebuild with lean/registry/build-taxonomy.mjs if it should be there.`);

  const picked = frameFor({ taxon, ancestors, isConstruct }, frames);
  if (picked.name === 'unknown') honesty.push(`No body plan exists for this clade, so no part has a position. ${picked.why}`);

  // What quantities the design actually has, and how it got each one.
  // What the design supplies, in lean_check's OWN field names, since that is what evaluates each law. A
  // STATE or declared field is translated through part-laws.json `quantities.fields[*].state_field`; a
  // clade-scoped table value (CLmax) is passed in by the caller from the physics layer's own lookup.
  const toSpec = {};
  for (const [spec, q] of Object.entries(partLaws.quantities?.fields ?? {})) if (q.state_field) toSpec[q.state_field] = spec;
  const available = {};
  const put = (k, v) => { available[toSpec[k] ?? k] = v; };
  for (const [k, v] of Object.entries(gen?.state ?? {})) if (v?.value != null) put(k, { basis: v.kind === 'measured' ? 'check' : 'declared', kind: v.kind, source: v.source ?? null });
  for (const [k, v] of Object.entries(declared?.parameters ?? gen?.declared?.parameters ?? {})) put(k, { basis: 'declared', kind: 'assumed', source: v.source ?? null });
  for (const s of declared?.life_stages ?? []) for (const [k, v] of Object.entries(s.parameters ?? {}))
    put(k, { basis: 'declared', kind: 'assumed', source: v.source ?? null, stage: s.key });
  for (const [k, v] of Object.entries(tableQuantities ?? {})) available[k] = v;
  // The engine's resolved state at the last declared age: anything it resolved that the design did not
  // declare (chiefly the ambient air density, a condition default) is available too, and says it is a default.
  const lastVals = [...(states ?? [])].reverse().find(x => x?.state?.values)?.state?.values ?? null;
  if (lastVals) {
    for (const [k, v] of Object.entries(lastVals)) if (typeof v === 'number' && !((toSpec[k] ?? k) in available))
      available[toSpec[k] ?? k] = { basis: 'declared', kind: 'resolved', source: `resolved by organism_get at the last declared age` };
    const rho = lastVals.ambient?.air_density_kg_m3;
    if (typeof rho === 'number' && !('rho' in available)) available.rho = { basis: 'declared', kind: 'condition', source: `ambient air density ${rho} kg/m3 from the conditions the engine resolved; a default, not a measurement of anywhere` };
  }

  // Verdicts this generation reached, keyed by law id where a check names one.
  // A check reaches a law's chip only through an explicit entry in part-laws.json `check_evaluates`, and the
  // chip says the evaluation was the check's floating-point arithmetic, not a kernel check.
  const verdicts = {}, verdictFrom = {};
  for (const e of journal) {
    if (e.type !== 'finding') continue;
    if (e.detail?.law_id) { verdicts[e.detail.law_id] = e.verdict; verdictFrom[e.detail.law_id] = `${e.tool} named this law and returned ${e.verdict}`; continue; }
    const m = partLaws.check_evaluates?.map?.[e.tool];
    const v = m?.verdicts?.[String(e.verdict).toLowerCase()];
    if (m && v) { verdicts[m.law_id] = v; verdictFrom[m.law_id] = `${e.tool} returned ${e.verdict} in generation ${e.generation}: ${m.why}. Floating-point arithmetic on the design's declared numbers, the same relation as the theorem, not a kernel check.`; }
  }

  const checks = journal.filter(e => e.type === 'finding').map(e => ({
    tool: e.tool, layer: TOOL_TARGETS[e.tool]?.layer ?? 'other', about: TOOL_TARGETS[e.tool]?.about ?? null,
    verdict: e.verdict, body: e.body, generation: e.generation, numbers: e.detail ?? null,
    basis: e.tool === 'lean_check' ? 'proof' : 'check',
  }));

  // Place the parts.
  const parts = [], unplaced = [];
  const bySlot = new Map();
  const placedById = new Map();
  const forbidden = picked.frame.has_no ?? [];
  // A construct states what it does NOT inherit from its donor. Those words are matched against the levels
  // and labels of the blueprint, and anything they name is marked as the DONOR'S part rather than the
  // construct's. The blueprint had no way to know: it was built from the donor taxon, so it returned the
  // donor's whole body, and without this the theatre would draw a frog's gut on a 0.5 mm spheroid.
  const notInherited = (madeFrom?.does_not_inherit ?? []).map(s => lower(s));
  // Whole words only, and never the body node. A substring test disowned the construct's own body, because
  // "organ" (from "organ systems") is inside "multicellular organism".
  const STOP = new Set(['the', 'donor', 'whatever', 'those', 'their', 'with', 'from', 'that', 'this', 'track']);
  const disowns = n => n.level === 'body' ? null : notInherited.find(d =>
    (d.includes('organ system') && n.level === 'organ_system') ||
    (d.includes('body plan') && ['organ', 'organ_system'].includes(n.level)) ||
    d.split(/[,\s]+/).filter(w => w.length > 3 && !STOP.has(w)).some(w =>
      new RegExp(`\\b${w.replace(/s$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`, 'i').test(n.label)));
  for (const n of blueprint?.nodes ?? []) {
    const base = { id: String(n.id), label: n.label, ontology_id: String(n.id).replace('http://purl.obolibrary.org/obo/', ''),
                   level: n.level, parent: n.parent, relation: n.relation, ontology: n.ontology };
    if (forbidden.includes(n.level)) {
      unplaced.push({ ...base, why: `the ${picked.name} frame has no ${n.level} level: ${picked.frame.has_no_note ?? 'this organism has no such parts'}` });
      continue;
    }
    const dis = isConstruct ? disowns(n) : null;
    if (dis) {
      unplaced.push({ ...base, why: `the construct's own declaration says it does not inherit "${dis}". This is the DONOR'S part: the blueprint returned the donor's whole body because it was built from the donor taxon, and the construct is not an instance of it.`, donors_not_the_constructs: true });
      continue;
    }
    if (n.level === 'body') {
      const p = { ...base, slot: 'body', matched_by: 'the body node', pos: { x: 0, y: 0, z: 0 }, r: 0.6, shape: 'body', side: 'single', geometry_basis: 'schematic' };
      parts.push(p); placedById.set(base.id, p); placedById.set(n.iri ?? base.id, p);
      continue;
    }
    let m = matchSlot(n, picked.frame);
    // A cell type almost never matches a slot of its own -- a frame has a gut, not an enterocyte -- so a
    // part with no slot inherits its parent's. The inheritance is recorded in `matched_by`, so a cell drawn
    // inside the gut is traceable to the fact that the ontology puts it there and not to a guess.
    if (!m && n.parent) {
      const par = placedById.get(String(n.parent));
      if (par) m = { slot: { ...picked.frame.slots.find(s => s.slot === par.slot) ?? {}, slot: par.slot, x: par.pos.x, y: par.pos.y, z: Math.abs(par.pos.z), r: (par.r ?? 0.1) * 0.45, shape: 'cluster', side: 'single' },
                     matched_by: `inherited the slot of its parent "${par.label}" (${n.relation ?? 'part_of'}), because no slot names this part itself` };
    }
    if (!m) { unplaced.push({ ...base, why: `no slot in the ${picked.name} frame matches its ontology id or its label, and its parent has no slot either` }); continue; }
    const k = m.slot.slot;
    const seen = bySlot.get(k) ?? 0; bySlot.set(k, seen + 1);
    const sides = m.slot.side === 'paired' ? [1, -1] : [1];
    const side = sides[seen % sides.length];
    const rep = m.slot.repeat ? Math.floor(seen / sides.length) % m.slot.repeat : 0;
    const j = jitter(base.id, m.slot.shape === 'cluster' ? 0.12 : 0.05);
    const p = { ...base, slot: k, matched_by: m.matched_by,
      pos: { x: m.slot.x + (m.slot.repeat_along === 'x' ? (rep - (m.slot.repeat - 1) / 2) * (m.slot.repeat_span ?? 0.2) : 0) + j.x,
             y: m.slot.y + j.y, z: (m.slot.z ?? 0) * side + j.z },
      r: m.slot.r, shape: m.slot.shape, side: m.slot.side === 'paired' ? (side > 0 ? 'right' : 'left') : 'single',
      geometry_basis: 'schematic' };
    parts.push(p);
    placedById.set(base.id, p);
    if (n.iri) placedById.set(String(n.iri), p);
  }

  // Does the ontology place this part in this organism at all? From sim-engine/scales/audit-taxon.mjs.
  // A part the theatre draws without this is a part a reader will assume belongs there.
  const taxVerdict = new Map((taxonAudit?.parts ?? []).map(r => [r.iri ?? r.id, r]));
  for (const p of parts) {
    const t = taxVerdict.get(p.id) ?? taxVerdict.get(`http://purl.obolibrary.org/obo/${p.ontology_id}`) ?? null;
    p.taxon_evidence = t ? { verdict: t.verdict, why: t.why, in_taxon: t.in_taxon, ranks_above: t.ranks_above_the_organism }
      : { verdict: p.from === 'chain' ? 'from-the-literature-not-the-blueprint' : 'not-audited',
          why: p.from === 'chain' ? 'this part is named by the literature chain, not by the blueprint, so there is no blueprint claim to audit' : 'no taxon audit has been run for this generation (node sim-engine/scales/audit-taxon.mjs)' };
  }

  // Attach the four kinds of statement.
  for (const p of parts) {
    p.laws = lawsForPart(p, { partLaws, lawRecords, taxon, ancestors, available, verdicts, verdictFrom, inapplicable });
    p.checks = checksForPart(p, checks);
    p.chain_links = chainForPart(p, chain);
    if (!p.laws.length) p.no_law_reaches = 'No entry in sim-engine/scales/part-laws.json matches this part at this level. That is the commonest outcome, and it means no machine-checked statement in this repository is about it.';
  }

  // GHOST PARTS: anatomy the literature names and the blueprint does not contain.
  //
  // This exists because of what the fruit-fly run showed the moment the two layers were joined. The chain
  // lands on the adult fat body and the adult brain -- the two organs the longevity experiments act in -- and
  // the blueprint for Drosophila melanogaster contains neither. What it does contain is bone marrow, hyaline
  // cartilage, a penis and a uropygial gland. The counts passed; the content is substantially a mammal's.
  //
  // A silent failure to join would have hidden that. Instead a link whose anatomy is missing is attached to
  // the frame SLOT it belongs in and drawn as a ghost, marked `blueprint_has_it: false`. The chain stays
  // clickable and the hole is on screen, which is the only honest way round: the reader learns both that the
  // literature has an answer and that this repository's phenotype layer cannot hold it.
  const ghosts = [];
  for (const l of chain?.links ?? []) {
    const lo = l.lands_on ?? {};
    if (!blueprint) continue;                                // a refusal has no body, so it has no holes either
    if (!lo.label || !lo.ontology_id) continue;              // a pathway rung has no anatomy to miss
    // A phenotype and a cell-cell interaction are not anatomy: a lifespan is not a part and an interaction
    // between two cell types is not a place. Ghosting them would put a process on the body.
    if (['phenotype', 'pathway', 'cell_cell'].includes(l.to?.level)) continue;
    if (parts.some(p => chainForPart(p, { links: [l] }).length)) continue;
    const want = { id: String(lo.ontology_id), label: lo.label, level: l.to?.level ?? 'organ' };
    const m = matchSlot(want, picked.frame);
    const key = `ghost:${want.id}`;
    let gp = ghosts.find(x => x.id === key);
    if (!gp) {
      const j = jitter(key, 0.05);
      gp = { id: key, label: lo.label, ontology_id: want.id, level: want.level, parent: null,
        slot: m?.slot?.slot ?? 'unplaced', matched_by: m ? `${m.matched_by} (from the literature chain, not the blueprint)` : 'no slot in this frame matches it either',
        pos: m ? { x: m.slot.x + j.x, y: m.slot.y + j.y, z: (m.slot.z ?? 0) + j.z } : null,
        r: (m?.slot?.r ?? 0.1) * 0.8, shape: m?.slot?.shape ?? 'sphere', side: 'single',
        geometry_basis: 'schematic', from: 'chain', blueprint_has_it: false,
        why: `The literature chain names this anatomy, and the blueprint for ${taxon ?? 'this organism'} does not contain it. It is drawn from the frame slot so the chain stays clickable; nothing in the phenotype layer asserts this part exists in the design.`,
        laws: [], checks: [], chain_links: [] };
      ghosts.push(gp);
    }
    gp.chain_links.push({ ...l, basis: 'literature' });
  }
  for (const g of ghosts) {
    g.laws = lawsForPart(g, { partLaws, lawRecords, taxon, ancestors, available, verdicts, verdictFrom, inapplicable });
    if (g.pos) parts.push(g); else unplaced.push({ ...g, why: `${g.why} No slot matches it, so it has no position.` });
  }
  if (ghosts.length) honesty.push(`${ghosts.length} part(s) are named by the literature chain and ABSENT from the blueprint (${ghosts.map(g => g.label).join(', ')}). They are drawn as ghosts, marked blueprint_has_it: false. For the fruit fly these are the very organs the longevity experiments act in.`);

  // The molecule rung, from the blueprint's own marker annotations.
  const molecules = [];
  for (const m of blueprint?.genome_sketch?.markers ?? []) {
    const cellId = String(m.cell ?? '').replace('http://purl.obolibrary.org/obo/', '');
    const host = parts.find(p => p.ontology_id === cellId) ?? null;
    for (const g of m.gene_products ?? []) {
      const id = String(g.iri ?? g.label).replace('http://purl.obolibrary.org/obo/', '');
      const j = jitter(id, 0.1);
      molecules.push({ id, label: g.label, ontology: g.ontology, level: 'molecule',
        cell: cellId, cell_label: m.cell_label, placed_on: host?.id ?? null,
        pos: host ? { x: host.pos.x + j.x, y: host.pos.y + j.y, z: host.pos.z + j.z } : null,
        basis: 'declared',
        what_it_is: 'a gene product the Protein Ontology annotates as a marker of this cell type. A MARKER ANNOTATION, not an expression measurement in this organism, and not evidence that it does anything here.' });
    }
  }
  if (molecules.length) honesty.push(`The ${molecules.length} molecules are marker annotations from the Protein Ontology, carried by the blueprint. None of them was measured in this organism and none is evidence of function.`);

  // STORE EACH LAW ONCE. A chip's label, statement text, theorem, module and links are the same on every part
  // it reaches; only its status, reason and quantities vary with the part. Repeating the static text put
  // 18,465 copies of it in the mouse bundle alone (29 MB). Static fields go to `law_static`, and a chip keeps
  // what varies. The laws that reach EVERY part are stored once in `universal_laws`: their status depends on
  // scope and quantities, which do not depend on the part, so a per-part copy would only repeat itself.
  const STATIC = ['label', 'level', 'about', 'how', 'theorem', 'module', 'line', 'proof_link', 'claim_link', 'nanopub', 'pin', 'formal_status', 'needs'];
  const law_static = {};
  let universal_laws = [];
  for (const p of parts) {
    const keep = [];
    for (const c of p.laws ?? []) {
      if (!law_static[c.law_id]) law_static[c.law_id] = Object.fromEntries(STATIC.map(k => [k, c[k]]));
      const slim = { law_id: c.law_id, status: c.status, because: c.because, basis: c.basis, universal: c.universal,
        missing: c.missing, missing_where: c.missing_where, cannot_be_supplied: c.cannot_be_supplied,
        supplied: (c.supplied ?? []).map(x => ({ field: x.field, basis: x.basis, kind: x.kind })) };
      if (c.universal) { if (p.level === 'body' || !universal_laws.length) universal_laws = universal_laws.filter(u => u.law_id !== c.law_id).concat(slim); }
      else keep.push(slim);
    }
    p.laws = keep;
    if (!keep.length) p.no_law_reaches = 'No law in sim-engine/scales/part-laws.json is specifically about this part. The laws that reach every part of every organism are listed once, for the whole body.';
    else delete p.no_law_reaches;
  }

  const ladder = Object.fromEntries(LEVELS.map(l => [l, 0]));
  for (const p of parts) if (l_in(ladder, p.level)) ladder[p.level]++;
  ladder.molecule = molecules.length;
  ladder.pathway = new Set((chain?.links ?? []).filter(l => l.to?.level === 'pathway').map(l => l.to.id)).size;
  ladder.cell_cell = (chain?.links ?? []).filter(l => l.to?.level === 'cell_cell' || l.from?.level === 'cell_cell').length;

  const lawChips = [...parts.flatMap(p => p.laws ?? []), ...universal_laws];
  const byStatus = {};
  for (const l of lawChips) byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;

  if (!chain) honesty.push('No scale ladder of literature links exists for this run, so the molecule, pathway and cell-cell rungs carry nothing but marker annotations. The chain from a protein to an organ is ABSENT, not implied.');
  else {
    honesty.push(`The molecular rungs are LITERATURE in ${(chain.organism?.evidence_species ?? ['another species']).join(', ')}, each link graded and quoted. ${chain.species_caveat ?? ''}`);
    for (const g of chain.missing_rungs ?? []) honesty.push(`Rung ${(g.between ?? []).join(' -> ')} is MISSING: ${g.why}`);
  }
  if (byStatus['out-of-scope']) honesty.push(`${byStatus['out-of-scope']} law chips are out of scope for this organism: the law is about the right quantity and its numbers belong to another clade.`);
  if (byStatus['wrong-quantity']) honesty.push(`${byStatus['wrong-quantity']} law chips say the law is the WRONG QUANTITY for this organism, which is a different refusal from a missing measurement.`);
  if (taxonAudit?.counts) {
    const c = taxonAudit.counts, tot = taxonAudit.total ?? 0;
    honesty.push(`THE ONTOLOGY BARELY PLACES THIS BODY IN THIS ORGANISM. Of ${tot} parts the blueprint returned, ${c.placed ?? 0} have an in_taxon restriction specific enough to be evidence that ${taxon} has them; ${c['placed-vacuously'] ?? 0} are restricted only to a clade containing most of the animal kingdom, and ${c.unconstrained ?? 0} carry no restriction at all. The blueprint keeps a part unless a constraint removes it, so most of what is drawn here is unevidenced rather than wrong.`);
  }
  honesty.push('No part in this view has measured geometry. Every position is a declared slot in sim-engine/scales/body-frames.json, and a shape is a primitive, not a morphology.');

  return {
    contract_version: CONTRACT_VERSION, run, generation, asked,
    built: new Date().toISOString(),
    organism: { label: taxon, taxon, kind: isConstruct ? 'construct' : 'taxon',
      made_from: gen?.organism?.made_from ?? null,
      clade_path: ancestors.slice(0, 10), taxid: taxonomy?.TAXA?.[taxon]?.taxid ?? null },
    frame: { name: picked.name, label: picked.frame.label, why: picked.why,
      geometry_basis: 'schematic', silhouette: picked.frame.silhouette ?? null,
      axes: frames.axes, slots: picked.frame.slots ?? [], has_no: forbidden,
      THIS_IS_NOT_MORPHOMETRY: frames.THIS_IS_NOT_MORPHOMETRY },
    parts, unplaced, molecules, law_static, universal_laws,
    chain: chain ? { present: true, source: `runs/_chains/${run}.json`, requirement: chain.requirement,
      species_caveat: chain.species_caveat, links: chain.links ?? [], missing_rungs: chain.missing_rungs ?? [],
      grades: countBy(chain.links ?? [], l => l.evidence_grade), verification: chain.verification ?? null }
      : { present: false, why: 'no runs/_chains/<run>.json for this run' },
    checks, available_quantities: available,
    timeline: timeline({ states, stages: gen?.declared?.life_stages ?? gen?.life_stages ?? [], parts }),
    counts: { parts: parts.length, unplaced: unplaced.length, ladder, law_chips: lawChips.length, law_status: byStatus,
      checks: checks.length, chain_links: (chain?.links ?? []).length },
    basis_legend: {
      proof: 'a Lean theorem, kernel-checked, with a module and a line',
      check: 'arithmetic in sim-engine/validate/, resting on something undisputed but not formalised',
      literature: 'a graded, quoted link from a paper, usually in another species',
      declared: 'a number a person typed, carrying the source string that says they typed it',
    },
    honesty,
  };
}

const l_in = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const countBy = (xs, f) => xs.reduce((a, x) => { const k = f(x) ?? 'ungraded'; a[k] = (a[k] ?? 0) + 1; return a; }, {});
