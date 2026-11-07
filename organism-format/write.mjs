#!/usr/bin/env node
// Build a .organism file from this repository's own artefacts, so the example cannot drift from what the
// project actually knows.
//
//   node organism-format/write.mjs [--out examples/winged-zebrafish.organism]
//
// Everything here is READ from a committed file: the phenotypic axes and their verdicts from
// design-validation/scorecard.json, the allometries from sim-engine/params/ontogeny.json, the edits and
// their corrections from sim-engine/validate/bench/cases.mjs. Nothing is retyped, because a retyped
// number is a number that will disagree with its source within a month.
//
// The result is mostly `not-established`, and that is the honest content: 9 of 10 pre-registered
// phenotypic axes cannot be scored, including the one the whole design claim rests on. A format that
// could not carry that would lose the most important thing this project knows about its own design.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as SPEC from './spec.mjs';
import * as C from '../sim-engine/validate/bench/cases.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const argv = process.argv.slice(2);
const val = n => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] ?? null : null; };
const OUT = val('out') ?? path.join(HERE, 'examples/winged-zebrafish.organism');

const scorecard = JSON.parse(fs.readFileSync(path.join(ROOT, 'design-validation/scorecard.json'), 'utf8'));
const ontogeny = JSON.parse(fs.readFileSync(path.join(ROOT, 'sim-engine/params/ontogeny.json'), 'utf8'));

const SRC = {
  scorecard: 'design-validation/scorecard.json (pre-registration hashed 2026-10-31T22:00:34Z, before the first number)',
  ontogeny: 'sim-engine/params/ontogeny.json',
  cases: 'sim-engine/validate/bench/cases.mjs',
};

// ---- the genome, as an edit list ------------------------------------------------------------------
const knockin = C.caseById('kcnk5b-alf-knockin');
const genome = {
  representation: 'edit-list',
  assembly: 'GRCz11',
  assembly_source: 'Ensembl, Danio_rerio.GRCz11.dna.primary_assembly',
  base_organism: { name: 'Danio rerio', taxid: 'NCBITaxon:7955', strain: 'wild-type AB/TU' },
  why_not_inline_fasta: SPEC.GENOME_REPRESENTATIONS['edit-list'].why_preferred,
  edits: [
    {
      id: 'kcnk5b-W169L',
      gene: 'kcnk5b',
      change: 'p.W169L',
      coding_change: 'c.506G>T',
      coordinates: { chromosome: '20', position: 9232965, ref: 'G', alt: 'T', assembly: 'GRCz11' },
      class: 'point, gain-of-function',
      status: 'PROPOSED. Not built, not injected, not verified in any animal.',
      published_allele: 'alf^dty86d or alf^dt30mh - the two alf alleles carry W169L and F241Y, one each',
      a_correction_that_travels_with_it: C.ALLELE_CORRECTIONS.find(a => a.id === 'kcnk5b-two-alleles-not-one-genotype')?.not_established ?? null,
      source: SRC.cases,
    },
  ],
  edits_considered_and_rejected: C.ALLELE_CORRECTIONS.map(a => ({ id: a.id, why: a.consequence })),
};

// ---- the phenotype, stage by stage ----------------------------------------------------------------
const axes = scorecard.part1_phenotypic.per_axis;
function traitFromAxis(a) {
  const d = a.design ?? {};
  const name = a.axis;
  const scope = `a value on this axis says nothing about any other axis, and nothing about whether the organism is viable. Axis ${a.n} of ${axes.length} declared in the pre-registration.`;
  if (typeof d.value === 'number') {
    return [name, SPEC.value({
      v: d.value, unit: 'dimensionless', kind: 'assumed',
      scope: `${scope} This is a DESIGN SPECIFICATION - a target someone wrote down - not a measurement of anything.`,
      note: d.status ?? null,
    })];
  }
  return [name, SPEC.unknown({
    why: d.reason ?? a.zebrafish?.reason ?? 'the scorecard records no value for this axis',
    searched: 'design-validation fetched sources; see scorecard.json per_axis for the per-axis reason',
    what_would_resolve_it: a.n === 1
      ? 'a measured wild-type adult zebrafish pectoral-fin-length / standard-length allometry. None was found in any fetched source, and a partner lab could produce one from existing adults with calipers and no injection.'
      : 'a measured value on this axis for either the baseline or the reference organism',
    scope,
  })];
}

const adultTraits = Object.fromEntries(axes.map(traitFromAxis));

// the two allometries that ARE measured, from the parameter table
const zf = ontogeny.species.zebrafish.allometries ?? [];
for (const a of zf) {
  adultTraits[`${a.y} vs ${a.x} (allometric exponent b)`] = SPEC.value({
    v: a.b, unit: 'dimensionless', kind: 'measured',
    source: a.source?.cite ?? a.source?.id ?? SRC.ontogeny,
    scope: `an exponent for the BASELINE organism, Danio rerio. It is not a property of the design, and it says nothing about fins.${a.n ? ` n = ${a.n}.` : ''}`,
    note: a.note ?? null,
  });
}

const phenotype = {
  stages: [
    {
      name: 'pectoral fin bud',
      time: 48, time_unit: 'hpf', temperature_C: 28.5,
      temperature_source: 'the standard rearing temperature; sim-engine/scales/micro/staging.mjs carries the retiming law and its 25-33 C validated window',
      traits: {
        'pectoral fin bud area / eye area': SPEC.unknown({
          why: 'the published source reports the DIRECTION only. No mean, SD, n or p appears in its main text for this comparison; the per-comparison values are in supplementary source data.',
          searched: 'Jiang et al. 2024, PLoS Biol 22(3):e3002565 - main text and figure legends',
          what_would_resolve_it: 'one extraction from that paper\'s S4 Data, which would also make the cheapest informative experiment in the bench package powerable',
          scope: 'even with a number this is a bud-area ratio in an injected embryo, which is not an adult fin and not a flight surface.',
        }),
      },
    },
    {
      name: 'adult',
      time: 365, time_unit: 'days', temperature_C: 28.5,
      temperature_source: 'as above',
      traits: adultTraits,
    },
  ],
  how_to_read_this:
    'most traits here are `not-established`, and that is the finding rather than an omission. The ' +
    'pre-registered scorecard could score 1 of 10 declared axes, and the axis the design claim rests on ' +
    'is not the one it could score.',
};

// ---- environment -----------------------------------------------------------------------------------
const environment = {
  medium: SPEC.value({ v: 'fresh water', kind: 'assumed', scope: 'the rearing medium assumed for every stage above. Nothing here models a wild habitat, a predator, or competition for resources.' }),
  temperature_C: SPEC.value({ v: 28.5, unit: 'C', kind: 'assumed', scope: 'the laboratory standard. sim-engine/scales/micro/environment.mjs records that the measured wild range is 24.5-35.3 C, which runs past BOTH ends of the window where the developmental clock is validated.' }),
  what_is_absent: 'predation, competition, food availability, flow, conspecifics. An organism file that carried a phenotype and no ecology invites the reader to assume the phenotype is enough.',
};

// ---- validation -------------------------------------------------------------------------------------
const validation = {
  source: SRC.scorecard,
  preregistered: true,
  prereg_note: 'the pre-registration was hashed before the first number was produced',
  phenotypic: {
    axes_declared: scorecard.part1_phenotypic.axes_preregistered,
    axes_scored: scorecard.part1_phenotypic.n_scored,
    axes_unscoreable: scorecard.part1_phenotypic.n_cannot_score,
    verdict: scorecard.part1_phenotypic.verdict,
    why_unscoreable: scorecard.part1_phenotypic.cannot_score_reason_tally,
  },
  lean_gate: scorecard.part3_lean_gate?.tallies ?? null,
  joint: scorecard.joint_result ?? null,
  what_a_passing_validation_would_still_not_show: 'that the organism can be built, or that it would survive anything.',
};

// ---- the file ----------------------------------------------------------------------------------------
const doc = {
  format: SPEC.FORMAT,
  generated_by: 'organism-format/write.mjs, from committed artefacts',
  generated: new Date().toISOString().slice(0, 10),
  identity: {
    name: 'winged zebrafish',
    short_id: 'winged-zebrafish',
    derived_from: { name: 'Danio rerio', taxid: 'NCBITaxon:7955' },
    modelled_on: 'flying fishes, Exocoetidae',
    what_it_is: 'a DESIGN. It has not been built and no part of it has been observed.',
  },
  genome,
  phenotype,
  environment,
  validation,
  not_established: [
    'that the organism exists',
    'that it is viable',
    'that it has been built',
    'that any institution has approved building it',
    'that the pectoral fin axis the design rests on has any measured value, in the design OR in the baseline',
    'that the single scoreable phenotypic axis passed - it scored f = 0.00',
    'that the organism could compete with, feed itself among, or avoid being eaten by anything',
  ],
  provenance: {
    every_value_carries: ['kind', 'scope'],
    kinds_used: 'see spec.mjs KINDS; `not-established` marks a trait that was declared and could not be found',
    sources: SRC,
    reader: 'organism-format/read.mjs refuses a file whose values lack a kind or a scope',
  },
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(doc, null, 1));

const { read, usableFor } = await import('./read.mjs');
const r = read(fs.readFileSync(OUT, 'utf8'), { source: OUT });
console.log(`written to ${path.relative(ROOT, OUT).replace(/\\/g, '/')}  (${fs.statSync(OUT).size} bytes)`);
console.log(`reader: ${r.summary}`);
console.log(`values by kind: ${JSON.stringify(r.values_by_kind)}`);
for (const purpose of ['simulate', 'publish_a_number', 'render']) {
  const u = usableFor(r, purpose);
  console.log(`  ${purpose.padEnd(18)} excludes ${u.n_excluded} value(s) of kind ${JSON.stringify(u.excluded_kinds)}`);
}
if (r.problems.length) { console.error('\nREFUSED:'); for (const p of r.problems) console.error(`  ${p.field}: ${p.what}`); process.exit(1); }
