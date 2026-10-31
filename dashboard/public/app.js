(function () {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const G = window.GLOSSARY, C = window.CONTENT;
const PAL = ['#0e7c86', '#d17b0f', '#6b4fb3', '#2f7d4f', '#b3392f', '#3a6fd1', '#9a8a1f', '#c04a8d', '#6a7b78', '#8a5a2b', '#1f9d8a', '#7a3e9d'];
const NS = 'http://www.w3.org/2000/svg';
const el = (n, a = {}, p) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
const pct = x => Math.round(x * 100) + '%';
const last = n => n.split(' ').slice(-1)[0];

// ---------- theme ----------
try { const t = localStorage.getItem('theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) {}
$('#themeBtn').onclick = () => {
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const cur = document.documentElement.dataset.theme || (dark ? 'dark' : 'light');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch (e) {}
};

// ---------- glossary: tooltip, drawer, auto-link ----------
const tip = $('#tip'), drawer = $('#drawer');
function openTerm(k) {
  const g = G[k]; if (!g) return;
  drawer.innerHTML = `<button class="x" aria-label="Close">Close</button><h3>${esc(k)}</h3><p>${esc(g.long)}</p>` +
    `<p><b>Why it matters here.</b> ${esc(g.why)}</p>` +
    (g.see?.length ? `<p class="small mute">Related</p><div class="pill-row">${g.see.map(s => G[s] ? `<button data-go="${esc(s)}">${esc(s)}</button>` : '').join('')}</div>` : '');
  drawer.classList.add('open');
  $('.x', drawer).onclick = () => drawer.classList.remove('open');
  $$('[data-go]', drawer).forEach(b => b.onclick = () => openTerm(b.dataset.go));
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') drawer.classList.remove('open'); });
document.addEventListener('mouseover', e => {
  const t = e.target.closest?.('.term'); if (!t || !G[t.dataset.t]) return;
  tip.textContent = G[t.dataset.t].short; tip.style.display = 'block';
  const r = t.getBoundingClientRect(); tip.style.left = Math.min(innerWidth - 310, Math.max(8, r.left)) + 'px'; tip.style.top = (r.bottom + 6) + 'px';
});
document.addEventListener('mouseout', e => { if (e.target.closest?.('.term')) tip.style.display = 'none'; });
document.addEventListener('click', e => { const t = e.target.closest?.('.term'); if (t) { e.preventDefault(); openTerm(t.dataset.t); } });

function linkTerms(root) {
  const keys = Object.keys(G).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    const re = new RegExp('(^|[^A-Za-z0-9])(' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?![A-Za-z0-9])', 'i');
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.parentElement.closest('.term,a,code,button,summary,script,style,label') ? NodeFilter.FILTER_REJECT : (re.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT)
    });
    const n = w.nextNode(); if (!n) continue;
    const m = re.exec(n.nodeValue); const s = m.index + m[1].length;
    const mid = n.splitText(s); const after = mid.splitText(m[2].length);
    const span = document.createElement('span'); span.className = 'term'; span.dataset.t = k; span.textContent = mid.nodeValue;
    mid.replaceWith(span);
  }
}

// ---------- load ----------
fetch('data.json').then(r => r.json()).then(init).catch(err => { $('#statusline').textContent = 'Could not load data.json: ' + err.message; });

function init(D) {
  const claims = D.claims, S = D.stats;
  const byId = Object.fromEntries(claims.map(c => [c.id, c]));
  const thinkers = Object.entries(S.byThinker).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  const tcol = Object.fromEntries(thinkers.map((t, i) => [t, PAL[i % PAL.length]]));
  const withTest = claims.filter(c => typeof c.testability === 'number').length;
  const nProved = S.byStatus.proved || 0, nRef = S.byStatus.refuted || 0, nPart = S.byStatus.partial || 0;
  const tv = D.tests.reduce((m, t) => (m[t.verdict] = (m[t.verdict] || 0) + 1, m), {});
  $('#builtAt').textContent = new Date(D.built).toUTCString();
  $$('.n880').forEach(e => e.textContent = S.total);
  $('#nClaims').textContent = S.total;

  // KPIs
  $('#kpis').innerHTML = [
    [S.total, 'claims extracted from ' + thinkers.length + ' thinkers'],
    [D.tests.length, 'pre-registered data tests run'],
    [(tv.refutes || 0) + ' / ' + (tv.supports || 0) + ' / ' + (tv.mixed || 0), 'refuted / supported / mixed'],
    [nProved, 'claims proved as math under stated assumptions']
  ].map(([k, l]) => `<div class="card"><div class="kpi">${esc(k)}<small>${esc(l)}</small></div></div>`).join('');
  $('#whereNow').textContent = `${S.total} claims; ${withTest} have testability scores; ${D.tests.length} have a data test; ${nProved} proved, ${nRef} refuted and ${nPart} partial as mathematics or prior evidence; ${D.lean ? D.lean.summary.theoremsCompiling + ' Lean theorems compiling' : (D.leanFiles ?? 0) + ' Lean files'}; ${D.issues.filter(i => i.state === 'open').length} open issues in the collaborators' repo. Claim graph built ${D.graphBuilt}.`;
  $('#statusline').textContent = 'Claim graph built ' + D.graphBuilt + ' (UTC offset not stated by the builder).';

  // countdown
  const end = Date.parse('2026-11-01T18:00:00Z');
  const tick = () => { const ms = end - Date.now(); if (ms <= 0) { $('#countdown').textContent = 'Hacking has ended'; return; } const h = Math.floor(ms / 36e5), m = Math.floor(ms % 36e5 / 6e4), s = Math.floor(ms % 6e4 / 1e3); $('#countdown').textContent = `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`; };
  tick(); setInterval(tick, 1000);

  // threads
  const stCls = { starting: '', working: 'ok', blocked: 'bad', done: 'viol' };
  // A thread may write metrics either as [{value,label}] or as a plain {label: value}
  // object. Accept both: a thread's own status file must never be able to blank this panel.
  const normMetrics = m => Array.isArray(m) ? m
    : (m && typeof m === 'object') ? Object.entries(m).map(([label, value]) => ({ label, value }))
    : [];
  $('#threadGrid').innerHTML = (D.threads || []).map(t => {
    const age = t.updated ? Math.round((Date.now() - Date.parse(t.updated)) / 6e4) : null;
    const stale = age !== null && age > 90 && t.state === 'working';
    return `<div class="card"><h3>${esc(t.title || t.thread)}</h3><div class="pill-row"><span class="chip ${stCls[t.state] || ''}">${esc(t.state)}</span>${stale ? '<span class="chip warn">no update for ' + age + ' min</span>' : ''}</div>
      <p class="small">${esc(t.headline)}</p>
      ${normMetrics(t.metrics).map(m => `<div class="small"><b>${esc(m.value)}</b> ${esc(m.label)}</div>`).join('')}
      ${(t.blockers || []).length ? `<p class="small" style="color:var(--bad)"><b>Blocked:</b> ${t.blockers.map(esc).join('; ')}</p>` : ''}
      ${(t.needs || []).length ? `<p class="small"><b>Needs:</b> ${t.needs.map(n => esc(n.from) + ': ' + esc(n.ask)).join('; ')}</p>` : ''}
      ${t.hasPage ? `<a class="btn" href="t/${esc(t.dir)}/index.html" style="text-decoration:none;display:inline-block;margin-top:6px">Open sub-dashboard</a>` : '<span class="small mute">No sub-dashboard yet</span>'}</div>`;
  }).join('') || '<p class="small mute">No thread has reported yet.</p>';

  // plan
  const metric = {
    claims: `${S.total} claims across ${thinkers.length} thinkers, each with a verbatim quote.`,
    assessed: `${withTest} of ${S.total} claims carry a testability score so far.`,
    tests: `${D.tests.length} tests run: ${tv.refutes || 0} refuted, ${tv.supports || 0} supported, ${tv.mixed || 0} mixed.`,
    lean: D.lean ? `${D.lean.summary.theoremsCompiling} theorems and ${D.lean.summary.lemmas} lemmas compile in Lean 4 with ${D.lean.sorry} sorry and only standard axioms${D.lean.ok ? '' : ' (audit not clean)'}.` : D.leanFiles ? `${D.leanFiles} Lean files in the repo, no report yet.` : 'No Lean files in the repo yet.',
    proved: D.lean ? `${nProved} claims are theorems under stated assumptions (from the literature); ${D.lean.summary.claimsVerified} kernel-checked in Lean so far, not yet assessed for faithfulness to the original statement by an independent model.` : `${nProved} claims are theorems under stated assumptions (from the literature); none machine-checked yet.`,
    sim: 'Not started.',
    holdout: (D.threads || []).find(t => t.thread === 'holdout' && t.state !== 'starting')?.headline || 'Not started as a frozen split. The raw material exists: a merged inventory of 363 taxa (see Species).'
  };
  const doneKey = { claims: 'ok', assessed: 'warn', tests: 'warn', lean: (D.lean || D.leanFiles) ? 'warn' : 'bad', proved: 'warn', sim: 'bad', holdout: (D.threads || []).some(t => t.thread === 'holdout' && t.state !== 'starting') ? 'warn' : 'bad' };
  const doneLabel = { ok: 'in place', warn: 'in progress', bad: 'not started' };
  function renderPlan(dir) {
    const ol = $('#planSteps');
    if (dir === 'f') ol.innerHTML = C.plan.map(p => `<li><b>${esc(p.t)}</b> <span class="chip ${doneKey[p.metric]}">${doneLabel[doneKey[p.metric]]}</span><div class="small mute">${esc(p.d)}</div><div class="small">${esc(metric[p.metric])}</div></li>`).join('');
    else ol.innerHTML = C.backward.map(t => `<li>${esc(t)}</li>`).join('');
  }
  renderPlan('f');
  $$('#dirToggle button').forEach(b => b.onclick = () => { $$('#dirToggle button').forEach(x => x.classList.toggle('on', x === b)); renderPlan(b.dataset.d); linkTerms($('#planSteps')); });

  // bar charts
  function bars(host, entries, colors) {
    const max = Math.max(...entries.map(e => e[1]));
    host.innerHTML = entries.map(([k, v]) => `<div style="display:grid;grid-template-columns:150px 1fr 44px;gap:8px;align-items:center;margin:4px 0;font-size:.9rem"><span>${esc(k)}</span><div class="bar"><i style="width:${v / max * 100}%;background:${colors?.[k] || 'var(--accent)'}"></i></div><b>${v}</b></div>`).join('');
  }
  bars($('#chThinker'), thinkers.map(t => [t, S.byThinker[t]]), tcol);
  const stCol = { untested: 'var(--mute)', proved: 'var(--ok)', refuted: 'var(--bad)', partial: 'var(--warn)' };
  bars($('#chStatus'), Object.entries(S.byStatus).sort((a, b) => b[1] - a[1]), stCol);

  // scatter
  const svg = $('#scatter'), X0 = 70, X1 = 740, Y0 = 20, Y1 = 320;
  const kinds = Object.keys(S.byKind), statuses = Object.keys(S.byStatus);
  const sx = c => typeof c.testability === 'number' ? X0 + c.testability * (X1 - X0) : 36;
  const sy = c => Y1 - c.truth * (Y1 - Y0);
  let colorBy = 'thinker';
  const colorOf = c => colorBy === 'thinker' ? tcol[c.thinker] : colorBy === 'status' ? stCol[c.status] : PAL[kinds.indexOf(c.kind) % PAL.length];
  const dots = [];
  function drawScatter() {
    svg.innerHTML = '';
    el('line', { x1: X0, y1: Y1, x2: X1, y2: Y1, stroke: 'var(--line)' }, svg); el('line', { x1: X0, y1: Y0, x2: X0, y2: Y1, stroke: 'var(--line)' }, svg);
    [0, .25, .5, .75, 1].forEach(v => { const x = X0 + v * (X1 - X0); el('line', { x1: x, y1: Y1, x2: x, y2: Y1 + 4, stroke: 'var(--mute)' }, svg); el('text', { x, y: Y1 + 18, 'text-anchor': 'middle', 'font-size': 11 }, svg).textContent = v; });
    [0, .25, .5, .75, 1].forEach(v => { const y = Y1 - v * (Y1 - Y0); el('line', { x1: X0 - 4, y1: y, x2: X0, y2: y, stroke: 'var(--mute)' }, svg); el('text', { x: X0 - 8, y: y + 4, 'text-anchor': 'end', 'font-size': 11 }, svg).textContent = v; });
    el('text', { x: 400, y: 356, 'text-anchor': 'middle', 'font-size': 12 }, svg).textContent = 'Testability with existing data (assessors)';
    el('text', { x: 14, y: 170, 'font-size': 12, transform: 'rotate(-90 14 170)', 'text-anchor': 'middle' }, svg).textContent = 'Truth score';
    el('text', { x: 36, y: Y1 + 18, 'text-anchor': 'middle', 'font-size': 10 }, svg).textContent = 'none';
    const jit = i => ((i * 2654435761 % 1000) / 1000 - .5) * 16;
    claims.forEach((c, i) => {
      const cx = sx(c) + (typeof c.testability === 'number' ? 0 : jit(i)), cy = sy(c);
      const d = el('circle', { cx, cy, r: 3.2, fill: colorOf(c), 'fill-opacity': .62, stroke: 'none', tabindex: -1 }, svg);
      d.onmouseenter = ev => { tip.textContent = `${c.label} — ${c.thinker}, truth ${c.truth.toFixed(2)}` + (typeof c.testability === 'number' ? `, testability ${c.testability.toFixed(2)}` : ''); tip.style.display = 'block'; const r = d.getBoundingClientRect(); tip.style.left = Math.min(innerWidth - 310, r.left) + 'px'; tip.style.top = (r.bottom + 6) + 'px'; d.setAttribute('r', 6); };
      d.onmouseleave = () => { tip.style.display = 'none'; d.setAttribute('r', 3.2); };
      d.onclick = () => { $('#scatterPin').innerHTML = `<b>${esc(c.label)}</b> <span class="chip">${esc(c.thinker)}</span> <span class="chip">${esc(c.status)}</span><br>${esc(c.statement)}`; };
    });
    const keys = colorBy === 'thinker' ? thinkers : colorBy === 'status' ? statuses : kinds;
    $('#scatterLegend').innerHTML = keys.map((k, i) => `<span><i style="background:${colorBy === 'thinker' ? tcol[k] : colorBy === 'status' ? stCol[k] : PAL[i % PAL.length]}"></i>${esc(k)}</span>`).join('');
  }
  drawScatter();
  $$('#scatterBy button').forEach(b => b.onclick = () => { colorBy = b.dataset.k; $$('#scatterBy button').forEach(x => x.classList.toggle('on', x === b)); drawScatter(); });

  // timeline
  (function () {
    const t = $('#timeline'), g = {};
    claims.forEach(c => { const k = c.thinker + '|' + c.year; (g[k] ||= { thinker: c.thinker, year: c.year, n: 0, work: c.work }).n++; });
    const items = Object.values(g).sort((a, b) => a.year - b.year);
    const x = y => 30 + (y - 1850) / (2010 - 1850) * 700;
    el('line', { x1: 30, y1: 75, x2: 730, y2: 75, stroke: 'var(--line)', 'stroke-width': 2 }, t);
    for (let y = 1850; y <= 2010; y += 20) { el('text', { x: x(y), y: 140, 'text-anchor': 'middle', 'font-size': 10 }, t).textContent = y; }
    items.forEach((it, i) => {
      const r = 4 + Math.sqrt(it.n) * 1.1, up = true;
      const c = el('circle', { cx: x(it.year), cy: 75, r, fill: tcol[it.thinker], 'fill-opacity': .75 }, t);
      c.onmouseenter = () => { tip.textContent = `${it.work} (${it.year}): ${it.n} claim${it.n > 1 ? 's' : ''}`; tip.style.display = 'block'; const b = c.getBoundingClientRect(); tip.style.left = Math.min(innerWidth - 310, b.left) + 'px'; tip.style.top = (b.bottom + 6) + 'px'; };
      c.onmouseleave = () => tip.style.display = 'none';
      if (it.n > 2) el('text', { x: x(it.year), y: 75 - r - 6, 'text-anchor': 'middle', 'font-size': 10 }, t).textContent = last(it.thinker) + ' ' + it.year;
    });
  })();

  // claim browser
  const fT = $('#fThinker'), fS = $('#fStatus'), fK = $('#fKind');
  const opt = (sel, all, vals) => sel.innerHTML = `<option value="">${all}</option>` + vals.map(v => `<option>${esc(v)}</option>`).join('');
  opt(fT, 'All thinkers', thinkers); opt(fS, 'All statuses', statuses); opt(fK, 'All kinds', kinds);
  let shown = 25, list = [];
  function renderClaims() {
    const q = $('#q').value.trim().toLowerCase();
    list = claims.filter(c => (!fT.value || c.thinker === fT.value) && (!fS.value || c.status === fS.value) && (!fK.value || c.kind === fK.value) && (!q || (c.label + ' ' + c.statement + ' ' + c.quote).toLowerCase().includes(q)));
    const k = $('#fSort').value;
    list.sort((a, b) => k === 'year' ? a.year - b.year : (b[k] ?? -1) - (a[k] ?? -1));
    $('#qcount').textContent = `${list.length} claims match`;
    $('#claimList').innerHTML = list.slice(0, shown).map(c => `<details><summary>${esc(c.label)} <span class="chip" style="border-color:${tcol[c.thinker]}">${esc(last(c.thinker))} ${c.year}</span> <span class="chip ${c.status === 'proved' ? 'ok' : c.status === 'refuted' ? 'bad' : ''}">${esc(c.status)}</span></summary><div class="in"><p>${esc(c.statement)}</p><div class="quote">${esc(c.quote)}<br><span class="small">${esc(c.work)}, ${esc(c.chapter)}</span></div><p class="small">Kind: ${esc(c.kind)} &middot; Truth: ${c.truth.toFixed(2)}${c.truthBy.length ? ' (' + c.truthBy.map(t => esc(t.a) + ' ' + t.p).join(', ') + ')' : ''}${typeof c.testability === 'number' ? ' &middot; Testability: ' + c.testability.toFixed(2) : ''}${c.registry ? ' &middot; Registry: ' + esc(c.registry) : ''} &middot; <a href="${esc(c.np)}" target="_blank" rel="noopener">nanopub</a></p></div></details>`).join('');
    $('#moreBtn').style.display = shown >= list.length ? 'none' : '';
  }
  ['#q', '#fThinker', '#fStatus', '#fKind', '#fSort'].forEach(s => $(s).addEventListener('input', () => { shown = 25; renderClaims(); }));
  $('#moreBtn').onclick = () => { shown += 50; renderClaims(); };
  renderClaims();

  // evidence
  $('#testCards').innerHTML = D.tests.map(t => {
    const c = byId[t.claim_id], m = t.measured || {};
    const vc = t.verdict === 'supports' ? 'ok' : t.verdict === 'refutes' ? 'bad' : 'warn';
    const verdictWord = { supports: 'Supported', refutes: 'Refuted', mixed: 'Mixed' }[t.verdict] || t.verdict;
    return `<div class="card"><h3>${esc(c ? c.label : t.claim_id)}</h3><div class="pill-row"><span class="chip ${vc}">${esc(verdictWord)}</span>${c ? `<span class="chip">assessors expected P(true) = ${c.truth.toFixed(2)}</span>` : ''}<span class="chip">${esc(t.project)}</span></div>
    <p class="small"><b>Hypothesis.</b> ${esc(t.hypothesis)}</p>
    <details><summary>Pre-registered criteria</summary><div class="in small"><p><b>Pass:</b> ${esc(t.pass)}</p><p><b>Fail:</b> ${esc(t.fail)}</p><p><b>Interpretation:</b> ${esc(t.interpretation)}</p></div></details>
    <p class="small"><b>Measured:</b> ${esc(typeof m.value === 'number' ? +m.value.toFixed(3) : m.value)} <span class="mute">${esc(m.unit || '')}</span><br><b>Sample:</b> ${esc(m.n)}</p>
    ${t.datasets.length ? `<p class="small mute">Data: ${t.datasets.map(d => d.url ? `<a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.name)}</a>` : esc(d.name)).join('; ')}</p>` : ''}</div>`;
  }).join('');

  (function () {
    const dec = D.tests.filter(t => t.verdict === 'supports' || t.verdict === 'refutes').map(t => ({ t, c: byId[t.claim_id] })).filter(x => x.c);
    const right = dec.filter(x => (x.c.truth >= 0.5) === (x.t.verdict === 'supports')).length;
    $('#calib').innerHTML = `<b>Calibration check.</b> The assessors' prior pointed the right way in ${right} of ${dec.length} decisive tests (a prior at or above 0.50 counts as predicting support). With so few tests this is an anecdote, but it is the number to watch as more tests land.`;
  })();

  // swarm
  const SW = D.swarm, fields = D.roster?.serendipity_fields || [];
  if (SW) {
    $('#swarmNote').innerHTML = `<span class="chip warn">${esc(SW.mode)}</span> ${esc(SW.note)}`;
    $('#tick').max = SW.log.length; $('#tick').value = 1;
    const qs = SW.queens;
    function drawOrg() {
      const t = +$('#tick').value; $('#tickV').textContent = t;
      const s = $('#orgSvg'); s.innerHTML = '';
      const spawn = SW.log.flatMap(l => l.events).find(e => e.action === 'spawn-king');
      const nK = spawn && t >= spawn.tick ? SW.kings.length : 1;
      const links = new Set();
      SW.log.slice(0, t).flatMap(l => l.events).forEach(e => { if (e.action === 'link') links.add(e.target); if (e.action === 'unlink') links.delete(e.target); });
      const nov = SW.log[t - 1].novelty, qx = i => 50 + i * (660 / (qs.length - 1)), ey = 30, ky = 105, qy = 230;
      const kx = i => 380 + (i - (nK - 1) / 2) * 260;
      const col = v => v >= .4 ? 'var(--ok)' : v >= .25 ? 'var(--warn)' : 'var(--bad)';
      qs.forEach((q, i) => { const k = i % nK; el('line', { x1: kx(k), y1: ky + 14, x2: qx(i), y2: qy - 16, stroke: 'var(--line)', 'stroke-width': 1.5 }, s); });
      links.forEach(l => { const [a, b] = l.split('~'), ia = qs.findIndex(q => q.id === a), ib = qs.findIndex(q => q.id === b); if (ia < 0 || ib < 0) return; const mx = (qx(ia) + qx(ib)) / 2; el('path', { d: `M${qx(ia)} ${qy + 16} Q${mx} ${qy + 70 + Math.abs(ia - ib) * 6} ${qx(ib)} ${qy + 16}`, fill: 'none', stroke: 'var(--viol)', 'stroke-dasharray': '4 3', 'stroke-width': 1.5 }, s); });
      for (let k = 0; k < nK; k++) el('line', { x1: 380, y1: ey + 14, x2: kx(k), y2: ky - 14, stroke: 'var(--line)', 'stroke-width': 1.5 }, s);
      const node = (x, y, w, h, label, fill, sub) => { el('rect', { x: x - w / 2, y: y - h / 2, width: w, height: h, rx: 8, fill: fill || 'var(--panel)', stroke: 'var(--line)' }, s); el('text', { x, y: y + 4, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 600 }, s).textContent = label; if (sub) el('text', { x, y: y + h / 2 + 12, 'text-anchor': 'middle', 'font-size': 9 }, s).textContent = sub; };
      node(380, ey, 120, 28, 'EMPEROR', 'var(--soft)');
      for (let k = 0; k < nK; k++) node(kx(k), ky, 120, 28, 'KING ' + (k + 1), 'var(--soft)');
      qs.forEach((q, i) => { el('rect', { x: qx(i) - 38, y: qy - 16, width: 76, height: 32, rx: 8, fill: 'var(--panel)', stroke: col(nov[q.id]), 'stroke-width': 3 }, s); el('text', { x: qx(i), y: qy - 2, 'text-anchor': 'middle', 'font-size': 9.5, 'font-weight': 600 }, s).textContent = q.id.replace('q-', ''); el('text', { x: qx(i), y: qy + 10, 'text-anchor': 'middle', 'font-size': 9 }, s).textContent = 'novelty ' + nov[q.id].toFixed(2); el('text', { x: qx(i), y: qy + 32, 'text-anchor': 'middle', 'font-size': 9 }, s).textContent = (q.workers?.length || 0) + ' workers'; });
      const ev = SW.log.slice(0, t).flatMap(l => l.events).reverse();
      $('#feed').innerHTML = ev.map(e => `<div style="padding:3px 0;border-bottom:1px solid var(--line)"><span class="chip ${e.actor === 'emperor' ? 'viol' : 'warn'}">t${e.tick} ${esc(e.actor)}</span> <b>${esc(e.action)}</b> ${esc(e.target)}${e.field ? ` &rarr; <i>${esc(e.field)}</i>: ${esc(e.prompt)}` : ` &mdash; ${esc(e.reason || '')}`}</div>`).join('') || '<span class="mute">No events yet.</span>';
    }
    $('#tick').oninput = drawOrg; drawOrg();
  }
  if (SW && SW.arms) {
    const order = ['single', 'isolated', 'centralized', 'decentralized'], A = order.map(k => SW.arms[k]).filter(Boolean);
    $('#armsCard').style.display = '';
    $('#armsNote').textContent = `Same ${A[0].claims} claims, same model (${A[0].model}), same budget cap, scoring fixed before the runs. "Verified" means the named dataset identifier resolved.`;
    $('#armsTable').innerHTML = '<tr><th>Arm</th><th>Verified</th><th>Fabricated ids</th><th>Untouched</th><th>Minutes</th><th>Cost (list)</th><th>Web requests</th></tr>' + A.map(r => `<tr><td><b>${esc(r.arm)}</b></td><td>${r.verified} / ${r.claims}</td><td><span class="chip ${r.fabricated_identifiers ? 'bad' : 'ok'}">${r.fabricated_identifiers}</span></td><td>${r.untouched}</td><td>${r.minutes_wall}</td><td>$${(+r.cost_usd_list).toFixed(2)}</td><td>${(r.web_requests?.search || 0) + (r.web_requests?.fetch || 0)}</td></tr>`).join('');
    $('#armsVerdicts').innerHTML = (SW.comparisons || []).map(c => `<div>${esc(c.a)} (${c.a_verified}) vs ${esc(c.b)} (${c.b_verified}): <b>${esc(c.verdict)}</b></div>`).join('') + (A.some(r => r.fabricated_identifiers) ? '<div class="small mute">An arm with a fabricated identifier cannot win under the pre-registered rule, whatever its count.</div>' : '');
  }
  $('#spin').onclick = () => { if (!fields.length) return; const f = fields[Math.floor(Math.random() * fields.length)]; $('#spinOut').innerHTML = `<span class="chip viol">${esc(f.field)}</span><p>${esc(f.prompt)}</p>`; };

  // rubric
  const R = [['Problem Significance & Complexity', 20], ['Scientific/Technical Impact', 25], ['Decentralized Agency', 20], ['Collective Capability', 25], ['Execution and Validation', 10]];
  const rv = R.map(() => 5);
  $('#rubric').innerHTML = R.map((r, i) => `<label class="row"><span class="n">${esc(r[0])} (${r[1]}%): <b id="rv${i}">5</b></span><input type="range" min="0" max="10" value="5" data-i="${i}"></label>`).join('');
  const rt = () => { const t = R.reduce((s, r, i) => s + r[1] * rv[i] / 10, 0); $('#rubricTotal').innerHTML = `${t.toFixed(1)} / 100 <small class="mute" style="font-size:.8rem;font-weight:400">self-assessed, plus up to +10 collaboration bonus</small>`; };
  $$('#rubric input').forEach(i => i.oninput = () => { rv[+i.dataset.i] = +i.value; $('#rv' + i.dataset.i).textContent = i.value; rt(); }); rt();

  // issues
  $('#issueList').innerHTML = D.issues.length ? `<table>${D.issues.map(i => `<tr><td>#${i.n}</td><td><a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.title)}</a></td><td><span class="chip ${i.state === 'open' ? 'ok' : ''}">${esc(i.state)}</span></td></tr>`).join('')}</table>` : 'Issue list unavailable at build time.';

  // risks, analogies, recs, sources
  $('#riskGrid').innerHTML = C.risks.map(r => `<div class="card prose"><span class="chip ${r.c}">${r.c === 'bad' ? 'high' : r.c === 'warn' ? 'medium' : 'watch'}</span><h3 style="margin-top:6px">${esc(r.t)}</h3><p class="small">${esc(r.d)}</p></div>`).join('');
  $('#analogyList').innerHTML = C.analogies.map(a => `<details><summary>${esc(a.ch)} <span class="chip viol">${esc(a.f)}</span></summary><div class="in prose"><p><b>${esc(a.h)}.</b> ${esc(a.d)}</p></div></details>`).join('');
  $('#recList').innerHTML = C.recs.map((r, i) => `<details ${i < 2 ? 'open' : ''}><summary>${i + 1}. ${esc(r.r)}</summary><div class="in prose"><p><span class="chip">${esc(r.w)}</span></p><p><b>The fun part.</b> ${esc(r.f)}</p><p><b>How.</b> ${esc(r.how)}</p></div></details>`).join('');
  $('#srcTable').insertAdjacentHTML('beforeend', C.sources.map(s => `<tr><td>${esc(s.f)}</td><td>${/^https?:/.test(s.s) ? `<a href="${esc(s.s)}" target="_blank" rel="noopener">${esc(s.s)}</a>` : esc(s.s)}</td><td>${esc(s.v)}</td></tr>`).join(''));

  // scales
  const SC = [['Body', 'The whole organism: body plan, axes, symmetry, size. Edges: has-part organ systems.'], ['Organ system', 'Groups of organs with a joint function, such as nervous or circulatory. Anatomy ontologies like Uberon already name these across species.'], ['Organ', 'A structure such as heart or eye, built from several tissues.'], ['Tissue', 'A sheet or mass of similar cells doing one job, such as epithelium or muscle.'], ['Cell', 'Cell types, such as neuron or hepatocyte, each with expressed genes. The Cell Ontology names them. This is where the link to the genome is most direct.']];
  const sv = $('#scalesSvg');
  SC.forEach((s, i) => { const w = 360 - i * 50, x = (400 - w) / 2, y = 8 + i * 44; const r = el('rect', { x, y, width: w, height: 36, rx: 8, fill: 'var(--soft)', stroke: PAL[i], 'stroke-width': 2, style: 'cursor:pointer' }, sv); const t = el('text', { x: 200, y: y + 23, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600, style: 'cursor:pointer;pointer-events:none' }, sv); t.textContent = s[0]; r.onclick = () => { $('#scaleInfo').textContent = s[1]; }; });
  $('#scaleInfo').textContent = 'Click a level.';

  // nav highlight
  const links = $$('#nav a'), io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-40% 0px -55% 0px' });
  $$('main section').forEach(s => io.observe(s));

  // link terms last
  $$('.prose').forEach(linkTerms);
  window.DELPHI = { D, openTerm };
  document.dispatchEvent(new Event('delphi-ready'));
}
})();
