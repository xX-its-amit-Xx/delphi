export const meta = {
  name: 'delphi-verify-explain',
  description: 'Re-check every key claim from the 77-agent fleet with independent verifiers, write plain-language explainers from the verified claims, and test each explainer on a reader who sees nothing else',
  phases: [
    { title: 'Verify', detail: 'one skeptic per agent re-fetches its key claims' },
    { title: 'Explain', detail: 'one writer per group, using only claims that held up' },
    { title: 'Read', detail: 'a no-context reader tries to follow each explainer' },
  ],
}

const A = 'D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/tracks/research/agents'
const OUT = 'D:/Users/ashenoy00000/delphi-work/agents3'

const HOLD = 'This project has a frozen holdout. Do not read, use, cite or mention [held-out clade], [held-out clade] species, feathers, beaks, or [held-out clade] flight or anatomy anywhere, even where it looks relevant. If a source is about them, skip it and say only "excluded by the holdout rule".'
const COMMON = `RULES
1. Do NOT write your result to a file. Return it through the structured output only. Scratch files go under ${OUT}/scratch/<your label>/ on D:.
2. Read-only on every repository. Never edit the agent files under ${A}.
3. Before any heavy local command check free RAM and disk; this machine is shared and C: is nearly full. Stop and report rather than push the machine below 10 percent free.
4. ${HOLD}
5. Never enter credentials, sign in, or send personal details anywhere. Fetch public pages only.`

const GROUPS = {
  'bm-science': ['bilayer-theory-verified','diffusion-kinetics','hydrogels','biopolymer-films','wood-cellulose-hygromorphs','mycelium-living-materials','polyamide-sls','natural-benchmarks','lean-materials-laws','category-theory-papers','buehler-materials-corpus','competing-approaches','bioinspired-generative-design','lay-analogies','simulation-fem'].map(x => 'bm-' + x),
  'bm-making': ['4d-printing-review','formlabs-all-resins','formlabs-printing-workflows','resin-water-uptake-data','testing-metrology','poc-designs','open-hardware-repro'].map(x => 'bm-' + x),
  'bm-contract': ['architecture-gaps','building-physics-standards','clients-and-market','funding-materials','ip-landscape-deep','mamou-mani-portfolio','passive-facades-evidence','safety-lca'].map(x => 'bm-' + x),
  'track-1': ['t1-reporter-alt','t1-reporter-crit','t1-reporter-data','t1-reporter-deep','t1-reporter-law','t1-reporter-lay'],
  'track-2': ['t2-patterns-alt','t2-patterns-crit','t2-patterns-data','t2-patterns-deep','t2-patterns-law','t2-patterns-lay'],
  'track-3': ['t3-lumen-alt','t3-lumen-crit','t3-lumen-data','t3-lumen-deep','t3-lumen-law','t3-lumen-lay'],
  'track-4': ['t4-glide-alt','t4-glide-crit','t4-glide-data','t4-glide-deep','t4-glide-law','t4-glide-lay'],
  'track-6': ['t6-flyingfish-alt','t6-flyingfish-crit','t6-flyingfish-data','t6-flyingfish-deep','t6-flyingfish-law','t6-flyingfish-lay'],
  'leanbio-enhancers': ['q1-critic','q1-data','q1-literature','q1-mechanisms','q1-theory-lean'],
  'leanbio-binding': ['q2-critic','q2-data','q2-literature','q2-physics','q2-theory-lean'],
  'people-funding': ['pp-broad-fish-biologists','pp-clients-and-contracts','pp-fish-biomechanics-morphology','pp-funding-bioelectricity-organism-design','pp-funding-computational-biology','pp-meeting-notes-decoder','pp-sentry-agent-platform'],
}

const VERDICT = { type: 'object', properties: {
  label: { type: 'string' },
  claims: { type: 'array', items: { type: 'object', properties: {
    claim: { type: 'string' },
    verdict: { type: 'string', enum: ['supported', 'partly', 'not_supported', 'contradicted', 'could_not_fetch', 'not_checkable'] },
    source_says: { type: 'string' },
    note: { type: 'string' },
  }, required: ['claim', 'verdict', 'source_says', 'note'] } },
  overall: { type: 'string' },
}, required: ['label', 'claims', 'overall'] }

const EXPLAIN = { type: 'object', properties: {
  label: { type: 'string' },
  one_line: { type: 'string' },
  what: { type: 'string' },
  why: { type: 'string' },
  steps: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, picture: { type: 'string' } }, required: ['text'] } },
  wrong_if: { type: 'string' },
  could_go_wrong: { type: 'array', items: { type: 'string' } },
  questions: { type: 'array', items: { type: 'object', properties: { q: { type: 'string' }, a: { type: 'string' } }, required: ['q', 'a'] } },
  glossary: { type: 'array', items: { type: 'object', properties: { term: { type: 'string' }, plain: { type: 'string' } }, required: ['term', 'plain'] } },
  check_yourself: { type: 'array', items: { type: 'object', properties: { what: { type: 'string' }, command: { type: 'string' }, expect: { type: 'string' } }, required: ['what', 'command'] } },
  sources: { type: 'array', items: { type: 'object', properties: { cite: { type: 'string' }, id: { type: 'string' } }, required: ['cite'] } },
  left_out: { type: 'array', items: { type: 'string' } },
}, required: ['label', 'one_line', 'what', 'why', 'steps', 'wrong_if', 'could_go_wrong', 'questions', 'glossary', 'check_yourself', 'sources', 'left_out'] }

const READ = { type: 'object', properties: {
  label: { type: 'string' },
  in_my_words: { type: 'string' },
  how_in_my_words: { type: 'string' },
  test_questions: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, my_answer: { type: 'string' }, answerable_from_text: { type: 'boolean' } }, required: ['question', 'my_answer', 'answerable_from_text'] } },
  words_i_did_not_know: { type: 'array', items: { type: 'string' } },
  sentences_i_could_not_follow: { type: 'array', items: { type: 'string' } },
  clarity_1_to_5: { type: 'integer' },
  what_would_help: { type: 'string' },
}, required: ['label', 'in_my_words', 'how_in_my_words', 'test_questions', 'words_i_did_not_know', 'sentences_i_could_not_follow', 'clarity_1_to_5', 'what_would_help'] }

const verifyPrompt = (slug) => `You are a skeptical verifier. Another agent wrote ${A}/${slug}.json. Read its "key_claims" (and only those). For each one, check it yourself against the original source, not against the agent's quote.

For each claim: open the source it names (a URL, or resolve the DOI at https://doi.org/<doi> or https://api.crossref.org/works/<doi>, or an arXiv page). Find the passage that bears on the claim. Then decide:
 supported: the source says this, or the arithmetic in the claim reproduces.
 partly: the source says part of it, or says it with a different number, scope or condition (say which).
 not_supported: the source does not say it, or you read the source and find nothing about it.
 contradicted: the source says something incompatible.
 could_not_fetch: you tried at least twice (different route if possible) and the source would not open.
 not_checkable: the claim is a judgment or a plan, not a statement a source could support.
If the source is a local file or script, read it; re-run it only if it takes under a minute, and compare the output. If a claim cites a Lean file, do not re-run Lean (the project does that separately); check that the statement in plain words matches the theorem as written.
"source_says": copy what the source actually says, verbatim, at most 40 words (empty if you could not fetch). "note": one sentence, plain. Default to not_supported when unsure; a generous verifier is worse than useless.
${COMMON}
Your label is verify-${slug}.`

const explainPrompt = (g, slugs, verdictsByAgent) => `You are writing for someone with NO science background: a curious person who has never taken a biology, chemistry or maths class beyond school. Group: ${g}. The research for this group was done by these agents; their reports are at ${A}/<name>.json:
${slugs.join(', ')}

A second set of verifiers re-checked each agent's key claims. Their verdicts follow. USE ONLY claims whose verdict is supported or partly (say "partly" honestly where it matters). A claim that is not_supported, contradicted or could_not_fetch must NOT appear as a fact; list it in "left_out" with one line why.
${JSON.stringify(verdictsByAgent)}

Read the agents' reports (summary, lay_summary, findings, table, recommendations, reproduce, could_not_find) and write the explainer. It will appear on a web page as dropdown sections, so each part must stand on its own.
Fields:
 one_line: one sentence, what we are doing and why, under 25 words.
 what: 4 to 8 short sentences. What is being made or tested.
 why: 3 to 6 short sentences. Why anyone should care. No hype.
 steps: 5 to 10 steps of how it is done, each 1 to 2 short sentences; "picture" is a concrete everyday comparison for that step.
 wrong_if: what result would show we are wrong. Say it as a plain bet written down before looking.
 could_go_wrong: 4 to 8 honest risks, one sentence each.
 questions: 5 to 8 questions a smart outsider would ask, with short answers. Include "How do you know?" and "What have you not checked?".
 glossary: EVERY technical word you used anywhere above, in plain words, one sentence. If you can avoid a word, avoid it instead.
 check_yourself: 3 to 6 things a reader can check: a link to open, or a command from the agents' "reproduce" lists, with what they should see. Only use commands and links that appear in the agents' reports.
 sources: the 6 to 15 most important sources, as a citation plus its DOI/URL.
 left_out: see above.
STYLE RULES, measured afterwards by a script: average sentence under 16 words, nothing longer than 30; mostly words of one or two syllables; target reading grade 8 or lower; no abbreviation unless the glossary explains it; numbers come with their unit and a comparison ("about the width of a hair"). Say "we do not know" where it is true. Do not invent any fact, number or source that is not in the agents' reports.
${COMMON}
Your label is explain-${g}.`

const readPrompt = (g, explain) => `You are a curious adult with no science training. You have never seen this project. Below is a short explanation page written for people like you. You have NO other information, so do not look anything up, do not open files, do not use tools. Work only from the text.

TEXT:
${JSON.stringify(explain, null, 1)}

Do this honestly:
1. in_my_words: say in 2 or 3 sentences what the project is, as if telling a friend.
2. how_in_my_words: say in 3 to 5 sentences how they do it.
3. test_questions: write 5 questions that someone who really understood the text could answer, answer each from the text only, and mark answerable_from_text false if the text does not let you answer it.
4. words_i_did_not_know: every word you did not understand or only half understood, even if the glossary covers it.
5. sentences_i_could_not_follow: copy any sentence you had to read twice or could not follow.
6. clarity_1_to_5: 1 = lost, 5 = I could explain it to someone else.
7. what_would_help: one or two sentences.
Do not be polite. If you were lost, say so.
Your label is read-${g}.`

phase('Verify')
const results = await parallel(Object.entries(GROUPS).map(([g, slugs]) => async () => {
  const verdicts = (await parallel(slugs.map(s => () =>
    agent(verifyPrompt(s), { label: `verify-${s}`, phase: 'Verify', schema: VERDICT, effort: 'low' })))).filter(Boolean)
  log(`${g}: ${verdicts.length}/${slugs.length} verifiers returned`)
  const compact = verdicts.map(v => ({ agent: v.label, claims: v.claims.map(c => ({ claim: c.claim, verdict: c.verdict, note: c.note })) }))
  const ex = await agent(explainPrompt(g, slugs, compact), { label: `explain-${g}`, phase: 'Explain', schema: EXPLAIN })
  if (!ex) return { g, verdicts, explain: null, read: null }
  const rd = await agent(readPrompt(g, ex), { label: `read-${g}`, phase: 'Read', schema: READ, effort: 'low' })
  return { g, verdicts, explain: ex, read: rd }
}))
const ok = results.filter(Boolean)
const tally = {}
for (const r of ok) for (const v of r.verdicts) for (const c of v.claims) tally[c.verdict] = (tally[c.verdict] ?? 0) + 1
return { groups: ok.length, explained: ok.filter(r => r.explain).length, read: ok.filter(r => r.read).length, verdict_tally: tally,
  clarity: ok.map(r => ({ g: r.g, clarity: r.read?.clarity_1_to_5 ?? null })) }
