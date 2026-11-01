/* docs/align/align.js — the live alignment, drawn like a code diff.
 *
 * Green = identical residue, red = substitution, amber = indel, and GREY = no data. That fourth
 * colour is the point: the Exocoetus rows are projections from Daane et al. 2021 and cover only
 * part of most proteins, so an uncovered column is absence of evidence. Painting it green would
 * claim agreement nobody measured; painting it red would claim a difference nobody measured.
 *
 * The sweep animates once per gene, then the alignment is static and interactive: hover for the
 * column, click to zoom into the residues, and the edited column is marked wherever it exists.
 *
 * Everything drawn comes from data.json, which align/build.mjs generates from
 * sequences/alignments/*.json and refuses to build if a row length or a reference residue
 * disagrees with the variant record.
 */

(() => {
  const host = document.getElementById('align');
  if (!host) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

  const COL = { s: '#2fa36b', d: '#e5484d', g: '#f0a33a', n: '#c9d6d2' };
  const NAME = { s: 'identical', d: 'substitution', g: 'indel', n: 'no data' };

  fetch('align/data.json')
    .then(r => { if (!r.ok) throw new Error(`align/data.json: HTTP ${r.status}`); return r.json(); })
    .then(render)
    .catch(err => {
      host.innerHTML = `<div class="card bad"><h4>The alignment did not load</h4>
        <p style="margin:0">${esc(err.message)} — run <code>node dashboard/public/docs/align/build.mjs</code></p></div>`;
    });

  function render(d) {
    const genes = d.genes.filter(g => g.compared_to);
    let cur = genes.find(g => g.edit) || genes[0];

    host.innerHTML = `
      <div class="al-head">
        <div>
          <p class="kicker">Live alignment</p>
          <h3>The predicted fish, beside a real one</h3>
          <p class="al-lede">MorphoLemma predicts a flying zebrafish. This is that prediction set
            against <em>Exocoetus volitans</em>, a flying fish that exists — residue by residue,
            coloured like a diff.</p>
        </div>
        <div class="al-genes" role="tablist">${genes.map(g =>
          `<button class="al-gene" data-g="${esc(g.gene)}" role="tab">${esc(g.gene)}${g.edit ? '<i>edited</i>' : ''}</button>`).join('')}</div>
      </div>
      <div class="al-body"></div>
      <div class="al-foot">
        <div class="al-legend">${Object.entries(NAME).map(([k, v]) =>
          `<span><i style="background:${COL[k]}"></i>${v}</span>`).join('')}</div>
        <p class="al-src">${esc(d.what_this_is)}</p>
      </div>`;

    const body = host.querySelector('.al-body');
    host.querySelectorAll('.al-gene').forEach(b => b.addEventListener('click', () => {
      cur = genes.find(g => g.gene === b.dataset.g);
      draw();
    }));

    function draw() {
      host.querySelectorAll('.al-gene').forEach(b =>
        b.setAttribute('aria-selected', String(b.dataset.g === cur.gene)));

      const rows = cur.rows.filter(r => r.present);
      const W = 100 / cur.columns;
      const track = cur.runs.map(([cls, at, len]) =>
        `<i class="r" data-c="${cls}" data-at="${at}" data-len="${len}" style="left:${(at * W).toFixed(4)}%;width:${(len * W).toFixed(4)}%;background:${COL[cls]}"></i>`).join('');

      const editMark = cur.edit
        ? `<b class="al-edit" style="left:${(cur.edit.col * W).toFixed(4)}%" title="${esc(cur.edit.id)}"></b>` : '';

      body.innerHTML = `
        <div class="al-meta">
          <span class="al-pill">${esc(cur.compared_to.label)}</span>
          <span><b>${cur.identity_pct}%</b> identical where both are covered</span>
          <span><b>${cur.coverage_pct}%</b> of columns covered by the comparator</span>
          <span>${cur.columns} columns</span>
        </div>
        ${cur.fallback_reason ? `<p class="al-note">${esc(cur.fallback_reason)}</p>` : ''}
        <div class="al-rows">${rows.map(r => `
          <div class="al-row" data-kind="${r.kind}">
            <span class="al-label"><b>${esc(r.label)}</b><i>${esc(r.sub)}</i></span>
            <span class="al-seqbar">${r.kind === 'base' || r.kind === 'engineered' ? '' : track}
              ${r.kind === 'engineered' ? editMark : ''}
              <span class="al-strip" data-row="${esc(r.key)}"></span></span>
          </div>`).join('')}</div>
        <div class="al-track"><span class="al-sweep"></span>${track}${editMark}</div>
        <div class="al-zoom" hidden></div>
        <p class="al-src">${esc(cur.aligner || '')}. ${cur.edit
          ? `The edited row is derived: zebrafish with <code>${esc(cur.edit.ref + String(cur.edit.pos) + cur.edit.alt)}</code> applied at aligned column ${cur.edit.col}.` : ''}</p>`;

      // per-row strips: each row painted against the base, so every row is readable on its own
      const base = rows.find(r => r.kind === 'base');
      for (const r of rows) {
        const el = body.querySelector(`.al-strip[data-row="${CSS.escape(r.key)}"]`);
        if (!el || r.kind === 'base') continue;
        const span = [...r.seq].map((ch, i) => {
          const b = base.seq[i];
          if (ch === 'X') return 'n';
          if (ch === '-' || b === '-') return 'g';
          return ch === b ? 's' : 'd';
        }).join('');
        let out = '';
        for (let c = 0; c < span.length;) {
          let e = c; while (e < span.length && span[e] === span[c]) e++;
          out += `<i style="left:${(c * W).toFixed(4)}%;width:${((e - c) * W).toFixed(4)}%;background:${COL[span[c]]}"></i>`;
          c = e;
        }
        el.innerHTML = out;
      }

      sweep();
      wireZoom(rows, W);
    }

    function sweep() {
      const s = body.querySelector('.al-sweep');
      if (!s || reduce) return;
      s.style.transition = 'none'; s.style.transform = 'scaleX(0)';
      requestAnimationFrame(() => {
        s.style.transition = 'transform 1.5s cubic-bezier(.3,.7,.3,1)';
        s.style.transform = 'scaleX(1)';
      });
      for (const el of body.querySelectorAll('.al-rows .al-strip, .al-track')) {
        el.style.clipPath = 'inset(0 100% 0 0)';
        requestAnimationFrame(() => {
          el.style.transition = 'clip-path 1.5s cubic-bezier(.3,.7,.3,1)';
          el.style.clipPath = 'inset(0 0 0 0)';
        });
      }
    }

    function wireZoom(rows, W) {
      const track = body.querySelector('.al-track');
      const zoom = body.querySelector('.al-zoom');
      if (!track || !zoom) return;
      const open = (col) => {
        const lo = Math.max(0, col - 30), hi = Math.min(cur.columns, col + 30);
        const base = rows.find(r => r.kind === 'base');
        zoom.hidden = false;
        zoom.innerHTML = `
          <div class="al-zhead">Columns ${lo + 1}–${hi}
            <button class="al-zclose" aria-label="Close">&times;</button></div>
          ${rows.map(r => {
            const cells = [];
            for (let c = lo; c < hi; c++) {
              const ch = r.seq[c], b = base.seq[c];
              let k = 's';
              if (r.kind === 'base') k = 'b';
              else if (ch === 'X') k = 'n';
              else if (ch === '-' || b === '-') k = 'g';
              else if (ch !== b) k = 'd';
              const isEdit = cur.edit && c === cur.edit.col;
              cells.push(`<i class="${k}${isEdit ? ' e' : ''}" title="column ${c + 1}">${ch === '-' ? '·' : esc(ch)}</i>`);
            }
            return `<div class="al-zrow"><span>${esc(r.label)}</span><code>${cells.join('')}</code></div>`;
          }).join('')}
          ${cur.edit && cur.edit.col >= lo && cur.edit.col < hi
            ? `<p class="al-znote"><b>${esc(cur.edit.id)}</b> — ${esc(cur.edit.what || '')}</p>` : ''}`;
        zoom.querySelector('.al-zclose').addEventListener('click', () => { zoom.hidden = true; });
        zoom.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
      };
      track.addEventListener('click', (e) => {
        const r = track.getBoundingClientRect();
        open(Math.floor(((e.clientX - r.left) / r.width) * cur.columns));
      });
      if (cur.edit) {
        const m = body.querySelector('.al-track .al-edit');
        if (m) m.addEventListener('click', (e) => { e.stopPropagation(); open(cur.edit.col); });
      }
    }

    draw();
  }
})();
