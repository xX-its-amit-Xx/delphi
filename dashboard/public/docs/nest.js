/* docs/nest.js — the nested glossary.
 *
 * Any element with data-term opens a definition card. Inside that card, every related term and
 * every glossary term mentioned in the text is itself a link, and clicking one pushes a NEW card
 * on top. A breadcrumb shows the path taken, so a reader can drill as deep as they like and step
 * back out one level at a time, the way you would follow footnotes in a textbook.
 *
 * Reads window.GLOSSARY, which glossary.js and terms.js populate. Terms are auto-linked in the
 * product report's prose on load: the first mention per section only, so a paragraph does not
 * turn into a wall of underlines.
 */
(() => {
  const G = () => window.GLOSSARY || {};
  const esc = s => String(s ?? '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  const keys = () => Object.keys(G()).sort((a, b) => b.length - a.length);   // longest first
  // escape a string for use in a RegExp, written without backslashes so no shell layer mangles it
  const SPECIAL = new Set('.*+?^${}()|[]/'.split('').concat(String.fromCharCode(92)));
  const reRx = s => [...s].map(c => (SPECIAL.has(c) ? String.fromCharCode(92) + c : c)).join('');

  // Link glossary terms inside a string of plain text, skipping the term being defined.
  function linkText(text, self) {
    let out = esc(text);
    for (const k of keys()) {
      if (k === self) continue;
      const B = String.fromCharCode(92);
      const rx = new RegExp('(^|[^' + B + 'w>-])(' + reRx(esc(k)) + ')(?=[^' + B + 'w<-]|$)', 'i');
      out = out.replace(rx, (_, pre, w) => `${pre}<button class="nt" data-term="${esc(k)}">${w}</button>`);
    }
    return out;
  }

  let panel, stack = [];
  function ensure() {
    if (panel) return panel;
    panel = document.createElement('aside');
    panel.className = 'nest';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Glossary');
    panel.innerHTML = `<div class="nest-head"><nav class="nest-crumbs" aria-label="Path"></nav>
      <button class="nest-x" aria-label="Close glossary">&times;</button></div>
      <div class="nest-body"></div>`;
    document.body.appendChild(panel);
    panel.querySelector('.nest-x').addEventListener('click', close);
    panel.addEventListener('click', e => {
      // stopPropagation is load-bearing. push() re-renders the card, which DETACHES the button
      // that was just clicked; the click then bubbled to the document listener, which saw a
      // node no longer inside the panel and called open() - resetting the stack to one level.
      // So every chip click replaced the definition instead of nesting it.
      const t = e.target.closest('[data-term]');
      if (t && panel.contains(t)) { e.preventDefault(); e.stopPropagation(); push(t.dataset.term); return; }
      const c = e.target.closest('[data-depth]');
      if (c) { e.stopPropagation(); stack = stack.slice(0, Number(c.dataset.depth) + 1); render(); }
    });
    addEventListener('keydown', e => {
      if (!panel.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'Backspace' && stack.length > 1 && !/input|textarea/i.test(e.target.tagName)) { stack.pop(); render(); }
    });
    return panel;
  }

  function render() {
    const k = stack[stack.length - 1], d = G()[k];
    const body = panel.querySelector('.nest-body');
    panel.querySelector('.nest-crumbs').innerHTML = stack.map((s, i) =>
      i === stack.length - 1 ? `<b>${esc(s)}</b>` : `<button data-depth="${i}">${esc(s)}</button><i>›</i>`).join('');
    if (!d) { body.innerHTML = `<p>No definition for <b>${esc(k)}</b> yet.</p>`; return; }
    body.innerHTML = `
      <h4>${esc(k)}</h4>
      <p class="nest-short">${linkText(d.short, k)}</p>
      ${d.long ? `<p>${linkText(d.long, k)}</p>` : ''}
      ${d.why ? `<p class="nest-why"><span>Why it matters here</span>${linkText(d.why, k)}</p>` : ''}
      ${d.see?.length ? `<div class="nest-see"><span>Go deeper</span>${d.see.map(s =>
        `<button class="nt-chip" data-term="${esc(s)}"${G()[s] ? '' : ' disabled'}>${esc(s)}</button>`).join('')}</div>` : ''}
      <p class="nest-depth">${stack.length > 1 ? `${stack.length} levels deep &middot; Backspace or the path above to step back` : 'Tap any underlined word to go a level deeper'}</p>`;
    body.scrollTop = 0;
  }

  // Revisiting a term already on the path jumps BACK to it rather than stacking a duplicate,
  // so the breadcrumb stays a real path and two cross-linked terms cannot cycle forever.
  function push(k) {
    ensure();
    const at = stack.indexOf(k);
    if (at >= 0) stack = stack.slice(0, at + 1); else stack.push(k);
    panel.classList.add('open'); render();
  }
  function open(k) { ensure(); stack = [k]; panel.classList.add('open'); render(); }
  function close() { panel?.classList.remove('open'); }

  // Auto-link prose on the page: first mention of each term per section.
  function autolink() {
    const roots = document.querySelectorAll('main section, .phero-copy, .sx-body');
    for (const r of roots) {
      const seen = new Set();
      const walker = document.createTreeWalker(r, NodeFilter.SHOW_TEXT, {
        acceptNode: n => (n.parentElement.closest('pre,code,button,a,h1,h2,.nest,.nt,script,style,.al-zoom')
          ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
      });
      const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const n of nodes) {
        for (const k of keys()) {
          if (seen.has(k)) continue;
          const i = n.nodeValue.toLowerCase().indexOf(k.toLowerCase());
          if (i < 0) continue;
          const before = n.nodeValue[i - 1], after = n.nodeValue[i + k.length];
          if ((before && /[A-Za-z0-9_]/.test(before)) || (after && /[A-Za-z0-9_]/.test(after))) continue;
          const tail = n.splitText(i); tail.splitText(k.length);
          const b = document.createElement('button');
          b.className = 'nt'; b.dataset.term = k; b.textContent = tail.nodeValue;
          tail.replaceWith(b);
          seen.add(k);
          break;
        }
      }
    }
  }

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-term]');
    if (t && !panel?.contains(t)) { e.preventDefault(); open(t.dataset.term); }
  });
  window.__nest = { open, autolink };
  const go = () => setTimeout(autolink, 600);   // after the page's own renderers have filled in
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', go); else go();
})();
