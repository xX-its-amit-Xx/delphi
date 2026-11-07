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
    covers_hpf_is_the_studys_claim_not_this_files_span: {
      what: 'the study describes imaging "from 4-18 hpf" and an acquisition "every 150 s", both verified in its full text. But this tracking file has 420 frames, and 420 x 150 s is 17.5 h against the window’s 14 h.',
      consequence: 'the absolute stage of frame 0 cannot be derived from these two numbers, and an animation that labels frame 419 as "21.5 hpf" - which is what assuming a 4 hpf start produces - is mislabelled.',
      what_phase_1_does: 'shows ELAPSED time only and records the inconsistency. See sim-engine/scales/micro/embryo.mjs CLOCK.',
      how_it_surfaced: 'the viewer printed the derived figure on screen, where 21.46 hpf for a gastrulation dataset is wrong at a glance.',
    },
    frame_interval_s: 150,
    lineage: true,
    lineage_how: 'chain the parent attribute, which indexes into the PREVIOUS frame\'s node list. Divisions are two nodes sharing a parent.',
    lineage_gotcha: 'the "lineage" attribute is NOT a stable cross-frame identifier in these files. Using it as a track id would silently produce nonsense.',
    lineage_gotcha_the_reason_corrected: {
      what_this_record_said_first: 'that lineage "equals the node id in every frame".',
      why_that_reason_is_false: 'measured over all 420 frames in Phase 1: lineage equals id for 5,940 of 222,071 detections, which is 2.7 %, not every frame.',
      why_the_CONCLUSION_still_holds:
        'because the cheap tests all make lineage look like an excellent track id and the expensive one ' +
        'settles it. Cheap: 1,041 distinct values, 1,039 of them spanning more than one frame, median ' +
        'span 232 frames of 420, and ZERO cases of one value appearing twice in a single frame - which is ' +
        'exactly the signature of a valid per-frame-unique persistent id. Expensive: for the same lineage ' +
        'value between consecutive frames the position moves a MEDIAN OF 307 VOXELS on an embryo about ' +
        '650 voxels across, 94.9 % of steps exceed 50 voxels, the maximum step is 812, and only 2 of ' +
        '1,041 values are contiguous in time. A nucleus is about 7 voxels. The value teleports.',
      the_lesson:
        'the conclusion was right and the justification was wrong, and checking only the justification ' +
        'would have reversed a correct decision. A conclusion defended by a false reason is one good ' +
        'counter-example away from being discarded along with the reason.',
      how_to_re_derive: 'parse all frames, group positions by the lineage attribute, and take the median Euclidean step between consecutive frames for each value.',
    },
    measured_by_us: {
      layer_analysed: 'endoderm',
      detections: 222_071, mean_nuclei_per_frame: 529, max_nuclei_per_frame: 939,
      divisions: 1_634, illegal_parents_with_3_or_more_children: 0,
      frames_containing_a_division: '346 of 419, at 0 to 14 per frame in the clean series',
      per_frame_range_corrected: 'this record first said "0 to 9 per frame". Re-measured in Phase 1: the histogram runs contiguously 0 to 14 and then jumps to four outliers, and 27 of 419 frames exceed 9.',
      the_artefact_tail: 'frames 416-419 report 61, 64, 65 and 84 divisions - 21 to 30 % of the cells in those frames newly born in one 150 s interval, which cannot be mitosis at any stage. They carry 274 of the 1,634 divisions. Excluding them leaves 1,360 divisions over 415 intervals, 342 of which contain one, with a maximum of 14.',
      detections_with_unusable_parent_refs: '27 % - track fragmentation, which is normal for automated tracking and must not be hidden',
    },
    qc_verdict: 'PASSES. Divisions land on 342 of 415 clean frames with a modal count of one per frame - that IS the asynchrony, measured rather than asserted.',
    qc_verdict_number_corrected: 'this record first implied a cell cycle near 5.6 h from all 1,634 divisions. The artefact-free count of 1,360 over 17.3 h with a mean population of 529 implies 6.7 h, and 6.7 h is the number to quote. Both are plausible for gastrula and segmentation stages, so the verdict is unchanged - but 5.6 h was computed over four frames that cannot be mitosis.',
    trackability_measured_in_phase_1: 'the number that decides what can be animated, and it is not in the paper. Chaining the parent attribute over all 420 frames yields 62,300 tracks from 222,071 detections: mean length 3.56 frames, 31,814 of them a SINGLE frame (51 %), 150 lasting 50 frames or more, 142 after rejecting those with a step over 50 voxels, and 11 lasting 100 frames or more. Those 142 cover a mean of 4.9 % of the cells visible in a frame. So this dataset supports a measured per-frame point cloud and 142 measured paths - not a continuous whole-embryo tracking animation.',
    modality: 'four-lens SPIM light-sheet, a 300 um spherical shell every 150 s',
    citation: 'Shah et al. 2019, Nat Commun, doi 10.1038/s41467-019-13625-0, PMID 31848345',
    access: 'EBI FTP, IDR study idr0068; endoderm.zip is 96,312,189 bytes, with epiblast and mesendoderm larger. Tracking XML only.',
    url: {
      study_tree: 'https://ftp.ebi.ac.uk/pub/databases/IDR/idr0068-shah-zebrafishlightsheet/',
      tracking_release: 'https://ftp.ebi.ac.uk/pub/databases/IDR/idr0068-shah-zebrafishlightsheet/20211129-ftp/',
      zip: 'https://ftp.ebi.ac.uk/pub/databases/IDR/idr0068-shah-zebrafishlightsheet/20211129-ftp/endoderm.zip',
      unzipped_frames: 'https://ftp.ebi.ac.uk/pub/databases/IDR/idr0068-shah-zebrafishlightsheet/20211129-ftp/endoderm/GMEMfinalResult_frame%04d.xml  (0000..0419, 420 files, listed and counted on 2026-11-07)',
      note:
        'the FTP tree holds six releases and only ONE of them has the tracking XML: 20211129-ftp. The ' +
        '20190913-ftp and 20191030-converted releases are TIFF image trees, 20211117-ometiff is a single ' +
        'OME-TIFF, and 20191001-ftp is a sample subtree. A reader who goes to the study root and takes the ' +
        'newest-looking directory gets images, not tracks.',
      why_this_was_added:
        'the first version of this record named the study and the byte count but no URL, so re-fetching ' +
        'the data meant re-deriving the path by listing the tree. Recording the bytes without the address ' +
        'is a provenance note that cannot be acted on.',
    },
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
