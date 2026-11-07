// THE READER: parse a .organism file and refuse it when it would mislead.
//
// A format is only as honest as its strictest reader. This one refuses rather than coerces, because the
// failure mode that matters is not a malformed file - it is a well-formed file whose numbers have quietly
// lost the distinction between measured and assumed somewhere upstream.
//
// Three outcomes, and the middle one is the point:
//
//   ok        every value carries a kind and a scope; the file can be used as data
//   degraded  the file is readable but some values may NOT be treated as data, and the reader says which
//   refused   the file is missing something whose absence would change what a reader believes
//
// A reader that silently accepted a degraded file would make the format worthless, because the second
// program in the chain would have no way to know.

import * as SPEC from './spec.mjs';

export function read(text, { source = 'unknown' } = {}) {
  let doc;
  try { doc = typeof text === 'string' ? JSON.parse(text) : text; }
  catch (e) { return { ok: false, refused: true, why: `not JSON: ${e.message}`, source }; }

  const problems = [];
  const warnings = [];

  // ---- the frame ---------------------------------------------------------------------------------
  if (doc.format !== SPEC.FORMAT) {
    if (typeof doc.format !== 'string' || !doc.format.startsWith('organism/')) {
      return { ok: false, refused: true, why: `not an organism file: format is ${JSON.stringify(doc.format)}`, source };
    }
    warnings.push({ field: 'format', what: `file is ${doc.format}, this reader is ${SPEC.FORMAT}`, consequence: 'fields added or renamed between versions are not interpreted' });
  }
  for (const k of SPEC.REQUIRED_TOP_LEVEL) {
    if (!(k in doc)) problems.push({ field: k, what: 'missing', why: SPEC.WHY_EACH_RULE[`${k}_required`] ?? 'required by the format' });
  }

  // ---- not_established ---------------------------------------------------------------------------
  const ne = Array.isArray(doc.not_established) ? doc.not_established.map(String) : [];
  const missingMin = SPEC.NOT_ESTABLISHED_MINIMUM.filter(m => !ne.some(x => x.toLowerCase().includes(m.toLowerCase().replace(/^that /, ''))));
  if (missingMin.length) {
    problems.push({
      field: 'not_established',
      what: `missing ${missingMin.length} of the ${SPEC.NOT_ESTABLISHED_MINIMUM.length} minimum entries`,
      missing: missingMin,
      why: SPEC.WHY_EACH_RULE.not_established_required,
    });
  }

  // ---- values ------------------------------------------------------------------------------------
  const badValues = [];
  const byKind = {};
  function walkValues(node, pathStr) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach((x, i) => walkValues(x, `${pathStr}[${i}]`)); return; }
    const looksLikeValue = 'v' in node || ('value' in node && ('unit' in node || 'kind' in node));
    if (looksLikeValue) {
      const kind = node.kind;
      // a DECLARED-AND-UNKNOWN trait is a first-class value, not a missing one. It needs a reason and a
      // scope like any other, and it is counted separately because it is the most informative thing a
      // file of this kind usually contains.
      if (node.unknown === true || kind === 'not-established') {
        // An unknown must carry NO VALUE. Without this check, `{v: 0.31, unknown: true}` would take the
        // not-established path, skip the kind and source checks entirely, and still present a number a
        // careless reader would use - which is precisely the laundering this format exists to stop.
        if (node.v !== null && node.v !== undefined) {
          badValues.push({ at: pathStr, problem: `marked unknown but carries a value (${JSON.stringify(node.v)})`, why: 'an unknown with a value bypasses every provenance check while still presenting a number. It is either a value - with a kind and a source - or it is unknown.' });
          return;
        }
        byKind['not-established'] = (byKind['not-established'] ?? 0) + 1;
        if (!node.why || String(node.why).length < 10) badValues.push({ at: pathStr, problem: 'unknown with no reason', why: 'null with no reason is indistinguishable from a field nobody filled in' });
        if (!node.scope || String(node.scope).length < 10) badValues.push({ at: pathStr, problem: 'unknown with no scope', why: SPEC.WHY_EACH_RULE.scope_required });
        return;
      }
      if (!kind || !(kind in SPEC.KINDS)) {
        badValues.push({ at: pathStr, problem: `kind ${JSON.stringify(kind)} is not in the vocabulary`, why: SPEC.WHY_EACH_RULE.kind_required });
      } else {
        byKind[kind] = (byKind[kind] ?? 0) + 1;
        if (!node.scope || String(node.scope).length < 10) {
          badValues.push({ at: pathStr, problem: 'no scope', why: SPEC.WHY_EACH_RULE.scope_required });
        }
        if (kind !== 'assumed' && kind !== 'depicted' && !node.source) {
          badValues.push({ at: pathStr, problem: `kind "${kind}" with no source`, why: SPEC.WHY_EACH_RULE.source_required_unless_assumed });
        }
      }
      return;
    }
    for (const [k, v] of Object.entries(node)) walkValues(v, pathStr ? `${pathStr}.${k}` : k);
  }
  walkValues(doc.phenotype, 'phenotype');
  walkValues(doc.environment, 'environment');

  // ---- stages ------------------------------------------------------------------------------------
  const stages = doc.phenotype?.stages;
  if (!Array.isArray(stages) || !stages.length) {
    problems.push({ field: 'phenotype.stages', what: 'absent or empty', why: 'the format exists to carry a phenotype at several developmental stages; one with none is a genome file with extra steps' });
  } else {
    stages.forEach((s, i) => {
      for (const k of SPEC.STAGE_VOCABULARY.required_on_each_stage) {
        if (s?.[k] === undefined || s[k] === null) {
          problems.push({ field: `phenotype.stages[${i}].${k}`, what: 'missing', why: k === 'temperature_C' ? SPEC.WHY_EACH_RULE.temperature_on_every_stage : 'a stage needs a name and a time with a unit' });
        }
      }
      if (s?.time_unit && !SPEC.STAGE_VOCABULARY.time_units.includes(s.time_unit)) {
        warnings.push({ field: `phenotype.stages[${i}].time_unit`, what: `"${s.time_unit}" is not one of ${SPEC.STAGE_VOCABULARY.time_units.join(', ')}` });
      }
    });
  }

  // ---- genome ------------------------------------------------------------------------------------
  const g = doc.genome ?? {};
  if (!(g.representation in SPEC.GENOME_REPRESENTATIONS)) {
    problems.push({ field: 'genome.representation', what: `${JSON.stringify(g.representation)} is not one of ${Object.keys(SPEC.GENOME_REPRESENTATIONS).join(', ')}` });
  }
  if (g.representation === 'edit-list') {
    if (!g.assembly) problems.push({ field: 'genome.assembly', what: 'an edit list with no named assembly is a list of edits to nothing' });
    if (!Array.isArray(g.edits)) problems.push({ field: 'genome.edits', what: 'missing' });
  }
  const inline = JSON.stringify(g.inline_sequences ?? '');
  if (inline.length > 100_000) {
    warnings.push({ field: 'genome.inline_sequences', what: `${(inline.length / 1000).toFixed(0)} kb of inline sequence`, consequence: SPEC.GENOME_REPRESENTATIONS['inline-fasta'].caution });
  }

  // ---- validation block --------------------------------------------------------------------------
  if (!('validation' in doc)) {
    problems.push({ field: 'validation', what: 'absent', why: SPEC.WHY_EACH_RULE.validation_block_may_be_empty_but_not_absent });
  }

  const refused = problems.length > 0;
  const degraded = !refused && badValues.length > 0;
  return {
    ok: !refused && !degraded,
    refused,
    degraded,
    source,
    format: doc.format,
    problems,
    unusable_values: badValues,
    warnings,
    values_by_kind: byKind,
    may_be_treated_as_data: Object.entries(byKind).filter(([k]) => k === 'measured' || k === 'derived' || k === 'calibrated').reduce((n, [, c]) => n + c, 0),
    may_not_be_treated_as_data: Object.entries(byKind).filter(([k]) => k === 'assumed' || k === 'depicted' || k === 'borrowed').reduce((n, [, c]) => n + c, 0),
    summary: refused
      ? `REFUSED: ${problems.length} problem(s). ${problems[0].field}: ${problems[0].what}`
      : degraded
        ? `DEGRADED: readable, but ${badValues.length} value(s) carry no usable provenance and must not be treated as data.`
        : `ok: ${Object.values(byKind).reduce((a, b) => a + b, 0)} value(s), all with a kind and a scope.`,
    doc: refused ? null : doc,
  };
}

/** What a renderer or a simulator is allowed to use. The question the format exists to answer. */
export function usableFor(result, purpose) {
  if (!result || result.refused) return { allowed: false, why: 'the file was refused' };
  const PURPOSES = {
    render: { kinds: ['measured', 'derived', 'calibrated', 'borrowed', 'assumed', 'depicted'], note: 'drawing may use anything, provided the caption says which. depicted exists for exactly this.' },
    simulate: { kinds: ['measured', 'derived', 'calibrated'], note: 'a simulation that consumes an assumed value produces a result about the assumption.' },
    publish_a_number: { kinds: ['measured'], note: 'a number quoted outside this file should be one somebody measured.' },
    compare_to_a_real_organism: { kinds: ['measured', 'measured-secondhand'], note: 'comparing a prediction to a measurement and calling it agreement is the error this guards.' },
  };
  const p = PURPOSES[purpose];
  if (!p) return { allowed: false, why: `unknown purpose "${purpose}". Known: ${Object.keys(PURPOSES).join(', ')}` };
  const present = Object.keys(result.values_by_kind ?? {});
  const excluded = present.filter(k => !p.kinds.includes(k));
  return {
    allowed: true,
    purpose,
    usable_kinds: p.kinds,
    excluded_kinds: excluded,
    n_excluded: excluded.reduce((n, k) => n + result.values_by_kind[k], 0),
    note: p.note,
    and_the_degraded_values: result.degraded ? `${result.unusable_values.length} value(s) have no usable provenance at all and are excluded from every purpose.` : null,
  };
}
