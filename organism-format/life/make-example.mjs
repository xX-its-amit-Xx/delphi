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
  {
    id: 'zygote', name: 'zygote', E: 0.5, cells: 1, lineages: null,
    utmm_covers: false,
    note: 'UTMM does NOT cover this stage. Both of its abstracts say "from the zygote", but every reported cohort starts at late 2-cell (transcriptome) or 4-cell (mechanics), and no zygote transcriptome, mechanics value or cell count appears in the accessible text. This row carries standard embryology only.',
  },
  { id: 'two-cell', name: 'late 2-cell', E: 1.5, cells: 2, lineages: null, utmm_covers: 'transcriptome only', note: 'the first stage UTMM measures, and only by 3DISS (n = 6 embryos). No mechanics here: passive microrheology starts at 4-cell.' },
  { id: 'four-cell', name: '4-cell', E: 2.0, cells: 4, lineages: null, utmm_covers: true, stiffness_rank: 1, bead_G_Pa: 35 },
  { id: 'eight-cell', name: '8-cell', E: 2.5, cells: 8, lineages: null, utmm_covers: true, stiffness_rank: 2, bead_G_Pa: 10, note: 'compaction begins around the late 8-cell stage; cell shape changes without a change in volume, which the sphere depiction cannot show. E2.5 is anchored by UTMM itself: >80% of its PEG control embryos had reached compacted 8-cell at E2.5.' },
  { id: 'morula', name: 'morula', E: 3.0, cells: 16, lineages: ['trophectoderm', 'inner-cell-mass'], utmm_covers: true, stiffness_rank: 3, note: 'UTMM strata: early morula 9-16 cells, mid-late 17-32. Its 3DISS span ends at E3.25.' },
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
    // NO per-cell modulus is written, at any stage, and the reason is a correction rather than a gap.
    // The PubMed/PMC abstract says "high-frequency elastic modulus"; that deposit is a STALE VERSION.
    // bioRxiv v2 says "intracellular mechanical compliance" and "a RELATIVE readout", and the per-cell
    // channel is reported only as RMSD0 and dRMSD - displacements, no nm values, no conversion to Pa.
    cytoplasmic_compliance: unknown({
      why: 'UTMM\'s per-cell mechanics channel is a RELATIVE compliance reported as RMSD0 and dRMSD, with no values in nm in the accessible text and no published conversion to stress. There is no per-cell number to carry, and inventing a modulus would make the file lie in a way no reader could detect.',
      searched: `${UTMM} (bioRxiv v2, 2026-10-23; the PMC deposit is the older v1 and still says "elastic modulus")`,
      what_would_resolve_it: 'the supplementary PDF, which holds the Methods and presumably the RMSD values; or the data. It is in-house work, so asking is cheap',
      scope: 'cytoplasm of a blastomere at this stage',
    }),
    ...(s.stiffness_rank ? {
      compliance_ordinal_rank: value({
        v: s.stiffness_rank, unit: 'rank (1 = stiffest measured, higher = softer)', kind: 'measured-secondhand', source: UTMM,
        scope: 'mouse blastomeres, 4-cell through morula - the stages UTMM actually measured mechanically',
        note: 'an ORDINAL, deliberately not a number of pascals. UTMM reports monotonic softening across these stages and the ORDERING is what can be cited. Passive microrheology was run on 4-cell, 8-cell and morula only, so the 2-cell and zygote rows carry no rank.',
      }),
    } : {}),
    // The pascal values that DO exist are from a different experiment on different objects, and are
    // carried separately so they can never be mistaken for the per-cell channel.
    ...(s.bead_G_Pa ? {
      shear_modulus_from_bead_validation_Pa: value({
        v: s.bead_G_Pa, unit: 'Pa', kind: 'measured-secondhand', source: UTMM,
        scope: 'ENDOCYTOSED BEADS in a separate optical-tweezers validation at 1 Hz, NOT the per-cell channel registered to the transcriptome',
        note: 'rounded in the source ("~35", "~10"). Carried only so the magnitude is on record; it is a measurement of beads in cytoplasm under active driving, not of the cells UTMM maps, and the two must not be merged.',
      }),
    } : {}),
    utmm_coverage: value({
      v: s.utmm_covers === false ? 'none' : String(s.utmm_covers), kind: 'derived', scope: 'which UTMM channels cover this stage',
      source: UTMM, note: 'derived by reading which cohorts the paper reports, not from any summary of it',
    }),
  };

  return stage({
    id: s.id, name: s.name, time: s.E, time_unit: 'E', temperature_C: 37,
    cells, geometry_provenance: { kind: 'depicted', source: null, scope: 'the drawn arrangement of blastomeres at this stage; not any specimen', note: GEOM_NOTE },
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
    { what: 'the transcriptome', answer: 'absent. UTMM measures it per cell in situ (150-gene targeted panel, 742 cells across 69 embryos); we have the paper, not the data.' },
    { what: 'anything at all about the zygote, from UTMM', answer: 'UTMM does not cover it. Both abstracts say "from the zygote" and every reported cohort starts at late 2-cell (3DISS) or 4-cell (mechanics). The zygote row here is standard embryology only.' },
    { what: 'a per-cell modulus in pascals', answer: "does not exist. UTMM's per-cell channel is a RELATIVE compliance (RMSD0, dRMSD) with no nm values published and no conversion to stress. The pascal figures in the paper are from a separate optical-tweezers validation on endocytosed beads and are carried under their own name." },
    { what: 'why Hippo/YAP is not mentioned anywhere in this file', answer: "because it is not UTMM's result. The line about positional geometry rather than cell shape predicting Hippo/YAP cites prior work (Royer et al. 2020, Development, doi:10.1242/dev.189449). UTMM never measures YAP; its own claim is that geometry separates transcriptionally defined states." },
    { what: 'hours post-hCG for any stage', answer: "not carried. Only the 2-cell figure (42-44 h) is measured in the literature; the rest would be arithmetic on a 10 h doubling time, and UTMM's own embryos were cultured from 4-cell in KSOM, which runs slower than in vivo." },
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
