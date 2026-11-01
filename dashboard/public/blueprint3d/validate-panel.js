// validate-panel.js: the "Validate" panel for a design. Dependency-free ES module.
//
//   import { mountValidate } from './validate-panel.js';
//   const ctl = mountValidate(el, design);   // design: organism document, repository id, or {organism, containment, ageDays}
//   ctl.refresh(newDesign); ctl.destroy();
//
// Where the report comes from, in order:
//   1. A live sim-engine HTTP bridge (sim-engine/http.mjs): globalThis.DELPHI_SIM_API, globalThis.DELPHI_LEAN_API,
//      <meta name="delphi-sim-api">, <meta name="delphi-lean-api">, or localStorage 'delphi.simApi' / 'delphi.leanApi'.
//      Calls POST <base>/tool/validate_design and reads `.result` of the provenance envelope.
//   2. Else validate-static.json next to this file (written by sim-engine/validate/run-cases.mjs) for the four
//      repository designs it covers. Any other design says plainly that validation needs the live bridge.
// The panel never computes a score itself; it renders what sim-engine/validate returned.
//
// House rules carried into the UI: the verdict never says "valid"; accepted-law violations are shown apart from
// candidate and contested ones; a residue is a STATE, not a phenotype, and is never combined with a phenotype grade.
const HERE = new URL('.', import.meta.url);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const f = (x, d = 3) => (x == null || Number.isNaN(x) ? '–' : typeof x === 'number' ? (x !== 0 && Math.abs(x) < 1e-3 ? x.toExponential(2) : x.toFixed(d)) : esc(x));

function liveBase() {
  const g = globalThis;
  try { if (g.DELPHI_SIM_API) return String(g.DELPHI_SIM_API); if (g.DELPHI_LEAN_API) return String(g.DELPHI_LEAN_API); } catch { }
  try { for (const n of ['delphi-sim-api', 'delphi-lean-api']) { const m = g.document && document.querySelector(`meta[name="${n}"]`); if (m && m.content) return m.content; } } catch { }
  try { const v = g.localStorage && (localStorage.getItem('delphi.simApi') || localStorage.getItem('delphi.leanApi')); if (v) return v; } catch { }
  return null;
}

/** Fetch a validation report: live bridge first, else the static file for repository designs. */
export async function fetchReport(design, { base = liveBase(), staticUrl = new URL('validate-static.json', HERE) } = {}) {
  // Accepts: a repository id, an organism document, {organism|specimen, ...}, or perturb.js's context
  // {doc, geometry_edits, ageDays, ...} (geometry-only partedit edits are not in the engine doc; containment results,
  // if present as design.containment [{part, refused}], are passed through).
  let args;
  if (design && typeof design === 'object' && design.doc) args = { organism: design.doc, ...(design.ageDays != null ? { ageDays: design.ageDays } : {}), ...(design.containment ? { containment: design.containment } : {}) };
  else if (design && typeof design === 'object' && ('organism' in design || 'specimen' in design)) args = design;
  else args = { organism: design };
  if (base) {
    const r = await fetch(`${base.replace(/\/+$/, '')}/tool/validate_design`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(args) });
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(j.error || `validate_design: HTTP ${r.status}`);
    return { report: j.result || j, source: `live ${base}` };
  }
  const id = typeof args.organism === 'string' ? args.organism : (args.organism?.edits?.length ? null : args.organism?.base?.parents?.length === 1 ? args.organism.base.parents[0].organism : null);
  const st = await fetch(staticUrl).then(r => (r.ok ? r.json() : null)).catch(() => null);
  const hit = st && id ? st.reports.find(x => x.design_key === id) : null;
  if (!hit) return { report: null, source: 'none', why: 'No live sim-engine bridge is configured, and the static report covers only unedited repository designs (' + (st ? st.reports.map(x => x.design_key).join(', ') : 'static file missing') + '). Start node sim-engine/http.mjs and set DELPHI_SIM_API to validate an edited design.' };
  return { report: hit.report, source: `static ${staticUrl.pathname} (built ${st.built})` };
}

const STATUS_CLS = { passed: 'ok', failed: 'bad', flagged: 'warn', 'could-not-run': 'na' };
function bar(label, c, weight) {
  if (!c || !c.ran) return `<div class="vp-comp na"><span class="vp-cl">${esc(label)}</span><span class="vp-bar"><i style="width:0"></i></span><span class="vp-cv">not run</span><span class="vp-cw">w ${weight}</span><div class="vp-why">${esc(c?.reason || '')}</div></div>`;
  const v = Math.max(0, Math.min(1, c.value));
  return `<div class="vp-comp ${v >= 0.5 ? 'ok' : 'bad'}"><span class="vp-cl">${esc(label)}</span><span class="vp-bar"><i style="width:${(v * 100).toFixed(1)}%"></i></span><span class="vp-cv">${f(c.value)}</span><span class="vp-cw">w ${weight}</span></div>`;
}

/** Pure: report -> HTML (no DOM access), so it can be tested in node. */
export function renderValidate(report, { source = '' } = {}) {
  if (!report) return `<div class="vp"><p class="vp-na">${esc(source)}</p></div>`;
  const s = report.score, C = s.components, W = report.scorer?.weights || {};
  const ph = report.closest_relative_phenotype, L = report.lean_by_component, G = report.closest_relative_genotype;
  const checks = [...(report.sanity?.phenotype || []).map(c => ({ ...c, fam: 'phenotype' })), ...(report.sanity?.genotype || []).map(c => ({ ...c, fam: 'genotype' }))];
  const nb = (b, title) => !b?.ran ? `<p class="vp-na">${esc(title)}: ${esc(b?.reason || 'not run')}</p>` : `<table class="vp-t"><caption>${esc(title)} · p ${f(b.p_value)} · threshold ${f(b.threshold)} (${esc(b.threshold_rule || '')}; n ${b.calibration_n})${b.ood ? ' · <b class="bad">out of distribution</b>' : ''}</caption><tr><th>real relative</th><th>taxon</th><th>distance</th><th>dominant features</th></tr>${b.nearest.slice(0, 5).map(n => `<tr><td>${esc(n.name)}</td><td>${esc(n.taxon)}</td><td>${f(n.distance)}</td><td>${n.dominant_features.map(d => `${esc(d.label)} ${Math.round(d.share * 100)} %`).join('; ')}</td></tr>`).join('')}</table>`;
  const leanRows = (vs, cls) => vs.map(v => `<li class="${cls}"><b>${esc(v.law_id)}</b> v${esc(v.law_version)} [${esc(v.status)}] ${esc(v.constraint)}: ${esc(v.message || '')}</li>`).join('');
  return `<div class="vp">
<div class="vp-card">
 <div class="vp-head"><div class="vp-score ${s.plausible ? 'ok' : 'bad'}">${f(s.value)}</div><div><div class="vp-cls">${s.plausible ? 'within the real range on what was checked' : 'outside the real range on at least one check'}</div><div class="vp-sub">design score v${esc(report.scorer?.version)} · cut 0.5 · ${esc(s.formula)}</div></div></div>
 ${bar('P phenotype vs real relatives' + (C.P?.limiting ? ` (limit: ${C.P.limiting})` : ''), C.P, W.P)}
 ${bar('L Lean: accepted laws newly broken', C.L, W.L)}
 ${bar('G genotype sequence sanity', C.G, W.G)}
 ${bar('S spec', C.S, W.S)}
 ${bar(`E evidence (weakest input: ${C.E?.weakest_kind})`, C.E, W.E)}
 <p class="vp-verdict">${esc(report.verdict.statement)}</p>
 <p class="vp-fine">Weights and formula were fixed in sim-engine/validate/SCORER-PREREGISTRATION.md before the scorer was validated; how it did is in SCORER-RESULTS.md, failures included. Features the scorer does not read (ray and vertebra counts, gills, haemoglobin, density, internal organs beyond the flight-muscle budget) cannot lower it.</p>
</div>
<details open><summary>Closest real relatives</summary>${nb(ph.body, 'Body shape (FishShapes v1 + our organisms and stages)')}${nb(ph.fin, 'Pectoral fin length (Daane 2021 + our organisms)')}
 ${ph.fin_envelope?.outside?.length ? `<p class="warn">Outside the real fin range (uncalibrated envelope): ${ph.fin_envelope.outside.map(o => `${esc(o.label)} ${f(o.design)} vs ${f(o.min)}–${f(o.max)}`).join('; ')}</p>` : ''}<p class="vp-fine">Distance is shape similarity, not relatedness. Birds excluded (frozen holdout).</p></details>
<details open><summary>Checks (${checks.filter(c => c.status === 'passed').length} passed · ${checks.filter(c => c.status === 'failed').length} failed · ${checks.filter(c => c.status === 'flagged').length} flagged · ${checks.filter(c => c.status === 'could-not-run').length} not run)</summary><ul class="vp-checks">${checks.map(c => `<li class="${STATUS_CLS[c.status] || ''}"><b>${esc(c.status)}</b> <code>${esc(c.id)}</code> ${esc(c.detail)}</li>`).join('')}</ul></details>
<details><summary>Lean by component (${esc(L?.lawset_version)})</summary>
 <p><b>Accepted, newly caused by the design:</b></p><ul>${leanRows(L?.accepted?.newly_caused || [], 'bad') || '<li class="ok">none</li>'}</ul>
 <p>Accepted, also violated by a real parent (about the law's reference, not the design):</p><ul>${leanRows(L?.accepted?.also_in_real_parent || [], 'na') || '<li>none</li>'}</ul>
 <p>Candidate (not scored):</p><ul>${leanRows(L?.candidate || [], 'warn') || '<li>none</li>'}</ul><p>Contested (not scored):</p><ul>${leanRows(L?.contested || [], 'warn') || '<li>none</li>'}</ul>
 <table class="vp-t"><tr><th>component</th><th>verdicts</th></tr>${(L?.components || []).map(c => `<tr><td>${esc(c.component.level)}: ${esc(c.component.label || c.component.id)}</td><td>${Object.entries(c.summary).map(([k, v]) => `${esc(k)} ${v}`).join(', ')}</td></tr>`).join('')}</table>
 <p class="vp-fine">${esc(L?.note || '')}</p></details>
<details ${G?.n_edits ? 'open' : ''}><summary>Genotype (${G?.n_edits || 0} gene edit${G?.n_edits === 1 ? '' : 's'})</summary>
 <p class="vp-rule">${esc(G?.state_not_phenotype || '')}</p>
 ${(G?.edits || []).map(e => { const c = e.comparison || {}, a = e.annotations || {}, alt = c.alt_state_in_real_organisms; return `<div class="vp-gene"><b>${esc(e.edit.gene)}</b> <code>${esc(e.edit.raw)}</code> ${e.edit.zygosity ? `(${esc(e.edit.zygosity)})` : ''}
  <div>${e.checks.map(k => `<span class="vp-chip ${STATUS_CLS[k.status] || ''}" title="${esc(k.detail)}">${esc(k.id)}: ${esc(k.status)}</span>`).join(' ')}</div>
  ${c.closest_species ? `<div>Closest species: ${esc(c.closest_species.species)} (${f(c.closest_species.identity_after, 2)} % identity after the edit) · identity to the unedited zebrafish protein ${f(c.identity_to_unedited_zebrafish, 2)} %</div>` : ''}
  ${alt ? `<div>Edited state in a real organism: ${alt.exists ? '<b>yes</b>' : '<b>no</b>'} — natural orthologues: ${(alt.in_natural_orthologues || []).map(x => esc(x.species)).join(', ') || 'none'}; known alleles: ${(alt.known_lab_or_natural_alleles || []).map(x => esc(x.id)).join(', ') || 'none'}</div>` : ''}
  <div class="vp-fine">Causal chain: ${a.causal_chain ? `${esc(a.causal_chain.chain_strength)} (weakest ${esc(a.causal_chain.weakest_grade)})` : 'none recorded'} · ${a.interventions?.length || 0} interventions · ${a.pathways?.n || 0} pathway terms${a.flying_fish_orthologue ? ` · flying-fish protein ${esc(a.flying_fish_orthologue.protein)} (${f(a.flying_fish_orthologue.percent_identity_to_zebrafish, 1)} %${a.flying_fish_orthologue.NOT_AN_ORTHOLOGUE_CALL ? ', NOT an orthologue call' : ''})` : ''}</div></div>`; }).join('') || '<p class="vp-na">No gene-level edits.</p>'}
</details>
<p class="vp-src">Source: ${esc(source)}</p>
</div>`;
}

const CSS = `.vp{font:13px/1.4 system-ui,sans-serif;color:inherit}.vp-card{border:1px solid #8884;border-radius:8px;padding:10px;margin-bottom:8px}
.vp-head{display:flex;gap:12px;align-items:center}.vp-score{font-size:28px;font-weight:700;min-width:72px;text-align:center;border-radius:6px;padding:4px}
.vp-score.ok{background:#2e7d3222}.vp-score.bad{background:#c6282822}.vp-cls{font-weight:600}.vp-sub,.vp-fine,.vp-src{opacity:.7;font-size:11px}
.vp-comp{display:grid;grid-template-columns:minmax(120px,1fr) 120px 48px 40px;gap:6px;align-items:center;margin:3px 0}.vp-why{grid-column:1/-1;opacity:.6;font-size:11px}
.vp-bar{height:8px;background:#8883;border-radius:4px;overflow:hidden}.vp-bar i{display:block;height:100%;background:#2e7d32}.vp-comp.bad .vp-bar i{background:#c62828}
.vp-t{border-collapse:collapse;width:100%;font-size:12px;margin:4px 0}.vp-t td,.vp-t th{border-bottom:1px solid #8883;padding:2px 4px;text-align:left}.vp-t caption{text-align:left;opacity:.8}
.vp-checks{padding-left:16px}.ok b,.vp-chip.ok{color:#2e7d32}.bad,.bad b,.vp-chip.bad{color:#c62828}.warn,.warn b,.vp-chip.warn{color:#b26a00}.na,.vp-na{opacity:.6}
.vp-chip{display:inline-block;border:1px solid currentColor;border-radius:10px;padding:0 6px;margin:1px;font-size:11px}.vp-gene{border-top:1px solid #8883;padding:4px 0}
.vp-rule{font-size:11px;border-left:3px solid #b26a00;padding-left:6px}.vp-verdict{margin:6px 0 2px}`;

/** Mount the panel. Returns {refresh(design), destroy()}. */
export function mountValidate(el, design, opts = {}) {
  if (!el) throw new Error('mountValidate: no element');
  const root = document.createElement('div');
  if (!document.getElementById('vp-css')) { const st = document.createElement('style'); st.id = 'vp-css'; st.textContent = CSS; document.head.appendChild(st); }
  el.appendChild(root);
  let seq = 0;
  async function refresh(d = design) {
    design = d; const my = ++seq;
    root.innerHTML = '<div class="vp"><p class="vp-na">Validating… (closest real relatives, sanity checks, Lean by component, score)</p></div>';
    try {
      const { report, source, why } = await fetchReport(d, opts);
      if (my !== seq) return;
      root.innerHTML = renderValidate(report, { source: report ? source : why });
    } catch (e) { if (my === seq) root.innerHTML = `<div class="vp"><p class="bad">Validation failed: ${esc(e.message)}. A failure is reported as a failure, not as a score.</p></div>`; }
  }
  refresh(design);
  return { refresh, destroy: () => root.remove(), el: root };
}
