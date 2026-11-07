// THE .organism FORMAT: a portable description of a designed organism that cannot state a phenotype
// without saying how it was obtained.
//
// ============================== THE ANALOGY, AND WHERE IT BREAKS ==============================
// An .stl file is honest because of what it refuses to carry. It holds triangles. It does not claim the
// object can be printed, that the material exists, or that the part will bear load. Anyone who has held
// an .stl knows exactly how much it is promising, which is why a dozen programs can read one without
// arguing about what it means.
//
// An organism file is harder, because the interesting fields are CLAIMS. "Pectoral fin length / standard
// length = 0.31" is not a triangle: it is measured, or predicted, or copied from a relative, or assumed -
// and a file that stores the number without the distinction is a file that launders a guess into a fact
// the moment it is read by a second program.
//
// So the one rule this format is built around:
//
//     EVERY VALUE CARRIES A `kind` AND A `scope`. A value with no kind is not a value, and the reader
//     refuses the file rather than guessing one.
//
// `kind` is the vocabulary this repository already uses on ~950 parameter entries (sim-engine/lib/
// envelope.mjs): measured, measured-secondhand, borrowed, derived, calibrated, assumed - plus `depicted`
// from the scale ladder, for a number that exists only to be drawn. `scope` says what the value does NOT
// establish, and it is mandatory for the same reason it is mandatory in the envelope: a number travels
// further than its caveat unless the caveat is inside it.
//
// ============================== WHY NOT A FASTA ==============================
// The obvious design is "the FASTA plus a phenotype table". A zebrafish primary assembly is 1.37 Gbp -
// 410 MB compressed - and 99.999 % of it is identical to the reference. A format that embeds it is not
// portable, and worse, it HIDES THE DESIGN: a reader cannot tell which bases are the point.
//
// So the genome is carried as an EDIT LIST against a named assembly, with the edited windows inline. The
// file then states exactly what differs and nothing else, it is kilobytes, and a reader that wants the
// full sequence has an unambiguous recipe. A file may carry inline FASTA for a sequence that is NOT in
// any assembly - a transgene, a synthetic construct - because for those there is no reference to diff
// against, and that case is flagged rather than mixed in.
//
// ============================== WHAT THIS FORMAT IS NOT ==============================
//   * NOT a simulation. It is the input a simulator reads, and it says which of its numbers a simulator
//     is allowed to treat as data.
//   * NOT evidence the organism is viable, buildable or sane. It has a validation block precisely so that
//     a reader can see what was checked and what could not be.
//   * NOT a licence to build anything. It carries no approval and cannot grant one.
//   * NOT a stable public standard. Version 0.1.0, written in a week, by one project.

export const FORMAT = 'organism/0.1.0';
export const EXTENSION = '.organism';
export const MEDIA_TYPE = 'application/vnd.delphi.organism+json';

/** The provenance vocabulary. Identical to sim-engine/lib/envelope.mjs plus `depicted`, deliberately:
 *  a second vocabulary for the same idea is how two parts of a system come to disagree about a fact. */
export const KINDS = Object.freeze({
  measured: 'someone measured this, on this organism or this construct, and the source says so',
  'measured-secondhand': 'measured by someone else and read from their report rather than their data',
  borrowed: 'measured on a DIFFERENT organism and applied here. The nearest relative, usually. Says nothing about this one.',
  derived: 'computed from other values in this file, by a stated rule',
  calibrated: 'fitted so that a model reproduces a measurement. Carries the measurement it was fitted to.',
  assumed: 'chosen by a person or a program because something was needed. Not evidence.',
  depicted: 'exists only so that something can be drawn. Never to be read as data.',
});

export const REQUIRED_TOP_LEVEL = ['format', 'identity', 'genome', 'phenotype', 'provenance', 'not_established'];

/** A value, with the two fields that make it readable by a stranger. */
export function value({ v, unit = null, kind, source = null, scope, note = null }) {
  if (!(kind in KINDS)) {
    return { invalid: true, why: `kind "${kind}" is not one of: ${Object.keys(KINDS).join(', ')}` };
  }
  if (!scope || typeof scope !== 'string' || scope.length < 10) {
    return { invalid: true, why: 'every value needs a `scope` saying what it does NOT establish. A number travels further than its caveat unless the caveat is inside it.' };
  }
  if (kind !== 'assumed' && kind !== 'depicted' && !source) {
    return { invalid: true, why: `kind "${kind}" claims an origin outside this file, so it needs a \`source\`. Only "assumed" and "depicted" may have none.` };
  }
  return { v, unit, kind, source, scope, ...(note ? { note } : {}) };
}

/** A trait that was DECLARED and could not be established.
 *
 *  Most formats cannot say this. They have a field, and the field is either filled or absent - and an
 *  absent field reads as "nobody thought about it", which is a different and much weaker statement than
 *  "we declared this axis in advance, went looking, and the value does not exist in any source we could
 *  reach". This project's own validation scorecard is mostly the second kind: 9 of 10 pre-registered
 *  phenotypic axes could not be scored at all, and the axis the whole design claim rests on is among
 *  them. A format that could not carry that would lose the most important thing we know. */
export function unknown({ why, searched = null, what_would_resolve_it = null, scope }) {
  if (!why || String(why).length < 10) return { invalid: true, why: 'an unknown value needs a reason. "null" with no reason is indistinguishable from a field nobody filled in.' };
  if (!scope || String(scope).length < 10) return { invalid: true, why: 'an unknown value still needs a scope: what would NOT follow even if it were known.' };
  return { v: null, unknown: true, kind: 'not-established', why, searched, what_would_resolve_it, scope };
}

export const GENOME_REPRESENTATIONS = Object.freeze({
  'edit-list': {
    what: 'differences from a named reference assembly, with the edited windows inline',
    when: 'the organism is a modification of something with a published assembly. Almost always.',
    why_preferred: 'kilobytes instead of hundreds of megabytes, and it states what the design IS rather than burying it in an identical background.',
  },
  'inline-fasta': {
    what: 'literal sequence carried in the file',
    when: 'a transgene or synthetic construct with no reference to diff against',
    caution: 'a file that inlines a whole genome is not portable and hides its own design. The reader warns on any inline sequence over 100 kb.',
  },
  'reference-only': {
    what: 'a named assembly with no edits: the baseline organism',
    when: 'describing the thing a design is measured against',
  },
});

export const STAGE_VOCABULARY = Object.freeze({
  note: 'a stage is named AND given a time with a unit, because "larval" means different things across species and "48 hpf" means one thing.',
  time_units: ['hpf', 'dpf', 'days', 'months'],
  required_on_each_stage: ['name', 'time', 'time_unit', 'temperature_C'],
  why_temperature: 'development rate is temperature-dependent, so a stage time without a temperature is not a stage. sim-engine/scales/micro/staging.mjs carries the retiming law and its validated window.',
});

/** What a reader must be told it cannot conclude. A file without this block is refused. */
export const NOT_ESTABLISHED_MINIMUM = [
  'that the organism exists',
  'that it is viable',
  'that it has been built',
  'that any institution has approved building it',
];

export const WHY_EACH_RULE = Object.freeze({
  kind_required:
    'because the alternative is a format where a predicted number and a measured one are stored in the ' +
    'same field. The second program to read the file cannot tell them apart, and by the third nobody ' +
    'remembers there was a difference.',
  scope_required:
    'because a number is quoted far more often than its caveat. Putting the caveat inside the value is ' +
    'the only way it travels with it.',
  source_required_unless_assumed:
    'an assumption is allowed - most useful models contain several - but it has to be visible. A value ' +
    'that claims to be measured and names no measurement is the one shape this format exists to prevent.',
  not_established_required:
    'the four minimum entries are the claims a reader is most likely to make on the file\'s behalf. ' +
    'Writing them down costs nothing and removes the most common misreading.',
  temperature_on_every_stage:
    'a developmental time without a temperature is not a time. The same embryo at 25 C and 33 C is at ' +
    'different stages at the same hour.',
  validation_block_may_be_empty_but_not_absent:
    'an empty validation block says "nothing was checked", which is information. A missing one says ' +
    'nothing at all, and reads as though checking was not relevant.',
});
