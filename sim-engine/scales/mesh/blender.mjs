// Finding Blender, building an illustration mesh with it, and keeping the meshes folder tidy.
//
//   findBlender()            -> {path, version} | null      never spawns anything
//   buildMesh(spec, opts)    -> {status, glb, manifest, why, seconds}
//   blenderWhyNot(env)       -> why findBlender() found nothing, in words that name the actual cause
//   pruneMeshes(keep, {frames}) -> [removed file names]    only files of the frames THIS invocation built
//   wantMeshes(argv, env)    -> boolean                       the --meshes / DELPHI_MESH rule, in one place
//   meshField(ladder, opts)  -> the `ladder.mesh` block a bundle carries
//
// NO SIDE EFFECTS UNLESS ASKED. Nothing here launches Blender unless a caller passes want/force, and
// build.mjs only does that with --meshes or DELPHI_MESH=1. The test suite proves it with a sentinel.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { meshSpec, specHash, meshStem, SCULPTED } from './spec.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const ROOT = path.resolve(HERE, '..', '..', '..');
export const MESH_DIR = path.join(ROOT, 'dashboard', 'public', 'blueprint3d', 'studio-live', 'meshes');
export const BUILD_PY = path.join(HERE, 'build_mesh.py');
/** A file this generator wrote: <frame>-<12 hex>.glb or .json. Nothing else in meshes/ is ever pruned. */
export const GENERATED = /^(insect|tetrapod|prokaryote|construct|teleost|unknown)-[0-9a-f]{12}\.(glb|json)$/;

/** --meshes, or DELPHI_MESH=1. DELPHI_MESH=0 always wins, so a caller can switch it off under a flag. */
export function wantMeshes(argv = process.argv, env = process.env) {
  if (env.DELPHI_MESH === '0') return false;
  return argv.includes('--meshes') || env.DELPHI_MESH === '1';
}

function versionFromPath(p) {
  const m = /blender[-_ ]?(\d+\.\d+(?:\.\d+)?)/i.exec(p.replace(/\\/g, '/')) ?? /Blender Foundation\/Blender (\d+\.\d+)/i.exec(p.replace(/\\/g, '/'));
  return m ? m[1] : null;
}

function candidates() {
  const out = [];
  const exe = process.platform === 'win32' ? ['blender.exe'] : ['blender'];
  for (const d of String(process.env.PATH ?? '').split(path.delimiter).filter(Boolean)) for (const e of exe) out.push(path.join(d, e));
  const globDirs = [
    ['C:/Temp/tools/blender', 'blender.exe'],
    ['C:/Program Files/Blender Foundation', 'blender.exe'],
  ];
  for (const [base, e] of globDirs) {
    try { for (const d of fs.readdirSync(base).sort().reverse()) out.push(path.join(base, d, e)); } catch {}
  }
  out.push('/Applications/Blender.app/Contents/MacOS/Blender', '/usr/bin/blender', '/usr/local/bin/blender', '/snap/bin/blender');
  return out;
}

/**
 * Where Blender is, without running it. DELPHI_BLENDER wins ('none' disables); then PATH; then known
 * install dirs. A DELPHI_BLENDER ending in .mjs/.js is run with node -- that is for wrappers and for the
 * test sentinel, never a real Blender.
 */
export function findBlender(env = process.env) {
  const forced = env.DELPHI_BLENDER;
  if (forced === 'none') return null;
  if (forced) return isFile(forced) ? { path: forced, version: versionFromPath(forced) ?? 'unknown', from: 'DELPHI_BLENDER' } : null;
  for (const c of candidates()) {
    try { if (fs.statSync(c).isFile()) return { path: c, version: versionFromPath(c) ?? 'unknown', from: 'search' }; } catch {}
  }
  return null;
}

function isFile(p) { try { return fs.statSync(p).isFile(); } catch { return false; } }

/**
 * Why findBlender() returned null, naming the real cause. A DELPHI_BLENDER that points at a file that is not
 * there is a typo or a moved install, and "set DELPHI_BLENDER" would tell the person to do what they already did.
 */
export function blenderWhyNot(env = process.env) {
  const forced = env.DELPHI_BLENDER;
  if (forced === 'none') return 'Blender is switched off: DELPHI_BLENDER=none';
  if (forced) {
    let st = null;
    try { st = fs.statSync(forced); } catch {}
    if (!st) return `DELPHI_BLENDER points at ${forced}, and no file exists there (fix the path, or unset DELPHI_BLENDER to search PATH and the usual install folders)`;
    if (!st.isFile()) return `DELPHI_BLENDER points at ${forced}, which is a folder, not the Blender executable (point it at blender${process.platform === 'win32' ? '.exe' : ''} inside it)`;
  }
  return 'Blender not found on PATH, in C:/Temp/tools/blender/*/, in C:/Program Files/Blender Foundation/*/ or the usual macOS/Linux install paths (set DELPHI_BLENDER to the blender executable, or put blender on PATH)';
}

const tail = s => String(s ?? '').split(/\r?\n/).filter(l => l.trim()).slice(-12).join('\n').slice(-1500);

/**
 * Build one GLB + manifest for a spec, or report why not. Cache hit when the GLB already exists.
 * @param {object} spec  from meshSpec()
 * @param {{force?:boolean, blender?:object|null, outDir?:string, timeoutMs?:number}} opts
 */
export function buildMesh(spec, { force = false, blender, outDir = MESH_DIR, timeoutMs = 600000 } = {}) {
  const t0 = Date.now();
  const stem = meshStem(spec);
  const glb = path.join(outDir, `${stem}.glb`), manifest = path.join(outDir, `${stem}.json`);
  const rel = { glb: `meshes/${stem}.glb`, manifest: `meshes/${stem}.json` };
  const done = (status, why = null) => ({ status, ...rel, why, seconds: Math.round((Date.now() - t0) / 100) / 10, hash: specHash(spec) });
  if (!spec.sculpted) return done('not-requested', `the ${spec.frame} frame has no sculptor (sim-engine/scales/mesh/frames/${spec.frame}.py), so there is nothing to build`);
  if (!force && fs.existsSync(glb) && fs.existsSync(manifest)) return done('cached');
  const b = blender === undefined ? findBlender() : blender;
  if (!b) return done('no-blender', blenderWhyNot());
  fs.mkdirSync(outDir, { recursive: true });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delphi-mesh-'));
  const specFile = path.join(tmpDir, 'spec.json');
  fs.writeFileSync(specFile, JSON.stringify({ ...spec, hash: specHash(spec) }, null, 1));
  const tmpGlb = path.join(outDir, `.${stem}.${process.pid}.tmp.glb`);
  const tmpMan = tmpGlb.replace(/\.glb$/, '.json');
  const isNode = /\.(mjs|js)$/i.test(b.path);
  const cmd = isNode ? process.execPath : b.path;
  const args = [...(isNode ? [b.path] : []), '-b', '--factory-startup', '--python-exit-code', '3', '--python', BUILD_PY, '--', specFile, tmpGlb];
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  const cleanup = () => { for (const f of [tmpGlb, tmpMan]) try { fs.unlinkSync(f); } catch {} };
  if (r.error) { cleanup(); return done('failed', `could not run ${b.path}: ${r.error.message}`); }
  if (r.status !== 0 || !fs.existsSync(tmpGlb) || !fs.existsSync(tmpMan)) {
    cleanup();
    const err = /Traceback[\s\S]*$/.exec(r.stdout ?? '')?.[0] ?? `${r.stderr ?? ''}${r.stdout ?? ''}`;
    return done('failed', `blender exited ${r.status}${r.signal ? ` (${r.signal})` : ''}: ${tail(err)}`);
  }
  fs.renameSync(tmpGlb, glb);
  fs.renameSync(tmpMan, manifest);
  return done('built');
}

/**
 * Remove generated meshes that no bundle references, for the FRAMES this invocation built or reused only.
 *
 * Only <frame>-<hash>.{glb,json} names of a frame listed in `frames` are touched; `keep` is every GLB/manifest
 * that any bundle on disk references AFTER this invocation wrote its own. Building one run therefore never
 * deletes another frame's meshes (which a bundle about to be rebuilt elsewhere may need), and with no `frames`
 * nothing at all is removed.
 * @param {Iterable<string>} keep    file names (or paths) to keep
 * @param {{frames?: Iterable<string>, dir?: string}} opts
 */
export function pruneMeshes(keep, { frames = [], dir = MESH_DIR } = {}) {
  const removed = [];
  const own = new Set(frames);
  if (!own.size || !fs.existsSync(dir)) return removed;
  const k = new Set([...keep].map(f => path.basename(f)));
  for (const f of fs.readdirSync(dir)) {
    if (!GENERATED.test(f) || k.has(f) || !own.has(f.split('-')[0])) continue;
    fs.unlinkSync(path.join(dir, f)); removed.push(f);
  }
  return removed;
}

/** The frames whose mesh this process built or reused (from meshField's `built` map): the only ones it may prune. */
export function framesTouched(built) {
  const out = new Set();
  for (const [stem, { r }] of built ?? []) if (r && ['built', 'cached'].includes(r.status)) out.add(stem.split('-')[0]);
  return out;
}

/**
 * The `ladder.mesh` block. With want=false nothing is spawned: the spec and hash are still computed so the
 * page can find a GLB that already exists, and status is 'not-requested'.
 */
export function meshField(ladder, { want = false, force = false, blender, outDir = MESH_DIR, built = new Map() } = {}) {
  const spec = meshSpec(ladder);
  const hash = spec.sculpted ? specHash(spec) : null;
  const base = { frame: spec.frame, hash, stages: spec.stages.map(s => s.key), stage_labels: spec.stages.map(s => s.label),
    stage_of_point: spec.stage_of_point, generator_version: spec.generator_version, geometry_basis: 'schematic-illustration',
    driver_notes: spec.driver_notes, notes: spec.notes };
  if (!spec.sculpted) return { ...base, glb: null, manifest: null, status: 'not-requested', blender: null,
    why: `the ${spec.frame} frame has no sculptor, so this body is drawn only as the schematic` };
  if (!(ladder?.parts ?? []).length) return { ...base, glb: null, manifest: null, status: 'not-requested', blender: null,
    why: 'this generation has no body (no blueprint, so no parts): there is nothing to illustrate' };
  const stem = meshStem(spec);
  const rel = { glb: `meshes/${stem}.glb`, manifest: `meshes/${stem}.json` };
  const exists = fs.existsSync(path.join(outDir, `${stem}.glb`));
  if (!want) return { ...base, ...rel, exists, status: 'not-requested', blender: null,
    why: exists ? 'meshes were not requested for this build (--meshes or DELPHI_MESH=1); an earlier build of the same spec exists and is used'
      : 'meshes were not requested for this build (--meshes or DELPHI_MESH=1) and none exists for this spec' };
  // One build per spec per process, so five generations sharing a mesh spawn Blender at most once.
  if (!built.has(stem)) {
    const b = blender === undefined ? findBlender() : blender;
    built.set(stem, { r: buildMesh(spec, { force, blender: b, outDir }), blender: b });
  }
  const { r, blender: b } = built.get(stem);
  return { ...base, ...rel, exists: fs.existsSync(path.join(outDir, `${stem}.glb`)), status: r.status, why: r.why,
    seconds: r.seconds, blender: b ? { version: b.version, from: b.from } : null };
}

export { SCULPTED };
