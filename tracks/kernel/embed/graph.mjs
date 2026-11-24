#!/usr/bin/env node
// The store as a knowledge graph: nodes, edges, a JSON-LD serialisation, and one self-contained HTML
// page to read it in.
//
// "Private" is the important word. This writes to a directory inside the project and nowhere else. It
// opens no socket and contacts no registry: nothing here publishes to a nanopublication server, an
// institutional repository or any other outside service, because that is a decision for whoever owns
// the signing key, not for a build step. What it does give you is that the moment a node is minted the
// graph next to it is current, so the project always has a readable, linkable record of its own
// reasoning without anybody remembering to regenerate anything.
//
// The store is already a graph — a node's id is the hash of its content, and its references are the
// ids of the nodes underneath it — so this is a serialisation, not a drawing. No layout is invented
// and no edge exists here that is not a field in a record.

import fs from 'node:fs';
import path from 'node:path';

const REF_FIELDS = ['evidence', 'facts', 'verdicts', 'law'];

// What each node type contributes to a reader skimming the graph.
const LABEL = {
  evidence: (n) => `${n.kind}:${n.ref}`,
  fact: (n) => `${n.quantity} = ${n.value} ${n.unit}`,
  law: (n) => n.name,
  verdict: (n) => `${n.result}: ${n.law_name}${n.label ? ` (${n.label})` : ''}`,
  build: (n) => n.artifact,
  refusal: (n) => n.what,
};

export function graph(nodes) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out = { nodes: [], edges: [], counts: {}, generated_from: 'the store itself; every edge below is a field in a record' };
  for (const n of nodes) {
    out.counts[n.type] = (out.counts[n.type] ?? 0) + 1;
    out.nodes.push({
      id: n.id,
      type: n.type,
      label: (LABEL[n.type] ?? (() => n.type))(n),
      result: n.result ?? null,
      detail: n.detail ?? null,
      quote: n.quote ?? null,
      where: n.where ?? null,
      ref: n.ref ?? null,
      informal: n.informal ?? null,
      conditions: n.conditions ?? null,
      because: n.because ?? null,
      emitted: n.emitted ?? null,
      lean_file: n.lean_file ?? null,
      axioms: n.audit?.axioms ?? null,
      at: n.at ?? null,
      prev: n.prev ?? null,
    });
    for (const field of REF_FIELDS) {
      const v = n[field];
      if (!v) continue;
      for (const ref of Array.isArray(v) ? v : [v]) {
        if (!byId.has(ref)) continue;
        out.edges.push({ from: ref, to: n.id, field });
      }
    }
  }
  return out;
}

// JSON-LD, so the graph can be loaded by something that speaks RDF without this project's vocabulary
// being invented twice. Terms are minted under the project's own namespace: this is a local record,
// not a claim on anybody else's identifiers.
export function jsonld(nodes, { base = 'https://example.org/delphi/' } = {}) {
  const term = (t) => `delphi:${t}`;
  return {
    '@context': {
      delphi: base,
      prov: 'http://www.w3.org/ns/prov#',
      dct: 'http://purl.org/dc/terms/',
      quote: 'delphi:quote',
      where: 'delphi:where',
    },
    '@id': `${base}store`,
    '@type': 'prov:Collection',
    'dct:description': 'A DELPHI kernel store. Each member is named by the sha256 of its own content and chained to the record written before it. Nothing here has been published to any outside registry.',
    'prov:hadMember': nodes.map((n) => {
      const o = { '@id': `${base}${n.id}`, '@type': term(n.type[0].toUpperCase() + n.type.slice(1)) };
      if (n.kind) o['dct:identifier'] = `${n.kind}:${n.ref}`;
      if (n.quote) o.quote = n.quote;
      if (n.where) o.where = n.where;
      if (n.quantity) { o[term('quantity')] = n.quantity; o[term('value')] = n.value; o[term('unit')] = n.unit; }
      if (n.conditions) o[term('conditions')] = n.conditions;
      if (n.name) o[term('name')] = n.name;
      if (n.informal) o[term('informal')] = n.informal;
      if (n.lean_file) { o[term('leanFile')] = n.lean_file; o[term('axioms')] = n.audit?.axioms ?? []; }
      if (n.result) { o[term('result')] = n.result; o[term('detail')] = n.detail; o[term('law')] = n.law_name; }
      if (n.artifact) o[term('artifact')] = n.artifact;
      if (n.what) { o[term('refused')] = n.what; o[term('because')] = n.because; }
      if (n.emitted) o[term('emitted')] = n.emitted;
      const used = REF_FIELDS.flatMap((f) => (Array.isArray(n[f]) ? n[f] : n[f] ? [n[f]] : [])).map((r) => ({ '@id': `${base}${r}` }));
      if (used.length) o['prov:used'] = used;
      if (n.prev) o[term('chainedTo')] = { '@id': `${base}${n.prev}` };
      return o;
    }),
  };
}

// ---------------------------------------------------------------------------------------------------
// the viewer: one file, no network, no dependency. It degrades to a readable list with no scripting.

export function html(g, { title = 'What this project has checked' } = {}) {
  const data = JSON.stringify(g).replace(/</g, '\\u003c');
  const rows = g.nodes.map((n) => {
    const bits = [`<strong>${esc(n.type)}</strong>`, `<code>${esc(n.id)}</code>`, esc(n.label)];
    if (n.detail) bits.push(esc(n.detail));
    if (n.because) bits.push('because: ' + n.because.map(esc).join('; '));
    return `<li class="n ${esc(n.type)}${n.result ? ' r-' + esc(n.result) : ''}">${bits.join(' &middot; ')}</li>`;
  }).join('\n');
  const counts = Object.entries(g.counts).map(([k, v]) => `${v} ${k}`).join(', ');
  return `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
 :root{--paper:#f6f3ec;--ink:#1d2433;--edge:#4a8a7a;--dim:#6b7280;
       --ok:#2f7d5d;--warn:#b4552a;--spec:#7a6a9a}
 @media (prefers-color-scheme:dark){:root:not([data-theme=light]){--paper:#161a22;--ink:#e8e6e1;--dim:#9aa3af}}
 :root[data-theme=dark]{--paper:#161a22;--ink:#e8e6e1;--dim:#9aa3af}
 *{box-sizing:border-box}
 body{margin:0;background:var(--paper);color:var(--ink);
      font:15px/1.5 Inter,-apple-system,Helvetica Neue,Arial,sans-serif;padding:24px 16px 64px}
 .wrap{max-width:1180px;margin:0 auto}
 h1{font-size:20px;margin:0 0 4px;font-weight:620}
 p.sub{color:var(--dim);margin:0 0 20px;max-width:62ch}
 svg{width:100%;height:auto;display:block;background:transparent}
 ul{list-style:none;padding:0;margin:20px 0 0;font-size:13px}
 li.n{padding:5px 0;border-bottom:1px solid color-mix(in srgb,var(--ink) 10%,transparent)}
 code{font:12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--dim)}
 .r-inside{border-left:3px solid var(--ok);padding-left:8px}
 .r-outside{border-left:3px solid var(--warn);padding-left:8px}
 .r-cannot-assess{border-left:3px solid var(--spec);padding-left:8px}
 .legend{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--dim);margin:12px 0 0}
 .legend b{font-weight:600;color:var(--ink)}
 .tip{position:fixed;pointer-events:none;background:var(--paper);color:var(--ink);
      border:1px solid color-mix(in srgb,var(--ink) 22%,transparent);padding:8px 10px;max-width:42ch;
      font-size:12px;border-radius:4px;opacity:0;transition:opacity .1s;box-shadow:0 2px 10px rgba(0,0,0,.14)}
 footer{color:var(--dim);font-size:12px;margin-top:28px}
</style>
<div class="wrap">
<h1>${esc(title)}</h1>
<p class="sub">${esc(counts)}. Every edge is a field in a record, not a drawing: a node's name is the
hash of its own content, so this graph is the store in its own order. Nothing here has been published
to any outside service.</p>
<svg id="g" viewBox="0 0 1180 560" role="img" aria-label="the store as a graph"></svg>
<div class="legend"><span><b>evidence</b> a source and the words read in it</span>
<span><b>fact</b> a measured number</span><span><b>law</b> a checked statement</span>
<span><b>verdict</b> inside / outside / cannot-assess</span>
<span><b>build</b> an artifact</span><span><b>refusal</b> an artifact that was not made, and why</span></div>
<ul>
${rows}
</ul>
<footer>Generated by <code>delphi graph</code> from the project's own store.</footer>
</div>
<div class="tip" id="tip"></div>
<script>
const G = ${data};
const COL = {evidence:'#6b7280',fact:'#4a8a7a',law:'#1d2433',verdict:'#7a6a9a',build:'#2f7d5d',refusal:'#b4552a'};
const RCOL = {inside:'#2f7d5d',outside:'#b4552a','cannot-assess':'#7a6a9a'};
const ORDER = ['evidence','fact','law','verdict','build','refusal'];
const svg = document.getElementById('g'), tip = document.getElementById('tip');
const W = 1180, H = 560, PAD = 54;
// One column per primitive, in the order the method runs. Position is the record's own type and its
// place in the chain; nothing is force-directed, so the same store always draws the same picture.
const cols = ORDER.filter(t => G.nodes.some(n => n.type === t));
const x = t => PAD + (W - 2*PAD) * (cols.indexOf(t) / Math.max(1, cols.length - 1));
const pos = {};
for (const t of cols) {
  const ns = G.nodes.filter(n => n.type === t);
  ns.forEach((n, i) => { pos[n.id] = {x: x(t), y: PAD + (H - 2*PAD) * ((i + 0.5) / ns.length)}; });
}
const el = (name, attrs) => { const e = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
for (const e of G.edges) {
  const a = pos[e.from], b = pos[e.to]; if (!a || !b) continue;
  const mx = (a.x + b.x) / 2;
  svg.appendChild(el('path', {d:\`M\${a.x} \${a.y} C \${mx} \${a.y} \${mx} \${b.y} \${b.x} \${b.y}\`,
    fill:'none', stroke:'#4a8a7a', 'stroke-width':1, 'stroke-opacity':0.28}));
}
for (const t of cols) svg.appendChild(Object.assign(el('text', {x:x(t), y:24, 'text-anchor':'middle',
  'font-size':12, fill:'#6b7280', 'font-weight':600}), {textContent:t}));
for (const n of G.nodes) {
  const p = pos[n.id]; if (!p) continue;
  const c = el('circle', {cx:p.x, cy:p.y, r:6, fill:RCOL[n.result] || COL[n.type] || '#1d2433',
    'fill-opacity':0.9, stroke:'#f6f3ec', 'stroke-width':1.5, tabindex:0});
  const text = [n.type + '  ' + n.id, n.label, n.detail, n.quote && '"' + n.quote + '"',
    n.where, n.because && n.because.join('; ')].filter(Boolean).join('\\n');
  c.appendChild(Object.assign(el('title', {}), {textContent:text}));
  const show = ev => { tip.textContent = text; tip.style.opacity = 1;
    const r = ev.target.getBoundingClientRect();
    tip.style.left = Math.min(window.innerWidth - 340, r.right + 10) + 'px';
    tip.style.top = (r.top + 10) + 'px'; };
  c.addEventListener('mouseenter', show); c.addEventListener('focus', show);
  c.addEventListener('mouseleave', () => tip.style.opacity = 0);
  c.addEventListener('blur', () => tip.style.opacity = 0);
  svg.appendChild(c);
}
</script>
`;
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Write the whole set next to the store. Called after every command that mints a node, so the graph is
// never stale, and only ever into `dir`.
export function publish(nodes, dir, { title, base } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const g = graph(nodes);
  const files = [
    ['graph.json', JSON.stringify(g, null, 1) + '\n'],
    ['graph.jsonld', JSON.stringify(jsonld(nodes, base ? { base } : {}), null, 1) + '\n'],
    ['index.html', html(g, title ? { title } : {})],
  ];
  for (const [f, text] of files) fs.writeFileSync(path.join(dir, f), text);
  return { dir, files: files.map(([f, text]) => ({ file: f, bytes: Buffer.byteLength(text) })), nodes: g.nodes.length, edges: g.edges.length };
}

export default { graph, jsonld, html, publish };
