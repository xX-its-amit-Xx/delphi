#!/usr/bin/env node
// Measure how hard a text is to read, and flag the words a layperson would stumble on.
//
//   node tracks/scripts/readability.mjs "some text"            one string
//   node tracks/scripts/readability.mjs --file path.md         a file
//   import { grade, jargon, assess } from './readability.mjs'  from the bundle builder
//
// WHY THIS EXISTS. "A layperson should be able to understand exactly what we are doing" is a claim, and
// a claim nobody measures decays into an adjective. So the plain-language sections on the dashboard are
// measured by this script at build time, and a section over the limit fails the build.
//
// WHAT IT MEASURES, AND WHAT IT DOES NOT.
//   Flesch-Kincaid grade: 0.39 * (words per sentence) + 11.8 * (syllables per word) - 15.59. A standard,
//   crude, reproducible score; roughly a US school grade. It rewards short sentences and short words and
//   knows nothing about meaning. A text can score grade 6 and be nonsense, or grade 12 and be clear.
//   Jargon flags: a word is flagged if it is long (4+ syllables), contains a digit or a hyphenated
//   compound, or is an ALL-CAPS acronym, unless it is in the glossary supplied or in the small allow-list
//   of everyday long words. This is a HEURISTIC for "probably needs explaining", not a dictionary.
// The score says whether a text is plausibly readable. Whether it is understood is a separate question
// that only a reader can answer, which is why a comprehension check by a reader who has not seen the
// source is also part of the pipeline.

export const EVERYDAY_LONG = new Set([
  'everything', 'everyone', 'everybody', 'important', 'different', 'difficult', 'possible', 'impossible',
  'example', 'together', 'together', 'something', 'sometimes', 'animal', 'animals', 'family', 'general',
  'usually', 'especially', 'especially', 'basically', 'actually', 'carefully', 'completely', 'probably',
  'temperature', 'information', 'experiment', 'experiments', 'measurement', 'measurements', 'material',
  'materials', 'computer', 'comparison', 'understand', 'ordinary', 'direction', 'particular', 'political',
  'several', 'beautiful', 'interesting', 'comfortable', 'generally', 'eventually', 'immediately',
  'curiosity', 'ability', 'possibility', 'reality', 'quantity', 'humidity', 'electricity', 'community',
]);

export function syllables(word) {
  let w = String(word).toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const m = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, m ? m.length : 1);
}

export function words(text) {
  return (String(text).match(/[A-Za-z][A-Za-z'’-]*/g) ?? []);
}

export function sentences(text) {
  const t = String(text).replace(/\b(e\.g|i\.e|etc|vs|approx|Fig|Eq|No|Dr|Mr|Ms)\./gi, '$1')
    .replace(/(\d)\.(\d)/g, '$1_$2');
  const parts = t.split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])|\n{2,}/).map((s) => s.trim()).filter((s) => /[A-Za-z]/.test(s));
  return parts.length ? parts : [t];
}

export function grade(text) {
  const ws = words(text), ss = sentences(text);
  if (!ws.length) return { grade: 0, words: 0, sentences: 0, words_per_sentence: 0, syllables_per_word: 0 };
  const syl = ws.reduce((a, w) => a + syllables(w), 0);
  const wps = ws.length / ss.length, spw = syl / ws.length;
  return {
    grade: Math.max(0, 0.39 * wps + 11.8 * spw - 15.59),
    words: ws.length, sentences: ss.length, words_per_sentence: wps, syllables_per_word: spw,
  };
}

export function jargon(text, glossary = []) {
  const known = new Set(glossary.map((g) => String(g.term ?? g).toLowerCase()));
  const seen = new Map();
  for (const raw of String(text).match(/[A-Za-z0-9][A-Za-z0-9'’-]*/g) ?? []) {
    const w = raw.toLowerCase();
    if (known.has(w) || EVERYDAY_LONG.has(w)) continue;
    const why =
      /\d/.test(raw) && /[A-Za-z]/.test(raw) ? 'contains a digit'
      : /^[A-Z]{2,}s?$/.test(raw) ? 'acronym'
      : /[A-Za-z]-[A-Za-z]/.test(raw) && syllables(raw) >= 4 ? 'hyphenated compound'
      : syllables(raw) >= 4 ? 'long word' : null;
    if (why) seen.set(w, { word: raw, why, count: (seen.get(w)?.count ?? 0) + 1 });
  }
  return [...seen.values()].sort((a, b) => b.count - a.count);
}

/** Judge one section. `limit` is the highest acceptable grade; `max_jargon` the most unexplained terms. */
export function assess(text, { glossary = [], limit = 10, max_jargon = 4 } = {}) {
  const g = grade(text), j = jargon(text, glossary);
  const longest = Math.max(0, ...sentences(text).map((s) => words(s).length));
  return {
    ...g, longest_sentence_words: longest, jargon: j,
    ok: g.grade <= limit && j.length <= max_jargon && longest <= 45,
    failed: [
      ...(g.grade > limit ? [`grade ${g.grade.toFixed(1)} is over ${limit}`] : []),
      ...(j.length > max_jargon ? [`${j.length} unexplained terms (limit ${max_jargon}): ${j.slice(0, 6).map((x) => x.word).join(', ')}`] : []),
      ...(longest > 45 ? [`a sentence has ${longest} words`] : []),
    ],
  };
}

if (process.argv[1] && process.argv[1].endsWith('readability.mjs')) {
  const fs = await import('node:fs');
  const fi = process.argv.indexOf('--file');
  const text = fi > 0 ? fs.readFileSync(process.argv[fi + 1], 'utf8') : process.argv.slice(2).join(' ');
  const a = assess(text);
  console.log(`grade ${a.grade.toFixed(1)} | ${a.words} words, ${a.sentences} sentences, ${a.words_per_sentence.toFixed(1)} words/sentence, ${a.syllables_per_word.toFixed(2)} syllables/word`);
  console.log(a.ok ? 'OK' : 'NOT OK: ' + a.failed.join('; '));
  if (a.jargon.length) console.log('flagged: ' + a.jargon.slice(0, 15).map((x) => `${x.word} (${x.why})`).join(', '));
}
