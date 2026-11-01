// validate_generation: the unifying entry point, in Amit's words (2026-11-01):
//
//   "the text input to the model should also be provided to the validator; so input is generated genomic
//    sequence + base genomic sequence & desired phenotype. Processor identifies functional analogue and fetches
//    that genotype, and then analyzes functional annotations at every biological scale, verifies LeanBio, and
//    checks physics."
//
// This file ORCHESTRATES. It computes nothing that another thread owns: the scorer owns the similarity results
// and the Lean check, the functional thread owns the ledger, the physics thread owns the physics, the editplan
// thread owns the GRCz11 coordinate mapping, the spec thread owns the text parser, and the omics layers own
// every annotation. What is new here is the ORDER, the fact that the desired phenotype is carried into every
// step (today the components run without it), the multi-scale annotation sweep, and the honesty accounting:
// what was given, what was not parsed, what no scale could answer.
//
// Order, as specified:
//   0. text -> DesignSpec (parse-text.mjs), with the unparsed remainder kept verbatim
//   1. resolve the inputs and state the sequence basis up front
//   2. functional analogue FROM THE DESIRED FUNCTION, and fetch its genotype
//   3. multi-scale annotation sweep over every difference and every requirement
//   4. functionalResolution (functional thread)
//   5. lean_check (scorer thread)
//   6. physicsCheck (physics thread), with the spec as its target function
//   7. one report: five named results, five gates, nothing summed, and a verdict SENTENCE
//
// Nothing is summed into one number, and the word "validated" is withheld whenever a gate failed or a scale
// could not be assessed.

import { parseDesignText } from '../../lib/parse-text.mjs';
import { loadBundle } from '../../lib/data-node.mjs';
import * as O from '../../lib/organism.mjs';
import { assess, namedResults } from '../score.mjs';
import { resolveSide, sequenceBasis, geneEditsOf, reconstructAtEditedLoci } from './inputs.mjs';
import { analogueFromFunction, compareWithLedgerAnalogue, FUNCTION_ANALOGUES } from './analogue.mjs';
import { multiScaleSweep, SCALES, fullManifest } from './scales.mjs';
import { genotypeGate, phenotypeGate, leanGate, functionalGate, physicsGate, verdictSentence } from './gates.mjs';
import { loadPhysics, loadEditplan, loadFunctionalInterface } from './deps.mjs';

export const VERSION = '1.0.0';
export const SCOPE = 'A validation REPORT, not a validity claim. Five named results are reported side by side with their own gates and are never summed; a composite score, if the scorer produced one, is carried through as the scorer\'s own number and is not this report\'s verdict. Every annotation in the multi-scale sweep is a proxy-species record (zebrafish, medaka, Mexican tetra) or an annotation borrowed from a human or mouse orthologue: none is a measurement of the designed organism and none is a measurement of the flying fish. Absence of a record means "not recorded", never "not present". Birds (Aves) are a frozen holdout and appear in no reference set, no analogue and no annotation. MORPHOLOGICAL designs are shapes, not organisms: a parameter delta is not an allele, a pathway or a developmental programme.';

const PIPELINE_ORDER = ['parse-desired-phenotype', 'resolve-inputs', 'functional-analogue-from-function', 'multi-scale-annotation-sweep', 'functional-resolution', 'lean-check', 'physics-check'];

/**
 * @param {object}        a
 * @param {string|object} a.generated          design id, organism document, FASTA/plain sequence file, or a sequence
 * @param {string|object} a.base               same forms
 * @param {string}        a.desired_phenotype  free text
 * @param {object}        [a.opts]             { network, lawset, ageDays, conditions, reference_set_excluding, extraGenes }
 */
export async function validateGeneration({ generated, base, desired_phenotype, opts = {} } = {}) {
  const t0 = Date.now();
  const notes = [];
  const network = opts.network === true;

  // ------------------------------------------------------------------ 0. the desired phenotype, as text and as a spec
  const parsed = parseDesignText(desired_phenotype ?? '');
  const desired = {
    text: typeof desired_phenotype === 'string' ? desired_phenotype : null,
    text_given: typeof desired_phenotype === 'string' && !!desired_phenotype.trim(),
    parser: 'sim-engine/lib/parse-text.mjs parseDesignText()',
    spec: parsed.spec,
    criteria_parsed: (parsed.spec.criteria || []).length,
    criteria: (parsed.spec.criteria || []).map(c => ({ id: c.id, scenario: c.scenario ?? null, metric: c.metric ?? null, op: c.op, value: c.value ?? null, unit: c.unit ?? null, params: c.params ?? null, stages: c.stages ?? null, hard: c.hard, source_text: c.source_text ?? null })),
    // VERBATIM. An unparsed requirement is an unchecked requirement, so it is carried to the top of the report
    // and into the verdict sentence, never summarised away.
    unparsed_verbatim: (parsed.unparsed || []).map(u => ({ text: u.text, reason: u.reason, ...(u.leftover ? { leftover: u.leftover } : {}) })),
    refused_verbatim: (parsed.refused || []).map(r => ({ text: r.text, reason: r.reason })),
    assumptions: parsed.assumptions || [],
    unparsed_warning: (parsed.unparsed || []).length
      ? `${(parsed.unparsed || []).length} clause(s) of the desired phenotype were NOT parsed into any criterion. An unparsed requirement is an UNCHECKED requirement: nothing below tests these, and their text is reproduced verbatim above.`
      : null,
  };
  if (!desired.text_given) notes.push('no desired phenotype text was supplied: the validator ran with no target function, so no criterion was checked and the physics step had nothing to aim at');

  // ------------------------------------------------------------------ 1. the inputs, and the sequence basis
  const bundle = await loadBundle();
  const knownIds = Object.keys(bundle.organisms || {});
  const gen = resolveSide(generated, { role: 'generated', knownOrganismIds: knownIds });
  const bas = resolveSide(base, { role: 'base', knownOrganismIds: knownIds });

  const docOf = side => {
    if (side.given === 'document') return side.document;
    if (side.given === 'design-id') { try { return O.docFor(bundle, side.id); } catch (e) { side.note = `design id did not resolve: ${e.message}`; return null; } }
    return null;
  };
  const genDoc = docOf(gen), basDoc = docOf(bas);
  const genId = genDoc?.id ?? gen.id ?? null, basId = basDoc?.id ?? bas.id ?? null;

  const geneEdits = genDoc ? geneEditsOf(genDoc) : [];
  let reconstruction = null;
  if (geneEdits.length) {
    const ep = await loadEditplan();
    reconstruction = await reconstructAtEditedLoci(geneEdits, { editplan: ep, network });
  }
  const seq = sequenceBasis({ generated: gen, base: bas, editedLoci: geneEdits, reconstruction });

  // ------------------------------------------------------------------ the difference set
  const differences = [];
  let genParams = null, basParams = null;
  if (genDoc && basDoc) {
    try {
      genParams = O.resolveParameters(bundle, genDoc).params;
      basParams = O.resolveParameters(bundle, basDoc).params;
      for (const k of Object.keys(genParams)) {
        const a = genParams[k], b = basParams[k];
        if (!a || !b) { differences.push({ kind: 'parameter', parameter: k, base_value: b?.value ?? null, generated_value: a?.value ?? null, direction: 'present on one side only', note: 'this parameter exists on only one of the two organisms' }); continue; }
        if (JSON.stringify(a.value) === JSON.stringify(b.value)) continue;
        const num = typeof a.value === 'number' && typeof b.value === 'number';
        differences.push({
          kind: 'parameter', parameter: k, base_value: b.value, generated_value: a.value,
          direction: num ? (a.value > b.value ? 'increase' : 'decrease') : 'changed',
          ratio: num && b.value !== 0 ? +(a.value / b.value).toFixed(6) : null,
          generated_kind: a.kind, base_kind: b.kind, generated_source: a.source ?? null,
        });
      }
    } catch (e) { notes.push(`parameter diff failed: ${e.message}`); }
  } else {
    notes.push(`no parameter diff: ${genDoc ? 'the base' : 'the generated'} side is not an organism document, so the two sides cannot be compared parameter by parameter`);
  }
  for (const e of geneEdits) differences.push({ kind: 'gene', gene: e.gene ?? e.target ?? null, edit: e.raw ?? e.genotype ?? null, level: e.level ?? 'gene' });
  if (gen.given === 'sequence' && bas.given === 'sequence') {
    const n = Math.min(gen.sequences.length, bas.sequences.length);
    for (let i = 0; i < n; i++) {
      const g = gen.sequences[i].seq, b = bas.sequences[i].seq;
      if (g === b) continue;
      let mism = 0; const L = Math.min(g.length, b.length);
      for (let j = 0; j < L; j++) if (g[j] !== b[j]) mism++;
      differences.push({ kind: 'sequence', record: gen.sequences[i].id, base_record: bas.sequences[i].id, length_bp: { generated: g.length, base: b.length },
        aligned_positions_compared: L, mismatches_in_the_aligned_prefix: mism, length_difference_bp: g.length - b.length,
        method: 'position-by-position comparison of the aligned prefix only; NO alignment was performed, so an indel shifts every position after it and the mismatch count above is an upper bound, not a variant call' });
    }
  }

  // ------------------------------------------------------------------ 2. the functional analogue, from the function
  const analogue = analogueFromFunction(parsed.spec, { baseId: basId });
  // Does each difference move toward or away from the analogue? The honest reading of a subtraction design.
  const analogueOrganisms = (analogue.analogues || []).map(a => a.repo_organism).filter(Boolean);
  for (const a of analogueOrganisms) {
    let ap = null;
    try { ap = O.resolveParameters(bundle, O.docFor(bundle, a)).params; } catch { /* not a bundle organism */ }
    if (!ap) continue;
    for (const d of differences) {
      if (d.kind !== 'parameter' || typeof d.base_value !== 'number' || typeof d.generated_value !== 'number') continue;
      const t = ap[d.parameter]?.value;
      if (typeof t !== 'number') continue;
      d.toward_the_analogue = d.toward_the_analogue || {};
      d.toward_the_analogue[a] = {
        analogue_value: t,
        moved: Math.abs(d.generated_value - t) < Math.abs(d.base_value - t) ? 'toward the analogue' : Math.abs(d.generated_value - t) > Math.abs(d.base_value - t) ? 'AWAY from the analogue' : 'no change in distance',
        base_distance: +Math.abs(d.base_value - t).toPrecision(6), generated_distance: +Math.abs(d.generated_value - t).toPrecision(6),
        note: 'a parameter distance, not a functional one: moving a shape parameter toward the analogue\'s value is not evidence that the function follows',
      };
    }
  }

  // ------------------------------------------------------------------ 3. the multi-scale annotation sweep
  // The FULL manifest from disk: the bundle's copy is trimmed and drops ontology_label, levels, hypothetical
  // and geometry_basis, all of which the anatomy scales report.
  const manifestFull = genId ? fullManifest(genId) : null;
  const manifest = manifestFull ?? (genDoc ? (O.primaryManifest(bundle, genDoc) ?? null) : null);
  if (genId && !manifestFull) notes.push(`no blueprint3d anatomy manifest was found for "${genId}", so the anatomical scales fall back to the bundle's trimmed copy (no ontology labels, no declared level list) or report nothing`);
  const focal = (analogue.analogues || []).map(a => a.genotype).find(g => g?.ran) ?? null;

  // The scorer first, because the sweep reads its per-site conservation for any real gene edit.
  let scored = null, named = null;
  try {
    scored = await assess({ organism: genDoc ?? genId ?? undefined, network, lawset: opts.lawset, ageDays: opts.ageDays, conditions: opts.conditions, exclude: opts.reference_set_excluding, spec: desired.criteria_parsed ? parsed.spec : undefined, design_for_functional: genDoc ?? genId ?? undefined });
    named = namedResults(scored);
  } catch (e) {
    notes.push(`the scorer (validate/score.mjs assess) did not run: ${e.message}`);
  }

  const scales = multiScaleSweep({
    differences, manifest, requirements: analogue.requirement_set,
    focal, genotypeSim: named?.genotype_similarity ?? null, extraGenes: opts.extraGenes || [],
  });

  // ------------------------------------------------------------------ 4. the functional ledger
  let ledger = named?.functional_resolution ?? null;
  if (!ledger) {
    const fi = await loadFunctionalInterface();
    if (fi.ok) {
      try { ledger = await fi.m.functionalResolutionFor(genDoc ?? genId, { network, lawset: opts.lawset, ageDays: opts.ageDays, reference_set_excluding: opts.reference_set_excluding }); }
      catch (e) { ledger = { ran: false, reason: `the functional ledger threw: ${e.message}` }; }
    } else ledger = { ran: false, reason: fi.reason };
  }
  const analogueAgreement = compareWithLedgerAnalogue(analogue, ledger);

  // ------------------------------------------------------------------ 6. physics, with the spec as its target
  const ph = await loadPhysics();
  let physics;
  if (!ph.ok) physics = { ran: false, reason: ph.reason, would_have_been_called_with: { design: genId, target_function: desired.criteria.filter(c => c.scenario === 'glide' || c.scenario === 'altitude' || c.scenario === 'wind').map(c => c.source_text) } };
  else {
    try {
      physics = await ph.fn(genDoc ?? genId, { spec: parsed.spec, desired_phenotype: desired.text, target_function: desired.criteria, base: basId, network, conditions: opts.conditions, ageDays: opts.ageDays });
      if (physics && physics.ran === undefined) physics = { ran: true, ...physics };
      physics.module = ph.module;
      physics.called_with_the_spec_as_target = true;
    } catch (e) { physics = { ran: false, reason: `the physics module threw: ${e.message}`, module: ph.module }; }
  }

  // ------------------------------------------------------------------ 7. the five named results, five gates
  const results = {
    genotype_similarity: { ...genotypeGate(named?.genotype_similarity), result: named?.genotype_similarity ?? null, owner: 'sim-engine/validate/score.mjs (scorer thread)' },
    phenotype_similarity: { ...phenotypeGate(named?.phenotype_similarity), result: named?.phenotype_similarity ?? null, owner: 'sim-engine/validate/score.mjs (scorer thread)' },
    lean_check: { ...leanGate(named?.lean_check), result: named?.lean_check ?? null, owner: 'sim-engine/validate/score.mjs + lean/ (scorer and lean threads)' },
    functional_resolution: { ...functionalGate(ledger), result: ledger, owner: 'sim-engine/validate/functional/ (functional thread), through functional-interface.mjs' },
    physics_check: { ...physicsGate(physics), result: physics, owner: 'sim-engine/validate/physics/ (physics thread)' },
  };

  const inputs = {
    desired_phenotype: desired,
    generated: { given: gen.given, supplied_as: gen.supplied_as, id: genId, file: gen.file ?? null, records: gen.records ?? null, note: gen.note ?? null, is_a_design_document: !!genDoc, parents: genDoc?.base?.parents ?? null, n_edits: genDoc ? (genDoc.edits || []).length : null },
    base: { given: bas.given, supplied_as: bas.supplied_as, id: basId, file: bas.file ?? null, records: bas.records ?? null, note: bas.note ?? null, is_a_design_document: !!basDoc, parents: basDoc?.base?.parents ?? null },
    sequence: seq,
    what_this_means: seq.statement,
  };

  const verdict = verdictSentence({ results, scales, inputs, analogue });

  return {
    tool: 'validate_generation', version: VERSION, scope: SCOPE,
    signature: 'validateGeneration({ generated, base, desired_phenotype, opts }) -- generated genomic sequence + base genomic sequence & desired phenotype (Amit, 2026-11-01)',
    pipeline: { order: PIPELINE_ORDER, ran: PIPELINE_ORDER, desired_phenotype_carried_into: ['functional-analogue-from-function', 'multi-scale-annotation-sweep', 'lean-check (via spec component)', 'physics-check'] },
    inputs,
    differences: { n: differences.length, rule: 'parameter deltas between the resolved parameter sets, gene-level edits in the generated document, and position-by-position sequence differences when real sequence was supplied for both sides', entries: differences },
    analogue: { ...analogue, agreement_with_the_functional_ledger: analogueAgreement },
    scales,
    per_scale_coverage: scales.per_scale_coverage,
    results,
    verdict,
    // Carried for reference only. The version AND whether that version's composite was ever blind-evaluated travel
    // WITH the number (score.mjs evaluationLabel), because a composite read without them is read as a verdict.
    // components_that_ran is part of the number's identity: the same design at the same version returns 0.9217 with
    // no spec, 0.878 with a spec that goes 1 failed / 2 met, and 0.4676 with a spec whose single criterion fails.
    // See sim-engine/validate/SCORER-VERSION.md.
    composite_score_from_the_scorer: scored?.score ? { value: scored.score.value, plausible: scored.score.plausible, version: scored.score.version,
      evaluation: scored.score.evaluation ?? null, components_that_ran: scored.score.components_that_ran ?? null,
      depends_on_the_desired_phenotype_text: !!(desired.criteria_parsed),
      note: 'the scorer thread\'s own frozen number, carried through for reference. It is NOT this report\'s verdict, and no gate above feeds it.'
        + (scored.score.evaluation?.warning ? ` The blind held-out evaluation of scorer v${scored.score.version} did NOT pass this composite: ${scored.score.evaluation.label}` : '')
        + (desired.criteria_parsed ? ` This value INCLUDES the spec component S, computed from the ${desired.criteria_parsed} criteria parsed out of the desired-phenotype TEXT; a criterion the design meets trivially raises it. Without a spec the same design at the same version returns a different number, and the two are not comparable.` : '') } : null,
    notes,
    ms: Date.now() - t0,
  };
}

export { SCALES, FUNCTION_ANALOGUES };
export default validateGeneration;
