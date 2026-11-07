// THE READER: parse a .life file and refuse it when it would mislead.
//
// This is the .life equivalent of organism-format/read.mjs, and it keeps that reader's shape on purpose.
// A second reader with a second idea of what "ok" means is how two halves of a system come to disagree
// about a fact, so the outcomes, the vocabulary and the refusal-over-coercion instinct are all carried
// over unchanged. What is new is what there is to be wrong about.
//
// A .organism can be INCOMPLETE. A .life can be INCONSISTENT - its stages can be in the wrong order, its
// genome can name one animal while its measurements were taken on another, a channel can be declared in
// the header and measured on three cells out of four hundred. None of that is a missing field, and none of
// it would be caught by a reader that only checked for missing fields. So most of this file is about
// consistency, and the counts it returns are the point: a boolean says a channel is "present", and a count
// says it was measured on 3 of 400 cells, which is the thing a reader actually needs to know.
//
// Three outcomes, and the middle one is the point:
//
//   ok        the file is internally consistent and every value carries a kind and a scope; usable as data
//   degraded  readable and usable, but something a reader MUST be told is missing, and the reader says what
//   refused   the file says something that cannot be true, or omits something whose absence changes what a
//             reader believes
//
// Two standing rules, both learned the hard way:
//
//   DEGRADED IS NOT A PASS. A degraded file is returned with its degradations listed, never silently
//   upgraded, because the second program in the chain has no other way to find out.
//
//   REFUSED IS NOT A CRASH. Every refusal returns the same structured result as a success, including on
//   malformed JSON. A reader that throws gets wrapped in a try/catch by the third caller and the refusal
//   becomes a shrug.
//
// And one that is easy to get backwards: NOTHING CHECKED IS NOT A PASS. If the file carries no assembly,
// the identity check cannot run - and "no constraint could be applied" is not agreement. An unchecked file
// has cleared nothing, so an unapplied constraint degrades the file rather than passing it.
//
// ============================== THE SHAPE THIS READER EXPECTS ==============================
//
//   {
//     format: 'life/0.1.0',
//     identity: { organism, taxon, reference_assembly },
//     genome:   { representation, assembly, edits: [...] },
//     channels_declared: ['geometry', 'mechanics', 'lineage'],     // or timeline.channels_declared
//     timeline: { stages: [ STAGE, ... ] },                        // or a bare array of STAGE
//     provenance: { ... },
//     not_established: [ ... ],                                    // see SPEC.NOT_ESTABLISHED_MINIMUM
//   }
//
//   STAGE = {
//     id, name, time, time_unit, temperature_C,                    // SPEC.STAGE_REQUIRED
//     observed: true | false,                                      // observed, or filled in
//     measured_on: { reference_assembly },                         // what the measurement was taken on
//     geometry: {
//       provenance: { kind, source, scope },                       // the stage mesh's stamp
//       cells: [ { id, channels: { <channel>: { ...carries, provenance: { kind, source, scope } } } } ],
//     },
//     phenotype: { <trait>: VALUE | UNKNOWN },                     // as in .organism
//   }
//
// Channel provenance lives on the channel, not on each number: at four hundred cells you stamp the
// measurement, not every float in it. A channel with no stamp of its own is NOT counted as measured - it is
// counted separately, and reported, because inheriting a stamp from the stage is exactly how a guess comes
// to look like a confocal stack.

import * as SPEC from './spec.mjs';
import * as ORGANISM from '../spec.mjs';

/** The provenance vocabulary is .organism's, imported rather than restated. See ORGANISM.KINDS. */
export const KINDS = ORGANISM.KINDS;

/** The two kinds that mean somebody put an instrument on something. */
export const MEASURED_KINDS = Object.freeze(['measured', 'measured-secondhand']);

/** Kinds a simulator or a published number may consume. Carried from organism-format/read.mjs. */
export const DATA_KINDS = Object.freeze(['measured', 'measured-secondhand', 'derived', 'calibrated']);

const NOTHING_USABLE = Object.freeze({
  rendering: 'no: the file was refused',
  rendering_as_evidence: 'no: the file was refused',
  sequence_comparison: 'no: the file was refused',
  phenotypic_comparison: 'no: the file was refused',
  channels_measured: [],
  simulation: 'no: the file was refused',
  cannot_be_used_for: ['anything. A refused file has cleared nothing.'],
});

// ===================================================================================================
// helpers
// ===================================================================================================

/** The stages, from either `timeline.stages` or a bare `timeline` array. null if there is no array. */
function stagesOf(life) {
  const t = life?.timeline;
  if (Array.isArray(t)) return t;
  if (t && typeof t === 'object' && Array.isArray(t.stages)) return t.stages;
  return null;
}

function declaredChannels(life) {
  const d = life?.channels_declared ?? life?.timeline?.channels_declared ?? life?.channels;
  return Array.isArray(d) ? d.map(String) : [];
}

/** Does this node look like a value, or a bare provenance stamp? */
function isValueNode(node) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return false;
  if ('v' in node) return true;
  if ('value' in node && ('unit' in node || 'kind' in node)) return true;
  if (node.unknown === true) return true;
  // a bare provenance stamp - `{kind, source, scope}` with no number of its own. .life stamps a whole
  // channel this way, so a census that only looked for `v` would miss most of the file.
  if ('kind' in node && ('scope' in node || 'source' in node)) return true;
  return false;
}

/** Walk every object in the document, calling visit() on each value-like node and not descending into it. */
function walkValues(node, pathStr, visit) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach((x, i) => walkValues(x, `${pathStr}[${i}]`, visit)); return; }
  if (isValueNode(node)) { visit(node, pathStr); return; }
  for (const [k, v] of Object.entries(node)) walkValues(v, pathStr ? `${pathStr}.${k}` : k, visit);
}

function norm(s) { return String(s ?? '').trim().toLowerCase(); }

/** Fuzzy enough that an entry may add detail, strict enough that it must be the same claim. */
function coversClaim(entry, claim) {
  const e = norm(entry).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ');
  const c = norm(claim).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ');
  if (e.includes(c)) return true;
  const words = c.split(' ').filter(w => w.length > 3);
  if (!words.length) return false;
  const hit = words.filter(w => e.includes(w)).length;
  return hit / words.length >= 0.7;
}

// ===================================================================================================
// 2. TIMELINE ORDER
// ===================================================================================================

/**
 * Stage times must be STRICTLY INCREASING within a single time unit.
 *
 * This function does not sort. A timeline out of order is a defect in the file, and sorting it hides
 * whoever wrote it wrong - the next reader gets a tidy trajectory and no idea that the file disagreed with
 * itself. Equal times are a violation too: two stages at the same instant are one stage, or one of the
 * times is wrong.
 *
 * Comparison is within a unit only (SPEC.REFUSALS.no_cross_unit_distance). Ordinal units are ordered but
 * not subtracted, so their gap is reported as null rather than as a number nobody should trust.
 *
 * @returns the offending pair (first violation) plus every violation, the comparisons actually made, and
 *          the ids in unmodified file order so a caller can see for itself that nothing was reordered.
 */
export function checkTimelineOrder(timeline) {
  const stages = Array.isArray(timeline) ? timeline : (stagesOf({ timeline }) ?? null);
  if (!stages) {
    return {
      nothing_checked: true, comparisons: 0, ok: null,
      violations: [], offending_pair: null, units: {}, cross_unit: false,
      ids_in_file_order: [], order_unchanged: true,
      why_nothing_checked: 'no stage array: there was nothing to put in order, which is not the same as being in order',
    };
  }

  const byUnit = new Map();
  stages.forEach((s, i) => {
    const u = s?.time_unit ?? '(none)';
    if (!byUnit.has(u)) byUnit.set(u, []);
    byUnit.get(u).push({ i, s });
  });

  const violations = [];
  let comparisons = 0;
  for (const [unit, group] of byUnit) {
    for (let k = 1; k < group.length; k++) {
      const a = group[k - 1], b = group[k];
      const ta = Number(a.s?.time), tb = Number(b.s?.time);
      if (!Number.isFinite(ta) || !Number.isFinite(tb)) continue; // a missing time is the frame check's problem
      comparisons++;
      if (!(tb > ta)) {
        violations.push({
          unit,
          earlier_index: a.i,
          later_index: b.i,
          earlier: { id: a.s?.id, name: a.s?.name, time: a.s.time, time_unit: unit },
          later: { id: b.s?.id, name: b.s?.name, time: b.s.time, time_unit: unit },
          gap: SPEC.ORDINAL_UNITS.includes(unit) ? null : tb - ta,
          why: tb === ta
            ? `stages ${JSON.stringify(a.s?.id)} and ${JSON.stringify(b.s?.id)} are both at ${ta} ${unit}: two stages at one instant are one stage, or one of the times is wrong`
            : `stage ${JSON.stringify(b.s?.id)} at ${tb} ${unit} follows ${JSON.stringify(a.s?.id)} at ${ta} ${unit} in the file but not in time`,
        });
      }
    }
  }

  const units = {};
  for (const [u, g] of byUnit) units[u] = g.length;

  return {
    nothing_checked: comparisons === 0,
    comparisons,
    ok: comparisons === 0 ? null : violations.length === 0,
    violations,
    offending_pair: violations[0] ?? null,
    units,
    cross_unit: byUnit.size > 1,
    cross_unit_note: byUnit.size > 1
      ? `stages span ${byUnit.size} time units (${[...byUnit.keys()].join(', ')}); order was checked within each unit and never across them. ${SPEC.REFUSALS.no_cross_unit_distance}`
      : null,
    ids_in_file_order: stages.map(s => s?.id ?? null),
    order_unchanged: true,
    note: 'not sorted, by design: a timeline out of order is a defect in the file, and sorting it hides whoever wrote it wrong.',
    why_nothing_checked: comparisons === 0
      ? 'fewer than two stages shared a time unit, so no ordering constraint could be applied. An unchecked timeline has cleared nothing.'
      : null,
  };
}

// ===================================================================================================
// 3. IDENTITY
// ===================================================================================================

/**
 * SPEC.REFUSALS.no_identity_drift: the genome and the phenotype must agree about which organism this is.
 *
 * A mismatch here is a REFUSAL, not a warning. A warning is for something a reader may proceed past; this
 * is a file that is two files. Every downstream comparison - every genetic distance, every phenotypic
 * distance, every node in a tree built from either - silently becomes a comparison between two animals,
 * and nothing further down the chain can detect it.
 *
 * When there is nothing to compare, the result is `checked: false`, NOT agreement. An identity that could
 * not be checked has not been confirmed.
 */
export function checkIdentity(life) {
  const stages = stagesOf(life) ?? [];
  const genomeAssembly = life?.genome?.assembly ?? life?.genome?.reference_assembly ?? null;

  const claims = [];
  const push = (where, asm) => { if (asm) claims.push({ where, assembly: String(asm) }); };
  push('identity.reference_assembly', life?.identity?.reference_assembly ?? life?.identity?.assembly);
  push('provenance.measured_on.reference_assembly', life?.provenance?.measured_on?.reference_assembly);
  stages.forEach((s, i) => {
    push(`timeline.stages[${i}].measured_on.reference_assembly`, s?.measured_on?.reference_assembly ?? s?.measured_on?.assembly);
    push(`timeline.stages[${i}].geometry.provenance.reference_assembly`, s?.geometry?.provenance?.reference_assembly);
  });

  if (!genomeAssembly) {
    return {
      checked: false, agreed: null, refusal: null,
      genome_assembly: null, phenotype_claims: claims, disagreements: [],
      why_unchecked: life?.genome?.representation === 'inline-fasta'
        ? 'the genome is inline sequence and names no reference assembly, so there is nothing for the phenotype records to agree with. Identity is unconfirmed, not confirmed.'
        : 'genome.assembly is absent, so no identity constraint could be applied. An unchecked identity has cleared nothing.',
      why: SPEC.REFUSALS.no_identity_drift,
    };
  }
  if (!claims.length) {
    return {
      checked: false, agreed: null, refusal: null,
      genome_assembly: genomeAssembly, phenotype_claims: [], disagreements: [],
      why_unchecked: `the genome names ${JSON.stringify(genomeAssembly)} and no phenotype or measurement record names anything, so the two cannot be shown to agree. Identity is unconfirmed, not confirmed.`,
      why: SPEC.REFUSALS.no_identity_drift,
    };
  }

  const disagreements = claims.filter(c => norm(c.assembly) !== norm(genomeAssembly));
  return {
    checked: true,
    agreed: disagreements.length === 0,
    refusal: disagreements.length ? 'no_identity_drift' : null,
    genome_assembly: genomeAssembly,
    phenotype_claims: claims,
    disagreements,
    headline: disagreements.length
      ? `the genome targets ${JSON.stringify(genomeAssembly)} but ${disagreements.length} record(s) were measured on ${[...new Set(disagreements.map(d => d.assembly))].map(a => JSON.stringify(a)).join(', ')}`
      : `genome and ${claims.length} phenotype/measurement record(s) all name ${JSON.stringify(genomeAssembly)}`,
    why: SPEC.REFUSALS.no_identity_drift,
  };
}

// ===================================================================================================
// 4. CHANNEL COVERAGE
// ===================================================================================================

/**
 * Per channel, on how many CELLS and how many STAGES it was actually measured.
 *
 * Counts, never booleans. This is the headline a reader needs and the one a boolean destroys: a channel
 * declared in the header and present on 3 of 400 cells is not a measured channel, and `mechanics: true`
 * cannot tell you that. The count can.
 *
 * "Measured" means the channel carries a provenance stamp of its own whose kind is measured or
 * measured-secondhand. A channel present with no stamp is counted separately rather than credited to the
 * stage's stamp, because inheriting the stage's stamp is how a guess comes to look like a confocal stack.
 */
export function channelCoverage(life) {
  const stages = stagesOf(life) ?? [];
  const declared = declaredChannels(life);
  const names = [...new Set([...Object.keys(SPEC.CHANNELS), ...declared])];

  let cellsTotal = 0;
  const stagesWithCells = [];
  for (const s of stages) {
    const cells = Array.isArray(s?.geometry?.cells) ? s.geometry.cells : [];
    cellsTotal += cells.length;
    if (cells.length) stagesWithCells.push(s?.id ?? null);
  }

  const channels = {};
  for (const name of names) {
    const spec = SPEC.CHANNELS[name] ?? null;
    const carries = spec?.carries ?? [];
    let cellsPresent = 0, cellsMeasured = 0, cellsUnstamped = 0, cellsIncomplete = 0;
    const stagesPresent = new Set(), stagesMeasured = new Set();
    const missingFields = new Set();

    stages.forEach((s, si) => {
      const sid = s?.id ?? `#${si}`;
      for (const c of (Array.isArray(s?.geometry?.cells) ? s.geometry.cells : [])) {
        const ch = c?.channels?.[name];
        if (!ch || typeof ch !== 'object') continue;
        cellsPresent++;
        stagesPresent.add(sid);
        const kind = ch.provenance?.kind ?? ch.kind ?? null;
        if (kind === null) cellsUnstamped++;
        else if (MEASURED_KINDS.includes(kind)) { cellsMeasured++; stagesMeasured.add(sid); }
        const missing = carries.filter(k => ch[k] === undefined || ch[k] === null);
        if (missing.length) { cellsIncomplete++; missing.forEach(m => missingFields.add(m)); }
      }
    });

    channels[name] = {
      in_vocabulary: Boolean(spec),
      declared: declared.includes(name),
      cells_present: cellsPresent,
      cells_measured: cellsMeasured,
      cells_unstamped: cellsUnstamped,
      cells_incomplete: cellsIncomplete,
      cells_total: cellsTotal,
      stages_present: stagesPresent.size,
      stages_measured: stagesMeasured.size,
      stages_total: stages.length,
      missing_required_fields: [...missingFields],
      headline: cellsMeasured === 0
        ? (cellsPresent === 0
          ? `not measured: present on 0 of ${cellsTotal} cells`
          : `NOT a measured channel: present on ${cellsPresent} of ${cellsTotal} cells, measured on 0`)
        : `measured on ${cellsMeasured} of ${cellsTotal} cells, across ${stagesMeasured.size} of ${stages.length} stages`,
    };
  }

  const declaredButAbsent = declared.filter(n => (channels[n]?.cells_present ?? 0) === 0);
  const declaredButUnmeasured = declared.filter(n => (channels[n]?.cells_present ?? 0) > 0 && channels[n].cells_measured === 0);
  const notInVocabulary = declared.filter(n => !(n in SPEC.CHANNELS));

  return {
    cells_total: cellsTotal,
    stages_total: stages.length,
    stages_with_cells: stagesWithCells.length,
    declared,
    channels,
    declared_but_absent: declaredButAbsent,
    declared_but_unmeasured: declaredButUnmeasured,
    declared_not_in_vocabulary: notInVocabulary,
    nothing_checked: cellsTotal === 0,
    why_nothing_checked: cellsTotal === 0
      ? 'no stage carries cells, so no channel could be counted on anything. Zero coverage is not full coverage.'
      : null,
  };
}

// ===================================================================================================
// 5. PROVENANCE CENSUS
// ===================================================================================================

/**
 * Count every value in the file by provenance kind, plus not-established.
 *
 * The .organism worked example came out as `9 not-established / 4 assumed / 2 measured`, and that one line
 * was the most useful thing about it - it says, in nine words, that the file is mostly a record of what
 * nobody knows. The same line for a .life is the same kind of useful, so this produces it.
 */
export function provenanceCensus(life) {
  const byKind = {};
  const unknownWithValue = [];
  const unrecognised = [];
  const noScope = [];
  const noSource = [];
  let total = 0;
  const at = [];

  walkValues(life, '', (node, pathStr) => {
    total++;
    at.push(pathStr);
    const kind = node.kind;
    if (node.unknown === true || kind === 'not-established') {
      // An unknown must carry NO VALUE. Ported verbatim in spirit from organism-format/read.mjs: without
      // this check, `{v: 0.31, unknown: true}` takes the not-established path, skips the kind and source
      // checks entirely, and still presents a number a careless reader would use. That is the laundering
      // both formats exist to stop.
      if (node.v !== null && node.v !== undefined) {
        unknownWithValue.push({ at: pathStr, value: node.v });
        byKind['(unknown-with-a-value)'] = (byKind['(unknown-with-a-value)'] ?? 0) + 1;
        return;
      }
      byKind['not-established'] = (byKind['not-established'] ?? 0) + 1;
      if (!node.why || String(node.why).length < 10) noScope.push({ at: pathStr, problem: 'unknown with no reason' });
      if (!node.scope || String(node.scope).length < 10) noScope.push({ at: pathStr, problem: 'unknown with no scope' });
      return;
    }
    if (!kind || !(kind in KINDS)) {
      unrecognised.push({ at: pathStr, kind });
      byKind['(no recognised kind)'] = (byKind['(no recognised kind)'] ?? 0) + 1;
      return;
    }
    byKind[kind] = (byKind[kind] ?? 0) + 1;
    if (!node.scope || String(node.scope).length < 10) noScope.push({ at: pathStr, problem: 'no scope' });
    if (kind !== 'assumed' && kind !== 'depicted' && !node.source) noSource.push({ at: pathStr, problem: `kind "${kind}" with no source` });
  });

  const line = Object.entries(byKind)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([k, n]) => `${n} ${k}`)
    .join(' / ');

  const count = ks => ks.reduce((n, k) => n + (byKind[k] ?? 0), 0);
  return {
    total,
    by_kind: byKind,
    line: total ? line : '(no values: nothing in this file carries a provenance kind at all)',
    may_be_treated_as_data: count(DATA_KINDS),
    may_not_be_treated_as_data: count(['assumed', 'depicted', 'borrowed']),
    not_established: byKind['not-established'] ?? 0,
    unknown_with_a_value: unknownWithValue,
    unrecognised_kinds: unrecognised,
    missing_scope_or_reason: noScope,
    missing_source: noSource,
    paths: at,
    nothing_counted: total === 0,
    why_nothing_counted: total === 0
      ? 'no value-like node was found, so no provenance was checked. A file with no provenance to check has not passed a provenance check.'
      : null,
  };
}

// ===================================================================================================
// 6. SUMMARY
// ===================================================================================================

/** A few lines of plain prose. Not a status - the status comes from read(). */
export function summary(life) {
  const stages = stagesOf(life);
  const lines = [];

  if (!stages) {
    lines.push('This file carries no stage array, so it describes no trajectory.');
    lines.push('It cannot be used for: rendering, phenotypic comparison, or anything time-indexed. Use .organism for a snapshot.');
    return lines.join('\n');
  }

  const observed = [], filledIn = [], unstated = [];
  for (const s of stages) {
    const label = `${s?.id ?? '?'} (${s?.name ?? '?'} @ ${s?.time ?? '?'} ${s?.time_unit ?? '?'})`;
    const kind = s?.geometry?.provenance?.kind ?? null;
    if (s?.observed === true || MEASURED_KINDS.includes(kind)) observed.push(label);
    else if (s?.observed === false || kind) filledIn.push(label);
    else unstated.push(label);
  }

  const census = provenanceCensus(life);
  const cov = channelCoverage(life);
  const id = checkIdentity(life);
  const order = checkTimelineOrder(stages);

  lines.push(`${stages.length} stage(s): ${observed.length} observed, ${filledIn.length} filled in, ${unstated.length} neither stated nor inferable.`);
  if (observed.length) lines.push(`  observed:  ${observed.join(', ')}`);
  if (filledIn.length) lines.push(`  filled in: ${filledIn.join(', ')}`);
  if (unstated.length) lines.push(`  unstated:  ${unstated.join(', ')} - and a stage that does not say whether it was observed is a stage a reader will assume was.`);

  lines.push(`Provenance census: ${census.line}.`);
  lines.push(`Of ${census.total} value(s), ${census.may_be_treated_as_data} may be treated as data and ${census.may_not_be_treated_as_data} may not.`);

  const chanLines = Object.entries(cov.channels)
    .filter(([, c]) => c.declared || c.cells_present > 0)
    .map(([n, c]) => `  ${n}: ${c.headline}`);
  lines.push(`Channels, over ${cov.cells_total} cell(s) in ${cov.stages_with_cells} of ${stages.length} stage(s):`);
  lines.push(chanLines.length ? chanLines.join('\n') : '  none declared and none present.');

  const cannot = [];
  if (!stages.some(s => MEASURED_KINDS.includes(s?.geometry?.provenance?.kind))) {
    cannot.push('comparing any mesh from this file to a real organism: no stage has measured geometry, so every mesh is a depiction');
  }
  for (const n of cov.declared_but_absent) cannot.push(`anything that needs the "${n}" channel: it is declared in the header and present on 0 of ${cov.cells_total} cells`);
  for (const n of cov.declared_but_unmeasured) cannot.push(`treating "${n}" as a measurement: it is present but measured on 0 of ${cov.cells_total} cells`);
  if (order.cross_unit) cannot.push('any distance between stages in different time units (no_cross_unit_distance)');
  if (order.violations.length) cannot.push('anything time-ordered: the timeline disagrees with itself, and it has not been sorted for you');
  if (!id.checked) cannot.push(`asserting that the genome and the measurements are the same animal: ${id.why_unchecked}`);
  else if (!id.agreed) cannot.push(`anything at all: ${id.headline}`);
  if (census.may_be_treated_as_data === 0) cannot.push('simulation of any kind: not one value in the file is measured, derived or calibrated');
  cannot.push('simulation as a claim of sufficiency - a .life does not assert that it is enough to simulate anything. See not_established.');

  lines.push('It cannot be used for:');
  lines.push(cannot.map(c => `  - ${c}`).join('\n'));
  return lines.join('\n');
}

// ===================================================================================================
// 1. READ
// ===================================================================================================

function result({ status, life, problems, warnings, usable, extra = {} }) {
  return {
    status,
    life,
    problems,
    warnings,
    usable,
    degradations: warnings.filter(w => w.degrades),
    ...extra,
  };
}

function refuse(problems, { source, raw = null, extra = {} } = {}) {
  return result({
    status: 'refused',
    life: null,
    problems,
    warnings: [],
    usable: NOTHING_USABLE,
    extra: {
      source,
      raw,
      headline: `REFUSED: ${problems.length} problem(s). ${problems[0].field}: ${problems[0].what}`,
      prose: 'The file was refused, so nothing was established by reading it.',
      census: null, coverage: null, timeline_order: null, identity: null,
      checks: [],
      ...extra,
    },
  });
}

/**
 * Parse and validate a .life, and tell the caller what it may be used for.
 * @returns {{status:'refused'|'degraded'|'ok', life:object|null, problems:Array, warnings:Array, usable:object}}
 */
export function read(input, { source = 'unknown' } = {}) {
  let doc;
  try { doc = typeof input === 'string' ? JSON.parse(input) : input; }
  catch (e) {
    return refuse([{ field: '(document)', what: `not JSON: ${e.message}`, why: 'a reader that throws on a malformed file gets wrapped in a try/catch by its third caller, and the refusal becomes a shrug' }], { source });
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return refuse([{ field: '(document)', what: `not an object: got ${Array.isArray(doc) ? 'an array' : typeof doc}`, why: 'a .life is a JSON object' }], { source });
  }

  const problems = [];
  const warnings = [];
  const checks = [];
  const note = (constraint, applied, passed, detail = null) => checks.push({ constraint, applied, passed, detail });
  const degrade = (field, what, why, extra = {}) => warnings.push({ field, what, why, degrades: true, ...extra });

  // ---- the frame ---------------------------------------------------------------------------------
  if (doc.format !== SPEC.FORMAT) {
    if (typeof doc.format !== 'string' || !doc.format.startsWith('life/')) {
      return refuse([{ field: 'format', what: `not a life file: format is ${JSON.stringify(doc.format)}`, why: 'a reader that guesses the format of an unlabelled file will eventually guess wrong about one that nearly matches' }], { source, raw: doc });
    }
    warnings.push({ field: 'format', what: `file is ${doc.format}, this reader is ${SPEC.FORMAT}`, consequence: 'fields added or renamed between versions are not interpreted' });
  }
  const missingTop = SPEC.REQUIRED_TOP_LEVEL.filter(k => !(k in doc));
  for (const k of missingTop) {
    problems.push({ field: k, what: 'missing', why: SPEC.WHY_EACH_RULE[`${k}_required`] ?? 'required by the format: see SPEC.REQUIRED_TOP_LEVEL' });
  }
  note('required top-level fields', true, missingTop.length === 0, missingTop.length ? `missing ${missingTop.join(', ')}` : null);

  // ---- the timeline exists and is an array -------------------------------------------------------
  const stages = stagesOf(doc);
  if (!stages) {
    problems.push({
      field: 'timeline',
      what: `not an array of stages: got ${doc.timeline === undefined ? 'nothing' : JSON.stringify(doc.timeline).slice(0, 80)}`,
      why: 'a .life exists to make time the primary axis. A timeline that is not a sequence has no order to be wrong about, which is the one thing this format is for.',
    });
  }
  note('timeline is an array of stages', true, Boolean(stages));

  if (!stages) {
    // Nothing further can be checked, and an unchecked file has cleared nothing.
    return refuse(problems, { source, raw: doc, extra: { checks, warnings } });
  }

  // ---- stages: required fields, time units, unique ids -------------------------------------------
  const seen = new Map();
  let missingFieldCount = 0, badUnitCount = 0, dupCount = 0;
  stages.forEach((s, i) => {
    for (const k of SPEC.STAGE_REQUIRED) {
      if (s?.[k] === undefined || s?.[k] === null) {
        missingFieldCount++;
        problems.push({
          field: `timeline.stages[${i}].${k}`,
          what: 'missing',
          why: k === 'temperature_C' ? SPEC.WHY_EACH_RULE.temperature_required
            : k === 'time_unit' ? SPEC.WHY_EACH_RULE.time_unit_required
              : 'a stage pins itself in time AND in condition, or it is not a stage: see SPEC.STAGE_REQUIRED',
        });
      }
    }
    if (s?.time_unit !== undefined && s?.time_unit !== null && !SPEC.TIME_UNITS.includes(s.time_unit)) {
      badUnitCount++;
      problems.push({
        field: `timeline.stages[${i}].time_unit`,
        what: `${JSON.stringify(s.time_unit)} is not one of ${SPEC.TIME_UNITS.join(', ')}`,
        why: 'an unrecognised clock convention is worse than none: the reader will do arithmetic on it anyway. ' + SPEC.WHY_EACH_RULE.time_unit_required,
      });
    }
    const id = s?.id;
    if (id !== undefined && id !== null) {
      if (seen.has(id)) {
        dupCount++;
        problems.push({
          field: `timeline.stages[${i}].id`,
          what: `duplicate stage id ${JSON.stringify(id)} (also at timeline.stages[${seen.get(id)}])`,
          why: 'stage ids are how a mesh, a phenotype vector and a lineage parent refer to a moment. Two stages with one id means every such reference resolves to whichever the reader happened to index last.',
        });
      } else seen.set(id, i);
    }
  });
  note('every stage carries SPEC.STAGE_REQUIRED', true, missingFieldCount === 0);
  note('every time_unit is in SPEC.TIME_UNITS', true, badUnitCount === 0);
  note('stage ids are unique', true, dupCount === 0);

  // ---- values: the census, and the unknown-with-a-value refusal ----------------------------------
  const census = provenanceCensus(doc);
  for (const u of census.unknown_with_a_value) {
    problems.push({
      field: u.at,
      what: `marked unknown but carries a value (${JSON.stringify(u.value)})`,
      why: 'an unknown with a value bypasses every provenance check while still presenting a number. It is either a value - with a kind and a source - or it is unknown.',
    });
  }
  note('no value is both unknown and a number', true, census.unknown_with_a_value.length === 0);
  note('a provenance census could be taken', !census.nothing_counted, census.nothing_counted ? false : true, census.why_nothing_counted);
  if (census.nothing_counted) degrade('provenance', 'no value in the file carries a provenance kind', census.why_nothing_counted);
  const unusable = [...census.unrecognised_kinds, ...census.missing_scope_or_reason, ...census.missing_source];
  for (const u of census.unrecognised_kinds) {
    degrade(u.at, `kind ${JSON.stringify(u.kind)} is not in the vocabulary`, ORGANISM.WHY_EACH_RULE.kind_required);
  }
  if (census.missing_scope_or_reason.length) degrade('(values)', `${census.missing_scope_or_reason.length} value(s) carry no scope or no reason`, ORGANISM.WHY_EACH_RULE.scope_required);
  if (census.missing_source.length) degrade('(values)', `${census.missing_source.length} value(s) claim an origin outside this file and name no source`, ORGANISM.WHY_EACH_RULE.source_required_unless_assumed);

  // ---- not_established ---------------------------------------------------------------------------
  const ne = Array.isArray(doc.not_established) ? doc.not_established.map(String) : [];
  const missingMin = SPEC.NOT_ESTABLISHED_MINIMUM.filter(m => !ne.some(x => coversClaim(x, m)));
  note('not_established covers SPEC.NOT_ESTABLISHED_MINIMUM', true, missingMin.length === 0);
  if (missingMin.length) {
    degrade('not_established', `missing ${missingMin.length} of the ${SPEC.NOT_ESTABLISHED_MINIMUM.length} minimum entries`,
      'these are the claims a reader is most likely to make on the file\'s behalf. Leaving one out does not make it false, it makes it unsaid.',
      { missing: missingMin });
  }

  // ---- timeline order ----------------------------------------------------------------------------
  const order = checkTimelineOrder(stages);
  note('stage times strictly increase within a unit', !order.nothing_checked, order.nothing_checked ? false : order.ok, order.why_nothing_checked);
  if (order.violations.length) {
    // A refusal, not a warning: a .organism can be incomplete, a .life can be INCONSISTENT, and a
    // trajectory whose stages do not follow each other makes every "follows" claim in the file false.
    // It is not sorted on the way out - see checkTimelineOrder.
    problems.push({
      field: 'timeline.stages',
      what: `${order.violations.length} stage pair(s) are out of order; first: ${order.offending_pair.why}`,
      why: 'a trajectory is the claim that this state follows that one. Out of order, every such claim in the file is false, and sorting it would hide whoever wrote it wrong.',
      offending_pair: order.offending_pair,
      not_sorted: true,
    });
  }
  if (order.nothing_checked) degrade('timeline.stages', 'no ordering constraint could be applied', order.why_nothing_checked);
  if (order.cross_unit) warnings.push({ field: 'timeline.stages', what: order.cross_unit_note });

  // ---- identity ----------------------------------------------------------------------------------
  const identity = checkIdentity(doc);
  note('genome and phenotype name the same organism', identity.checked, identity.checked ? identity.agreed : false, identity.why_unchecked ?? null);
  if (identity.refusal) {
    problems.push({
      field: 'identity/genome',
      what: identity.headline,
      why: SPEC.REFUSALS.no_identity_drift,
      disagreements: identity.disagreements,
      refusal: identity.refusal,
    });
  } else if (!identity.checked) {
    degrade('identity/genome', 'the identity constraint could not be applied', identity.why_unchecked);
  }

  // ---- channels ----------------------------------------------------------------------------------
  const coverage = channelCoverage(doc);
  note('declared channels are present on some cell', !coverage.nothing_checked, coverage.nothing_checked ? false : coverage.declared_but_absent.length === 0, coverage.why_nothing_checked);
  if (coverage.nothing_checked) degrade('timeline.stages[].geometry.cells', 'no stage carries cells, so no channel could be counted', coverage.why_nothing_checked);
  for (const n of coverage.declared_but_absent) {
    degrade(`channels_declared["${n}"]`, `declared in the header and present on 0 of ${coverage.cells_total} cells`,
      'a channel in the header reads as a channel in the file. Declared and absent is the gap between what a reader expects and what is there.');
  }
  for (const n of coverage.declared_but_unmeasured) {
    degrade(`channels_declared["${n}"]`, `present on ${coverage.channels[n].cells_present} of ${coverage.cells_total} cells but measured on 0`,
      'present is not measured. A channel with no measured cell is a channel of guesses.');
  }
  for (const n of coverage.declared_not_in_vocabulary) {
    degrade(`channels_declared["${n}"]`, `is not one of ${Object.keys(SPEC.CHANNELS).join(', ')}`,
      'SPEC.CHANNELS is open by design, but a channel this reader does not know is a channel it cannot count. See the UTGM note in spec.mjs.');
  }
  for (const [n, c] of Object.entries(coverage.channels)) {
    if (c.cells_unstamped) degrade(`channel "${n}"`, `present on ${c.cells_unstamped} cell(s) with no provenance stamp of its own`, 'an unstamped channel is not credited to the stage\'s stamp, because inheriting a stamp is how a guess comes to look like a measurement.');
    if (c.missing_required_fields.length) degrade(`channel "${n}"`, `missing required field(s) ${c.missing_required_fields.join(', ')} on ${c.cells_incomplete} cell(s)`, `SPEC.CHANNELS.${n} requires ${c.carries ?? (SPEC.CHANNELS[n]?.carries ?? []).join(', ')}`);
  }

  // ---- measured geometry -------------------------------------------------------------------------
  const measuredGeomStages = stages.filter(s => MEASURED_KINDS.includes(s?.geometry?.provenance?.kind));
  note('at least one stage has measured geometry', true, measuredGeomStages.length > 0);
  if (!measuredGeomStages.length) {
    degrade('timeline.stages[].geometry.provenance', `no stage has measured geometry (0 of ${stages.length})`,
      SPEC.REFUSALS.no_unstamped_mesh + ' Every mesh this file exports is a depiction, and a reader that was not told would render it as evidence.');
  }

  // ---- verdict -----------------------------------------------------------------------------------
  const refused = problems.length > 0;
  const applied = checks.filter(c => c.applied).length;
  const unapplied = checks.filter(c => !c.applied);
  if (!refused && applied === 0) {
    // Belt and braces for the rule that matters most: an unchecked file has cleared nothing, so it can
    // never come back ok, whatever else is true of it.
    degrade('(whole file)', 'not one constraint could be applied', 'nothing was checked, so nothing was established. An unchecked file is not a clean one.');
  }
  const degraded = !refused && warnings.some(w => w.degrades);

  const base = SPEC.usableFor(doc);
  const usable = refused ? NOTHING_USABLE : {
    ...base,
    channels_measured_counts: Object.fromEntries(Object.entries(coverage.channels).filter(([, c]) => c.cells_present > 0).map(([n, c]) => [n, { cells_measured: c.cells_measured, cells_present: c.cells_present, cells_total: c.cells_total, stages_measured: c.stages_measured }])),
    values_usable_as_data: census.may_be_treated_as_data,
    values_not_usable_as_data: census.may_not_be_treated_as_data,
    constraints_applied: applied,
    constraints_not_applied: unapplied.map(c => c.constraint),
    cannot_be_used_for: summary(doc).split('It cannot be used for:')[1]?.trim().split('\n').map(s => s.replace(/^\s*- /, '')) ?? [],
    and_it_is_degraded: degraded ? `${warnings.filter(w => w.degrades).length} degradation(s): see result.degradations. Degraded is not a pass.` : null,
  };

  return result({
    status: refused ? 'refused' : degraded ? 'degraded' : 'ok',
    life: refused ? null : doc,
    problems,
    warnings,
    usable,
    extra: {
      source,
      raw: doc,
      format: doc.format,
      census,
      coverage,
      timeline_order: order,
      identity,
      checks,
      unusable_values: unusable,
      headline: refused
        ? `REFUSED: ${problems.length} problem(s). ${problems[0].field}: ${problems[0].what}`
        : degraded
          ? `DEGRADED: readable and usable, but ${warnings.filter(w => w.degrades).length} thing(s) a reader must be told. ${census.line}.`
          : `ok: ${applied} constraint(s) applied and passed. ${census.line}.`,
      prose: refused ? 'The file was refused, so nothing was established by reading it.' : summary(doc),
    },
  });
}

// ===================================================================================================
// usableFor: the purpose gate, carried from organism-format/read.mjs
// ===================================================================================================

/** What a renderer, a simulator or a tree-builder is allowed to use. The question the format exists to answer. */
export function usableFor(res, purpose) {
  if (!res || res.status === 'refused') return { allowed: false, why: 'the file was refused' };
  const PURPOSES = {
    render: { kinds: ['measured', 'measured-secondhand', 'derived', 'calibrated', 'borrowed', 'assumed', 'depicted'], note: 'drawing may use anything, provided the caption says which. `depicted` exists for exactly this.' },
    export_a_mesh: { kinds: ['measured', 'measured-secondhand', 'derived', 'calibrated'], note: SPEC.REFUSALS.no_unstamped_mesh },
    simulate: { kinds: DATA_KINDS, note: 'a simulation that consumes an assumed value produces a result about the assumption.' },
    publish_a_number: { kinds: ['measured'], note: 'a number quoted outside this file should be one somebody measured.' },
    compare_to_a_real_organism: { kinds: MEASURED_KINDS, note: 'comparing a prediction to a measurement and calling it agreement is the error this guards.' },
    build_a_tree: { kinds: MEASURED_KINDS, note: SPEC.REFUSALS.no_single_number_distance },
  };
  const p = PURPOSES[purpose];
  if (!p) return { allowed: false, why: `unknown purpose "${purpose}". Known: ${Object.keys(PURPOSES).join(', ')}` };
  const present = Object.keys(res.census?.by_kind ?? {});
  const excluded = present.filter(k => !p.kinds.includes(k));
  return {
    allowed: true,
    purpose,
    usable_kinds: p.kinds,
    excluded_kinds: excluded,
    n_excluded: excluded.reduce((n, k) => n + res.census.by_kind[k], 0),
    note: p.note,
    and_the_degradations: res.status === 'degraded'
      ? `${res.degradations.length} degradation(s) apply to every purpose; degraded is not a pass. See result.degradations.`
      : null,
  };
}
