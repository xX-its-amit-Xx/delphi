// node devlog/test-registers.mjs              -> every assertion should pass
// node devlog/test-registers.mjs --fail-once  -> every assertion must FAIL. An assertion that still prints
//                                                "ok" under the injected fault was not testing anything.
//
// The faults are PREDICATE INVERSIONS, not loosened thresholds: the broken branch asks the opposite
// question of the same data, so it can only pass if the data is the opposite of what is claimed.
import { ENTRIES } from './entries.mjs';
import { REGISTERS, MISSING } from './registers.mjs';

const FAULT = process.argv.includes('--fail-once');
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ''}`); } };
const f = (real, broken) => (FAULT ? broken : real);

const ids = ENTRIES.map(e => e.id);
const regIds = Object.keys(REGISTERS);
const entryById = Object.fromEntries(ENTRIES.map(e => [e.id, e]));

// numbers, commas and decimal points kept: "4,673" and "0.0000" are single tokens
const nums = s => [...String(s).matchAll(/\d[\d,.]*\d|\d/g)].map(m => m[0]);
const allText = v => typeof v === 'string' ? v : Array.isArray(v) ? v.map(allText).join(' ')
  : v && typeof v === 'object' ? Object.values(v).map(allText).join(' ') : '';

const HYPE = ['revolutionary', 'groundbreaking', 'game-changing', 'excited to'];
const BAD_OPENERS = /^(in this post|we|our)\b/i;
const LEVELS = ['general', 'technical-curious', 'specialist'];

console.log('coverage');
const uncovered = ids.filter(id => !REGISTERS[id]);
check('every id in ENTRIES has a register', f(uncovered.length === 0, uncovered.length !== 0), `uncovered: ${uncovered.join(', ') || 'none'}`);
const orphans = regIds.filter(id => !ids.includes(id));
check('no register for an id absent from ENTRIES', f(orphans.length === 0, orphans.length !== 0), `orphans: ${orphans.join(', ') || 'none'}`);
check('MISSING is empty', f(MISSING.length === 0, MISSING.length !== 0), `MISSING = [${MISSING.join(', ')}]`);
check('every covered entry has both a skim and a blog', f(
  ids.every(id => REGISTERS[id]?.skim && REGISTERS[id]?.blog),
  !ids.every(id => REGISTERS[id]?.skim && REGISTERS[id]?.blog)));

console.log('skim');
for (const id of ids) {
  const s = REGISTERS[id]?.skim;
  if (!s) { fail++; console.log(`  FAIL skim present: ${id}`); continue; }
  check(`${id}: headline under 90 chars`, f(s.headline.length < 90, s.headline.length >= 90), `${s.headline.length} chars`);
  check(`${id}: headline is not the entry title`, f(s.headline !== entryById[id].title, s.headline === entryById[id].title));
  check(`${id}: 3-5 bullets`, f(s.bullets.length >= 3 && s.bullets.length <= 5, !(s.bullets.length >= 3 && s.bullets.length <= 5)), `${s.bullets.length} bullets`);
  const tooLong = s.bullets.filter(b => b.length >= 120);
  check(`${id}: every bullet under 120 chars`, f(tooLong.length === 0, tooLong.length !== 0), `longest ${Math.max(...s.bullets.map(b => b.length))}`);
  check(`${id}: so_what is one sentence`, f(
    s.so_what.length > 20 && (s.so_what.match(/[.?!](\s|$)/g) || []).length === 1,
    !(s.so_what.length > 20 && (s.so_what.match(/[.?!](\s|$)/g) || []).length === 1)));
  check(`${id}: read_time_seconds is a plausible number`, f(
    Number.isFinite(s.read_time_seconds) && s.read_time_seconds > 0 && s.read_time_seconds <= 120,
    !(Number.isFinite(s.read_time_seconds) && s.read_time_seconds > 0 && s.read_time_seconds <= 120)), String(s.read_time_seconds));
}

// The load-bearing one for the skim register: a bullet without a number is usually a generality.
const bullets = ids.flatMap(id => REGISTERS[id]?.skim?.bullets ?? []);
const withDigit = bullets.filter(b => /\d/.test(b));
const ratio = withDigit.length / bullets.length;
check(`at least two-thirds of all ${bullets.length} bullets contain a digit`, f(ratio >= 2 / 3, ratio < 2 / 3),
  `${withDigit.length}/${bullets.length} = ${ratio.toFixed(3)}`);

console.log('blog');
for (const id of ids) {
  const b = REGISTERS[id]?.blog;
  if (!b) { fail++; console.log(`  FAIL blog present: ${id}`); continue; }
  check(`${id}: title is not the feature name`, f(b.title !== entryById[id].title, b.title === entryById[id].title));
  check(`${id}: hook does not open with "In this post" / "We" / "Our"`, f(!BAD_OPENERS.test(b.hook.trim()), BAD_OPENERS.test(b.hook.trim())), b.hook.slice(0, 24));
  check(`${id}: hook is a real paragraph`, f(b.hook.length > 120, b.hook.length <= 120), `${b.hook.length} chars`);
  check(`${id}: body has 4-7 paragraphs`, f(
    Array.isArray(b.body) && b.body.length >= 4 && b.body.length <= 7,
    !(Array.isArray(b.body) && b.body.length >= 4 && b.body.length <= 7)), `${b.body?.length} paragraphs`);
  check(`${id}: closing ends on a question or says "open"`, f(
    /\?\s*$/.test(b.closing) || /\bopen\b/i.test(b.closing),
    !(/\?\s*$/.test(b.closing) || /\bopen\b/i.test(b.closing))));
  check(`${id}: reading_level is one of ${LEVELS.join('/')}`, f(LEVELS.includes(b.reading_level), !LEVELS.includes(b.reading_level)), String(b.reading_level));
}

// What stops the narrative drifting off the facts: a blog post must reuse a number from its own entry.
const entryNums = id => new Set((entryById[id].real_numbers ?? []).flatMap(nums));
const blogNums = id => new Set(nums(allText(REGISTERS[id].blog)));
const overlap = id => [...blogNums(id)].filter(n => entryNums(id).has(n));
// `cases` states its real_numbers in words and carries no digits at all, so it cannot be held to the
// overlap. The exemption is asserted by COUNT so that it cannot quietly grow to cover a drifting post.
const noNumbers = ids.filter(id => entryNums(id).size === 0);
check(`exactly 1 entry has no digits in real_numbers (exemption cannot grow)`, f(noNumbers.length === 1, noNumbers.length !== 1), `[${noNumbers.join(', ')}]`);
for (const id of ids.filter(i => !noNumbers.includes(i))) {
  const o = overlap(id);
  check(`${id}: blog reuses a number from real_numbers`, f(o.length > 0, o.length === 0), `shared: ${o.slice(0, 6).join(', ') || 'NONE'}`);
}

console.log('tone');
for (const id of ids) {
  const text = allText(REGISTERS[id]).toLowerCase();
  const hits = HYPE.filter(w => text.includes(w));
  check(`${id}: no hype words`, f(hits.length === 0, hits.length !== 0), hits.join(', '));
}

console.log(`\n${pass} passed, ${fail} failed${FAULT ? '  (--fail-once: every assertion above must read FAIL)' : ''}`);
process.exit(fail && !FAULT ? 1 : 0);
