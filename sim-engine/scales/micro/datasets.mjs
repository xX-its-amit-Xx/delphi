// THE DATA THAT DRIVES THE EMBRYO LAYER: which 4D tracking sets exist, what each one may be used for,
// and which one is quietly wrong.
//
// ============================== WHY THIS LAYER IS MEASURED AND NOT SIMULATED ==============================
// Cells dividing and moving is the one thing in this whole zoom that does NOT need a model. Published
// light-sheet microscopy has already recorded it, nucleus by nucleus, with mother-daughter links. Driving
// the animation from those tracks makes the embryo layer EVIDENCE. A cell-mechanics model of the same
// thing would be a hypothesis wearing the same picture, and would be weaker, not stronger.
//
// ============================== THE FINDING THAT DECIDES WHICH SET WE USE ==============================
// The richest and most beautiful track set available is also the one whose division counts are
// biologically impossible, and its structure gives no hint of it. Its lineage graph is flawless - every
// parent has exactly two children, every daughter is born exactly one frame after its parent ends, no
// gaps. But it reports 635,041 divisions in a population going from about 19,000 to about 35,000 cells.
// That is roughly 2.7 % of all cells dividing every thirty seconds, implying a cell cycle near eighteen
// minutes at 12-18 hpf - about an order of magnitude too fast for that stage.
//
// The tracker's solver enforces a binary forest, so the graph is perfect by construction. The biology is
// over-called. A viewer driven by it would show cells fizzing with divisions, and the caption "division is
// asynchronous because the real data says so" would be FALSE while looking more convincing than the truth.
//
// That dataset is kept here, usable for MOTION, barred from DIVISION COUNTS, and - separately - cannot be
// committed at all, because no licence is published for it.
//
// ============================== THE SECOND FINDING, WORTH SAYING ON SCREEN ==============================
// The most famous zebrafish embryo dataset in existence - 55 million nuclei, published as a complete
// developmental blueprint of a vertebrate - CANNOT SHOW A CELL SPLITTING INTO TWO. Its per-timepoint
// tables carry centroids, intensities, bounding boxes and intensity spreads, and no track identity, no
// parent link and no division flag. Divisions exist only in its rendered movies. Scale alone does not make
// a dataset answer a question.

export const WHY_MEASURED =
  'Cells dividing and moving is the one level in this zoom that needs no model, because published ' +
  'light-sheet microscopy already recorded it nucleus by nucleus with mother-daughter links. Driving the ' +
  'animation from tracks makes this layer evidence rather than hypothesis.';

export const DATASETS = [
  {
    id: 'shah-idr0068',
    rank: 1,
    role: 'PRIMARY - drives the animation',
    what: 'tracked nuclei as point centroids, split into endoderm, epiblast and mesendoderm layers, 420 frames each',
    covers_hpf: [4, 18],
    frame_interval_s: 150,
    lineage: true,
    lineage_how: 'chain the parent attribute, which indexes into the PREVIOUS frame\'s node list. Divisions are two nodes sharing a parent.',
    lineage_gotcha: 'the "lineage" attribute is NOT a stable cross-frame identifier in these files - it equals the node id in every frame. Using it as a track id would silently produce nonsense.',
    measured_by_us: {
      layer_analysed: 'endoderm',
      detections: 222_071, mean_nuclei_per_frame: 529, max_nuclei_per_frame: 939,
      divisions: 1_634, illegal_parents_with_3_or_more_children: 0,
      frames_containing_a_division: '346 of 419, at 0 to 9 per frame',
      detections_with_unusable_parent_refs: '27 % - track fragmentation, which is normal for automated tracking and must not be hidden',
    },
    qc_verdict: 'PASSES. 1,634 divisions among about 529 cells at a 150 s interval implies a cell cycle near 5.6 h, which is right for gastrula and segmentation stages. And divisions land on 346 different frames - that IS the asynchrony, measured rather than asserted.',
    modality: 'four-lens SPIM light-sheet, a 300 um spherical shell every 150 s',
    citation: 'Shah et al. 2019, Nat Commun, doi 10.1038/s41467-019-13625-0, PMID 31848345',
    access: 'EBI FTP, IDR study idr0068; endoderm.zip is 96,312,189 bytes, with epiblast and mesendoderm larger. Tracking XML only.',
    bytes: { endoderm: 96_312_189, epiblast: 805_376_869, mesendoderm: 876_562_885 },
    separable_from_images: 'YES, completely - the image set is a separate FTP tree of about 0.17 TB',
    licence: 'CC BY 4.0',
    redistributable: true,
    data_doi: '10.17867/10000172',
    coordinates: { kind: 'VOXEL INDICES, not microns', extent: 'inside a 658 x 658 x 658 isotropic volume',
      physical_scale: null,
      physical_scale_why_null: 'the repository records the physical pixel size as null for this study. A scale near 1.06 um per voxel is derivable from embryo size, but that is an INFERENCE and not a published figure, so nothing here states a micron scale.' },
  },
  {
    id: 'linajea-ground-truth',
    rank: 2,
    role: 'HONESTY ANCHOR - the set a human checked',
    what: 'manually curated sparse lineages; the only dataset here where a person verified every link',
    covers_hpf: [6, 18],
    frame_interval_s: 90,
    lineage: true,
    lineage_how: 'explicit columns: time, z, y, x, cell_id, parent_id, track_id',
    measured_by_us: {
      side_1: { detections: 14_535, lineages: 22, divisions: 35, frames: '0 to 361', cells_per_frame: '~40' },
      side_2: { detections: 13_996, lineages: 20, divisions: 35 },
      hand_annotated_division_points: 111,
      division_frames: 'divisions occur at t = 5, 45, 47, 60, 61, 75, 77, 91, 92, 100, 101, 103, 105, 116, 117, 128 and so on - almost never two in the same frame',
    },
    qc_verdict: 'PASSES, and it is the set that lets every other one be checked. The scattered division frames are the on-screen claim about asynchrony, measured, in a file small enough to commit.',
    modality: 'SiMView multi-view light-sheet, four orthogonal views',
    citation: 'Malin-Mayor et al. 2023, Nat Biotechnol 41:44-49, doi 10.1038/s41587-022-01427-7, PMID 36065022; imaging from Wan et al. 2019, Cell 179:355-372.e23, doi 10.1016/j.cell.2019.08.039',
    access: 'Janelia Figshare, doi 10.25378/janelia.24968724.v1 - the ground truth is 777,257 bytes',
    bytes: { ground_truth: 777_257 },
    separable_from_images: 'YES - the images are not in the deposit at all',
    licence: 'BSD 3-Clause',
    redistributable: true,
    coordinates: { kind: 'world coordinates of a resampled isotropic volume with a non-zero offset', physical_scale: null, physical_scale_why_null: 'the deposit never states microns; the units are unverified.' },
    the_authors_own_caveat: 'further work is required to improve detection of cell division',
  },
  {
    id: 'zebrahub-daxi',
    rank: 3,
    role: 'MOTION ONLY - barred from division counts, and cannot be committed',
    what: 'the richest track set available: 791 timepoints, 1.6 million tracks, 21.7 million detections',
    covers_hpf: [12, 18],
    frame_interval_s: 30,
    lineage: true,
    lineage_how: 'track_id with parent_track_id; structurally flawless',
    measured_by_us: {
      detections: 21_697_591, tracks: 1_605_333, divisions: 635_041, max_cells_per_frame: 35_450,
      parents_with_exactly_two_children: '100 %',
      daughters_born_one_frame_after_the_parent_ends: '100 %, zero gaps',
      median_track_segment_frames: 5,
    },
    qc_verdict: 'FAILS for divisions. 635,041 divisions in a population going from about 19,000 to about 35,000 cells is roughly 804 divisions per 30 s frame - about 2.7 % of all cells dividing every thirty seconds, implying a cell cycle near 18 minutes at 12-18 hpf. That is roughly an order of magnitude too fast for the stage.',
    why_the_structure_does_not_reveal_it: 'the tracker\'s solver enforces a binary forest, so the graph is perfect by construction. Perfect topology is evidence about the SOLVER, not about the biology. A median track segment of 5 frames is the tell.',
    usable_for: 'motion and density - the positions themselves are fine',
    not_usable_for: 'division counts, division timing, or any statement of the form "this is how often cells divide"',
    licence: null,
    licence_why_null: 'NO licence file was found at any level of the hosting bucket, and the portal carries only a citation request. Redistribution is therefore NOT established.',
    redistributable: false,
    consequence: 'cannot be committed. Streaming it at run time, or asking the depositing laboratory for a written licence, are the options.',
    citation: 'Lange et al. 2024, Cell 187(23):6742-6759.e17, doi 10.1016/j.cell.2024.09.047, PMID 39454574',
    coordinates: { kind: 'DIFFERS BETWEEN FILES - a real trap', detail: 'the first dataset is in physical microns; the others are integer voxel indices. A loader that assumes one will silently mis-scale the other.' },
  },
  {
    id: 'fulton-idr0051',
    rank: 4,
    role: 'rejected for playback',
    what: 'tailbud and neuromesodermal progenitor tracking, 384 frames across three samples',
    frame_interval_s: 120,
    lineage: true,
    measured_by_us: { nuclei_per_frame: '490 at t0, 31 by t40, 0 by t80 in one sample', file_sizes: '59,786 bytes at t0 falling to 447 by t146', divisions: 'concentrated at t=1 (22 of them), almost certainly an initialisation artifact' },
    qc_verdict: 'FAILS. The tracking collapses - only the first 40 to 50 frames carry a real population. Small and well licensed, but it cannot sustain an animation.',
    licence: 'CC BY 4.0', redistributable: true, bytes: { tracking_xml: 7_513_892 },
    one_genuine_advantage: 'data was downscaled to 1 cubic micron voxels, so voxel index equals microns - the only set here with convenient units.',
    citation: 'Fulton et al., Wellcome Open Res 3:163, doi 10.12688/wellcomeopenres.14907.3',
  },
  {
    id: 'keller-2008-digital-embryo',
    rank: 5,
    role: 'DISQUALIFIED - and worth saying so on screen',
    what: 'the famous digital embryo: up to 55 million nuclei across seven databases',
    lineage: false,
    lineage_why_false:
      'each per-timepoint table carries seventeen columns - centre-of-mass position, average and ' +
      'centre-of-mass intensity, a bounding box, and intensity spread in each axis. There are NO track ' +
      'identifiers, NO parent-daughter links and NO division flags. Divisions appear only in the rendered ' +
      'movies.',
    qc_verdict: 'DISQUALIFIED for this purpose. The most cited zebrafish embryo dataset in existence cannot show a cell splitting into two. Scale alone does not make a dataset answer a question, and this is the clearest example of it we found.',
    licence: 'none stated at the primary host; a mirror carries CC BY-NC-SA, whose non-commercial and share-alike terms would both bind us',
    redistributable: false,
    citation: 'Keller, Schmidt, Wittbrodt & Stelzer 2008, Science 322:1065-1069, doi 10.1126/science.1162493, PMID 18845710',
  },
];

/** Things that are NOT available, recorded so nobody spends an afternoon looking again. */
export const VERIFIED_NEGATIVES = [
  { what: 'the Cell Tracking Challenge has NO zebrafish dataset', detail: 'its 3D list covers human, nematode, hamster, fly and beetle, plus two simulated sets. A fly dataset whose identifier begins "DRO" is Drosophila, not Danio - an easy and costly misreading.' },
  { what: 'no deposited lineage data for the study that reconstructed the first ten division cycles', detail: 'that work is on paper the single best match for pre-transition asynchrony, but only supplementary movies were found. It would need author contact.' },
  { what: 'no Zenodo deposit of zebrafish nucleus TRACKS', detail: 'the only verifiable zebrafish 4D Zenodo record is Gaussian splats - rendering primitives with no cell identity and no lineage. Good as a photorealistic backdrop labelled "depicted"; useless for division.' },
  { what: 'the repository holds exactly two zebrafish time-lapse studies', detail: 'both are in the table above and both are CC BY 4.0.' },
];

export const A_PROCEDURAL_NOTE =
  'Several web-search summaries during this work asserted dataset facts - a deposit of tracks, a file ' +
  'listing, a licence - that did not survive being checked against the actual APIs and HTTP headers. ' +
  'Every size, URL, schema and licence recorded here was verified by request or by downloading and ' +
  'parsing the file, and where it could not be, the field is null with the reason attached.';

export function dataset(id) { return DATASETS.find(d => d.id === id) ?? null; }

/** May this dataset be used for this purpose? The answer is often "for motion but not for divisions". */
export function permitted(id, purpose) {
  const d = dataset(id);
  if (!d) return { allowed: false, why: `no dataset with id "${id}"` };
  if (purpose === 'commit' || purpose === 'redistribute') {
    return { allowed: d.redistributable === true, why: d.redistributable ? `licensed ${d.licence}` : (d.licence_why_null ?? `licence is ${d.licence}, which does not permit it`) };
  }
  if (purpose === 'divisions') {
    const ok = /PASSES/.test(d.qc_verdict ?? '') && d.lineage === true;
    return { allowed: ok, why: ok ? d.qc_verdict : (d.not_usable_for ? `barred: ${d.not_usable_for}. ${d.qc_verdict}` : d.qc_verdict ?? d.lineage_why_false) };
  }
  if (purpose === 'motion') {
    const ok = d.lineage === true || d.usable_for != null;
    return { allowed: ok, why: ok ? (d.usable_for ?? 'positions are usable') : 'no usable positions over time' };
  }
  return { allowed: false, why: `unknown purpose "${purpose}". Known: commit, redistribute, divisions, motion.` };
}
