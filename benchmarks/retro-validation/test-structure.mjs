#!/usr/bin/env node
// Tests for structure.mjs
//
//   node benchmarks/retro-validation/test-structure.mjs [--fail-once]
//
// Five things are checked harder than the rest, because they are the five ways this module could do
// damage rather than merely be wrong.
//
//   1. THE ANALYTIC CASE. An isolated atom's accessible area is 4*pi*r^2 exactly, and that is the only
//      value in this file that is known independently of the code. If sphere sampling, radius handling
//      or the probe addition is wrong, this number moves. It is asserted to a tight tolerance, and the
//      INVARIANCE of the value under a change of sampling density is asserted separately, because a
//      number that is right at 256 points and wrong at 64 is a number computed by accident.
//
//   2. OCCLUSION IS MONOTONE. Bringing a neighbour closer must never increase accessibility. This is
//      the property that a neighbour-list bug breaks, and a neighbour-list bug is invisible in a single
//      area value. Two coincident atoms are checked too: each must be fully buried by the other, which
//      is the limit case the grid can silently skip.
//
//   3. THE AMBIGUITY GATE REFUSES WHAT IT MUST. A sequence with X codes has to come back unusable with
//      an interval, not a point. This is the check that would have caught the error described in
//      THE_REVIEWED_ENTRY_TRAP before it reached a figure, so it is asserted in both directions: the
//      ambiguous sequence is refused AND the clean one is admitted. Only asserting the refusal would
//      pass for a gate that refuses everything.
//
//   4. FIXED-COLUMN PARSING. The PDB fixture is built with coordinates that RUN TOGETHER - a negative
//      x and a four-figure y with no space between them - so a whitespace-splitting parser produces
//      the wrong atom count or the wrong coordinates. A parser tested only on well-spaced lines is
//      untested.
//
//   5. THE HOLDOUT. One clade is a frozen evaluation holdout for this project. The test does not carry
//      its name: it reads the project's own roster at runtime, builds the patterns from that, and scans
//      the module source. The gate is derived from the authority rather than from a list retyped here.
//
// --fail-once injects one fault into every assertion by inverting its predicate or substituting a wrong
// value. Every line must then FAIL. An assertion that survives its own inversion asserts nothing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as S from './structure.mjs';

const FAULT = process.argv.includes('--fail-once');
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`); } };
const f = (real, broken) => (FAULT ? broken : real);
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');

// ------------------------------------------------------------------ 1. the analytic case
console.log('\nthe analytic case - an isolated atom');
{
  const atom = [{ name: 'CA', element: 'C', res: 'ALA', chain: 'A', resi: 1, x: 0, y: 0, z: 0, radius: S.VDW_RADII.C + S.PROBE_RADIUS }];
  const r = S.VDW_RADII.C + S.PROBE_RADIUS;
  const exact = 4 * Math.PI * r * r;
  const got256 = S.atomSasa(atom, { points: 256 })[0];
  const got64 = S.atomSasa(atom, { points: 64 })[0];
  const got1024 = S.atomSasa(atom, { points: 1024 })[0];
  check('isolated carbon area equals 4*pi*(1.70+1.40)^2', near(f(got256, got256 * 1.5), exact, 1e-9),
    `got ${got256.toFixed(6)}, expected ${exact.toFixed(6)}`);
  check('the value does not depend on sampling density (64 vs 256 vs 1024)',
    f(near(got64, got256, 1e-9) && near(got1024, got256, 1e-9), false),
    `${got64.toFixed(6)} / ${got256.toFixed(6)} / ${got1024.toFixed(6)}`);
  check('probe radius is actually added (area without it would be 4*pi*1.70^2)',
    !near(f(got256, 4 * Math.PI * 1.7 * 1.7), 4 * Math.PI * 1.7 * 1.7, 1e-6),
    `got ${got256.toFixed(3)}, bare-vdW value is ${(4 * Math.PI * 1.7 * 1.7).toFixed(3)}`);
  const sulfur = [{ ...atom[0], element: 'S', radius: S.VDW_RADII.S + S.PROBE_RADIUS }];
  check('a larger element gives a larger area', S.atomSasa(f(sulfur, atom), { points: 256 })[0] > got256);
}

// ------------------------------------------------------------------ 2. occlusion is monotone
console.log('\nocclusion');
{
  const mk = (d) => ([
    { name: 'CA', element: 'C', res: 'ALA', chain: 'A', resi: 1, x: 0, y: 0, z: 0, radius: 3.1 },
    { name: 'CB', element: 'C', res: 'ALA', chain: 'A', resi: 2, x: d, y: 0, z: 0, radius: 3.1 },
  ]);
  const areas = [20, 10, 6, 4, 2, 0.5].map(d => S.atomSasa(mk(d), { points: 1024 })[0]);
  let monotone = true;
  for (let i = 1; i < areas.length; i++) if (areas[i] > areas[i - 1] + 1e-9) monotone = false;
  check('accessibility never increases as a neighbour approaches', f(monotone, !monotone),
    areas.map(a => a.toFixed(1)).join(' > '));
  const far = S.atomSasa(mk(20), { points: 1024 })[0];
  const exact = 4 * Math.PI * 3.1 * 3.1;
  check('a neighbour beyond contact range occludes nothing', near(f(far, far * 0.5), exact, 1e-9));
  // Coincident equal spheres are a DEGENERATE case, not a buried one: no sample point on either lies
  // strictly inside the other, so the pair contributes twice one atom's area. The module must detect
  // that rather than pretend the geometry is meaningful. (This assertion started life claiming both
  // atoms come out buried. They do not, and the claim was mine, not the code's.)
  const dupAtoms = [
    { name: 'A', element: 'C', res: 'ALA', chain: 'A', resi: 1, x: 1, y: 2, z: 3, radius: 3.1 },
    { name: 'B', element: 'C', res: 'ALA', chain: 'A', resi: 2, x: 1, y: 2, z: 3, radius: 3.1 },
  ];
  const coincident = S.atomSasa(dupAtoms, { points: 256 });
  const dups = S.duplicateAtomPairs(dupAtoms);
  const whole = 4 * Math.PI * 3.1 * 3.1;
  check('coincident atoms are DETECTED, because their computed area is meaningless',
    f(dups.length === 1, dups.length === 0),
    `${dups.length} duplicate pair(s); each atom came out at ${coincident[0].toFixed(1)} of a possible ${whole.toFixed(1)} A^2`);
  // Why detection is the only defensible behaviour: a sample point on one sphere sits at distance
  // exactly r from the other centre, so whether it counts as buried is decided by whether |p|^2 lands
  // just above or just below 1 in floating point. Roughly half the points go each way. The area is not
  // ambiguous in the mathematical sense - it is arbitrary in the numerical sense.
  check('the degenerate area is neither zero nor a whole sphere, i.e. it is numerical noise',
    f(coincident[0] > 0.2 * whole && coincident[0] < 0.8 * whole, false),
    `${(coincident[0] / whole).toFixed(3)} of a sphere`);
  check('distinct atoms are not reported as duplicates', f(S.duplicateAtomPairs(mk(4)).length === 0, S.duplicateAtomPairs(mk(4)).length === 1));
  const half = S.atomSasa(mk(3.1), { points: 4096 })[0];
  check('a neighbour at one radius removes roughly a quarter of the sphere',
    f(half / exact > 0.70 && half / exact < 0.80, false), `fraction left ${(half / exact).toFixed(3)}`);
}

// ------------------------------------------------------------------ sphere points
console.log('\nsphere sampling');
{
  const pts = S.spherePoints(512);
  const norms = pts.map(p => Math.hypot(...p));
  check('every point is on the unit sphere', f(norms.every(n => near(n, 1, 1e-12)), false));
  const mean = [0, 1, 2].map(i => pts.reduce((a, p) => a + p[i], 0) / pts.length);
  check('the point set is centred (no directional bias)', f(mean.every(m => Math.abs(m) < 0.02), false),
    mean.map(m => m.toFixed(4)).join(', '));
  let threw = false; try { S.spherePoints(1); } catch { threw = true; }
  check('n < 2 is refused rather than producing a division by zero', f(threw, !threw));
  check('there is no randomness: two calls are identical',
    f(JSON.stringify(S.spherePoints(32)) === JSON.stringify(S.spherePoints(32)), false));
}

// ------------------------------------------------------------------ 3. the ambiguity gate
console.log('\nthe sequence quality gate');
{
  const clean = 'MGLSDGEWQLVLNVWGKVEADVAGHGQDILIRLFKSHPETLEKFDRFKHLKTEAEMKASEDLKKHGVTVLTALGGILKKKGHHEAELKPLAQSHATKHKIPIKYLEFISEAIIHVLHSRHPGDFGADAQGAMNKALELFRKDIAAKYKELGYQG';
  const withX = clean.slice(0, 12) + 'XXXXXXXXXXX' + clean.slice(23);
  const withBZ = clean.slice(0, 66) + 'B' + clean.slice(67, 90) + 'Z' + clean.slice(91);

  const okGate = S.sequenceIsUsable(clean);
  const xGate = S.sequenceIsUsable(withX);
  const bzGate = S.sequenceIsUsable(withBZ);

  check('a clean sequence is admitted', f(okGate.usable, !okGate.usable), okGate.why);
  check('a sequence with eleven unknown residues is REFUSED', f(!xGate.usable, xGate.usable), xGate.why);
  check('the refusal reports an interval, not a point', f(xGate.interval.width === 22, false),
    `interval [${xGate.interval.lo}, ${xGate.interval.hi}] width ${xGate.interval.width}`);
  check('eleven unknowns bound the charge more loosely than the whole biological range (~6 units)',
    f(xGate.interval.width > 6, false), `width ${xGate.interval.width}`);
  check('Asx/Glx are one-sided: they can only make the charge more negative',
    f(bzGate.interval.hi === S.integerCharge(withBZ) && bzGate.interval.lo === S.integerCharge(withBZ) - 2, false),
    `[${bzGate.interval.lo}, ${bzGate.interval.hi}] vs point ${S.integerCharge(withBZ)}`);
  check('the gate names what would resolve it', f(typeof xGate.what_would_resolve_it === 'string' && /unreviewed|genome/.test(xGate.what_would_resolve_it), false));
  check('a clean sequence has a zero-width interval', f(okGate.interval.width === 0, false));
  // A missing sequence must be refused BY NAME, not treated as a clean one and not thrown on: a data
  // row whose sequence has not been filled in yet is the likeliest input this gate will ever see.
  for (const [label, value] of [['undefined', undefined], ['null', null], ['empty string', ''], ['a number', 154]]) {
    let g; let threw = false;
    try { g = S.sequenceIsUsable(value); } catch { threw = true; }
    check(`a sequence that is ${label} is refused rather than throwing or passing`,
      f(!threw && g.usable === false && g.interval.width === Infinity, threw || g?.usable === true),
      threw ? 'it threw' : `usable=${g?.usable}, why="${g?.why}"`);
  }
  check('an unrecognised code is treated as maximally uncertain, not ignored',
    f(S.chargeInterval(clean + '@').width === 2, false), `width ${S.chargeInterval(clean + '@').width}`);
  check('ambiguity positions are reported with residue numbers, not just counts',
    f(xGate.ambiguities.positions[0].residue_number === 13, false),
    `first at residue ${xGate.ambiguities.positions[0]?.residue_number}`);
  // the charge convention itself
  check('integerCharge counts (K+R)-(D+E) and nothing else',
    f(S.integerCharge('KRDE') === 0 && S.integerCharge('KKH') === 2 && S.integerCharge('DDH') === -2, false));
  check('histidine is NOT counted in the integer charge', f(S.integerCharge('HHHHH') === 0, false));
}

// ------------------------------------------------------------------ 4. fixed-column parsing
console.log('\nPDB parsing by fixed columns');
{
  // Coordinates deliberately run together: "-123.456" followed by "1234.567" with no separating space.
  const pdb = [
    'ATOM      1  N   MET A   1      -1.234   2.345   3.456  1.00 90.00           N  ',
    'ATOM      2  CA  MET A   1    -123.4561234.567-999.999  1.00 90.00           C  ',
    'ATOM      3  CB  MET A   1       4.000   5.000   6.000  1.00 90.00           C  ',
    'HETATM 1500 FE   HEM A 155       0.000   0.000   0.000  1.00 90.00          FE  ',
    'ATOM      4  OD1 ASP A   2       7.000   8.000   9.000  1.00 90.00           O  ',
    'ATOM      5  OD1BASP A   2       7.100   8.100   9.100  0.50 90.00           O  ',
    'TER',
  ].join('\n');
  const atoms = S.parsePDB(pdb);
  check('four atoms kept: the HETATM ignored and the altLoc B record skipped',
    f(atoms.length === 4, atoms.length === 5), `got ${atoms.length}`);
  check('the skipped alternate location is recorded, not silently dropped',
    f(atoms.skipped_altloc?.length === 1, !atoms.skipped_altloc), `${atoms.skipped_altloc?.length ?? 0} recorded`);
  check('run-together coordinates are read correctly by column',
    f(atoms[1].x === -123.456 && atoms[1].y === 1234.567 && atoms[1].z === -999.999, false),
    `${atoms[1].x} / ${atoms[1].y} / ${atoms[1].z}`);
  check('element is taken from columns 77-78, not guessed from the atom name',
    f(atoms[3].element === 'O' && atoms[0].element === 'N', false));
  check('the radius already includes the probe', f(near(atoms[0].radius, S.VDW_RADII.N + S.PROBE_RADIUS, 1e-12), false));
  check('residue numbers are integers from columns 23-26', f(atoms[3].resi === 2, atoms[3].resi === 3));
  const rows = S.residueSasa(atoms.slice(0, 3), { points: 64 });
  check('atoms of one residue are summed into one residue row', f(rows.length === 1 && rows[0].atoms === 3, false),
    `${rows.length} row(s)`);
  check('relative accessibility is computed against the reference maximum for that residue type',
    f(rows[0].reference_max_asa === S.MAX_ASA.MET, rows[0].reference_max_asa === S.MAX_ASA.ALA));
}

// ------------------------------------------------------------------ surface charge behaviour
console.log('\nsurface charge');
{
  // Two lysines: one alone in space, one buried inside a shell of carbons.
  const lysAtoms = (resi, cx, extra) => ([
    { name: 'N', element: 'N', res: 'LYS', chain: 'A', resi, x: cx, y: 0, z: 0, radius: S.VDW_RADII.N + S.PROBE_RADIUS },
    { name: 'CA', element: 'C', res: 'LYS', chain: 'A', resi, x: cx + 1.5, y: 0, z: 0, radius: S.VDW_RADII.C + S.PROBE_RADIUS },
    ...extra,
  ]);
  const shell = [];
  for (const p of S.spherePoints(40)) shell.push({ name: 'C', element: 'C', res: 'GLY', chain: 'A', resi: 900 + shell.length, x: 100 + p[0] * 5.0, y: p[1] * 5.0, z: p[2] * 5.0, radius: S.VDW_RADII.C + S.PROBE_RADIUS });
  const atoms = [...lysAtoms(1, 0, []), ...lysAtoms(2, 100, []), ...shell];
  const sc = S.surfaceCharge(atoms, { points: 256 });
  check('the exposed lysine counts and the enclosed one does not', f(sc.z_surface === 1, sc.z_surface === 2),
    `z_surface ${sc.z_surface}, exposed ${sc.exposed_ionisable}, buried ${sc.buried_ionisable}`);
  check('histidine is reported separately and not folded into z_surface',
    f(Object.hasOwn(sc, 'z_surface_his_protonated') && Object.hasOwn(sc, 'histidines_exposed'), false));
  check('the exposure cut used is reported with the result', f(sc.cut === S.EXPOSURE_CUTS.standard, sc.cut === 0.99));

  const sens = S.sensitivity(atoms, { points: 256 });
  check('sensitivity reports all three conventional cuts',
    f(Object.keys(sens).join(',') === 'loose,standard,strict', false), Object.keys(sens).join(','));
  check('a stricter cut can only reduce or hold the exposed count, never raise it',
    f(sens.strict.fraction_ionisable_exposed <= sens.standard.fraction_ionisable_exposed &&
      sens.standard.fraction_ionisable_exposed <= sens.loose.fraction_ionisable_exposed, false),
    `${sens.loose.fraction_ionisable_exposed} >= ${sens.standard.fraction_ionisable_exposed} >= ${sens.strict.fraction_ionisable_exposed}`);
  check('structureSequence reconstructs one-letter codes from residue rows',
    f(S.structureSequence(S.residueSasa(atoms.slice(0, 4), { points: 16 })) === 'KK', false));
}

// ------------------------------------------------------------------ the recorded lesson
console.log('\nthe recorded lesson');
{
  const t = S.THE_REVIEWED_ENTRY_TRAP;
  check('the trap is recorded with what happened, why it was wrong, and how it was caught',
    f(['what_happened', 'why_it_was_wrong', 'how_it_was_caught', 'the_correct_entry', 'the_general_lesson', 'what_changed_in_the_code'].every(k => typeof t[k] === 'string' && t[k].length > 60), false));
  check('the lesson names the default that caused it', f(/PREFER REVIEWED/.test(t.the_general_lesson), false));
  check('it does not claim the charge code caught its own error', f(/Not by the charge code/.test(t.how_it_was_caught), false));
  check('known limitations include the missing haem and the mixed structure sources',
    f(S.KNOWN_LIMITATIONS.some(l => /HETATM|haem/.test(l)) && S.KNOWN_LIMITATIONS.some(l => /ESMFold|model source/.test(l)), false),
    `${S.KNOWN_LIMITATIONS.length} limitations`);
  check('exported constants are frozen', f(Object.isFrozen(S.MAX_ASA) && Object.isFrozen(S.AMBIGUITY_CODES) && Object.isFrozen(S.KNOWN_LIMITATIONS), false));
}

// ------------------------------------------------------------------ 5. the holdout
console.log('\nthe holdout');
{
  // Read the SAME source the project's own leak checker reads (holdout/split.json, assignment
  // "holdout"), rather than a path guessed here. The first version of this block guessed three paths,
  // fell back to the largest JSON in the folder, and extracted ZERO names from it - so it scanned for
  // nothing and passed. It was caught by --fail-once, where it survived its own inverted predicate.
  const splitPath = path.join(root, 'holdout/split.json');
  let terms = [], loadedFrom = null, loadError = null;
  try {
    const split = JSON.parse(fs.readFileSync(splitPath, 'utf8'));
    terms = (split.taxa ?? []).filter(t => t.assignment === 'holdout')
      .flatMap(t => [t.name, t.latin, t.scientific_name, t.common_name, t.taxon].filter(x => typeof x === 'string'))
      .map(s => s.toLowerCase());
    loadedFrom = 'holdout/split.json (assignment === "holdout")';
  } catch (e) { loadError = String(e.message).slice(0, 90); }

  const src = (fs.readFileSync(path.join(here, 'structure.mjs'), 'utf8') +
    fs.readFileSync(path.join(here, 'test-structure.mjs'), 'utf8')).toLowerCase();
  const hits = [...new Set(terms)].filter(t => t.length > 4 && src.includes(t));
  check('the held-out roster was read from the project\'s own split file',
    f(terms.length > 20, terms.length === 0), loadedFrom ? `${terms.length} names from ${loadedFrom}` : `could not load: ${loadError}`);
  check('no held-out taxon name appears in this module or its test',
    f(hits.length === 0 && terms.length > 20, false),
    hits.length ? `${hits.length} hit(s): ${hits.slice(0, 3).join(', ')}` : `${new Set(terms).size} names checked`);
  // And the authority itself, not our reimplementation of it:
  const { spawnSync } = await import('node:child_process');
  const gate = spawnSync(process.execPath, [path.join(root, 'holdout/check-leaks.mjs'), 'benchmarks/retro-validation'], { cwd: root, encoding: 'utf8' });
  check('the project leak gate passes on this directory', f(gate.status === 0, gate.status !== 0),
    (gate.stdout ?? '').trim().split('\n').pop() ?? `exit ${gate.status}`);
}

console.log(`\n${pass} passed, ${fail} failed${FAULT ? '  (--fail-once: every assertion should have failed)' : ''}`);
if (FAULT) {
  console.log(fail === pass + fail
    ? `all ${fail} assertions failed under their own fault: no survivors`
    : `SURVIVORS: ${pass} assertion(s) still passed with a fault injected - those assert nothing`);
}
process.exit(FAULT ? (pass === 0 ? 0 : 1) : (fail === 0 ? 0 : 1));
