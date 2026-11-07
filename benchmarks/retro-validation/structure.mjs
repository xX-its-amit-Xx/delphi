#!/usr/bin/env node
// structure.mjs - SOLVENT ACCESSIBILITY, AND THE SEQUENCE QUALITY GATE THAT HAS TO COME FIRST.
//
// ============================== WHY THIS MODULE EXISTS ==============================
// The published quantity in Mirceta et al. 2013 is a net SURFACE charge of myoglobin. "Surface" is a
// claim about structure, and a sequence does not have one. A sequence-only net charge counts every
// ionisable residue, including the ones folded into the interior, which cannot contribute to the
// intermolecular repulsion the paper proposes as the mechanism. So either we restrict the charge to
// solvent-exposed residues, or we are computing a different quantity and should not call it Z_Mb.
//
// This module does the restriction: Shrake-Rupley numerical solvent accessibility on a real structure,
// a relative-accessibility threshold per residue, and the charge summed over exposed ionisable residues
// only. It answers a question that can be answered, which is HOW MUCH the restriction changes the
// ranking - not whether the published relationship is true.
//
// ============================== THE LESSON THAT COST THE MOST ==============================
// See THE_REVIEWED_ENTRY_TRAP at the bottom. In short: the single most striking number in the first
// version of this analysis - one species with more than double the myoglobin surface charge of any
// other - was an artefact of eleven UNKNOWN residues in a protein-level Swiss-Prot entry, preferred by
// our own fetcher precisely BECAUSE it was reviewed. The complete, genome-derived, unreviewed entry for
// the same species puts it with the pack. A sequence with ambiguity codes cannot be charge-computed,
// and "prefer reviewed" is the wrong default when the reviewed entry predates genome sequencing.
//
// Hence the order of business here: the gate first, the geometry second.
//
// ============================== METHOD, WITH SOURCES ==============================
//   Accessibility     Shrake A, Rupley JA (1973) J Mol Biol 79:351-371. Numerical sphere sampling.
//                     Probe radius 1.4 A (water).
//   vdW radii         Bondi A (1964) J Phys Chem 68:441-451.
//   Reference max ASA Tien MZ, Meyer AG, Sydykova DK, Spielman SJ, Wilke CO (2013) PLoS ONE 8:e80635,
//                     Table 1, THEORETICAL column. Relative accessibility = ASA / max ASA(residue).
//   Exposure cut      0.20 relative accessibility. This is a CONVENTION, not a measurement; the figure
//                     is reported alongside results at 0.05 and 0.35 so the reader can see whether the
//                     conclusion depends on it. See `sensitivity`.
//
// No network access and no randomness: the sphere points are a deterministic golden-spiral set, so two
// runs on the same structure give identical numbers.

const deepFreeze = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); }
  return o;
};

// ---------------------------------------------------------------------------- the sequence quality gate

export const STD_AA = 'ACDEFGHIKLMNPQRSTVWY';

/** What each non-standard one-letter code means, and what it does to a charge sum. */
export const AMBIGUITY_CODES = deepFreeze({
  X: { means: 'any residue, unknown', charge_min: -1, charge_max: +1, note: 'could be Asp/Glu or Lys/Arg: contributes two full charge units of uncertainty' },
  B: { means: 'Asx - Asp or Asn', charge_min: -1, charge_max: 0, note: 'one charge unit of uncertainty' },
  Z: { means: 'Glx - Glu or Gln', charge_min: -1, charge_max: 0, note: 'one charge unit of uncertainty' },
  J: { means: 'Xle - Leu or Ile', charge_min: 0, charge_max: 0, note: 'no charge consequence, but still an unresolved position' },
  U: { means: 'selenocysteine', charge_min: 0, charge_max: 0, note: 'a real residue, not an ambiguity; flagged because most tools do not handle it' },
  O: { means: 'pyrrolysine', charge_min: 0, charge_max: 0, note: 'a real residue, not an ambiguity' },
});

/** Positions in a sequence that are not one of the twenty standard residues. */
export function ambiguities(seq) {
  if (typeof seq !== 'string') return { counts: {}, positions: [], total: 0, not_a_sequence: typeof seq };
  const counts = {};
  const positions = [];
  for (let i = 0; i < seq.length; i++) {
    const a = seq[i];
    if (STD_AA.includes(a)) continue;
    counts[a] = (counts[a] ?? 0) + 1;
    positions.push({ index: i, residue_number: i + 1, code: a });
  }
  return { counts, positions, total: positions.length };
}

/** Integer charge convention: (Lys + Arg) - (Asp + Glu). Histidine is counted separately, never folded in. */
export function integerCharge(seq) {
  let z = 0;
  for (const a of seq) { if (a === 'K' || a === 'R') z++; else if (a === 'D' || a === 'E') z--; }
  return z;
}

/**
 * The interval a charge could occupy given the unresolved positions. A sequence with eleven X codes has
 * an interval twenty-two charge units wide, which is wider than the entire biological range being
 * compared - that is what makes such a sequence unusable rather than merely imprecise.
 */
export function chargeInterval(seq) {
  const z = integerCharge(seq);
  const { counts } = ambiguities(seq);
  let lo = z, hi = z, unknown_codes = [];
  for (const [code, n] of Object.entries(counts)) {
    const c = AMBIGUITY_CODES[code];
    if (!c) { unknown_codes.push(code); lo -= n; hi += n; continue; } // an unrecognised code is treated as maximally uncertain
    lo += n * c.charge_min; hi += n * c.charge_max;
  }
  return { point: z, lo, hi, width: hi - lo, unknown_codes };
}

/**
 * Is this sequence usable for a comparative charge analysis?
 *
 * `max_interval_width` defaults to 0: for THIS analysis the comparison is between species separated by
 * a few charge units, so any unresolved charged position makes the row uninformative. A caller doing a
 * coarser comparison may raise it, but must do so explicitly - the gate never guesses what precision
 * the caller needs.
 */
export function sequenceIsUsable(seq, { max_interval_width = 0 } = {}) {
  // A MISSING sequence is not a clean sequence. An earlier version of this gate called ambiguities()
  // straight away and threw on undefined, which turned "this data row has no sequence yet" into a
  // crash halfway through a batch - and, worse, would have reported zero ambiguities if the loop had
  // been written over Object.keys instead. Refuse it by name.
  if (typeof seq !== 'string' || seq.length === 0) {
    return {
      usable: false,
      why: seq === undefined ? 'no sequence on this row' : `sequence is ${typeof seq}${typeof seq === 'string' ? ' of length 0' : ''}, not a non-empty string`,
      ambiguities: { counts: {}, positions: [], total: 0 },
      interval: { point: null, lo: null, hi: null, width: Infinity, unknown_codes: [] },
      what_would_resolve_it: 'fetch the sequence for this accession, or drop the row and say why',
    };
  }
  const amb = ambiguities(seq);
  const iv = chargeInterval(seq);
  const usable = iv.width <= max_interval_width;
  return {
    usable,
    why: usable
      ? (amb.total === 0 ? 'all residues are standard' : `${amb.total} non-standard code(s), none affecting charge`)
      : `charge is only bounded to [${iv.lo}, ${iv.hi}] (${iv.width} units wide) because of ${Object.entries(amb.counts).map(([k, v]) => `${v}x${k}`).join(', ')}`,
    ambiguities: amb,
    interval: iv,
    what_would_resolve_it: usable ? null
      : 'a complete sequence for the same protein - typically a genome-derived entry, which may be UNREVIEWED while the ambiguous one is reviewed',
  };
}

// ---------------------------------------------------------------------------- geometry

export const PROBE_RADIUS = 1.4;
export const VDW_RADII = deepFreeze({ C: 1.70, N: 1.55, O: 1.52, S: 1.80, SE: 1.90, P: 1.80, H: 1.20, F: 1.47, CL: 1.75 });
export const VDW_DEFAULT = 1.70;

/** Tien et al. 2013, Table 1, theoretical maximum ASA in square angstroms. */
export const MAX_ASA = deepFreeze({
  ALA: 129, ARG: 274, ASN: 195, ASP: 193, CYS: 167, GLN: 225, GLU: 223, GLY: 104, HIS: 224, ILE: 197,
  LEU: 201, LYS: 236, MET: 224, PHE: 240, PRO: 159, SER: 155, THR: 172, TRP: 285, TYR: 263, VAL: 174,
});
export const THREE_TO_ONE = deepFreeze({
  ALA: 'A', ARG: 'R', ASN: 'N', ASP: 'D', CYS: 'C', GLN: 'Q', GLU: 'E', GLY: 'G', HIS: 'H', ILE: 'I',
  LEU: 'L', LYS: 'K', MET: 'M', PHE: 'F', PRO: 'P', SER: 'S', THR: 'T', TRP: 'W', TYR: 'Y', VAL: 'V',
});
export const EXPOSURE_CUTS = deepFreeze({ loose: 0.05, standard: 0.20, strict: 0.35 });

/** Deterministic quasi-uniform points on the unit sphere (golden spiral). No RNG anywhere in this file. */
export function spherePoints(n) {
  if (!Number.isInteger(n) || n < 2) throw new Error(`spherePoints needs an integer n >= 2, got ${n}`);
  const pts = [], phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const t = phi * i;
    pts.push([Math.cos(t) * r, y, Math.sin(t) * r]);
  }
  return pts;
}

/**
 * Parse ATOM records from a PDB file by FIXED COLUMNS, which is the only correct way: whitespace
 * splitting breaks on long atom names and on coordinates that run together at four significant figures.
 * HETATM is ignored on purpose - the haem of a myoglobin is a HETATM, and including it would occlude
 * the very pocket residues whose burial we want to measure from the protein alone. That choice is a
 * limitation and is named in `KNOWN_LIMITATIONS`.
 */
export function parsePDB(text, { keepAltLoc = 'A' } = {}) {
  const atoms = [];
  const skipped_altloc = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('ATOM')) continue;
    // Column 17 is the alternate-location indicator. Keeping every altLoc puts two atoms in nearly the
    // same place, each occluding the other, which halves the accessibility of exactly the side chains
    // that are mobile enough to have been modelled twice. Keep one.
    const alt = line.slice(16, 17).trim();
    if (alt && alt !== keepAltLoc) { skipped_altloc.push(line.slice(12, 27)); continue; }
    const name = line.slice(12, 16).trim();
    const elField = line.slice(76, 78).trim().toUpperCase();
    const el = elField || name.replace(/[^A-Za-z]/g, '')[0]?.toUpperCase() || 'C';
    const x = parseFloat(line.slice(30, 38)), y = parseFloat(line.slice(38, 46)), z = parseFloat(line.slice(46, 54));
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    atoms.push({
      name, element: el, res: line.slice(17, 20).trim(), chain: line.slice(21, 22).trim(),
      resi: parseInt(line.slice(22, 26), 10), x, y, z,
      radius: (VDW_RADII[el] ?? VDW_DEFAULT) + PROBE_RADIUS,
    });
  }
  if (skipped_altloc.length) Object.defineProperty(atoms, 'skipped_altloc', { value: skipped_altloc, enumerable: false });
  return atoms;
}

/**
 * Exactly coincident atoms. Two spheres at the same centre with the same radius are a degenerate case
 * for ANY sampling method: no sample point on one lies strictly inside the other, so neither is
 * occluded and the pair contributes twice the area of one atom. That is not a rounding error, it is a
 * doubling, and the usual cause is a duplicated or alternate-location record. Detect rather than guess.
 */
export function duplicateAtomPairs(atoms, { tol = 1e-6 } = {}) {
  const seen = new Map(), pairs = [];
  atoms.forEach((a, i) => {
    const k = `${Math.round(a.x / tol)},${Math.round(a.y / tol)},${Math.round(a.z / tol)}`;
    if (seen.has(k)) pairs.push({ i: seen.get(k), j: i, at: [a.x, a.y, a.z], residues: [atoms[seen.get(k)].resi, a.resi] });
    else seen.set(k, i);
  });
  return pairs;
}

/** Per-atom accessible area by sphere sampling. Exact for an isolated atom: 4*pi*r^2. */
export function atomSasa(atoms, { points = 256 } = {}) {
  const sphere = spherePoints(points);
  const CELL = 12;
  const grid = new Map();
  const key = (i, j, k) => `${i},${j},${k}`;
  atoms.forEach((a, i) => {
    const k = key(Math.floor(a.x / CELL), Math.floor(a.y / CELL), Math.floor(a.z / CELL));
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  });
  const out = new Array(atoms.length);
  for (let i = 0; i < atoms.length; i++) {
    const a = atoms[i], near = [];
    const ci = Math.floor(a.x / CELL), cj = Math.floor(a.y / CELL), ck = Math.floor(a.z / CELL);
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) for (let dk = -1; dk <= 1; dk++) {
      for (const j of grid.get(key(ci + di, cj + dj, ck + dk)) ?? []) {
        if (j === i) continue;
        const b = atoms[j];
        if ((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2 < (a.radius + b.radius) ** 2) near.push(b);
      }
    }
    let exposed = 0;
    for (const p of sphere) {
      const px = a.x + a.radius * p[0], py = a.y + a.radius * p[1], pz = a.z + a.radius * p[2];
      let buried = false;
      for (const b of near) {
        if ((px - b.x) ** 2 + (py - b.y) ** 2 + (pz - b.z) ** 2 < b.radius * b.radius) { buried = true; break; }
      }
      if (!buried) exposed++;
    }
    out[i] = 4 * Math.PI * a.radius * a.radius * (exposed / sphere.length);
  }
  return out;
}

/** Residue-level accessibility: absolute area, relative area against Tien's maximum, and the one-letter code. */
export function residueSasa(atoms, opts = {}) {
  const per = atomSasa(atoms, opts);
  const byRes = new Map();
  atoms.forEach((a, i) => {
    const k = `${a.chain}|${a.resi}|${a.res}`;
    if (!byRes.has(k)) byRes.set(k, { chain: a.chain, resi: a.resi, res: a.res, aa: THREE_TO_ONE[a.res] ?? 'X', sasa: 0, atoms: 0 });
    const r = byRes.get(k); r.sasa += per[i]; r.atoms++;
  });
  const rows = [...byRes.values()].sort((x, y) => x.resi - y.resi);
  for (const r of rows) {
    const max = MAX_ASA[r.res] ?? null;
    r.sasa = +r.sasa.toFixed(2);
    r.relative = max ? +(r.sasa / max).toFixed(4) : null;
    r.reference_max_asa = max;
  }
  return rows;
}

/**
 * Net charge over SOLVENT-EXPOSED ionisable residues.
 *
 * Histidine is returned SEPARATELY and never silently added: at pH 7.4 with a model pKa near 6.0 it is
 * mostly neutral, but in myoglobin several histidines sit in the haem pocket with shifted pKa values,
 * and myoglobin has an unusually high histidine count. A single number that buries that choice is the
 * thing this repo keeps refusing to produce.
 */
export function surfaceCharge(atoms, { cut = EXPOSURE_CUTS.standard, points = 256 } = {}) {
  const rows = residueSasa(atoms, { points });
  let z = 0, zHis = 0, exposedIon = 0, buriedIon = 0, hisExposed = 0;
  const detail = [];
  for (const r of rows) {
    if (!'DEKRH'.includes(r.aa)) continue;
    const exposed = r.relative !== null && r.relative > cut;
    exposed ? exposedIon++ : buriedIon++;
    if (r.aa === 'H' && exposed) hisExposed++;
    if (exposed) {
      const q = (r.aa === 'K' || r.aa === 'R') ? 1 : (r.aa === 'D' || r.aa === 'E') ? -1 : 0;
      z += q;
      zHis += r.aa === 'H' ? 1 : q;
    }
    detail.push({ resi: r.resi, aa: r.aa, relative: r.relative, exposed });
  }
  return {
    z_surface: z,
    z_surface_his_protonated: zHis,
    histidines_exposed: hisExposed,
    exposed_ionisable: exposedIon,
    buried_ionisable: buriedIon,
    fraction_ionisable_exposed: exposedIon + buriedIon ? +(exposedIon / (exposedIon + buriedIon)).toFixed(4) : null,
    cut,
    residues: rows.length,
    detail,
  };
}

/** The same quantity at all three conventional cuts, so a reader can see whether the cut carries the result. */
export function sensitivity(atoms, { points = 256 } = {}) {
  const out = {};
  for (const [name, cut] of Object.entries(EXPOSURE_CUTS)) {
    const s = surfaceCharge(atoms, { cut, points });
    out[name] = { cut, z_surface: s.z_surface, z_surface_his_protonated: s.z_surface_his_protonated, fraction_ionisable_exposed: s.fraction_ionisable_exposed };
  }
  return out;
}

/** Does the structure's own residue sequence match the sequence we think it is? */
export function structureSequence(rows) { return rows.map(r => r.aa).join(''); }

// ---------------------------------------------------------------------------- what we got wrong

export const THE_REVIEWED_ENTRY_TRAP = deepFreeze({
  what_happened:
    'The first version of this analysis fetched one myoglobin per species from UniProt and, among hits, ' +
    'preferred reviewed (Swiss-Prot) entries. One species then came out with more than double the ' +
    'myoglobin net charge of any other mammal in the set - the single most eye-catching number in the ' +
    'table, and exactly the kind of outlier a diving-physiology story would want.',
  why_it_was_wrong:
    'That reviewed entry is a protein-level record from direct sequencing and carries ELEVEN X codes - ' +
    'positions where the residue is unknown. Our charge function counted only the standard ionisable ' +
    'codes, so eleven unresolved positions silently contributed zero. Eleven unknowns bound the charge ' +
    'to an interval twenty-two units wide, which is several times the whole range being compared.',
  how_it_was_caught:
    'Not by the charge code, which had no way to notice. It was caught because a structure predictor ' +
    'refused the sequence and the structure-derived sequence came back SHORTER than the UniProt one. ' +
    'The mismatch check was written to catch a wrong accession and caught an ambiguous sequence instead.',
  the_correct_entry:
    'An unreviewed, genome-derived TrEMBL entry for the same species and protein is complete, has no ' +
    'ambiguity codes, and puts that species in the middle of the diving mammals rather than at the top.',
  the_general_lesson:
    'PREFER REVIEWED is the wrong default when the reviewed entry predates genome sequencing. Reviewed ' +
    'means curated, not complete. For any analysis that counts residues, completeness beats curation, ' +
    'and the gate has to run before the arithmetic rather than after the figure.',
  what_changed_in_the_code:
    'sequenceIsUsable() now refuses any sequence whose charge interval is wider than the caller states ' +
    'it can tolerate, defaulting to zero tolerance, and reports the interval rather than a point value.',
});

export const KNOWN_LIMITATIONS = deepFreeze([
  'HETATM records are ignored, so the haem group of a myoglobin is absent from the occlusion calculation. ' +
  'Residues lining the haem pocket are therefore scored as more exposed than they are in the holoprotein. ' +
  'This inflates the exposed-ionisable count slightly and in the same direction for every species.',
  'Predicted structures are not measured ones. Where AlphaFold DB has no model for an accession, an ' +
  'ESMFold structure is a DIFFERENT model source, and mixing sources in one comparative ranking is a ' +
  'confound: such rows must be labelled, not merged.',
  'The 0.20 relative-accessibility cut is a convention. `sensitivity()` exists so that the dependence ' +
  'of any conclusion on that convention is visible rather than argued about.',
  'A model pKa set cannot know about shifted pKa values in a specific pocket. This module therefore ' +
  'reports integer charges with histidine held separate rather than a titration-based net charge.',
]);
