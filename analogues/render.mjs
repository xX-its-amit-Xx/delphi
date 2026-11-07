#!/usr/bin/env node
// STL -> publication-quality still, with the provenance that an image would otherwise launder.
//
//   import { findBlender, available, renderSTL } from './analogues/render.mjs';
//   node analogues/render.mjs <in.stl> [out.png] [--engine CYCLES] [--caption] [--samples 64]
//
// ============================== WHAT THIS FILE IS GUARDING ==============================
// organism-format/life/stl.mjs will not export a mesh whose geometry provenance is `assumed` or
// `depicted` unless the caller types `allowDepicted: true` at the call site. When it does export one, it
// spends the STL's entire metadata budget - an 80-byte header and a filename - on saying so.
//
// A render is where that budget gets spent to zero. Three-point lighting, a soft ground shadow and a
// neutral backdrop are the visual grammar of a photograph, and a photograph of sphere-packed geometry
// reads as a micrograph. The 80-byte header does not survive into a PNG. The filename survives only until
// somebody drags the image into a slide. So this driver does three things stl.mjs cannot do for it:
//
//   1. it READS the provenance back out of the STL header rather than trusting the caller or the filename,
//   2. it REFUSES, exactly as exportStage refuses, to render gated geometry unless the caller asks for a
//      captioned depiction, and
//   3. when it does render one, it puts the words INSIDE THE FRAME and keeps the marker in the filename.
//
// The rule that follows from those, and the one worth stating on its own line:
//
//   AN IMAGE WITH NO PROVENANCE MARKER MAY ONLY BE PRODUCED FROM MEASURED GEOMETRY.
//
// Not from `derived`, not from `not-established`, and not from an STL this file cannot read a provenance
// out of at all. `derived` and `not-established` are not in GATED_KINDS, so they are not REFUSED - but
// they are not measurements either, so they are captioned and marked. Those are two different decisions
// and collapsing them is how an unmarked picture of a guess gets made.
//
// ============================== WHERE THE GATE LIVES ==============================
// GATED_KINDS and DEPICTION_MARKER are IMPORTED from stl.mjs, not restated here. A second copy of the
// gate would be a copy that drifts, and the drift would be silent and in the permissive direction: the
// exporter would tighten, this file would not, and the renders would keep coming out unmarked.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { GATED_KINDS, DEPICTION_MARKER, STL_FORMAT } from '../organism-format/life/stl.mjs';

export { GATED_KINDS, DEPICTION_MARKER };

/** The only two provenance kinds that may leave as an UNMARKED image. Everything else - derived,
 *  not-established, assumed, depicted, or an STL with no readable stamp - gets the caption. */
export const MEASURED_KINDS = Object.freeze(['measured', 'measured-secondhand']);

/** Filename marker for a non-measured kind that is not gated. Distinct from DEPICTION_MARKER because the
 *  two say different things: DEPICTION means "somebody drew this", UNMEASURED means "this came out of a
 *  rule and the rule is in the .life, not in this picture". */
export const UNMEASURED_MARKER = 'UNMEASURED';
/** Marker for an STL whose 80-byte header carries no provenance at all. */
export const UNSTAMPED_MARKER = 'UNSTAMPED';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** The Blender-side script. Deliberately NOT in this repo: it is a 400-line Blender-API program that only
 *  runs inside blender.exe, and a file in the repo that the repo's own runtime cannot execute is a file
 *  that rots untested. Overridable so a different box can put it elsewhere. */
export const PIPELINE_PATH = process.env.DELPHI_RENDER_PIPELINE
  || 'C:\\Temp\\blender-pipeline\\render_organism.py';

/** Where a "this engine does not work on this box" answer is remembered, so the second render does not
 *  repeat the first one's 18-second crash. */
const PROBE_CACHE = process.env.DELPHI_RENDER_PROBE_CACHE
  || path.join(path.dirname(PIPELINE_PATH), 'engine-probe.json');

// ---------------------------------------------------------------------------------------------------
// FINDING BLENDER
// ---------------------------------------------------------------------------------------------------

/** Every place worth looking, in order, with a label so the failure message can say what was tried.
 *  A `*` in a path means "one level of subdirectory", which is how a portable Blender ZIP unpacks
 *  (blender-4.2.23-windows-x64/blender.exe). */
export const BLENDER_SEARCH_PATHS = Object.freeze([
  ['$BLENDER_EXE', () => process.env.BLENDER_EXE || null],
  ['C:\\Temp\\blender', () => 'C:\\Temp\\blender\\blender.exe'],
  ['C:\\Temp\\blender\\*', () => 'C:\\Temp\\blender\\*\\blender.exe'],
  ['C:\\Temp\\tools\\blender\\*', () => 'C:\\Temp\\tools\\blender\\*\\blender.exe'],
  ['C:\\Program Files\\Blender Foundation\\*', () => 'C:\\Program Files\\Blender Foundation\\*\\blender.exe'],
  ['PATH', () => null],   // handled separately: `where blender`
]);

function expandStar(pattern) {
  const i = pattern.indexOf('*');
  if (i < 0) return fs.existsSync(pattern) ? [pattern] : [];
  const base = pattern.slice(0, i).replace(/[\\/]$/, '');
  const tail = pattern.slice(i + 1).replace(/^[\\/]/, '');
  let entries;
  try {
    entries = fs.readdirSync(base, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter(d => d.isDirectory())
    .map(d => path.join(base, d.name, tail))
    .filter(p => fs.existsSync(p))
    .sort()
    .reverse();                       // newest-looking version first, e.g. 4.2.23 before 4.2.9
}

function onPath() {
  const probe = process.platform === 'win32' ? 'where' : 'which';
  const r = spawnSync(probe, ['blender'], { encoding: 'utf8' });
  if (r.status !== 0 || !r.stdout) return [];
  return r.stdout.split(/\r?\n/).map(s => s.trim()).filter(s => s && fs.existsSync(s));
}

let _blenderCache;

/**
 * Locate blender.exe. NEVER THROWS, and never returns a bare null: a caller that cannot render needs to
 * know why, because "Blender is missing" and "Blender is there but the pipeline script is not" are
 * different problems with different fixes and an exception flattens them into a stack trace.
 *
 * `paths` overrides where to look. It exists so the ABSENT case is testable: on a box that has Blender
 * installed there is otherwise no way to exercise the branch that matters most, and a null-returning
 * branch nobody has ever run is a branch that throws the first time it is needed. A custom search list is
 * never cached, so a test cannot poison the real answer for the rest of the process.
 *
 * @param {{refresh?: boolean, paths?: Array<[string, () => string|null]>}} [opts]
 * @returns {{exe: string|null, version: string|null, source: string|null, reason: string|null,
 *            searched: string[]}}
 */
export function findBlender({ refresh = false, paths = null } = {}) {
  const custom = Array.isArray(paths);
  if (_blenderCache && !refresh && !custom) return _blenderCache;
  const searched = [];
  let found = null, source = null;

  for (const [label, make] of (custom ? paths : BLENDER_SEARCH_PATHS)) {
    searched.push(label);
    let hits = [];
    try {
      if (label === 'PATH') hits = onPath();
      else {
        const pattern = make();
        hits = pattern ? expandStar(pattern) : [];
      }
    } catch (e) {
      continue;                        // an unreadable directory is not a reason to stop looking
    }
    if (hits.length) { found = hits[0]; source = label; break; }
  }

  if (!found) {
    const miss = {
      exe: null, version: null, source: null, searched,
      reason: `no blender.exe found. Looked in: ${searched.join(', ')}. Install a portable Blender ZIP `
        + `from download.blender.org under C:\\Temp\\blender\\, or set $BLENDER_EXE.`,
    };
    if (!custom) _blenderCache = miss;
    return miss;
  }

  let version = null, reason = null;
  const r = spawnSync(found, ['--background', '--version'], { encoding: 'utf8', timeout: 120_000 });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const m = out.match(/Blender\s+(\d+\.\d+\.\d+[^\s(]*)/);
  if (m) version = m[1];
  else reason = `found ${found} but \`--background --version\` did not identify itself`
    + `${r.error ? ` (${r.error.message})` : ''}. Output began: ${out.slice(0, 180).trim() || '(nothing)'}`;

  const hit = { exe: version ? found : null, version, source, searched, reason };
  if (!custom) _blenderCache = hit;
  return hit;
}

/**
 * Can anything be rendered at all? Callers use this to DEGRADE - skip the figure, keep the run - rather
 * than crash. It is deliberately a plain boolean; `availability()` carries the detail.
 */
export function available() {
  return availability().ok;
}

/** The same question with the reasons attached. Both halves must hold: an executable AND the pipeline. */
export function availability() {
  const b = findBlender();
  const pipeline = fs.existsSync(PIPELINE_PATH);
  if (!b.exe) return { ok: false, reason: b.reason, blender: b, pipeline };
  if (!pipeline) {
    return {
      ok: false, blender: b, pipeline,
      reason: `Blender ${b.version} is at ${b.exe}, but the render pipeline is missing: `
        + `${PIPELINE_PATH} does not exist. Set $DELPHI_RENDER_PIPELINE if it lives elsewhere.`,
    };
  }
  return { ok: true, reason: null, blender: b, pipeline };
}

// ---------------------------------------------------------------------------------------------------
// READING THE PROVENANCE BACK OUT OF THE BYTES
// ---------------------------------------------------------------------------------------------------

/**
 * Parse the 80-byte header stl.mjs wrote, plus the triangle count, straight from the file.
 *
 * The header is read rather than the filename TRUSTED, because a filename is the one piece of this that a
 * human can change by accident. The filename is still consulted - a `.DEPICTION.` in it is honoured even
 * if the header has been lost - so the two signals can only ever make the result stricter, never laxer.
 *
 * @returns {{ok: boolean, error: string|null, header: string|null, kind: string|null, stage: string|null,
 *            units: string|null, triangles: number|null, marker_in_header: boolean,
 *            marker_in_filename: boolean, stamped: boolean, is_life_stl: boolean}}
 */
export function readSTLProvenance(stlPath) {
  const empty = {
    ok: false, error: null, path: stlPath, header: null, kind: null, stage: null, units: null,
    triangles: null, marker_in_header: false, marker_in_filename: false, stamped: false, is_life_stl: false,
  };
  const marker_in_filename = path.basename(String(stlPath || '')).includes(`.${DEPICTION_MARKER}.`);

  let fd;
  try {
    const stat = fs.statSync(stlPath);
    if (stat.size < 84) {
      return { ...empty, marker_in_filename, error: `${stlPath} is ${stat.size} bytes: too short to be a binary STL (84 byte minimum).` };
    }
    fd = fs.openSync(stlPath, 'r');
    const head = Buffer.alloc(84);
    fs.readSync(fd, head, 0, 84, 0);
    const header = head.subarray(0, 80).toString('latin1').replace(/\0+$/, '').trimEnd();
    const triangles = head.readUInt32LE(80);
    const kind = (header.match(/\bprovenance=([^\s]+)/) || [])[1] ?? null;
    const stage = (header.match(/\bstage=([^\s]+)/) || [])[1] ?? null;
    const units = (header.match(/\bunits=([^\s]+)/) || [])[1] ?? null;
    return {
      ...empty, ok: true, header, kind, stage,
      units: units === 'UNSTATED' ? null : units,
      triangles,
      marker_in_header: header.includes(DEPICTION_MARKER),
      marker_in_filename,
      stamped: kind !== null,
      is_life_stl: header.startsWith(STL_FORMAT.split('/')[0]),
    };
  } catch (e) {
    return { ...empty, marker_in_filename, error: `cannot read ${stlPath}: ${e.message}` };
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch { /* already gone */ }
  }
}

/**
 * Turn a parsed header into the three decisions this module exists to make: is it measured, must the
 * image be marked, and must the render be refused outright without an explicit ask.
 *
 * `gated` mirrors stl.mjs exactly (GATED_KINDS). `requires_marker` is BROADER than `gated` on purpose -
 * see the rule in the file header. An unstamped STL is treated as refusable, because the one thing worse
 * than rendering a depiction is rendering something whose provenance nobody can establish and saying
 * nothing at all.
 */
export function classify(prov) {
  const kind = prov?.kind ?? null;
  const measured = MEASURED_KINDS.includes(kind);
  const gated = GATED_KINDS.includes(kind);
  const marked_already = Boolean(prov?.marker_in_header || prov?.marker_in_filename);
  const requires_marker = !measured || marked_already;
  const marker = (gated || marked_already) ? DEPICTION_MARKER
    : (!prov?.stamped ? UNSTAMPED_MARKER : (measured ? null : UNMEASURED_MARKER));
  return {
    kind, measured, gated, requires_marker, marker,
    refusable: gated || !prov?.stamped || marked_already,
    why: measured && !marked_already
      ? `geometry provenance is "${kind}", a measurement: an unmarked render is allowed.`
      : !prov?.stamped
        ? 'this STL carries no provenance in its 80-byte header, so nothing can vouch for the geometry.'
        : `geometry provenance is "${kind}", which is not a measurement.`,
  };
}

/** Splice `marker` into a filename before its extension, idempotently. `out/x.png` -> `out/x.DEPICTION.png`.
 *  Pure and exported so the marker rule can be tested on a box with no Blender on it. */
export function markerFilename(outPath, marker) {
  if (!marker) return outPath;
  const dir = path.dirname(outPath);
  const ext = path.extname(outPath);
  const base = path.basename(outPath, ext);
  if (base.split('.').includes(marker)) return outPath;
  return path.join(dir, `${base}.${marker}${ext}`);
}

/** The words that go in the frame. Built from the header, never from the caller, so a caption cannot be
 *  softened by whoever is making the figure. A caller may ADD a line; it cannot replace this one. */
export function captionFor(prov, verdict) {
  const src = path.basename(prov?.path || 'unknown.stl');
  if (verdict.gated || verdict.marker === DEPICTION_MARKER) {
    return {
      caption: `${DEPICTION_MARKER} - geometry provenance: ${verdict.kind ?? 'unknown'} - NOT A MEASUREMENT`,
      note: `${src}: one sphere per cell. Cell shape is drawn, not measured; exposed surface area cannot be read off this surface.`,
    };
  }
  if (!prov?.stamped) {
    return {
      caption: `${UNSTAMPED_MARKER} - this mesh carries no provenance - NOT A MEASUREMENT`,
      note: `${src}: the 80-byte STL header names no source for these coordinates.`,
    };
  }
  return {
    caption: `${UNMEASURED_MARKER} - geometry provenance: ${verdict.kind} - NOT A MEASUREMENT`,
    note: `${src}: these coordinates came from a rule, not an instrument. The rule is in the .life, not in this image.`,
  };
}

// ---------------------------------------------------------------------------------------------------
// ENGINE AVAILABILITY
// ---------------------------------------------------------------------------------------------------

/** EEVEE is a rasteriser: it needs a real GPU and an OpenGL context, which a headless server does not
 *  have. The failure is not an exception, it is an access violation inside blender.exe, so it has to be
 *  recognised from the wreckage. Cycles is a CPU path tracer and does not care. */
const GPU_FAILURE = /EXCEPTION_ACCESS_VIOLATION|No OpenGL vendor|Failed to create .*(GPU|OpenGL)|GPU context|Unable to open a display/i;

function loadProbeCache() {
  try { return JSON.parse(fs.readFileSync(PROBE_CACHE, 'utf8')); } catch { return {}; }
}
function saveProbeCache(cache) {
  try {
    fs.mkdirSync(path.dirname(PROBE_CACHE), { recursive: true });
    fs.writeFileSync(PROBE_CACHE, JSON.stringify(cache, null, 2));
  } catch { /* a cache that cannot be written just costs time, never correctness */ }
}
function engineKnownBad(version, engine) {
  return loadProbeCache()?.[version || 'unknown']?.[engine] ?? null;
}
function rememberEngineBad(version, engine, reason) {
  const cache = loadProbeCache();
  (cache[version || 'unknown'] ||= {})[engine] = { ok: false, reason, at: new Date().toISOString() };
  saveProbeCache(cache);
}

// ---------------------------------------------------------------------------------------------------
// THE RENDER
// ---------------------------------------------------------------------------------------------------

function runPipeline(exe, args, timeoutMs) {
  const r = spawnSync(exe, args, { encoding: 'utf8', timeout: timeoutMs, windowsHide: true });
  const stdout = r.stdout || '';
  const stderr = r.stderr || '';
  const line = stdout.split(/\r?\n/).find(l => l.startsWith('RENDER_JSON '));
  let json = null;
  if (line) { try { json = JSON.parse(line.slice('RENDER_JSON '.length)); } catch { json = null; } }
  return { r, stdout, stderr, json, combined: `${stdout}\n${stderr}` };
}

/**
 * Render one STL, or refuse to.
 *
 * @param {string} stlPath
 * @param {object} [opts]
 * @param {string}  [opts.out]        PNG path. The marker is spliced in when the geometry needs one.
 * @param {boolean} [opts.caption]    the explicit ask. Required for gated/unstamped geometry. When true,
 *                                    the caption is generated from the header and burned into the frame;
 *                                    it CANNOT be suppressed, only consented to.
 * @param {boolean} [opts.allowDepicted]  synonym for `caption`, matching stl.mjs's flag name.
 * @param {string}  [opts.extraNote]  one more caption line, appended - never replacing the generated one.
 * @param {'EEVEE'|'CYCLES'} [opts.engine]  omit to take the default and allow a recorded fallback.
 * @param {boolean} [opts.dryRun]     answer "what would this produce, and would it be refused" WITHOUT
 *                                    rendering. The refusal, the caption and `planned_png` are all
 *                                    decided before Blender is ever invoked, so a caller - or a test -
 *                                    can check the provenance rules for free, and on a box with no
 *                                    Blender on it at all.
 * @returns {{png: string|null, stdout: string, provenance: object, refused: string|null,
 *            error: string|null, planned_png: string, ...}}
 */
export function renderSTL(stlPath, opts = {}) {
  const {
    out, caption = false, allowDepicted = false, extraNote = null,
    width = 1600, height = 1200, samples = 64, margin = 1.18,
    timeoutMs = 900_000, dryRun = false,
  } = opts;
  const engineExplicit = typeof opts.engine === 'string';
  let engine = engineExplicit ? opts.engine.toUpperCase() : 'EEVEE';

  const prov = readSTLProvenance(stlPath);
  const verdict = classify(prov);
  const consented = Boolean(caption || allowDepicted);

  const base = {
    png: null, stdout: '', stderr: '', refused: null, error: null,
    provenance: { ...prov, ...verdict }, engine_requested: engine, engine: null,
    engine_fallback: null, caption: null, caption_note: null, planned_png: null, result: null,
  };

  if (!prov.ok) return { ...base, error: prov.error };

  // --- the gate, before anything that costs time or needs Blender -----------------------------------
  if (verdict.refusable && !consented) {
    return {
      ...base,
      refused:
        `${verdict.why} A render would look like a photograph of it, and a PNG has no header and no field `
        + `that could say otherwise. Pass { caption: true } to render it anyway; the image will carry a `
        + `burned-in "${verdict.marker}" caption and be named *.${verdict.marker}.png. `
        + `(mirrors organism-format/life/stl.mjs REFUSALS.no_unstamped_mesh)`,
    };
  }

  // --- where it goes, and what it will say ----------------------------------------------------------
  const defaultOut = path.join(
    process.env.DELPHI_RENDER_OUT || path.join(os.tmpdir(), 'delphi-renders'),
    `${path.basename(stlPath).replace(/\.stl$/i, '')}.png`,
  );
  const planned = markerFilename(path.resolve(out || defaultOut), verdict.requires_marker ? verdict.marker : null);
  const texts = verdict.requires_marker ? captionFor(prov, verdict) : { caption: null, note: null };
  const note = [texts.note, extraNote].filter(Boolean).join('  ') || null;
  const withPaths = { ...base, planned_png: planned, caption: texts.caption, caption_note: note };

  // The belt-and-braces check. If this ever fires, a code path has produced an unmarked image of
  // something that was not measured, and that is the one outcome this file exists to prevent.
  if (verdict.requires_marker && !path.basename(planned).split('.').includes(verdict.marker)) {
    return { ...withPaths, error: `internal: ${planned} lost its ${verdict.marker} marker; refusing to render.` };
  }

  if (dryRun) return { ...withPaths, dry_run: true };

  // --- Blender ---------------------------------------------------------------------------------------
  const avail = availability();
  if (!avail.ok) return { ...withPaths, error: avail.reason };

  if (!engineExplicit) {
    const bad = engineKnownBad(avail.blender.version, engine);
    if (bad) {
      withPaths.engine_fallback = { from: engine, to: 'CYCLES', reason: bad.reason, from_cache: true };
      engine = 'CYCLES';
    }
  }

  fs.mkdirSync(path.dirname(planned), { recursive: true });
  const build = eng => {
    const a = [
      '--background', '--factory-startup', '--python', PIPELINE_PATH, '--',
      '--stl', path.resolve(stlPath), '--out', planned, '--engine', eng,
      '--width', String(width), '--height', String(height), '--samples', String(samples),
      '--margin', String(margin),
    ];
    if (texts.caption) {
      a.push('--caption', texts.caption, '--require-caption');
      if (note) a.push('--caption-note', note);
    }
    return a;
  };

  const started = Date.now();
  let run = runPipeline(avail.blender.exe, build(engine), timeoutMs);

  // EEVEE on a box with no GPU does not fail, it dies. Recognise that, and - only when the caller did
  // not pin the engine - fall back to Cycles and SAY SO in the result. A silent substitution would make
  // two figures in the same paper render under different light with nothing recording it.
  if (!run.json && GPU_FAILURE.test(run.combined) && engine !== 'CYCLES') {
    const reason = `${engine} could not start on this machine: no usable GPU/OpenGL context `
      + `(${(run.combined.match(GPU_FAILURE) || ['?'])[0]}). Cycles renders on the CPU and does not need one.`;
    rememberEngineBad(avail.blender.version, engine, reason);
    if (engineExplicit) {
      return { ...withPaths, engine, error: reason, stdout: run.stdout, stderr: run.stderr, ms: Date.now() - started };
    }
    withPaths.engine_fallback = { from: engine, to: 'CYCLES', reason, from_cache: false };
    engine = 'CYCLES';
    run = runPipeline(avail.blender.exe, build(engine), timeoutMs);
  }

  const ms = Date.now() - started;
  if (!run.json) {
    const tail = run.combined.split(/\r?\n/).filter(l => l.trim() && !/libepoxy|ChoosePixelFormat/.test(l)).slice(-6);
    return {
      ...withPaths, engine, ms, stdout: run.stdout, stderr: run.stderr,
      error: `the render pipeline produced no RENDER_JSON (exit ${run.r.status}`
        + `${run.r.error ? `, ${run.r.error.message}` : ''}). Last lines: ${tail.join(' | ') || '(no output)'}`,
    };
  }
  if (!fs.existsSync(run.json.png)) {
    return { ...withPaths, engine, ms, stdout: run.stdout, stderr: run.stderr,
      error: `pipeline reported ${run.json.png} but it is not on disk.` };
  }

  return {
    ...withPaths, engine: run.json.engine, ms,
    png: run.json.png, bytes: run.json.bytes,
    stdout: run.stdout, stderr: run.stderr, result: run.json,
  };
}

// ---------------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------------

function cli(argv) {
  const flags = argv.filter(a => a.startsWith('--'));
  const positional = argv.filter(a => !a.startsWith('--'));
  const valueOf = (name, fallback) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
  };
  const avail = availability();
  if (!positional.length) {
    console.log(`render.mjs - STL to a still, with the provenance kept.\n`);
    console.log(`  usage: node analogues/render.mjs <in.stl> [out.png] [--caption] [--engine CYCLES]`);
    console.log(`                                  [--width 1600] [--height 1200] [--samples 64]\n`);
    console.log(`  available(): ${avail.ok}`);
    console.log(`  ${avail.ok ? `Blender ${avail.blender.version} at ${avail.blender.exe} (via ${avail.blender.source})`
      : avail.reason}`);
    console.log(`  pipeline:    ${PIPELINE_PATH}${avail.pipeline ? '' : '  (MISSING)'}`);
    return 0;
  }

  const [stl, outArg] = positional;
  const engineArg = argv.includes('--engine') ? { engine: valueOf('engine', 'EEVEE') } : {};
  const res = renderSTL(stl, {
    out: outArg,
    caption: flags.includes('--caption'),
    width: Number(valueOf('width', 1600)),
    height: Number(valueOf('height', 1200)),
    samples: Number(valueOf('samples', 64)),
    ...engineArg,
  });

  console.log(`stl:        ${stl}`);
  console.log(`provenance: ${res.provenance.kind ?? '(none in header)'}`
    + `  measured=${res.provenance.measured}  marker=${res.provenance.marker ?? 'none'}`);
  if (res.refused) { console.log(`\nREFUSED: ${res.refused}`); return 2; }
  if (res.error) { console.log(`\nERROR: ${res.error}`); return 1; }
  if (res.engine_fallback) {
    console.log(`fallback:   ${res.engine_fallback.from} -> ${res.engine_fallback.to}: ${res.engine_fallback.reason}`);
  }
  console.log(`engine:     ${res.engine}   ${res.result.resolution.join('x')} @ ${res.result.samples} samples`);
  if (res.caption) console.log(`caption:    ${res.caption}`);
  console.log(`wrote:      ${res.png}  (${res.bytes} B, ${(res.ms / 1000).toFixed(1)} s)`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  process.exit(cli(process.argv.slice(2)));
}
