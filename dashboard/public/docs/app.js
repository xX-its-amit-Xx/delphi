/* docs/app.js — binds data.json into the page, drives the audience toggle, the scroll-spy,
   the reveal animations and the hero field. No number is written in the markup; every figure
   below is read from data.json, which build.mjs writes from the repository's own sources. */

(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fmt = n => (typeof n === 'number' ? n.toLocaleString('en-US') : n ?? '—');

  /* ---------------------------------------------------------------- audience toggle */
  const MODE_KEY = 'leanbio-docs-mode';
  const setMode = m => {
    document.body.dataset.mode = m;
    $('#mHuman')?.setAttribute('aria-pressed', String(m === 'human'));
    $('#mAgent')?.setAttribute('aria-pressed', String(m === 'agent'));
    // A per-viewer convenience only. Never let a storage failure break the page.
    try { localStorage.setItem(MODE_KEY, m); } catch { /* private window, blocked storage */ }
  };
  try {
    const saved = localStorage.getItem(MODE_KEY);
    if (saved === 'human' || saved === 'agent') setMode(saved);
  } catch { /* ignore */ }
  $('#mHuman')?.addEventListener('click', () => setMode('human'));
  $('#mAgent')?.addEventListener('click', () => setMode('agent'));

  /* ---------------------------------------------------------------- scroll spy */
  const links = $$('nav a');
  const byHash = new Map(links.map(a => [a.getAttribute('href'), a]));
  const spy = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      links.forEach(a => a.classList.remove('on'));
      byHash.get(`#${e.target.id}`)?.classList.add('on');
    }
  }, { rootMargin: '-15% 0px -70% 0px' });
  $$('main section').forEach(s => spy.observe(s));

  /* ---------------------------------------------------------------- reveal on scroll */
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce) {
    const rev = new IntersectionObserver((entries, obs) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('in');
        obs.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.04 });
    $$('.demo, .card, table, .stats, .stat, h2, h3, pre').forEach((el, i) => {
      el.classList.add('rv');
      el.style.setProperty('--d', `${(i % 6) * 45}ms`);
      rev.observe(el);
    });
  } else {
    $$('.rv').forEach(el => el.classList.add('in'));
  }

  /* ---------------------------------------------------------------- count-up for stats */
  function countUp(el, target) {
    if (reduce || typeof target !== 'number') { el.textContent = fmt(target); return; }
    const dur = 900, t0 = performance.now();
    const step = now => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function statBlock(host, items) {
    if (!host) return;
    host.innerHTML = items.map(([v, label, hint]) =>
      `<div class="stat"${hint ? ` title="${hint}"` : ''}><b data-v="${typeof v === 'number' ? v : ''}">${typeof v === 'number' ? '0' : (v ?? '—')}</b><span>${label}</span></div>`
    ).join('');
    const io = new IntersectionObserver((entries, obs) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        $$('b[data-v]', e.target).forEach(b => {
          const v = b.dataset.v;
          if (v !== '') countUp(b, Number(v));
        });
        obs.unobserve(e.target);
      }
    }, { threshold: 0.3 });
    io.observe(host);
  }

  /* ---------------------------------------------------------------- bind data.json */
  fetch('data.json')
    .then(r => { if (!r.ok) throw new Error(`data.json: HTTP ${r.status}`); return r.json(); })
    .then(d => {
      const c = d.counts || {};

      statBlock($('#statsTop'), [
        [c.sim_engine_tools, 'tools on the engine'],
        [c.hosted_mcp_tools, `tools hosted (v${c.hosted_mcp_version})`],
        [c.personas, 'personas it was built for'],
        [c.use_cases, 'use cases mapped'],
        [c.grand_questions, 'grand questions'],
      ]);

      const st = c.tool_reference_status || {};
      const ans = c.use_cases_by_answerability || {};
      statBlock($('#statsMcp'), [
        [c.real_tools, 'real tools behind the map'],
        [c.tool_references, 'tool references across the use cases'],
        [st.EXISTS, 'references that exist'],
        [st.PARTIAL, 'partial'],
        [st.MISSING, 'missing — reported, not rounded up'],
        [ans.yes ?? null, 'use cases answerable today'],
      ]);

      const ex = $('#sExempt'); if (ex) countUp(ex, c.documented_exemptions);
      const ls = $('#sLawset'); if (ls) ls.textContent = c.lawset_version ?? '—';

      const at = $('#allTools');
      if (at) at.textContent = (d.tool_names || []).join('  ·  ');

      const ql = $('#questionList');
      if (ql) {
        ql.innerHTML = (d.grand_questions || []).map((q, i) => `
          <div class="q rv">
            <div class="qn">${String(i + 1).padStart(2, '0')}</div>
            <div class="qb">
              <p class="qq">${esc(q.question)}</p>
              ${q.formalisable_core ? `<p class="qc"><span>Formalisable core</span>${esc(q.formalisable_core)}</p>` : ''}
              ${q.repo_asset ? `<p class="qa"><span>Already touched by</span><code>${esc(q.repo_asset)}</code></p>` : ''}
            </div>
          </div>`).join('');
        if (!reduce) {
          const io = new IntersectionObserver((entries, obs) => {
            for (const e of entries) { if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); } }
          }, { threshold: 0.08 });
          $$('.q', ql).forEach((el, i) => { el.style.setProperty('--d', `${(i % 8) * 40}ms`); io.observe(el); });
        } else {
          $$('.q', ql).forEach(el => el.classList.add('in'));
        }
      }

      const b = $('#builtAt');
      if (b) b.innerHTML = `Every figure on this page is read at build time from the file that owns it by `
        + `<code>${esc(d.generated_by)}</code>, which fails rather than shipping a stale number. `
        + `Built ${esc(d.generated_at)}.`;
    })
    .catch(err => {
      // A missing data.json must look like a failure, not like an empty page.
      const host = $('#statsTop');
      if (host) host.innerHTML = `<div class="stat" style="grid-column:1/-1;border-color:#4a2626">`
        + `<b style="font-size:17px">data.json did not load</b>`
        + `<span>${esc(String(err.message))} — run <code>node dashboard/public/docs/build.mjs</code></span></div>`;
      console.error(err);
    });

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, m =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  /* ---------------------------------------------------------------- hero field
     A slow lattice that reads as depth without pretending to be data. It is decoration and is
     labelled as such; nothing here is read from a result. Drops out entirely under
     prefers-reduced-motion, and stops when off screen so it costs nothing while you read. */
  const cv = $('#heroCanvas');
  if (cv && !reduce) {
    const ctx = cv.getContext('2d');
    let w = 0, h = 0, raf = 0, running = true;
    const N = 46;
    const pts = Array.from({ length: N }, () => ({
      x: Math.random(), y: Math.random(), z: Math.random(),
      vx: (Math.random() - .5) * 0.00022, vy: (Math.random() - .5) * 0.00022,
    }));
    const resize = () => {
      const r = cv.getBoundingClientRect();
      const dpr = Math.min(2, devicePixelRatio || 1);
      w = cv.width = Math.max(1, Math.floor(r.width * dpr));
      h = cv.height = Math.max(1, Math.floor(r.height * dpr));
    };
    const draw = () => {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > 1) p.vx *= -1;
        if (p.y < 0 || p.y > 1) p.vy *= -1;
      }
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const a = pts[i], b2 = pts[j];
          const dx = a.x - b2.x, dy = a.y - b2.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > 0.034) continue;
          const alpha = (1 - d2 / 0.034) * 0.5 * (0.35 + 0.65 * ((a.z + b2.z) / 2));
          ctx.strokeStyle = `rgba(110,170,255,${alpha.toFixed(3)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x * w, a.y * h);
          ctx.lineTo(b2.x * w, b2.y * h);
          ctx.stroke();
        }
      }
      for (const p of pts) {
        const r = (0.8 + p.z * 1.9) * (devicePixelRatio || 1);
        ctx.fillStyle = `rgba(180,215,255,${(0.3 + p.z * 0.55).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    resize();
    addEventListener('resize', resize, { passive: true });
    new IntersectionObserver(es => {
      for (const e of es) {
        running = e.isIntersecting;
        if (running) { cancelAnimationFrame(raf); draw(); } else cancelAnimationFrame(raf);
      }
    }, { threshold: 0 }).observe(cv);
    draw();
  }
})();
