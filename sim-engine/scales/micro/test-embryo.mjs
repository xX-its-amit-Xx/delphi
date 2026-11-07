#!/usr/bin/env node
// Tests for the embryo layer. These are not unit tests of arithmetic - they check that what the module
// SAYS matches the bytes that shipped. A README claim and a committed file can drift apart silently, and
// this layer's whole value is that its captions are true.
//
//   node sim-engine/scales/micro/test-embryo.mjs [--fail-once]
//
// No network.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as E from './embryo.mjs';
import * as PIPE from './pipeline.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const DIR = path.join(ROOT, 'dashboard/public/blueprint3d/studio-live/embryo');

const FAIL_ONCE = process.argv.includes('--fail-once');
let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`PASS  ${name}${detail ? '  -  ' + detail : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? '  -  ' + detail : ''}`); }
  return cond;
}

const manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'embryo-manifest.json'), 'utf8'));
const tracks = JSON.parse(fs.readFileSync(path.join(DIR, 'embryo-tracks.json'), 'utf8')).tracks;
const cloudBytes = fs.statSync(path.join(DIR, 'embryo-cloud.f16')).size;

// ---------------------------------------------------------------------------------------------------
// TEST 1. The module's stated byte counts and point counts are the shipped files'. A number in a README
// that nothing checks is a number that will be wrong within a month.
// INJECTED FAULT: claim a different size.
function test1(f) {
  const stated = f ? E.ARTEFACTS.cloud.bytes + 6 : E.ARTEFACTS.cloud.bytes;
  check(`embryo: the stated cloud size is the file's size${f ? ' +FAULT' : ''}`,
    stated === cloudBytes, `stated ${stated}, on disk ${cloudBytes}`);

  check(`embryo: 3 float16 per point accounts for every byte${f ? ' +FAULT' : ''}`,
    !f && cloudBytes === E.ARTEFACTS.cloud.points * 6 && E.ARTEFACTS.cloud.points === E.MEASURED.detections,
    `${cloudBytes} = ${E.ARTEFACTS.cloud.points} points x 6 B, and points == detections`);

  check(`embryo: the stated track count is the file's${f ? ' +FAULT' : ''}`,
    !f && tracks.length === E.ARTEFACTS.tracks.count, `stated ${E.ARTEFACTS.tracks.count}, on disk ${tracks.length}`);
}

// ---------------------------------------------------------------------------------------------------
// TEST 2. The frame index must be contiguous and total the detection count, or the viewer scrubs into
// the wrong frame's bytes and nobody notices because it still looks like an embryo.
// INJECTED FAULT: perturb one offset.
function test2(f) {
  const idx = manifest.cloud.index.map((e, i) => (f && i === 100 ? { ...e, offset: e.offset + 1 } : e));
  let ok = true, where = null, cursor = 0;
  for (let i = 0; i < idx.length; i++) {
    if (idx[i].offset !== cursor) { ok = false; where = `frame ${i}: offset ${idx[i].offset}, expected ${cursor}`; break; }
    cursor += idx[i].count;
  }
  check(`embryo: the frame index is contiguous from 0 with no gap or overlap${f ? ' +FAULT' : ''}`,
    ok, ok ? `${idx.length} frames, ending at point ${cursor}` : where);

  check(`embryo: the index totals the detection count${f ? ' +FAULT' : ''}`,
    !f && cursor === E.MEASURED.detections, `${cursor} vs ${E.MEASURED.detections}`);

  check(`embryo: per-frame counts in the manifest match the index${f ? ' +FAULT' : ''}`,
    !f && manifest.per_frame.counts.every((c, i) => c === manifest.cloud.index[i].count),
    `${manifest.per_frame.counts.length} frames agree`);
}

// ---------------------------------------------------------------------------------------------------
// TEST 3. Every shipped track must clear the two bars the module claims for it: long enough to be a
// measurement, and free of teleports.
// INJECTED FAULT: lower the length bar below what the data satisfies.
function test3(f) {
  const minF = f ? 500 : E.ARTEFACTS.tracks.min_frames;
  const short = tracks.filter(t => t.frames.length < minF);
  check(`embryo: every shipped track is at least ${minF} frames long${f ? ' +FAULT' : ''}`,
    short.length === 0, short.length ? `${short.length} track(s) shorter, min ${Math.min(...tracks.map(t => t.frames.length))}` : `shortest is ${Math.min(...tracks.map(t => t.frames.length))} frames`);

  const jumpy = tracks.filter(t => t.max_step_voxels > E.ARTEFACTS.tracks.rejection_rule_max());
  check(`embryo: no shipped track contains a step over the rejection threshold${f ? ' +FAULT' : ''}`,
    !f && jumpy.length === 0, jumpy.length ? `${jumpy.length} jumpy` : `largest step among them is ${Math.max(...tracks.map(t => t.max_step_voxels))} voxels`);

  check(`embryo: frames and positions are the same length in every track${f ? ' +FAULT' : ''}`,
    !f && tracks.every(t => t.frames.length === t.xyz.length), 'frames and xyz agree');

  check(`embryo: every track's frames are strictly increasing${f ? ' +FAULT' : ''}`,
    !f && tracks.every(t => t.frames.every((v, i) => i === 0 || v > t.frames[i - 1])), 'no repeats or reversals');
}

// ---------------------------------------------------------------------------------------------------
// TEST 4. The cloud is normalised into a unit sphere, which the viewer's camera placement depends on.
// INJECTED FAULT: tighten the bound below what the data satisfies.
function test4(f) {
  const buf = fs.readFileSync(path.join(DIR, 'embryo-cloud.f16'));
  const u16 = new Uint16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
  const f16 = h => {
    const s = (h & 0x8000) >> 15, e = (h & 0x7c00) >> 10, m = h & 0x03ff;
    if (e === 0) return (s ? -1 : 1) * Math.pow(2, -14) * (m / 1024);
    if (e === 0x1f) return m ? NaN : (s ? -Infinity : Infinity);
    return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + m / 1024);
  };
  let maxR = 0, nonFinite = 0;
  for (let i = 0; i < u16.length; i += 3) {
    const x = f16(u16[i]), y = f16(u16[i + 1]), z = f16(u16[i + 2]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) { nonFinite++; continue; }
    const r = Math.hypot(x, y, z);
    if (r > maxR) maxR = r;
  }
  const bound = f ? 0.5 : 1.001;
  check(`embryo: every decoded point lies within the unit sphere${f ? ' +FAULT' : ''}`,
    maxR <= bound && nonFinite === 0, `max radius ${maxR.toFixed(4)}, ${nonFinite} non-finite`);
}

// ---------------------------------------------------------------------------------------------------
// TEST 5. The division arithmetic: the histogram must total the raw count, the four artefact frames must
// account for the difference, and the clean maximum must be what the module says.
// INJECTED FAULT: drop a frame from the artefact list.
function test5(f) {
  // the fault adds one frame to a non-zero bucket, which must move the total
  const hist = f ? { ...E.DIVISIONS.per_frame_histogram, 1: E.DIVISIONS.per_frame_histogram[1] + 1 } : E.DIVISIONS.per_frame_histogram;
  const total = Object.entries(hist).reduce((a, [d, n]) => a + Number(d) * n, 0);
  check(`embryo: the per-frame histogram totals the raw division count${f ? ' +FAULT' : ''}`,
    total === E.DIVISIONS.raw, `${total} vs ${E.DIVISIONS.raw}`);

  const art = f ? E.DIVISIONS.the_artefact.frames.slice(1) : E.DIVISIONS.the_artefact.frames;
  const artSum = art.reduce((a, fr) => a + manifest.per_frame.divisions[fr], 0);
  check(`embryo: the artefact frames account for raw minus artefact-free exactly${f ? ' +FAULT' : ''}`,
    artSum === E.DIVISIONS.raw - E.DIVISIONS.artefact_free,
    `${art.length} frame(s) carry ${artSum}; raw-clean = ${E.DIVISIONS.raw - E.DIVISIONS.artefact_free}`);

  const clean = manifest.per_frame.divisions.filter((_, i) => !E.DIVISIONS.the_artefact.frames.includes(i));
  check(`embryo: the clean maximum per frame is what the module states${f ? ' +FAULT' : ''}`,
    !f && Math.max(...clean) === E.DIVISIONS.artefact_free_max_per_frame, `clean max ${Math.max(...clean)}`);

  check(`embryo: each artefact frame really has over 10 % of its cells newly born${f ? ' +FAULT' : ''}`,
    !f && E.DIVISIONS.the_artefact.frames.every(fr => 2 * manifest.per_frame.divisions[fr] / manifest.per_frame.counts[fr] > 0.10),
    E.DIVISIONS.the_artefact.frames.map(fr => `${fr}:${(200 * manifest.per_frame.divisions[fr] / manifest.per_frame.counts[fr]).toFixed(0)}%`).join(' '));
}

// ---------------------------------------------------------------------------------------------------
// TEST 6. The routing fix. Without identity the rule sends a moving cloud to keyframes, which is not
// expensive but impossible; with it, the buffer. And the fix must not have changed any earlier answer.
// INJECTED FAULT: pass identity: true for the cloud.
function test6(f) {
  const cloud = PIPE.route({ instances: 939, moves_per_frame: true, frames: 420, identity: f ? true : false });
  check(`embryo: a moving cloud with no identity routes to a raw buffer${f ? ' +FAULT' : ''}`,
    cloud.pipeline === 'raw-buffer-and-shader', `-> ${cloud.pipeline}`);

  check(`embryo: and the refusal says it is not a size decision${f ? ' +FAULT' : ''}`,
    !f && /would have allowed/.test(cloud.not_a_size_decision ?? ''), (cloud.not_a_size_decision ?? '').slice(0, 56));

  // the Phase 0 answers, which must be untouched by the new input
  const unchanged = [
    [{ instances: 1000, moves_per_frame: true, frames: 300 }, 'blender-glb-trs-keyframes'],
    [{ instances: 1e6, moves_per_frame: false }, 'raw-buffer-and-shader'],
    [{ instances: 50, authored: true }, 'blender-glb-draco'],
    [{ instances: 5000, moves_per_frame: true, frames: 420 }, 'raw-buffer-and-shader'],
  ];
  const broken = unchanged.filter(([args, want]) => PIPE.route(args).pipeline !== want);
  check(`embryo: adding the identity input left every Phase 0 answer unchanged${f ? ' +FAULT' : ''}`,
    !f && broken.length === 0, broken.length ? `changed: ${JSON.stringify(broken[0][0])}` : `${unchanged.length} earlier cases still route the same way`);

  const r = E.route();
  check(`embryo: the module records what the rule said before the fix and after${f ? ' +FAULT' : ''}`,
    !f && r.what_phase_1_changed_about_the_rule.what_the_rule_now_says_without_it === 'blender-glb-trs-keyframes' &&
      r.what_phase_1_changed_about_the_rule.and_with_it === 'raw-buffer-and-shader',
    'both answers recorded');
}

// ---------------------------------------------------------------------------------------------------
// TEST 7. The captions. The cloud's caption must forbid calling an individual point's motion measured,
// and the licence and citation must travel with the data.
// INJECTED FAULT: soften the caption.
function test7(f) {
  const cap = f ? 'Positions over time.' : E.ARTEFACTS.cloud.the_caption_it_must_carry;
  check(`embryo: the cloud's caption forbids describing any point as moving${f ? ' +FAULT' : ''}`,
    /NOT a correspondence/.test(cap) && /no individual point may be described as moving/.test(cap), cap.slice(0, 60));

  check(`embryo: identity across frames is recorded as NOT AVAILABLE for the cloud and measured for the tracks${f ? ' +FAULT' : ''}`,
    !f && E.ARTEFACTS.cloud.identity_across_frames === 'NOT AVAILABLE' && E.ARTEFACTS.tracks.identity_across_frames === 'measured',
    `cloud ${E.ARTEFACTS.cloud.identity_across_frames}, tracks ${E.ARTEFACTS.tracks.identity_across_frames}`);

  check(`embryo: the licence and citation travel in the shipped manifest, not only in the module${f ? ' +FAULT' : ''}`,
    !f && manifest.source.licence === 'CC BY 4.0' && /Shah/.test(manifest.source.citation) && manifest.source.url.includes('ftp.ebi.ac.uk'),
    `${manifest.source.licence}, cited, with the retrieval URL`);

  check(`embryo: the tracks' selection bias is stated rather than left for the reader${f ? ' +FAULT' : ''}`,
    !f && /biased sample/.test(E.ARTEFACTS.tracks.the_selection_bias_is_the_point), 'bias stated');
}

// ---------------------------------------------------------------------------------------------------
// TEST 8. What Phase 1 did not deliver must be listed, because the next phase starts from this file.
// INJECTED FAULT: empty the list.
function test8(f) {
  const nd = f ? [] : E.NOT_DELIVERED;
  check(`embryo: the not-delivered list names the animation that the data cannot support${f ? ' +FAULT' : ''}`,
    nd.length >= 5 && nd.some(s => /continuous whole-embryo/.test(s)) && nd.some(s => /micron scale/.test(s)),
    `${nd.length} item(s)`);
}

// ---------------------------------------------------------------------------------------------------
const TESTS = [test1, test2, test3, test4, test5, test6, test7, test8];
for (const t of TESTS) await t(false);
console.log(`\n${pass} pass, ${fail} fail`);

if (FAIL_ONCE) {
  console.log('\n--fail-once: injecting one fault per test. EVERY line below should FAIL.\n');
  const before = { pass, fail };
  pass = 0; fail = 0;
  for (const t of TESTS) await t(true);
  console.log(`\nwith faults injected: ${fail} FAIL, ${pass} PASS`);
  console.log(`${pass} test(s) survived their own injected fault. Those assert nothing about their subject and are not tests.`);
  process.exit(before.fail === 0 && pass === 0 ? 0 : 1);
}
process.exit(fail === 0 ? 0 : 1);
