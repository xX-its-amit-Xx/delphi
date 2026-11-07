#!/usr/bin/env node
// Tests for analogues/render.mjs.
//
//   node analogues/test-render.mjs
//   node analogues/test-render.mjs --fail-once     <- EVERY line must read FAIL
//
// The second invocation is the point. Each assertion carries a deliberately broken twin predicate, and
// the twin is always an INVERSION rather than a loosened threshold - a test that still passes with its
// fault injected is a test that was never looking at the thing it names.
//
// ============================== THE TWO THINGS THAT ARE HARD TO TEST HERE ==============================
//
// 1. THE ABSENT CASE. The branch that matters most in findBlender() is the one that runs on a box with no
//    Blender on it, and this box has Blender. A null-returning branch that nobody has ever executed is a
//    branch that throws the first time somebody needs it. So findBlender takes a search-path override and
//    the test points it at a directory that does not exist.
//
// 2. WHETHER THE CAPTION IS ACTUALLY IN THE PIXELS. Asserting that renderSTL returned `caption: "..."`
//    tests a string, not an image: every one of those assertions would still pass if the Blender script
//    dropped the caption on the floor. So when Blender is available these tests DECODE THE PNG and look
//    at the bottom band of the image, which must be dark on a captioned render and must NOT be dark on an
//    uncaptioned one. That is the only assertion here that can tell a burned-in caption from a promise.
//
// Everything that does not need Blender runs unconditionally, so this file is meaningful on a box where
// the install failed. Live-render assertions are guarded by available() and SKIPPED LOUDLY.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

import {
  findBlender, available, availability, renderSTL, readSTLProvenance, classify,
  markerFilename, captionFor, PIPELINE_PATH,
  GATED_KINDS, DEPICTION_MARKER, MEASURED_KINDS, UNMEASURED_MARKER, UNSTAMPED_MARKER,
} from './render.mjs';
import { exportStage, GATED_KINDS as STL_GATED_KINDS, DEPICTION_MARKER as STL_MARKER } from '../organism-format/life/stl.mjs';

const FAULT = process.argv.includes('--fail-once');
let pass=0, fail=0;
const check=(name,cond,detail='')=>{ if(cond){pass++;console.log(`  ok   ${name}`);} else {fail++;console.log(`  FAIL ${name}${detail?` - ${detail}`:''}`);} };
const f=(real,broken)=>(FAULT?broken:real);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
let skipped = 0;
const skip = (why) => { skipped++; console.log(`  SKIP ${why}`); };

// Scratch lives OUTSIDE the repo: D: is nearly full and a test must not leave artefacts in a tree that
// gets committed. Overridable so a box with a different layout can point it somewhere else.
const TMP = process.env.DELPHI_RENDER_TMP || path.join(os.tmpdir(), 'delphi-render-tests');
fs.mkdirSync(TMP, { recursive: true });

// ---------------------------------------------------------------------------------------------------
// FIXTURES. Built through stl.mjs's own exporter rather than hand-rolled, so the headers under test are
// the headers the real exporter writes. Four cells in a tetrahedron, at a plausible blastomere radius.
// ---------------------------------------------------------------------------------------------------
const R = 16; // um
const CELLS = [['c1',[0,0,0]], ['c2',[26,0,0]], ['c3',[13,24,0]], ['c4',[13,8,23]]]
  .map(([id, centre]) => ({ id, channels: { geometry: { centre, radius: R } } }));

function fixture(kind, { allowDepicted = false, subdivisions = 1 } = {}) {
  const stage = {
    id: `four-cell-${kind}`,
    geometry: { units: 'um', provenance: { kind, source: 'test fixture, not data' }, cells: CELLS },
  };
  const r = exportStage(stage, { subdivisions, allowDepicted });
  if (r.refused) throw new Error(`fixture(${kind}) was refused by stl.mjs: ${r.refused}`);
  const p = path.join(TMP, r.suggested_filename);
  fs.writeFileSync(p, r.stl);
  return p;
}

const MEASURED_STL = fixture('measured');
const DEPICTED_STL = fixture('depicted', { allowDepicted: true });
const DERIVED_STL  = fixture('derived');

// An STL that is a perfectly valid mesh but carries no provenance: 1 triangle, blank header.
const UNSTAMPED_STL = path.join(TMP, 'unstamped.stl');
{
  const b = Buffer.alloc(84 + 50);
  b.writeUInt32LE(1, 80);
  for (let i = 0; i < 9; i++) b.writeFloatLE([0,0,0, 1,0,0, 0,1,0][i] ?? 0, 84 + 12 + 4 * i);
  fs.writeFileSync(UNSTAMPED_STL, b);
}
const TOO_SHORT_STL = path.join(TMP, 'truncated.stl');
fs.writeFileSync(TOO_SHORT_STL, Buffer.alloc(40));
const MISSING_STL = path.join(TMP, 'no-such-file-at-all.stl');
if (fs.existsSync(MISSING_STL)) fs.unlinkSync(MISSING_STL);

// ---------------------------------------------------------------------------------------------------
// A minimal PNG reader: signature, IHDR, and - when asked - the pixels.
// Written from the PNG spec rather than from a library, so "is this a PNG" is not the encoder agreeing
// with itself. Handles 8-bit RGB/RGBA non-interlaced, which is what the pipeline writes.
// ---------------------------------------------------------------------------------------------------
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readPNG(file, { pixels = false } = {}) {
  const buf = fs.readFileSync(file);
  const sig_ok = buf.length >= 8 && buf.subarray(0, 8).equals(PNG_SIG);
  if (!sig_ok) return { sig_ok, bytes: buf.length };
  let off = 8, width = 0, height = 0, depth = 0, colour = -1, interlace = -1, iend = false;
  const idat = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      depth = data[8]; colour = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') { iend = true; break; }
    off += 12 + len;                                   // len + type + data + crc
  }
  const out = { sig_ok, bytes: buf.length, width, height, depth, colour, interlace, iend, idat: idat.length };
  if (!pixels || !idat.length) return out;

  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colour];
  if (!channels || depth !== 8 || interlace !== 0) return { ...out, rgba: null };
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const img = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? img[y * stride + x - channels] : 0;      // left
      const b = y > 0 ? img[(y - 1) * stride + x] : 0;                   // up
      const c = (x >= channels && y > 0) ? img[(y - 1) * stride + x - channels] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {                                           // Paeth
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      img[y * stride + x] = v & 0xff;
    }
  }
  return { ...out, rgba: img, channels, stride };
}

/** Mean luminance (0-255) of the rows in [y0, y1). The caption bar is a near-black band, so this is how
 *  a burned-in caption is told apart from a caption that only exists in a JSON field. */
function bandLuma(png, y0frac, y1frac) {
  const { rgba, width, height, channels, stride } = png;
  const y0 = Math.floor(height * y0frac), y1 = Math.max(y0 + 1, Math.floor(height * y1frac));
  let sum = 0, n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < width; x++) {
      const o = y * stride + x * channels;
      sum += 0.2126 * rgba[o] + 0.7152 * rgba[o + 1] + 0.0722 * rgba[o + 2];
      n++;
    }
  }
  return sum / n;
}

// ===================================================================================================
console.log('\n1. findBlender - it must answer, not throw, when Blender is not there');
// ===================================================================================================
{
  const NOWHERE = [
    ['a directory that does not exist', () => path.join(TMP, 'no-blender-here-xyz', '*', 'blender.exe')],
    ['another one', () => path.join(TMP, 'nor-here-xyz', 'blender.exe')],
  ];
  let threw = null, absent = null;
  try { absent = findBlender({ paths: NOWHERE }); } catch (e) { threw = e; }

  check('findBlender does not throw when there is nothing to find',
    f(threw === null, threw !== null), threw ? `threw ${threw.message}` : '');
  check('it returns exe: null rather than undefined or a bare throw',
    f(absent?.exe === null, absent?.exe !== null), `exe = ${JSON.stringify(absent?.exe)}`);
  check('the null comes WITH a reason a human can act on',
    f(typeof absent?.reason === 'string' && absent.reason.length > 40,
      !(typeof absent?.reason === 'string' && absent.reason.length > 40)),
    `reason = ${JSON.stringify(absent?.reason)}`);
  check('the reason lists where it looked',
    f(NOWHERE.every(([label]) => absent?.reason.includes(label)),
      !NOWHERE.every(([label]) => absent?.reason.includes(label))), absent?.reason);
  check('the reason names the one official place to get Blender',
    f(/download\.blender\.org/.test(absent?.reason ?? ''), !/download\.blender\.org/.test(absent?.reason ?? '')));
  // A custom search list must not be cached, or one test would decide the answer for the whole process.
  // (The real search stops at its first hit, so it is NOT safe to assert that it looked everywhere.)
  const leaked = () => findBlender().searched.some(s => NOWHERE.some(([label]) => label === s));
  check('a failed custom search does not poison the cached real one',
    f(leaked() === false, leaked() !== false), findBlender().searched.join(', '));

  const real = findBlender();
  check('findBlender returns a plain object with exe/version/source/reason for the real search',
    f(['exe','version','source','reason','searched'].every(k => k in real),
      !['exe','version','source','reason','searched'].every(k => k in real)),
    Object.keys(real).join(','));
  check('available() is a boolean either way',
    f(typeof available() === 'boolean', typeof available() !== 'boolean'), `got ${typeof available()}`);
  check('availability() explains itself when it says no',
    f(availability().ok === true || typeof availability().reason === 'string',
      !(availability().ok === true || typeof availability().reason === 'string')));
}

// ===================================================================================================
console.log('\n2. reading provenance back out of the bytes');
// ===================================================================================================
{
  const dep = readSTLProvenance(DEPICTED_STL);
  check('a depicted export parses as provenance=depicted',
    f(dep.kind === 'depicted', dep.kind !== 'depicted'), `kind = ${dep.kind}`);
  check('its 80-byte header carries the DEPICTION marker',
    f(dep.marker_in_header === true, dep.marker_in_header !== true), dep.header);
  check('stl.mjs also put the marker in the filename',
    f(dep.marker_in_filename === true, dep.marker_in_filename !== true), path.basename(DEPICTED_STL));
  check('the triangle count is read from the file, not guessed',
    f(dep.triangles === 4 * 20 * 4, dep.triangles !== 4 * 20 * 4), `got ${dep.triangles}`);
  check('units survive into the header and are read back',
    f(dep.units === 'um', dep.units !== 'um'), `units = ${dep.units}`);

  const mea = readSTLProvenance(MEASURED_STL);
  check('a measured export parses as provenance=measured',
    f(mea.kind === 'measured', mea.kind !== 'measured'), `kind = ${mea.kind}`);
  check('and carries NO marker, in the header or the filename',
    f(mea.marker_in_header === false && mea.marker_in_filename === false,
      !(mea.marker_in_header === false && mea.marker_in_filename === false)));

  const un = readSTLProvenance(UNSTAMPED_STL);
  check('a valid STL with a blank header parses, but with kind null',
    f(un.ok === true && un.kind === null, !(un.ok === true && un.kind === null)),
    `ok=${un.ok} kind=${un.kind}`);
  check('and is reported as unstamped rather than as measured',
    f(un.stamped === false, un.stamped !== false));

  const gone = readSTLProvenance(MISSING_STL);
  check('a missing file is an error object, not an exception',
    f(gone.ok === false && typeof gone.error === 'string', !(gone.ok === false && typeof gone.error === 'string')),
    `error = ${gone.error}`);
  const short = readSTLProvenance(TOO_SHORT_STL);
  check('a 40-byte file is rejected: an STL is at least 84 bytes',
    f(short.ok === false && /84/.test(short.error ?? ''), !(short.ok === false && /84/.test(short.error ?? ''))),
    `error = ${short.error}`);
}

// ===================================================================================================
console.log('\n3. the gate - which mirrors stl.mjs rather than restating it');
// ===================================================================================================
{
  check('GATED_KINDS is the SAME object stl.mjs exports, not a second copy that can drift',
    f(GATED_KINDS === STL_GATED_KINDS, GATED_KINDS !== STL_GATED_KINDS));
  check('DEPICTION_MARKER likewise comes from stl.mjs',
    f(DEPICTION_MARKER === STL_MARKER, DEPICTION_MARKER !== STL_MARKER), `${DEPICTION_MARKER} vs ${STL_MARKER}`);
  check('measured and depicted are disjoint: no kind is both',
    f(MEASURED_KINDS.every(k => !GATED_KINDS.includes(k)), !MEASURED_KINDS.every(k => !GATED_KINDS.includes(k))));

  const vDep = classify(readSTLProvenance(DEPICTED_STL));
  check('depicted is gated',        f(vDep.gated === true, vDep.gated !== true));
  check('depicted is not measured', f(vDep.measured === false, vDep.measured !== false));
  check('depicted requires a marker', f(vDep.requires_marker === true, vDep.requires_marker !== true));
  check('and the marker is DEPICTION', f(vDep.marker === DEPICTION_MARKER, vDep.marker !== DEPICTION_MARKER), vDep.marker);

  const vMea = classify(readSTLProvenance(MEASURED_STL));
  check('measured is the one kind that needs no marker',
    f(vMea.requires_marker === false && vMea.marker === null,
      !(vMea.requires_marker === false && vMea.marker === null)),
    `requires_marker=${vMea.requires_marker} marker=${vMea.marker}`);
  check('measured is not refusable', f(vMea.refusable === false, vMea.refusable !== false));

  // The distinction the whole module turns on: `derived` is NOT gated by stl.mjs, so it is not refused -
  // but it is not a measurement either, so it must still be marked. Collapsing these two is how an
  // unmarked picture of a guess gets made.
  const vDer = classify(readSTLProvenance(DERIVED_STL));
  check('derived is NOT gated (stl.mjs exported it without a flag)',
    f(vDer.gated === false, vDer.gated !== false));
  check('but derived still requires a marker, because it is not a measurement',
    f(vDer.requires_marker === true, vDer.requires_marker !== true));
  check('and its marker says UNMEASURED, not DEPICTION: different claims, different words',
    f(vDer.marker === UNMEASURED_MARKER, vDer.marker !== UNMEASURED_MARKER), vDer.marker);

  const vUn = classify(readSTLProvenance(UNSTAMPED_STL));
  check('an unstamped STL is refusable: unknown provenance is not permission',
    f(vUn.refusable === true, vUn.refusable !== true));
  check('and is marked UNSTAMPED', f(vUn.marker === UNSTAMPED_MARKER, vUn.marker !== UNSTAMPED_MARKER), vUn.marker);
}

// ===================================================================================================
console.log('\n4. the filename keeps the marker');
// ===================================================================================================
{
  const a = markerFilename(path.join('out', 'morula.png'), DEPICTION_MARKER);
  check('the marker is spliced in before the extension',
    f(path.basename(a) === `morula.${DEPICTION_MARKER}.png`, path.basename(a) !== `morula.${DEPICTION_MARKER}.png`),
    path.basename(a));
  check('splicing is idempotent: a name that has it does not get it twice',
    f(markerFilename(a, DEPICTION_MARKER) === a, markerFilename(a, DEPICTION_MARKER) !== a));
  check('the extension survives',
    f(path.extname(a) === '.png', path.extname(a) !== '.png'));
  check('a null marker leaves the name alone',
    f(markerFilename('out/x.png', null) === 'out/x.png', markerFilename('out/x.png', null) !== 'out/x.png'));
  check('a marker is not spliced into a name that merely CONTAINS the word',
    f(path.basename(markerFilename(path.join('out','my-DEPICTIONS.png'), DEPICTION_MARKER))
        === `my-DEPICTIONS.${DEPICTION_MARKER}.png`,
      path.basename(markerFilename(path.join('out','my-DEPICTIONS.png'), DEPICTION_MARKER))
        !== `my-DEPICTIONS.${DEPICTION_MARKER}.png`));
}

// ===================================================================================================
console.log('\n5. renderSTL refuses before it renders - these hold with or without Blender');
// ===================================================================================================
{
  const out = path.join(TMP, 'out', 'refused.png');
  const r = renderSTL(DEPICTED_STL, { out, engine: 'CYCLES', width: 64, height: 48, samples: 1 });
  check('depicted geometry with no caption flag is REFUSED',
    f(typeof r.refused === 'string' && r.refused.length > 0,
      !(typeof r.refused === 'string' && r.refused.length > 0)), `refused = ${r.refused}`);
  check('a refusal produces no PNG', f(r.png === null, r.png !== null), `png = ${r.png}`);
  check('nothing was written to disk either',
    f(fs.existsSync(out) === false, fs.existsSync(out) !== false));
  check('the refusal names the provenance kind that caused it',
    f(/depicted/.test(r.refused ?? ''), !/depicted/.test(r.refused ?? '')));
  check('the refusal says which flag turns it off',
    f(/caption:\s*true/.test(r.refused ?? ''), !/caption:\s*true/.test(r.refused ?? '')));
  check('the refusal points at the exporter whose rule it mirrors',
    f(/stl\.mjs/.test(r.refused ?? ''), !/stl\.mjs/.test(r.refused ?? '')));

  const un = renderSTL(UNSTAMPED_STL, { out: path.join(TMP, 'out', 'unstamped.png'), dryRun: true });
  check('an unstamped STL is refused too',
    f(typeof un.refused === 'string', typeof un.refused !== 'string'), `refused = ${un.refused}`);

  const der = renderSTL(DERIVED_STL, { out: path.join(TMP, 'out', 'derived.png'), caption: true, dryRun: true });
  check('derived is NOT refused once consented to',
    f(der.refused === null, der.refused !== null), `refused = ${der.refused}`);

  const mea = renderSTL(MEASURED_STL, { out: path.join(TMP, 'out', 'measured-plan.png'), dryRun: true });
  check('measured geometry is never refused',
    f(mea.refused === null, mea.refused !== null), `refused = ${mea.refused}`);
}

// ===================================================================================================
console.log('\n6. the planned output path - the marker rule, checkable without rendering');
// ===================================================================================================
{
  const dep = renderSTL(DEPICTED_STL, { out: path.join(TMP, 'out', 'plain-name.png'), caption: true, dryRun: true });
  const base = path.basename(dep.planned_png ?? '');
  check('a depicted render asked for "plain-name.png" is planned as *.DEPICTION.png',
    f(base.split('.').includes(DEPICTION_MARKER), !base.split('.').includes(DEPICTION_MARKER)), base);
  check('the caller cannot name the marker away',
    f(base.endsWith(`.${DEPICTION_MARKER}.png`), !base.endsWith(`.${DEPICTION_MARKER}.png`)), base);
  check('a caption is generated for it',
    f(typeof dep.caption === 'string' && dep.caption.includes(DEPICTION_MARKER),
      !(typeof dep.caption === 'string' && dep.caption.includes(DEPICTION_MARKER))), dep.caption);
  check('the caption says NOT A MEASUREMENT in those words',
    f(/NOT A MEASUREMENT/.test(dep.caption ?? ''), !/NOT A MEASUREMENT/.test(dep.caption ?? '')));

  const mea = renderSTL(MEASURED_STL, { out: path.join(TMP, 'out', 'measured-plan.png'), dryRun: true });
  const mbase = path.basename(mea.planned_png ?? '');
  check('a MEASURED render keeps the plain name: no marker invented',
    f(mbase === 'measured-plan.png', mbase !== 'measured-plan.png'), mbase);
  check('and gets no caption at all',
    f(mea.caption === null, mea.caption !== null), `caption = ${mea.caption}`);

  const der = renderSTL(DERIVED_STL, { out: path.join(TMP, 'out', 'derived.png'), caption: true, dryRun: true });
  check('a derived render is marked UNMEASURED in its filename',
    f(path.basename(der.planned_png ?? '').split('.').includes(UNMEASURED_MARKER),
      !path.basename(der.planned_png ?? '').split('.').includes(UNMEASURED_MARKER)),
    path.basename(der.planned_png ?? ''));

  // The invariant stated as one predicate over every kind, so a new kind added later cannot slip through
  // an unmarked path just because nobody wrote a test for it by name.
  const unmarkedButNotMeasured = [MEASURED_STL, DEPICTED_STL, DERIVED_STL, UNSTAMPED_STL].filter(p => {
    const v = classify(readSTLProvenance(p));
    const r = renderSTL(p, { out: path.join(TMP, 'out', `${path.basename(p)}.png`), caption: true, dryRun: true });
    const marked = path.basename(r.planned_png ?? '').split('.').some(s => s === v.marker);
    return !v.measured && !marked;
  });
  check('INVARIANT: no non-measured fixture is planned as an unmarked image',
    f(unmarkedButNotMeasured.length === 0, unmarkedButNotMeasured.length !== 0),
    unmarkedButNotMeasured.map(p => path.basename(p)).join(', '));

  check('captionFor always says NOT A MEASUREMENT for every non-measured kind',
    f(['depicted','assumed','derived','not-established'].every(k => {
        const prov = { ...readSTLProvenance(DERIVED_STL), kind: k, stamped: true, marker_in_header: false, marker_in_filename: false };
        return /NOT A MEASUREMENT/.test(captionFor(prov, classify(prov)).caption);
      }),
      !['depicted','assumed','derived','not-established'].every(k => {
        const prov = { ...readSTLProvenance(DERIVED_STL), kind: k, stamped: true, marker_in_header: false, marker_in_filename: false };
        return /NOT A MEASUREMENT/.test(captionFor(prov, classify(prov)).caption);
      })));
}

// ===================================================================================================
console.log('\n7. a real render  -  needs Blender');
// ===================================================================================================
const avail = availability();
if (!avail.ok) {
  skip(`no live render: ${avail.reason}`);
  skip('no live render: the PNG, caption-in-pixels and marker-on-disk assertions did not run');
} else {
  console.log(`  (Blender ${avail.blender.version} at ${avail.blender.exe})`);
  console.log(`  (pipeline ${PIPELINE_PATH})`);
  const SMALL = { engine: 'CYCLES', width: 320, height: 240, samples: 4 };
  let uncaptionedBottom = null;   // measured on the measured render, compared against on the depicted one

  // --- measured: a real image, and NO marker anywhere -----------------------------------------------
  const mOut = path.join(TMP, 'out', 'live-measured.png');
  if (fs.existsSync(mOut)) fs.unlinkSync(mOut);
  const t0 = Date.now();
  const m = renderSTL(MEASURED_STL, { out: mOut, ...SMALL });
  const mMs = Date.now() - t0;

  check('a measured STL renders without error',
    f(m.error === null && m.png !== null, !(m.error === null && m.png !== null)), `error = ${m.error}`);
  if (!m.png) {
    skip('the measured render produced no PNG, so its pixel assertions did not run');
  } else {
    const png = readPNG(m.png, { pixels: true });
    check('the output is a PNG by its 8-byte signature',
      f(png.sig_ok === true, png.sig_ok !== true), `first bytes were not ${PNG_SIG.toString('hex')}`);
    check('it is not a trivial stub: well over 10 kB',
      f(png.bytes > 10_000, !(png.bytes > 10_000)), `${png.bytes} B`);
    check('it ends with IEND, so it is a complete file and not a truncated write',
      f(png.iend === true, png.iend !== true));
    check('its IHDR matches the resolution that was asked for',
      f(png.width === SMALL.width && png.height === SMALL.height,
        !(png.width === SMALL.width && png.height === SMALL.height)), `${png.width}x${png.height}`);
    check('the file on disk is the one the result named',
      f(fs.existsSync(m.png) && path.resolve(m.png) === path.resolve(mOut),
        !(fs.existsSync(m.png) && path.resolve(m.png) === path.resolve(mOut))), m.png);
    check('MEASURED geometry: the filename carries no marker',
      f(!path.basename(m.png).includes(DEPICTION_MARKER) && !path.basename(m.png).includes(UNMEASURED_MARKER),
        !(!path.basename(m.png).includes(DEPICTION_MARKER) && !path.basename(m.png).includes(UNMEASURED_MARKER))),
      path.basename(m.png));
    check('and the pipeline confirms it burned in no caption',
      f(m.result?.captioned === false, m.result?.captioned !== false), `captioned = ${m.result?.captioned}`);

    if (!png.rgba) skip('pixels could not be decoded, so the "no dark band" assertion did not run');
    else {
      uncaptionedBottom = bandLuma(png, 0.92, 1.0);
      check('an UNCAPTIONED render has no dark bar across the bottom of the frame',
        f(uncaptionedBottom > 200, !(uncaptionedBottom > 200)),
        `bottom luma ${uncaptionedBottom.toFixed(1)} (want > 200)`);
    }
  }

  // --- depicted: the caption must be IN THE PIXELS --------------------------------------------------
  const dOut = path.join(TMP, 'out', 'live-depicted.png');
  const dPlanned = markerFilename(dOut, DEPICTION_MARKER);
  if (fs.existsSync(dPlanned)) fs.unlinkSync(dPlanned);
  const t1 = Date.now();
  const d = renderSTL(DEPICTED_STL, { out: dOut, caption: true, ...SMALL });
  const dMs = Date.now() - t1;

  check('a depicted STL renders once the caption is consented to',
    f(d.error === null && d.png !== null, !(d.error === null && d.png !== null)), `error = ${d.error}`);
  if (!d.png) {
    skip('the depicted render produced no PNG, so its pixel assertions did not run');
  } else {
    const png = readPNG(d.png, { pixels: true });
    check('it too is a valid PNG by signature',
      f(png.sig_ok === true, png.sig_ok !== true));
    check('and is a non-trivial image',
      f(png.bytes > 10_000, !(png.bytes > 10_000)), `${png.bytes} B`);
    check('THE FILE ON DISK keeps the DEPICTION marker, not just the returned object',
      f(path.basename(d.png).split('.').includes(DEPICTION_MARKER),
        !path.basename(d.png).split('.').includes(DEPICTION_MARKER)), path.basename(d.png));
    check('the marker survived even though the caller asked for "live-depicted.png"',
      f(fs.existsSync(dPlanned) && !fs.existsSync(dOut),
        !(fs.existsSync(dPlanned) && !fs.existsSync(dOut))),
      `${path.basename(dPlanned)} exists=${fs.existsSync(dPlanned)}; unmarked exists=${fs.existsSync(dOut)}`);
    check('the pipeline reports that it burned the caption in',
      f(d.result?.captioned === true, d.result?.captioned !== true));

    if (!png.rgba) skip('pixels could not be decoded, so the caption-in-pixels assertion did not run');
    else {
      const bottom = bandLuma(png, 0.92, 1.0), middle = bandLuma(png, 0.35, 0.55);
      // THE assertion. Everything else in this file checks a string, a filename or a JSON field, all of
      // which would still pass if the Blender script quietly dropped the caption. This one looks at the
      // image. The bottom band must be the dark caption bar, which also proves the bar reaches the
      // bottom EDGE: it stopped an eighth of a frame short once, leaving a bright strip underneath where
      // a reader checking for a caption would look.
      check('THE CAPTION IS IN THE PIXELS: a dark bar occupies the bottom of the frame, to the edge',
        f(bottom < 150, !(bottom < 150)), `bottom luma ${bottom.toFixed(1)} (want < 150)`);
      check('and the rest of the frame is NOT dark, so the bar is a bar and not a black render',
        f(middle > 120, !(middle > 120)), `middle luma ${middle.toFixed(1)}`);
      if (uncaptionedBottom === null) skip('no uncaptioned render to compare against');
      else {
        const gap = uncaptionedBottom - bottom;
        check('the captioned image differs from the uncaptioned one exactly where the caption goes',
          f(gap > 80, !(gap > 80)),
          `uncaptioned bottom ${uncaptionedBottom.toFixed(1)}, captioned ${bottom.toFixed(1)}, gap ${gap.toFixed(1)} (want > 80)`);
      }
    }
  }

  console.log(`  (measured render ${(mMs / 1000).toFixed(1)} s, depicted render ${(dMs / 1000).toFixed(1)} s,`
    + ` ${SMALL.width}x${SMALL.height} @ ${SMALL.samples} samples, ${SMALL.engine})`);
}

// ---------------------------------------------------------------------------------------------------
console.log(`\nfixtures in ${TMP}`);
console.log(`${pass} passed, ${fail} failed${skipped ? `, ${skipped} skipped` : ''}`);
if (FAULT && pass > 0) console.log(`SURVIVORS: ${pass} assertion(s) passed WITH the fault injected. Those tests test nothing. Fix them.`);
process.exit(fail && !FAULT ? 1 : 0);
