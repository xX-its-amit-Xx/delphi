// Genotype browser for Open the Fish (?mode=genotype): genotype differences ACROSS organisms, from the sequences
// thread's committed files. Nothing here is computed from a model: every residue is read out of an alignment column,
// every count out of sequences/progression.json or sequences/gliders.json, and every orthologue call out of
// genotype/sequence-layer.json (which also carries two labelled FAILURES that must never render as orthologue calls).
//
// The hard rule this module enforces: a residue is a STATE, not a phenotype. Setting a residue at a marked site
// changes which organisms are shown as sharing that state and changes the provenance line. It predicts nothing, it
// moves no mesh, and it is never combined with a phenotype grade into one confidence.
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const NO_PREDICTION =
  'Setting a residue here changes the COMPARISON and the provenance, nothing else. There is no model in this project that '
  + 'predicts a phenotype from a residue change, and the project’s own design validation failed, so none is offered. '
  + 'Only a calibrated intervention from genotype/interventions.json moves the mesh, and it does that in the Design Studio.';
export const GENE_SET_CAVEAT =
  'The nine genes were chosen from zebrafish fin biology, not from glider biology, so the absence of convergence in them '
  + 'says nothing about the rest of the genome.';

// role string -> a group the browser can sort and colour by
const ROLE_GROUPS = [
  [/flying fish \(Exocoetidae\)/i, 'flying fish', 'glide'],
  [/flying \(gliding\) halfbeak/i, 'gliding halfbeak', 'glide'],
  [/^glider/i, 'glider (tetrapod)', 'glide'],
  [/bat \(powered flight\)/i, 'bat (powered flight)', 'fly'],
  [/halfbeak \(non-gliding\)/i, 'halfbeak, non-gliding', 'ctrl'],
  [/needlefish or saury/i, 'needlefish / saury', 'ctrl'],
  [/^control/i, 'non-gliding control', 'ctrl'],
  [/non-flying mammal/i, 'non-flying mammal', 'ctrl'],
  [/reference teleost/i, 'zebrafish (reference)', 'ref'],
  [/Beloniformes.*proxy/i, 'medaka (closest annotated)', 'ref'],
  [/flying insect/i, 'insect (not homologous)', 'out'],
];
export function groupOf(role) {
  for (const [re, label, cls] of ROLE_GROUPS) if (re.test(String(role || ''))) return { label, cls };
  return { label: role ? String(role).split(/[;,(]/)[0].trim() : 'unstated', cls: 'out' };
}
export const GROUP_ORDER = ['flying fish', 'gliding halfbeak', 'glider (tetrapod)', 'bat (powered flight)',
  'halfbeak, non-gliding', 'needlefish / saury', 'non-gliding control', 'non-flying mammal',
  'zebrafish (reference)', 'medaka (closest annotated)', 'insect (not homologous)'];

// one row per organism for a gene: its alignment row plus the group it belongs to
export function organisms(aln) {
  if (!aln) return [];
  return aln.rows.map(r => ({ ...r, g: groupOf(r.group) }))
    .sort((a, b) => {
      const ia = GROUP_ORDER.indexOf(a.g.label), ib = GROUP_ORDER.indexOf(b.g.label);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || String(a.name).localeCompare(String(b.name));
    });
}
// the residue an organism carries at a marked site, read straight out of the alignment column
export const residueAt = (row, col) => (col && row.seq && col <= row.seq.length) ? row.seq[col - 1] : null;

// ---------- the site that separates: lat4a F326L ----------
// progression.json counts the beloniform series by group; gliders.json gives one residue per annotated tetrapod.
export function separatingSite(prog, gliders) {
  if (!prog) return null;
  const groups = prog.groups_in_order || {};
  const rows = Object.entries(groups).map(([name, g]) => ({
    name, n: g.n_species_sequenced, fin: g.fin_ratio_group_median, finN: g.fin_ratio_n_specimens,
    residues: g.lat4a_326_residues || {}, derived: g.mean_derived_states_of_38_sites, range: g.range_derived_states,
  }));
  const tet = gliders && gliders.lat4a_site_326_across_gliders ? Object.entries(gliders.lat4a_site_326_across_gliders) : [];
  return { rows, tet, reading: prog.lat4a_F326L_reading || null, inverted: prog.gene_level_signal_not_site_level || null };
}

// which organisms carry a chosen residue at a chosen column, across every loaded gene alignment
export function sharers(rows, col, residue) {
  const has = [], hasnt = [], missing = [];
  for (const r of rows) {
    const x = residueAt(r, col);
    if (x == null || x === '-' || x === 'X') missing.push(r);
    else if (x === residue) has.push(r);
    else hasnt.push(r);
  }
  return { has, hasnt, missing };
}

// ---------- rendering ----------
const cellClass = x => x === '-' ? 'gap' : x === 'X' ? 'gap' : '';
export function siteMatrixHtml(rows, variants, pick) {
  if (!variants.length) return `<p class="small">This gene has no marked variant site in sequences/alignments: the alignment is drawn, but there is no site to compare states at.</p>`;
  const cols = variants.filter(v => v.pos);
  let h = `<table class="gm"><tr><th>organism</th><th>group</th>${cols.map(v => `<th class="sitecol${pick && pick.id === v.id ? ' on' : ''}" data-site="${esc(v.id || v.label)}" title="${esc(v.what || '')}">${esc(v.label)}<br><span class="tiny">col ${v.pos}</span></th>`).join('')}</tr>`;
  let lastG = null;
  for (const r of rows) {
    const g = r.g.label;
    if (g !== lastG) { h += `<tr class="grp"><td colspan="${2 + cols.length}">${esc(g)}</td></tr>`; lastG = g; }
    h += `<tr><td>${esc(r.name)}${r.common ? ` <span class="tiny">${esc(r.common)}</span>` : ''}</td><td class="tiny">${esc(r.g.cls)}</td>`;
    for (const v of cols) { const x = residueAt(r, v.pos);
      const on = pick && pick.id === v.id && x === pick.residue;
      h += `<td class="res ${cellClass(x)}${on ? ' hit' : ''}">${x == null ? '&middot;' : esc(x)}</td>`; }
    h += `</tr>`;
  }
  return h + `</table>`;
}
// a window of the alignment around one column, for the organisms on screen
export function windowHtml(rows, col, half) {
  if (!col) return '';
  const w = half || 12; const a = Math.max(1, col - w), b = col + w;
  let h = `<table class="gw"><tr><th>organism</th><th><span class="tiny">${a}</span></th><th class="mid">${col}</th><th><span class="tiny">${b}</span></th></tr>`;
  for (const r of rows) {
    const seg = (r.seq || '').slice(a - 1, b);
    const i = col - a;
    h += `<tr><td>${esc(r.name)}</td><td colspan="3" class="seq ${r.g.cls}">${esc(seg.slice(0, i))}<b class="mid">${esc(seg[i] || '-')}</b>${esc(seg.slice(i + 1))}</td></tr>`;
  }
  return h + `</table>`;
}
export function identityHtml(ids, rows) {
  if (!ids || !ids.names || ids.names.length < 2) return `<p class="small">No identity matrix in this file for this gene.</p>`;
  const n = ids.names.length; const cap = 26; const keep = [...Array(Math.min(n, cap)).keys()];
  const vals = keep.flatMap(i => keep.map(j => ids.M[i][j])).filter(v => typeof v === 'number' && v < 100);
  const lo = vals.length ? Math.floor(Math.min(...vals)) : 0;
  const col = v => v == null ? 'transparent' : `color-mix(in srgb, var(--accent) ${Math.round(100 * Math.max(0, (v - lo)) / Math.max(1, 100 - lo))}%, transparent)`;
  let h = `<table class="gi"><tr><th></th>${keep.map(j => `<th><span>${esc(ids.names[j])}</span></th>`).join('')}</tr>`;
  for (const i of keep) h += `<tr><th>${esc(ids.names[i])}</th>${keep.map(j => { const v = ids.M[i][j]; return `<td style="background:${col(v)}">${v == null ? '' : Math.round(v)}</td>`; }).join('')}</tr>`;
  h += `</table><p class="tiny">% identical residue pairs over aligned columns, as the file computes it (gaps and X excluded); the file's own matrix, not recomputed here. Scale ${lo} to 100 %.${n > cap ? ` First ${cap} of ${n} rows.` : ''}</p>`;
  return h;
}
// the beloniform ladder: fin proportion against coding-site state, with the file's own inverted reading
export function ladderHtml(sep) {
  if (!sep) return '';
  const max = Math.max(...sep.rows.map(r => r.fin || 0), 0.001);
  let h = `<table class="gl"><tr><th>group</th><th>n</th><th>pectoral/SL (median)</th><th>lat4a 326</th><th>derived of 38 sites (mean)</th></tr>`;
  for (const r of sep.rows) {
    const bar = Math.round(100 * (r.fin || 0) / max);
    h += `<tr><td>${esc(r.name)}</td><td>${esc(r.n)}</td>
      <td><span class="bar" style="width:${bar}%"></span> ${r.fin != null ? r.fin.toFixed(3) : '&mdash;'} <span class="tiny">n=${esc(r.finN)}</span></td>
      <td>${Object.entries(r.residues).map(([k, v]) => `<span class="chip ${k === 'L' ? 'ok' : ''}">${esc(k)} &times;${esc(v)}</span>`).join(' ')}</td>
      <td>${esc(r.derived)} <span class="tiny">${r.range ? '(' + r.range.join('&ndash;') + ')' : ''}</span></td></tr>`;
  }
  return h + `</table>`;
}
