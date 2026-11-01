// spec-box.js: type what the organism must do, see the DesignSpec the engine read, fix it in place.
//
// HOW TO MOUNT (for perturb.js or any page; nothing else to include):
//
//   import { mountSpecBox } from './spec-box.js';
//   const box = await mountSpecBox(document.getElementById('spec-slot'), {
//     onSpec: (spec, info) => { /* spec: DesignSpec (sim-engine/lib/spec.mjs), already validated;
//                                  info: { validation, unparsed, refused, assumptions, text } */ },
//     initialText: 'a zebrafish that glides at least 30 m from 1 m height, survives 4 °C to 32 °C',
//     // engineBase: URL of the copied engine (default: ./engine/ next to this file, written by
//     //             node dashboard/build-engine.mjs; parse-text.mjs and spec.mjs are pure ESM and copy there)
//     // validate:   false to skip loading scenarios + bundle for validation (shape checks only)
//   });
//   box.setText('...'); box.getSpec(); box.destroy();
//
// What the user sees: a text box; under it one chip per organism and per criterion (click a criterion
// chip to edit op / value / stages / hard / weight in place, × to delete it); every piece of text the
// parser could not read, highlighted red with the reason; refusals (birds: frozen holdout; Lean laws
// cannot be waived) in red; the defaults the parser applied; and the engine's validation errors.
// "Use this spec" calls onSpec. It is disabled while anything is refused or the spec is invalid, and
// while text is unparsed it says so explicitly ("Use without the red text") instead of dropping it.
//
// Styled with the explode.html tokens (--panel, --ink, --mute, --line, --accent, --soft, --ok, --bad,
// --warn), with fallbacks so it also renders on a page that does not define them.

const STAGES = ['embryo', 'larva', 'juvenile', 'adult'];
// survives = the organism lives through it; feasible = the behaviour is possible (glide, hold station, grip, escape)
const OPS = ['>=', '<=', 'survives', 'feasible', 'maximize', 'minimize'];
const OP_WORD = { '>=': '≥', '<=': '≤', survives: 'survives', feasible: 'can do', maximize: 'maximize', minimize: 'minimize' };
// glide distances: which part a Lean theorem covers (lib/spec.mjs LEAN_COVER)
const LEAN_TAG = { glide_range_total_m: ' · total: only the h·L/D part is Lean-covered', ground_distance_total_m: ' · total: only the h·L/D part is Lean-covered', glide_range_lean_bound_m: ' · Lean-covered (glide_range_le)' };

const CSS = `
.specbox{--sb-panel:var(--panel,#fff);--sb-ink:var(--ink,#14201f);--sb-mute:var(--mute,#5a6b69);--sb-line:var(--line,#d9dfdb);--sb-accent:var(--accent,#0e7c86);--sb-soft:var(--soft,#eef2ef);--sb-ok:var(--ok,#2f7d4f);--sb-bad:var(--bad,#b3392f);--sb-warn:var(--warn,#a8650b);
 font:14px/1.45 "Inter Tight",system-ui,sans-serif;color:var(--sb-ink);border:1px solid var(--sb-line);border-radius:10px;background:var(--sb-panel);padding:10px 12px;max-width:100%;box-sizing:border-box}
.specbox *{box-sizing:border-box}
.specbox h4{margin:8px 0 4px;font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:var(--sb-mute);font-weight:600}
.specbox textarea{width:100%;min-height:64px;resize:vertical;font:inherit;font-size:.9rem;border:1px solid var(--sb-line);border-radius:8px;padding:7px 9px;background:var(--sb-panel);color:var(--sb-ink)}
.specbox textarea:focus{outline:2px solid color-mix(in srgb,var(--sb-accent) 45%,transparent);border-color:var(--sb-accent)}
.specbox .row{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px}
.specbox button{font:inherit;font-size:.84rem;border:1px solid var(--sb-line);background:var(--sb-panel);color:var(--sb-ink);border-radius:8px;padding:3px 10px;cursor:pointer}
.specbox button.primary{border-color:var(--sb-accent);color:var(--sb-accent);font-weight:600}
.specbox button:disabled{opacity:.45;cursor:not-allowed}
.specbox .chip{display:inline-flex;gap:5px;align-items:center;padding:2px 9px;border-radius:99px;font-size:.78rem;border:1px solid var(--sb-line);background:var(--sb-soft);color:var(--sb-ink);margin:0 5px 5px 0;max-width:100%}
.specbox .chip.crit{cursor:pointer;border-color:var(--sb-accent)}
.specbox .chip.crit:hover{outline:2px solid color-mix(in srgb,var(--sb-accent) 35%,transparent)}
.specbox .chip.soft{border-style:dashed}
.specbox .chip .st{color:var(--sb-mute)}
.specbox .chip .x{border:0;background:none;padding:0 0 0 3px;color:var(--sb-mute);font-size:.9rem;line-height:1}
.specbox .chip.org{border-color:var(--sb-ink)}
.specbox .bad{color:var(--sb-bad)}
.specbox .unparsed{background:color-mix(in srgb,var(--sb-bad) 12%,transparent);border-left:3px solid var(--sb-bad);padding:4px 8px;border-radius:4px;margin:3px 0;font-size:.82rem}
.specbox .unparsed mark{background:color-mix(in srgb,var(--sb-bad) 25%,transparent);color:inherit;padding:0 2px;border-radius:3px}
.specbox .unparsed .why{display:block;color:var(--sb-mute);font-size:.76rem}
.specbox .err{color:var(--sb-bad);font-size:.8rem;margin:2px 0}
.specbox .warn{color:var(--sb-warn);font-size:.78rem;margin:2px 0}
.specbox ul.assume{margin:2px 0;padding-left:1.1em;color:var(--sb-mute);font-size:.78rem}
.specbox .editor{border:1px solid var(--sb-accent);border-radius:8px;padding:6px 8px;margin:4px 0 6px;display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;font-size:.8rem}
.specbox .editor label{display:inline-flex;gap:4px;align-items:center}
.specbox .editor input[type=number]{width:84px;font:inherit;border:1px solid var(--sb-line);border-radius:6px;padding:1px 5px;background:var(--sb-panel);color:var(--sb-ink)}
.specbox .editor select{font:inherit;border:1px solid var(--sb-line);border-radius:6px;padding:1px 4px;background:var(--sb-panel);color:var(--sb-ink)}
.specbox .tiny{font-size:.75rem;color:var(--sb-mute)}
.specbox .okline{color:var(--sb-ok);font-size:.8rem}
`;

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null) n.append(c.nodeType ? c : document.createTextNode(String(c)));
  return n;
}
const fmt = v => (typeof v === 'number' ? String(+v.toPrecision(4)) : String(v));
// water_temp_C 4 → "water temp 4 °C"; current_m_s 0.3 → "current 0.3 m/s"
const KEY_UNIT = [[/_m_s$/, 'm/s'], [/_BL_s$/, 'BL/s'], [/_kPa$/, 'kPa'], [/_C$/, '°C'], [/_m$/, 'm'], [/_h(ours)?$/, 'h']];
function paramText(k, v) {
  for (const [re, u] of KEY_UNIT) if (re.test(k)) return `${k.replace(re, '').replace(/_/g, ' ')} ${fmt(v)} ${u}`;
  return `${k.replace(/_/g, ' ')} ${fmt(v)}`;
}
const stageText = s => (s === 'all' ? 'all stages' : Array.isArray(s) ? s.join(' + ') : s?.ageDays ? `${s.ageDays.min}–${s.ageDays.max} d` : 'adult');
function critText(c) {
  const ps = Object.entries(c.params || {}).filter(([k]) => k !== 'water').map(([k, v]) => paramText(k, v)).join(', ');
  if (c.op === 'survives') return `survives ${c.scenario}${ps ? `: ${ps}` : ''}`;
  if (c.op === 'feasible') return `can do ${c.scenario}${ps ? `: ${ps}` : ''}`;
  if (c.op === 'maximize' || c.op === 'minimize') return `${c.op} ${c.metric}${ps ? ` (${ps})` : ''}`;
  return `${c.metric} ${OP_WORD[c.op]} ${fmt(c.value)} ${c.unit || ''}${ps ? ` (${ps})` : ''}`;
}

async function buildBrowserRegistry(base, specMod) {
  const imp = rel => import(new URL(rel, base).href);
  const [organism, state, scen, bundle] = await Promise.all([
    imp('lib/organism.mjs'), imp('lib/state.mjs'), imp('scenarios/index.mjs'),
    fetch(new URL('data/bundle.json', base)).then(r => { if (!r.ok) throw new Error(`bundle.json ${r.status}`); return r.json(); }),
  ]);
  const { scenarios, errors } = await scen.loadScenarios();
  return specMod.makeRegistry({ scenarios: Object.fromEntries(scenarios), scenarioErrors: Object.fromEntries((errors || []).map(e => [e.split(':')[0].replace(/\.mjs$/, ''), e])),
    bundle, organism, state, runner: scen.runScenario, sources: ['browser engine'] });
}

export async function mountSpecBox(root, opts = {}) {
  if (!root) throw new Error('mountSpecBox: no element');
  const base = new URL(opts.engineBase || './engine/', import.meta.url);
  if (!document.getElementById('specbox-css')) document.head.append(el('style', { id: 'specbox-css', text: CSS }));

  const box = el('div', { class: 'specbox', role: 'group', 'aria-label': 'Functional design criteria' });
  const ta = el('textarea', { 'aria-label': 'Describe what the organism must do', placeholder: 'e.g. a zebrafish that glides at least 30 m from 1 m height, survives 4 °C to 32 °C, outswims a 0.3 m/s current as a larva and adult', spellcheck: 'false' });
  const status = el('span', { class: 'tiny', 'aria-live': 'polite' });
  const useBtn = el('button', { class: 'primary', type: 'button', disabled: true, text: 'Use this spec' });
  const parseBtn = el('button', { type: 'button', text: 'Read' });
  const out = el('div');
  box.append(ta, el('div', { class: 'row' }, parseBtn, useBtn, status), out);
  root.replaceChildren(box);

  let parseMod, specMod, registry = null, regNote = '';
  try {
    [parseMod, specMod] = await Promise.all([import(new URL('lib/parse-text.mjs', base).href), import(new URL('lib/spec.mjs', base).href)]);
  } catch (e) {
    out.replaceChildren(el('div', { class: 'err', text: `The spec parser is not deployed at ${base}lib/ (run node dashboard/build-engine.mjs): ${e.message}` }));
    return { setText() {}, getSpec: () => null, destroy: () => root.replaceChildren() };
  }
  if (opts.validate !== false) {
    buildBrowserRegistry(base, specMod).then(r => { registry = r; if (current) refresh(); })
      .catch(e => { regNote = `validated for shape only (engine not loaded: ${e.message})`; if (current) refresh(); });
  }

  let current = null; // { text, parsed, spec }
  let editing = null; // criterion id open in the editor

  function read() {
    const text = ta.value;
    const parsed = parseMod.parseDesignText(text);
    current = { text, parsed, spec: parsed.spec };
    editing = null;
    refresh();
  }

  function refresh() {
    const { parsed, spec, text } = current;
    const v = specMod.validateSpec(spec, registry);
    out.replaceChildren();

    // organisms
    out.append(el('h4', { text: 'Start from' }));
    const orgRow = el('div');
    if (spec.start_from.length) for (const o of spec.start_from) orgRow.append(el('span', { class: 'chip org', text: `${Math.round(o.weight * 100)}% ${o.organism}` }));
    else orgRow.append(el('span', { class: 'tiny', text: 'no organism named (say "a zebrafish …" or "70% zebrafish 30% flying fish")' }));
    out.append(orgRow);

    // criteria
    out.append(el('h4', { text: `Criteria (${spec.criteria.length})` }));
    const critRow = el('div');
    spec.criteria.forEach((c, i) => {
      const chip = el('span', { class: `chip crit${c.hard ? '' : ' soft'}`, tabindex: '0', role: 'button', title: (c.source_text ? `from: "${c.source_text}" · ` : '') + 'click to edit',
        onclick: () => { editing = editing === c.id ? null : c.id; refresh(); },
        onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); editing = editing === c.id ? null : c.id; refresh(); } } },
        el('span', { text: critText(c) }), el('span', { class: 'st', text: `· ${stageText(c.stages)}${c.hard ? '' : ' · soft'}${c.weight !== 1 ? ` · w${c.weight}` : ''}${LEAN_TAG[c.metric] || ''}` }),
        el('button', { class: 'x', type: 'button', 'aria-label': 'delete criterion', text: '×', onclick: e => { e.stopPropagation(); spec.criteria.splice(i, 1); spec.criteria.forEach((x, j) => (x.id = `c${j + 1}`)); refresh(); } }));
      critRow.append(chip);
      if (editing === c.id) critRow.append(editor(c));
    });
    if (!spec.criteria.length) critRow.append(el('span', { class: 'tiny', text: 'none read yet' }));
    out.append(critRow);

    if (spec.editable?.length) {
      out.append(el('h4', { text: 'Editable' }));
      const r = el('div');
      for (const e of spec.editable) r.append(el('span', { class: 'chip', text: `${e.target.id} · ${e.param}${e.min != null ? ` ${fmt(e.min)}–${fmt(e.max)}` : ' (no range)'}` }));
      out.append(r);
    }

    // unparsed and refused: the user's own words, highlighted
    if (parsed.refused.length || parsed.unparsed.length) {
      out.append(el('h4', { class: 'bad', text: 'Not used' }));
      for (const r of parsed.refused) out.append(el('div', { class: 'unparsed' }, 'Refused: ', el('mark', { text: r.text }), el('span', { class: 'why', text: r.reason })));
      for (const u of parsed.unparsed) out.append(el('div', { class: 'unparsed' }, el('mark', { text: u.text }), el('span', { class: 'why', text: u.reason })));
    }
    if (parsed.assumptions.length) {
      out.append(el('h4', { text: 'Defaults applied' }));
      out.append(el('ul', { class: 'assume' }, parsed.assumptions.map(a => el('li', { text: a }))));
    }
    // validation
    const errs = v.errors.filter(e => e.path !== 'refused');
    if (errs.length) { out.append(el('h4', { class: 'bad', text: 'The engine rejects' })); for (const e of errs) out.append(el('div', { class: 'err', text: `${e.path}: ${e.message}` })); }
    if (v.warnings.length) for (const w of v.warnings) out.append(el('div', { class: 'warn', text: `${w.path ? w.path + ': ' : ''}${w.message}` }));
    if (v.ok) out.append(el('div', { class: 'okline', text: registry ? 'Valid against the engine\'s scenarios and parts.' : `Valid in shape${regNote ? ` · ${regNote}` : ' · loading engine for full validation…'}` }));

    const blocked = parsed.refused.length > 0 || !v.ok;
    useBtn.disabled = blocked || !text.trim();
    useBtn.textContent = !blocked && parsed.unparsed.length ? `Use without the red text (${parsed.unparsed.length})` : 'Use this spec';
    status.textContent = blocked ? (parsed.refused.length ? 'refused text must be removed first' : 'fix the errors above first') : '';
    current.validation = v;
  }

  function editor(c) {
    const wrap = el('div', { class: 'editor', onclick: e => e.stopPropagation() });
    const op = el('select', { 'aria-label': 'operator' }, OPS.map(o => el('option', { value: o, selected: o === c.op, text: OP_WORD[o] })));
    op.addEventListener('change', () => { c.op = op.value; if (c.op === 'maximize' || c.op === 'minimize') c.hard = false; refresh(); });
    wrap.append(el('label', {}, 'op ', op));
    if (c.op === '>=' || c.op === '<=') {
      const val = el('input', { type: 'number', step: 'any', value: c.value ?? '', 'aria-label': 'value' });
      val.addEventListener('change', () => { const x = parseFloat(val.value); if (Number.isFinite(x)) { c.value = x; refresh(); } });
      wrap.append(el('label', {}, 'value ', val, ` ${c.unit || ''}`));
    }
    for (const [k, v] of Object.entries(c.params || {})) {
      if (typeof v !== 'number') continue;
      const inp = el('input', { type: 'number', step: 'any', value: v, 'aria-label': k });
      inp.addEventListener('change', () => { const x = parseFloat(inp.value); if (Number.isFinite(x)) { c.params[k] = x; refresh(); } });
      wrap.append(el('label', {}, `${k.replace(/_/g, ' ')} `, inp));
    }
    const all = el('input', { type: 'checkbox', checked: c.stages === 'all' });
    all.addEventListener('change', () => { c.stages = all.checked ? 'all' : ['adult']; refresh(); });
    wrap.append(el('label', {}, all, 'all stages'));
    if (c.stages !== 'all' && (Array.isArray(c.stages) || !c.stages)) for (const s of STAGES) {
      const cb = el('input', { type: 'checkbox', checked: (c.stages || ['adult']).includes(s) });
      cb.addEventListener('change', () => { const set = new Set(c.stages || ['adult']); cb.checked ? set.add(s) : set.delete(s); c.stages = STAGES.filter(x => set.has(x)); refresh(); });
      wrap.append(el('label', {}, cb, s));
    }
    if (c.op !== 'maximize' && c.op !== 'minimize') {
      const hard = el('input', { type: 'checkbox', checked: !!c.hard });
      hard.addEventListener('change', () => { c.hard = hard.checked; refresh(); });
      wrap.append(el('label', { title: 'hard: must hold at every stage for the design to meet the spec' }, hard, 'hard'));
    }
    const w = el('input', { type: 'number', step: 'any', min: '0', value: c.weight ?? 1, 'aria-label': 'weight' });
    w.addEventListener('change', () => { const x = parseFloat(w.value); if (Number.isFinite(x) && x >= 0) { c.weight = x; refresh(); } });
    wrap.append(el('label', {}, 'weight ', w));
    return wrap;
  }

  let timer = null;
  ta.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(read, 450); });
  parseBtn.addEventListener('click', read);
  useBtn.addEventListener('click', () => {
    if (!current || useBtn.disabled) return;
    const v = current.validation;
    opts.onSpec?.(v.spec, { validation: { ok: v.ok, errors: v.errors, warnings: v.warnings }, unparsed: current.parsed.unparsed, refused: current.parsed.refused, assumptions: current.parsed.assumptions, text: current.text });
  });

  if (opts.initialText) { ta.value = opts.initialText; read(); }
  return {
    setText(t) { ta.value = t; read(); },
    getSpec: () => (current?.validation?.ok ? current.validation.spec : null),
    destroy() { clearTimeout(timer); root.replaceChildren(); },
  };
}

export default mountSpecBox;
