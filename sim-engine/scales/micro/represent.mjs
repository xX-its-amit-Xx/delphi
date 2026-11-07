// The scale ladder, upward - and the question the existing ladder does not ask.
//
// ============================== WHAT THIS ADDS ==============================
// micro/ladder.mjs runs DOWNWARD from the embryo to electrons, and asks of each level: can we SIMULATE
// it? That is a question about compute, and it answers it well - it knows where classical molecular
// dynamics stops being a thing you are allowed to do.
//
// This module runs the other way, from organelle up through cell, tissue and organ to organism, and asks
// a different question: HOW IS THIS LEVEL REPRESENTED IN OUR FILES? Not "could we compute it" but "when
// the pipeline says something about a tissue, what object is it actually talking about".
//
// The two questions come apart badly, and the gap is the finding. We can simulate levels we cannot
// represent, and we represent levels we cannot simulate. TISSUE AND ORGAN ARE THE WORST CASE: they are
// where almost every phenotype we design for actually lives - a fin, a jaw, a heart - and they are the
// two levels with no first-class representation in any format this project has. A fin ratio is a number
// attached to a whole organism. There is no fin.
//
// ============================== THE SCALE SPAN ==============================
// Organelle to organism is six orders of magnitude, 1e-6 m to 1e-2 m. Every level in between is
// represented by a DIFFERENT kind of object - a channel on a cell, a packed sphere, a scalar on the
// whole animal - and nothing in the pipeline converts between them. That is not an oversight to be
// tidied; it is the actual structure of what we can and cannot say.

export const UNITS = Object.freeze({ length: 'm', note: 'characteristic length, not a bound' });

/**
 * Upward from the organelle. `represented_as` is the load-bearing field: what OBJECT in our files
 * carries this level, or null where nothing does.
 */
export const RUNGS = Object.freeze([
  {
    id: 'organelle',
    label: 'organelle',
    size_m: 1e-6,
    what: 'a mitochondrion, the nuclear envelope, a ribosome cluster',
    represented_as: null,
    representation_detail:
      'NOTHING. No format here has an organelle. The closest thing is UTMM\'s mechanics channel, which ' +
      'infers a cell\'s compliance FROM organelle motion - so organelles enter our data only as the ' +
      'noise source for a measurement of the level above them.',
    measured_by: 'high-frequency intracellular organelle fluctuation (UTMM), as a relative compliance',
    what_breaks_without_it:
      'any claim about metabolic capacity, since mitochondrial density is where aerobic power actually ' +
      'comes from, and the registry has aerobic-power laws with no organelle to attach to.',
    mesh: 'depicted',
  },
  {
    id: 'cell',
    label: 'cell',
    size_m: 8.75e-5,
    what: 'one blastomere: nucleus, cytoplasm, a membrane in contact with neighbours',
    represented_as: '.life stage.geometry.cells[]',
    representation_detail:
      'THE BEST-REPRESENTED LEVEL, and the only one with a first-class object. A cell carries a centre, ' +
      'a radius, surface area, EXPOSED surface area, curvature, and up to five measurement channels - ' +
      'transcriptome (with an in-situ flag), mechanics, geometry, lineage, signalling. In the worked ' +
      'example: present on 31 of 31 cells, measured on 0 of them.',
    measured_by: '3DISS in-situ sequencing and segmentation of a confocal stack',
    what_breaks_without_it: 'nothing downstream - this is the level everything else is built from or reduced to',
    mesh: 'sphere per cell, which is a DEPICTION of shape however good the coordinates are: real blastomeres are flattened against their neighbours',
  },
  {
    id: 'tissue',
    label: 'tissue',
    size_m: 5e-4,
    what: 'an epithelium, a mesenchymal condensation, the fin fold - many cells of a kind, acting as one',
    represented_as: null,
    representation_detail:
      'NOTHING, and this is the expensive gap. A tissue is not a big cell and not a small organ: it has ' +
      'properties - stiffness, polarity, a boundary - that no individual cell has and that no sum over ' +
      'cells recovers. We can store 400 cells; we cannot store "these 400 are an epithelium".',
    measured_by: 'nothing in this pipeline',
    what_breaks_without_it:
      'the entire developmental middle. Morphogenesis IS tissue mechanics - folding, convergent ' +
      'extension, condensation - and we have no object for the thing that folds.',
    mesh: null,
  },
  {
    id: 'organ',
    label: 'organ',
    size_m: 2e-3,
    what: 'a pectoral fin, a jaw, a heart - the thing a design request usually names',
    represented_as: 'a CURIE in an anatomy ontology (UBERON / ZFA), and nothing else',
    representation_detail:
      'An organ exists here only as an IDENTIFIER in a graph. UBERON:4000172 is a lepidotrichium; the ' +
      'blueprint graph knows it is part_of a fin, which is part_of the organism. What the graph does NOT ' +
      'carry is any geometry, any material, any size. The one registry law expressible on our traits is ' +
      'about this graph, and reading its `level` field as spatial extent is a substitution the Lean ' +
      'module does not license.',
    measured_by: 'morphometric ratios on the WHOLE ORGANISM, normalised by standard length',
    what_breaks_without_it:
      'nothing breaks - which is the problem. The pipeline runs happily while the object the request ' +
      'named has no representation, because the phenotype is carried as a scalar on the animal instead.',
    mesh: 'only inside a whole-organism illustration mesh, never on its own',
  },
  {
    id: 'organism',
    label: 'organism',
    size_m: 1e-2,
    what: 'the whole animal, which is what every phenotype value is actually attached to',
    represented_as: '.organism phenotype values, and .life timeline.stages[].phenotype',
    representation_detail:
      'Every morphometric trait we score is a ratio to standard length on the whole animal: ' +
      'body_depth_over_SL, preanal_over_SL, caudal_fin_aspect_ratio. The design scorer works entirely at ' +
      'this level, on ten such ratios. SO A "FIN" PHENOTYPE IS A NUMBER ABOUT A FISH, NOT A NUMBER ABOUT ' +
      'A FIN - and that is precisely why only 1 of 48 theorem-carrying laws is expressible here: a ratio ' +
      'of one specimen to its own length has already divided out the size that most laws are written in.',
    measured_by: 'museum morphometrics; 4,673 held-out specimens complete on the ten traits',
    what_breaks_without_it: 'the scorer, the benchmark, and every verdict the pipeline issues',
    mesh: 'the illustration mesh built by sim-engine/scales/mesh/, marked depicted',
  },
]);

/** Where a level is carried, as a one-word answer, for a legend. */
export const CARRIER = Object.freeze({
  organelle: 'absent',
  cell: 'first-class object',
  tissue: 'absent',
  organ: 'identifier only',
  organism: 'scalar values',
});

export const THE_GAP = Object.freeze({
  the_claim:
    'two of the five rungs have NO representation at all, and one has only an identifier. The two missing ' +
    'ones - tissue and organ geometry - are where almost every phenotype a design request names actually ' +
    'lives.',
  why_it_is_not_merely_a_todo:
    'the pipeline does not fail when it reaches a level it cannot represent. It carries the phenotype as ' +
    'a scalar on the whole organism instead, and proceeds. So the absence is invisible in every output - ' +
    'a fin ratio looks like a statement about a fin.',
  the_measurable_consequence:
    'only 1 of 48 theorem-carrying registry laws is expressible on the ten organism-level trait ratios, a ' +
    'rate of 2.1%. Most of the registry needs quantities that live at levels we do not carry: two sizes, ' +
    'a mass, a power budget, an area, a stress.',
  what_would_close_it:
    'a tissue object with a boundary and a material, and an organ object with geometry rather than only a ' +
    'CURIE. .life already carries per-cell geometry, which is the raw material for both - a tissue is a ' +
    'labelled set of cells plus a boundary, and nothing stops that being written down.',
});

/** Orders of magnitude between two rungs, for the zoom control. */
export function decadesBetween(a, b) {
  const ra = RUNGS.find(r => r.id === a), rb = RUNGS.find(r => r.id === b);
  if (!ra || !rb) throw new Error(`unknown rung: ${!ra ? a : b}`);
  return Math.abs(Math.log10(rb.size_m) - Math.log10(ra.size_m));
}

/** The full span, which is the headline number for a zoom widget. */
export function span() {
  const sizes = RUNGS.map(r => r.size_m);
  return {
    smallest_m: Math.min(...sizes),
    largest_m: Math.max(...sizes),
    decades: Math.log10(Math.max(...sizes) / Math.min(...sizes)),
    note: 'organelle to organism. A viewer that shows them at once is lying about one of them.',
  };
}

/** How many rungs actually have a representation, which is the honest summary. */
export function coverage() {
  const represented = RUNGS.filter(r => r.represented_as !== null);
  return {
    rungs: RUNGS.length,
    represented: represented.length,
    absent: RUNGS.filter(r => r.represented_as === null).map(r => r.id),
    identifier_only: RUNGS.filter(r => /identifier|CURIE/.test(r.represented_as ?? '')).map(r => r.id),
    headline: `${represented.length} of ${RUNGS.length} rungs have any representation; ${RUNGS.filter(r => r.represented_as === null).length} have none.`,
  };
}
