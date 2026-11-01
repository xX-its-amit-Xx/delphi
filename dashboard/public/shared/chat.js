/* shared/chat.js — the site-wide assistant.
 *
 * Injected on every page by dashboard/build-shell.mjs. Talks to POST /api/chat, which is a
 * Cloudflare Worker route that holds the API key as an encrypted secret; no key ever reaches
 * this file or the browser.
 *
 * Three things the brief asked for, and one it did not:
 *   - the input cycles preloaded questions as its placeholder, so the bar itself suggests
 *   - starter questions are clickable chips
 *   - the model proposes three follow-ups after each answer, rendered as chips
 *   - and: when the backend is not configured or is unreachable, the panel SAYS SO rather than
 *     sitting silent, because a chat box that swallows failures is worse than no chat box.
 *
 * It renders nothing until opened, keeps its transcript in memory only, and never writes to
 * storage beyond remembering whether you had it open.
 */

(() => {
  if (window.__delphiChat) return;
  window.__delphiChat = true;

  const SUGGESTIONS = [
    'What is MorphoLemma?',
    'Why does your own design fail?',
    'What does cannot-evaluate mean?',
    'Did the agent swarms beat a single agent?',
    'How do I write a nanopub you will accept?',
    'What is the composite score problem?',
    'Which parts are not built yet?',
    'How do I get the STL files?',
    'What are the five validation results?',
    'What is held out, and why?',
  ];
  const STARTERS = [
    'What is this project, in one paragraph?',
    'Why does your own design fail?',
    'Did the swarms beat a single agent?',
    'What is not built yet?',
  ];

  const css = `
  .dchat-fab{position:fixed;right:22px;bottom:22px;z-index:9998;width:54px;height:54px;border-radius:50%;
    border:0;background:linear-gradient(140deg,#0aa38a,#2f80ed);
    color:#fff;cursor:pointer;display:grid;place-items:center;
    box-shadow:0 16px 34px -14px rgba(10,120,110,.6);
    transition:transform .35s cubic-bezier(.2,.7,.3,1),box-shadow .35s}
  .dchat-fab:hover{transform:translateY(-3px) scale(1.05);box-shadow:0 22px 44px -14px rgba(10,120,110,.7)}
  .dchat-fab svg{width:23px;height:23px;stroke:#fff;fill:none;stroke-width:1.8}
  .dchat-fab[aria-expanded=true]{opacity:0;pointer-events:none}

  .dchat{position:fixed;right:22px;bottom:22px;z-index:9999;width:min(420px,calc(100vw - 32px));
    height:min(640px,calc(100vh - 44px));display:flex;flex-direction:column;
    border:1px solid rgba(16,74,66,.14);border-radius:18px;overflow:hidden;
    background:rgba(255,255,255,.97);backdrop-filter:blur(20px) saturate(1.2);
    box-shadow:0 36px 80px -34px rgba(16,74,66,.5);
    opacity:0;transform:translateY(14px) scale(.97);pointer-events:none;
    transition:opacity .34s cubic-bezier(.2,.7,.3,1),transform .34s cubic-bezier(.2,.7,.3,1);
    font:14px/1.6 'Space Grotesk',ui-sans-serif,system-ui,sans-serif;color:#0e2b29}
  .dchat.open{opacity:1;transform:none;pointer-events:auto}
  .dchat header{display:flex;align-items:center;gap:9px;padding:12px 14px;
    border-bottom:1px solid rgba(16,74,66,.1);background:linear-gradient(180deg,rgba(10,163,138,.09),transparent)}
  .dchat header b{font-size:13.5px;font-weight:650;letter-spacing:-.01em}
  .dchat header span{font-size:11px;color:#6c8885;margin-left:auto;font-family:ui-monospace,monospace}
  .dchat header button{background:none;border:0;color:#6c8885;cursor:pointer;font-size:19px;line-height:1;padding:2px 5px;border-radius:6px}
  .dchat header button:hover{background:rgba(10,163,138,.1);color:#0e2b29}
  .dchat-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:11px;scroll-behavior:smooth}
  .dchat-msg{max-width:92%;padding:10px 13px;border-radius:12px;font-size:13.6px;line-height:1.58;white-space:pre-wrap;word-wrap:break-word}
  .dchat-msg.u{align-self:flex-end;background:linear-gradient(140deg,#0aa38a,#2f80ed);color:#fff;border:0}
  .dchat-msg.a{align-self:flex-start;background:#f2f8f6;border:1px solid rgba(16,74,66,.1);color:#0e2b29}
  .dchat-msg.e{align-self:stretch;background:#fff5f4;border:1px solid rgba(214,69,69,.25);color:#8a2b2b;font-size:12.8px}
  .dchat-msg a{color:#1f6fd6}
  .dchat-msg.u a{color:#fff;text-decoration:underline}
  .dchat-chips{display:flex;flex-wrap:wrap;gap:6px}
  .dchat-chips button{font:inherit;font-size:12.2px;padding:6px 11px;border-radius:999px;cursor:pointer;
    border:1px solid rgba(10,163,138,.28);background:#fff;color:#0b6b5c;
    transition:.22s;text-align:left}
  .dchat-chips button:hover{border-color:#0aa38a;color:#0e2b29;background:rgba(10,163,138,.08)}
  .dchat-foot{border-top:1px solid rgba(16,74,66,.1);padding:10px;display:flex;gap:8px;align-items:flex-end}
  .dchat-foot textarea{flex:1;resize:none;min-height:38px;max-height:120px;padding:9px 12px;border-radius:10px;
    border:1px solid rgba(16,74,66,.18);background:#f7fbfa;color:#0e2b29;font:inherit;font-size:13.4px}
  .dchat-foot textarea:focus{outline:none;border-color:#0aa38a;background:#fff}
  .dchat-foot button{border:0;border-radius:10px;cursor:pointer;padding:0 15px;height:38px;font:inherit;font-weight:600;
    background:linear-gradient(100deg,#0aa38a,#2f80ed);color:#fff}
  .dchat-foot button:disabled{opacity:.45;cursor:default}
  .dchat-dots{display:inline-flex;gap:4px;align-items:center}
  .dchat-dots i{width:5px;height:5px;border-radius:50%;background:#0aa38a;animation:dchatb 1.3s infinite}
  .dchat-dots i:nth-child(2){animation-delay:.16s}.dchat-dots i:nth-child(3){animation-delay:.32s}
  @keyframes dchatb{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}
  .dchat-note{font-size:11.4px;color:#6c8885;padding:0 14px 10px;line-height:1.45}
  @media(prefers-reduced-motion:reduce){.dchat,.dchat-fab,.dchat-dots i{transition:none;animation:none}}
  @media(max-width:560px){.dchat{right:8px;bottom:8px;height:min(76vh,calc(100vh - 16px))}}
  `;

  const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };
  const esc = s => String(s ?? '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  // Turn /docs/#harness and bare https:// links into real links; nothing else is interpreted.
  const linkify = s => esc(s)
    .replace(/(https?:\/\/[^\s<)]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|[\s(])(\/[a-z0-9\-/]*\/(?:#[a-z\-]+)?)/gi, '$1<a href="$2">$2</a>');

  function boot() {
    document.head.appendChild(el('style', null, css));

    const fab = el('button', 'dchat-fab',
      '<svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z"/></svg>');
    fab.setAttribute('aria-label', 'Ask about this project');
    fab.setAttribute('aria-expanded', 'false');

    const panel = el('div', 'dchat');
    panel.innerHTML = `
      <header><b>Ask about this project</b><span data-model></span>
        <button data-close aria-label="Close">&times;</button></header>
      <div class="dchat-log" data-log></div>
      <p class="dchat-note">Answers are generated. It is told never to state a number it cannot
        trace, and to say so when it does not know &mdash; check anything load-bearing on the page.</p>
      <div class="dchat-foot">
        <textarea data-in rows="1" aria-label="Your question"></textarea>
        <button data-send>Ask</button>
      </div>`;

    document.body.append(fab, panel);

    const log = panel.querySelector('[data-log]');
    const input = panel.querySelector('[data-in]');
    const send = panel.querySelector('[data-send]');
    const modelTag = panel.querySelector('[data-model]');
    const history = [];
    let busy = false;

    // ── the input suggests questions by cycling them as its placeholder ──────
    let si = 0, cyc = 0;
    const cycle = () => {
      if (document.activeElement === input || input.value) return;
      input.placeholder = SUGGESTIONS[si++ % SUGGESTIONS.length];
    };
    cycle();
    const startCycle = () => { clearInterval(cyc); cyc = setInterval(cycle, 3400); };
    const stopCycle = () => { clearInterval(cyc); input.placeholder = 'Ask anything about this project'; };
    input.addEventListener('focus', stopCycle);
    input.addEventListener('blur', () => { if (!input.value) startCycle(); });

    function chips(items, onPick) {
      if (!items?.length) return;
      const wrap = el('div', 'dchat-chips');
      for (const q of items) {
        const b = el('button', null, esc(q));
        b.addEventListener('click', () => { wrap.remove(); onPick(q); });
        wrap.appendChild(b);
      }
      log.appendChild(wrap);
      log.scrollTop = log.scrollHeight;
    }

    function msg(cls, html) {
      const n = el('div', `dchat-msg ${cls}`, html);
      log.appendChild(n);
      log.scrollTop = log.scrollHeight;
      return n;
    }

    async function ask(q) {
      if (busy || !q.trim()) return;
      busy = true; send.disabled = true;
      input.value = ''; stopCycle();
      msg('u', esc(q));
      history.push({ role: 'user', content: q });
      const thinking = msg('a', '<span class="dchat-dots"><i></i><i></i><i></i></span>');

      try {
        const r = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ messages: history }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          thinking.remove();
          msg('e', `<b>${esc(data.error || `The assistant is unavailable (HTTP ${r.status}).`)}</b>`
            + (data.hint ? `<br><br>${esc(data.hint)}` : '')
            + `<br><br>Everything it would tell you is on the pages themselves &mdash; start at <a href="/docs/">/docs/</a>.`);
        } else {
          thinking.innerHTML = linkify(data.answer || '');
          history.push({ role: 'assistant', content: data.answer || '' });
          if (data.model) modelTag.textContent = data.model;
          chips(data.followups, ask);
        }
      } catch (e) {
        thinking.remove();
        msg('e', `<b>The assistant could not be reached.</b><br><br>${esc(String(e.message || e))}`
          + `<br><br>The pages do not depend on it &mdash; start at <a href="/docs/">/docs/</a>.`);
      } finally {
        busy = false; send.disabled = false;
        log.scrollTop = log.scrollHeight;
        if (!input.value) startCycle();
      }
    }

    let greeted = false;
    function open() {
      panel.classList.add('open');
      fab.setAttribute('aria-expanded', 'true');
      if (!greeted) {
        greeted = true;
        msg('a', 'Ask me about any part of this project &mdash; what it does, what it refuses to do, '
          + 'or where a particular number comes from. I will tell you when I do not know.');
        chips(STARTERS, ask);
        startCycle();
      }
      setTimeout(() => input.focus(), 320);
      try { sessionStorage.setItem('dchat', '1'); } catch { /* blocked storage */ }
    }
    function close() {
      panel.classList.remove('open');
      fab.setAttribute('aria-expanded', 'false');
      try { sessionStorage.removeItem('dchat'); } catch { /* blocked storage */ }
    }

    fab.addEventListener('click', open);
    panel.querySelector('[data-close]').addEventListener('click', close);
    addEventListener('keydown', e => { if (e.key === 'Escape' && panel.classList.contains('open')) close(); });
    send.addEventListener('click', () => ask(input.value));
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input.value); }
    });
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(120, input.scrollHeight) + 'px';
    });

    try { if (sessionStorage.getItem('dchat')) open(); } catch { /* ignore */ }
  }

  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot);
  else boot();
})();
