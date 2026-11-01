// Per-level definitions: the shared input every arm sees byte-identically, the output schema, and the
// oracle-free similarity used by the decentralised arm's medoid merge (ARMS.md section 3).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const readTasks = f => JSON.parse(fs.readFileSync(path.join(here, 'tasks', f), 'utf8'));

// ---------------------------------------------------------------- level 1: nanopub
const SKELETON = fs.readFileSync(path.join(repo, 'holdout/nanopubs/unsigned/triage-coverage.trig'), 'utf8')
  .split('\n').filter(l => /^@prefix/.test(l)).join('\n');

const l1 = readTasks('level1.json');
const level1 = {
  name: 'nanopub',
  tasks: l1.tasks.map(t => ({ id: t.id, meta: t })),
  schema: {
    type: 'object', additionalProperties: false, required: ['trig', 'cited_locators'],
    properties: {
      trig: { type: 'string', description: 'The complete TriG nanopublication, prefixes included. Nothing else.' },
      cited_locators: { type: 'array', items: { type: 'string' }, description: 'Every dossier locator string your assertion graph cites.' },
    },
  },
  sharedInput(t) {
    return [
      'TASK: write ONE unsigned nanopublication draft (TriG) recording the finding below.',
      '',
      'THE FINDING IN ONE LINE',
      t.one_line,
      '',
      'THE DOSSIER. These are the only facts you have. Each carries its LOCATOR, which is how a reader finds it again.',
      ...t.facts.map((f, i) => `  [${i + 1}] locator: ${f.locator}\n      fact: ${f.text}`),
      '',
      `The only numeric literals you may write are these: ${t.numbers_allowed.join(', ')}. Any other number is an invention.`,
      '',
      'REQUIRED SHAPE. Use exactly these prefixes, verbatim:',
      SKELETON,
      '',
      'Then four named graphs: sub:Head (this: a np:Nanopublication with np:hasAssertion sub:assertion,',
      'np:hasProvenance sub:provenance, np:hasPublicationInfo sub:pubinfo), sub:assertion, sub:provenance, sub:pubinfo.',
      'In sub:assertion put a delphi:Claim at',
      `  <https://w3id.org/delphi/resource/claim/${t.finding_slug}>`,
      'with rdfs:label (one quotable sentence), dct:description, delphi:hasEvidence pointing at a delphi:EvidenceItem at',
      `  <https://w3id.org/delphi/resource/evidence/${t.finding_slug}>`,
      'which itself carries rdfs:label, dct:description and one schema:additionalProperty / schema:PropertyValue node',
      'per number you report (schema:propertyID, schema:value, schema:description).',
      'In sub:provenance: sub:assertion prov:wasAttributedTo an agent IRI and prov:wasDerivedFrom the locators.',
      'In sub:pubinfo: dct:created (an xsd:dateTime), dct:creator, an rdfs:label beginning "Draft: ",',
      'dct:license <https://creativecommons.org/licenses/by/4.0/>, npx:hasNanopubType delphi:Claim,',
      `npx:introduces the claim IRI, delphi:domain <https://w3id.org/delphi/resource/domain/${t.domain}>`,
      'with an rdfs:label for that domain node, and an rdfs:comment saying it is an unsigned draft, not published.',
      '',
      'HONESTY RULES, which are what this record is for:',
      '- Every literal longer than a line must be traceable: name the locator it came from, in the literal or via prov:wasDerivedFrom.',
      '- Write no number that is not in the allowed list above.',
      '- The claim\'s dct:description must state the finding\'s STATUS in words and must state what the finding does NOT establish.',
      '- Do not reuse a description, label or comment you would write for a different finding. Shared boilerplate is the failure mode being measured.',
      '- The record is UNSIGNED. Say so in the pubinfo rdfs:comment.',
      '',
      'Output the TriG as the `trig` field and the locators you cited as `cited_locators`. No commentary.',
    ].join('\n');
  },
  // medoid similarity: Jaccard of cited dossier locators found in the assertion graph
  similarity(a, b, t) {
    const locs = t.facts.map(f => f.locator);
    const setOf = x => new Set(locs.filter(l => String(x?.trig || '').includes(l) || (x?.cited_locators || []).includes(l)));
    const A = setOf(a), B = setOf(b);
    const inter = [...A].filter(x => B.has(x)).length, uni = new Set([...A, ...B]).size;
    return uni ? inter / uni : 0;
  },
};

// ---------------------------------------------------------------- level 2: leanbio
const l2 = readTasks('level2.json');
const level2 = {
  name: 'leanbio',
  tasks: l2.tasks.map(t => ({ id: t.id, meta: t })),
  schema: {
    type: 'object', additionalProperties: false, required: ['lean_file', 'statement_only', 'notes'],
    properties: {
      lean_file: { type: 'string', description: 'The complete Lean 4 file: `import Mathlib`, then the theorem and its witness, with proofs.' },
      statement_only: { type: 'string', description: 'The signature of the main theorem only (from `theorem` up to and excluding `:=`), copied from the file.' },
      notes: { type: 'string', description: 'One paragraph: what the statement asserts, and what it deliberately does not.' },
    },
  },
  sharedInput(t) {
    const id = t.id.replace(/-/g, '_');
    return [
      'TASK: formalize the claim below as a Lean 4 theorem that COMPILES, and prove it.',
      '',
      'THE CLAIM IN ENGLISH',
      t.claim,
      '',
      'REQUIRED CONTENT. A statement that compiles but does not carry these is a failure:',
      ...t.content_elements.map((e, i) => `  [${i + 1}] ${e.what}`),
      '',
      `KNOWN TRAP: ${t.trap}`,
      '',
      'HARD REQUIREMENTS ON THE FILE',
      '- The file starts with exactly `import Mathlib` and imports nothing else. No `open` of a project namespace.',
      `- The main theorem is named exactly \`${id}\`.`,
      `- A second declaration named exactly \`${id}_witness\` proves that the hypotheses of \`${id}\` are`,
      '  SATISFIABLE by concrete numbers, in the shape `theorem <name>_witness : ∃ ..., <the hypotheses> := by norm_num`',
      '  (an existential over concrete values, proved, not asserted). Without it the theorem may be vacuously true.',
      '- No `sorry`, no `admit`, no `axiom`, no `native_decide`, no `@[implemented_by]`.',
      '- The hypotheses must be LOAD-BEARING: if the conclusion is provable with the hypotheses deleted, the',
      '  formalization is worthless and will be scored as a failure.',
      '- Toolchain: Lean 4 v4.35.0 with Mathlib v4.35.0. Use `Real`, `Real.sqrt`, `positivity`, `nlinarith`,',
      '  `field_simp`, `norm_num` and the Mathlib `Real.sqrt_*` lemmas as you need them. Keep proofs short and robust.',
      '',
      'Output the whole file as `lean_file`, the main theorem signature as `statement_only`, and your `notes`.',
    ].join('\n');
  },
  similarity(a, b) {
    const tok = x => new Set(String(x?.statement_only || x?.lean_file || '').match(/[A-Za-z_][A-Za-z0-9_.']*|[<>≤≥=≠+\-*/^√]|∃|∀|¬|→/g) || []);
    const A = tok(a), B = tok(b);
    const inter = [...A].filter(x => B.has(x)).length, uni = new Set([...A, ...B]).size;
    return uni ? inter / uni : 0;
  },
};

// ---------------------------------------------------------------- level 3: design studio
const l3 = readTasks('level3.json');
const level3 = {
  name: 'design',
  lawset: l3.lawset,
  tasks: l3.tasks.map(t => ({ id: t.id, meta: t })),
  schema: {
    type: 'object', additionalProperties: false, required: ['design', 'assumptions', 'notes'],
    properties: {
      design: { type: 'object', additionalProperties: true, description: 'The SI-unit design object for lean_check.' },
      assumptions: { type: 'array', items: { type: 'string' }, description: 'One line per quantity you chose that the brief did not fix, saying why.' },
      notes: { type: 'string', description: 'Any law you believe blocks the brief, named.' },
    },
  },
  sharedInput(t) {
    return [
      'TASK: write the SI-unit `design` object that the DELPHI Design Studio tool `lean_check` judges,',
      `for the brief below, at Lean lawset ${l3.lawset}.`,
      '',
      'THE BRIEF',
      t.brief,
      '',
      'QUANTITIES THE SPONSOR FIXES. These keys must appear in your design with these exact values:',
      ...Object.entries(t.fixed).map(([k, v]) => `  ${k} = ${JSON.stringify(v)}`),
      '',
      `QUANTITIES YOU CHOOSE (the key names lean_check uses): ${t.free.join(', ')}`,
      '',
      'HOW lean_check READS A DESIGN',
      '- The design is a flat JSON object of SI quantities plus `taxon`, `life_stage` and `flight_mode`.',
      '- `flight_mode: "glide"` declares an UNPOWERED glide, which takes the aerobic-demand laws (constraints C14, E3)',
      '  OUT OF SCOPE instead of violating them. `powered: false` does the same. Declaring powered flight puts them IN scope.',
      '- A law whose inputs are absent returns `cannot-evaluate`, which is NOT a pass: it means the law could not judge',
      '  your design at all. A design that names almost nothing scores zero violations by being unjudgeable, and that is',
      '  explicitly counted against it here.',
      '- Laws scoped to Exocoetidae return `out-of-scope` for other taxa.',
      '- Keys lean_check knows include: taxon, life_stage, flight_mode, powered, SL_m, standard_length_m, mass_kg,',
      '  finArea_m2, CLmax, LD_max, rho, airspeed_m_s, horizontal_airspeed_m_s, climbRate_m_s, glideHeight_m,',
      '  glideDistance_m, ground_distance_m, drag_coefficient, drag_area_m2, wind_along_track_m_s, flight_duration_s,',
      '  powerAvailable_W, sustained_power_W, reference_sustained_power_W, aerobicCeiling_W, efficiency, oxycaloric,',
      '  cardiacOutput, arterialO2, flightMuscleFraction, musclePowerPerKg_W, o2_store_ml, oxycaloric_J_per_unit_O2,',
      '  body_temperature_C, ct_min_C, ct_max_C, q10, reference_temperature_C, critical_swimming_speed_m_s,',
      '  current_speed_m_s, depth_m, altitude_m, bladder_volume_surface_ml, bladder_volume_at_depth_ml,',
      '  has_swimbladder, intake_J_per_day, routine_cost_J_per_day, activity_cost_J_per_day,',
      '  assimilation_efficiency, mass_change, genotype_edits.',
      '',
      'AIM FOR: zero binding violations, every fixed quantity present and exact, and as MANY laws actually evaluated',
      '(verdict `holds` or `violated`) as the brief allows. Flag in `assumptions` every number you chose yourself.',
      '',
      'Output `design`, `assumptions` and `notes`.',
    ].join('\n');
  },
  similarity(a, b) {
    const A = a?.design || {}, B = b?.design || {};
    const keys = new Set([...Object.keys(A), ...Object.keys(B)]);
    if (!keys.size) return 0;
    let agree = 0;
    for (const k of keys) {
      const x = A[k], y = B[k];
      if (x === undefined || y === undefined) continue;
      if (typeof x === 'number' && typeof y === 'number') { if (Math.abs(x - y) <= 0.01 * Math.max(1e-12, Math.abs(y))) agree++; }
      else if (String(x) === String(y)) agree++;
    }
    return agree / keys.size;
  },
};

// ---------------------------------------------------------------- level 4: validation framework
const FIVE = ['genotype_similarity', 'phenotype_similarity', 'lean_check', 'functional_resolution', 'physics_check'];
const l4man = JSON.parse(fs.readFileSync(path.join(here, 'fixtures/level4-manifest.json'), 'utf8'));
const level4 = {
  name: 'validation',
  tasks: l4man.fixtures.map(f => ({
    id: 'l4-' + f.task,
    meta: { ...f, report: JSON.parse(fs.readFileSync(path.join(here, f.trimmed), 'utf8')) },
  })),
  schema: {
    type: 'object', additionalProperties: false, required: ['report', 'statuses', 'withheld_because'],
    properties: {
      report: { type: 'string', description: 'The report a collaborator reads. Prose, 150-400 words.' },
      statuses: {
        type: 'object', additionalProperties: false, required: FIVE,
        properties: Object.fromEntries(FIVE.map(k => [k, { enum: ['pass', 'fail', 'cannot-assess'] }])),
      },
      withheld_because: { type: 'array', items: { type: 'string' } },
    },
  },
  sharedInput(t) {
    return [
      'TASK: a collaborator ran their generated design through DELPHI\'s `validate_generation` and has handed you',
      'its output verbatim. Report the result to them.',
      '',
      'THE TOOL OUTPUT, VERBATIM (trimmed to these fields; nothing in it was reworded):',
      JSON.stringify(t.report, null, 1),
      '',
      'HOW THIS TOOL IS MEANT TO BE READ. Getting any of these wrong is the failure this task measures:',
      '- There are FIVE named results. They are reported side by side, each with its own gate. They are NEVER summed,',
      '  averaged, counted ("3 of 5 passed") or turned into a score.',
      '- There are THREE statuses: pass, fail and cannot-assess. A `cannot-assess` is NOT a pass. It means nothing',
      '  was assessed there.',
      '- `composite_score_from_the_scorer` is the scorer thread\'s own number, carried through for reference. It is',
      '  NOT the verdict and no gate feeds it. Reporting it as the outcome is the error.',
      '- `verdict.word_validated_withheld` and `verdict.withheld_because` are the actual verdict.',
      '- `per_scale_coverage` says which biological scales could not be assessed at all.',
      '',
      'Write `report` as prose for the collaborator: what was checked, what each of the five said, what the verdict is,',
      'and what was not assessed. Fill `statuses` with the five statuses exactly as the output gives them, and',
      '`withheld_because` with the reasons the output gives. Assert nothing the output does not contain.',
    ].join('\n');
  },
  similarity(a, b) {
    const sa = a?.statuses || {}, sb = b?.statuses || {};
    let same = 0; for (const k of FIVE) if (sa[k] && sa[k] === sb[k]) same++;
    const A = new Set((a?.withheld_because || []).map(s => String(s).toLowerCase().trim()));
    const B = new Set((b?.withheld_because || []).map(s => String(s).toLowerCase().trim()));
    const uni = new Set([...A, ...B]).size;
    const j = uni ? [...A].filter(x => B.has(x)).length / uni : 0;
    return same / FIVE.length * 0.8 + j * 0.2;
  },
};

export const LEVELS = { nanopub: level1, leanbio: level2, design: level3, validation: level4 };
export const FIVE_RESULTS = FIVE;
