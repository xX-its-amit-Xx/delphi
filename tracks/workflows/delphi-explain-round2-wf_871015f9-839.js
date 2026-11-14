export const meta = {
  name: 'delphi-explain-round2',
  description: 'Revise each plain-language explainer using its no-context reader report, then test the revision on a fresh reader',
  phases: [{ title: 'Revise', detail: 'writer sees the reader complaints' }, { title: 'Reread', detail: 'a fresh no-context reader' }],
}
const P2 = 'D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/tracks/research/phase2'
const A = 'D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/tracks/research/agents'
const G = ['bm-science','bm-making','bm-contract','track-1','track-2','track-3','track-4','track-6','leanbio-enhancers','leanbio-binding','people-funding']
const HOLD = 'This project has a frozen holdout. Do not read, use, cite or mention [held-out clade], [held-out clade] species, feathers, beaks, or [held-out clade] flight or anatomy anywhere.'
const EXPLAIN = { type: 'object', properties: {
  label: { type: 'string' }, one_line: { type: 'string' }, what: { type: 'string' }, why: { type: 'string' },
  steps: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, picture: { type: 'string' } }, required: ['text'] } },
  wrong_if: { type: 'string' }, could_go_wrong: { type: 'array', items: { type: 'string' } },
  questions: { type: 'array', items: { type: 'object', properties: { q: { type: 'string' }, a: { type: 'string' } }, required: ['q', 'a'] } },
  glossary: { type: 'array', items: { type: 'object', properties: { term: { type: 'string' }, plain: { type: 'string' } }, required: ['term', 'plain'] } },
  check_yourself: { type: 'array', items: { type: 'object', properties: { what: { type: 'string' }, command: { type: 'string' }, expect: { type: 'string' } }, required: ['what', 'command'] } },
  sources: { type: 'array', items: { type: 'object', properties: { cite: { type: 'string' }, id: { type: 'string' } }, required: ['cite'] } },
  left_out: { type: 'array', items: { type: 'string' } },
  changes: { type: 'array', items: { type: 'string' } },
}, required: ['label','one_line','what','why','steps','wrong_if','could_go_wrong','questions','glossary','check_yourself','sources','left_out','changes'] }
const READ = { type: 'object', properties: {
  label: { type: 'string' }, in_my_words: { type: 'string' }, how_in_my_words: { type: 'string' },
  test_questions: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, my_answer: { type: 'string' }, answerable_from_text: { type: 'boolean' } }, required: ['question','my_answer','answerable_from_text'] } },
  words_i_did_not_know: { type: 'array', items: { type: 'string' } }, sentences_i_could_not_follow: { type: 'array', items: { type: 'string' } },
  clarity_1_to_5: { type: 'integer' }, what_would_help: { type: 'string' },
}, required: ['label','in_my_words','how_in_my_words','test_questions','words_i_did_not_know','sentences_i_could_not_follow','clarity_1_to_5','what_would_help'] }

const revise = (g) => `You are revising a plain-language explainer for people with NO science background. Read three files:
 ${P2}/explain-${g}.json  (the current version)
 ${P2}/read-${g}.json     (a reader with no background tried it and reported what failed: words they did not know, sentences they could not follow, questions the text could not answer, and what would help)
 the agents' reports it came from, in ${A}/ (names are in the old explainer's sources; open only what you need to fix a gap)
Fix EVERY complaint the reader made: replace or explain each unknown word where it first appears (not only in the glossary), rewrite each sentence they could not follow into two or three simple ones, add the missing answers for the questions the text could not answer (only from facts in the agents' reports or the old explainer; if a fact is not there, say we do not know), and do what "what_would_help" asks. Keep what already worked. Do not add any fact, number or source that is not already in the old explainer or the agents' reports. Keep the same fields, and list in "changes" each fix you made, one line each.
Style: short sentences (average under 14 words), everyday words, a concrete comparison for every number, abbreviations spelled out the first time. ${HOLD} Do not write any file; return the result only.
Your label is explain2-${g}.`
const reread = (ex, g) => `You are a curious adult with no science training who has never seen this project. Below is a short explanation page written for people like you. You have NO other information: do not look anything up, open files or use tools. Work only from the text.
TEXT:
${JSON.stringify({ ...ex, changes: undefined, left_out: undefined }, null, 1)}
Be honest and not polite. Return: in_my_words (2-3 sentences, what the project is), how_in_my_words (3-5 sentences, how it is done), test_questions (5 questions someone who understood could answer, each answered from the text only, answerable_from_text false if the text does not allow it), words_i_did_not_know (every word you did not understand or only half did), sentences_i_could_not_follow (copied), clarity_1_to_5 (1 lost, 5 could explain it to a friend), what_would_help.
Your label is read2-${g}.`

phase('Revise')
const out = await parallel(G.map(g => async () => {
  const ex = await agent(revise(g), { label: `explain2-${g}`, phase: 'Revise', schema: EXPLAIN })
  if (!ex) return null
  const rd = await agent(reread(ex, g), { label: `read2-${g}`, phase: 'Reread', schema: READ, effort: 'low' })
  return { g, clarity: rd?.clarity_1_to_5 ?? null, unknown: rd?.words_i_did_not_know?.length ?? null, lost: rd?.sentences_i_could_not_follow?.length ?? null }
}))
return out.filter(Boolean)
