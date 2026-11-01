#!/usr/bin/env node
// Builds docs/align/data.json — the alignment the validation tab animates.
//
// Everything here comes from sequences/alignments/*.json, which hold REAL MAFFT L-INS-i protein
// alignments built from Ensembl 116 canonical proteins plus the Xu et al. 2021 flying-fish
// annotation. Nothing is simulated, and the build FAILS rather than shipping a figure it cannot
// read from those files.
//
// THREE THINGS THIS FILE IS CAREFUL ABOUT, because the page would otherwise overclaim:
//
//  1. These are PROTEIN alignments — residue columns, not nucleotide. "Aligning two genomes" is
//     not what happened and the page must not say it did.
//  2. There is NO COD in this data, flying or otherwise. The real comparator is Hirundichthys
//     speculiger, the mirrorwing flyingfish, whose protein comes from a real annotated draft
//     genome (Xu et al. 2021). Where a species is absent the page says so.
//  3. The engineered fish is NOT a third sequence. It is the zebrafish sequence plus a named
//     substitution, so its row is DERIVED here, and every derived position is marked as such.
//
//   node dashboard/public/docs/align/build.mjs
//   node dashboard/public/docs/align/build.mjs --check

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const CHECK = process.argv.includes('--check');
const must = (c, m) => { if (!c) { console.error(`align/build.mjs FAILED: ${m}`); process.exit(1); } };

const ALIGN_DIR = path.join(root, 'sequences/alignments');
must(fs.existsSync(ALIGN_DIR), 'sequences/alignments/ does not exist');

// The rows the page draws, in order. `role` is shown to the reader verbatim.
const ROWS = [
  { key: 'danio_rerio', label: 'Zebrafish', sub: 'Danio rerio — the base MorphoLemma edits', kind: 'base' },
  { key: 'ENGINEERED', label: 'Flying zebrafish', sub: 'predicted by MorphoLemma — zebrafish plus the named edit', kind: 'engineered' },
  { key: 'daane2021:Exocoetus_volitans', label: 'Exocoetus volitans', sub: 'a real flying fish (Daane et al. 2021), projected onto medaka residues', kind: 'target' },
  { key: 'hirundichthys_speculiger', label: 'Mirrorwing flyingfish', sub: 'Hirundichthys speculiger — full-length protein (Xu et al. 2021)', kind: 'target2' },
  { key: 'oryzias_latipes', label: 'Medaka', sub: 'Oryzias latipes — closest annotated Beloniformes proxy', kind: 'proxy' },
];

// The edits our design actually makes, read from the alignment files' own variant anchors.
const EDITS = { kcnk5b: 'alf_W169L' };

const genes = [];
for (const file of fs.readdirSync(ALIGN_DIR).filter(f => f.endsWith('.json')).sort()) {
  const a = JSON.parse(fs.readFileSync(path.join(ALIGN_DIR, file), 'utf8'));
  const gene = a.gene || path.basename(file, '.json');
  const aln = a.alignment || {};
  const base = aln.danio_rerio;
  if (!base) { console.error(`  skip ${gene}: no zebrafish row`); continue; }

  const cols = base.length;
  for (const [k, s] of Object.entries(aln)) {
    must(s.length === cols, `${gene}: row ${k} is ${s.length} columns, zebrafish is ${cols} — not an alignment`);
  }

  // Derive the engineered row: zebrafish, with the edit applied at its aligned column.
  let engineered = null, editCol = null, edit = null;
  const vid = EDITS[gene];
  if (vid) {
    const v = (a.variants || []).find(x => x.id === vid);
    must(v, `${gene}: EDITS names variant ${vid}, which is not in variants[]`);
    must(v.coord_species === 'danio_rerio', `${gene}: variant ${vid} is numbered on ${v.coord_species}, not zebrafish`);
    // Walk the gapped zebrafish row to find the column holding residue v.pos.
    let n = 0;
    for (let c = 0; c < cols; c++) {
      if (base[c] !== '-') { n++; if (n === v.pos) { editCol = c; break; } }
    }
    must(editCol !== null, `${gene}: residue ${v.pos} not found in the zebrafish row`);
    must(base[editCol] === v.ref,
      `${gene}: column ${editCol} holds ${base[editCol]}, but variant ${vid} says the reference is ${v.ref}`);
    engineered = base.slice(0, editCol) + v.alt + base.slice(editCol + 1);
    edit = { id: v.id, pos: v.pos, ref: v.ref, alt: v.alt, col: editCol, what: v.what || null, source: v.source || null };
  }

  const rows = [];
  for (const r of ROWS) {
    const seq = r.key === 'ENGINEERED' ? engineered : aln[r.key];
    if (!seq) { rows.push({ ...r, present: false }); continue; }
    rows.push({ ...r, present: true, seq });
  }

  // Column classes against the zebrafish base. FOUR classes, not three, and the fourth is the
  // reason this is honest: Exocoetus is a projected row from Daane 2021, so most genes are only
  // PARTLY covered — prdm1a has 290 Exocoetus residues against 1410 columns. An uncovered column
  // is ABSENCE OF DATA, not similarity and not difference. Painting it either colour would be a
  // lie the reader cannot see, so it gets its own class and the legend names it.
  //
  //   s  same      both rows have a residue and they match
  //   d  diff      both rows have a residue and they differ
  //   g  gap       an indel: one row has a residue, the other an alignment gap, inside covered span
  //   n  no data   outside this species' covered span, or an explicit X
  const target = rows.find(r => r.kind === 'target' && r.present)
              || rows.find(r => r.kind === 'target2' && r.present)
              || rows.find(r => r.kind === 'proxy' && r.present);
  let same = 0, diff = 0, gap = 0, nodata = 0, classes = '';
  if (target) {
    // The covered span is from the target's first to last real residue; outside it there is no
    // evidence either way, whatever the alignment characters happen to be.
    const real = [...target.seq].map((c, i) => (c !== '-' && c !== 'X' ? i : -1)).filter(i => i >= 0);
    const lo = real.length ? real[0] : 0, hi = real.length ? real[real.length - 1] : -1;
    for (let c = 0; c < cols; c++) {
      const x = base[c], y = target.seq[c];
      if (c < lo || c > hi || y === 'X') { classes += 'n'; nodata++; }
      else if (x === '-' || y === '-') { classes += 'g'; gap++; }
      else if (x === y) { classes += 's'; same++; }
      else { classes += 'd'; diff++; }
    }
  }

  // Runs of identical class, so the page draws a few hundred spans rather than a few thousand.
  const runs = [];
  for (let c = 0; c < classes.length;) {
    let e = c; while (e < classes.length && classes[e] === classes[c]) e++;
    runs.push([classes[c], c, e - c]);
    c = e;
  }

  const pid = a.percent_identity?.matrix?.danio_rerio || {};
  genes.push({
    gene,
    columns: cols,
    aligner: a.aligner || null,
    coordinate_system: a.coordinate_system || null,
    rows: rows.map(r => ({ key: r.key, label: r.label, sub: r.sub, kind: r.kind, present: r.present, seq: r.seq || null })),
    compared_to: target ? { key: target.key, label: target.label, kind: target.kind } : null,
    // Named explicitly so the page can say WHY it fell back, rather than quietly showing a
    // different species than the reader expects.
    exocoetus_present: !!aln['daane2021:Exocoetus_volitans'],
    fallback_reason: aln['daane2021:Exocoetus_volitans'] ? null
      : 'Exocoetus volitans has no row for this gene in Daane et al. 2021, so the comparison falls back to Hirundichthys speculiger, also a real flying fish.',
    counts: { same, diff, gap, nodata },
    coverage_pct: cols ? +((cols - nodata) / cols * 100).toFixed(1) : null,
    identity_pct: target ? +(same / Math.max(1, same + diff) * 100).toFixed(1) : null,
    runs,
    edit,
    identity_matrix_row: {
      hirundichthys_speculiger: pid.hirundichthys_speculiger ?? null,
      oryzias_latipes: pid.oryzias_latipes ?? null,
      homo_sapiens: pid.homo_sapiens ?? null,
    },
    variants: (a.variants || []).map(v => ({ id: v.id, pos: v.pos, ref: v.ref, alt: v.alt, coord_species: v.coord_species })),
  });
}

must(genes.length >= 5, `only ${genes.length} alignments read; expected the 9 in sequences/alignments/`);
const edited = genes.filter(g => g.edit);
must(edited.length >= 1, 'no gene carries a derived engineered row — the edit overlay would be empty');

// The contrast the page leads with, read from the file that owns it rather than retyped.
const ed = JSON.parse(fs.readFileSync(path.join(root, 'sequences/engineered-diff.json'), 'utf8'));
must(/\b1 amino acid\b/.test(ed.headline), 'engineered-diff.json headline no longer states the 1-amino-acid figure');
const med = ed.context_natural_divergence?.per_species?.oryzias_latipes;
must(med?.total_aa_substitutions_in_these_genes, 'engineered-diff.json has no medaka substitution total');

const out = {
  generated_at: new Date().toISOString(),
  generated_by: 'dashboard/public/docs/align/build.mjs',
  source: 'sequences/alignments/*.json — real MAFFT L-INS-i alignments of Ensembl 116 canonical proteins',
  what_this_is:
    'PROTEIN alignments, residue by residue. Not a genome alignment: no nucleotide sequence is '
    + 'compared here, and the whole-genome difference (coding and non-coding) was never measured.',
  comparator:
    'The flying fish compared against is Exocoetus volitans where Daane et al. 2021 has a row for '
    + 'the gene (6 of 9), and Hirundichthys speculiger otherwise (Xu et al. 2021) — both real '
    + 'flying fishes. Exocoetus is MISSING from kcnk5b, which is the one gene carrying our edit, '
    + 'so the edited locus cannot be shown against Exocoetus at all. The page says so rather than '
    + 'substituting silently.',
  four_colours:
    'Columns are classed same / different / indel / NO DATA. The fourth exists because the '
    + 'Exocoetus rows are projections from Daane 2021 and cover only part of most proteins. An '
    + 'uncovered column is absence of evidence, not similarity and not difference.',
  engineered_row_is_derived:
    'The winged zebrafish is not a third sequence anyone measured. It is the zebrafish row with one '
    + 'named substitution applied, and the build refuses to apply it unless the reference residue at '
    + 'that aligned column matches what the variant record says it should be.',
  headline: ed.headline,
  natural_divergence: {
    species: 'Oryzias latipes (medaka)',
    n_genes: med.n_genes,
    median_identity_pct: med.median_identity_pct,
    substitutions: med.total_aa_substitutions_in_these_genes,
    differences_with_indels: med.total_aa_differences_in_these_genes,
    method: ed.context_natural_divergence.method,
    caveat: ed.context_natural_divergence.label,
  },
  genes,
};

const text = JSON.stringify(out);
if (CHECK) { console.log(`align/build.mjs --check: ok, ${genes.length} genes, ${(text.length / 1024).toFixed(0)} KB`); process.exit(0); }
fs.writeFileSync(path.join(here, 'data.json'), text);
console.log(`align/data.json: ${genes.length} genes, ${edited.length} with a derived edit row, ${(text.length / 1024).toFixed(0)} KB`);
for (const g of genes) {
  console.log(`  ${g.gene.padEnd(10)} ${String(g.columns).padStart(5)} cols  vs ${(g.compared_to?.label || '—').padEnd(22)} identity ${g.identity_pct ?? '—'}%  ${g.edit ? 'edit ' + g.edit.id : ''}`);
}
