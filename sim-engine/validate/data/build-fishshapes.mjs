// Builds data/fishshapes-features.json from FishShapes v1 (Price et al. 2022, Ecology 103:e3829,
// doi 10.1002/ecy.3829; data Zenodo record 6642650 / Dryad doi 10.5061/dryad.vt4b8gtvf, CC0).
//
//   node sim-engine/validate/data/build-fishshapes.mjs [path/to/FishShapes_specimensv1.csv]
//
// The CSV (1.6 MB) is NOT committed; it is downloaded to $VALIDATE_DATA_DIR (default C:/Temp/validate-data)
// when absent. Only the columns the validator compares are kept, as numbers in SI units, so the committed
// file is a derived table of the measured one. Rows with a missing weight, SL, depth or width are dropped and
// counted. FishShapes is teleosts only: no Aves rows exist, and the filter below would drop any that did.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const URL = 'https://zenodo.org/api/records/6642650/files/FishShapes_specimensv1.csv/content';
const dataDir = process.env.VALIDATE_DATA_DIR || 'C:/Temp/validate-data';
const csvPath = process.argv[2] || path.join(dataDir, 'fishshapes', 'FishShapes_specimensv1.csv');
if (!fs.existsSync(csvPath)) {
  fs.mkdirSync(path.dirname(csvPath), { recursive: true });
  const r = await fetch(URL);
  if (!r.ok) throw new Error(`download failed: ${r.status}`);
  fs.writeFileSync(csvPath, Buffer.from(await r.arrayBuffer()));
}
const raw = fs.readFileSync(csvPath);
const sha = crypto.createHash('sha256').update(raw).digest('hex');
const lines = raw.toString('utf8').trim().split(/\r?\n/);
const head = lines[0].split(',');
const col = n => head.indexOf(n);
const C = Object.fromEntries(['SpecimenID', 'Tree_name', 'Family', 'Order', 'Total_weight', 'Standard_length', 'Max_body_depth', 'Max_fish_width',
  'Min_caudalpeduncle_depth', 'Min_caudalpeduncle_width'].map(n => [n, col(n)]));
const AVES = /aves|passeri|columbi|galli|anseri|accipitri|strigi|psittaci|apodi/i;
const num = s => (s === 'NA' || s === '' ? null : Number(s));
const rows = []; const dropped = { missing_core: 0, aves: 0, nonpositive: 0 };
for (const l of lines.slice(1)) {
  const f = l.split(',');
  if (AVES.test(f[C.Order]) || AVES.test(f[C.Family])) { dropped.aves++; continue; }
  const W = num(f[C.Total_weight]), SL = num(f[C.Standard_length]), D = num(f[C.Max_body_depth]), Wd = num(f[C.Max_fish_width]);
  if ([W, SL, D, Wd].some(v => v == null || Number.isNaN(v))) { dropped.missing_core++; continue; }
  if ([W, SL, D, Wd].some(v => !(v > 0))) { dropped.nonpositive++; continue; }
  const pd = num(f[C.Min_caudalpeduncle_depth]), pw = num(f[C.Min_caudalpeduncle_width]);
  // [id, species, family, order, SL_m, mass_kg, depth_m, width_m, peduncle_depth_m|null, peduncle_width_m|null]
  const r5 = v => (v == null ? null : +v.toPrecision(5));
  rows.push([f[C.SpecimenID], f[C.Tree_name], f[C.Family], f[C.Order], r5(SL / 1000), r5(W / 1000), r5(D / 1000), r5(Wd / 1000), pd > 0 ? r5(pd / 1000) : null, pw > 0 ? r5(pw / 1000) : null]);
}
const out = {
  title: 'FishShapes v1 specimens, slimmed to the features sim-engine/validate compares',
  source: { cite: 'Price SA, Friedman ST, Corn KA, et al. 2022. FishShapes v1: functionally relevant measurements of teleost shape and size on three dimensions. Ecology 103:e3829', doi: '10.1002/ecy.3829', data: URL, data_doi: '10.5061/dryad.vt4b8gtvf', license: 'CC0 (Dryad)', csv_sha256: sha, kind: 'measured' },
  units: 'SL, depth, width and peduncle in metres (CSV mm / 1000); mass in kg (CSV g / 1000). Max_body_depth and Max_fish_width are maxima; peduncle values are minima.',
  columns: ['specimen_id', 'species', 'family', 'order', 'SL_m', 'mass_kg', 'depth_m', 'width_m', 'peduncle_depth_m', 'peduncle_width_m'],
  aves: 'FishShapes is teleosts only; an Aves filter on Order/Family ran anyway and dropped ' + dropped.aves + ' rows.',
  n_rows_csv: lines.length - 1, n_rows_kept: rows.length, dropped,
  rows,
};
const dest = path.join(import.meta.dirname, 'fishshapes-features.json');
fs.writeFileSync(dest, JSON.stringify(out));
console.log(`wrote ${dest}: ${rows.length} rows kept of ${lines.length - 1}; dropped ${JSON.stringify(dropped)}; csv sha256 ${sha}`);
