// Causal chains gene -> molecular function -> pathway/process -> cell/tissue effect -> phenotype, from
// genotype/causal-chains.json (copied by dashboard/build-graph.mjs into ./causal-chains.json). Each rung carries its
// grade, sources with verbatim quotes, and the fin-subtree node it lands on. The headline is CHAIN STRENGTH, the
// weakest rung's grade; the strongest single rung is shown smaller beside it. The broken rung (missing, hypothesis,
// or the one the file names as weakest_link) is highlighted. All proxy-species work; nothing is flying-fish data.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const GRADE_ORDER = ['missing', 'hypothesis', 'association', 'necessity', 'sufficiency', 'mechanism'];
const GRADE_CLASS = { missing: 'bad', hypothesis: 'warn', association: 'warn', necessity: '', sufficiency: 'ok', mechanism: 'ok' };
const STEP_LABEL = { 'gene->molecular_function': 'gene → molecular function', 'molecular_function->process': 'molecular function → pathway / process', 'process->cell_or_tissue_effect': 'process → cell / tissue effect', 'cell_or_tissue_effect->phenotype': 'cell / tissue effect → phenotype' };
export function normaliseChains(raw) {
  if (!raw) return null;
  const genes = raw.genes || raw.chains || [];
  const bySymbol = {}; const byNode = {};
  for (const g of genes) {
    const chain = (g.chain || []).map(st => ({ step: st.step, label: STEP_LABEL[st.step] || st.step, from: st.from, to: st.to, grade: GRADE_ORDER.includes(st.evidence_grade) ? st.evidence_grade : (st.evidence_grade || 'missing'),
      organism: st.organism || null, experiment: st.experiment_type || null, stage: st.stage || null, notes: st.notes || null, node: st.to_node || st.node || null, node_label: st.to_node_label || st.node_label || null, phenotype: st.phenotype || null,
      sources: (st.sources || []).map(s => ({ pmid: s.pmid || null, doi: s.doi || null, ref: [s.first_author, s.year, s.journal].filter(Boolean).join(' '), title: s.title || null, quote: s.quote || null, read: s.read || null, url: s.pmid ? 'https://pubmed.ncbi.nlm.nih.gov/' + s.pmid + '/' : s.doi ? 'https://doi.org/' + s.doi : null })) }));
    const grades = chain.map(c => c.grade); const idx = x => GRADE_ORDER.indexOf(x);
    const weakest = g.chain_strength || g.weakest_grade || grades.slice().sort((a, b) => idx(a) - idx(b))[0] || 'missing';
    const strongest = g.best_grade || grades.slice().sort((a, b) => idx(b) - idx(a))[0] || null;
    const wl = String(g.weakest_link || ''); const brokenStep = chain.find(c => wl.startsWith(c.step)) || chain.find(c => c.grade === weakest) || null;
    const entry = { symbol: g.symbol, zfin: g.zfin_id || null, other_ids: g.other_ids || null, nodes: g.fin_subtree_nodes || [], chain, weakest, strongest, weakest_link: g.weakest_link || null, broken: brokenStep ? brokenStep.step : null,
      complete: g.chain_complete !== false, deepest: g.deepest_node_with_evidence || null, deepest_level: g.deepest_level || null, gaps: g.gaps || [], n_sources: g.n_sources ?? null, direct: g.direct_or_indirect || null, agent: g.agent || null };
    bySymbol[g.symbol] = entry; for (const n of entry.nodes) (byNode[n] || (byNode[n] = [])).push(g.symbol);
  }
  return { source: 'genotype/causal-chains.json', built: raw.built || null, vetted: raw.vetted === true, note: raw.note || null, constraint: raw.constraint || null, grades: raw.grades || null, coverage: raw.coverage || null, flags: raw.validation_flags || null, unknown: raw.unknown_node_ids || null, cross_gene: raw.cross_gene || [], bySymbol, byNode, n: genes.length };
}
export function gradeChip(g, small) { return `<span class="chip ${GRADE_CLASS[g] || ''}"${small ? ' style="font-size:.68rem"' : ''}>${esc(g)}</span>`; }
// the ladder, as HTML; termLabel(id) -> label or null; links carry data-go (node) and data-g (gene) for the page to wire
export function ladderHtml(C, entry, termLabel) {
  const e = entry; const def = (C.grades || {})[e.weakest] || '';
  let h = `<div class="prov"><b>Chain strength: ${gradeChip(e.weakest)} <span class="tiny">(weakest rung${def ? ': ' + esc(def) : ''})</span>${e.strongest ? ` &nbsp;<span class="tiny">strongest single rung</span> ${gradeChip(e.strongest, true)}` : ''}</b>
    <span class="small">${e.complete ? 'Four-step chain' : '<b>Incomplete chain</b>'}${e.deepest ? `, deepest node with evidence <a class="go" data-go="${esc(e.deepest)}">${esc(termLabel(e.deepest) || e.deepest)}</a> (${esc(e.deepest_level || '')})` : ''}${e.n_sources != null ? `, ${e.n_sources} sources` : ''}${e.direct ? `, ${esc(e.direct)}` : ''}.</span></div>`;
  h += `<div class="ladder">`;
  e.chain.forEach((r, i) => { const broken = r.step === e.broken || r.grade === 'missing';
    h += `<div class="rung${broken ? ' broken' : ''}"><div class="rh"><span class="rn">${i + 1}</span> <b>${esc(r.label)}</b> ${gradeChip(r.grade)}${broken ? '<span class="chip bad">broken rung</span>' : ''}${r.organism ? `<span class="chip">${esc(r.organism)}</span>` : ''}</div>
      <div class="small"><span class="k">from</span> ${esc(r.from || '')}<br><span class="k">to</span> ${esc(r.to || '')}${r.node ? ` &middot; on <a class="go" data-go="${esc(r.node)}">${esc(r.node_label || termLabel(r.node) || r.node)}</a>` : ''}${r.phenotype ? `<br><span class="k">phenotype</span> ${esc(typeof r.phenotype === 'string' ? r.phenotype : JSON.stringify(r.phenotype))}` : ''}</div>
      ${r.experiment ? `<div class="tiny">${esc(r.experiment)}${r.stage ? ' &middot; ' + esc(r.stage) : ''}</div>` : ''}
      ${r.sources.length ? `<details><summary>${r.sources.length} source${r.sources.length === 1 ? '' : 's'}</summary><ul class="t small">${r.sources.map(s => `<li>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.ref || s.pmid || s.doi)}</a>` : esc(s.ref)}${s.title ? ` <span class="tiny">${esc(s.title)}</span>` : ''}${s.read ? ` <span class="tiny">(${esc(s.read)})</span>` : ''}${s.quote ? `<blockquote class="small" style="margin:.3em 0;border-left:3px solid var(--line);padding-left:8px">${esc(s.quote)}</blockquote>` : ' <span class="tiny">(no verbatim quote)</span>'}</li>`).join('')}</ul></details>` : `<div class="small" style="color:var(--bad)">no fetched source for this rung</div>`}
      ${r.notes ? `<details><summary>notes</summary><p class="small">${esc(r.notes)}</p></details>` : ''}</div>`; });
  h += `</div>`;
  if (e.weakest_link) h += `<div class="prov model"><b>Where it breaks</b><span class="small">${esc(e.weakest_link)}</span></div>`;
  if (e.gaps.length) h += `<details><summary>Gaps the file names (${e.gaps.length})</summary><ul class="t small">${e.gaps.map(g => `<li>${esc(g)}</li>`).join('')}</ul></details>`;
  h += `<p class="tiny">${esc(C.constraint || '')} From <span class="mono">${esc(C.source)}</span>${C.built ? ', built ' + esc(C.built) : ''}${C.vetted ? ', vetted' : ''}; grades are the file's: ${Object.entries(C.grades || {}).map(([k, v]) => esc(k) + ' = ' + esc(v)).join('; ')}.</p>`;
  return h;
}
// compact chips for a fin piece: every gene whose chain lands on this node, with its chain strength
export function nodeChainsHtml(C, id) {
  const syms = C.byNode[id] || []; if (!syms.length) return '';
  const idx = g => GRADE_ORDER.indexOf(g);
  return `<div class="sec"><h4>Causal chains landing on this node (${syms.length})</h4><p class="small">${syms.map(s => C.bySymbol[s]).sort((a, b) => idx(b.weakest) - idx(a.weakest)).map(e => `<a class="go gene" data-chain="${esc(e.symbol)}" title="chain strength ${e.weakest}, strongest rung ${e.strongest}">${esc(e.symbol)} ${gradeChip(e.weakest, true)}</a>`).join(' ')}</p><p class="tiny">Chain strength is the weakest rung; click a gene for its ladder. Proxy species only.</p></div>`;
}
