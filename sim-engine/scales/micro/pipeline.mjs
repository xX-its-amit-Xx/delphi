// HOW EACH LEVEL GETS TO THE SCREEN: measured limits, and the rule that routes a level to a pipeline.
//
// ============================== THE FACT THAT DECIDES THE ARCHITECTURE ==============================
// ANIMATED INSTANCING DOES NOT EXIST IN glTF. Not "is awkward" - does not exist, at both ends:
//   * Blender's glTF exporter DELETES animation channels targeting any node it collapses into
//     EXT_mesh_gpu_instancing.
//   * three.js's GLTFLoader reads instance TRANSLATION/ROTATION/SCALE exactly ONCE into static matrices
//     and creates no keyframe tracks at all.
// So the moment a population is both large and moving, the file format has run out, and no exporter flag
// rescues it. That single fact, rather than any aesthetic preference, is why this pipeline has two halves.
//
// ============================== WHAT IS MEASURED HERE, AND WHERE ==============================
// Everything in MEASURED below was run on THIS machine against the repository's own Blender 4.2.23 and a
// local OpenMM install, not quoted from documentation. Where a number is quoted rather than measured it
// says so. The headline surprise: Blender itself is not the bottleneck - it builds and iterates 10^7
// geometry-nodes instances in about 6 seconds. The PYTHON EXPORTER is the wall, and it arrives at about
// 10^5 because it allocates one glTF node object per instance and goes superlinear.
//
// ============================== THE ROUTING RULE ==============================
//   Blender-baked GLB   when the thing is FEW, LARGE and AUTHORED - real materials, normals, lighting.
//   Raw binary buffer   when the thing is MANY, SMALL, or MOVING.
// The crossover is about 10^5 instances, OR the instant anything needs to move per frame - whichever
// comes first. The second half of that clause is the one that actually fires most often.

export const MEASURED = {
  where: 'this machine, 2026-11-04: Blender 4.2.23 at C:/Temp/tools/blender, and a local OpenMM install',
  blender_builds_instances_fast: {
    '1e6_instances': '0.54 s to build and fully iterate via the dependency graph',
    '1e7_instances': '6.0 s, no failures',
    conclusion: 'Blender is not the constraint. Everything below is about the EXPORTER.',
  },
  gltf_export_of_geometry_nodes_instances: {
    note: 'a 42-vertex, 80-triangle icosphere instanced on points. Two exporter flags, BOTH DEFAULT OFF: export_gn_mesh (without it, geometry-nodes instances are SILENTLY DROPPED) and export_gpu_instances.',
    rows: [
      { instances: 1e3, flags_off_bytes: 9_200, gn_on_bytes: 126_000, gn_on_seconds: 0.19, gpu_on_bytes: 58_000, gpu_on_seconds: 0.11 },
      { instances: 1e4, flags_off_bytes: 9_200, gn_on_bytes: 1_110_000, gn_on_seconds: 2.3, gpu_on_bytes: 418_000, gpu_on_seconds: 2.9 },
      { instances: 1e5, flags_off_bytes: 9_200, gn_on_bytes: 11_000_000, gn_on_seconds: 83, gpu_on_bytes: 4_020_000, gpu_on_seconds: 176 },
    ],
    it_does_not_realise_instances: 'mesh count stayed at 2 for every instance count - the mesh is written once and reused by index. What explodes is the glTF NODE ARRAY, at roughly 110 bytes of JSON per instance.',
    gpu_instancing_cost: '40 bytes per instance exactly (3 + 4 + 3 float32 for translation, rotation, scale), measured at 40.2 B/instance including overhead',
    draco_is_irrelevant_here: 'Draco compresses mesh attributes, not instancing accessors. gzip does help: a 10k GPU-instanced GLB goes 418 KB to 115 KB.',
    practical_ceiling: 1e5,
    why: 'the exporter allocates a Python glTF node per instance. Ten times the count costs 27x then 60x the time.',
  },
  point_clouds_export_as_nothing: {
    what: 'Blender\'s glTF exporter returns nothing for any object whose type is not MESH, and for geometry-nodes instances whose data is not a Mesh.',
    consequence: 'a true Blender point cloud produces an empty file. Confirmed: a styled molecule exported to a 1,956-byte GLB containing 24 vertices - the molecule was entirely absent - until export_gn_mesh was switched on.',
  },
  per_object_animation: {
    measured: '500 objects sharing one 20-triangle mesh, translation keyed on all 100 frames',
    bytes_per_object_frame: 16.2,
    composition: '12 bytes of vec3 plus a 4-byte timestamp',
    one_clip_per_object: 'the export produced 501 separate glTF animations, every one of which the viewer must play',
    optimize_animation_size_saved_nothing: 'on genuinely varying data it only removes redundant keyframes',
    draco_does_not_compress_animation: 'it is a mesh codec',
    gzip: 'about 2x',
    extrapolated_ceiling: '5,000 cells over 300 frames is about 24 MB, roughly 12 MB gzipped. 50,000 cells over 300 frames is about 240 MB, which is unshippable.',
  },
  three_js_instancing: {
    instanced_mesh_cost: '64 bytes per instance - a full 4x4 matrix, allocated eagerly. 10^6 instances is 64 MB on the CPU and 64 MB on the GPU.',
    cheaper: 'an InstancedBufferAttribute of vec3 offsets is 12 bytes per instance, or a Points cloud. Five times cheaper than the matrix.',
    picking_is_linear: 'raycast loops over every instance, so picking is O(N) and unusable much above 10^4 to 10^5. A click-to-inspect feature at molecular scale needs its own spatial index.',
    benchmark_caveat: 'the best public benchmark found reports 60 fps at 10^4 and about 20 fps at 10^5 - but each instance there was a 6,056-triangle plant, so that result is TRIANGLE-bound, not instance-bound. Scaled to simple cell geometry, 10^5 bodies is roughly the 10^4-plant case. No authoritative 10^6-instance benchmark was found and none was run here.',
  },
  molecular_dynamics_on_this_box: {
    engine: 'OpenMM 8.6.1, installed from pip on Windows with no compiler and no conda',
    measured: 'a TIP3P water box of 9,549 atoms, Langevin middle integrator at 300 K with a 2 fs timestep, PME at 1.0 nm, HBonds constrained, on the CPU platform: 20.97 ns/day (10 ps in 41.2 s)',
    gotcha: 'the plain pip wheel exposed only the Reference and CPU platforms on this box - no OpenCL, despite the documentation claiming otherwise. Budget on installing the CUDA extra explicitly for GPU.',
    verdict: 'fine for a few-hundred-frame illustrative trajectory. Anything real belongs on a GPU or the cluster.',
  },
  trajectory_bytes_per_atom_per_frame: {
    pdb_text: 82, dcd_or_raw_float32: 12.009, raw_float32_gzip: 10.70, xtc: 3.511,
    raw_float16: 6.0, uint16_quantised: 6.0, delta_int16_gzip: 4.722,
    the_useful_fact: 'float16 raw (6 B) BEATS gzipped float32 (10.7 B) and is directly uploadable as a GPU attribute. That makes it the right wire format for the browser, even though XTC is smaller on disk.',
    the_unforgiving_arithmetic: '10^5 atoms over 10^3 frames is 351 MB even as XTC. The atomic tier must be decimated and streamed as data, never baked as geometry.',
  },
};

export const MOLECULAR_NODES = {
  what: 'the Blender add-on that imports structures and molecular-dynamics trajectories',
  headless: 'YES - verified on this machine from a plain python process with no Blender binary and no GUI: 23,694 atoms fetched and exported to a 952 KB GLB in 7.7 s.',
  the_version_problem: 'its version number IS the Blender version it targets. The current release needs Blender 5.2, and the repository runs Blender 4.2.23 - which can only use a release about 21 months old. The 5.2-era release also changed the world scale by a factor of ten.',
  recommendation: 'run it as a SEPARATE job on its own Python 3.13 environment with a pip-installed bpy, emitting GLB or raw buffers. That decouples its hard Blender-5.2 requirement from the existing 4.2 mesh builder rather than forcing an upgrade of the whole pipeline.',
  known_breakage: 'the current release is broken against the current version of one of its own dependencies; pinning that dependency to its declared minimum fixes it. Verified.',
  licence: 'GPL-3.0-or-later',
  reads: 'PDB, mmCIF, AlphaFold, molecular-dynamics topologies and trajectories through MDAnalysis, electron-density maps, and CellPack ensembles',
};

export const PRIOR_ART = [
  { name: 'Mesoscale Explorer, on the Mol* framework', what: 'a browser viewer for mesoscale models from viruses up to organelles, rendering billions of atoms through per-entity instancing, ray-cast sphere impostors, level of detail, and frustum and occlusion culling',
    citation: 'Rose, Sehnal, Goodsell, Autin 2024, Protein Science 33(10):e5177, doi 10.1002/pro.5177', licence: 'MIT',
    why_it_matters: 'the closest existing thing to what is being built here, and independent confirmation of the architecture below - it reached the same split without us. Its manifest format (a repeated entity plus a list of instance transforms) is a ready-made specification worth reading before inventing one.' },
  { name: 'cellPACK', what: 'packs molecular recipes into cell-scale volumes', citation: 'Johnson et al. 2015, Nat Methods', licence: 'MIT', why_it_matters: 'generates the mesoscale arrangement rather than having it drawn by hand. Molecular Nodes imports its output directly.' },
  { name: 'CellPAINT, CellVIEW, and the Digizyme cellular landscape', what: 'the aesthetic and methodological precedent for multi-scale cellular illustration', licence: 'closed or unstated', why_it_matters: 'cite as precedent; none of it is reusable as code.' },
  { name: 'BioBlender', what: 'the historical Blender molecular add-on', licence: 'GPL', why_it_matters: 'DISCONTINUED after fifteen years. Molecular Nodes is its successor. Cite for history only.' },
];

/** Route a level to a pipeline, from its instance count and whether it moves. */
/** `identity` was added in Phase 1 and defaults to true, which preserves every earlier answer.
 *
 *  It exists because the first real dataset broke an assumption this rule did not know it was making. A
 *  TRS keyframe track asserts that the thing it animates is the SAME THING across frames. The measured
 *  embryo cloud is 222,071 nucleus positions in which the correspondence between frames mostly does not
 *  exist - 51 % of reconstructed tracks are a single frame long. At 939 moving objects over 420 frames
 *  the size arithmetic happily returned "GLB keyframes, 6.4 MB", and that answer was impossible, not
 *  merely expensive: there is nothing to keyframe.
 *
 *  So identity is now an input, and when it is absent the route is a buffer regardless of size. This is
 *  the only correct kind of fix for a rule that gave a confident wrong answer: give it the missing
 *  variable rather than special-case the caller. */
export function route({ instances, moves_per_frame = false, frames = 1, authored = false, identity = true }) {
  const EXPORT_CEILING = MEASURED.gltf_export_of_geometry_nodes_instances.practical_ceiling;
  const ANIM_BYTES = MEASURED.per_object_animation.bytes_per_object_frame;

  if (moves_per_frame && identity === false) {
    return {
      pipeline: 'raw-buffer-and-shader',
      instances, frames,
      estimated_bytes: Math.round(instances * frames * 12),
      estimated_bytes_float16: Math.round(instances * frames * 6),
      why:
        'the data has NO IDENTITY ACROSS FRAMES, so there is nothing a keyframe track could animate. A ' +
        'TRS track asserts "this object, over time"; a per-frame point cloud without correspondence is ' +
        'a sequence of independent measurements. The buffer route is the only one that does not invent ' +
        'the correspondence.',
      not_a_size_decision: `the size arithmetic would have allowed glTF animation here (${(instances * frames * ANIM_BYTES / 1e6).toFixed(1)} MB), and it would still have been wrong.`,
      caption_the_viewer_must_carry: 'positions are measured; motion of any individual point is not.',
    };
  }

  if (moves_per_frame && instances > 1) {
    const glbBytes = instances * frames * ANIM_BYTES;
    const shippable = glbBytes < 30e6;
    if (shippable && instances <= 5000) {
      return { pipeline: 'blender-glb-trs-keyframes', instances, frames,
        estimated_bytes: Math.round(glbBytes), estimated_gzip_bytes: Math.round(glbBytes / 2),
        why: `${instances} moving objects over ${frames} frames is about ${(glbBytes / 1e6).toFixed(1)} MB at the measured ${ANIM_BYTES} bytes per object-frame, roughly half that gzipped. Within reach, and it keeps real materials and lighting.`,
        caveat: `this produces ONE animation clip per object - ${instances} clips the viewer must play. And it cannot use GPU instancing: the exporter deletes animation on any node it collapses.` };
    }
    return { pipeline: 'raw-buffer-and-shader', instances, frames,
      estimated_bytes: Math.round(instances * frames * 12),
      estimated_bytes_float16: Math.round(instances * frames * 6),
      why: `${instances} moving objects over ${frames} frames would be about ${(glbBytes / 1e6).toFixed(0)} MB as glTF animation, which is unshippable. Animated instancing does not exist in glTF, so the format has run out: ship positions as a typed array (${(instances * frames * 6 / 1e6).toFixed(1)} MB at float16) and render with Points plus sphere impostors.`,
      do_not: 'do not use InstancedMesh at this count - its 64-byte-per-instance matrix is five times the cost of a vec3 offset attribute.' };
  }

  if (instances <= 1e4 || authored) {
    return { pipeline: 'blender-glb-draco', instances,
      why: 'few, large and authored. Real materials, normals and the existing lighting conventions, with Draco paying for itself on mesh attributes.' };
  }
  if (instances <= EXPORT_CEILING) {
    const bytes = instances * 40;
    return { pipeline: 'blender-glb-gpu-instancing', instances, estimated_bytes: bytes,
      flags: { export_gn_mesh: true, export_gpu_instances: true },
      why: `static and under the measured export ceiling. 40 bytes per instance (about ${(bytes / 1e6).toFixed(2)} MB), and the viewer builds the instanced mesh with no code of ours.`,
      caveat: `budget the export time: measured 2.9 s at 10^4 but 176 s at 10^5, so cache aggressively. Both exporter flags default to OFF and geometry-nodes instances are SILENTLY DROPPED without the first.` };
  }
  return { pipeline: 'raw-buffer-and-shader', instances,
    estimated_bytes_float16: Math.round(instances * 6),
    why: `above the measured export ceiling of ${EXPORT_CEILING.toExponential(0)}, where Blender's exporter goes superlinear - 176 s at 10^5 and hours beyond. Blender itself would build these in seconds; the exporter is the wall. Ship a typed array instead.` };
}

export const ARCHITECTURE = {
  rule: 'Blender-baked GLB when the thing is few, large and authored. Raw binary buffer rendered by a shader when it is many, small, or moving. The crossover is about 10^5 instances, or the instant anything moves per frame - whichever comes first.',
  not_a_matter_of_taste: [
    'Blender\'s glTF exporter allocates a Python node per instance and goes superlinear: 0.19 s at 10^3, 2.9 s at 10^4, 176 s at 10^5 - while Blender\'s geometry nodes handle 10^7 instances in 6 s. The exporter, not Blender, is the wall, and it arrives at about 10^5.',
    'Animated instancing does not exist in glTF. Blender deletes animation channels on nodes it collapses, and three.js reads instance transforms exactly once. When a population is both large and moving, the format has run out.',
    '10^5 atoms over 10^3 frames is 351 MB in the best available trajectory format, so the atomic tier must be streamed as decimated data rather than baked as geometry.',
  ],
  independently_confirmed_by: 'Mesoscale Explorer reached the same split and renders billions of atoms in a browser with instancing, impostors, level of detail and culling over compact entity-plus-transform bundles.',
  where_the_embryo_lands:
    'A zebrafish embryo through the 1k-cell stage is about a thousand moving, dividing bodies - comfortably inside the per-object keyframe route at roughly 5 MB for 300 frames. It crosses into the buffer route somewhere past a few thousand cells, which in this organism is early in the blastula. So the honest statement is that the SMALL embryo can be baked with full materials and the LARGER one cannot, and the pipeline switches under the viewer rather than pretending one route covers both.',
};
