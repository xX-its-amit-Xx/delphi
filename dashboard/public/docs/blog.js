/* docs/blog.js — the prose view.
 *
 * A traditional article in layman's English: one long post about MorphoLemma, with a short
 * post inside it for each of the five products. No tables, no commands, no collapsed
 * sections — if a reader has to click to find out what we did, this view has failed.
 *
 * The text lives in blog.json and is authored by hand. It is deliberately NOT generated
 * from the technical data: prose that tries to track live numbers either goes stale or
 * turns into a table with sentences around it. The few figures quoted here are the ones
 * that do not move (0.67 vs 8.64 m/s, 166x, 0.47 -> 0.88) and they also appear in the
 * technical views, where they ARE generated and checked.
 */
(() => {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  // *word* -> em, **word** -> strong, so the prose can carry emphasis without raw HTML in JSON.
  const rich = s => esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');

  const ORDER = ['nanopubs', 'leanbio', 'mcp', 'studio', 'harness'];

  fetch('blog.json')
    .then(r => { if (!r.ok) throw new Error(`blog.json: HTTP ${r.status}`); return r.json(); })
    .then(render)
    .catch(err => console.error('[blog]', err.message));

  function render(d) {
    const host = document.createElement('div');
    host.className = 'bl';

    const intro = d.intro;
    host.innerHTML = `
      <div class="bl-intro">
        <h1>${rich(intro.title)}</h1>
        <p class="bl-stand">${rich(intro.standfirst)}</p>
        ${intro.body.map(p => `<p>${rich(p)}</p>`).join('')}
      </div>
      ${ORDER.filter(k => d.posts[k]).map((k, i) => {
        const post = d.posts[k];
        return `<article class="bl-post" id="blog-${esc(k)}">
          <p class="bl-kick">Part ${i + 1} of 5</p>
          <h2>${rich(post.title)}</h2>
          <p class="bl-stand">${rich(post.standfirst)}</p>
          ${post.img ? `<figure class="bl-fig"><img src="${esc(post.img)}" alt="" loading="lazy"></figure>` : ''}
          ${post.body.map(p => `<p>${rich(p)}</p>`).join('')}
        </article>`;
      }).join('')}
      <div class="bl-end">
        <p>That is the short version. Switch this page to <b>Technical &middot; skim</b> for the
        structure, the use cases and the exact commands, or <b>Technical &middot; deep</b> for the
        full report — the runs, the data, the benchmarks and everything that did not work.</p>
      </div>`;

    // Goes INSIDE #overview, which is the one section blog view keeps. Everything else in
    // there is hidden by CSS, so the article becomes the whole page rather than sitting
    // underneath a display hero and an overview heading that say the same thing again.
    const ov = document.getElementById('overview');
    (ov || document.querySelector('main')).appendChild(host);
  }
})();
