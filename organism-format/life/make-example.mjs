#!/usr/bin/env node
// Build the worked example: mouse preimplantation development, zygote through morula.
//
//   node organism-format/life/make-example.mjs [--out <path>]
//
// EVERY field is either sourced or marked. The stage series and the direction of the mechanical change
// come from UTMM (Habibi, Sinha, Yang et al. 2026, doi 10.64898/2026.02.23.706394, PMID 42124641); the
// cleavage timings are standard mouse embryology; the per-cell GEOMETRY is `depicted`, because nobody has
// handed us coordinates and a sphere packing is a drawing of an embryo rather than a measurement of one.
//
// The point of the example is not to be impressive. It is to show what the format says when most of the
// file is not known - the .organism example came out at 9 not-established / 4 assumed / 2 measured, and
// that one line was the most useful thing about it.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { value, unknown, cell, stage, life } from './write.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const OUT = (() => { const i = argv.indexOf('--out'); return i >= 0 ? argv[i + 1] : path.join(HERE, 'examples/mouse-preimplantation.life'); })();

const UTMM = 'Habibi E, Sinha A, Yang H, et al. Unified Transcriptome and Mechanics Map of the Intact Mammalian Preimplantation Embryo In Situ. bioRxiv 2026. doi:10.64898/2026.02.23.706394 (PMID 42124641)';
const EMBRYOLOGY = 'standard mouse preimplantation timing; cleavage stages by embryonic day, E0.5 = plug morning';

// ---------------------------------------------------------------- geometry: a DEPICTION
// A cleaving mammalian embryo is held in a zona pellucida of roughly fixed volume, so each cleavage
// roughly halves cell volume while total volume is conserved. That is enough to draw, and nothing like
// enough to measure: real blastomeres are flattened against one another, not spherical, and compaction at
// the 8-cell stage changes shape without changing volume. So this is `depicted` and labelled as such.
const ZYGOTE_RADIUS_UM = 40; // a mouse oocyte/zygote is ~80 um across including no zona; see note below
const GEOM_NOTE = 'spheres of conserved total volume in a fixed shell. A drawing, not a measurement: real blastomeres are flattened against their neighbours and compaction changes shape without changing volume.';

/** Place n cells as a sphere packing inside the original zygote volume, deterministically. */
function packCells(n, stageId) {
  const r = ZYGOTE_RADIUS_UM * Math.cbrt(1 / n); // volume conserved
  const out = [];
  if (n === 1) return [{ centre: [0, 0, 0], radius: r }];
  // a deterministic spiral on a sphere of radius (R - r), so cells sit inside the shell and touch
  const shell = Math.max(0, ZYGOTE_RADIUS_UM - r);
  for (let i = 0; i < n; i++) {
    const y = n === 1 ? 0 : 1 - (2 * i) / (n - 1);
    const rad = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = Math.PI * (3 - Math.sqrt(5)) * i; // golden angle
    out.push({ centre: [shell * rad * Math.cos(theta), shell * y, shell * rad * Math.sin(theta)].map(v => Number(v.toFixed(3))), radius: Number(r.toFixed(3)) });
  }
  return out;
}

/**
 * The stage series. `stiffness_rank` is an ORDINAL, not a modulus: UTMM reports a gradual softening from
 * the 2-cell through morula stages, and the direction is what we can cite. The number of pascals is not in
 * anything accessible to us, so no pascal value is written - a plausible modulus here would be
 * indistinguishable from a measured one once it left the file.
 */
const STAGES = [
  { id: 'zygote', name: 'zygote', E: 0.5, cells: 1, lineages: null },
  { id: 'two-cell', name: '2-cell', E: 1.5, cells: 2, lineages: null, stiffness_rank: 1 },
  { id: 'four-cell', name: '4-cell', E: 2.0, cells: 4, lineages: null, stiffness_rank: 2 },
  { id: 'eight-cell', name: '8-cell', E: 2.5, cells: 8, lineages: null, stiffness_rank: 3, note: 'compaction occurs around here; cell shape changes without a change in volume, which the sphere depiction cannot show' },
  { id: 'morula', name: 'morula', E: 3.0, cells: 16, lineages: ['trophectoderm', 'inner-cell-mass'], stiffness_rank: 4 },
];

const stages = STAGES.map((s, idx) => {
  const packed = packCells(s.cells, s.id);
  const cells = packed.map((g, i) => {
    const channels = {
      geometry: {
        centre: g.centre, radius: g.radius,
        // exposed surface area is the quantity lineage bias tracks, and we do not have it
        exposed_surface_area: null,
        note: 'exposed surface area not established; it is the geometric quantity UTMM finds lineage bias tracks, and it cannot be derived from a sphere packing',
      },
    };
    // the morula is the only stage where a lineage label is meaningful, and even there it is a
    // position-based GUESS rather than a measurement: outer cells become trophectoderm, roughly.
    if (s.lineages) {
      const rho = Math.hypot(...g.centre);
      channels.lineage = {
        parent: null,
        fate: rho > ZYGOTE_RADIUS_UM * 0.45 ? 'trophectoderm' : 'inner-cell-mass',
        fate_confidence: null,
        note: 'assigned from radial position in a DEPICTED packing. Not a measurement, and not a prediction either - UTMM finds that positional geometry rather than cell shape predicts trophectoderm profile, which this packing is not good enough to test.',
      };
    }
    return cell({ id: `${s.id}-c${i + 1}`, channels });
  });

  const phenotype = {
    cell_count: value({ v: s.cells, unit: 'cells', kind: 'measured-secondhand', source: EMBRYOLOGY, scope: 'mouse preimplantation embryo at this stage', note: 'the cleavage series is not in dispute' }),
    total_volume_conserved: value({ v: true, kind: 'assumed', scope: 'this depiction', note: 'the zona pellucida holds volume roughly constant through cleavage. Assumed here so the drawing is consistent; not measured on any embryo.' }),
    cytoplasmic_stiffness_Pa: unknown({
      why: 'UTMM reports a gradual softening from the 2-cell through morula stages, and the direction is citable; no modulus in pascals is available to us',
      searched: UTMM,
      what_would_resolve_it: 'the UTMM data, or the figure values. It is in-house work, so asking is cheap',
      scope: 'cytoplasm of a blastomere at this stage',
    }),
    ...(s.stiffness_rank ? {
      stiffness_ordinal_rank: value({
        v: s.stiffness_rank, unit: 'rank (1 = stiffest observed, higher = softer)', kind: 'measured-secondhand', source: UTMM,
        scope: 'mouse blastomeres, 2-cell through morula, high-frequency elastic modulus',
        note: 'an ORDINAL standing in for a modulus. UTMM reports monotonic softening across these stages; this records the ordering, which is what can be cited, and deliberately not a number of pascals.',
      }),
    } : {}),
  };

  return stage({
    id: s.id, name: s.name, time: s.E, time_unit: 'E', temperature_C: 37,
    cells, geometry_provenance: { kind: 'depicted', source: null, note: GEOM_NOTE },
    phenotype, observed: false,
    note: s.note ?? null,
  });
});

const doc = life({
  identity: {
    id: 'mus-musculus-preimplantation-reference',
    label: 'Mouse preimplantation development, zygote to morula',
    species: 'Mus musculus',
    is_a_design: false,
    what_it_is: 'a reference trajectory assembled from published stage structure, to exercise the format against a real developmental series rather than an invented one',
  },
  describes_organism: null,
  genome: {
    representation: 'reference-only',
    reference: { assembly: 'GRCm39', accession: 'GCF_000001635.27', note: 'wild type. This trajectory carries no edits - it is the baseline a design would be compared against.' },
    edits: [],
    sequences: [],
  },
  stages,
  provenance: {
    stage_series: UTMM,
    timings: EMBRYOLOGY,
    geometry: `DEPICTED - ${GEOM_NOTE}`,
    built: 'organism-format/life/make-example.mjs',
    scale_note: `zygote radius taken as ${ZYGOTE_RADIUS_UM} um, an order-of-magnitude figure for a mouse zygote and not a measurement on any specimen`,
  },
  not_established: [
    { what: 'which stages were observed and which were filled in', answer: 'NONE were observed by us. Every stage is assembled from published structure, and observed:false is set on all of them.' },
    { what: 'for each channel, on how many cells it was actually measured', answer: 'zero. geometry is depicted on every cell; mechanics and transcriptome are absent per cell and present only as a per-stage ordinal.' },
    { what: 'whether the geometry is a measurement, a reconstruction, or a drawing', answer: 'a drawing. Spheres of conserved total volume in a fixed shell.' },
    { what: 'what the file cannot be used to simulate', answer: 'anything mechanical. There is no modulus, no adhesion, no cortical tension and no zona. It can be rendered and it can be compared stage-for-stage on cell count; it cannot be used to predict a fate decision.' },
    { what: 'exposed surface area, the quantity lineage bias tracks', answer: 'not established, and not derivable from this packing.' },
    { what: 'the transcriptome', answer: 'absent. UTMM measures it per cell in situ; we have the paper, not the data.' },
  ],
});

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(doc, null, 1));

// the census line, which is the most useful thing about the file
const census = {};
let n = 0;
for (const s of doc.timeline.stages) {
  for (const v of Object.values(s.phenotype ?? {})) {
    n++;
    const k = v.unknown ? 'not-established' : v.kind;
    census[k] = (census[k] ?? 0) + 1;
  }
}
console.log(`wrote ${path.relative(path.resolve(HERE, '../..'), OUT).replace(/\\/g, '/')}  (${fs.statSync(OUT).size} bytes)`);
console.log(`stages: ${doc.timeline.stages.length}, cells: ${doc.timeline.stages.reduce((a, s) => a + (s.geometry?.cells.length ?? 0), 0)}`);
console.log(`phenotype values: ${n} -> ${JSON.stringify(census)}`);
console.log(`geometry provenance on every stage: ${[...new Set(doc.timeline.stages.map(s => s.geometry.provenance.kind))].join(', ')}`);
console.log(`not_established entries: ${doc.not_established.length}`);
if (doc.not_established_incomplete) console.log(`STILL INCOMPLETE: ${JSON.stringify(doc.not_established_incomplete)}`);
