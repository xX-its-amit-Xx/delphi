/*
 * validate-show act: THE MOLECULAR SCALE
 * ======================================
 * Owner: the molecular thread. Conforms to SCENES.md v2 (§1 signature, §4 provenance,
 * §5 rendered gaps, §10 generality).
 *
 * What is real here, and what is not:
 *  - Every coordinate drawn is a real deposited or predicted coordinate. Backbone traces come
 *    from AlphaFold DB models (CA atoms, pLDDT in the B-factor column) and from experimental
 *    PDB entries, both fetched at build time and decimated to CA-only by
 *    `structures/build_pack.py`. Nothing is idealised, generated or posed.
 *  - Every residue position, domain boundary, modification site, distance and interaction score
 *    comes from the repo's own data (omics/proteomic, omics/ptm, structures/, genotype/).
 *  - The ONLY things invented by this file are: the camera path, the layout of the interaction
 *    halo (partner nodes are placed on a sphere for legibility — their positions mean nothing),
 *    and the 1D sequence ruler's pixel scale. All three are declared `decorative` in provenance.
 *
 * Generality (SCENES.md §10): this file contains no gene symbol, no organism name, no body part
 * and no pathway. The subject genes are whatever `data.design.edits` names; if a design edits no
 * genes, they are the genes the repo's own fin-subtree data records as *required for* or
 * *sufficient for* the parts that `data.case.changed[]` moved. Every gene-specific fact on screen
 * is read out of the data pack at run time.
 */

const PACK = new URL('./structures/', import.meta.url);

/* AlphaFold DB's own published confidence bands and colours. These are not a chosen palette:
 * they are the legend AlphaFold ships, so a viewer who has seen an AlphaFold page reads this
 * structure the same way. Low confidence is meant to look wrong. */
const PLDDT_BANDS = [
  { min: 90, max: 101, key: 'very_high_gt90', label: 'Very high (pLDDT > 90)', hex: 0x0053d6, css: '#0053d6' },
  { min: 70, max: 90, key: 'confident_70_90', label: 'Confident (70–90)', hex: 0x65cbf3, css: '#65cbf3' },
  { min: 50, max: 70, key: 'low_50_70', label: 'Low (50–70)', hex: 0xffdb13, css: '#ffdb13' },
  { min: -1, max: 50, key: 'very_low_lt50', label: 'Very low (< 50)', hex: 0xff7d45, css: '#ff7d45' },
];
const bandFor = (p) => PLDDT_BANDS.find((b) => p > b.min && p <= b.max) || PLDDT_BANDS[3];

/* Interaction evidence classes, drawn differently on purpose. An interaction network drawn
 * without this distinction is the most misleading thing this project could ship: in this
 * repo's own words, only 52 of 3,860 genes have ANY partner with zebrafish experimental
 * evidence above 0.4. */
const ICLASS = [
  { key: 'curated_zebrafish', label: 'Curated experiment, zebrafish proteins', hex: 0x18b36b, css: '#0f8f54',
    dash: 0, width: 2.6, kind: 'observed', note: 'IntAct, a curator read the paper' },
  { key: 'experimental_zebrafish', label: 'Experiments channel, zebrafish data', hex: 0x2f8fff, css: '#1f6fd0',
    dash: 0, width: 2.0, kind: 'measured', note: 'STRING experiments channel ≥ 0.4 from zebrafish itself' },
  { key: 'experimental_transferred', label: 'Experiment TRANSFERRED from another species', hex: 0xd08700, css: '#9a6500',
    dash: 2.0, width: 1.3, kind: 'proxy', note: 'measured in another organism, carried here by orthology' },
  { key: 'curated_pathway_database', label: 'Pathway database assertion', hex: 0x9a6bd8, css: '#7a4fc0',
    dash: 3.2, width: 1.1, kind: 'secondary', note: 'a database says so; not an experiment on these two proteins' },
  { key: 'predicted', label: 'Predicted (text-mining / co-expression)', hex: 0x8c8c95, css: '#6b6b74',
    dash: 1.0, width: 0.8, kind: 'assumed', note: 'co-occurrence in text or expression, no experiment' },
];

const PART_KINDS = { 'required for': 'required for', 'sufficient for': 'sufficient for' };
const EDIT_RE = /\b([ACDEFGHIKLMNPQRSTVWY])(\d{1,5})([ACDEFGHIKLMNPQRSTVWY*])\b/;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const fmt = (n, d = 1) => (n == null || Number.isNaN(n) ? '—' : Number(n).toFixed(d));

/* ---------------------------------------------------------------- data loading */
async function loadMaybeGz(url) {
  const r = await fetch(url, { cache: 'force-cache' });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} for ${url}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    if (typeof DecompressionStream !== 'function') throw new Error('gzip pack served but this browser has no DecompressionStream');
    const ds = new DecompressionStream('gzip');
    const txt = await new Response(new Blob([buf]).stream().pipeThrough(ds)).text();
    return JSON.parse(txt);
  }
  return JSON.parse(new TextDecoder().decode(buf));
}

/* ------------------------------------------------- choosing the subject genes */
function parseEdits(data) {
  const out = [];
  for (const e of data?.design?.edits || []) {
    const raw = String(e.raw ?? e.gene ?? '');
    const m = EDIT_RE.exec(raw) || EDIT_RE.exec(String(e.allele ?? ''));
    out.push({
      gene: e.gene, raw, kind: e.kind, zygosity: e.zygosity, part: e.part,
      substitution: m ? { wt: m[1], position: Number(m[2]), alt: m[3] } : null,
      via: 'data.design.edits',
    });
  }
  return out;
}

function genesFromGeneSet(data) {
  /* The validator records which genes it actually read for this design. That is weaker than an
   * edit — nothing here was changed — but it is the real set the run was scored against. */
  const gs = data?.gene_set;
  const swept = Array.isArray(gs?.swept) ? gs.swept : [];
  return swept.map((g) => ({
    gene: g, raw: null, substitution: null,
    via: 'data.gene_set.swept — the genes the validator read for this design',
    rule: gs?.rule, coverage: gs?.coverage_statement,
  }));
}

function genesFromChangedParts(data, index) {
  /* No gene edits in this design. Rather than render nothing, ask the repo's own data which
   * genes it records as required for, or sufficient for, the parts the design moved. That is a
   * different and weaker claim than "the design edits this gene", and it is labelled as such. */
  const out = [];
  const parts = index.parts || {};
  const keys = Object.keys(parts);
  for (const ch of data?.case?.changed || []) {
    const want = norm(ch.part || ch.label || ch.parameter);
    if (!want) continue;
    let key = keys.find((k) => norm(k) === want);
    if (!key) key = keys.find((k) => norm(k).includes(want) || want.includes(norm(k)));
    if (!key) {
      out.push({ gap: true, part: ch.part || ch.label || ch.parameter,
        reason: 'this project records no gene as required for or sufficient for this part' });
      continue;
    }
    const p = parts[key];
    const ranked = [...p.genes].sort((a, b) => (a.link_type === 'sufficient for' ? -1 : 0) - (b.link_type === 'sufficient for' ? -1 : 0));
    for (const g of ranked.slice(0, 4)) {
      out.push({ gene: g.symbol, raw: null, substitution: null, part: p.label, partTerm: p.term,
        linkType: PART_KINDS[g.link_type] || g.link_type, database: g.database,
        via: 'genotype/fin-subtree.full.json — the design edits no gene, so these are the genes recorded as required for or sufficient for the part it moved' });
    }
  }
  return out;
}

function perGeneGate(data, gene) {
  const pg = data?.genotype_similarity?.per_gene;
  if (!Array.isArray(pg)) return null;
  return pg.find((x) => x.gene === gene || x?.edit?.gene === gene) || null;
}

/* --------------------------------------------------------------- geometry help */
function catmull(THREE, pts) { return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5); }

function backboneMesh(THREE, xyz, plddt, radius) {
  const n = plddt.length;
  const pts = [];
  for (let i = 0; i < n; i++) pts.push(new THREE.Vector3(xyz[i * 3], xyz[i * 3 + 1], xyz[i * 3 + 2]));
  const curve = catmull(THREE, pts);
  const seg = clamp(n * 2, 8, 2600);
  const geo = new THREE.TubeGeometry(curve, seg, radius, 6, false);
  /* TubeGeometry lays out (tubularSegments+1) rings of (radialSegments+1) verts, in order,
   * so vertex index -> ring -> curve parameter -> residue index. Colour each vertex by the
   * pLDDT of its residue: the structure is painted with our own uncertainty. */
  const pos = geo.attributes.position.count;
  const ring = 7; // radialSegments + 1
  const col = new Float32Array(pos * 3);
  const c = new THREE.Color();
  for (let v = 0; v < pos; v++) {
    const r = Math.floor(v / ring);
    const res = clamp(Math.round((r / seg) * (n - 1)), 0, n - 1);
    c.setHex(bandFor(plddt[res]).hex);
    col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return { geo, curve, pts };
}

function chainTube(THREE, xyz, radius, hex) {
  const n = xyz.length / 3;
  const pts = [];
  for (let i = 0; i < n; i++) pts.push(new THREE.Vector3(xyz[i * 3], xyz[i * 3 + 1], xyz[i * 3 + 2]));
  if (pts.length < 2) return null;
  const geo = new THREE.TubeGeometry(catmull(THREE, pts), clamp(n * 2, 8, 1400), radius, 5, false);
  return { geo, hex, pts };
}

function centreAndScale(THREE, group, target) {
  const box = new THREE.Box3().setFromObject(group);
  if (box.isEmpty()) return 1;
  const c = box.getCenter(new THREE.Vector3());
  const s = box.getSize(new THREE.Vector3());
  const span = Math.max(s.x, s.y, s.z) || 1;
  const k = target / span;
  group.position.set(-c.x * k, -c.y * k, -c.z * k);
  group.scale.setScalar(k);
  return k;
}

/* ============================================================== mountScene */
export async function mountScene({ container, THREE, data, act, theme = 'light', reducedMotion = false, onReady, onNote }) {
  const note = (o) => { try { onNote?.(o); } catch (_) { /* the stage owns this */ } };

  /* ---- 1. load the pack index */
  let index = null, loadError = null;
  try { index = await loadMaybeGz(new URL('index.json', PACK)); }
  catch (e) { loadError = e; }
  if (!index) {
    return { skip: true, reason: `the molecular data pack did not load (${loadError?.message || 'unknown error'}), so there is no real structure to show and this act refuses to draw a fake one` };
  }

  /* ---- 2. decide which genes this act is about, from the case, not from a list */
  let subjects = parseEdits(data).filter((e) => e.gene);
  let origin = 'edits';
  if (!subjects.length) { subjects = genesFromGeneSet(data); origin = 'gene_set'; }
  if (!subjects.length) { subjects = genesFromChangedParts(data, index); origin = 'parts'; }
  const derivedFromParts = origin === 'parts';
  const noEdits = origin !== 'edits';
  const partGaps = subjects.filter((s) => s.gap);
  subjects = subjects.filter((s) => !s.gap && s.gene);

  let known = subjects.filter((s) => index.genes[s.gene]);
  const unknown = subjects.filter((s) => !index.genes[s.gene]);

  /* Rank the known genes by how much measured protein-level evidence this project actually
   * holds for each. Data-driven, so it picks the right focus for a gene set nobody has thought
   * of yet. */
  const rank = (s) => {
    const m = index.genes[s.gene];
    return (m.our_structures?.length ? 400 : 0) + (m.n_sites ? 200 : 0) + (m.has_structure ? 100 : 0)
      + (m.n_experimental_zf_partners || 0) * 30 + Math.min(40, m.n_ptm || 0)
      + Math.min(20, (m.n_partners || 0) / 2) + (m.detected ? 10 : 0);
  };
  known = known.slice().sort((a, b) => rank(b) - rank(a));

  if (!known.length) {
    const why = subjects.length
      ? `the design names ${subjects.length} gene${subjects.length > 1 ? 's' : ''} (${subjects.map((s) => s.gene).join(', ')}) and this project holds no protein-level data for any of them`
      : (partGaps.length
        ? `this design edits no genes, and no gene is recorded as required for or sufficient for the part${partGaps.length > 1 ? 's' : ''} it changed (${partGaps.map((p) => p.part).join(', ')})`
        : 'this design names no gene, the validator read no gene for it, and it moves no part that any gene in this project is recorded as required for');
    return { skip: true, reason: `${why} — so there is nothing measured to render at the molecular scale` };
  }

  /* ---- 3. load the cards; focus on the first gene with a structure */
  const cards = {};
  for (const s of known) {
    try { cards[s.gene] = await loadMaybeGz(new URL(index.genes[s.gene].file, PACK)); }
    catch (e) { cards[s.gene] = { symbol: s.gene, loadError: String(e.message || e), gaps: [{ id: 'card-load-failed', what: 'everything about this protein', reason: `the data pack entry failed to load: ${e.message || e}`, source: 'validate-show/structures' }] }; }
  }
  const focusSub = known[0];
  const focus = cards[focusSub.gene];
  const st = focus.structure || { absent: true, reason: 'no structure record in the pack' };

  /* ---- 4. the one real complex we have for this protein, if any */
  let complex = null, complexMeta = null;
  const ourExp = (focus.experimental?.our_structures || [])[0];
  if (ourExp && index.experimental[ourExp.pdb_id]) {
    complexMeta = { ...index.experimental[ourExp.pdb_id], ...ourExp };
    try { complex = await loadMaybeGz(new URL(complexMeta.file, PACK)); } catch (e) { complex = null; complexMeta.loadError = String(e.message || e); }
  }

  /* ---- 5. the edited residue, and what the repo measured about it */
  const sub = focusSub.substitution;
  const gate = perGeneGate(data, focusSub.gene);
  const siteRecords = focus.sites || [];
  const siteRec = sub ? (siteRecords.find((r) => r.position === sub.position) || null)
    : (siteRecords[0] || null);
  const sitePos = sub?.position ?? siteRec?.position ?? null;

  /* domains that contain the edited residue */
  const domains = (focus.domains || []).filter((d) => d.positions?.length);
  const domainsNoPos = (focus.domains || []).length - domains.length;
  const siteDomains = sitePos ? domains.filter((d) => d.positions.some((p) => p.start <= sitePos && sitePos <= p.end)) : [];

  /* PTM sites that can actually be placed on the structure */
  const ptmAll = focus.ptm?.sites || [];
  const ptmPlaceable = ptmAll.filter((p) => Number.isFinite(p.position));
  const ffDiffs = focus.ptm?.flying_fish_differences || [];

  const inter = focus.interactions || { by_class: {}, counts: {} };
  const iCounts = inter.counts || {};
  const nPartners = ICLASS.reduce((a, c) => a + (iCounts[c.key] || 0), 0);
  const nZf = (iCounts.curated_zebrafish || 0) + (iCounts.experimental_zebrafish || 0);

  /* ---------------------------------------------------- 6. DOM: shell + styles */
  const root = document.createElement('div');
  root.className = 'molsc';
  root.setAttribute('data-theme-local', theme);
  root.innerHTML = `<style>
  /* Layout: a confidence-coloured structure on the left, an evidence ledger on the right;
     one column under 760px. Colour tokens are theme-paired; the pLDDT band colours are
     AlphaFold DB's own published legend and are deliberately identical in both themes. */
  .molsc{--m-bg:#fbfaf8;--m-panel:#ffffff;--m-ink:#17171b;--m-dim:#5d5d68;--m-line:#ddd9d2;
    --m-rule:#eae6df;--m-stage:#f1eee8;--m-gap:#b23a20;--m-gap-bg:#fdf2ee;--m-ok:#0f8f54;
    --m-warn:#9a6500;--m-chip:#f3f0ea;
    --m-mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
    --m-sans:"Inter var",system-ui,-apple-system,"Segoe UI",sans-serif;
    color:var(--m-ink);font-family:var(--m-sans);container-type:inline-size}
  @media (prefers-color-scheme:dark){.molsc:not([data-theme-local="light"]){--m-bg:#14141a;
    --m-panel:#1c1c23;--m-ink:#eceaf2;--m-dim:#a2a0ae;--m-line:#33323d;--m-rule:#2a2933;
    --m-stage:#0e0e13;--m-gap:#ff8a66;--m-gap-bg:#2a1811;--m-ok:#4cd39a;--m-warn:#e0b25a;
    --m-chip:#262630}}
  .molsc[data-theme-local="dark"]{--m-bg:#14141a;--m-panel:#1c1c23;--m-ink:#eceaf2;--m-dim:#a2a0ae;
    --m-line:#33323d;--m-rule:#2a2933;--m-stage:#0e0e13;--m-gap:#ff8a66;--m-gap-bg:#2a1811;
    --m-ok:#4cd39a;--m-warn:#e0b25a;--m-chip:#262630}
  .molsc{background:var(--m-bg);border-radius:10px;overflow:hidden}
  .molsc *{box-sizing:border-box}
  .molsc .wrap{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:14px;
    padding-block:14px;padding-left:max(16px,env(safe-area-inset-left,0px));
    padding-right:max(16px,env(safe-area-inset-right,0px))}
  @container (max-width:759px){.molsc .wrap{grid-template-columns:minmax(0,1fr)}}
  .molsc .stage{position:relative;background:var(--m-stage);border:1px solid var(--m-line);
    border-radius:8px;min-width:0;overflow:hidden}
  .molsc canvas{display:block;width:100%;height:auto}
  .molsc .hud{position:absolute;left:8px;top:8px;right:8px;display:flex;flex-wrap:wrap;gap:6px;
    pointer-events:none}
  .molsc .tag{font:600 10px/1.5 var(--m-mono);letter-spacing:.06em;text-transform:uppercase;
    background:var(--m-panel);border:1px solid var(--m-line);border-radius:999px;padding:2px 8px;
    color:var(--m-dim)}
  .molsc .ruler{padding:6px 8px 8px;background:var(--m-panel);border-top:1px solid var(--m-line)}
  .molsc .ruler svg{display:block;width:100%;height:auto;overflow:visible}
  .molsc .col{display:flex;flex-direction:column;gap:10px;min-width:0}
  .molsc .card{background:var(--m-panel);border:1px solid var(--m-line);border-radius:8px;
    padding:10px 12px;min-width:0}
  .molsc .card.off{opacity:.42}
  .molsc .card h4{margin:0 0 6px;font:600 11px/1.3 var(--m-sans);letter-spacing:.08em;
    text-transform:uppercase;color:var(--m-dim)}
  .molsc .card p{margin:0 0 6px;font:400 13px/1.5 var(--m-sans);max-width:62ch}
  .molsc .card p:last-child{margin-bottom:0}
  .molsc .src{font:400 11px/1.45 var(--m-mono);color:var(--m-dim);word-break:break-word;
    border-top:1px dashed var(--m-rule);margin-top:8px;padding-top:6px}
  .molsc .kv{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;font:400 12px/1.5 var(--m-sans);
    font-variant-numeric:tabular-nums}
  .molsc .kv dt{color:var(--m-dim)}
  .molsc .kv dd{margin:0;font-family:var(--m-mono)}
  .molsc .bands{display:flex;flex-direction:column;gap:3px;margin:4px 0 0}
  .molsc .band{display:grid;grid-template-columns:10px 1fr auto;align-items:center;gap:8px;
    font:400 11.5px/1.5 var(--m-sans);font-variant-numeric:tabular-nums}
  .molsc .sw{width:10px;height:10px;border-radius:2px;border:1px solid rgba(0,0,0,.25)}
  .molsc .bar{height:5px;border-radius:3px;background:var(--m-rule);overflow:hidden}
  .molsc .bar i{display:block;height:100%}
  .molsc .gap{border:1.5px dashed var(--m-gap);background:var(--m-gap-bg);border-radius:8px;
    padding:9px 11px}
  .molsc .gap h5{margin:0 0 3px;font:600 11px/1.3 var(--m-mono);letter-spacing:.06em;
    text-transform:uppercase;color:var(--m-gap)}
  .molsc .gap p{margin:0;font:400 12px/1.5 var(--m-sans);max-width:62ch}
  .molsc .gaps{display:flex;flex-direction:column;gap:7px}
  .molsc ul{margin:0;padding-left:1.1em;font:400 12.5px/1.55 var(--m-sans)}
  .molsc li{margin-bottom:3px}
  .molsc .edge{display:grid;grid-template-columns:34px 1fr auto;align-items:center;gap:8px;
    font:400 11.5px/1.45 var(--m-sans);font-variant-numeric:tabular-nums;margin-bottom:4px}
  .molsc .edge svg{display:block}
  .molsc .big{font:600 15px/1.3 var(--m-mono);font-variant-numeric:tabular-nums}
  .molsc .fail{color:var(--m-gap);font-weight:600}
  .molsc .ok{color:var(--m-ok);font-weight:600}
  .molsc .warn{color:var(--m-warn);font-weight:600}
  .molsc .chip{display:inline-block;font:600 10px/1.6 var(--m-mono);letter-spacing:.05em;
    text-transform:uppercase;background:var(--m-chip);border-radius:4px;padding:1px 6px;
    color:var(--m-dim);margin-right:4px}
  .molsc .quote{font:italic 400 12px/1.5 var(--m-sans);color:var(--m-dim);
    border-left:2px solid var(--m-rule);padding-left:8px;margin:6px 0}
  .molsc .fallbackmsg{padding:14px;font:400 13px/1.5 var(--m-sans)}
  </style>
  <div class="wrap">
    <div class="col" style="gap:0">
      <div class="stage" id="ms-stage"><div class="hud" id="ms-hud"></div></div>
      <div class="ruler" id="ms-ruler"></div>
    </div>
    <div class="col" id="ms-panels"></div>
  </div>`;
  container.appendChild(root);
  const stageEl = root.querySelector('#ms-stage');
  const hudEl = root.querySelector('#ms-hud');
  const rulerEl = root.querySelector('#ms-ruler');
  const panelsEl = root.querySelector('#ms-panels');

  /* ------------------------------------------------- 7. the narration, templated */
  const cs = data?.case || {};
  const changed = cs.changed || [];
  const ch0 = changed[0];
  const parentName = (cs.parents || [])[0]?.organism || data?.design?.base || 'the parent organism';
  const designName = data?.design?.name || cs.id || 'this design';
  const dirWord = ch0 ? (ch0.direction === 'decrease' ? 'reduced' : 'increased') : null;
  const factorTxt = ch0?.factor ? `${fmt(ch0.factor, 2)}×` : null;
  const changeSentence = ch0
    ? `${designName} has the ${ch0.label || ch0.parameter} ${dirWord}${factorTxt ? ` ${factorTxt}` : ''} against ${parentName}.`
    : (cs.parents?.length > 1
      ? `${designName} blends ${cs.parents.map((p) => p.organism).join(' and ')}; no single parameter was moved.`
      : `${designName} moves no measured parameter.`);
  const gsGate = data?.genotype_similarity;
  const subjectSentence = origin === 'edits'
    ? 'The edit it makes is at the level of one protein.'
    : origin === 'gene_set'
      ? `It changes no gene at all — ${known.length} gene${known.length > 1 ? 's were' : ' was'} read, none edited — so this act shows what this project actually knows about those proteins.`
      : `It edits no gene, so this act shows the proteins of the genes this project records as ${focusSub.linkType || 'required for'} ${focusSub.part}.`;

  /* ---------------------------------------------- 8. WebGL: structure + complex */
  let renderer = null, scene = null, cam = null, molGroup = null, cplxGroup = null, netGroup = null;
  const disposables = [];
  let W = 0, H = 0, caKeyed = null, scaleK = 1;
  const markers = { edit: null, ptm: null, ff: null, lig: null };

  const canFit = () => stageEl.clientWidth > 2;
  function sizeCanvas() {
    W = Math.max(1, stageEl.clientWidth);
    H = Math.round(clamp(W * 0.68, 210, 430));
    if (renderer) { renderer.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix(); }
  }

  if (!st.absent && Array.isArray(st.xyz) && st.xyz.length >= 6) {
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(1.5, globalThis.devicePixelRatio || 1));
      stageEl.insertBefore(renderer.domElement, hudEl);
      scene = new THREE.Scene();
      cam = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
      sizeCanvas();

      const amb = new THREE.HemisphereLight(0xffffff, 0x5a5a66, 1.05);
      const key = new THREE.DirectionalLight(0xffffff, 0.85);
      key.position.set(1.1, 1.4, 1.6);
      scene.add(amb, key);

      /* --- the predicted model, painted with its own pLDDT */
      molGroup = new THREE.Group();
      const bb = backboneMesh(THREE, st.xyz, st.plddt, 1.45);
      disposables.push(bb.geo);
      const bbMat = new THREE.MeshLambertMaterial({ vertexColors: true });
      disposables.push(bbMat);
      molGroup.add(new THREE.Mesh(bb.geo, bbMat));

      /* residue index -> point, so markers land on the real atom */
      caKeyed = new Map();
      st.res.forEach((r, i) => caKeyed.set(r, bb.pts[i]));

      /* --- markers: edited residue, modification sites, flying-fish residue states */
      function instanced(pts, radius, hex, opacity) {
        if (!pts.length) return null;
        const g = new THREE.IcosahedronGeometry(radius, 1);
        const m = new THREE.MeshLambertMaterial({ color: hex, transparent: opacity < 1, opacity });
        disposables.push(g, m);
        const mesh = new THREE.InstancedMesh(g, m, pts.length);
        const mx = new THREE.Matrix4();
        pts.forEach((p, i) => { mx.makeTranslation(p.x, p.y, p.z); mesh.setMatrixAt(i, mx); });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.frustumCulled = false;
        return mesh;
      }
      const editPts = sitePos != null && caKeyed.has(sitePos) ? [caKeyed.get(sitePos)] : [];
      markers.edit = instanced(editPts, 4.2, 0xe8362f, 1);
      const ptmPts = ptmPlaceable.map((p) => caKeyed.get(p.position)).filter(Boolean);
      markers.ptm = instanced(ptmPts, 2.4, 0x00a3a3, 0.95);
      const ffPts = ffDiffs.map((d) => caKeyed.get(d.zf_position)).filter(Boolean);
      markers.ff = instanced(ffPts, 3.0, 0xc038a8, 0.95);
      for (const k of ['edit', 'ptm', 'ff']) if (markers[k]) molGroup.add(markers[k]);

      scene.add(molGroup);
      scaleK = centreAndScale(THREE, molGroup, 100);

      /* --- the one real experimental complex, if we have one */
      if (complex?.chains) {
        cplxGroup = new THREE.Group();
        const keys = Object.keys(complex.chains);
        /* chain hues walk a single hue ramp — subunit identity, not a measurement */
        keys.forEach((k, i) => {
          const c = complex.chains[k];
          const hue = (i / Math.max(1, keys.length)) * 0.62 + 0.03;
          const hex = new THREE.Color().setHSL(hue, 0.55, theme === 'dark' ? 0.62 : 0.46).getHex();
          const t = chainTube(THREE, c.xyz, 1.25, hex);
          if (!t) return;
          const m = new THREE.MeshLambertMaterial({ color: hex });
          disposables.push(t.geo, m);
          cplxGroup.add(new THREE.Mesh(t.geo, m));
        });
        for (const L of complex.ligands || []) {
          const g = new THREE.IcosahedronGeometry(2.6, 1);
          const m = new THREE.MeshLambertMaterial({ color: 0xff5f1f });
          disposables.push(g, m);
          const s = new THREE.Mesh(g, m);
          s.position.set(L.centroid[0], L.centroid[1], L.centroid[2]);
          cplxGroup.add(s);
        }
        scene.add(cplxGroup);
        centreAndScale(THREE, cplxGroup, 104);
        cplxGroup.visible = false;
      }

      /* --- the interaction halo. Node POSITIONS ARE DECORATIVE: partners are laid on a
             sphere by index for legibility. What is real is the edge class and the score. */
      netGroup = new THREE.Group();
      const edgeMeta = [];
      {
        const flat = [];
        for (const cls of ICLASS) for (const p of (inter.by_class?.[cls.key] || []).slice(0, 14)) flat.push({ ...p, cls });
        const N = flat.length;
        flat.forEach((p, i) => {
          const phi = Math.acos(1 - 2 * (i + 0.5) / Math.max(1, N));
          const th = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);
          const R = 56 + 10 * (1 - (p.score || 0.7));
          const v = new THREE.Vector3(R * Math.sin(phi) * Math.cos(th), R * Math.cos(phi), R * Math.sin(phi) * Math.sin(th));
          edgeMeta.push({ v, ...p });
        });
        for (const cls of ICLASS) {
          const mine = edgeMeta.filter((e) => e.cls.key === cls.key);
          if (!mine.length) continue;
          const pos = new Float32Array(mine.length * 6);
          mine.forEach((e, i) => { pos[i * 6 + 3] = e.v.x; pos[i * 6 + 4] = e.v.y; pos[i * 6 + 5] = e.v.z; });
          const lg = new THREE.BufferGeometry();
          lg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
          const lm = cls.dash > 0
            ? new THREE.LineDashedMaterial({ color: cls.hex, dashSize: cls.dash * 2.2, gapSize: cls.dash * 2.2, transparent: true, opacity: cls.key === 'predicted' ? 0.5 : 0.85 })
            : new THREE.LineBasicMaterial({ color: cls.hex, transparent: true, opacity: 0.95 });
          disposables.push(lg, lm);
          const lines = new THREE.LineSegments(lg, lm);
          if (cls.dash > 0) lines.computeLineDistances();
          netGroup.add(lines);
          const ng = new THREE.IcosahedronGeometry(1, 1);
          const nm = new THREE.MeshLambertMaterial({ color: cls.hex });
          disposables.push(ng, nm);
          const nodes = new THREE.InstancedMesh(ng, nm, mine.length);
          const mx = new THREE.Matrix4();
          mine.forEach((e, i) => {
            const s = 2.6 + 3.4 * (e.score || 0.7);
            mx.makeScale(s, s, s).setPosition(e.v.x, e.v.y, e.v.z);
            nodes.setMatrixAt(i, mx);
          });
          nodes.instanceMatrix.needsUpdate = true;
          nodes.frustumCulled = false;
          netGroup.add(nodes);
        }
        const cg = new THREE.IcosahedronGeometry(7, 2);
        const cm = new THREE.MeshLambertMaterial({ color: theme === 'dark' ? 0xdedbe8 : 0x3a3a45 });
        disposables.push(cg, cm);
        netGroup.add(new THREE.Mesh(cg, cm));
      }
      netGroup.visible = false;
      scene.add(netGroup);
      scene.background = new THREE.Color(theme === 'dark' ? 0x0e0e13 : 0xf1eee8);
    } catch (e) {
      note({ severity: 'warning', title: 'The 3D structure could not be drawn',
        text: `WebGL failed (${e.message || e}). The measured numbers below are unaffected; only the picture is missing.`,
        source: 'molecular.js' });
      if (renderer) { try { renderer.dispose(); } catch (_) {} renderer = null; }
      stageEl.querySelector('canvas')?.remove();
    }
  }

  if (!renderer) {
    const why = st.absent
      ? st.reason
      : (loadError ? String(loadError.message || loadError) : 'the browser gave no WebGL context');
    const d = document.createElement('div');
    d.className = 'gap fallbackmsg';
    d.innerHTML = `<h5>No structure drawn</h5><p>${esc(why)}</p>
      <p style="margin-top:6px">This slot is left empty on purpose. Everything measured about this protein is in the panels beside it.</p>`;
    stageEl.appendChild(d);
    stageEl.style.minHeight = '140px';
  }

  /* --------------------------------------------- 9. the 1D ruler (SVG, themed) */
  function drawRuler() {
    const L = focus.protein?.length || (st.res ? st.res[st.res.length - 1] : 0);
    if (!L) { rulerEl.innerHTML = `<div class="gap"><h5>No sequence ruler</h5><p>UniProt has no protein sequence for this gene, so there is no axis to place anything on.</p></div>`; return; }
    const w = 1000, h = 74, pad = 4;
    const x = (p) => pad + (clamp(p, 1, L) / L) * (w - pad * 2);
    let s = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="domain and site map along the protein sequence">`;
    s += `<line x1="${pad}" y1="40" x2="${w - pad}" y2="40" stroke="var(--m-line)" stroke-width="2"/>`;
    /* per-residue confidence strip, straight off the model's B-factors */
    if (st.plddt?.length) {
      const step = Math.max(1, Math.floor(st.plddt.length / 420));
      for (let i = 0; i < st.plddt.length; i += step) {
        const r = st.res[i];
        s += `<rect x="${x(r).toFixed(2)}" y="12" width="${Math.max(1.2, (w - pad * 2) / L * step).toFixed(2)}" height="12" fill="${bandFor(st.plddt[i]).css}"/>`;
      }
      s += `<text x="${pad}" y="9" font-size="9" font-family="var(--m-mono)" fill="var(--m-dim)">pLDDT per residue</text>`;
    }
    const lanes = [];
    for (const d of domains.slice(0, 14)) {
      for (const p of d.positions) {
        let lane = 0;
        while (lanes[lane]?.some(([a, b]) => !(p.end < a || p.start > b))) lane++;
        (lanes[lane] ||= []).push([p.start, p.end]);
        const y = 34 + lane * 9;
        s += `<rect x="${x(p.start).toFixed(2)}" y="${y}" width="${Math.max(1.5, x(p.end) - x(p.start)).toFixed(2)}" height="6" rx="2" fill="var(--m-dim)" opacity="0.55"/>`;
      }
    }
    for (const p of ptmPlaceable.slice(0, 160)) {
      s += `<line x1="${x(p.position).toFixed(2)}" y1="26" x2="${x(p.position).toFixed(2)}" y2="32" stroke="#00a3a3" stroke-width="1.4"/>`;
    }
    for (const d of ffDiffs.slice(0, 60)) {
      s += `<line x1="${x(d.zf_position).toFixed(2)}" y1="26" x2="${x(d.zf_position).toFixed(2)}" y2="32" stroke="#c038a8" stroke-width="2"/>`;
    }
    if (sitePos != null) {
      const sx = x(sitePos).toFixed(2);
      s += `<line x1="${sx}" y1="8" x2="${sx}" y2="58" stroke="#e8362f" stroke-width="2"/>`;
      s += `<text x="${sx}" y="70" font-size="11" font-family="var(--m-mono)" fill="var(--m-ink)" text-anchor="${sitePos / L > 0.85 ? 'end' : (sitePos / L < 0.15 ? 'start' : 'middle')}">${esc(focusSub.substitution ? `${sub.wt}${sub.position}${sub.alt}` : String(sitePos))}</text>`;
    }
    s += `<text x="${pad}" y="${h - 2}" font-size="9" font-family="var(--m-mono)" fill="var(--m-dim)">1</text>`;
    s += `<text x="${w - pad}" y="${h - 2}" font-size="9" font-family="var(--m-mono)" fill="var(--m-dim)" text-anchor="end">${L} aa</text>`;
    s += `</svg>`;
    rulerEl.innerHTML = s;
  }
  drawRuler();

  /* ----------------------------------------------------- 10. the panels, by act */
  const gapBox = (g) => `<div class="gap"><h5>${esc(g.what || g.id)}</h5><p>${esc(g.reason)}</p>
    ${g.source ? `<p style="margin-top:4px;font-family:var(--m-mono);font-size:11px;opacity:.85">${esc(g.source)}</p>` : ''}</div>`;

  function srcLine(kind, text, url) {
    return `<div class="src"><span class="chip">${esc(kind)}</span>${esc(text)}${url ? ` · ${esc(url)}` : ''}</div>`;
  }

  const panels = [];

  /* P1 — the protein, coloured by our own confidence */
  {
    const b = st.confidence_bands || {};
    const tot = st.n_ca || 1;
    const rows = PLDDT_BANDS.map((bd) => {
      const n = b[bd.key] || 0;
      const pc = (100 * n / tot);
      return `<div class="band"><span class="sw" style="background:${bd.css}"></span>
        <span>${esc(bd.label)}<span class="bar" style="margin-top:2px"><i style="width:${pc.toFixed(1)}%;background:${bd.css}"></i></span></span>
        <span>${pc.toFixed(0)}%</span></div>`;
    }).join('');
    const dis = st.source_choice?.disagreement;
    const strip = known.map((s) => {
      const m = index.genes[s.gene];
      const f = [m.has_structure ? 'structure' : 'no structure', m.n_partners ? `${m.n_partners} partners` : 'no partners',
        m.n_ptm ? `${m.n_ptm} PTM` : 'no PTM', m.detected ? 'MS-detected' : 'never detected'];
      return `<li${s === focusSub ? ' style="font-weight:600"' : ''}><span class="chip">${esc(s.gene)}</span>${f.map((x) => esc(x)).join(' · ')}</li>`;
    }).join('');
    panels.push({ act: 0, html: `<div class="card"><h4>The protein, coloured by what we do not know</h4>
      <p><b>${esc(focus.symbol)}</b>${focus.protein?.length ? ` · ${focus.protein.length} aa` : ''}${focus.protein?.entry_status ? ` · ${esc(focus.protein.entry_status)}` : ''}.
      ${focus.protein?.function ? esc(String(focus.protein.function).slice(0, 220)) : 'UniProt records no function sentence for this entry.'}</p>
      ${known.length > 1 ? `<p>${esc(known[0].via)} — ${known.length} genes, ranked by how much protein-level evidence this project holds. The first is shown:</p><ul>${strip}</ul>` : ''}
      ${st.absent ? gapBox({ what: '3D structure', reason: st.reason, source: (st.where_checked || []).join(', ') }) : `
      <dl class="kv"><dt>AlphaFold model</dt><dd>${esc(st.model || '—')} (v${esc(st.model_version_served)})</dd>
      <dt>mean pLDDT</dt><dd>${fmt(st.mean_plddt)}</dd>
      <dt>CA atoms drawn</dt><dd>${st.n_ca}</dd></dl>
      <div class="bands">${rows}</div>
      <p style="margin-top:7px">${esc(st.note)}</p>`}
      ${dis ? gapBox({ what: 'our own layers disagree on which protein this is', reason: `${dis.what}: ${dis.candidates.map((c) => `${c.accession}${c.length ? ` (${c.length} aa)` : ''} from ${c.from}`).join('; ')}. ${dis.why}`, source: 'structures/ vs omics/proteomic' }) : ''}
      ${srcLine('predicted', `AlphaFold DB ${st.accession || ''} · CC BY 4.0 · CA-only, 0.1 Å`, st.url)}</div>` });
  }

  /* P2 — the edit on the structure */
  {
    let h = `<div class="card"><h4>${noEdits ? 'The residue this project did place on it' : 'Where the change lands on it'}</h4>`;
    if (noEdits) {
      h += gapBox({ what: 'a residue this design changed', reason: gsGate?.gate
        || 'this design carries no gene-level edit, so there is no edited residue to place on any structure',
        source: 'sim-engine/validate/score.mjs, genotype gate' });
      if (sitePos) h += `<p>What is marked instead is a substitution this project's own structural layer placed on this protein from the literature. It is not part of this design.</p>`;
    }
    if (!sitePos) {
      h += `<p>${derivedFromParts
        ? 'The panel above is the protein of a gene this project records as needed for the part that changed — a weaker claim, and a different one.'
        : 'No sourced substitution exists for this protein in this project either, so nothing is marked on the structure.'}</p>`;
      if (focusSub.linkType) h += `<p><span class="chip">${esc(focusSub.linkType)}</span>${esc(focusSub.part)} — recorded by ${esc(focusSub.database || 'ZFIN')}.</p>`;
    } else {
      const pl = st.plddt && caKeyed?.has(sitePos) ? st.plddt[st.res.indexOf(sitePos)] : (siteRec?.plddt_at_site ?? null);
      h += `<p>Residue <b>${esc(sub ? `${sub.wt}${sub.position}${sub.alt}` : sitePos)}</b>, marked in red.</p>
      <dl class="kv">
        <dt>pLDDT here</dt><dd>${fmt(siteRec?.plddt_at_site ?? pl)}${(siteRec?.plddt_at_site ?? pl) != null ? ` — ${esc(bandFor(siteRec?.plddt_at_site ?? pl).label)}` : ''}</dd>
        <dt>domain context</dt><dd>${siteDomains.length ? siteDomains.map((d) => `${esc(d.name)} ${d.positions[0].start}–${d.positions[0].end}`).join('; ') : 'no InterPro/Pfam signature covers this residue'}</dd>
      </dl>`;
      if (siteRec?.position_check && siteRec.position_check.ok === false) {
        h += gapBox({ what: 'the position check FAILED', reason: `${siteRec.position_check.note} The source says ${siteRec.position_check.expected} at ${siteRec.position}; the UniProt entry used for the model carries ${siteRec.position_check.found}. Nothing was renumbered to make it pass.`, source: `structures/variants/variants.json, numbered against ${siteRec.numbered_against}` });
      } else if (siteRec?.position_check?.ok) {
        h += `<p><span class="ok">Position check passed</span> against ${esc(siteRec.numbered_against)}.</p>`;
      }
      const ex = siteRec?.on_experimental_structure;
      if (ex?.measured) {
        const m = ex.measured;
        const dist = m.distance_to_substrate_A ?? m.distance_A ?? m.nearest_partner_A ?? null;
        h += `<p class="big">${esc(ex.pdb_id)} · ${fmt(ex.resolution_A, 2)} Å · ${fmt(ex.identity_to_zebrafish, 1)}% identical to the zebrafish protein</p>
        <p>${ex.is_an_interface_residue ? '<span class="warn">At the interface.</span>' : 'Not an interface residue.'} ${esc(JSON.stringify(m).slice(0, 300))}</p>
        <p>${esc(ex.note || '')}</p>`;
        if (dist != null) h += `<p class="big">${fmt(dist, 1)} Å from the functional site</p>`;
      } else if (ex?.pdb_id) {
        h += `<p>Placed on <b>${esc(ex.pdb_id)}</b> (${fmt(ex.resolution_A, 2)} Å, ${fmt(ex.identity_to_zebrafish, 1)}% identity) at position ${esc(ex.mapped_position)} — residue ${esc(ex.residue_in_structure)}. ${ex.is_an_interface_residue ? '<span class="warn">It is an interface residue.</span>' : '<b>It is not an interface residue.</b>'}</p>
        <p>${esc(ex.note || '')}</p>`;
      }
      if (siteRec?.source?.quote) h += `<p class="quote">“${esc(siteRec.source.quote)}” — ${esc(siteRec.source.first_author)} ${esc(siteRec.source.year)}, PMID ${esc(siteRec.source.pmid)}</p>`;
      if (gate) {
        const cks = gate.checks || gate.edit?.checks || null;
        h += `<dl class="kv"><dt>validator, this edit</dt><dd>${esc(JSON.stringify(cks ?? gate).slice(0, 180))}</dd></dl>`;
      }
      h += `<p><span class="chip">geometry, not function</span>${esc(siteRec?.label || 'A distance is where a residue sits, not what changing it does.')}</p>`;
    }
    if (domainsNoPos) h += gapBox({ what: `${domainsNoPos} domain annotation${domainsNoPos > 1 ? 's' : ''} cannot be placed`, reason: 'they come from the UniProt cross-reference, not the InterPro API, and carry no residue positions', source: 'omics/proteomic/SOURCES.md' });
    h += srcLine('measured', 'structures/variants/variants.json + structures/interface-mapping.json; domains from InterPro 110.0');
    panels.push({ act: 1, html: h + `</div>` });
  }

  /* P3 — modification sites */
  {
    let h = `<div class="card"><h4>Modified residues, and whose residues they are</h4>`;
    if (!ptmAll.length) {
      h += gapBox({ what: 'post-translational modification sites', reason: 'no modification site is recorded for this protein or for its human or mouse orthologue', source: 'omics/ptm (UniProt 2026_03 + iPTMnet)' });
    } else {
      h += `<dl class="kv">
        <dt>sites recorded</dt><dd>${ptmAll.length}</dd>
        <dt>measured on the fish protein</dt><dd>${focus.ptm.n_zebrafish ? `${focus.ptm.n_zebrafish}` : '<span class="fail">0</span>'}</dd>
        <dt>carried from human/mouse</dt><dd>${focus.ptm.n_borrowed}</dd>
        <dt>placeable on this model</dt><dd>${ptmPlaceable.length}</dd></dl>`;
      if (!focus.ptm.n_zebrafish) h += gapBox({ what: 'every site here is borrowed', reason: 'each one is the human or mouse orthologue\'s modification carried over by alignment. No modification has been measured on this fish protein.', source: 'omics/ptm, kind = borrowed-ortholog' });
      if (ptmPlaceable.length < ptmAll.length) h += gapBox({ what: `${ptmAll.length - ptmPlaceable.length} site${ptmAll.length - ptmPlaceable.length > 1 ? 's' : ''} have no fish position`, reason: 'the alignment did not carry the orthologue\'s position onto the zebrafish sequence, so they cannot be drawn', source: 'omics/ptm, zf_position = null' });
      if (ffDiffs.length) {
        h += `<p style="margin-top:6px"><b>${ffDiffs.length}</b> of these residues differ in the gliding-fish orthologue:</p><ul>`;
        for (const d of ffDiffs.slice(0, 6)) h += `<li><span style="color:#c038a8">■</span> ${esc(d.zf_residue)}${d.zf_position}${esc(d.flying_fish_residue)} — ${esc((d.modifications || []).join(', '))} · ${esc(d.residue_change)}</li>`;
        h += `</ul><p><span class="chip">residue state</span>${esc(focus.ptm.flying_fish_caveat || '')}</p>`;
      } else {
        h += gapBox({ what: 'gliding-fish residue differences', reason: 'no modification site of this protein differs between zebrafish and the gliding-fish orthologue, under the rule that only sites where the zebrafish residue is itself the modified residue are compared', source: 'omics/ptm/flying_fish_flags.json' });
      }
    }
    h += srcLine('mixed', 'omics/ptm — UniProt 2026_03 and iPTMnet; flying-fish states from the Xu et al. 2021 assembly by reciprocal best blastp');
    panels.push({ act: 2, html: h + `</div>` });
  }

  /* P4 — interactions, drawn by evidence class */
  {
    let h = `<div class="card"><h4>Who it binds, and who says so</h4>`;
    if (!nPartners) {
      h += gapBox({ what: 'protein–protein interactions', reason: 'no STRING link at combined score ≥ 0.700 and no curated IntAct record for this protein', source: 'STRING v12.0 + IntAct via PSICQUIC 2026-11-01' });
    } else {
      h += `<p class="big">${nZf === 0 ? '<span class="fail">0</span>' : nZf} of ${nPartners} partners have experimental evidence from zebrafish itself.</p>`;
      for (const cls of ICLASS) {
        const n = iCounts[cls.key] || 0;
        const d = cls.dash > 0 ? `stroke-dasharray="${cls.dash * 2} ${cls.dash * 2}"` : '';
        h += `<div class="edge"><svg width="34" height="8" aria-hidden="true"><line x1="0" y1="4" x2="34" y2="4" stroke="${cls.css}" stroke-width="${cls.width}" ${d}/></svg>
          <span>${esc(cls.label)} <span style="opacity:.7">— ${esc(cls.note)}</span></span><span>${n}</span></div>`;
      }
      const top = [];
      for (const cls of ICLASS) for (const p of (inter.by_class?.[cls.key] || []).slice(0, 3)) top.push({ ...p, cls });
      if (top.length) {
        h += `<p style="margin-top:6px">Strongest in each class:</p><ul>`;
        for (const p of top.slice(0, 8)) h += `<li><b>${esc(p.partner)}</b> ${p.score != null ? `· ${fmt(p.score, 3)}` : ''} · ${esc(p.db)}${p.pmid ? ` · PMID ${esc(p.pmid)}` : ''}</li>`;
        h += `</ul>`;
      }
      if (nZf === 0) h += gapBox({ what: 'no zebrafish experiment behind any of these', reason: inter.honesty, source: 'STRING v12.0 interaction_class + IntAct' });
    }
    if (complexMeta && complex) {
      h += `<p style="margin-top:8px"><b>One of these is a measured complex.</b></p>
      <dl class="kv"><dt>entry</dt><dd>${esc(complexMeta.pdb_id)}</dd>
        <dt>method</dt><dd>${esc((complexMeta.method || []).join(', '))} ${complexMeta.resolution_A ? `· ${fmt(complexMeta.resolution_A, 2)} Å` : ''}</dd>
        <dt>chains drawn</dt><dd>${complexMeta.n_chains} (${complexMeta.n_ca} CA)</dd>
        <dt>identity to the fish protein</dt><dd>${complexMeta.identity_to_zebrafish != null ? `${fmt(complexMeta.identity_to_zebrafish, 1)}%` : 'not stated'}</dd></dl>
      <p>${esc(complexMeta.what)}. ${esc(complexMeta.role || '')}</p>
      <p><span class="chip">proxy</span>This is not the fish protein. It is the human or mouse protein at the identity above, standing in for it, because no experimental structure of any fish protein in this project exists.</p>`;
    } else {
      h += gapBox({ what: 'a measured complex for this protein', reason: focus.experimental?.absent_reason || 'no experimental structure containing this protein and a partner is in this project', source: 'structures/binding.json' });
    }
    h += `<p><span class="chip">decorative</span>In the picture, the partner nodes are laid on a sphere by index. Their positions mean nothing; only the line style and the node size (the score) carry data.</p>`;
    h += srcLine('mixed', inter.source || 'STRING v12.0 + IntAct');
    panels.push({ act: 3, html: h + `</div>` });
  }

  /* P5 — the gaps, as gaps */
  {
    const gaps = [...(focus.gaps || [])];
    for (const u of unknown) gaps.push({ id: 'gene-not-in-pack', what: `${u.gene}: nothing at all`, reason: 'this gene is outside the 181-gene molecular pack, so this project holds no protein structure, interaction or modification for it', source: 'validate-show/structures/index.json' });
    for (const p of partGaps) gaps.push({ id: 'part-has-no-genes', what: `${p.part}: no gene`, reason: p.reason, source: 'genotype/fin-subtree.full.json' });
    for (const s of known) {
      if (s === focusSub) continue;
      const c = cards[s.gene];
      const ids = (c?.gaps || []).map((g) => g.id);
      if (ids.includes('no-protein-level-evidence')) gaps.push({ id: 'sibling-no-evidence', what: `${s.gene}: never seen as a protein`, reason: 'no mass-spec detection, no UniProt PE1, no curated experiment. The protein is inferred from the gene.', source: 'omics/proteomic detection-coverage table' });
      else if (ids.includes('no-structure')) gaps.push({ id: 'sibling-no-structure', what: `${s.gene}: no structure`, reason: 'no AlphaFold DB model for any UniProt entry of this gene', source: 'structures/models.json' });
    }
    if (data?.gene_set?.coverage_statement) gaps.push({ id: 'genes-not-read', what: 'the genes nobody read', reason: `${data.gene_set.coverage_statement} ${data.gene_set.rule ? `Selection rule: ${data.gene_set.rule}.` : ''}`, source: 'run.json gene_set' });
    gaps.push({ id: 'fin-tissue', what: 'any protein measurement from the organ being designed', reason: focus.detection?.caveat || index.global.fin_tissue_proteomics, source: 'PaxDb v6.1, 35 zebrafish datasets' });
    gaps.push({ id: 'design-organism-proteome', what: 'the designed organism\'s own proteins', reason: focus.flying_fish_proteome?.reason || index.global.flying_fish, source: 'UniProtKB 2026_03 + AlphaFold DB' });
    let h = `<div class="card"><h4>What is missing, drawn as missing</h4>
      <p>${gaps.length} absence${gaps.length > 1 ? 's' : ''} sit under this act. None of them is an empty space: each one is a thing we would have shown and could not.</p>
      <div class="gaps">${gaps.map(gapBox).join('')}</div>
      ${srcLine('absent', 'every reason above is quoted from the layer that recorded the absence')}</div>`;
    panels.push({ act: 4, html: h, gaps });
  }

  panelsEl.innerHTML = panels.map((p, i) => `<div data-p="${i}">${p.html}</div>`).join('');
  const panelEls = [...panelsEl.querySelectorAll('[data-p]')];
  const allGaps = panels.find((p) => p.gaps)?.gaps || [];

  /* ------------------------------------------------------- 11. timeline + render */
  const CH = [
    { t: 0, act: 0, label: 'The protein', say: `${changeSentence} ${subjectSentence} This is ${focus.symbol}'s predicted structure, painted with AlphaFold's own confidence in it — orange means the shape there is a guess.` },
    { t: 6, act: 1, label: noEdits ? 'No residue changed' : 'The change', say: sitePos
      ? `${noEdits ? 'This design changes no residue. The red ball is a substitution the literature reports in this gene, placed here by our own structural work.' : 'The changed residue is the red ball.'} ${siteRec?.position_check?.ok === false ? 'Our own check that the residue number matches the sequence failed, and we kept the failure on screen.' : 'Its domain context and its distance to the working part of the protein are measured, not assumed.'}`
      : 'No residue was changed and none is marked. The protein above belongs to a gene the design needs, which is a weaker claim.' },
    { t: 12, act: 2, label: 'Modifications', say: ptmAll.length ? `Teal marks are modification sites; magenta marks are residues that differ in the gliding fish. ${focus.ptm.n_zebrafish ? '' : 'Every one of them was measured in a human or a mouse, not in a fish.'}` : 'No modification site is recorded for this protein, in any species. The slot stays empty.' },
    { t: 18, act: 3, label: 'Partners', say: nPartners ? `${nZf === 0 ? 'None' : nZf} of ${nPartners} partners rest on an experiment done in zebrafish. Solid lines are experiments, dashes are experiments borrowed from another animal, dots are guesses from text.` : 'No partner passes the confidence cut for this protein, so there is no network to draw.' },
    { t: 24, act: 4, label: 'The holes', say: `${allGaps.length} things we would have shown and cannot, each with the reason it is missing.` },
  ];
  const duration = 30;

  const CAM = [
    { t: 0, pos: [0, 24, 210], look: [0, 0, 0] },
    { t: 6, pos: [70, 30, 150], look: [0, 0, 0] },
    { t: 12, pos: [0, 70, 170], look: [0, 0, 0] },
    { t: 18, pos: [30, 20, 230], look: [0, 0, 0] },
    { t: 24, pos: [0, 10, 240], look: [0, 0, 0] },
  ];
  const lerp = (a, b, k) => a + (b - a) * k;

  function camAt(t) {
    if (reducedMotion) {
      const k = CAM.reduce((best, c, i) => (t >= c.t ? i : best), 0);
      return CAM[k];
    }
    let i = 0;
    while (i < CAM.length - 1 && t >= CAM[i + 1].t) i++;
    const a = CAM[i], b = CAM[Math.min(CAM.length - 1, i + 1)];
    const k = b.t === a.t ? 0 : clamp((t - a.t) / (b.t - a.t), 0, 1);
    const e = k * k * (3 - 2 * k);
    return { pos: [lerp(a.pos[0], b.pos[0], e), lerp(a.pos[1], b.pos[1], e), lerp(a.pos[2], b.pos[2], e)], look: [0, 0, 0] };
  }
  const actAt = (t) => CH.reduce((a, c) => (t >= c.t ? c.act : a), 0);

  const HUD = [
    () => [`${focus.symbol}`, `AlphaFold ${st.model || 'none'}`, `pLDDT mean ${fmt(st.mean_plddt)}`, 'colour = confidence, not chemistry'],
    () => [`${focus.symbol}`, sitePos ? `residue ${sub ? `${sub.wt}${sub.position}${sub.alt}` : sitePos}` : 'no residue changed', siteDomains.length ? siteDomains[0].name : 'no domain here'],
    () => [`${focus.symbol}`, `${ptmPlaceable.length} modification sites placed`, `${ffDiffs.length} differ in the gliding fish`],
    () => [complexMeta ? `${complexMeta.pdb_id} — measured complex` : 'no measured complex', `${nZf}/${nPartners} partners with zebrafish experiment`],
    () => [`${allGaps.length} stated absences`],
  ];

  let lastAct = -1;
  function render(t) {
    const a = actAt(t);
    if (a !== lastAct) {
      lastAct = a;
      panelEls.forEach((el, i) => el.classList.toggle('off', i !== a));
      hudEl.innerHTML = (HUD[a]?.() || []).map((s) => `<span class="tag">${esc(s)}</span>`).join('');
      if (molGroup) molGroup.visible = a <= 2 || (a === 3 && !complex);
      if (cplxGroup) cplxGroup.visible = a === 3;
      if (netGroup) netGroup.visible = a === 3;
      if (markers.edit) markers.edit.visible = a >= 1 && a <= 2;
      if (markers.ptm) markers.ptm.visible = a === 2;
      if (markers.ff) markers.ff.visible = a === 2;
    }
    if (!renderer) return;
    const c = camAt(t);
    cam.position.set(c.pos[0], c.pos[1], c.pos[2]);
    cam.lookAt(0, 0, 0);
    const spin = reducedMotion ? 0 : t * 0.16;
    if (molGroup) molGroup.rotation.y = spin;
    if (cplxGroup) cplxGroup.rotation.y = spin * 0.8;
    if (netGroup) netGroup.rotation.y = spin * 0.5;
    renderer.render(scene, cam);
  }

  let raf = 0, playing = false, t0 = 0, local = 0;
  const loop = (now) => {
    if (!playing) return;
    local = Math.min(duration, (now - t0) / 1000);
    render(local);
    if (local < duration) raf = requestAnimationFrame(loop); else { playing = false; raf = 0; }
  };

  render(0);
  if (noEdits) {
    note({ severity: 'warning', title: 'This design edits no gene, so nothing here is its edit',
      text: `${gsGate?.gate || 'The design carries no gene-level edit.'} The molecular act therefore shows ${derivedFromParts
        ? `the protein of a gene this project records as ${focusSub.linkType || 'required for'} ${focusSub.part}`
        : `what this project knows about the ${known.length} gene${known.length > 1 ? 's' : ''} the validator read for this design`}. That is a weaker claim than "the design changes this protein", and the panels say so.`,
      source: `molecular.js, from ${derivedFromParts ? 'genotype/fin-subtree.full.json' : 'run.json gene_set.swept'}` });
  }
  if (nPartners && nZf === 0) {
    note({ severity: 'mismatch', title: 'No interaction here was measured in this animal',
      text: `All ${nPartners} partners drawn for ${focus.symbol} come from another species, a database or text mining. ${inter.honesty}`,
      source: 'STRING v12.0 interaction_class' });
  }
  if (siteRec?.position_check?.ok === false) {
    note({ severity: 'mismatch', title: 'The residue numbering does not check out',
      text: `${siteRec.notation}: the source says ${siteRec.position_check.expected} at position ${siteRec.position}, the UniProt entry behind the model carries ${siteRec.position_check.found}. Nothing was renumbered to make the check pass, so the red marker is at the number the source gave, on a sequence that disagrees with it.`,
      source: `structures/variants/variants.json` });
  }
  onReady?.();

  /* ------------------------------------------------------------- 12. provenance */
  const provItems = [
    { label: `${focus.symbol} backbone`, kind: st.absent ? 'absent' : 'predicted',
      source: st.absent ? st.reason : `AlphaFold DB ${st.model} v${st.model_version_served}, CA atoms only, mean pLDDT ${fmt(st.mean_plddt)}`,
      url: st.url },
    { label: 'backbone colour', kind: 'derived', source: 'per-residue pLDDT from the model\'s own B-factor column, binned into AlphaFold DB\'s four published confidence bands' },
    { label: 'domain bars on the ruler', kind: 'inferred-electronic', source: `InterPro 110.0 / Pfam signature matches with residue positions (${domains.length} placed, ${domainsNoPos} without positions)` },
  ];
  if (sitePos) provItems.push({ label: `residue ${sub ? `${sub.wt}${sub.position}${sub.alt}` : sitePos} marker`, kind: siteRec?.position_check?.ok === false ? 'assumed' : 'derived', source: siteRec?.position_check?.ok === false ? `position check FAILED against ${siteRec.numbered_against}; drawn at the number the source states, which that sequence contradicts` : `position from ${siteRec?.source?.first_author || data?.design?.name || 'the design'}${siteRec?.source?.pmid ? `, PMID ${siteRec.source.pmid}` : ''}` });
  if (siteRec?.on_experimental_structure?.pdb_id) provItems.push({ label: 'distance to the functional site', kind: 'measured', source: `read off deposited coordinates, PDB ${siteRec.on_experimental_structure.pdb_id} at ${fmt(siteRec.on_experimental_structure.resolution_A, 2)} Å; the structure is a ${fmt(siteRec.on_experimental_structure.identity_to_zebrafish, 1)}%-identical proxy protein, not the fish one` });
  if (ptmPlaceable.length) provItems.push({ label: 'modification site markers', kind: focus.ptm.n_zebrafish ? 'curated' : 'borrowed-ortholog', source: focus.ptm.n_zebrafish ? 'UniProt/iPTMnet, including sites recorded on the zebrafish protein' : 'every site is the human or mouse orthologue\'s, carried over by alignment' });
  if (ffDiffs.length) provItems.push({ label: 'gliding-fish residue differences', kind: 'observed', source: `${ffDiffs.length} residue states in the Xu et al. 2021 assembly; a residue state, never a measured modification and never a phenotype` });
  if (complex) provItems.push({ label: `complex ${complexMeta.pdb_id}`, kind: 'measured', source: `${(complexMeta.method || []).join(', ')} at ${fmt(complexMeta.resolution_A, 2)} Å, ${complexMeta.n_chains} chains, CA-only; a proxy protein at ${complexMeta.identity_to_zebrafish != null ? `${fmt(complexMeta.identity_to_zebrafish, 1)}%` : 'unstated'} identity`, url: complexMeta.url });
  else provItems.push({ label: 'a measured complex for this protein', kind: 'absent', source: focus.experimental?.absent_reason || 'none exists in this project' });
  for (const cls of ICLASS) {
    const n = iCounts[cls.key] || 0;
    if (n) provItems.push({ label: `${n} ${cls.label.toLowerCase()} edge${n > 1 ? 's' : ''}`, kind: cls.kind, source: `${cls.note}; drawn ${cls.dash ? 'dashed' : 'solid'} at width ${cls.width}` });
  }
  provItems.push({ label: 'partner node positions', kind: 'decorative', source: 'laid on a sphere by index so the lines do not overlap; the geometry carries no information and affects no number' });
  provItems.push({ label: 'camera path and rotation', kind: 'decorative', source: 'chosen to show the molecule; affects no number' });
  for (const g of allGaps) provItems.push({ label: g.what || g.id, kind: 'absent', source: g.reason });

  const verdict = st.absent ? 'assumed' : (complex || siteRec?.on_experimental_structure?.measured ? 'mixed' : 'mixed');
  const provenance = {
    summary: st.absent
      ? `No structure exists for ${focus.symbol}: ${st.reason}. Everything shown is an absence with its reason.`
      : `${focus.symbol} backbone from AlphaFold DB ${st.model} (predicted, mean pLDDT ${fmt(st.mean_plddt)}), coloured by its own confidence. ${sitePos ? `The changed residue is placed at ${sitePos}${siteRec?.position_check?.ok === false ? ' although our own position check for it failed' : ''}${siteRec?.on_experimental_structure?.pdb_id ? `, and its distance to the functional site is measured on ${siteRec.on_experimental_structure.pdb_id}` : ''}. ` : ''}${nPartners ? `${nZf} of ${nPartners} interaction partners have zebrafish experimental evidence; the rest are transferred, database-asserted or text-mined and are drawn differently. ` : 'No interaction partner passes the confidence cut. '}${allGaps.length} absences are rendered as gaps.`,
    verdict, items: provItems,
  };

  /* ---------------------------------------------------------------- 13. handle */
  let disposed = false;
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { if (!disposed && canFit()) { sizeCanvas(); render(local); } }) : null;
  ro?.observe(stageEl);

  return {
    duration,
    chapters: CH.map(({ t, label, say }) => ({ t, label, say })),
    provenance,
    play(t) {
      if (disposed) return;
      playing = true;
      local = clamp(t ?? local, 0, duration);
      t0 = performance.now() - local * 1000;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    },
    pause() { playing = false; if (raf) cancelAnimationFrame(raf); raf = 0; },
    seek(t) { if (disposed) return; local = clamp(t, 0, duration); render(local); },
    resize() { if (disposed) return; sizeCanvas(); drawRuler(); render(local); },
    setTheme(next) {
      if (disposed) return;
      root.setAttribute('data-theme-local', next);
      if (scene) scene.background = new THREE.Color(next === 'dark' ? 0x0e0e13 : 0xf1eee8);
      drawRuler();
      render(local);
    },
    dispose() {
      if (disposed) return;
      disposed = true; playing = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      ro?.disconnect();
      for (const d of disposables) { try { d.dispose?.(); } catch (_) {} }
      if (scene) scene.traverse((o) => { o.geometry?.dispose?.(); if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose?.()); else o.material?.dispose?.(); });
      if (renderer) { try { renderer.dispose(); renderer.forceContextLoss(); } catch (_) {} renderer.domElement?.remove(); }
      renderer = null; scene = null; cam = null; molGroup = cplxGroup = netGroup = null;
      caKeyed = null;
      root.remove();
    },
  };
}
