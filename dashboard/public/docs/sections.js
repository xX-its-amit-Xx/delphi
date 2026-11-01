/* docs/sections.js — four tappable sections per product, and the Blog / Technical view.
 *
 *   How it works · Use cases · Community · Open questions
 *
 * BLOG view is for skimming: short, collapsible, animation-led, one idea per card. TECHNICAL view
 * adds everything that was already here — the architecture runs, the benchmark, the tables, the
 * commands, the files. Same five products in both, so a reader can switch depth without losing
 * their place.
 *
 * Every use case shows its status — built / partial / proposed — because a proposal shown beside
 * a result without saying which is which is the failure this project exists to avoid.
 */
(() => {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  const SUBS = [['how', 'How it works'], ['uses', 'Use cases'], ['community', 'Community'], ['open', 'Open questions']];
  const BADGE = { built: 'Built', partial: 'Partly built', proposed: 'Proposed' };

  // ── Blog / Technical view ─────────────────────────────────────────────────
  const VIEW_KEY = 'morpholemma-view';
  function setView(v) {
    document.body.dataset.view = v;
    document.querySelectorAll('[data-view-btn]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.viewBtn === v)));
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* blocked storage */ }
  }
  function viewToggle() {
    const bar = document.querySelector('.hwrap');
    if (!bar || document.querySelector('.vtoggle')) return;
    const t = document.createElement('div');
    t.className = 'vtoggle';
    t.setAttribute('role', 'group');
    t.setAttribute('aria-label', 'Depth');
    // THREE views. Blog is prose for a reader with no background; skim is the structured
    // version with the four sections per product; deep is the full report with the runs.
    t.innerHTML = `<button data-view-btn="blog">Blog</button>`
      + `<button data-view-btn="skim">Technical &middot; skim</button>`
      + `<button data-view-btn="deep">Technical &middot; deep</button>`;
    // The humans/agents switch belongs in BOTH views: "how each step works" has an agent form
    // whether or not the reader wants the deep technical body underneath it.
    // (the humans/agents switch is hidden in prose view by CSS, shown in both technical views)
    bar.insertBefore(t, bar.querySelector('.toggle'));
    t.addEventListener('click', e => { const b = e.target.closest('[data-view-btn]'); if (b) setView(b.dataset.viewBtn); });
    let v = 'blog';
    try { v = localStorage.getItem(VIEW_KEY) || 'blog'; } catch { /* ignore */ }
    // The views used to be blog/tech. Anyone carrying a stored 'tech' gets the deep report,
    // and a stored 'blog' now means prose — which is what that reader asked for anyway.
    if (v === 'tech') v = 'deep';
    if (!['blog', 'skim', 'deep'].includes(v)) v = 'blog';
    setView(v === 'tech' ? 'tech' : 'blog');
  }

  // ── renderers per sub-section ─────────────────────────────────────────────
  // How it works, in BOTH forms. The humans/agents switch picks which is shown, and the two are
  // authored separately so prose and machine instruction cannot drift apart silently.
  function how(p, demo) {
    const human = `<div class="sx-cards">${p.how.map(([t, b], i) => `
      <details class="sx-card"${i === 0 ? ' open' : ''}><summary><span class="sx-n">${i + 1}</span>${esc(t)}</summary>
        <div class="sx-body"><p>${esc(b)}</p></div></details>`).join('')}</div>`;
    const steps = p.agent || [];
    const agent = steps.length ? `<div class="sx-cards">${steps.map((st, i) => `
      <details class="sx-card"${i === 0 ? ' open' : ''}>
        <summary><span class="sx-n">${i + 1}</span><code class="sx-call">${esc(st.call)}</code></summary>
        <div class="sx-body">
          <p class="sx-ret"><span>Returns</span>${esc(st.returns)}</p>
          <p class="sx-rule"><span>Rule</span>${esc(st.rule)}</p>
        </div></details>`).join('')}
      <p class="sx-legend">Every command above is a real entry point, run from the repository root.</p></div>`
      : '<p class="sx-muted">No agent form recorded for this product yet.</p>';
    return `${demo ? `<div class="sx-anim"><video src="${esc(demo)}" autoplay muted loop playsinline></video></div>` : ''}
      <div data-aud="human">${human}</div><div data-aud="agent">${agent}</div>`;
  }
  function uses(p) {
    return `<div class="sx-cards">${p.uses.map(([s, t, b]) => `
      <details class="sx-card"><summary><span class="sx-badge ${s}">${BADGE[s]}</span>${esc(t)}</summary>
        <div class="sx-body"><p>${esc(b)}</p></div></details>`).join('')}</div>
      <p class="sx-legend"><span class="sx-badge built">Built</span> run, with output to point at
        <span class="sx-badge partial">Partly built</span> some of it runs
        <span class="sx-badge proposed">Proposed</span> an idea nobody has run</p>`;
  }
  function community(p) {
    return `<div class="sx-grid">${p.community.map(([t, b]) => `
      <div class="sx-tile"><h5>${esc(t)}</h5><p>${esc(b)}</p></div>`).join('')}</div>`;
  }
  function open(p) {
    const o = p.open || {};
    const g = (o.grand || []).map((q, i) => `
      <details class="sx-card"><summary><span class="sx-n">${i + 1}</span>${esc(q.text)}</summary>
        <div class="sx-body">${q.core ? `<p><b>What Lean could settle.</b> ${esc(q.core)}</p>` : ''}
          ${q.asset ? `<p><b>Already touched by</b> <code>${esc(q.asset)}</code></p>` : '<p class="sx-muted">Nothing in the repository touches this yet — which is what makes it open.</p>'}</div></details>`).join('');
    const l = (o.ledger || []).map(q => `
      <details class="sx-card"><summary><span class="sx-badge open">Open</span>${esc(q.text)}</summary>
        <div class="sx-body"><p class="sx-muted">${q.arms.length} positions on the table:</p>
          <ul>${q.arms.map(a => `<li><code>${esc(a.id)}</code> — belief ${a.belief != null ? a.belief.toFixed(2) : '—'}${
            a.formalised ? ', formalised in Lean' : a.formalisable ? ', formalisable, not yet done' : ', not formalisable'}</li>`).join('')}</ul></div></details>`).join('');
    return `${o.lead ? `<p class="sx-lead">${esc(o.lead)}</p>` : ''}
      ${g ? `<div class="sx-cards">${g}</div>` : ''}
      ${l ? `<h5 class="sx-sub">Questions this project hit and could not settle</h5><div class="sx-cards">${l}</div>` : ''}
      ${!g && !l ? '<p class="sx-muted">No open questions recorded for this product yet.</p>' : ''}`;
  }

  // Sponsor tools, rendered once at the end of the overview rather than per product, with the
  // verified status badge. `unavailable` is shown as prominently as `used`: a sponsor tool our own
  // protocol requires and that we could not call is a finding, not something to leave out.
  const SP = { used: 'Used', unavailable: 'Not callable', wired: 'Wired, unused' };
  function sponsors(d) {
    if (!d.sponsors) return;
    const host = document.getElementById('overview');
    if (!host || host.querySelector('.sp')) return;
    const box = document.createElement('div');
    box.className = 'sp';
    box.innerHTML = `<h3>Sponsor tools, and what each one actually did</h3>
      <p class="sx-muted">${esc(d.sponsors.generated_note)}</p>
      <div class="sx-cards">${d.sponsors.entries.map(e => `
        <details class="sx-card">
          <summary><span class="sx-badge sp-${esc(e.status)}">${SP[e.status] || e.status}</span>
            <b>${esc(e.sponsor)}</b> &middot; ${esc(e.tool)}
            <i class="sp-where">${esc(e.where)}</i></summary>
          <div class="sx-body">
            <p>${esc(e.what)}</p>
            <p class="sx-ret"><span>Evidence</span>${esc(e.evidence)}</p>
            <p class="sx-rule"><span>What it does not show</span>${esc(e.limit)}</p>
            ${e.note ? `<p class="sx-muted">${esc(e.note)}</p>` : ''}
          </div></details>`).join('')}</div>`;
    host.appendChild(box);
  }

  function mount(data) {
    sponsors(data);
    const map = { nanopubs: 'nanopubs', leanbio: 'leanbio', mcp: 'mcp', studio: 'studio', harness: 'harness' };
    for (const [id, key] of Object.entries(map)) {
      const panel = document.getElementById(`panel-${id}`);
      const p = data.products[key];
      if (!panel || !p || panel.querySelector('.sx')) continue;
      const demo = panel.querySelector('section .demo video')?.getAttribute('src') || null;
      const box = document.createElement('div');
      box.className = 'sx';
      box.innerHTML = `
        <nav class="sx-nav" role="tablist" aria-label="Sections">${SUBS.map(([k, label], i) =>
          `<button class="sx-tab" data-sub="${k}" role="tab" aria-selected="${i === 0}">${label}</button>`).join('')}</nav>
        ${SUBS.map(([k], i) => `<div class="sx-pane" data-pane="${k}"${i ? ' hidden' : ''}>${
          k === 'how' ? how(p, demo) : k === 'uses' ? uses(p) : k === 'community' ? community(p) : open(p)}</div>`).join('')}`;
      panel.querySelector('.phero')?.after(box);
      box.querySelector('.sx-nav').addEventListener('click', e => {
        const b = e.target.closest('[data-sub]'); if (!b) return;
        box.querySelectorAll('.sx-tab').forEach(x => x.setAttribute('aria-selected', String(x === b)));
        box.querySelectorAll('.sx-pane').forEach(x => { x.hidden = x.dataset.pane !== b.dataset.sub; });
      });
    }
    window.__nest?.autolink();
  }

  viewToggle();
  fetch('sections/data.json')
    .then(r => { if (!r.ok) throw new Error(`sections/data.json: HTTP ${r.status}`); return r.json(); })
    .then(mount)
    .catch(err => console.error(err));
})();
