// PHASE 1: the embryo layer, from real 4D tracking data - and the measurement that decided its shape.
//
// ============================== WHAT WAS PLANNED, AND WHY IT CHANGED ==============================
// The Phase 0 README said Phase 1 would fetch the Shah tracks, reconstruct lineage from the `parent`
// chain, and bake "per-object TRS keyframes" for the embryo - about 1000 moving bodies, roughly 5 MB for
// 300 frames, which pipeline.route() happily accepts.
//
// Then the data was downloaded and parsed, and that plan turned out to require inventing most of what it
// would have shown. The numbers below are from this run, 420 frames of the endoderm layer:
//
//   detections                                 222,071        every one a measured position
//   tracks from chaining `parent`               62,300
//   of those, a SINGLE frame long               31,814        51 % of tracks are one detection
//   mean track length                            3.56 frames of 420
//   tracks lasting >= 50 frames                    150
//   after rejecting those with a teleport          142
//   share of the cells in a frame they cover       4.9 %
//
// So baking 529 keyframed cells per frame would have asserted identity for about 95 % of them that the
// data does not contain. The detections are real; the CORRESPONDENCE between frames mostly is not.
//
// Hence two artefacts with two different claims, which is what this file exists to keep apart:
//
//   embryo-cloud.f16     per-frame positions, float16, no identity   MEASURED position, DEPICTED motion
//   embryo-tracks.json   the 142 surviving long tracks               MEASURED identity and motion
//
// ============================== A CORRECTION TO OUR OWN DATASET RECORD ==============================
// datasets.mjs warned that the `lineage` attribute is not a cross-frame identifier and that using it as a
// track id "would silently produce nonsense". Its stated REASON was that `lineage` equals the node id in
// every frame. That reason is false - lineage equals id for 5,940 of 222,071 detections, 2.7 % - and
// checking only the reason would have reversed a correct decision, because lineage looks like an
// excellent track id on every cheap test: 1,041 distinct values, 1,039 spanning more than one frame,
// median span 232 frames, and ZERO cases of one value appearing twice in a frame.
//
// The expensive test is the one that settles it. For the same lineage value between consecutive frames
// the position moves a MEDIAN OF 307 VOXELS, on an embryo about 650 voxels across, with 94.9 % of steps
// over 50 voxels and a maximum of 812. A nucleus is about 7 voxels. The value teleports across the whole
// embryo, and only 2 of 1,041 values are even contiguous in time.
//
// The conclusion in the record was right and its justification was wrong. Both are worth keeping: a
// conclusion defended by a false reason is one bad argument away from being discarded.

import * as PIPE from './pipeline.mjs';

export const SOURCE = Object.freeze({
  study: 'idr0068-shah-zebrafishlightsheet',
  layer: 'endoderm',
  url: 'https://ftp.ebi.ac.uk/pub/databases/IDR/idr0068-shah-zebrafishlightsheet/20211129-ftp/endoderm.zip',
  bytes: 96312189,
  bytes_verified: 'the download was byte-exact against the figure recorded in datasets.mjs, which is an independent check on that record',
  licence: 'CC BY 4.0',
  redistributable: true,
  citation: 'Shah et al. 2019, Nat Commun, doi 10.1038/s41467-019-13625-0, PMID 31848345',
  data_doi: '10.17867/10000172',
  retrieved: '2026-11-07',
  frames: 420,
  frame_interval_s: 150,
  frame_interval_verified: 'Shah et al. 2019, Results, read in full text in this run: "we acquired a 300 um thick spherical shell around the embryo surface every 150 s".',
  modality: 'four-lens SPIM light-sheet, a 300 um spherical shell every 150 s',
});

/** The clock, and the number that would have shipped wrong.
 *
 *  The viewer first displayed hours post fertilisation, computed as 4 hpf plus the elapsed time. That is
 *  wrong and the arithmetic says so out loud: the study describes imaging "from 4-18 hpf" - 14 hours -
 *  and BOTH that window and the 150 s interval are verified in the paper's own text. But this file has
 *  420 frames, and 420 x 150 s is 17.5 hours. The two cannot both describe this file.
 *
 *  Nothing read in this run states the absolute stage of frame 0, so the layer reports ELAPSED time and
 *  refuses to report hpf. An embryo animation labelled with the wrong stage is worse than one labelled
 *  with none, because the stage is what a developmental biologist reads first. */
export const CLOCK = Object.freeze({
  frame_interval_s: 150,
  elapsed_h_total: 17.5,
  absolute_stage_of_frame_0: null,
  why_null: 'the study window (4-18 hpf, 14 h) and this file (420 frames x 150 s, 17.5 h) are inconsistent, so either frame 0 is not at 4 hpf or the recording runs past 18 hpf. Neither is stated anywhere read here.',
  a_hint_deliberately_not_used:
    'frame 0 holds 21 endoderm nuclei, and endoderm specification begins around 6.5 hpf by sox17 ' +
    'expression - which would put frame 0 well after 4 hpf. That is an inference from cell counts, not a ' +
    'published figure, so it is recorded and not applied.',
  what_would_settle_it: 'per-frame timestamps, which the tracking XML does not carry, or a statement from the depositors.',
  how_it_was_caught: 'the viewer displayed 21.46 hpf on the last frame. A number that large for a gastrulation dataset is visible at a glance, which is an argument for putting the derived figure on screen early rather than keeping it in a module.',
});

/** Everything here was recomputed from the XML in this run. Where it matches the earlier record, that is
 *  an independent reproduction; where it differs, the difference is stated. */
export const MEASURED = Object.freeze({
  detections: 222071,
  mean_per_frame: 528.7,
  max_per_frame: 939,
  min_per_frame: 21,
  first_frame_count: 21,
  last_frame_count: 568,
  extent_voxels: { x: [-1.0, 652.61], y: [1.0, 637.34], z: [1.0, 607.53] },
  centroid_voxels: [354.6, 285.0, 298.8],
  radius_voxels: 543.8,
  reproduces_the_earlier_record: [
    'detections 222,071 - exact',
    'mean nuclei per frame 529 - exact to the rounding',
    'max nuclei per frame 939 - exact',
    'divisions 1,634 - exact',
    'illegal parents with 3 or more children: 0 - exact',
    'frames containing a division: 346 of 419 - exact',
    'detections with unusable parent refs: 26.6 %, recorded as 27 % - exact to the rounding',
  ],
  one_number_slightly_outside_the_record: 'the extent. The record says the data sits inside a 658^3 volume; x reaches -1.0, marginally negative. Harmless, and stated rather than clamped silently.',
});

/** The division statistics, and the four frames that inflate them. */
export const DIVISIONS = Object.freeze({
  rule: 'a division is a parent index in frame t-1 with exactly two children in frame t. The parent attribute indexes into the PREVIOUS frame\'s node list.',
  raw: 1634,
  per_frame_histogram: { 0: 73, 1: 82, 2: 60, 3: 50, 4: 32, 5: 23, 6: 25, 7: 20, 8: 15, 9: 12, 10: 13, 11: 7, 12: 1, 14: 2, 61: 1, 64: 1, 65: 1, 84: 1 },
  the_artefact: {
    frames: [416, 417, 418, 419],
    what: 'the last four frames report 61, 64, 65 and 84 divisions, which is 21 to 30 % of the cells in those frames newly born within one 150 s interval.',
    why_it_cannot_be_biology: 'a zebrafish cell cycle at these stages is hours. A fifth of a population dividing in two and a half minutes is a re-segmentation or a track re-initialisation, not mitosis.',
    how_it_was_found: 'the per-frame histogram is contiguous from 0 to 14 and then jumps to 61. A total alone hides that completely.',
  },
  artefact_free: 1360,
  artefact_free_frames_with_a_division: '342 of 415',
  artefact_free_max_per_frame: 14,
  implied_cycle_h: {
    raw: 5.6,
    artefact_free: 6.7,
    how: 'mean population (529) x observed hours / divisions. 17.5 h of observation at a 150 s interval.',
    which_to_quote: '6.7 h. Both are plausible for gastrula and segmentation stages, but 5.6 h includes 274 divisions from four frames that cannot be mitosis.',
    a_correction_to_the_earlier_record: 'the QC verdict in datasets.mjs cites 5.6 h and says divisions run "0 to 9 per frame". The clean series runs 0 to 14, and 27 of 419 frames exceed 9. Neither error changes that dataset\'s verdict - it still passes - but the number to quote is 6.7 h.',
  },
});

/** Asynchrony, measured rather than asserted - which is the whole reason this layer uses real data. */
export const ASYNCHRONY = Object.freeze({
  the_claim_this_supports: 'cells in this embryo do not divide in step',
  evidence: [
    'divisions land on 342 of 415 artefact-free frames. If division were synchronous they would cluster into a few frames separated by empty ones.',
    'the modal number of divisions in a frame is ONE (82 frames), and the distribution falls away smoothly to 14. A synchronous population would be bimodal: many frames at zero and a few very high.',
    '73 frames contain no division at all, so the process is not uniform either - it is spread, not flat.',
  ],
  what_it_does_not_show:
    'a cell-cycle PHASE per cell. That needs continuous tracks, and only 142 cells have them. The ' +
    'asynchrony here is a population statement, and an animation that staggers individual divisions is ' +
    'using a measured population rate to place events whose individual timing was not observed.',
  relation_to_staging:
    'staging.mjs carries the mitotic wave velocities and the division-timing variance for the EARLY ' +
    'cleavages (rounds 2-9, 259 to 41 um/min, variance 0.10 to 3.43 min^2). This dataset starts at 4 hpf, ' +
    'well after those rounds, so the two do not overlap and neither validates the other. They cover ' +
    'different parts of the clock.',
});

/** What a viewer may claim about each artefact, in the micro vocabulary: computed / measured / depicted. */
export const ARTEFACTS = Object.freeze({
  cloud: {
    file: 'embryo-cloud.f16',
    bytes: 1332426,
    points: 222071,
    layout: 'float16 little-endian, 3 per point, frames concatenated; the frame index is in embryo-manifest.json',
    position: 'measured',
    identity_across_frames: 'NOT AVAILABLE',
    motion: 'depicted',
    the_caption_it_must_carry:
      'Every point is a measured nucleus position. Consecutive frames are two independent measurements ' +
      'of the same embryo, NOT a correspondence - so the cloud may be shown changing, and no individual ' +
      'point may be described as moving.',
    why_float16:
      'positions are normalised into a unit sphere, where float16 resolves about 1/2048 of the radius - ' +
      'finer than a nucleus at this voxel size. float32 would double the file for nothing visible.',
  },
  tracks: {
    file: 'embryo-tracks.json',
    bytes: 324025,
    count: 142,
    min_frames: 50,
    rejected_for_a_teleport: 8,
    rejection_rule: 'a track is rejected if any step between consecutive frames exceeds 50 voxels, about seven nuclear diameters',
    rejection_rule_max: () => 50,
    position: 'measured',
    identity_across_frames: 'measured',
    motion: 'measured',
    the_caption_it_must_carry:
      'These 142 cells have paths that are measurements. They are 4.9 % of the cells visible in a frame, ' +
      'and they are not a random sample: a cell is in this set because the tracker kept hold of it, which ' +
      'correlates with being isolated, bright and slow-moving.',
    the_selection_bias_is_the_point:
      'this is the honest limit of the layer. Showing 142 well-tracked cells moving among a cloud of ' +
      '500 is showing exactly what was measured, and the 142 are a biased sample of the 500.',
  },
  manifest: { file: 'embryo-manifest.json', bytes: 24257, what: 'source, licence, normalisation, the frame index, and the claim attached to each artefact' },
  total_bytes: 1680708,
  why_this_fits_in_the_repository:
    '1.7 MB for 222,071 measured positions across 420 frames. The Phase 0 estimate for the keyframed ' +
    'route was about 5 MB for 300 frames of 1000 bodies, so the honest artefact is also the smaller one.',
});

/** Route the layer through the Phase 0 pipeline rule and check the answer still holds. */
export function route() {
  const cloud = PIPE.route({ instances: MEASURED.max_per_frame, moves_per_frame: true, frames: SOURCE.frames, identity: false });
  const cloudIfIdentityWereAssumed = PIPE.route({ instances: MEASURED.max_per_frame, moves_per_frame: true, frames: SOURCE.frames });
  const tracks = PIPE.route({ instances: ARTEFACTS.tracks.count, moves_per_frame: true, frames: SOURCE.frames, identity: true });
  return {
    cloud: { ...cloud, chosen: 'raw binary buffer', agrees_with_pipeline_rule: cloud.pipeline === 'raw-buffer-and-shader' },
    tracks: {
      ...tracks,
      chosen: 'JSON paths, read by the viewer as per-object motion',
      note:
        'the rule offers GLB keyframes here and it is right to - 142 objects over 420 frames is about ' +
        '1.0 MB. JSON was chosen anyway, because the viewer already reads the manifest for the cloud\'s ' +
        'frame index and the two artefacts have to stay in step frame for frame. That is a convenience ' +
        'choice, not a correctness one, and it is recorded as such.',
    },
    what_phase_1_changed_about_the_rule: {
      what_happened:
        'routing the cloud by size alone returned "blender-glb-trs-keyframes, 6.4 MB, within reach". ' +
        'That answer is not expensive, it is impossible: a TRS track asserts that the thing it animates ' +
        'is the same thing across frames, and this cloud has no correspondence between frames.',
      the_fix: 'pipeline.route() gained an `identity` input, defaulting to true so every earlier answer is unchanged. With identity: false and motion, it returns the buffer regardless of size.',
      what_the_rule_now_says_without_it: cloudIfIdentityWereAssumed.pipeline,
      and_with_it: cloud.pipeline,
      why_this_is_the_right_shape_of_fix: 'the rule gave a confident wrong answer because it was missing a variable, not because the caller was unusual. Special-casing the caller would have left the next caller to rediscover it.',
    },
  };
}

/** What Phase 1 did NOT deliver, so the next phase starts from the truth. */
export const NOT_DELIVERED = Object.freeze([
  'a continuous whole-embryo cell-tracking animation. The data does not contain one: 51 % of tracks are a single frame.',
  'cell SHAPE. These are Gaussian-mixture centroids with covariances; the covariances are in the XML and are not used here. A sphere per detection is depicted.',
  'the environment toggle. environment.mjs holds the dish and the wild as numbers; nothing yet drives a scene from them.',
  'a micron scale. The study records its physical pixel size as null, so everything here is in voxels and the manifest says so.',
  'the epiblast and mesendoderm layers, which are 805 MB and 877 MB. Only the endoderm layer was fetched.',
  'any claim about division PHASE per cell, which would need the continuous tracks that do not exist.',
  'an hours-post-fertilisation axis. See CLOCK: the study window and this file’s frame count are inconsistent and frame 0’s stage is unknown, so the layer shows elapsed time only.',
]);
