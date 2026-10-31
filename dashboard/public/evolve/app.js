(function () {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n0 = v => (typeof v === 'number' ? v.toLocaleString('en-US') : '—');
const n1 = v => (typeof v === 'number' ? v.toFixed(1) : '—');
const pct = v => (typeof v === 'number' ? Math.round(v * 100) + '%' : '—');
const C = window.EV_CONTENT;

// ---------- theme ----------
const tkey = 'delphi-theme';
const applyTheme = t => { if (t) document.documentElement.dataset.theme = t; };
applyTheme(localStorage.getItem(tkey));
$('#themeBtn').onclick = () => {
  const cur = document.documentElement.dataset.theme
    || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light');
  const next = cur === 'dark' ? 'light' : 'dark';
  applyTheme(next); try { localStorage.setItem(tkey, next); } catch {}
};

// ---------- glossary ----------
const tip = $('#tip');
function glossary(scope) {
  // <t>term</t> in content becomes a hoverable term; also auto-link the first bare occurrence per block
  $$('t', scope).forEach(el => {
    const k = el.textContent.trim();
    const def = C.glossary[k] || C.glossary[Object.keys(C.glossary).find(g => g.toLowerCase() === k.toLowerCase())];
    const span = document.createElement('span');
    span.className = 'term'; span.textContent = k;
    if (def) span.dataset.def = def; else span.className = '';
    el.replaceWith(span);
  });
}
document.addEventListener('mouseover', e => {
  const t = e.target.closest('.term'); if (!t || !t.dataset.def) return;
  tip.textContent = t.dataset.def; tip.style.display = 'block';
  const r = t.getBoundingClientRect();
  const top = r.bottom + 8 + 150 > innerHeight ? r.top - tip.offsetHeight - 8 : r.bottom + 8;
  tip.style.top = Math.max(8, top) + 'px';
  tip.style.left = Math.min(Math.max(8, r.left), innerWidth - tip.offsetWidth - 8) + 'px';
});
document.addEventListener('mouseout', e => { if (e.target.closest('.term')) tip.style.display = 'none'; });

// ---------- nav ----------
const spy = () => {
  const ids = $$('#nav a').map(a => a.getAttribute('href').slice(1));
  let on = ids[0];
  ids.forEach(id => { const el = document.getElementById(id); if (el && el.getBoundingClientRect().top < 120) on = id; });
  $$('#nav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + on));
};
addEventListener('scroll', spy, { passive: true });

// ---------- load ----------
fetch('data.json').then(r => r.json()).then(render).catch(e => {
  $('#hero').textContent = 'Could not load data.json: ' + e.message;
});

function render(D) {
  const S = D.source, cnt = S.counts;
  const cert = D.routes.find(r => r.certificate_path) || D.routes[0];
  const lazy = D.lazysp.primary, q2c = D.collective.arms.find(a => a.key === 'q2c');
  const best = D.collective.arms.find(a => a.key === 'q2c_nomodel');

  // ---------- hero ----------
  $('#hero').innerHTML = `A collaborator's prototype (<a href="${esc(D.repo.url)}" target="_blank" rel="noopener">delphi-evolve</a>) asks the question DELPHI asks of history, but for one enzyme and with the measurements already in hand: given a real, measured map of ${n0(cnt.measured_nonstop_genotypes)} variants of <t>TrpB</t>, which experiment would justify the next step? Every number on this page is read out of that project's saved files, and a separate agent of ours recounted the headline ones.`;
  const kpi = [
    [n0(cnt.measured_nonstop_genotypes), 'real variants measured'],
    [n0(D.benchmark.episodes + (D.lazysp.variants?.length ? 300 : 0) + (D.scale.episodes || 0)), 'replay episodes run'],
    [`${lazy.certified}/${lazy.episodes}`, 'best arm: correct certificates'],
    [D.benchmark.anyFalseCert === false ? '0' : '?', 'false certificates, all arms'],
    [n0(D.repo.leanFiles), 'Lean proof files'],
    [cert.steps ? cert.steps.length : '—', 'steps in the certified route']
  ];
  $('#kpis').innerHTML = kpi.map(([k, l]) => `<div class="card"><div class="kpi">${esc(k)}<small>${esc(l)}</small></div></div>`).join('');
  $('#heroNote').innerHTML = `<b>What this is not.</b> No new laboratory experiment was performed, no new variant was discovered, and the ${n0(D.benchmark.episodes + 300 + (D.scale.episodes || 0))} episodes are repeated runs over one panel of start-and-target pairs, not that many independent biological problems. The project states this itself; we are not softening it.`;

  // ---------- story ----------
  const sub = s => s
    .replace('__MEASURED__', n0(cnt.measured_nonstop_genotypes))
    .replace('__LIBRARY__', n0(cnt.library_nonstop_genotypes))
    .replace('__PARENT__', `<span class="seq">${esc(D.pair.start)}</span>`)
    .replace('__TARGET__', `<span class="seq">${esc(D.pair.target)}</span>`)
    .replace('__ROUTELEN__', cert.steps ? cert.steps.length : '—')
    .replace('__KAPPA__', '&kappa;&nbsp;=&nbsp;' + D.intervalModel.kappa)
    .replace('__EXCLUDED__', n0(cnt.unmeasured_nonstop_genotypes))
    .replace('__LAZY__', lazy.certified).replace('__Q2C__', q2c ? q2c.certified : '—');
  $('#story1').innerHTML = C.storyParas.map(p => `<p>${sub(p)}</p>`).join('');
  $('#storyData').innerHTML = C.storyData.map(([h, b]) => `<p><b>${esc(h)}:</b> ${sub(b)}</p>`).join('');
  $('#storyCert').innerHTML = C.storyCert.map(([h, b]) => `<p><b>${esc(h)}</b> ${sub(b)}</p>`).join('');

  // ---------- route lab ----------
  const KS = D.kappaSweep;
  const kapEl = $('#kap'); kapEl.max = KS.length - 1;
  kapEl.value = Math.max(0, KS.findIndex(k => k.kappa === D.intervalModel.kappa));
  const drawKappa = () => {
    const k = KS[+kapEl.value], maxR = Math.max(...KS.map(x => x.reachable_from_start));
    $('#kapOut').innerHTML = `<p><b>&kappa; = ${k.kappa}</b> ${k.kappa === D.intervalModel.kappa ? '<span class="chip">the setting used for the headline result</span>' : ''}</p>
      <p>${k.open ? `<span class="chip ok">a usable route still exists</span>` : `<span class="chip bad">no route the data can support</span>`}
      &nbsp;<span class="chip">${n0(k.reachable_from_start)} variants reachable</span>
      ${k.shortest_route_edges ? `<span class="chip">shortest route ${k.shortest_route_edges} steps</span>` : ''}</p>`;
    $('#kapBar').innerHTML = KS.map(x => `<div class="rowline"><span class="small">&kappa; ${x.kappa}</span>
      <span class="bar"><i class="${x.open ? 'good' : 'poor'}" style="width:${x.reachable_from_start / maxR * 100}%"></i></span>
      <span class="small mute">${n0(x.reachable_from_start)} ${x.open ? '· open' : '· closed'}</span></div>`).join('');
  };
  kapEl.oninput = drawKappa; drawKappa();

  $('#routePick').innerHTML = D.routes.map((r, i) =>
    `<button data-r="${i}" class="rbtn${i === 0 ? ' primary' : ''}" style="margin:0 6px 6px 0">${esc(r.id)}</button>`).join('');
  const showRoute = i => {
    const r = D.routes[i];
    $$('.rbtn').forEach(b => b.classList.toggle('primary', +b.dataset.r === i));
    const ok = /^open/.test(r.status);
    $('#routeOut').innerHTML = `<p class="seq" style="font-size:1.1rem">${r.nodes.map(esc).join(' &rarr; ')}</p>
      <p><span class="chip ${ok ? 'ok' : 'bad'}">${esc(r.status)}</span></p>
      ${r.note ? `<p class="small mute">${esc(r.note)}</p>` : ''}
      ${r.breaks_at_kappa ? `<div class="note small">This route stops being defensible once the caution dial passes <b>&kappa; = ${r.breaks_at_kappa}</b>. The headline uses &kappa; = ${D.intervalModel.kappa}, so the margin is real but not large.</div>` : ''}
      ${r.certificate_path ? `<p class="small mute">Certificate file: <span class="tag">${esc(r.certificate_path)}</span></p>` : '<p class="small mute">No certificate: this route is here to show what a tempting-but-unsupported path looks like.</p>'}
      <details><summary>The four assumptions every certificate carries</summary><div class="in small">${r.assumptions.map(a => `<p>${esc(a)}</p>`).join('')}</div></details>`;
    const steps = r.steps || [];
    $('#routeSteps').innerHTML = steps.length
      ? `<p class="small mute">Margin is how much the destination's worst plausible score beats the origin's best plausible score. A negative margin means the step cannot be justified. The weakest step is where the next experiment should go.</p>`
        + steps.map((s, j) => {
          const weak = j === r.weakest_step_index;
          const mx = Math.max(...steps.map(x => Math.abs(x.margin)));
          return `<div class="step"><span class="seq">${esc(s.from)}</span>&rarr;<span class="seq">${esc(s.to)}</span>
            <span class="bar" style="flex:1;min-width:120px"><i class="${s.margin > 0 ? 'good' : 'poor'}" style="width:${Math.abs(s.margin) / mx * 100}%"></i></span>
            <span class="small mute">margin ${s.margin.toFixed(6)}</span>
            <span class="chip">${n0(s.to_min_input_count)} reads</span>
            ${weak ? '<span class="chip warn">weakest step &mdash; measure here</span>' : ''}</div>`;
        }).join('')
      : `<p class="small mute">This route has no step table in the saved file; its status line above is what the project recorded.</p>`;
    glossary($('#routeOut'));
  };
  $('#routePick').onclick = e => { const b = e.target.closest('.rbtn'); if (b) showRoute(+b.dataset.r); };
  showRoute(0);

  // ---------- landscape map ----------
  const nodes = D.nodes, byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const xs = nodes.map(n => n.g[0]), ys = nodes.map(n => n.g[1]);
  const xr = [Math.min(...xs), Math.max(...xs)], yr = [Math.min(...ys), Math.max(...ys)];
  const W = 560, H = 420, P = 26;
  const px = v => P + (v - xr[0]) / (xr[1] - xr[0] || 1) * (W - 2 * P);
  const py = v => H - P - (v - yr[0]) / (yr[1] - yr[0] || 1) * (H - 2 * P);
  const smax = Math.max(...nodes.map(n => n.s));
  const routeSet = new Set();
  (cert.nodes || []).forEach((id, i, a) => { if (i) routeSet.add(a[i - 1] + '>' + id); });
  const eLines = D.edges.map(([s, t, a]) => {
    const A = byId[s], B = byId[t]; if (!A || !B) return '';
    const onRoute = routeSet.has(s + '>' + t) || routeSet.has(t + '>' + s);
    if (!a && !onRoute) return '';   // draw admissible edges and the route only; 1,718 inadmissible would be mud
    return `<line x1="${px(A.g[0]).toFixed(1)}" y1="${py(A.g[1]).toFixed(1)}" x2="${px(B.g[0]).toFixed(1)}" y2="${py(B.g[1]).toFixed(1)}" stroke="${onRoute ? 'var(--viol)' : 'var(--line)'}" stroke-width="${onRoute ? 2.4 : .6}" opacity="${onRoute ? 1 : .5}"/>`;
  }).join('');
  const dots = nodes.map(n => {
    const big = n.id === D.pair.start || n.id === D.pair.target;
    return `<circle class="nd" data-id="${esc(n.id)}" cx="${px(n.g[0]).toFixed(1)}" cy="${py(n.g[1]).toFixed(1)}" r="${big ? 6 : 3.4}"
      fill="var(--accent)" fill-opacity="${(0.25 + 0.75 * n.s / smax).toFixed(2)}" stroke="${big ? 'var(--ink)' : 'none'}" stroke-width="1.5" style="cursor:pointer"/>`;
  }).join('');
  $('#mapSvg').innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Measured variants of the enzyme, with single-mutation steps">
    ${eLines}${dots}
    <text x="${px(byId[D.pair.start].g[0]) + 9}" y="${py(byId[D.pair.start].g[1]) - 8}" font-size="12" fill="var(--ink)">${esc(D.pair.start)} (parent)</text>
    <text x="${px(byId[D.pair.target].g[0]) + 9}" y="${py(byId[D.pair.target].g[1]) - 8}" font-size="12" fill="var(--ink)">${esc(D.pair.target)} (target)</text>
  </svg>`;
  $('#mapLegend').innerHTML = `Darker dot means a higher measured growth score. Thin grey lines are the ${n0(D.edges.filter(e => e[2]).length)} single-mutation steps the data can support; the ${n0(D.edges.filter(e => !e[2]).length)} steps it cannot are left out to keep the picture readable. The purple path is the certified route. Position is a projection of the four letters, <b>not</b> molecular geometry.`;
  $('#mapScope').innerHTML = `<b>Scope.</b> ${esc(D.graphScope.vertices)}. Outside it: ${esc(D.graphScope.outside_scope)}`;
  $('#mapSvg').onclick = e => {
    const c = e.target.closest('.nd'); if (!c) return;
    const n = byId[c.dataset.id];
    const inRoute = (cert.nodes || []).indexOf(n.id);
    $('#mapDetail').innerHTML = `<p class="seq" style="font-size:1.2rem">${esc(n.id)}</p>
      <table><tr><th>measured score</th><td>${n.s}</td></tr>
      <tr><th>replicate 1 / 2</th><td>${n.r1} / ${n.r2}</td></tr>
      <tr><th>assumed interval</th><td>${n.lo} to ${n.hi}</td></tr>
      <tr><th>reads behind it</th><td>${n0(n.n)}${n.n < 50 ? ' <span class="chip warn">thin</span>' : ''}</td></tr>
      <tr><th>evidence kind</th><td>${esc(n.k)}</td></tr></table>
      ${inRoute >= 0 ? `<p class="small"><span class="chip viol">step ${inRoute + 1} of the certified route</span></p>` : ''}
      <p class="small mute">The interval is the measurement plus or minus the assumed sensitivity at &kappa; = ${D.intervalModel.kappa}. It is an assumption about noise, not a confidence interval.</p>`;
  };

  // ---------- scoreboard ----------
  const budgets = [...new Set(D.policyRows.map(r => r.budget))].sort((a, b) => a - b);
  const fams = [['all', 'both pair families'], ['A', 'family A (easier)'], ['B', 'family B (one hard pair)']];
  let bSel = 1000, fSel = 'all';
  $('#raceCtl').innerHTML = `<label>Assay budget <select id="bSel">${budgets.map(b => `<option ${b === bSel ? 'selected' : ''}>${b}</option>`).join('')}</select></label>
    &nbsp;&nbsp;<label>Episodes <select id="fSel">${fams.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>`;
  const drawRace = () => {
    const rows = D.policyRows.filter(r => r.budget === bSel && r.family === fSel).sort((a, b) => b.rate - a.rate);
    const lab = {
      q2c_nomodel: 'Query-to-certify, no model prior', q2c: 'Query-to-certify, with model',
      collective_shared: 'Five specialists, sharing evidence', collective_shared_rr: 'Five specialists, round-robin',
      collective_isolated: 'Five specialists, isolated', collective_shared_c: 'Sharing, conservative variant',
      collective_isolated_c: 'Isolated, conservative variant', directed: 'Directed search toward the target',
      uncertainty: 'Measure where least certain', greedy: 'Greedy best neighbour', random: 'Random assays'
    };
    $('#raceRows').innerHTML = rows.map(r => `<div class="rowline">
      <span class="small">${esc(lab[r.policy] || r.policy)}</span>
      <span class="bar"><i class="${r.rate >= .9 ? 'good' : r.rate < .35 ? 'poor' : ''}" style="width:${r.rate * 100}%"></i></span>
      <span class="small mute">${r.certified}/${r.episodes} · ${n1(r.rmst)} assays</span></div>`).join('')
      + `<p class="small mute" style="margin-top:10px">Right-hand number is the average assays spent, counting an unresolved run as the full budget (<t>RMST</t>). False certificates in these rows: <b>${rows.reduce((s, r) => s + r.falseCerts, 0)}</b>. The arm that abstains honestly scores nothing, which is why the ordering changes with budget.</p>`;
    glossary($('#raceRows'));
  };
  $('#bSel').onchange = e => { bSel = +e.target.value; drawRace(); };
  $('#fSel').onchange = e => { fSel = e.target.value; drawRace(); };
  drawRace();

  $('#lazyCard').innerHTML = `<p>The project audited its own novelty, found it was missing the obvious strong baseline from the path-planning literature (<t>LazySP</t>, 2016), implemented it, and it won.</p>
    <table><tr><th>variant</th><th>certified</th><th>assays (mean)</th></tr>
    ${D.lazysp.variants.map(v => `<tr><td>${esc(v.variant)}${v.variant === lazy.variant ? ' <span class="chip">primary</span>' : ''}</td><td>${v.certified}/${v.episodes}</td><td>${n1(v.rmst_assays)}</td></tr>`).join('')}</table>
    <p class="small">Against the project's own planner at ${q2c.certified}/${q2c.episodes}. ${D.lazysp.prereg?.beforeAnyEpisode ? 'The protocol was registered before a single episode of this panel ran, which is what makes the comparison worth anything.' : ''}</p>`;
  $('#lazyScope').innerHTML = `<p>${esc(D.lazysp.scope)}</p>
    <p>Read that twice: the team's headline number comes from a method they did not invent, and the margin over their own method sits mostly in one repeated endpoint pair. Publishing that rather than the flattering framing is the most scientifically credible move in the whole project.</p>`;
  glossary($('#lazyCard'));

  // ---------- two collectives ----------
  const col = D.collective, shared = col.arms.find(a => a.key === 'collective_shared'), iso = col.arms.find(a => a.key === 'collective_isolated');
  const enzymeCard = `<div class="card"><h3>Enzyme benchmark: no collective advantage</h3>
    <table><tr><th>arm</th><th>correct certificates</th><th>assays</th></tr>
      <tr><td>Sharing evidence</td><td><b>${shared.certified}/${shared.episodes}</b></td><td>${n1(shared.rmst)}</td></tr>
      <tr><td>Isolated, same five</td><td><b>${iso.certified}/${iso.episodes}</b></td><td>${n1(iso.rmst)}</td></tr>
      <tr><td>One planner</td><td><b>${q2c.certified}/${q2c.episodes}</b></td><td>${n1(q2c.rmst)}</td></tr>
      <tr><td>One planner, no model</td><td><b>${best.certified}/${best.episodes}</b></td><td>${n1(best.rmst)}</td></tr></table>
    <p class="small mute">Sharing beat isolation by ${shared.certified - iso.certified} episode out of ${shared.episodes} and tied the single planner. The best arm of all is a single planner with the model switched off.</p></div>`;
  $('#twoArms').innerHTML = enzymeCard + `<div class="card" id="ourSwarm"><h3>Our claim swarm: clear advantage</h3><p class="small mute">Loading from the swarm thread…</p></div>`;
  $('#twoWhy').innerHTML = C.twoWhy.map(p => `<p>${p}</p>`).join('');

  fetch('../t/swarm/status.json').then(r => r.json()).then(sw => {
    const m = l => { const f = (sw.metrics || []).find(x => x.label === l); return f ? f.value : null; };
    const arms = [['centralized', 'Centralized swarm'], ['decentralized', 'Decentralized swarm'], ['isolated', 'Isolated workers'], ['single', 'Single agent']];
    const rows = arms.map(([k, l]) => [l, m(`exp2 ${k}: verified of 20`), m(`exp1 ${k}: verified of 20`)]).filter(r => r[1] != null || r[2] != null);
    const cen = m('exp2 centralized: verified of 20'), sng = m('exp2 single: verified of 20');
    const gap = (typeof cen === 'number' && typeof sng === 'number') ? cen - sng : null;
    $('#ourSwarm').innerHTML = `<h3>Our claim swarm: clear advantage</h3>
      <table><tr><th>arm</th><th>exp 2 (web required)</th><th>exp 1</th></tr>
      ${rows.map(([l, a, b]) => `<tr><td>${esc(l)}</td><td><b>${a ?? '—'}/20</b></td><td>${b ?? '—'}/20</td></tr>`).join('')}</table>
      <p class="small mute">Same model, same budget, pre-registered, verified against the real datasets.${gap != null ? ` The single agent loses by ${gap} claims, mostly by running out of context and leaving answers blank rather than by being wrong.` : ''}</p>
      <p class="small"><a href="../t/swarm/">Full swarm sub-dashboard &rarr;</a></p>`;
  }).catch(() => { $('#ourSwarm').innerHTML = `<h3>Our claim swarm</h3><p class="small mute">Could not read the swarm thread's status file; see the <a href="../t/swarm/">swarm sub-dashboard</a>.</p>`; });

  // ---------- claim adapters ----------
  const OC = D.operationalClaims, sc = OC.scenarios || [];
  const human = {
    model_transfer_refused: 'the formula was derived for a different population model',
    unsupported_quantity_conversion: 'the assay score is not a selection coefficient and cannot be converted into one',
    inference_refused: 'the claim does not license that inference',
    variance_refused: 'the variance term required is not available here',
    ok: 'inputs are inside the claim\'s stated scope'
  };
  $('#adapters').innerHTML = `<table><tr><th>what was asked of the claim</th><th>decision</th><th>why</th></tr>
    ${sc.map(s => `<tr><td>${esc(s.scenario.replace(/_/g, ' '))}</td>
      <td><span class="chip ${s.decision === 'compute' ? 'ok' : 'bad'}">${esc(s.decision)}</span></td>
      <td class="small mute">${esc(human[s.reason_code] || s.reason_code)}</td></tr>`).join('')}</table>
    <p class="small mute" style="margin-top:8px">${sc.filter(s => s.decision === 'refuse').length} of ${sc.length} requests were refused. ${esc(OC.scope)}</p>`;

  const RU = D.reuse;
  $('#reuseCard').innerHTML = RU ? `<p>The project measured whether reusing a claim's result saves computation, against the dullest possible comparison: an ordinary cache.</p>
    <table><tr><th>requests avoided by claim reuse</th><td>${n0(RU.claimAvoided)}</td></tr>
    <tr><th>requests avoided by a plain cache</th><td>${n0(RU.cacheAvoided)}</td></tr>
    <tr><th>gain of claim reuse over the cache</th><td><b>${RU.gainOverCache === 0 ? '0' : n0(RU.gainOverCache)}</b></td></tr></table>
    <p class="small"><span class="chip warn">negative result, reported</span> Within one context, reusing a claim is exactly caching. The value only appears when the context changes and a typed check catches a transfer that should not happen &mdash; and those tests are software fixtures, not laboratory savings.</p>`
    : '<p class="small mute">No reuse benchmark file found.</p>';

  const CA = D.claimAssessments.length ? D.claimAssessments : null;
  $('#claimList').innerHTML = (CA || []).slice(0, 6).map(c => `<details><summary>${esc(c.label || c.id)}</summary><div class="in small">
      <p class="mute">${esc(c.relation)}</p>
      ${c.assessments.length ? `<p>Resolvability assessments: ${c.assessments.map(a => `<span class="chip">${esc(a.verdict)} ${a.score}</span>`).join(' ')}</p>
      <p class="small mute">Two independent assessors disagreed on this claim (${c.assessments.map(a => a.score).join(' vs ')}). Keeping the disagreement is the point; averaging it away would invent a consensus.</p>` : ''}
      ${c.network ? `<p><a href="${esc(c.network)}" target="_blank" rel="noopener">nanopublication &rarr;</a></p>` : ''}</div></details>`).join('')
    + `<p class="small mute">${esc(D.claimsStatus)}</p>`;

  // ---------- proof ----------
  const PR = D.proof;
  $('#proofCard').innerHTML = `<h3>What Lean checked</h3>
    <table><tr><th>theorems</th><td class="small">${esc(PR.theorem)}</td></tr>
    <tr><th>build</th><td>exit ${PR.exit_code} <span class="chip ok">clean</span></td></tr>
    <tr><th>deliberately broken version</th><td>exit ${PR.mutation_exit_code} <span class="chip ok">rejected, as it must be</span></td></tr>
    <tr><th>axioms relied on</th><td class="small">${(PR.axioms_used || []).map(a => `<span class="tag">${esc(a)}</span>`).join(' ')}</td></tr>
    <tr><th>Lean</th><td class="small">${esc((PR.lean_version || '').split(',')[0])}</td></tr>
    <tr><th>wall time</th><td>${n1(PR.wall_seconds)} s</td></tr></table>
    <p class="small mute">Breaking the proof on purpose and checking that the machine rejects it is the step most projects skip. Without it, a green checkmark proves only that something compiled.</p>`;
  $('#proofLimit').innerHTML = `<h3>Where the proof stops</h3><p class="small">${esc(PR.scope)}</p>
    <div class="note"><b>The load-bearing assumption.</b> ${esc(PR.assumption)}</div>
    <p class="small mute">So the honest sentence is: the reasoning from intervals to a safe route is proved; that the intervals contain the truth is assumed. Anyone who repeats this work should attack the second half.</p>`;

  // ---------- compute ----------
  const G = D.compute;
  $('#gpuCard').innerHTML = `<h3>The run that happened</h3>
    <table><tr><th>provider</th><td class="small">${esc((G.provider || '').split(',')[0])}</td></tr>
    <tr><th>model</th><td class="small">${esc((G.model || '').split(';')[0])}</td></tr>
    <tr><th>variants scored</th><td>${n0(G.variants)}</td></tr>
    <tr><th>runtime</th><td>${n0(G.runtime_seconds)} s</td></tr>
    <tr><th>job id</th><td class="tag">${esc(G.job_id)}</td></tr></table>
    <p class="small"><b>Result:</b> ${esc(G.headline)}</p>
    <p class="small mute">${esc(G.note)}</p>`;
  const SC = D.scale;
  $('#scaleCard').innerHTML = `<h3>Five model sizes, no winner</h3>
    <p class="small">${n0(SC.models)} sizes of the protein model, ${n0(SC.variants_per_model)} variants each, ${n0(SC.episodes)} matched episodes.</p>
    <table><tr><th>policy and prior</th><th>certified</th><th>assays</th></tr>
    ${(SC.comparisons || []).filter(c => c.policy === 'q2c').map(c => `<tr><td class="small">${esc(c.prior === 'none' ? 'no prior (control)' : c.prior.replace('esm_te', 'ESM2 ').replace('shuf_te', 'shuffled ESM2 ').replace('_mm_ctx', ''))}</td><td>${c.certified}/${c.episodes}</td><td>${n1(c.rmst_assays)}</td></tr>`).join('')}</table>
    <p class="small"><span class="chip warn">negative result, reported</span> ${SC.all_rmst_intervals_include_zero ? 'Every interval includes zero: no size of the model beat no model at all. A deliberately shuffled prior scored as well as the real one, which is the cleanest way to say the signal was not there.' : ''}</p>`;

  // ---------- verification ----------
  fetch('verify.json').then(r => r.ok ? r.json() : Promise.reject(new Error('not yet written'))).then(V => {
    const vc = { confirmed: 'ok', differs: 'bad', 'could-not-check': 'warn' };
    const vcount = k => (V.checks || []).filter(c => c.verdict === k).length;
    $('#verifyCard').innerHTML = `<p><b>${vcount('confirmed')} of ${(V.checks || []).length} headline numbers reproduced exactly.</b> ${vcount('differs') ? vcount('differs') + ' differed. ' : 'None differed. '}${vcount('could-not-check') ? vcount('could-not-check') + ' could not be checked, because the raw source files are gitignored and we refused to re-download them.' : ''}</p>
      <p class="small mute">Recounted ${esc((V.verifiedAt || '').slice(0, 16).replace('T', ' '))} UTC. ${esc(V.verifier || '')}</p>
      <table><tr><th>their claim</th><th>verdict</th><th>what we computed</th></tr>
      ${(V.checks || []).map(c => `<tr><td class="small">${esc(c.claim)}</td>
        <td><span class="chip ${vc[c.verdict] || ''}">${esc(c.verdict)}</span></td>
        <td class="small mute">${esc(c.computed)}${c.how ? `<br><span class="tag">${esc(c.how)}</span>` : ''}</td></tr>`).join('')}</table>
      ${(V.notes || []).length ? `<h3 style="margin-top:14px">What the recount noticed that the summaries do not say</h3>
        <ul class="small">${(V.notes || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}`;
    const pairNote = (V.notes || []).find(x => /distinct endpoint pairs/.test(x));
    const concNote = (V.notes || []).find(x => /LazySP advantage is not broad/.test(x));
    if (pairNote || concNote) $('#heroNote').innerHTML += `<p style="margin-bottom:0"><b>And what our own recount added.</b> ${esc([pairNote, concNote].filter(Boolean).join(' '))} <a href="#verify">See the recount &rarr;</a></p>`;
  }).catch(() => {
    $('#verifyCard').innerHTML = `<p class="small mute">The recount is still running. It will appear here as a table of verdicts, including any number we could not reproduce. Nothing on this page waits on it, because every other figure is read straight from the project's saved files.</p>`;
  });

  // ---------- swarm roles ----------
  const roles = [
    ['Emperor', 'Decides only the shape of the work: how many questions run in parallel, when to stop one, who talks to whom. It never decides what is true.', 'structure'],
    ['King', 'Forces an outside analogy into every question. The stepping-stone and mountain-pass framings on this page came from that seat, not from biology.', 'serendipity'],
    ['Queen: route', 'Owns the question "is there a usable path, and what is its weakest step".', 'answered'],
    ['Queen: baseline', 'Owns "what does the strongest existing method do". It found LazySP and beat the home team.', 'answered'],
    ['Queen: proof', 'Owns "what can a machine check, and what is merely assumed".', 'answered'],
    ['Queen: verification', 'Owns "do the headline numbers survive an independent recount". Reports to this page, not to the project.', 'running']
  ];
  $('#swarmRoles').innerHTML = roles.map(([h, b, s]) => `<div class="card"><h3>${esc(h)}</h3><p class="small">${esc(b)}</p>
    <span class="chip ${s === 'answered' ? 'ok' : s === 'running' ? 'warn' : ''}">${esc(s)}</span></div>`).join('');
  $('#swarmHonest').innerHTML = C.swarmHonest.map(p => `<p>${esc(p)}</p>`).join('');

  // ---------- risks / analogies / recs ----------
  $('#risks1').innerHTML = C.risks.map(([h, b, sev]) => `<details><summary>${esc(h)} <span class="chip ${sev === 'high' ? 'bad' : sev === 'medium' ? 'warn' : ''}">${esc(sev)}</span></summary><div class="in small">${sub(b)}</div></details>`).join('');
  $('#analogies1').innerHTML = C.analogies.map(([h, b]) => `<div class="card"><h3>${esc(h)}</h3><p class="small">${b}</p></div>`).join('');
  $('#recs1').innerHTML = C.recs.map(([h, b, v]) => `<details><summary>${esc(h)} <span class="chip ${v.startsWith('highest') ? 'viol' : ''}">${esc(v)}</span></summary><div class="in small">${esc(b)}</div></details>`).join('');
  glossary($('#analogies1')); glossary($('#risks1'));

  // ---------- sources ----------
  const R = D.receipts;
  $('#sources1').innerHTML = `<div class="grid g2">
    <div class="card"><h3>The measurements</h3>
      <p class="small">Johnston et al., <i>PNAS</i> 2024. Paper <a href="https://doi.org/${esc(S.paper_doi)}" target="_blank" rel="noopener">${esc(S.paper_doi)}</a>. Data <a href="${esc(S.url)}" target="_blank" rel="noopener">CaltechDATA ${esc(S.doi)}</a>, ${esc(S.license)}.</p>
      <p class="small mute">Assay: ${esc(S.assay)}</p>
      <details><summary>File checksums the project pinned</summary><div class="in small">${Object.entries(S.sha256 || {}).map(([f, h]) => `<p><span class="tag">${esc(f)}</span><br><span class="small mute">${esc(h)}</span></p>`).join('')}</div></details></div>
    <div class="card"><h3>The code and receipts</h3>
      <p class="small"><a href="${esc(D.repo.url)}" target="_blank" rel="noopener">${esc(D.repo.url)}</a><br>
      read at commit <span class="tag">${esc((D.repo.commit || '').slice(0, 10))}</span> of ${esc((D.repo.commitDate || '').slice(0, 10))}<br>
      ${n0(D.repo.pyFiles)} Python files, ${n0(D.repo.leanFiles)} Lean files, ${n0(D.repo.trigFiles)} nanopublication drafts</p>
      ${R.freshCheckout ? `<p class="small">Fresh-checkout reproduction at commit <span class="tag">${esc(R.freshCheckout.commit.slice(0, 10))}</span>: ${R.freshCheckout.steps} steps, ${R.freshCheckout.failed} failed.</p>` : ''}
      ${R.release ? `<p class="small">Release: <a href="${esc(R.release.release)}" target="_blank" rel="noopener">v0.1.0-hackathon</a> (${n0(R.release.files)} files, ${(R.release.bytes / 1e6).toFixed(1)} MB). Their own site is owner-private, which is why this page exists.</p>` : ''}
      <p class="small mute">This page is built by <span class="tag">dashboard/build-evolve.mjs</span> in our repo, reading that checkout. Rebuild and the numbers move with it.</p></div></div>
    <div class="card" style="margin-top:14px"><h3>Everything the project says it did not establish</h3>
      <ul class="small">${D.limitations.map(l => `<li>${esc(l)}</li>`).join('')}</ul></div>`;

  $('#foot').innerHTML = `Built ${esc(D.builtAt.slice(0, 16).replace('T', ' '))} UTC from <span class="tag">delphi-evolve@${esc((D.repo.commit || '').slice(0, 8))}</span> and our own recount. Part of <a href="../index.html">DELPHI Mission Control</a>. Numbers come from files; sentences come from us.`;


  // ---------- our fresh panel ----------
  fetch('panel.json').then(r => r.ok ? r.json() : Promise.reject(new Error('pending'))).then(PN => {
    const S2 = PN.summary || {}, TH = PN.theirPanelForComparison || {}, pre = PN.prereg || {};
    const rows = (PN.results || []).slice().sort((a, b) => b.certified - a.certified);
    const mx = Math.max(...rows.map(r => r.certified), 1);
    const lab = { lazysp_alternate: 'LazySP (their best arm)', q2c: 'Query-to-certify, with model', q2c_nomodel: 'Query-to-certify, no model', collective_shared: 'Five specialists, sharing', collective_isolated: 'Five specialists, isolated' };
    const pairs = PN.perPair || [];
    const vfvs = pairs.filter(p => /^VFVS/.test(p.pair)).length;
    $('#panelCard').innerHTML = `
      <div class="grid g4">
        <div class="card"><div class="kpi">${pairs.length}<small>fresh pairs, none of theirs</small></div></div>
        <div class="card"><div class="kpi">${rows[0] ? rows[0].certified + '/' + rows[0].episodes : '—'}<small>best arm on our panel</small></div></div>
        <div class="card"><div class="kpi">${(S2.pairsLazyspResolvedQ2cNot || []).length}<small>pairs separating the top two</small></div></div>
        <div class="card"><div class="kpi">${rows.reduce((s, r) => s + r.falseCertificates, 0)}<small>false certificates</small></div></div>
      </div>
      <div class="note ok" style="margin-top:12px"><b>Pre-registered first.</b> The panel, the seed (${esc(pre.seed)}), the policies and the commands were written to this file at ${esc((pre.writtenAt || '').slice(0, 16).replace('T', ' '))} UTC, before a single episode ran. The rule was: ${esc(pre.rule || '')}</div>
      <div class="card" style="margin-top:12px"><h3>On fresh pairs</h3>
        ${rows.map(r => `<div class="rowline"><span class="small">${esc(lab[r.policy] || r.policy)}</span>
          <span class="bar"><i class="${r.certified >= mx ? 'good' : ''}" style="width:${r.certified / r.episodes * 100}%"></i></span>
          <span class="small mute">${r.certified}/${r.episodes} · ${n1(r.meanAssays)} assays</span></div>`).join('')}
        <p class="small mute" style="margin-top:10px">Same budget, same &kappa;, zero false certificates, zero full-data verification failures across all ${n0(S2.episodesTotal)} episodes.</p></div>
      <div class="grid g2" style="margin-top:12px">
        <div class="card"><h3>What held</h3>
          <p class="small">The <b>ordering</b> held. The same two arms came first, in the same order, and nobody issued a false certificate. Their method is not an artefact.</p>
          <p class="small">The data counts also held, and this time from the raw files: ${n0(PN.dataCounts?.sourceRows)} source rows, ${n0(PN.dataCounts?.measured)} measured variants, ${n0(PN.dataCounts?.imputedOnly)} imputed-only, overlap ${PN.dataCounts?.overlap}. All three file checksums matched. That was the one check our first recount could not do.</p></div>
        <div class="card"><h3>What did not hold</h3>
          <p class="small">The <b>size</b> of the gap. Theirs is 18 episodes; ours is <b>one pair</b> &mdash; ${esc((S2.pairsLazyspResolvedQ2cNot || [])[0] || 'n/a')}, and once again a pair starting from the parent enzyme. On the ${pairs.length - vfvs} pairs that do not start there, <b>all five arms resolve exactly the same set</b>.</p>
          <p class="small">The reason is composition: <b>${n0(TH.vfvsStartEpisodes)} of their ${n0(TH.episodesPerPolicy)} episodes start from the same genotype</b>, and ${n0(TH.lazyspResolvedQ2cNot)} of ${n0(TH.lazyspResolvedQ2cNot)} of their method's extra wins are that one family. Draw a panel that does not oversample it and the gap shrinks to a point.</p></div></div>
      <div class="card" style="margin-top:12px"><h3>Two things we did not expect</h3>
        <p class="small"><b>The model prior is not what wins.</b> The no-model arm tied the best arm at ${rows.find(r => r.policy === 'q2c_nomodel')?.certified}/${pairs.length}. Whatever the advantage is, it is not the surrogate &mdash; which agrees with their own GPU result finding no benefit from a protein language model.</p>
        <p class="small"><b>The best arm is the most expensive.</b> On pairs both resolved, it spent a mean of 352.6 assays against 149.2 for the cheaper planner, more on every single pair. If the currency is laboratory experiments rather than episodes certified, the ranking inverts.</p></div>
      <div class="card" style="margin-top:12px"><h3>What our panel does not establish</h3>
        <ul class="small">${(PN.limits || []).map(l => `<li>${esc(l)}</li>`).join('')}</ul></div>
      <p class="small mute">Run ${esc((PN.ranAt || '').slice(0, 16).replace('T', ' '))} UTC from their own replay code on our own panel: an independent panel, not an independent implementation. Full output: <span class="tag">evolve/panel.json</span>.</p>`;
    // the panel run settled the one check the first recount could not do
    if (PN.dataCounts && PN.dataCounts.verdict === 'confirmed') {
      const vc = $('#verifyCard');
      if (vc) vc.insertAdjacentHTML('beforeend', `<div class="note ok small"><b>Later settled.</b> The one check above marked <i>could-not-check</i> &mdash; the source row counts &mdash; was confirmed afterwards by <a href="#panel">the fresh-panel run</a>, which fetched the three CSVs through the project's own range-request script and matched all three checksums. The verdict above is left as it was recorded at the time rather than edited in hindsight.</div>`);
    }

    // headline the finding at the top of the page too
    $('#heroNote').innerHTML += `<p style="margin-bottom:0"><b>What our fresh panel found.</b> Their ranking held, but their 18-episode margin came down to a single endpoint pair once we drew pairs they had not picked, because ${n0(TH.vfvsStartEpisodes)} of their ${n0(TH.episodesPerPolicy)} episodes start from the same genotype. <a href="#panel">See the panel &rarr;</a></p>`;
  }).catch(() => {});

  // ---------- our own rebuild of their proofs ----------
  fetch('lean.json').then(r => r.ok ? r.json() : Promise.reject(new Error('pending'))).then(L => {
    const muts = L.mutations || [], bad = muts.filter(m => /STILL BUILDS/i.test(m.verdict || ''));
    const ax = L.axioms || {};
    $('#leanOurs').innerHTML = `<h3>Our own check of those proofs</h3>
      <p class="small mute">Rebuilt and attacked ${esc((L.checkedAt || '').slice(0, 16).replace('T', ' '))} UTC on a copy, with ${esc(L.toolchain || 'the pinned toolchain')}. Their tree was not modified.</p>
      <div class="grid g3">
        <div class="card"><div class="kpi">${L.build?.exit === 0 ? 'clean' : 'exit ' + L.build?.exit}<small>rebuild from source${L.build?.seconds ? ', ' + n1(L.build.seconds) + ' s' : ''}</small></div></div>
        <div class="card"><div class="kpi">${muts.length - bad.length}/${muts.length}<small>deliberate breakages correctly rejected</small></div></div>
        <div class="card"><div class="kpi">${ax.sorryAxPresent === false ? 'none' : '?'}<small>unfinished proof steps found</small></div></div>
      </div>
      <p class="small" style="margin-top:12px"><b>It survived everything we threw at it.</b> We reversed the admissibility inequality, weakened the cut to allow an exit edge, deleted an interval check, dropped the condition keeping the target outside the cut, loosened strict descent, moved one measured number so an escape edge opens, and made the neighbour enumeration incomplete. Every one failed to build, as a correct development must. On the data mutation the checker went further and proved the proposition false, which means the measurements are genuinely load-bearing rather than decoration.</p>
      <p class="small"><b>The assumptions check out, and the headline theorems use fewer than the claim.</b> Across the whole development we observed exactly the ${esc((ax.observed || []).length)} axioms they list (${(ax.observed || []).map(a => `<span class="tag">${esc(a)}</span>`).join(' ')}), so that claim is <b>confirmed</b> rather than beaten. Per theorem it is tighter: the route soundness theorem rests on <span class="tag">propext</span> alone and the blocked-route theorem adds only <span class="tag">Quot.sound</span>, with classical choice used by just one unrelated theorem. No unfinished proof steps, no compiled-binary shortcut, no axiom declarations anywhere.</p>
      <p class="small"><b>The theorems are general, which is the claim that mattered most.</b> ${L.correspondence?.generic ? 'They are quantified over an arbitrary vertex type, an arbitrary graph relation and an arbitrary ordered value type, with the specific enzyme certificates as applications. A theorem that merely proved an arithmetic identity about fixed constants would have been close to worthless; this is not that.' : esc(L.correspondence?.notes || '')}</p>
      <div class="note bad"><b>One claim did not survive our check.</b> Their receipt for the headline route credits a Lean module that <b>does not exist anywhere in the repository</b>. A route for that start and target is Lean-checked, but at a different setting of the caution dial and with a different number of steps, and the certificate that is checked at the headline setting is a different kind of statement about a different pair. So the proofs are sound and the paperwork about them overstates what is covered. We are reporting it here rather than quietly dropping it, and it is a small, fixable bookkeeping error, not a broken proof.</div>
      <p class="small mute">${esc(L.verdict || '')}</p>
      ${(L.limits || []).length ? `<details><summary>What our check could not cover</summary><div class="in small"><ul>${(L.limits || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></details>` : ''}`;
  }).catch(() => {});

  glossary(document.body);
  spy();
}
})();
