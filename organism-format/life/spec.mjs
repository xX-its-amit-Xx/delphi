// .life - an organism's whole trajectory, in time, renderable and comparable.
//
// ============================== WHY A SECOND FORMAT ==============================
// .organism/0.1.0 (organism-format/spec.mjs) describes a design at rest. Stages appear in it as metadata:
// a named time at which some phenotype value is claimed to hold. That is the right shape for "here is a
// design and here is what we believe about it", and it is the wrong shape for the thing actually being
// designed, which is a DEVELOPMENTAL TRAJECTORY.
//
// The difference is not cosmetic. A snapshot cannot be wrong about a trajectory - it has nothing to be
// wrong with. Make time the primary axis and the file starts making checkable claims: that this cell count
// follows that one, that this stiffness falls as that lineage separates, that a mesh at 36 hpf is the same
// animal as the mesh at 24 hpf. Those claims can be false, which is what makes them worth storing.
//
// So .life is not a richer .organism. It is a trajectory of states, each one renderable and each one
// comparable, and it carries .organism as the description of the animal whose trajectory it is.
//
// ============================== THE FOUR THINGS A .life MUST YIELD ==============================
// A format earns its extension by what can be got OUT of it. The ask was: parse into .stl files and a
// genome sequence, for sequence and phenotype comparison and evolutionary tree search. So:
//
//   1. a GENOME, as FASTA                  -> fasta.mjs    sequence comparison, tree search
//   2. a MESH per stage, as binary STL     -> stl.mjs       rendering, simulation input, 3D printing
//   3. a PHENOTYPE VECTOR per stage        -> compare.mjs   phenotypic comparison
//   4. PROVENANCE for every number         -> this file     so none of the above is mistaken for a measurement
//
// The fourth is the one that makes the other three safe. An STL is a triangle soup with no idea whether it
// came from a confocal stack or from somebody's guess, and a FASTA is letters with no idea whether the
// edit was ever made. Once geometry leaves this file as a mesh, its provenance is gone - so the mesh is
// stamped and the file refuses to export an unstamped one.
//
// ============================== THE CELL-STATE CHANNELS ==============================
// A stage carries cells, and a cell may carry several KINDS of measurement at once. That shape is taken
// directly from the Unified Transcriptome and Mechanics Map (UTMM; Habibi, Sinha, Yang et al. 2026,
// bioRxiv 10.64898/2026.02.23.706394, from the Broad with MIT), which measures, within an INTACT 3D
// embryo and for the same cell:
//
//   transcriptome     targeted in situ RNA sequencing in 3D (their 3DISS)
//   mechanics         high-frequency elastic modulus, inferred from intracellular organelle fluctuations
//   geometry          surface area, exposed surface area, curvature, position in the aggregate
//
// That is a real and recent dataset shape, and a format that cannot hold it cannot hold the measurement
// that matters most for multicellularity: what state a cell is in AND what its neighbours are doing to it.
// UTMM's own finding is of exactly that form - cytoplasmic softening from the 2-cell through morula stages,
// with lineage bias aligning to mechanical difference, and progression impeded when the softening is
// delayed mechanically. None of that is expressible as a per-organism phenotype value.
//
// THREE CORRECTIONS TO THE PARAGRAPH ABOVE, found by reading the paper rather than its abstract. They are
// kept here rather than silently applied, because each one is a way a format can be wrong that is hard to
// see afterwards.
//
// 1. "high-frequency elastic modulus" comes from the PubMed/PMC abstract, and THAT DEPOSIT IS STALE.
//    bioRxiv v2 (2026-10-23) says "high-frequency intracellular mechanical compliance" and "a RELATIVE,
//    non-invasive readout". The per-cell channel is reported only as RMSD0 and dRMSD - displacements -
//    with no values in nm and no published conversion to Pa. The pascal figures that do exist (~35 Pa at
//    2/4-cell, ~10 Pa at 8-cell) are from a SEPARATE optical-tweezers validation on endocytosed beads,
//    which is not the channel registered per cell. See CHANNELS.mechanics.
// 2. UTMM's measured series starts at LATE 2-CELL (transcriptome) or 4-CELL (mechanics), not the zygote,
//    although both abstracts say "from the zygote". No zygote transcriptome, mechanics value or cell
//    count appears in the accessible text. A zygote row in a .life may carry standard embryology and
//    must not carry a UTMM-derived field.
// 3. "positional geometry rather than cell shape predicts Hippo/YAP" IS NOT UTMM'S RESULT. It is a
//    citation to prior work - Royer et al. 2020, Development, doi:10.1242/dev.189449, which identified
//    exposed surface area as the best correlate of nuclear YAP. UTMM NEVER MEASURES YAP. Its own claim is
//    the different and weaker one: that geometry separates TRANSCRIPTIONALLY defined states.
//
// And the answer to the open question: "UTGM" returns zero hits in PubMed, bioRxiv and web search.
// Geometry is module 2 INSIDE UTMM - the Discussion calls the product "a unified map of transcriptomic,
// morphological and molecular cell states". So `geometry` being a first-class channel beside `mechanics`
// is right, and it is one map rather than two. (The paper is also inconsistent about its own name:
// "Mechanics Map" in the title, "Mechanical Map" in the Introduction.)

export const FORMAT = 'life/0.1.0';
export const EXTENSION = '.life';
export const MEDIA_TYPE = 'application/vnd.delphi.life+json';

/** A .life describes the trajectory of an organism described by a .organism. */
export const DESCRIBES = Object.freeze({
  organism_format: 'organism/0.1.0',
  relationship: 'a .life carries, or references, the .organism for the animal whose trajectory it is. The ' +
    'organism says what it is; the life says what it does over time.',
  why_not_merged: 'because they fail differently. A .organism can be incomplete; a .life can be ' +
    'inconsistent, which is a different and more interesting kind of wrong.',
});

/** Measurement channels a cell may carry. Open by design - see the UTGM note above. */
export const CHANNELS = Object.freeze({
  transcriptome: {
    what: 'per-cell RNA, as counts over a named gene panel or a reference to an external matrix',
    in_situ_matters: 'a transcriptome measured after dissociation has lost the neighbour relationships that ' +
      'a multicellularity claim is about, so the channel records whether it was measured in situ',
    carries: ['panel', 'counts_or_reference', 'in_situ'],
  },
  mechanics: {
    what: 'per-cell mechanical state. USUALLY NOT A MODULUS - see below - so the channel carries either a ' +
      'relative compliance readout or an absolute modulus, and must say which.',
    method_matters: 'an inferred readout and an AFM modulus are not the same number, so the method is required',
    carries: ['readout_kind', 'readout_value', 'unit', 'method', 'frequency_Hz', 'is_relative'],
    readout_kinds: {
      'relative-compliance': 'a displacement-based readout with no conversion to stress. Comparable WITHIN ' +
        'a study and not across studies. UTMM\'s per-cell channel is this.',
      'shear-modulus': 'an absolute |G*| in Pa, from active microrheology. UTMM has these only from a ' +
        'SEPARATE optical-tweezers validation on endocytosed beads, which is not the channel registered ' +
        'per cell to the transcriptome.',
      'youngs-modulus': 'an absolute modulus from indentation, e.g. AFM.',
    },
    the_correction_that_produced_this:
      'v0.1.0 of this spec specified `elastic_modulus_Pa` outright, following the PubMed/PMC abstract, ' +
      'which says "cytoplasmic stiffness (high-frequency elastic modulus)". THAT DEPOSIT IS A STALE ' +
      'VERSION. bioRxiv v2 (2026-10-23) rewrites it to "high-frequency intracellular mechanical ' +
      'compliance" and "a relative, non-invasive readout of cell-level viscoelastic compliance in situ". ' +
      'The authors deliberately retreated from calling the passive readout a modulus, and the accessible ' +
      'text reports it only as RMSD0 and dRMSD - displacements, with no values in nm and no published ' +
      'conversion to Pa. A format that had required pascals would have forced everyone filling it in to ' +
      'invent them.',
    why_this_matters_beyond_this_paper:
      'the general lesson is that a field name can impose a unit the measurement does not have. Requiring ' +
      '`elastic_modulus_Pa` does not make the data a modulus; it makes the file lie in a way no reader ' +
      'can detect. Hence readout_kind and is_relative, which let a displacement stay a displacement.',
  },
  geometry: {
    what: 'per-cell shape and position: surface area, exposed surface area, curvature, centre, radius',
    why_exposed_area: 'exposed surface - the part of a cell facing outward rather than a neighbour - is what ' +
      'distinguishes an inner cell from an outer one, and it is the geometric quantity lineage bias tracks',
    carries: ['centre', 'radius', 'surface_area', 'exposed_surface_area', 'mean_curvature'],
  },
  lineage: {
    what: 'what this cell came from and what it is becoming: a parent id and a fate label with a confidence',
    carries: ['parent', 'fate', 'fate_confidence'],
  },
  signalling: {
    what: 'pathway activity where it was measured, e.g. nuclear/cytoplasmic ratio for a transcription factor',
    carries: ['pathway', 'readout', 'readout_value'],
    why_not_just_value: 'a bare `value` key inside a channel that also carries a provenance stamp is ' +
      'indistinguishable, to a generic walker, from a stamped value node - the reader found exactly that ' +
      'collision on the mechanics channel. Channel payloads use a qualified name.',
  },
});

/**
 * TWO AXES OF GEOMETRY PROVENANCE, which the first version of this spec collapsed into one and got wrong.
 *
 * The original `no_unstamped_mesh` rule gated on the provenance of the NUMBERS - the centre and radius of
 * each cell. Building the exporter showed that is not sufficient, because a sphere is a depiction of SHAPE
 * however good those numbers are: real blastomeres are flattened against their neighbours, and in a
 * compacted morula the flat contact faces are most of the surface. So a stage with perfectly measured
 * centres and radii still exports a drawing, and under the one-axis rule it would export unmarked.
 *
 *   numbers   where the centres, radii and areas came from    (the KINDS vocabulary)
 *   shape     what shape model turned them into triangles     (almost always a depiction)
 *
 * The second axis is what makes the first honest. It also has a consequence worth stating plainly: a
 * sphere-packed mesh has no contact faces, so every cell's exposed surface area comes out too large, and
 * biased in the direction that makes inner cells look like outer ones - the one geometric quantity
 * `CHANNELS.geometry.why_exposed_area` says lineage bias tracks. Any mesh export therefore CONTRADICTS a
 * measured `exposed_surface_area` and must name the cells it contradicts rather than quietly overriding
 * them.
 */
export const GEOMETRY_PROVENANCE_AXES = Object.freeze({
  numbers: 'where the centre, radius and any measured areas came from. Uses the KINDS vocabulary.',
  shape: 'the shape model that turned those numbers into a surface. A sphere per cell is a DEPICTION even ' +
    'when every number is measured, because blastomeres are not spheres and compaction changes shape ' +
    'without changing volume.',
  why_both: 'gating on the numbers alone lets a mesh built from measured coordinates leave the file ' +
    'unmarked, and it is still a drawing. The first version of this spec made exactly that mistake.',
  consequence_for_exposed_area:
    'a sphere packing has no contact faces, so exposed surface area is overestimated and biased towards ' +
    'making inner cells resemble outer ones. An export that overrides a measured exposed_surface_area ' +
    'must name the cells it contradicts.',
  units_do_not_survive:
    'binary STL has no unit field and most slicers assume millimetres, so a micrometre embryo is wrong by ' +
    'a factor of 1000 without any complaint. The export states the units it dropped.',
  header_must_not_begin_with_solid:
    'an 80-byte binary header beginning "solid" makes several readers sniff the file as ASCII STL and ' +
    'fail, so the format tag goes first.',
});

/**
 * Every stage must pin itself in time AND in condition, for the same reason .organism does: "morula" means
 * different things across species and across temperatures, and "E3.5 at 37 C" means one thing.
 */
export const STAGE_REQUIRED = Object.freeze(['id', 'name', 'time', 'time_unit', 'temperature_C']);

export const TIME_UNITS = Object.freeze(['hpf', 'dpf', 'days', 'weeks', 'hours_post_hCG', 'E', 'carnegie_stage', 'cell_cycles']);

export const TIME_UNIT_NOTES = Object.freeze({
  hpf: 'hours post fertilisation. Standard for zebrafish and only meaningful with a temperature.',
  E: 'embryonic day, mouse convention (E0.5 = plug morning). An offset convention, not a clock.',
  carnegie_stage: 'an ORDINAL human staging, not a duration. Carnegie 12 to 23 spans roughly four to eight ' +
    'weeks, and the mapping to days is a range per stage, so a carnegie_stage time must not be arithmetic on.',
  cell_cycles: 'for preimplantation work where cleavage number is the reliable clock and wall-clock time is not.',
});

/** Stage times are comparable only within a unit, except where a stated conversion exists. */
export const ORDINAL_UNITS = Object.freeze(['carnegie_stage']);

/**
 * What the file refuses to do. Each refusal exists because the alternative produces something that LOOKS
 * like a measurement.
 */
export const REFUSALS = Object.freeze({
  no_interpolated_stage:
    'a state computed between two stages is never written as a stage. Interpolation is a `derived` value if ' +
    'the rule is stated and a `depicted` one otherwise, and a reader that cannot tell the two apart will ' +
    'eventually report an interpolation as an observation.',
  no_unstamped_mesh:
    'an exported mesh carries the provenance of the geometry it came from. A triangle soup has no idea ' +
    'whether it came from a confocal stack or a guess, so if the geometry is `assumed` or `depicted` the ' +
    'export says so in the file and in its name, or there is no export.',
  no_cross_unit_distance:
    'stages in different time units are not compared without a stated conversion, and ordinal units are ' +
    'never converted at all. Carnegie 12 minus Carnegie 10 is not 2 of anything.',
  no_single_number_distance:
    'genetic and phenotypic distance are returned separately and never summed. Weighting them against each ' +
    'other is a modelling decision with consequences for every tree built from it, and a file format has no ' +
    'business making it silently.',
  no_identity_drift:
    'the genome and the phenotype must agree about which organism this is. A file whose edit list targets ' +
    'one reference and whose phenotype was measured on another is not a record, it is two records.',
});

/**
 * GENOME COORDINATES must declare their convention, which v0.1.0 failed to require and which bites
 * silently. An edit written `start: 1000` is a different base depending on whether the file means 1-based
 * inclusive (VCF, GFF, and what organism-format/examples/winged-zebrafish.organism actually writes) or
 * 0-based half-open (BED, and what most code assumes). A fetcher reading the wrong one returns flanks off
 * by one base, and nothing downstream can detect it: the FASTA is well-formed, the aligner is happy, and
 * the sequence is wrong at the join.
 *
 * So: declare it, and until a file does, an exporter must pass coordinates through verbatim and SAY that
 * it did, rather than translating on a guess.
 */
export const COORDINATE_CONVENTIONS = Object.freeze({
  '1-based-inclusive': 'VCF and GFF. The first base of a chromosome is 1 and `end` is included.',
  '0-based-half-open': 'BED and most code. The first base is 0 and `end` is excluded.',
  required: true,
  why: 'an off-by-one in a flank is invisible in the output. The FASTA is well-formed, the aligner is ' +
    'happy, and the sequence is wrong at the join.',
  until_declared: 'pass coordinates to the fetcher verbatim and record coordinate_convention=as-given-in-the-file',
});

/**
 * A nucleotide alphabet check cannot tell you that a sequence is DNA, and it is worth knowing why before
 * relying on one. The IUPAC nucleotide and amino-acid alphabets share ELEVEN letters: A C G T N and the
 * ambiguity codes R Y S W K M B D H V. Every one of those is also an amino acid, so `M` is a legal
 * nucleotide (A or C) and the string MSWKRYVHDBN is at once a clean nucleotide sequence and a peptide.
 *
 * An alphabet check therefore catches a protein only if it happens to contain E, F, I, L, P, Q, X or Z.
 * It is a typo check, not a type check.
 */
export const ALPHABET_CHECK_LIMIT =
  'the IUPAC nucleotide and amino-acid alphabets share A C G T N R Y S W K M B D H V, so an alphabet ' +
  'check is a typo check and not a type check: it catches a protein only if the protein contains one of ' +
  'E F I L P Q X Z.';

/** The minimum a .life must say about what it does not know. Carried from .organism. */
export const NOT_ESTABLISHED_MINIMUM = Object.freeze([
  'which stages were observed and which were filled in',
  'for each channel, on how many cells it was actually measured',
  'whether the geometry is a measurement, a reconstruction, or a drawing',
  'what the file cannot be used to simulate',
]);

export const REQUIRED_TOP_LEVEL = Object.freeze([
  'format', 'identity', 'genome', 'timeline', 'provenance', 'not_established',
]);

/**
 * A usability verdict, so a reader is told what it may do with the file rather than left to assume.
 * The pattern is taken from organism-format/read.mjs, where it caught that a simulator may use 2 of 15
 * values in the worked example.
 */
export function usableFor(life) {
  const stages = life?.timeline?.stages ?? [];
  const measuredGeom = stages.filter(s => s.geometry?.provenance?.kind === 'measured' || s.geometry?.provenance?.kind === 'measured-secondhand');
  const anyCells = stages.filter(s => Array.isArray(s.geometry?.cells) && s.geometry.cells.length > 0);
  const channelsPresent = new Set();
  for (const s of stages) for (const c of s.geometry?.cells ?? []) for (const k of Object.keys(c.channels ?? {})) channelsPresent.add(k);
  return {
    rendering: anyCells.length > 0
      ? `yes, for ${anyCells.length} of ${stages.length} stages that carry cells`
      : 'no: no stage carries cell geometry',
    rendering_as_evidence: measuredGeom.length > 0
      ? `only for the ${measuredGeom.length} stage(s) whose geometry is measured`
      : 'no: no stage has measured geometry, so every mesh is a depiction',
    sequence_comparison: life?.genome ? 'yes, via fasta.mjs' : 'no: no genome',
    phenotypic_comparison: stages.length > 1
      ? `across ${stages.length} stages, within one time unit`
      : 'a single stage is a snapshot; use .organism',
    channels_measured: [...channelsPresent].sort(),
    simulation: 'see not_established; a .life does not assert that it is sufficient to simulate anything',
  };
}

export const WHY_EACH_RULE = Object.freeze({
  time_unit_required: 'because a number of hours is not a developmental stage without a clock convention',
  temperature_required: 'because development rate is temperature-dependent, so a stage time without a temperature is not a stage',
  in_situ_flag: 'because a dissociated transcriptome has thrown away the neighbour relations that any claim about multicellularity is about',
  method_on_mechanics: 'because an inferred modulus and an AFM modulus differ by more than their error bars',
  exposed_surface_area: 'because inner versus outer is a geometric fact and it is the one lineage bias tracks',
  provenance_on_geometry: 'because a mesh loses its provenance the moment it leaves the file',
  separate_distances: 'because collapsing genetic and phenotypic distance into one number is a modelling choice, not a serialisation detail',
});
