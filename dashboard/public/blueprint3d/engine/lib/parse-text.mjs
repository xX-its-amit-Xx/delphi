// parse-text: plain English → DesignSpec (lib/spec.mjs). Deterministic, no LLM, no network.
//
//   import { parseDesignText } from './parse-text.mjs';
//   const { spec, unparsed, refused, assumptions } = parseDesignText(
//     'a zebrafish that glides at least 30 m from 1 m height, survives 4 °C to 32 °C, ' +
//     'outswims a 0.3 m/s current as a larva and adult, keep the Lean laws');
//
// What it promises:
//   - Every piece of the input ends up in exactly one place: a criterion / organism / editable
//     entry, `assumptions` (a default it applied, stated), `refused` (with the reason), or
//     `unparsed` (verbatim, with the reason). Nothing is dropped silently and nothing is guessed:
//     a number with an unknown unit, a criterion with no number, a fish the engine does not have,
//     all go to `unparsed`.
//   - Birds are refused, never parsed: Aves are a frozen holdout.
//   - The parser does not validate against the engine. Run validateSpec(spec, registry) next; it
//     maps these keys onto the scenarios' declared keys and rejects anything they do not declare.
//
// Pure ESM. The browser loads it next to spec.mjs (see tools/SPEC-REGISTER.md for the copy step).

import { BIRD_WORDS, AVES_REFUSAL, PART_WORDS, STAGES, depthToKPa, convert } from './spec.mjs';

// ── lexicon ────────────────────────────────────────────────────────────────
const NUM = String.raw`(-?\d+(?:\.\d+)?)`;
const UNIT_PATTERNS = [
  // [regex source (no capture groups), canonical unit, dimension] — longest first
  [String.raw`body\s*lengths?\s*(?:per|\/|a)\s*s(?:ec(?:ond)?)?|BL\s*\/\s*s|BL\s*s-1|bl\/s`, 'BL/s', 'speed'],
  [String.raw`m\s*\/\s*s|m\s*s-1|(?:meters?|metres?)\s*(?:per|a)\s*second`, 'm/s', 'speed'],
  [String.raw`km\s*\/\s*h|kph|km\s*per\s*hour|(?:kilometers?|kilometres?)\s*(?:per|an)\s*hour`, 'km/h', 'speed'],
  [String.raw`cm\s*\/\s*s|(?:centimeters?|centimetres?)\s*per\s*second`, 'cm/s', 'speed'],
  [String.raw`mm\s*\/\s*s`, 'mm/s', 'speed'],
  [String.raw`knots?|kn\b`, 'kn', 'speed'],
  [String.raw`mph|miles\s*per\s*hour`, 'mph', 'speed'],
  [String.raw`°\s*C\b|º\s*C\b|degrees?\s*(?:C\b|celsius|centigrade)|deg\s*C\b|celsius|C\b`, '°C', 'temperature'],
  [String.raw`°\s*F\b|degrees?\s*(?:F\b|fahrenheit)|fahrenheit|F\b`, '°F', 'temperature'],
  [String.raw`kelvin|K\b`, 'K', 'temperature'],
  [String.raw`MPa|megapascals?`, 'MPa', 'pressure'],
  [String.raw`kPa|kilopascals?`, 'kPa', 'pressure'],
  [String.raw`atm\b|atmospheres?`, 'atm', 'pressure'],
  [String.raw`bars?\b`, 'bar', 'pressure'],
  [String.raw`Pa\b|pascals?`, 'Pa', 'pressure'],
  [String.raw`km\b|kilometers?|kilometres?`, 'km', 'length'],
  [String.raw`cm\b|centimeters?|centimetres?`, 'cm', 'length'],
  [String.raw`mm\b|millimeters?|millimetres?`, 'mm', 'length'],
  [String.raw`ft\b|feet|foot`, 'ft', 'length'],
  [String.raw`m\b|meters?\b|metres?\b`, 'm', 'length'],
  [String.raw`h\b|hrs?\b|hours?`, 'h', 'time'],
  [String.raw`min\b|minutes?`, 'min', 'time'],
  [String.raw`%|percent`, '%', 'ratio'],
];
const UNIT_RE = new RegExp(`${NUM}\\s*(${UNIT_PATTERNS.map(u => `(?:${u[0]})`).join('|')})`, 'gi');
// Case matters for a few single letters: K vs k, F vs f, C vs c, m vs M.
const CASE_SENSITIVE = { 'K': /^K$/, 'F': /^F$/, 'C': /^C$/ };
function unitOf(raw) {
  const r = raw.trim();
  for (const [src, canon, dim] of UNIT_PATTERNS) {
    if (new RegExp(`^(?:${src})$`, 'i').test(r)) {
      if (CASE_SENSITIVE[r.toUpperCase()] && !CASE_SENSITIVE[r.toUpperCase()].test(r)) return null; // lone lower-case c/f/k
      return { unit: canon, dim };
    }
  }
  return null;
}

const ORGANISMS = [
  // [regex, organism id] longest first. "zebrafish" is the zebrafish-adult reference, whose
  // development track runs from hatching to adult (lib/data-node.mjs bundle).
  [/\bwingless[\s-]+flying[\s-]?fish(?:es)?\b/i, 'wingless-flying-fish'],
  [/\bwinged[\s-]+zebra[\s-]?fish(?:es)?\b/i, 'winged-zebrafish'],
  [/\b(?:TFF|truly[\s-]+flying[\s-]+fish(?:es)?)\b/i, 'tff'],
  [/\b(?:ff-zf-chimera|zebrafish[\s-]+flying[\s-]?fish\s+chimera|chimera)\b/i, 'ff-zf-chimera'],
  [/\bflying[\s-]?fish(?:es)?\b|\bexocoet(?:us|id|idae)\b|\bcheilopogon\b/i, 'flying-fish'],
  [/\bzebrafish-larva\b/i, 'zebrafish-larva'],
  [/\bzebra[\s-]?fish(?:es)?\b|\bdanio(?:\s+rerio)?\b/i, 'zebrafish-adult'],
];
// Organisms people name that the engine does not have. Never mapped to a "close" one.
const OTHER_ORGANISMS = /\b(salmon|trout|tuna|shark|goldfish|medaka|carp|cod|guppy|tilapia|catfish|eel|seahorse|stickleback|killifish|cichlid|bat|bats|insect|dragonfly|squid|octopus|frog|lizard|mouse|human|dolphin|whale|ray|manta|flying squirrel|sugar glider|gecko)\b/i;

// Ambiguous bird words count as birds only after an article or "like" ("a swift", "like a duck").
const AMBIGUOUS_BIRD = new Set(['swallow', 'swift', 'swifts', 'duck', 'crow', 'robin', 'tern', 'finch', 'hen', 'dove', 'raven', 'hawk', 'kingfisher', 'gull']);
const birdHit = s => {
  for (const w of BIRD_WORDS) {
    const re = AMBIGUOUS_BIRD.has(w)
      ? new RegExp(`\\b(?:a|an|the|like|of|from|copy)\\s+(?:a\\s+|an\\s+|the\\s+)?${w}s?\\b`, 'i')
      : new RegExp(`\\b${w}(?:'s|s)?\\b`, 'i');
    const m = re.exec(s);
    if (m) return m[0];
  }
  return null;
};

const STAGE_WORD = { embryo: /\bembryo(?:s|nic)?\b/i, larva: /\blarva(?:e|l|s)?\b/i, juvenile: /\bjuveniles?\b/i, adult: /\badult(?:s|hood)?\b/i };
const ALL_STAGES = /\b(?:at|in|across|through(?:out)?|for)?\s*(?:all|every|each)\s+(?:of\s+its\s+)?(?:life\s+)?(?:stages?|ages?|life[\s-]?stages?)\b|\bthroughout\s+(?:its\s+)?(?:life|development|ontogeny|the\s+life\s+cycle)\b|\bfrom\s+hatching\s+(?:to|until|through)\s+adult(?:hood)?\b|\b(?:whole|entire)\s+life\b/i;

const GE = /\b(?:at\s+least|no\s+less\s+than|not\s+less\s+than|a\s+minimum\s+of|minimum(?:\s+of)?|min\.?|more\s+than|over|above|greater\s+than|exceeding|exceeds?|beyond|upwards\s+of|>=|>)\s*/i;
const LE = /\b(?:at\s+most|no\s+more\s+than|not\s+more\s+than|a\s+maximum\s+of|maximum(?:\s+of)?|max\.?|less\s+than|under|below|within|up\s+to|<=|<)\s*/i;
const STRICT = /\b(?:more\s+than|over|above|greater\s+than|exceeding|exceeds?|beyond|less\s+than|under|below)\b|[<>](?!=)/i;
const SOFT = /\b(?:ideally|preferably|if\s+possible|nice\s+to\s+have|bonus|optionally|would\s+be\s+nice|where\s+possible)\b/i;
const IMPORTANT = /\b(?:(?:very|most|really|critically)\s+important|top\s+priority|high\s+priority|crucial)\b/i;
const WEIGHT = /\b(?:weight|priority)\s*(?:of\s*|=\s*|:\s*)?(\d+(?:\.\d+)?)\b/i;

const LEAN_KEEP = /\b(?:keep|respect|obey|honou?r|satisfy|follow|hold|preserve|with|under|subject\s+to|must\s+(?:satisfy|obey|pass|respect))\s+(?:all\s+)?(?:the\s+)?lean(?:\s+(?:laws?|constraints?|verdicts?|checks?|theorems?|proofs?|rules?))?(?:\s+(?:holding|intact))?\b|\blean\s+(?:laws?|constraints?|verdicts?|checks?)\s+(?:must\s+)?hold\b|\b(?:obey|respect|follow)\s+(?:the\s+)?laws\s+of\s+physics\b|\bphysically\s+(?:possible|plausible|consistent)\b/i;
const LEAN_WAIVE = /\b(?:ignore|ignoring|waive|waiving|skip|skipping|break|breaking|drop|dropping|relax|relaxing|bypass|without|disable|turn\s+off|violate|violating)\s+(?:all\s+)?(?:the\s+)?(?:lean|laws\s+of\s+physics|physics)(?:\s+(?:laws?|constraints?|verdicts?|checks?|rules?))?\b|\blean\s+(?:laws?|constraints?)\s+(?:can|may)\s+(?:fail|be\s+(?:broken|ignored|violated))\b/i;

// Words that carry no requirement. A clause left with only these after matching is fully consumed.
const FILLER = new Set(('a an the that which who it its it\'s and or also too as well should must can could would will to be is are able ' +
  'of with i we me us please want need like design make build create give find get one organism fish animal creature thing new ' +
  'something someone so while still both even then also just really for in on at by from this these those has have having ' +
  'there here some any all every each when where only same keep stay remain while being been do does doing very quite ' +
  'survive survives surviving survival tolerate tolerates tolerating withstand withstands withstanding handle handles live lives living ' +
  'cope copes capable can, temperatures temperature water waters condition conditions environment range ranging ' +
  'between through good well enough reliably comfortably easily per but not').split(/\s+/));
const isFillerOnly = s => s.toLowerCase().replace(/[^a-z0-9%'\s]/g, ' ').split(/\s+/).filter(Boolean).every(w => FILLER.has(w));

// ── helpers ────────────────────────────────────────────────────────────────
function normalise(s) {
  return s.replace(/[≥⩾]/g, ' at least ').replace(/[≤⩽]/g, ' at most ').replace(/[−‒]/g, '-').replace(/[–—]/g, ' - ')
    .replace(/º/g, '°').replace(/ /g, ' ').replace(/(\d),(\d{3})\b/g, '$1$2');
}
// A clause as a mutable buffer: matched spans are blanked so the leftover can be checked.
class Clause {
  constructor(original) { this.original = original; this.text = normalise(original); }
  take(re) {
    const m = re.exec(this.text);
    if (!m) return null;
    this.text = this.text.slice(0, m.index) + ' '.repeat(m[0].length) + this.text.slice(m.index + m[0].length);
    return m;
  }
  has(re) { return re.test(this.text); }
  takeAll(re) { const out = []; let m; while ((m = this.take(re))) out.push(m); return out; }
  blank(index, length) { this.text = this.text.slice(0, index) + ' '.repeat(length) + this.text.slice(index + length); }
  leftover() { return this.text.replace(/[,;:.!?()"]+/g, ' ').replace(/\s+/g, ' ').trim(); }
}
// All number+unit tokens in a clause, with index (not consumed).
function quantities(cl) {
  const out = []; UNIT_RE.lastIndex = 0; let m;
  while ((m = UNIT_RE.exec(cl.text))) {
    const u = unitOf(m[2]);
    if (!u) continue;
    out.push({ value: +m[1], unit: u.unit, dim: u.dim, index: m.index, length: m[0].length, raw: m[0] });
  }
  return out;
}
// The bound word immediately before index (within 30 chars), consumed.
function boundBefore(cl, index) {
  const pre = cl.text.slice(Math.max(0, index - 32), index);
  const ge = new RegExp(`(?:${GE.source})$`, 'i').exec(pre), le = new RegExp(`(?:${LE.source})$`, 'i').exec(pre);
  const hit = ge && le ? (ge[0].length >= le[0].length ? ['>=', ge] : ['<=', le]) : ge ? ['>=', ge] : le ? ['<=', le] : null;
  if (!hit) return null;
  const start = index - hit[1][0].length;
  const strict = STRICT.test(hit[1][0]);
  cl.blank(start, hit[1][0].length);
  return { op: hit[0], strict, words: hit[1][0].trim() };
}
const si = (q, to) => convert(q.value, q.unit, to);
const round = x => Math.round(x * 1e6) / 1e6;

// ── stages ─────────────────────────────────────────────────────────────────
function takeStages(cl, notes) {
  if (cl.take(ALL_STAGES)) return 'all';
  // "from larva to adult"
  const fr = cl.take(/\bfrom\s+(?:an?\s+|the\s+)?(embryo|larva|juvenile|adult)(?:e|s|l|nic|hood)?\s+(?:to|until|through|into)\s+(?:an?\s+|the\s+)?(embryo|larva|juvenile|adult)(?:e|s|l|nic|hood)?\b/i);
  if (fr) { const a = STAGES.indexOf(fr[1].toLowerCase()), b = STAGES.indexOf(fr[2].toLowerCase()); return STAGES.slice(Math.min(a, b), Math.max(a, b) + 1); }
  // age ranges: "between 5 and 30 dpf", "from 3 to 10 days after hatching", "at 30 days old"
  const AGEU = String.raw`(dpf|dph|dah|d\b|days?(?:\s+(?:post[\s-]?fertili[sz]ation|after\s+hatching|post[\s-]?hatch(?:ing)?|old|of\s+age))?|weeks?(?:\s+old)?|months?(?:\s+old)?)`;
  const toDah = (v, u) => {
    u = u.toLowerCase();
    if (/^dpf|fertili/.test(u)) { notes.push(`${v} dpf converted to ${v - 2} days after hatching (the stage tables count from hatching at ~2 dpf)`); return v - 2; }
    if (/^week/.test(u)) return v * 7;
    if (/^month/.test(u)) return Math.round(v * 30.44);
    return v;
  };
  const rg = cl.take(new RegExp(String.raw`\b(?:between|from|aged)\s+${NUM}\s*(?:${AGEU})?\s*(?:and|to|-)\s*${NUM}\s*${AGEU}`, 'i'));
  if (rg) { const u = rg[4] || rg[2]; const a = toDah(+rg[1], u), b = toDah(+rg[3], u); return { ageDays: { min: Math.min(a, b), max: Math.max(a, b) } }; }
  const at = cl.take(new RegExp(String.raw`\b(?:at|when|aged)\s+(?:an?\s+age\s+of\s+)?${NUM}\s*${AGEU}`, 'i')) || cl.take(new RegExp(String.raw`\b${NUM}[\s-]*(days?|weeks?|months?)[\s-]+old\b`, 'i'));
  if (at) { const a = toDah(+at[1], at[2]); return { ageDays: { min: a, max: a } }; }
  // named stages anywhere in the clause, with their connectors
  const found = [];
  for (const s of STAGES) {
    const re = new RegExp(String.raw`(?:\b(?:as|when|in|at|for|during)\s+(?:the\s+)?(?:an?\s+)?|\b(?:and|or|,)\s+(?:as\s+)?(?:an?\s+)?|\b(?:an?\s+|the\s+|both\s+))?` + STAGE_WORD[s].source + String.raw`(?:\s+stages?)?`, 'i');
    if (cl.take(re)) found.push(s);
  }
  return found.length ? STAGES.filter(s => found.includes(s)) : null;
}

// ── criterion families ─────────────────────────────────────────────────────
// Each family reads one clause, takes what it understands and returns criteria (without stages).
// `problems` collects "I recognised X but could not read it" reasons for the unparsed list.
function familyTemperature(cl, out, problems) {
  const qs = quantities(cl).filter(q => q.dim === 'temperature');
  if (!qs.length) {
    if (cl.has(/\b(cold|warm|hot|freezing|heat|chill(?:y|ed)?|tropical|arctic)\b/i)) problems.push('temperature words without a number and unit (say e.g. "survives 4 °C")');
    return;
  }
  // range "X to Y unit" where X may lack a unit: "4 to 32 °C", "4-32 °C", "between 4 °C and 32 °C"
  const rangeRe = new RegExp(String.raw`(?:\bbetween\s+|\bfrom\s+)?${NUM}\s*(?:°\s*[CF]|degrees?\s*[CF]?|K)?\s*(?:to|and|through|-)\s*(\d+(?:\.\d+)?|-\d+(?:\.\d+)?)\s*(°\s*C\b|°\s*F\b|degrees?\s*(?:C\b|F\b|celsius|fahrenheit)|celsius|fahrenheit|kelvin|K\b|C\b|F\b)`, 'i');
  const rm = cl.take(rangeRe);
  if (rm) {
    const u = unitOf(rm[3]).unit;
    const a = convert(+rm[1], u, '°C'), b = convert(+rm[2], u, '°C');
    for (const t of [Math.min(a, b), Math.max(a, b)]) out.push({ scenario: 'temperature', params: { water_temperature_C: round(t) }, op: 'survives', ...(u !== '°C' ? { value_as_given: { value: t === a ? +rm[1] : +rm[2], unit: u } } : {}) });
  }
  for (const q of quantities(cl).filter(q => q.dim === 'temperature')) {
    boundBefore(cl, q.index);
    cl.blank(q.index, q.length);
    out.push({ scenario: 'temperature', params: { water_temperature_C: round(si(q, '°C')) }, op: 'survives', ...(q.unit !== '°C' ? { value_as_given: { value: q.value, unit: q.unit } } : {}) });
  }
  cl.take(/\b(?:water\s+)?temperatures?\b|\bwater\b|\bdown\s+to\b|\bup\s+to\b/i);
}

function familyGlide(cl, out, problems) {
  if (!cl.has(/\bglid(?:e|es|ing|er)\b|\bfl(?:y|ies|ight)\b|\bsoar|\bairborne\b|\btake[\s-]?off\b|\bstall\b|\bwing\s+loading\b|\bglide\s+ratio\b/i)) return;
  if (cl.has(/\bpowered\s+flight\b|\bunder\s+its\s+own\s+power\b|\bflap(?:s|ping)?\b|\btruly\s+fl(?:y|ies)\b|\bhover/i)) {
    problems.push('powered flight / flapping: the glide scenario has a powered-flight feasibility metric, but its pass threshold is not fixed in the spec vocabulary; state a glide range, or set metric and threshold explicitly');
    cl.take(/\bpowered\s+flight\b|\bunder\s+its\s+own\s+power\b|\bflap(?:s|ping)?\b|\btruly\s+fl(?:y|ies)\b|\bhover\w*/i);
    cl.take(/\bfl(?:y|ies|ight)\b/i);
    return;
  }
  // glide ratio
  const gr = cl.take(new RegExp(String.raw`\b(?:glide\s+ratio|lift[\s-]to[\s-]drag(?:\s+ratio)?|L\/D)\s*(?:of\s+)?(?:(${GE.source})|(${LE.source}))?\s*${NUM}(?!\s*(?:m\b|km|ft))`, 'i'));
  if (gr) { out.push({ scenario: 'glide', metric: 'glide_ratio', op: gr[2] ? '<=' : '>=', value: +gr[3], unit: '1', params: {} }); }
  // take-off / stall speed, wing loading
  for (const [re, metric, dim, to, defOp] of [
    [/\b(?:take[\s-]?off|stall|minimum\s+flight)\s+speed\b/i, 'v_min_m_s', 'speed', 'm/s', '<='],
    [/\bwing\s+loading\b/i, 'wing_loading_N_m2', 'loading', 'N/m2', '<='],
  ]) {
    if (!cl.has(re)) continue;
    cl.take(re);
    const q = dim === 'speed' ? quantities(cl).find(q => q.dim === 'speed') : (() => { const m = cl.take(new RegExp(String.raw`(?:(${GE.source})|(${LE.source}))?\s*${NUM}\s*(?:N\s*\/\s*m2|N\s*\/\s*m\^?2|N\s*m-2|Pa\b)`, 'i')); return m ? { value: +m[3], unit: 'N/m2', index: -1, op: m[1] ? '>=' : m[2] ? '<=' : null } : null; })();
    if (!q) { problems.push(`${metric}: no number with a unit`); continue; }
    let op = q.op || null;
    if (q.index >= 0) { const b = boundBefore(cl, q.index); op = b?.op || null; cl.blank(q.index, q.length); }
    out.push({ scenario: 'glide', metric, op: op || defOp, value: q.unit === to ? q.value : round(si(q, to)), unit: to, params: {}, ...(op ? {} : { _assumed: `no bound word for ${metric}; "${defOp}" assumed` }) });
  }
  // range and launch height
  const ls = quantities(cl).filter(q => q.dim === 'length');
  const params = {};
  for (const q of ls) {
    const pre = cl.text.slice(Math.max(0, q.index - 28), q.index), post = cl.text.slice(q.index + q.length, q.index + q.length + 22);
    if (/\b(?:from|off|launched\s+(?:from|at)|starting\s+(?:at|from)|dropped\s+from|released\s+(?:at|from)|at)\s+(?:a\s+)?(?:height\s+of\s+)?$/i.test(pre) || /^\s*(?:high|height|up|launch|above\s+the\s+water|altitude)\b/i.test(post)) {
      params.launch_height_m = round(si(q, 'm'));
      cl.blank(q.index, q.length);
      cl.take(new RegExp(String.raw`\b(?:from|off|launched\s+(?:from|at)|starting\s+(?:at|from)|dropped\s+from|released\s+(?:at|from)|at)\s+(?:a\s+)?(?:height\s+of\s+)?(?=\s*$|\s+)`, 'i'));
      cl.take(/\b(?:launch\s+)?(?:height|high)\b(?:\s+above\s+the\s+water)?/i);
    }
  }
  let any = !!gr;
  for (const q of quantities(cl).filter(q => q.dim === 'length')) {
    const b = boundBefore(cl, q.index);
    cl.blank(q.index, q.length);
    out.push({ scenario: 'glide', metric: 'glide_range_m', op: b?.op || '>=', value: q.unit === 'm' ? q.value : round(si(q, 'm')), unit: 'm', params: { ...params },
      ...(b ? {} : { _assumed: `"${q.raw.trim()}" glide with no bound word: "at least" assumed` }), ...(b?.strict ? { _strict: true } : {}) });
    any = true;
  }
  if (!any && !cl.has(/\b(?:maximi[sz]e|minimi[sz]e|as\s+far\s+as\s+possible|farthest|furthest|longest)\b/i) && !out.some(c => c.scenario === 'glide')) {
    const unknownUnit = new RegExp(String.raw`${NUM}\s+([a-zA-Z]+)`).exec(cl.text);
    problems.push(unknownUnit ? `glide distance "${unknownUnit[0].trim()}": unknown unit "${unknownUnit[2]}" (use m, km, cm or ft)` : 'glide/flight mentioned without a distance (say e.g. "glides at least 30 m from 1 m")');
  } else if (Object.keys(params).length && !any) out.push({ _paramsOnly: params });
  cl.take(/\bglid(?:e|es|ing)\b(?:\s+(?:distance|range|for|over))?/i); cl.take(/\bfl(?:y|ies)\b(?:\s+(?:for|over))?/i); cl.take(/\bflight\s+(?:distance|range)\b/i);
}

function familySpeedIn(cl, out, problems, { word, scenario, param, label }) {
  if (!cl.has(word)) return false;
  const q = quantities(cl).find(q => q.dim === 'speed');
  if (!q) {
    const unk = new RegExp(String.raw`${NUM}\s+([a-zA-Z/]+)`).exec(cl.text);
    problems.push(unk ? `${label} speed "${unk[0].trim()}": unknown unit "${unk[2]}" (use m/s, cm/s, km/h, kn or BL/s)` : `${label} without a speed (say e.g. "a 0.3 m/s ${label}")`);
    cl.take(word);
    return true;
  }
  boundBefore(cl, q.index);
  cl.blank(q.index, q.length);
  cl.take(word);
  if (q.unit === 'BL/s') out.push({ scenario, params: { [param.replace('_m_s', '_BL_s')]: q.value }, op: 'survives', _assumed: `${label} given in BL/s: the scenario takes m/s, so the value must be converted per stage from body length` });
  else out.push({ scenario, params: { [param]: round(si(q, 'm/s')) }, op: 'survives', ...(q.unit !== 'm/s' ? { value_as_given: { value: q.value, unit: q.unit } } : {}) });
  return true;
}

function familySwim(cl, out, problems) {
  // a current/flow the fish must hold against → current scenario, survives
  const cur = /\b(?:currents?|flows?|stream|river|rapids|water\s+speed)\b/i;
  if (cl.has(cur) && !cl.has(/\b(?:grip|cling|hold\s+on|attach|stick)/i)) {
    familySpeedIn(cl, out, problems, { word: cur, scenario: 'current', param: 'current_m_s', label: 'current' });
    cl.take(/\b(?:out[\s-]?swims?|swims?\s+against|holds?\s+(?:its\s+)?station\s+in|holds?\s+position\s+in|against|in|into)\b/i);
    return;
  }
  // a swimming speed → current scenario metric ucrit
  if (!cl.has(/\bswim(?:s|ming)?\b|\bu[\s-]?crit\b|\bcruis(?:e|es|ing)\b|\bsprint/i)) return;
  const q = quantities(cl).find(q => q.dim === 'speed');
  if (!q) {
    if (!cl.has(/\b(?:maximi[sz]e|minimi[sz]e|as\s+fast\s+as\s+possible|fastest)\b/i)) {
      const unk = new RegExp(String.raw`${NUM}\s+([a-zA-Z/]+)`).exec(cl.text);
      problems.push(unk ? `swimming speed "${unk[0].trim()}": unknown unit "${unk[2]}" (use m/s, cm/s, km/h, kn or BL/s)` : 'swimming mentioned without a speed (say e.g. "swims at least 5 BL/s")');
      cl.take(/\bswim(?:s|ming)?\b/i);
    }
    return;
  }
  const b = boundBefore(cl, q.index);
  cl.blank(q.index, q.length);
  cl.take(/\b(?:swim(?:s|ming)?|cruis(?:e|es|ing)|sprint(?:s|ing)?)(?:\s+(?:speed|at|of))*\b|\bu[\s-]?crit\b(?:\s+of)?/i);
  out.push({ scenario: 'current', metric: 'ucrit_m_s', op: b?.op || '>=', value: q.value, unit: q.unit, params: {},
    ...(b ? {} : { _assumed: `swimming speed "${q.raw.trim()}" with no bound word: "at least" assumed` }), ...(b?.strict ? { _strict: true } : {}) });
}

function familyDepth(cl, out, problems) {
  const fresh = cl.take(/\bfresh[\s-]?water\b/i) ? 'fresh' : null;
  const sea = cl.take(/\bsea[\s-]?water\b|\bsalt[\s-]?water\b|\bthe\s+(?:sea|ocean)\b/i);
  for (const q of quantities(cl).filter(q => q.dim === 'pressure')) {
    boundBefore(cl, q.index); cl.blank(q.index, q.length);
    out.push({ scenario: 'pressure', params: { pressure_kPa: round(si(q, 'kPa')) }, op: 'survives', ...(q.unit !== 'kPa' ? { value_as_given: { value: q.value, unit: q.unit } } : {}) });
    cl.take(/\b(?:of\s+)?(?:pressure|absolute|gauge)\b/i);
  }
  if (!cl.has(/\b(?:deep|depths?|dives?|diving|below\s+the\s+surface|underwater|down\s+to)\b/i)) return;
  const q = quantities(cl).find(q => q.dim === 'length');
  if (!q) { const unk = new RegExp(String.raw`${NUM}\s+([a-zA-Z]+)`).exec(cl.text); problems.push(unk && !unitOf(unk[2]) ? `depth "${unk[0].trim()}": unknown unit "${unk[2]}" (use m, km or ft, or a pressure in atm, bar, kPa or MPa)` : 'depth mentioned without a length (say e.g. "survives 50 m depth")'); cl.take(/\b(?:deep|depths?|dives?|diving)\b/i); return; }
  boundBefore(cl, q.index); cl.blank(q.index, q.length);
  const d = round(si(q, 'm'));
  out.push({ scenario: 'pressure', params: { depth_m: d, water: fresh || 'sea' }, op: 'survives',
    _assumed: `depth ${d} m kept as depth; validateSpec converts it to the scenario's pressure parameter as ${fresh ? 'fresh' : 'sea'}water hydrostatic (${round(depthToKPa(d, fresh || 'sea'))} kPa absolute)${fresh || sea ? '' : '; water type not stated, seawater assumed'}` });
  cl.take(/\b(?:a\s+)?(?:dive|dives|diving)\s+(?:to|of)\b|\b(?:of\s+)?depths?\b|\bdeep\b|\bdown\s+to\b|\bbelow\s+the\s+surface\b|\bunderwater\b|\bat\b/i);
  cl.take(/\b(?:of\s+)?depths?\b|\bdeep\b|\bdives?\b/i);
}

function familyAltitude(cl, out, problems) {
  if (!cl.has(/\b(?:altitudes?|above\s+sea\s+level|elevations?|mountain|a\.?s\.?l\.?)\b/i)) return;
  const q = quantities(cl).find(q => q.dim === 'length');
  if (!q) { problems.push('altitude mentioned without a height (say e.g. "at 2000 m altitude")'); cl.take(/\baltitudes?\b|\belevations?\b/i); return; }
  boundBefore(cl, q.index); cl.blank(q.index, q.length);
  out.push({ scenario: 'altitude', params: { altitude_m: round(si(q, 'm')) }, op: 'survives' });
  cl.take(/\b(?:at\s+)?(?:an?\s+)?(?:altitudes?|elevations?)(?:\s+of)?\b|\babove\s+sea\s+level\b|\ba\.?s\.?l\.?\b/i);
  cl.take(/\baltitude\b|\bat\b/i);
}

function familyPredator(cl, out, problems) {
  if (!cl.has(/\bpredators?\b|\bescap(?:e|es|ing)\b|\b(?:being\s+)?(?:eaten|caught|attacked)\b|\bstrikes?\b/i)) return;
  const p = cl.take(new RegExp(String.raw`\b(?:escape|survival)\s+(?:probability|chance|rate)\s*(?:of\s+)?(?:(${GE.source})|(${LE.source}))?\s*${NUM}\s*(%)?`, 'i'));
  if (p) { const v = p[4] ? +p[3] / 100 : +p[3]; out.push({ scenario: 'predator', metric: 'escape_probability', op: p[2] ? '<=' : '>=', value: v, unit: '1', params: {} }); }
  // "a predator 3 times its speed" / "twice as fast": the scenario's own parameter is a speed ratio
  const ratio = cl.take(new RegExp(String.raw`\b(?:${NUM}\s*(?:x|×|times)|(twice|three\s+times|half))\s*(?:as\s+fast|faster|its\s+(?:own\s+)?speed|the\s+fish'?s?\s+speed)(?:\s+as\s+(?:it|the\s+fish))?`, 'i'));
  const q = ratio ? null : quantities(cl).find(q => q.dim === 'speed');
  if (ratio) { const r = ratio[1] != null ? +ratio[1] : { twice: 2, 'three times': 3, half: 0.5 }[ratio[2].toLowerCase().replace(/\s+/g, ' ')]; out.push({ scenario: 'predator', params: { predator_speed_ratio: r }, op: 'survives' }); }
  else if (q) { boundBefore(cl, q.index); cl.blank(q.index, q.length); out.push({ scenario: 'predator', params: { predator_speed_m_s: round(si(q, 'm/s')) }, op: 'survives' }); }
  else if (!p) out.push({ scenario: 'predator', params: {}, op: 'survives', _assumed: 'predator without a speed: the scenario\'s default predator is used' });
  cl.take(/\b(?:escap(?:e|es|ing)(?:\s+from)?|outruns?|evades?|avoids?)\b/i);
  cl.take(/\b(?:a\s+)?predators?(?:\s+(?:striking|swimming|attacking|lunging|moving))?(?:\s+at)?\b|\bstrikes?\b(?:\s+at)?/i);
  cl.take(/\b(?:being\s+)?(?:eaten|caught|attacked)\b/i);
}

function familyWind(cl, out, problems) {
  if (familySpeedIn(cl, out, problems, { word: /\b(?:winds?|gusts?|breeze|headwind|crosswind)\b/i, scenario: 'wind', param: cl.has(/\bgusts?\b/i) ? 'gust_m_s' : 'wind_m_s', label: 'wind' }))
    cl.take(/\b(?:in|into|against|through)\b/i);
}

function familyGrip(cl, out, problems) {
  if (!cl.has(/\b(?:grip|grips|gripping|cling|clings|clinging|holds?\s+on(?:to)?|attach(?:es)?|sticks?\s+to)\b/i)) return;
  const q = quantities(cl).find(q => q.dim === 'speed');
  cl.take(/\b(?:grip|grips|gripping|cling|clings|clinging|holds?\s+on(?:to)?|attach(?:es)?|sticks?\s+to)\b(?:\s+(?:to|onto))?/i);
  cl.take(/\b(?:a\s+|the\s+)?(?:rocks?|surfaces?|substrates?|stones?|walls?|bottom)\b/i);
  if (q) { boundBefore(cl, q.index); cl.blank(q.index, q.length); cl.take(/\b(?:in\s+)?(?:a\s+)?(?:flow|current)s?\b|\bin\b/i); out.push({ scenario: 'grip', params: { flow_m_s: round(si(q, 'm/s')) }, op: 'survives' }); }
  else out.push({ scenario: 'grip', params: {}, op: 'survives', _assumed: 'grip without a flow speed: the scenario default flow is used' });
}

function familyTime(cl, out, problems) {
  const fams = [
    [/\bdigest(?:s|ion|ing)?\b|\bgut\s+transit\b|\bpasses?\s+a\s+meal\b/i, 'digestion', 'gut_transit_h', '<='],
    [/\bsleeps?\b|\bsleeping\b|\brests?\b(?!\s+of)/i, 'sleep', 'sleep_h', '>='],
  ];
  for (const [re, scenario, metric, defOp] of fams) {
    if (!cl.has(re)) continue;
    const q = quantities(cl).find(q => q.dim === 'time');
    cl.take(re); cl.take(/\b(?:a\s+)?meals?\b|\bfood\b|\bper\s+(?:day|night)\b|\ba\s+(?:day|night)\b|\bin\b|\bfor\b/i);
    if (!q) { if (!cl.has(/\b(?:maximi[sz]e|minimi[sz]e)\b/i)) problems.push(`${scenario} mentioned without a duration (say e.g. "digests a meal within 12 h")`); continue; }
    const b = boundBefore(cl, q.index); cl.blank(q.index, q.length);
    out.push({ scenario, metric, op: b?.op || defOp, value: q.unit === 'h' ? q.value : round(si(q, 'h')), unit: 'h', params: {}, ...(b ? {} : { _assumed: `${scenario} "${q.raw.trim()}" with no bound word: "${defOp === '>=' ? 'at least' : 'at most'}" assumed` }) });
    cl.take(/\bper\s+(?:day|night)\b|\ba\s+(?:day|night)\b/i);
  }
  if (cl.has(/\b(?:day[\s/-]?night|diel|photoperiod|daylight|darkness|light[\s:-]?dark)\b/i)) {
    const q = quantities(cl).find(q => q.dim === 'time');
    if (q) {
      const dark = /\bdark/i.test(cl.text);
      cl.blank(q.index, q.length);
      const light = dark ? 24 - si(q, 'h') : si(q, 'h');
      out.push({ scenario: 'daynight', params: { light_h: round(light) }, op: 'survives', ...(dark ? { _assumed: `${q.raw.trim()} of darkness read as ${round(light)} h of light in a 24 h day` } : {}) });
      cl.take(/\b(?:of\s+)?(?:day[\s/-]?night(?:\s+cycles?)?|diel(?:\s+cycles?)?|photoperiod|daylight|darkness|light[\s:-]?dark(?:\s+cycles?)?)\b/i); cl.take(/\b(?:hours?\s+)?(?:of\s+)?(?:light|dark)\b|\bday\b|\bcycles?\b/i);
    } else { problems.push('day-night cycle without a duration (say e.g. "survives 16 h of daylight")'); cl.take(/\b(?:day[\s/-]?night|diel|photoperiod|daylight|darkness)\b(?:\s+cycles?)?/i); }
  }
}

// maximise / minimise objectives
const OBJECTIVES = [
  [/\bglide\s+ratio\b|\blift[\s-]to[\s-]drag\b/i, 'glide', 'glide_ratio'],
  [/\b(?:glide|gliding|flight)\s+(?:distance|range)\b|\bglid(?:e|es|ing)\s+(?:as\s+far\s+as\s+possible|farthest|furthest)\b|\bglide\b|\bhow\s+far\s+it\s+glides\b/i, 'glide', 'glide_range_m'],
  [/\b(?:take[\s-]?off|stall)\s+speed\b/i, 'glide', 'v_min_m_s'],
  [/\bwing\s+loading\b/i, 'glide', 'wing_loading_N_m2'],
  [/\b(?:swim(?:ming)?\s+speed|u[\s-]?crit|critical\s+swimming\s+speed|sprint\s+speed|swim(?:s|ming)?\s+as\s+fast\s+as\s+possible|swim(?:s|ming)?\s+fastest|speed)\b/i, 'current', 'ucrit_m_s'],
  [/\bescape\s+(?:probability|chance|rate|success)\b/i, 'predator', 'escape_probability'],
  [/\b(?:digestion\s+time|gut\s+transit(?:\s+time)?)\b/i, 'digestion', 'gut_transit_h'],
  [/\bcost\s+of\s+transport\b|\benergy\s+(?:cost|use|expenditure)\b/i, 'current', 'cost_of_transport'],
  [/\bthermal\s+(?:margin|tolerance|safety\s+margin)\b/i, 'temperature', 'thermal_margin_C'],
  [/\bsleep(?:\s+time)?\b/i, 'sleep', 'sleep_h'],
];
function familyObjective(cl, out, problems) {
  let op = null;
  const ctx0 = cl.text;
  let m = cl.take(/\b(?:maximi[sz]e|maximi[sz]ing|increase|improve|boost|longest|farthest|furthest|highest)\b/i);
  if (m) op = 'maximize';
  else if ((m = cl.take(/\b(?:minimi[sz]e|minimi[sz]ing|reduce|lowest|shortest)\b/i))) op = 'minimize';
  else if ((m = cl.take(/\bas\s+(?:far|fast|long|high|well)\s+as\s+possible\b/i))) op = 'maximize';
  else if ((m = cl.take(/\bas\s+(?:little|low|short|cheap)\s+as\s+possible\b/i))) op = 'minimize';
  if (!op) return;
  // "as far as possible" right after a verb: glides as far as possible
  for (const [re, scenario, metric] of OBJECTIVES) {
    if (re.test(ctx0)) {
      cl.take(re);
      cl.take(/\b(?:swim(?:s|ming)?|glid(?:e|es|ing))\b/i);
      out.push({ scenario, metric, op, params: {}, hard: false });
      cl.take(/\b(?:the|its)\b/i);
      return;
    }
  }
  problems.push(`"${m[0].trim()}" with no metric the engine has (known: glide distance, glide ratio, take-off speed, wing loading, swimming speed, escape probability, digestion time, cost of transport, thermal margin, sleep)`);
}

// editable parameters: "vary the pectoral fin area from 0.02 to 0.08", "let it change the swim bladder"
function takeEditable(cl, editable, problems, assumptions) {
  const verb = /\b(?:vary|varying|change|changing|edit|editing|adjust|adjusting|tune|tuning|scale|scaling|resize|optimi[sz]e|allow|let|may\s+(?:change|edit|vary|adjust))\b/i;
  if (!cl.has(verb)) return;
  const partNames = Object.keys(PART_WORDS).sort((a, b) => b.length - a.length);
  const partRe = new RegExp(String.raw`\b(?:the\s+|its\s+)?(${partNames.map(p => p.replace(/ /g, String.raw`\s+`)).join('|')})(?:s|es)?\b`, 'i');
  const pm = partRe.exec(cl.text);
  if (!pm) {
    if (cl.has(/\b(?:fins?|wings?|tail|muscles?|organs?|bod(?:y|ies)|shape|size)\b/i) && cl.has(/\b(?:vary|change|edit|adjust|tune|scale|resize)\b/i)) problems.push('an edit of a part the parser does not know; name one of: ' + partNames.join(', '));
    return;
  }
  const key = pm[1].toLowerCase().replace(/\s+/g, ' ');
  const part = PART_WORDS[key];
  cl.take(verb); cl.take(partRe);
  // which param of that part
  let param = null;
  for (const [word, p] of Object.entries(part.params)) {
    const wr = new RegExp(String.raw`\b${word.replace(/ /g, String.raw`\s+`)}\b`, 'i');
    if (word !== 'size' && wr.test(cl.text)) { cl.take(wr); param = p; break; }
  }
  if (!param) { cl.take(/\b(?:size|sizes)\b/i); param = part.params.size; }
  const rr = cl.take(new RegExp(String.raw`\b(?:from|between|in\s+the\s+range)\s+${NUM}\s*(x|×|times|%)?\s*(?:to|and|-)\s*${NUM}\s*(x|×|times|%)?`, 'i'));
  const entry = { target: { level: part.level, id: part.id }, param };
  if (rr) {
    let a = +rr[1], b = +rr[3]; const pct = (rr[2] || rr[4]) === '%';
    if (pct) { a /= 100; b /= 100; }
    entry.min = a; entry.max = b;
    if (a > b) assumptions.push(`editable ${key} ${param}: range given high-to-low (${rr[1]} to ${rr[3]}); kept as stated so validation reports it`);
  } else assumptions.push(`editable ${key} ${param}: no range stated; the optimizer must bound it by the parents' envelope`);
  cl.take(/\b(?:it|the\s+design|us|me|you)\b/i);
  editable.push(entry);
  cl.take(/\b(?:to\s+)?(?:vary|change|be\s+changed|be\s+edited|freely)\b/i);
}

// ── main ───────────────────────────────────────────────────────────────────
// Split at sentence ends, semicolons, commas and "and"/"but"/"while" that start a new requirement.
// A comma or "and" followed by a stage word stays inside the clause ("as a larva, juvenile and adult").
const NEW_REQ = /^\s*(?:and\s+|but\s+|while\s+|also\s+|then\s+|it\s+(?:should|must)\s+|should\s+|must\s+|can\s+)*(?:also\s+)?(?:survives?|tolerates?|withstands?|glid|fl(?:y|ies)\b|swims?|out[\s-]?swims?|escapes?|dives?|digests?|sleeps?|grips?|clings?|holds?|keep|keeps|respect|obey|maximi|minimi|vary|let|allow|change|ignore|waive|break|reach|lives?|copy|copies|make|use|has|have|with\s+(?:a|an|the)\s|is\s|be\s|start|starting|based|ideally|preferably|weight|priority|it\s)/i;
const STAGE_AHEAD = /^\s*(?:and\s+|or\s+)?(?:as\s+)?(?:an?\s+|the\s+)?(?:embryo|larva|juvenile|adult)/i;
export function splitClauses(text) {
  const out = [];
  for (const sentence of text.split(/(?<=[^\d])\.(?=\s|$)|[;\n]+|(?<=\S)\.\s+(?=[A-Z])/)) {
    if (!sentence || !sentence.trim()) continue;
    // commas
    let parts = [], buf = '';
    const segs = sentence.split(/(,)/);
    for (let i = 0; i < segs.length; i++) {
      if (segs[i] === ',') {
        const rest = segs.slice(i + 1).join('');
        if (STAGE_AHEAD.test(rest) || /^\s*\d/.test(rest) && /\d\s*$/.test(buf)) buf += ',';
        else { parts.push(buf); buf = ''; }
      } else buf += segs[i];
    }
    parts.push(buf);
    // " and " / " but " / " while " that begin a new requirement
    for (const p of parts) {
      let cur = '', words = p.split(/(\s+(?:and|but|while|whereas)\s+)/i);
      for (let i = 0; i < words.length; i++) {
        if (/^\s+(?:and|but|while|whereas)\s+$/i.test(words[i]) && NEW_REQ.test(words[i + 1] || '') && cur.trim()) { out.push(cur); cur = ''; }
        else cur += words[i];
      }
      out.push(cur);
    }
  }
  return out.map(s => s.trim()).filter(Boolean);
}

export function parseDesignText(text) {
  const assumptions = [], unparsed = [], refused = [];
  const spec = { start_from: [], criteria: [], editable: [], constraints: { lean: 'must-hold' } };
  if (typeof text !== 'string' || !text.trim()) return { spec, unparsed: [{ text: String(text ?? ''), reason: 'empty input' }], refused, assumptions };

  let lastCriteria = [];
  let leanStated = false;
  const orgSeen = [];
  for (const raw of splitClauses(text)) {
    const cl = new Clause(raw);
    // 1. birds: refuse the whole clause, parse nothing from it
    const bird = birdHit(cl.text);
    if (bird) { refused.push({ text: raw, reason: AVES_REFUSAL, matched: bird.trim() }); continue; }
    // 2. Lean
    if (cl.take(LEAN_WAIVE)) { refused.push({ text: raw, reason: 'Lean constraints cannot be waived: every design must keep the Lean verdicts holding (constraints.lean = "must-hold").' }); continue; }
    if (cl.take(LEAN_KEEP)) leanStated = true;
    // 3. organisms with optional percentages: "70% zebrafish 30% flying fish", "half zebrafish half flying fish"
    const orgsHere = [];
    for (const [re, id] of ORGANISMS) {
      let m;
      while ((m = re.exec(cl.text))) {
        const pre = cl.text.slice(Math.max(0, m.index - 16), m.index);
        const pm = /(\d+(?:\.\d+)?)\s*(%|percent)\s*(?:of\s+)?(?:a\s+)?$/i.exec(pre) || /\b(half|a\s+quarter|three\s+quarters|one\s+third|two\s+thirds)\s+(?:a\s+)?$/i.exec(pre);
        let w = null;
        if (pm) {
          w = pm[2] ? +pm[1] / 100 : { half: 0.5, 'a quarter': 0.25, 'three quarters': 0.75, 'one third': 1 / 3, 'two thirds': 2 / 3 }[pm[1].toLowerCase().replace(/\s+/g, ' ')];
          cl.blank(m.index - pm[0].length, pm[0].length);
        }
        cl.blank(m.index, m[0].length);
        orgsHere.push({ organism: id, weight: w, index: m.index });
      }
    }
    orgsHere.sort((a, b) => a.index - b.index);
    if (orgsHere.length) { orgSeen.push(...orgsHere.map(({ index, ...o }) => o)); cl.takeAll(/\b(?:based\s+on|starting\s+from|start\s+from|derived\s+from|mix(?:ed)?|blend(?:ed)?|hybrid|cross)\b/i); }
    const other = OTHER_ORGANISMS.exec(cl.text);
    if (other) { unparsed.push({ text: raw, reason: `organism "${other[1]}" is not in the engine's data bundle (have: zebrafish, flying fish, winged zebrafish, wingless flying fish, TFF, the ff-zf chimera); not mapped to a "close" one` }); continue; }

    // 4. weight / softness for this clause
    const soft = !!cl.take(SOFT);
    const imp = cl.take(IMPORTANT);
    const wm = cl.take(WEIGHT);
    const weight = wm ? +wm[1] : imp ? 2 : 1;

    // 5. stages, then criteria families
    const stages = takeStages(cl, assumptions);
    const problems = [];
    takeEditable(cl, spec.editable, problems, assumptions);
    const found = [];
    familyObjective(cl, found, problems);
    familyGlide(cl, found, problems);
    familyGrip(cl, found, problems);
    familyWind(cl, found, problems);
    familySwim(cl, found, problems);
    familyPredator(cl, found, problems);
    familyAltitude(cl, found, problems);
    familyDepth(cl, found, problems);
    familyTemperature(cl, found, problems);
    familyTime(cl, found, problems);

    const crit = [];
    for (const f of found) {
      if (f._paramsOnly) { // a launch height with no range: attach to an objective in this clause
        const g = found.find(x => x.scenario === 'glide' && !x._paramsOnly);
        if (g) Object.assign(g.params, f._paramsOnly); else problems.push('a launch height without a glide distance or objective');
        continue;
      }
      const c = { ...f };
      if (c._assumed) { assumptions.push(c._assumed); delete c._assumed; }
      if (c._strict) { assumptions.push(`"${raw.trim()}": strict inequality read as non-strict (${c.op})`); delete c._strict; }
      if (soft && c.hard !== false) c.hard = false;
      if (c.hard == null) c.hard = c.op !== 'maximize' && c.op !== 'minimize';
      c.weight = weight;
      c.source_text = raw;
      crit.push(c);
    }
    // objective on the same metric as a threshold in the same clause: keep both (threshold is the floor)
    if (stages && !crit.length && lastCriteria.length && isFillerOnly(cl.leftover()) && !problems.length) {
      // a clause that is only a stage phrase ("..., at every stage") applies to the previous clause
      for (const c of lastCriteria) c.stages = stages;
      continue;
    }
    for (const c of crit) {
      if (stages) c.stages = stages;
      else { c.stages = ['adult']; c._defaultStage = true; }
    }
    spec.criteria.push(...crit);
    if (crit.length) lastCriteria = crit;

    // 6. anything left over
    const left = cl.leftover();
    if (problems.length) unparsed.push({ text: raw, reason: problems.join('; ') });
    else if (!isFillerOnly(left)) {
      const unk = new RegExp(String.raw`${NUM}\s*([^\s\d,.;]+)`).exec(left);
      const reason = unk && FILLER.has(unk[2].toLowerCase()) ? `a number with no unit near "${unk[0]}" (say e.g. "4 °C", "0.3 m/s", "30 m")`
        : unk && !unitOf(unk[2]) ? `"${unk[0]}": unknown unit "${unk[2]}"` : crit.length ? `part of this clause was not understood: "${left}"` : 'no criterion, organism or edit recognised';
      unparsed.push({ text: raw, reason, ...(crit.length ? { leftover: left } : {}) });
    }
    if (!crit.length && !orgsHere.length && !leanStated && !problems.length && isFillerOnly(left) && left) { /* pure filler such as "please" */ }
  }

  // organisms → start_from
  if (orgSeen.length) {
    const byId = new Map();
    for (const o of orgSeen) { const prev = byId.get(o.organism); if (!prev || (prev.weight == null && o.weight != null)) byId.set(o.organism, { ...o }); }
    const list = [...byId.values()];
    const given = list.filter(o => o.weight != null), missing = list.filter(o => o.weight == null);
    if (!given.length) {
      if (list.length === 1) list[0].weight = 1;
      else { const w = 1 / list.length; for (const o of list) o.weight = w; assumptions.push(`${list.length} organisms named without proportions: equal weights (${list.map(o => o.organism).join(', ')}) assumed`); }
    } else if (missing.length) {
      const rest = 1 - given.reduce((a, o) => a + o.weight, 0);
      if (rest > 0) { for (const o of missing) o.weight = rest / missing.length; assumptions.push(`weight of ${missing.map(o => o.organism).join(', ')} not stated: given the remaining ${round(rest * 100)} %`); }
      else for (const o of missing) o.weight = 0; // validateSpec rejects a zero weight
    }
    spec.start_from = list.map(o => ({ organism: o.organism, weight: round(o.weight) }));
  } else assumptions.push('no organism named: start_from is empty (validation will ask for one, e.g. "a zebrafish ..." or "70% zebrafish 30% flying fish")');

  const defaulted = spec.criteria.filter(c => c._defaultStage);
  if (defaulted.length) assumptions.push(`no stage stated for ${defaulted.length} criteri${defaulted.length === 1 ? 'on' : 'a'}: adult assumed (say "as a larva", "at all stages" or "at 30 dpf")`);
  spec.criteria.forEach((c, i) => { delete c._defaultStage; c.id = `c${i + 1}`; });
  if (!spec.editable.length) assumptions.push('no editable parameters stated: the optimizer has nothing to vary (say e.g. "vary the pectoral fin area from 0.02 to 0.08")');
  if (!leanStated) assumptions.push('Lean constraints not mentioned: they hold anyway (constraints.lean is always "must-hold")');
  if (refused.length) spec.refused = refused.map(r => ({ text: r.text, reason: r.reason }));
  return { spec, unparsed, refused, assumptions };
}

export default parseDesignText;
