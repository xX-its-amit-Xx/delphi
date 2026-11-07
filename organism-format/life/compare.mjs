// COMPARISON: make two .life files comparable, and refuse the comparisons that would only look like one.
//
// This is the third of the four things a .life must yield (spec.mjs, THE FOUR THINGS): a phenotype vector
// per stage, for phenotypic comparison and evolutionary tree search. Tree search is downstream and is not
// here - what is here is the distance, and the refusals that stop a distance from being computed between
// two things that were never on the same axis.
//
// ============================== WHY A COMPARISON FILE NEEDS REFUSALS ==============================
// A distance function is the most dangerous thing in a comparative pipeline, because its output is a
// single number with no units, no provenance and no memory of what went into it. Every caveat that was
// attached to the inputs is gone by the time the number reaches a tree, and a tree is the sort of artefact
// that gets drawn in a talk. So the three failures this file exists to prevent:
//
//   1. a distance ACROSS TIME UNITS - 24 hpf against 1 dpf is arithmetic on two different clocks, and
//      Carnegie 12 against Carnegie 10 is arithmetic on a label (spec REFUSALS.no_cross_unit_distance)
//   2. a distance driven by GUESSES - two `assumed` values differ by exactly as much as the two people who
//      assumed them, and that difference is not a phenotype
//   3. a SINGLE NUMBER - genetic and phenotypic distance summed with invisible weights, which fixes a
//      modelling decision in every tree built from it (spec REFUSALS.no_single_number_distance)
//
// ============================== THE TRAP THAT IS NOT A REFUSAL ==============================
// The number of traits two files happen to SHARE is itself a confound, and it cannot be refused away
// because it looks exactly like a successful comparison.
//
// Two sparsely-measured organisms are compared on almost nothing, and a distance over almost nothing is
// small. So the sparsest pair in a matrix is systematically the most similar-looking pair, and if that
// matrix is handed to neighbour joining, the two files nobody measured come out as sisters. The clade is
// an artefact of the collection effort.
//
// There is no way to compute around this: a distance over n traits is also a statement about n. The only
// defence is that n travels with the number, so EVERY distance here is returned alongside `n_traits_used`,
// and a caller that reports the distance without it is reporting coverage as similarity.

import { KINDS } from '../spec.mjs';
import { REFUSALS, TIME_UNITS, TIME_UNIT_NOTES, ORDINAL_UNITS, COORDINATE_CONVENTIONS } from './spec.mjs';

/** Provenance kinds excluded from a phenotypic distance by default. See WHY_EXCLUDED_BY_DEFAULT. */
export const DEFAULT_EXCLUDED_KINDS = Object.freeze(['assumed', 'depicted']);

export const WHY_EXCLUDED_BY_DEFAULT = Object.freeze({
  assumed: 'an assumed value was chosen because something was needed. Two assumed values differ by as ' +
    'much as the two people who chose them, so a distance driven by them is a comparison of the guessers.',
  depicted: 'a depicted value exists only so that something can be drawn. A distance over depictions is a ' +
    'distance between two drawings.',
  'not-established': 'always excluded, and not by choice: there is no number to subtract.',
  overridable: 'pass exclude_kinds: [] to include them, and then say so wherever the distance is reported. ' +
    'The default is the quiet case; including a guess should be the loud one.',
});

// ---------------------------------------------------------------------------------------------------
// STAGE KEYS
// ---------------------------------------------------------------------------------------------------

const num = x => {
  if (x === null || x === undefined || x === '' || typeof x === 'boolean') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};
/** One spelling per number, so 24 and 24.0 and "24" are one key and not three. */
const canon = n => String(n === 0 ? 0 : n);

/**
 * A canonical key for a stage: its time IN ITS UNIT, plus its temperature.
 *
 * Order-independent in both senses that matter. It does not depend on where the stage sits in its
 * timeline - a key built from the index would make two identical stages incomparable because one file
 * listed an extra stage before them - and it does not depend on the order of the stage's own fields.
 *
 * The unit is IN the key rather than normalised away, so two stages are comparable only if their time
 * units match. That is not a convenience: hpf and dpf are different clocks, and carnegie_stage is not a
 * clock at all (TIME_UNIT_NOTES.carnegie_stage).
 *
 * Name and id are deliberately NOT in the key. "morula" means different things across species, and an id
 * is a label local to one file; neither is a fact two files can agree on. "24 hpf at 28.5 C" is.
 *
 * @returns {string|null} null when the stage is missing a time, a unit or a temperature - a stage that
 *   cannot be pinned in time and condition is not a stage (spec STAGE_REQUIRED).
 */
export function stageKey(stage) {
  const t = num(stage?.time);
  const unit = typeof stage?.time_unit === 'string' ? stage.time_unit.trim() : null;
  const temp = num(stage?.temperature_C);
  if (t === null || !unit || temp === null) return null;
  return `${unit}=${canon(t)}@${canon(temp)}C`;
}

/** The same key without the temperature: what pairing is done on. See alignTimelines. */
export function stageTimeKey(stage) {
  const t = num(stage?.time);
  const unit = typeof stage?.time_unit === 'string' ? stage.time_unit.trim() : null;
  if (t === null || !unit) return null;
  return `${unit}=${canon(t)}`;
}

// ---------------------------------------------------------------------------------------------------
// SHAPE HELPERS - a function here accepts a whole .life, or the part of it it needs, because a caller
// comparing two stages should not have to fabricate a file around them.
// ---------------------------------------------------------------------------------------------------

function stagesOf(x) {
  if (Array.isArray(x)) return x;
  if (Array.isArray(x?.timeline?.stages)) return x.timeline.stages;
  if (Array.isArray(x?.stages)) return x.stages;
  return [];
}

const looksLikeStage = s => !!s && typeof s === 'object' &&
  ('time_unit' in s || 'temperature_C' in s || 'geometry' in s || 'traits' in s);

/**
 * The trait map of a stage. Both spellings are read because both exist in the repository: a .life stage
 * carries `phenotype` (life/read.mjs, and examples/mouse-preimplantation.life), while a .organism stage
 * carries `traits`. Reading both is not tolerance for sloppiness - it is the alternative to this file
 * inventing a third name, which is how two parts of a system come to disagree about a fact.
 */
function traitsOf(x) {
  if (!x || typeof x !== 'object') return {};
  if (x.traits && typeof x.traits === 'object') return x.traits;
  if (x.phenotype && typeof x.phenotype === 'object') {
    return (x.phenotype.traits && typeof x.phenotype.traits === 'object') ? x.phenotype.traits : x.phenotype;
  }
  if (looksLikeStage(x)) return {};
  return x; // a bare trait map
}

function genomeOf(x) {
  if (!x || typeof x !== 'object') return null;
  if (x.genome && typeof x.genome === 'object') return x.genome;
  if ('assembly' in x || 'edits' in x || 'representation' in x || 'reference' in x) return x;
  return null;
}

/**
 * The named reference assembly, wherever the file put it. Four spellings are in use across this
 * repository - genome.assembly (the shape life/read.mjs documents), genome.reference_assembly (the
 * fallback it reads), genome.reference.assembly (what examples/mouse-preimplantation.life actually
 * writes) and a bare string reference. A distance that looked in only one place would find no assembly
 * on a real file and refuse every comparison, which is a refusal about this function and not about the
 * data: the loudest possible way to be useless.
 */
function assemblyOf(g) {
  if (!g || typeof g !== 'object') return null;
  if (g.assembly) return g.assembly;
  if (g.reference_assembly) return g.reference_assembly;
  if (g.reference && typeof g.reference === 'object' && g.reference.assembly) return g.reference.assembly;
  if (typeof g.reference === 'string' && g.reference.trim()) return g.reference;
  return null;
}

const descriptor = (s, i) => ({ index: i, id: s?.id ?? null, name: s?.name ?? null });

// ---------------------------------------------------------------------------------------------------
// ALIGNMENT
// ---------------------------------------------------------------------------------------------------

/** A stated conversion between two time units, in whichever direction the caller stated it. */
function findConversion(conversions, from, to) {
  const forward = conversions?.[`${from}->${to}`];
  if (forward) {
    const factor = num(forward.factor);
    if (factor === null) return null;
    return { factor, offset: num(forward.offset) ?? 0, direction: `${from}->${to}`, inverted: false,
      source: forward.source ?? forward.stated_by ?? null };
  }
  const back = conversions?.[`${to}->${from}`];
  if (back) {
    const factor = num(back.factor);
    if (factor === null || factor === 0) return null;
    return { factor: 1 / factor, offset: -(num(back.offset) ?? 0) / factor, direction: `${to}->${from}`,
      inverted: true, source: back.source ?? back.stated_by ?? null };
  }
  return null;
}

/**
 * Pair up stages across two .life files.
 *
 * Pairing is on TIME WITHIN A UNIT. Temperature is carried on the pair rather than used to pair, because
 * a pair at the same hour and different temperatures is exactly the case a reader needs told about: it is
 * a real pair, and its distance is not a similarity (WHAT_A_DISTANCE_HIDES.different_temperatures). Using
 * temperature to pair would make that pair vanish instead, which hides the problem rather than reporting
 * it; the full stageKey, temperature and all, is still on each side of the pair.
 *
 * Implements REFUSALS.no_cross_unit_distance:
 *   - two different units with no stated conversion: refused, with both unit names and the stages affected
 *   - an ORDINAL unit (ORDINAL_UNITS, i.e. carnegie_stage) against any other unit: refused whether or not
 *     a conversion was offered, and the offered conversion is reported as having been declined. Carnegie
 *     12 minus Carnegie 10 is not 2 of anything, so there is nothing for a factor to multiply.
 *
 * @param {object} opts.conversions e.g. {'dpf->hpf': {factor: 24, source: 'the convention, stated here'}}
 * @returns {{pairs: object[], unpaired_a: object[], unpaired_b: object[], refused: object[]}}
 */
export function alignTimelines(a, b, { conversions = {}, time_tolerance = 0 } = {}) {
  const pairs = [], refused = [], unpaired_a = [], unpaired_b = [], warnings = [];

  const index = stages => {
    const usable = [], unusable = [];
    const seen = new Map();
    stages.forEach((s, i) => {
      const key = stageKey(s);
      if (key === null) {
        unusable.push({ ...descriptor(s, i), time: s?.time ?? null, time_unit: s?.time_unit ?? null,
          temperature_C: s?.temperature_C ?? null,
          why: 'no stage key: a stage needs a time, a time_unit and a temperature_C before it is comparable ' +
            'to anything (spec STAGE_REQUIRED). A number of hours is not a stage without a clock convention ' +
            'and a temperature.' });
        return;
      }
      const tk = stageTimeKey(s);
      seen.set(tk, (seen.get(tk) ?? 0) + 1);
      usable.push({ ...descriptor(s, i), key, time_key: tk, unit: String(s.time_unit).trim(),
        time: num(s.time), temperature_C: num(s.temperature_C) });
    });
    for (const [tk, n] of seen) {
      if (n > 1) warnings.push({ what: `${n} stages share the time key ${tk}`, consequence:
        'two stages at the same time in the same unit are ambiguous to pair, so the first is matched and ' +
        'the rest are reported unpaired. If they are genuinely different conditions, the difference belongs ' +
        'in the stage, not in the reader.' });
    }
    for (const u of usable) if (!TIME_UNITS.includes(u.unit)) {
      warnings.push({ what: `time_unit "${u.unit}" is not one of ${TIME_UNITS.join(', ')}`, consequence:
        'an unrecognised unit is still matched against itself, but no conversion to anything is known for it' });
    }
    return { usable, unusable };
  };

  const A = index(stagesOf(a)), B = index(stagesOf(b));
  unpaired_a.push(...A.unusable);
  unpaired_b.push(...B.unusable);

  const side = e => ({ index: e.index, id: e.id, name: e.name, time: e.time, time_unit: e.unit,
    temperature_C: e.temperature_C, stage_key: e.key });

  const makePair = (ea, eb, conversion) => {
    const dT = Math.abs(ea.temperature_C - eb.temperature_C);
    return {
      key: conversion ? `${ea.key} ~ ${eb.key}` : ea.key,
      time_unit: conversion ? `${ea.unit} ~ ${eb.unit}` : ea.unit,
      a: side(ea),
      b: side(eb),
      via_conversion: conversion
        ? { ...conversion, caveat: conversion.source
            ? null
            : 'the conversion was supplied without a source, so it is the caller\'s assumption. It is used ' +
              'because it was stated, not because it was established.' }
        : null,
      temperature_delta_C: dT,
      same_temperature: dT === 0,
      caveat: dT === 0 ? null : WHAT_A_DISTANCE_HIDES.different_temperatures,
    };
  };

  // ---- same unit, same time: the only pairing that needs no argument ----------------------------
  const leftA = new Set(A.usable), leftB = new Set(B.usable);
  const bByTime = new Map();
  for (const e of B.usable) {
    if (!bByTime.has(e.time_key)) bByTime.set(e.time_key, []);
    bByTime.get(e.time_key).push(e);
  }
  for (const ea of A.usable) {
    const eb = (bByTime.get(ea.time_key) ?? []).find(x => leftB.has(x));
    if (!eb) continue;
    leftA.delete(ea); leftB.delete(eb);
    pairs.push(makePair(ea, eb, null));
  }

  // ---- different units: refuse, or convert if a conversion was stated ---------------------------
  const unitsOf = set => [...new Set([...set].map(e => e.unit))];
  for (const ua of unitsOf(leftA)) {
    for (const ub of unitsOf(leftB)) {
      if (ua === ub) continue; // same unit, different times - unpaired, but nothing to refuse
      const stages_a = [...leftA].filter(e => e.unit === ua).map(side);
      const stages_b = [...leftB].filter(e => e.unit === ub).map(side);
      if (!stages_a.length || !stages_b.length) continue;
      const conv = findConversion(conversions, ua, ub);
      const ordinal = ORDINAL_UNITS.includes(ua) ? ua : ORDINAL_UNITS.includes(ub) ? ub : null;

      if (ordinal) {
        refused.push({
          refusal: 'no_cross_unit_distance',
          units: [ua, ub],
          ordinal_unit: ordinal,
          conversion_offered: !!conv,
          conversion_declined: conv ? conv.direction : null,
          stages_a, stages_b,
          why: `${ordinal} is an ordinal staging, not a duration. ${TIME_UNIT_NOTES[ordinal] ?? ''} ` +
            `Carnegie 12 minus Carnegie 10 is not 2 of anything, so there is nothing for a conversion ` +
            `factor to multiply` +
            (conv ? `, and the conversion offered (${conv.direction}) is declined for that reason.`
                  : `, and none was offered.`),
          rule: REFUSALS.no_cross_unit_distance,
        });
        continue;
      }
      if (!conv) {
        refused.push({
          refusal: 'no_cross_unit_distance',
          units: [ua, ub],
          ordinal_unit: null,
          conversion_offered: false,
          stages_a, stages_b,
          why: `${ua} and ${ub} are different time units and no conversion between them was stated. ` +
            `Guessing one would produce pairs that look like observations.`,
          rule: REFUSALS.no_cross_unit_distance,
          what_would_resolve_it: `pass conversions: {'${ua}->${ub}': {factor: <n>, source: '<where it comes from>'}}`,
        });
        continue;
      }
      // A stated conversion, between two units that are both durations. Match on the converted time.
      const tol = Math.max(num(time_tolerance) ?? 0, 0);
      for (const ea of [...leftA].filter(e => e.unit === ua)) {
        const converted = ea.time * conv.factor + conv.offset;
        const eb = [...leftB].filter(e => e.unit === ub)
          .find(e => Math.abs(e.time - converted) <= Math.max(tol, 1e-9 * Math.max(1, Math.abs(e.time))));
        if (!eb) continue;
        leftA.delete(ea); leftB.delete(eb);
        pairs.push(makePair(ea, eb, { factor: conv.factor, offset: conv.offset, direction: conv.direction,
          inverted: conv.inverted, source: conv.source, converted_time: converted, into_unit: ub }));
      }
    }
  }

  const noMatch = which => ({
    why: `no stage at the same time in the same time unit in ${which}. Either the trajectories were not ` +
      `sampled at the same times, or they are in different units and the refusals above say so.`,
  });
  for (const e of leftA) unpaired_a.push({ ...side(e), ...noMatch('b') });
  for (const e of leftB) unpaired_b.push({ ...side(e), ...noMatch('a') });

  return {
    pairs,
    unpaired_a,
    unpaired_b,
    refused,
    n_pairs: pairs.length,
    warnings,
    note: 'pairing is on time within a unit; temperature is reported on each pair rather than used to pair.',
  };
}

// ---------------------------------------------------------------------------------------------------
// PHENOTYPIC DISTANCE
// ---------------------------------------------------------------------------------------------------

/** Read one trait value, with the provenance checks the .organism reader applies. */
function readValue(node) {
  if (node === null || node === undefined) return { usable: false, why: 'absent', detail: null };
  if (typeof node !== 'object' || Array.isArray(node)) {
    return { usable: false, why: 'no_provenance_kind',
      detail: `${JSON.stringify(node)} carries no kind. A value with no kind is not a value (organism/0.1.0).` };
  }
  if (node.unknown === true || node.kind === 'not-established') {
    return { usable: false, why: 'not-established', detail: node.why ?? null };
  }
  if (!node.kind || !(node.kind in KINDS)) {
    return { usable: false, why: 'no_provenance_kind',
      detail: `kind ${JSON.stringify(node.kind ?? null)} is not in the organism/0.1.0 vocabulary` };
  }
  const v = num('v' in node ? node.v : node.value);
  if (v === null) {
    return { usable: false, why: 'non_numeric', detail: `${JSON.stringify(node.v ?? node.value ?? null)} is not a number to subtract` };
  }
  return { usable: true, v, unit: node.unit ?? null, kind: node.kind };
}

/**
 * Distance over the phenotype values two aligned stages SHARE.
 *
 * Accepts two stages (or two bare trait maps). It does not align anything itself - alignTimelines decides
 * which two stages are comparable, and this measures how far apart they are once they are.
 *
 * Ratio-scale traits are compared in LOG SPACE. A length of 2 mm against 4 mm and a length of 20 mm
 * against 40 mm are the same biological difference and a very different subtraction, so the linear
 * difference would let whichever trait happens to be measured in the largest numbers dominate the
 * distance - and for morphometrics that is usually an arbitrary choice of unit. In log space the
 * component is a ratio, which is what "twice as long" means. A trait that can be zero or negative is not
 * ratio-scale; declare it with scales: {trait: 'interval'} and it is differenced linearly instead.
 *
 * Values whose provenance kind is `assumed` or `depicted` are EXCLUDED by default - see
 * WHY_EXCLUDED_BY_DEFAULT - as are `not-established` values, which have no number at all.
 *
 * The distance is a root-mean-square over the components used, which makes it comparable across pairs
 * with different coverage. That normalisation is also what makes the coverage invisible INSIDE the
 * number, which is the whole reason `n_traits_used` is returned beside it and never separately.
 *
 * @returns {{distance: number|null, n_traits_used: number, n_excluded: number, excluded_because: object[]}}
 *   distance is null, NOT zero, when nothing was shared. Zero means "identical on the traits used"; null
 *   means "there was nothing to compare", and a pipeline that confuses the two invents sister taxa.
 */
export function phenotypicDistance(a, b, {
  traits = null,
  exclude_kinds = DEFAULT_EXCLUDED_KINDS,
  scales = {},
} = {}) {
  const ta = traitsOf(a), tb = traitsOf(b);
  const excluded = [];
  const considered = traits
    ? [...traits]
    : [...new Set([...Object.keys(ta), ...Object.keys(tb)])].sort();

  const used = [];
  let sumsq = 0;

  for (const name of considered) {
    const inA = Object.prototype.hasOwnProperty.call(ta, name);
    const inB = Object.prototype.hasOwnProperty.call(tb, name);
    if (!inA || !inB) {
      excluded.push({ trait: name, why: 'present_in_only_one',
        detail: `only in ${inA ? 'a' : inB ? 'b' : 'neither'}; a distance needs both sides` });
      continue;
    }
    const va = readValue(ta[name]), vb = readValue(tb[name]);
    if (!va.usable || !vb.usable) {
      const bad = !va.usable ? va : vb;
      excluded.push({ trait: name, why: bad.why, detail: bad.detail,
        side: !va.usable && !vb.usable ? 'both' : !va.usable ? 'a' : 'b' });
      continue;
    }
    const badKind = [va, vb].map(x => x.kind).filter(k => exclude_kinds.includes(k));
    if (badKind.length) {
      excluded.push({ trait: name, why: `excluded_kind: ${[...new Set(badKind)].join(', ')}`,
        kinds: [va.kind, vb.kind],
        detail: [...new Set(badKind)].map(k => WHY_EXCLUDED_BY_DEFAULT[k]).join(' ') });
      continue;
    }
    if ((va.unit ?? null) !== (vb.unit ?? null)) {
      excluded.push({ trait: name, why: 'unit_mismatch',
        detail: `${JSON.stringify(va.unit)} against ${JSON.stringify(vb.unit)}: the format does not convert ` +
          `units inside a distance, for the same reason it does not convert time units` });
      continue;
    }
    const scale = scales[name] ?? 'ratio';
    if (scale === 'ratio' && (va.v <= 0 || vb.v <= 0)) {
      excluded.push({ trait: name, why: 'non_positive_on_ratio_scale',
        detail: `${va.v} and ${vb.v}: there is no log of a non-positive number. If the trait really is ` +
          `interval-scale, declare it with scales: {${name}: 'interval'}.` });
      continue;
    }
    const c = scale === 'ratio' ? Math.log(va.v) - Math.log(vb.v) : va.v - vb.v;
    sumsq += c * c;
    used.push({ trait: name, scale, kinds: [va.kind, vb.kind] });
  }

  const n = used.length;
  return {
    distance: n ? Math.sqrt(sumsq / n) : null,
    n_traits_used: n,
    n_excluded: excluded.length,
    excluded_because: excluded,
    n_traits_considered: considered.length,
    traits_used: used.map(u => u.trait),
    kinds_used: [...new Set(used.flatMap(u => u.kinds))].sort(),
    scale: 'root-mean-square over log-ratio components for ratio-scale traits, linear for interval-scale',
    caveat: n === 0
      ? 'no distance: the two stages share no usable trait. This is not similarity.'
      : `computed over ${n} of ${considered.length} trait(s). The distance is only as meaningful as ` +
        'n_traits_used, which must be reported with it - see ' +
        'WHAT_A_DISTANCE_HIDES.coverage_masquerading_as_similarity.',
  };
}

// ---------------------------------------------------------------------------------------------------
// GENETIC DISTANCE
// ---------------------------------------------------------------------------------------------------

/**
 * One spelling per edit, so that two files that wrote the same edit differently are not counted as two.
 * chr1 and 1 are the same chromosome; a lower-case alt is the same alt.
 *
 * An absent alt becomes '?' rather than '', because an edit that does not say what it inserts and a
 * deletion that inserts nothing are different claims, and collapsing them would make two unknowns match.
 */
function editKey(e) {
  if (!e || typeof e !== 'object') return null;
  const chrom = String(e.chrom ?? e.chr ?? e.chromosome ?? '').trim().replace(/^chr/i, '').toLowerCase();
  const start = num(e.start ?? e.pos ?? e.position);
  let end = num(e.end ?? e.stop);
  if (end === null) end = start !== null && typeof e.ref === 'string' && e.ref.length
    ? start + e.ref.length - 1
    : start;
  const altField = e.alt ?? e.alt_sequence ?? e.replacement ?? e.sequence;
  const alt = altField === undefined || altField === null ? '?' : String(altField).trim().toUpperCase();
  if (!chrom || start === null) return null;
  return `${chrom}:${canon(start)}-${canon(end)}:${alt}`;
}

/**
 * Distance between two edit lists against the SAME reference assembly: the size of their symmetric
 * difference over normalised chrom:start-end:alt keys.
 *
 * REFUSES when the two genomes name different assemblies. chr1:1000 is a different locus in GRCz10 and
 * GRCz11, so a symmetric difference across assemblies counts coordinate drift as evolution: two files
 * describing the SAME animal against two assemblies would come out maximally distant. Lifting one edit
 * list over to the other assembly is a liftover, which is a tool with its own failure modes and its own
 * provenance, and is not something a distance function may do silently. This is the pairwise form of
 * REFUSALS.no_identity_drift.
 *
 * What this distance is NOT: a measure of sequence divergence. See WHAT_A_DISTANCE_HIDES.edit_count.
 */
export function geneticDistance(a, b) {
  const ga = genomeOf(a), gb = genomeOf(b);
  const base = { distance: null, n_edits_a: null, n_edits_b: null, n_shared: null,
    n_in_a_only: null, n_in_b_only: null };

  if (!ga || !gb) {
    return { ...base, refused: true, refusal: 'no_genome',
      why: `${!ga ? 'a' : 'b'} carries no genome, so there is no edit list to difference.` };
  }
  const rawA = assemblyOf(ga), rawB = assemblyOf(gb);
  if (!rawA || !rawB) {
    return { ...base, refused: true, refusal: 'no_named_assembly',
      why: 'an edit list with no named assembly is a list of edits to nothing, and two of them have no ' +
        'common frame to be compared in.',
      assembly_a: rawA, assembly_b: rawB, rule: REFUSALS.no_identity_drift };
  }
  const normA = String(rawA).trim().toLowerCase(), normB = String(rawB).trim().toLowerCase();
  if (normA !== normB) {
    return { ...base, refused: true, refusal: 'different_reference_assembly',
      assembly_a: rawA, assembly_b: rawB,
      why: `${rawA} and ${rawB} are different reference assemblies. An edit at chr1:1000 names a different ` +
        `locus in each, so the symmetric difference would count coordinate drift as evolution - two ` +
        `records of the same animal against two assemblies would come out maximally distant.`,
      what_would_resolve_it: 'lift one edit list over to the other assembly first, as an explicit step with ' +
        'its own provenance. A distance function may not do it silently.',
      rule: REFUSALS.no_identity_drift };
  }
  const warnings = [];
  if (String(rawA) !== String(rawB)) {
    warnings.push({ what: `assembly names differ only in case or whitespace: ${JSON.stringify(rawA)} vs ` +
      `${JSON.stringify(rawB)}`, consequence: 'treated as the same assembly' });
  }
  // The same class of error as a mismatched assembly, one base wide: a start of 1000 is a different base
  // in 1-based-inclusive (VCF, GFF) and 0-based-half-open (BED) - see COORDINATE_CONVENTIONS in spec.mjs.
  const cvA = ga.coordinate_convention ?? ga.coordinate_base ?? null;
  const cvB = gb.coordinate_convention ?? gb.coordinate_base ?? null;
  if (cvA !== null && cvB !== null && String(cvA) !== String(cvB)) {
    return { ...base, refused: true, refusal: 'different_coordinate_convention',
      coordinate_convention_a: cvA, coordinate_convention_b: cvB,
      why: `coordinate conventions ${JSON.stringify(cvA)} and ${JSON.stringify(cvB)} differ, so every ` +
        `identical edit is keyed one base apart: two identical edit lists would score 2 per edit instead ` +
        `of 0. ${COORDINATE_CONVENTIONS.why}`,
      what_would_resolve_it: 'translate one list into the other convention as an explicit step. This ' +
        'function compares keys verbatim and does not shift coordinates on a guess.',
      rule: REFUSALS.no_identity_drift };
  }
  if (cvA === null || cvB === null) {
    warnings.push({ what: `${cvA === null && cvB === null ? 'neither genome' : cvA === null ? 'a' : 'b'} ` +
      `declares a coordinate_convention (one of ${Object.keys(COORDINATE_CONVENTIONS).filter(k => k.includes('based')).join(', ')})`,
      consequence: 'coordinates are compared verbatim. If the two files use different conventions and ' +
        'neither says so, identical edits are counted as differences and the distance is wrong by exactly ' +
        'the amount nobody can see. ' + COORDINATE_CONVENTIONS.until_declared });
  }

  const collect = (edits, which) => {
    const keys = new Set();
    let unkeyable = 0, duplicates = 0, unknown_alt = 0;
    for (const e of Array.isArray(edits) ? edits : []) {
      const k = editKey(e);
      if (k === null) { unkeyable++; continue; }
      if (keys.has(k)) duplicates++;
      if (k.endsWith(':?')) unknown_alt++;
      keys.add(k);
    }
    if (unkeyable) warnings.push({ what: `${unkeyable} edit(s) in ${which} have no chromosome or no start`,
      consequence: 'they are not keyable and so are not counted in the distance at all' });
    if (duplicates) warnings.push({ what: `${duplicates} duplicate edit key(s) in ${which}`,
      consequence: 'counted once; the list says the same thing twice' });
    if (unknown_alt) warnings.push({ what: `${unknown_alt} edit(s) in ${which} do not say what they insert`,
      consequence: 'keyed with an unknown alt, so two such edits at one locus compare equal without being known to be equal' });
    return keys;
  };
  const ka = collect(ga.edits, 'a'), kb = collect(gb.edits, 'b');
  const aOnly = [...ka].filter(k => !kb.has(k));
  const bOnly = [...kb].filter(k => !ka.has(k));

  return {
    distance: aOnly.length + bOnly.length,
    refused: false,
    refusal: null,
    assembly: rawA,
    n_edits_a: ka.size,
    n_edits_b: kb.size,
    n_shared: ka.size - aOnly.length,
    n_in_a_only: aOnly.length,
    n_in_b_only: bOnly.length,
    in_a_only: aOnly,
    in_b_only: bOnly,
    units: 'edits, counted',
    caveat: WHAT_A_DISTANCE_HIDES.edit_count,
    warnings,
  };
}

// ---------------------------------------------------------------------------------------------------
// THE TWO DISTANCES, SEPARATELY
// ---------------------------------------------------------------------------------------------------

/** Why there is no combined score. Exported so it can be quoted without running a comparison. */
export function whyNoCombinedScore() {
  return Object.freeze({
    refusal: 'no_single_number_distance',
    rule: REFUSALS.no_single_number_distance,
    the_decision_being_refused: 'summing a genetic distance in units of "edits, counted" with a phenotypic ' +
      'distance in units of "log-ratio, root-mean-squared" requires a weight, and a weight is a claim about ' +
      'how much one base pair is worth in millimetres.',
    why_it_matters_more_than_it_looks: 'the weight does not stay in the distance. It propagates into every ' +
      'split of every tree built from the matrix, and by the time the tree is drawn nobody can see it. A ' +
      'weight chosen by a file format would be invisible AND wrong.',
    what_a_caller_must_do: 'supply the weights. result.combine({phenotypic, genetic}) returns the number ' +
      'and records the weights alongside it, so the modelling decision travels with its consequence.',
    and_the_other_half: 'even weighted correctly, the two distances rest on different coverage: see ' +
      'n_traits_used on the phenotypic side and n_edits on the genetic side.',
  });
}

/**
 * Compare two .life files. Returns BOTH distances, as separate fields, and never a sum.
 *
 * `combined_distance` is present and null on purpose. An absent field reads as "nobody thought about it";
 * a null one with the explanation beside it says "this was refused, and here is why" - the same reason
 * .organism carries declared-and-unknown values rather than leaving the field out.
 */
export function compare(a, b, opts = {}) {
  const alignment = alignTimelines(a, b, opts);
  const stagesA = stagesOf(a), stagesB = stagesOf(b);

  let sumsq = 0, nUsed = 0, nExcluded = 0;
  const per_stage_pair = alignment.pairs.map(p => {
    const d = phenotypicDistance(stagesA[p.a.index], stagesB[p.b.index], opts);
    if (d.n_traits_used > 0) { sumsq += d.distance * d.distance * d.n_traits_used; nUsed += d.n_traits_used; }
    nExcluded += d.n_excluded;
    return {
      stage_key_a: p.a.stage_key, stage_key_b: p.b.stage_key,
      time_unit: p.time_unit, temperature_delta_C: p.temperature_delta_C, same_temperature: p.same_temperature,
      via_conversion: p.via_conversion ? p.via_conversion.direction : null,
      distance: d.distance, n_traits_used: d.n_traits_used, n_excluded: d.n_excluded,
      traits_used: d.traits_used, excluded_because: d.excluded_because,
      caveat: p.caveat ?? d.caveat,
    };
  });

  const genetic = geneticDistance(a, b);
  const phenotypic = {
    distance: nUsed ? Math.sqrt(sumsq / nUsed) : null,
    n_traits_used: nUsed,
    n_excluded: nExcluded,
    n_stage_pairs: alignment.pairs.length,
    per_stage_pair,
    pooled_over: 'all trait components from all aligned stage pairs, root-mean-squared',
    caveat: nUsed
      ? `pooled over ${nUsed} trait component(s) from ${alignment.pairs.length} stage pair(s). Report ` +
        'n_traits_used with the distance or do not report the distance.'
      : 'no distance: no aligned stage pair shares a usable trait. This is not similarity.',
  };

  const refusedMixedTemperature = per_stage_pair.some(p => p.same_temperature === false);

  const result = {
    a: { identity: a?.identity?.name ?? a?.identity?.id ?? null, n_stages: stagesA.length },
    b: { identity: b?.identity?.name ?? b?.identity?.id ?? null, n_stages: stagesB.length },

    // The two axes. Separate fields, different units, no arithmetic between them anywhere in this object.
    phenotypic,
    genetic,

    combined_distance: null,
    why_no_combined_score: REFUSALS.no_single_number_distance,
    explainNoCombinedScore: whyNoCombinedScore,

    /**
     * The one number, if a caller insists - and only on the caller's own weights. The weights come back
     * with it, because a number whose weighting is not attached is the thing this file refuses to produce.
     */
    combine({ phenotypic: wp, genetic: wg } = {}) {
      const p = num(wp), g = num(wg);
      if (p === null || g === null) {
        return { value: null, refused: true,
          why: 'combine() needs both weights, explicitly: combine({phenotypic: <n>, genetic: <n>}). There ' +
            'is no default, because a default weight is exactly the invisible modelling decision this ' +
            'refusal exists to prevent.' };
      }
      if (phenotypic.distance === null || genetic.distance === null) {
        return { value: null, refused: true,
          why: `one of the two distances is null (${phenotypic.distance === null ? 'phenotypic' : 'genetic'}), ` +
            'and a weighted sum with a missing term is a weighted sum over one axis wearing the name of two.' };
      }
      return {
        value: p * phenotypic.distance + g * genetic.distance,
        weights: { phenotypic: p, genetic: g },
        provenance: 'assumed: these weights were supplied by the caller, not established by anything',
        what_it_is_not: 'not a property of these two organisms. It is a property of these two organisms AND ' +
          'these two weights, and it must not be reported without them.',
        coverage: { n_traits_used: phenotypic.n_traits_used, n_edits_a: genetic.n_edits_a, n_edits_b: genetic.n_edits_b },
      };
    },

    alignment: {
      n_pairs: alignment.n_pairs,
      pairs: alignment.pairs,
      unpaired_a: alignment.unpaired_a,
      unpaired_b: alignment.unpaired_b,
      warnings: alignment.warnings,
    },
    refused: [
      ...alignment.refused,
      ...(genetic.refused ? [{ refusal: genetic.refusal, why: genetic.why, axis: 'genetic' }] : []),
    ],
    warnings: [
      ...alignment.warnings,
      ...(genetic.warnings ?? []),
      ...(refusedMixedTemperature
        ? [{ what: 'at least one pair compares stages measured at different temperatures',
             consequence: WHAT_A_DISTANCE_HIDES.different_temperatures }]
        : []),
    ],
    what_this_hides: WHAT_A_DISTANCE_HIDES,
  };
  return result;
}

// ---------------------------------------------------------------------------------------------------
// MATRIX VALIDATION - the last gate before a tree
// ---------------------------------------------------------------------------------------------------

/**
 * Check a distance matrix is fit to hand to neighbour joining. This is a VALIDATOR, not a tree builder:
 * tree search is downstream, and this exists so that the thing downstream is never handed a matrix whose
 * malformation it would silently absorb into a topology.
 *
 * Neighbour joining will happily run on an asymmetric matrix - it reads one triangle - and produce a tree
 * that looks like every other tree. Nothing about the output says that half the input was ignored. So the
 * refusal has to happen here, with the offending indices named, because after this point the evidence of
 * the problem is gone.
 *
 * @returns {{ready: boolean, n: number, problems: object[]}} each problem names its indices.
 */
export function neighbourJoiningReady(matrix, { symmetry_tolerance = 0 } = {}) {
  const problems = [];
  const tol = Math.max(num(symmetry_tolerance) ?? 0, 0);

  if (!Array.isArray(matrix) || matrix.length === 0) {
    problems.push({ problem: 'not_a_matrix', detail: `expected a non-empty array of rows, got ${
      Array.isArray(matrix) ? 'an empty array' : JSON.stringify(matrix === undefined ? null : matrix)?.slice(0, 40)}` });
    return { ready: false, n: 0, problems, offending_indices: [], why_not_a_tree_builder: WHY_ONLY_A_VALIDATOR };
  }
  const n = matrix.length;

  for (let i = 0; i < n; i++) {
    if (!Array.isArray(matrix[i]) || matrix[i].length !== n) {
      problems.push({ problem: 'not_square', i, row_length: Array.isArray(matrix[i]) ? matrix[i].length : null,
        expected: n, detail: `row ${i} has ${Array.isArray(matrix[i]) ? `${matrix[i].length} entries` : 'no entries - it is not an array'}, and the matrix has ${n} rows` });
    }
  }
  const cell = (i, j) => (Array.isArray(matrix[i]) ? matrix[i][j] : undefined);
  const finite = (i, j) => {
    const v = cell(i, j);
    return typeof v === 'number' && Number.isFinite(v);
  };

  for (let i = 0; i < n; i++) {
    const row = Array.isArray(matrix[i]) ? matrix[i] : [];
    for (let j = 0; j < Math.min(n, row.length); j++) {
      if (!finite(i, j)) {
        problems.push({ problem: 'not_a_number', i, j, value: cell(i, j) === undefined ? null : cell(i, j),
          detail: `[${i}][${j}] is ${JSON.stringify(cell(i, j) ?? null)}. A null or NaN entry is not a large ` +
            `distance; it is an unmeasured one, and neighbour joining cannot tell the difference.` });
      }
    }
  }
  for (let i = 0; i < n; i++) {
    if (!finite(i, i)) continue;
    if (cell(i, i) !== 0) {
      problems.push({ problem: 'nonzero_diagonal', i, j: i, value: cell(i, i),
        detail: `[${i}][${i}] = ${cell(i, i)}: a taxon is at distance 0 from itself, or the matrix is not a ` +
          `distance matrix.` });
    }
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (!finite(i, j) || !finite(j, i)) continue; // already reported as not_a_number
      const delta = Math.abs(cell(i, j) - cell(j, i));
      if (delta > tol) {
        problems.push({ problem: 'asymmetric', i, j, a_ij: cell(i, j), a_ji: cell(j, i), delta,
          detail: `[${i}][${j}] = ${cell(i, j)} but [${j}][${i}] = ${cell(j, i)}. Neighbour joining reads one ` +
            `triangle and would never report that the other one disagreed.` });
      }
    }
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j || !finite(i, j)) continue;
      if (cell(i, j) < 0) {
        problems.push({ problem: 'negative_distance', i, j, value: cell(i, j),
          detail: `[${i}][${j}] = ${cell(i, j)}: a negative input distance is not a short branch, it is a ` +
            `sign error upstream.` });
      }
    }
  }

  return {
    ready: problems.length === 0,
    n,
    problems,
    offending_indices: problems.filter(p => p.i !== undefined).map(p => (p.j === undefined ? [p.i] : [p.i, p.j])),
    checked: ['square', 'all entries finite numbers', 'zero diagonal', 'symmetric', 'non-negative'],
    not_checked: ['the four-point condition, additivity, or whether these distances mean anything. A matrix ' +
      'can pass every check here and still be a matrix of coverage rather than of biology - see ' +
      'WHAT_A_DISTANCE_HIDES.coverage_masquerading_as_similarity.'],
    why_not_a_tree_builder: WHY_ONLY_A_VALIDATOR,
  };
}

const WHY_ONLY_A_VALIDATOR =
  'tree search is downstream. This function refuses to hand it a malformed matrix and does nothing else, ' +
  'because a validator that also built the tree would be tempted to repair the matrix on the way.';

// ---------------------------------------------------------------------------------------------------
// WHAT A DISTANCE HIDES
// ---------------------------------------------------------------------------------------------------

/**
 * The honest notes. Each one is a way this file's own output can be true and misleading at the same time,
 * which is the only kind of problem a correct implementation cannot fix.
 */
export const WHAT_A_DISTANCE_HIDES = Object.freeze({
  different_temperatures:
    'a small phenotypic distance between two organisms measured at different temperatures is not ' +
    'similarity. Development rate is temperature-dependent, so an embryo at 24 hpf and 25 C and one at ' +
    '24 hpf and 33 C are at different points of their trajectories; if they nonetheless look alike, the ' +
    'two effects have cancelled and the distance has measured the cancellation. Every pair carries its ' +
    'temperature_delta_C for this reason.',

  edit_count:
    'edit-count distance treats a single-base substitution and a 10 kb knock-in as equal, because both ' +
    'are one entry in a list. It is a distance over DESIGN DECISIONS, not over sequence: it counts how ' +
    'many times somebody edited, not how much of the genome changed. Two files that differ by one ' +
    'whole-cassette insertion are at distance 1, and two that differ by three silent SNPs are at ' +
    'distance 3.',

  undeclared_coordinates:
    'two edit lists against the same assembly can still be one base apart throughout, if one file means ' +
    '1-based inclusive and the other 0-based half-open and neither says which (COORDINATE_CONVENTIONS). ' +
    'Then every identical edit is counted as two differences, the distance is maximal, and nothing in the ' +
    'output looks wrong. A mismatch that is DECLARED is refused; one that is undeclared can only be warned ' +
    'about, which is why the warning is on every comparison that does not say.',

  coverage_masquerading_as_similarity:
    'a distance computed over traits that are mostly not-established is a statement about coverage, not ' +
    'about biology. The number of traits two files happen to share is itself a confound: the sparsest ' +
    'pair in a matrix is the pair compared on the fewest axes, which is systematically the pair that ' +
    'looks most similar. Hand that matrix to neighbour joining and the two organisms nobody measured ' +
    'come out as sisters. This is why n_traits_used is returned with every distance and why reporting ' +
    'the distance without it is reporting coverage as similarity.',

  the_rms_normalisation:
    'the distance is a root-mean-square, so it does not grow with the number of traits - which is what ' +
    'makes two pairs with different coverage comparable, and also what makes the coverage invisible in ' +
    'the number itself. The normalisation does not solve the confound above; it relocates it into n.',

  log_space_and_zero:
    'working in log space means a trait that is zero in one organism and nonzero in the other has no ' +
    'distance at all - log 0 is not a number - so the most dramatic phenotypic difference available, the ' +
    'presence or absence of a structure, is the one this distance cannot express. It is excluded and ' +
    'counted, never silently dropped.',

  categorical_traits_have_no_distance:
    'a .life phenotype map is not a numeric vector. examples/mouse-preimplantation.life carries ' +
    'total_volume_conserved: true and utmm_coverage: "transcriptome only" beside its cell counts, and ' +
    'there is no subtraction for either. They are excluded and counted rather than coerced, because ' +
    'true - false = 1 is a number with no units and no meaning. A matching or Hamming distance over the ' +
    'categorical traits would be a second, different distance, and this file does not invent one: it ' +
    'would need its own weight against the numeric one, which is the refusal in no_single_number_distance ' +
    'all over again.',

  per_cell_channels:
    'the channels a stage carries per cell (CHANNELS in spec.mjs: transcriptome, mechanics, geometry, ' +
    'lineage, signalling) are not collapsed into the phenotype vector here. A mean modulus over an ' +
    'embryo discards the neighbour relations the channel exists to record, and UTMM\'s own finding - ' +
    'lineage bias aligning to mechanical difference BETWEEN cells - is invisible in the mean. If a ' +
    'summary is wanted it must be written into the stage as a `derived` value with its rule stated, so ' +
    'it carries a kind like every other number.',

  alignment_is_an_assumption:
    'pairing two stages because they report the same number in the same unit assumes the two clocks were ' +
    'started at the same event. For hpf that is fertilisation and is reasonably safe; for E it is a plug ' +
    'morning, which is an offset convention and not a clock (TIME_UNIT_NOTES.E).',

  zero_is_not_null:
    'distance 0 means identical on the traits used. distance null means there was nothing to compare. A ' +
    'pipeline that reads null as 0 will invent a clade of files that share no measurements.',
});

export const WHY_EACH_REFUSAL_HERE = Object.freeze({
  cross_unit: REFUSALS.no_cross_unit_distance,
  ordinal_never: 'an ordinal unit is refused even when a conversion is offered, because the refusal is not ' +
    'about the factor being unknown - it is about there being no quantity for a factor to act on.',
  different_assembly: 'a symmetric difference over coordinates requires one coordinate system. Across two ' +
    'assemblies it measures the assemblies.',
  no_single_number: REFUSALS.no_single_number_distance,
  malformed_matrix: 'neighbour joining absorbs a malformed matrix into a topology that looks like any other, ' +
    'so the refusal has to happen before it, where the evidence still exists.',
});
