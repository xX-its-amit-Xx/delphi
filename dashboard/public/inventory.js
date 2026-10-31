(function () {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SPECIES = new Set(['species', 'subspecies']);

document.addEventListener('delphi-ready', () => {
  const claimLabel = Object.fromEntries(window.DELPHI.D.claims.map(c => [c.id, c.label]));
  fetch('inventory.json').then(r => r.json()).then(render).catch(e => { $('#invKpis').textContent = 'Could not load inventory.json: ' + e.message; });

  function render(I) {
    const T = I.taxa;
    const hasG = t => t.g && typeof t.g.t === 'number';
    const gKnown = T.filter(hasG).length;
    const both = T.filter(t => t.pr.length > 1).length;
    const sp = T.filter(t => SPECIES.has(t.r));
    const spRef = sp.filter(t => hasG(t) && t.g.ref > 0);
    const kpi = [
      [T.length, 'distinct taxa'],
      [sp.length, 'at species or subspecies rank'],
      [both, 'named in both Darwin and Thompson'],
      [T.filter(t => t.id.ncbi).length, 'with an NCBI taxon id'],
      [gKnown ? T.filter(t => hasG(t) && t.g.t > 0).length : 'pending', 'with at least one genome assembly'],
      [gKnown ? spRef.length : 'pending', 'species with an NCBI-designated reference genome']
    ];
    $('#invKpis').innerHTML = kpi.map(([k, l]) => `<div class="card"><div class="kpi">${esc(k)}<small>${esc(l)}</small></div></div>`).join('');
    $('#invMeta').textContent = `Taxa come from the collaborators' merged organism data (10 slices of Darwin and Thompson). Genome counts: NCBI Datasets API, ${gKnown} of ${T.filter(t => t.id.ncbi).length} taxa queried${I.genomesRetrieved ? ', retrieved ' + I.genomesRetrieved.slice(0, 16).replace('T', ' ') + ' UTC' : ''}.`;

    // by class
    const byC = {};
    T.forEach(t => { const c = t.l.c || '(unplaced)'; (byC[c] ||= { n: 0, g: 0, ref: 0, sp: 0, spRef: 0 }).n++; if (hasG(t) && t.g.t > 0) byC[c].g++; if (SPECIES.has(t.r)) { byC[c].sp++; if (hasG(t) && t.g.ref > 0) byC[c].spRef++; } });
    const classes = Object.entries(byC).sort((a, b) => b[1].n - a[1].n);
    const max = classes[0][1].n;
    $('#invClass').innerHTML = classes.slice(0, 12).map(([c, v]) => `<button class="clsrow" data-c="${esc(c)}" style="display:grid;grid-template-columns:120px 1fr 90px;gap:8px;align-items:center;width:100%;text-align:left;margin:2px 0;border:0;background:none;padding:2px 4px"><span>${esc(c)}</span><span class="bar"><i style="width:${v.n / max * 100}%"></i></span><span class="small mute">${v.n} taxa${gKnown ? ', ' + v.g + ' with genomes' : ''}</span></button>`).join('');

    // evaluation set
    const evalRows = classes.filter(([, v]) => v.spRef > 0).slice(0, 8);
    $('#invEval').innerHTML = gKnown ? `<table><tr><th>Class (a clade to hold out)</th><th>Species with a reference genome</th></tr>${evalRows.map(([c, v]) => `<tr><td>${esc(c)}</td><td>${v.spRef} of ${v.sp} species</td></tr>`).join('')}</table>` : '<p class="small mute">Genome data still loading.</p>';

    // gaps
    const noGbif = T.filter(t => !t.id.gbif).length, noNcbi = T.filter(t => !t.id.ncbi).length, noDs = T.filter(t => t.nd === 0).length;
    const mamAves = T.filter(t => t.l.c === 'Mammalia' || t.l.c === 'Aves').length;
    const high = T.filter(t => !['species', 'subspecies', 'genus'].includes(t.r)).length;
    $('#invGaps').innerHTML = `<li><b>${mamAves} of ${T.length}</b> taxa are mammals or birds. Darwin and Thompson wrote about animals people kept, hunted and could see, so plants, fungi, microbes and most invertebrates are missing.</li>
      <li>"Reference genome" is NCBI's label, and NCBI applies it to a species' only assembly even when it is a rough scaffold (checked on three single-assembly species today). Treat it as 'a genome exists', not as 'a good genome'. Filter on assembly level before scoring anything.</li>
      <li><b>${high}</b> entries are families, orders or classes, not species ("hawks", "Aves"). They are useful for clade-level tests but cannot carry a genome.</li>
      <li><b>${noGbif}</b> lack a GBIF key, <b>${noNcbi}</b> lack an NCBI taxon id, <b>${noDs}</b> have no linked dataset.</li>
      <li>The merge step flagged 11 conflicts between slices (7 dataset counts, 4 taxon identifiers for dog and Elephantidae). The holdout thread resolved all 11, checking identifiers against Wikidata and ITIS and re-downloading files to recount.</li>
      <li>Plants and animals the text does not name, which is nearly all of life, are absent by construction. This is an inventory of what two books mention, not of species.</li>`;

    // table
    const cls = [...new Set(T.map(t => t.l.c).filter(Boolean))].sort();
    $('#iClass').innerHTML = '<option value="">All classes</option>' + cls.map(c => `<option>${esc(c)}</option>`).join('');
    $('#iRank').innerHTML = '<option value="">All ranks</option>' + [...new Set(T.map(t => t.r))].sort().map(c => `<option>${esc(c)}</option>`).join('');
    let shown = 30, list = [];
    const render2 = () => {
      const q = $('#iq').value.trim().toLowerCase(), c = $('#iClass').value, r = $('#iRank').value, p = $('#iProj').value, g = $('#iGen').value;
      list = T.filter(t => (!c || t.l.c === c) && (!r || t.r === r)
        && (!p || (p === 'both' ? t.pr.length > 1 : t.pr.length === 1 && t.pr[0] === p))
        && (!g || (g === 'ref' ? hasG(t) && t.g.ref > 0 : g === 'any' ? hasG(t) && t.g.t > 0 : hasG(t) && t.g.t === 0))
        && (!q || (t.n + ' ' + t.v.join(' ') + ' ' + t.l.f + ' ' + t.l.o).toLowerCase().includes(q)));
      list.sort((a, b) => b.mc - a.mc);
      $('#iCount').textContent = `${list.length} taxa match`;
      $('#iList').innerHTML = list.slice(0, shown).map(t => {
        const gtxt = !t.id.ncbi ? 'no NCBI id' : !hasG(t) ? 'genome data pending' : t.g.t === 0 ? 'no genome yet' : `${t.g.t.toLocaleString()} assemblies${t.g.ref ? ', reference exists' : ''}`;
        const links = [t.id.gbif && `<a href="https://www.gbif.org/species/${t.id.gbif}" target="_blank" rel="noopener">GBIF ${t.id.gbif}</a>`, t.id.ncbi && `<a href="https://www.ncbi.nlm.nih.gov/datasets/taxonomy/${t.id.ncbi}/" target="_blank" rel="noopener">NCBI ${t.id.ncbi}</a>`, t.id.wd && `<a href="https://www.wikidata.org/wiki/${t.id.wd}" target="_blank" rel="noopener">${t.id.wd}</a>`, t.g?.acc && `<a href="https://www.ncbi.nlm.nih.gov/datasets/genome/${t.g.acc}/" target="_blank" rel="noopener">${t.g.acc}</a>`].filter(Boolean).join(' &middot; ');
        return `<details><summary><i>${esc(t.n)}</i> <span class="chip">${esc(t.r)}</span> <span class="chip">${esc(t.l.c || '?')}</span> ${t.pr.length > 1 ? '<span class="chip viol">both books</span>' : ''} <span class="small mute">${esc(t.v[0] || '')} &middot; ${t.mc} mentions &middot; ${esc(gtxt)}</span></summary><div class="in small">
          <p><b>Lineage:</b> ${[t.l.p, t.l.c, t.l.o, t.l.f].filter(Boolean).map(esc).join(' &rsaquo; ')}</p>
          ${t.v.length ? `<p><b>Called:</b> ${t.v.map(esc).join(', ')}</p>` : ''}
          <p><b>Identifiers:</b> ${links || 'none resolved'}</p>
          <p><b>Evidence:</b> ${t.nd} linked datasets &middot; ${t.pr.map(esc).join(', ')}</p>
          ${t.q ? `<div class="quote">&ldquo;${esc(t.q.q)}&rdquo; <span class="mute">(written as &ldquo;${esc(t.q.w)}&rdquo;)</span></div>` : ''}
          ${t.cl.length ? `<p><b>Claims that mention it${t.ncl > t.cl.length ? ' (first ' + t.cl.length + ' of ' + t.ncl + ')' : ''}:</b></p><ul>${t.cl.map(c => `<li>${esc(claimLabel[c] || c)}</li>`).join('')}</ul>` : ''}</div></details>`;
      }).join('');
      $('#iMore').style.display = shown >= list.length ? 'none' : '';
    };
    ['#iq', '#iClass', '#iRank', '#iProj', '#iGen'].forEach(s => $(s).addEventListener('input', () => { shown = 30; render2(); }));
    $('#iMore').onclick = () => { shown += 60; render2(); };
    $('#invClass').onclick = e => { const b = e.target.closest('.clsrow'); if (!b) return; $('#iClass').value = b.dataset.c; shown = 30; render2(); $('#iList').scrollIntoView({ behavior: 'smooth', block: 'center' }); };
    render2();
  }
});
})();
