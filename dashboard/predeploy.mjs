#!/usr/bin/env node
/* predeploy.mjs - run EVERY generator the deployed site depends on, then prove nothing is stale.
 *
 * Why this exists: the page copy of the Lean checker (dashboard/public/blueprint3d/browser-check.mjs)
 * is written by build-graph.mjs, but it goes stale every time the law registry cuts a new lawset -
 * which is a different thread's action. Twice tonight the Studio shipped a checker that did not know
 * the current lawset, so every row judged 'unknown-lawset' and the pages evaluated NO LAW AT ALL,
 * silently. Remembering to re-run a generator is not a control. This is.
 *
 *   node dashboard/predeploy.mjs            # regenerate, then verify
 *   node dashboard/predeploy.mjs --check    # verify only, exit 1 if stale
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const run = (f, args = []) => execFileSync(process.execPath, [join(ROOT, f), ...args], { cwd: ROOT, stdio: 'pipe' });

const GENERATORS = ['dashboard/build-lean-api.mjs', 'dashboard/build-graph.mjs', 'dashboard/build-engine.mjs', 'dashboard/build-results.mjs', 'dashboard/build-shell.mjs'];

if (!CHECK) for (const g of GENERATORS) { process.stdout.write(`  ${g} ... `); try { run(g); console.log('ok'); } catch (e) { console.log('FAILED'); console.error(String(e.stdout || e.message).slice(-600)); process.exit(1); } }

// The one invariant that actually bit us: the page's checker must be byte-identical to the generated one.
const a = readFileSync(join(ROOT, 'lean/eliminate/browser-check.mjs'));
const b = readFileSync(join(ROOT, 'dashboard/public/blueprint3d/browser-check.mjs'));
if (!a.equals(b)) { console.error('STALE: dashboard/public/blueprint3d/browser-check.mjs differs from lean/eliminate/browser-check.mjs.\n  Pages importing it would judge every row unknown-lawset. Fix: node dashboard/build-graph.mjs'); process.exit(1); }

try { run('lean/registry/check-exposed.mjs'); } catch (e) { console.error('check-exposed FAILED:\n' + String(e.stdout || e.message).slice(-1200)); process.exit(1); }
console.log('predeploy ok: generators run, page checker matches the generated one, check-exposed green');
