// Hand-written context. Numbers about claims come from data.json at runtime, not from here.
window.CONTENT = {
  plan: [
    { n: 1, t: "Read the leading thinkers; extract key claims as nanopubs", d: "Darwin, Thompson, Turing, Wolfram, plus Fisher, Kimura, Hamilton, Maynard Smith. Every claim has a verbatim quote.", metric: "claims" },
    { n: 2, t: "Assess which claims modern datasets can resolve", d: "Two assessors from different providers score each claim against a fixed rubric.", metric: "assessed" },
    { n: 3, t: "Resolve each resolvable claim", d: "Pre-register, run on public data, record verdict. Enumerate plausible interpretations, most likely first.", metric: "tests" },
    { n: 4, t: "Record each in Lean (and LeanBio)", d: "Machine-check what follows from the stated assumptions.", metric: "lean" },
    { n: 5, t: "Promote the top claims to theorems", d: "Only claims that survive tests and have a non-stub proof.", metric: "proved" },
    { n: 6, t: "Use them to generate novel evolutionary pathways", d: "A simulator whose rules are the surviving theorems; the base for text-to-organism.", metric: "sim" },
    { n: 7, t: "Curate held-out data to validate the theorems", d: "Held-out phylogenetic or deep mutational scanning data. Frozen first, used last.", metric: "holdout" }
  ],
  backward: [
    "Freeze the exam: pick and checksum the held-out data before building anything (step 7).",
    "State what the simulator must predict on it, and the baseline it must beat (step 6).",
    "Ask which theorems that prediction needs, and demand non-stub Lean proofs of exactly those (steps 5 and 4).",
    "Run pre-registered tests only on the claims those theorems depend on (step 3).",
    "Triage the claims by dataset resolvability, starting with those on that dependency path (step 2).",
    "Extract and publish the claims, plus any missing ones the theorems need (step 1)."
  ],
  risks: [
    { t: "Truth scores are circular", c: "bad", d: "880 claims have AI truth scores; 4 have real tests. Two assessors trained on similar text can agree and both be wrong. Track assessor-vs-test agreement as tests accumulate and never present a truth score as a result." },
    { t: "Irreversible publishing", c: "bad", d: "A nanopub, once published, stays forever. Production publishing signs with a personal ORCID key. Rule: test registry only during the hack, and ask the key owner before any promotion." },
    { t: "Stub or fake artifacts", c: "bad", d: "Lean files with no 'sorry' that prove arithmetic; DOIs that do not resolve; templated provenance. The repo's lint exists for this. A single fabricated identifier costs more credibility than ten missing ones." },
    { t: "Multi-agent without evidence", c: "warn", d: "Collective capability is 25% of the score and asks for a measured comparison. Without a single-agent baseline, the claim of added capability is unsupported." },
    { t: "Hierarchy masquerading as decentralization", c: "warn", d: "Decentralized agency is 20% and asks for agents with distinct information and no central planner prescribing the trajectory. The emperor and king should control structure and prompts, not decisions." },
    { t: "Credentials and credits", c: "warn", d: "Credit links must not be shared or posted, or the sharer is disqualified. Google accounts are capped at 2 per team and auto-delete Sunday night. A self-bot already got a Discord account banned." },
    { t: "Capacity and queues", c: "warn", d: "Sixteen H100s are shared by all teams, with a 30-minute queue limit before jobs fail. Keep one GPU per team and have a CPU fallback." },
    { t: "Reinterpreting the author", c: "warn", d: "Testing a modern version of Thompson's or Darwin's claim and calling it a test of theirs. The claim-test rules require testing the claim as stated and logging any reinterpretation." },
    { t: "Survivorship in the canon", c: "ok", d: "Eight famous thinkers is a biased sample of mathematical biology. Mitigate by recording how each was chosen and adding a field-wide sweep (Hodgkin-Huxley, Kermack-McKendrick, Lotka-Volterra, Price, Wright)." },
    { t: "A proof is not evidence", c: "ok", d: "Lean shows the conclusion follows from assumptions. Whether organisms satisfy them is empirical. The UI keeps the two statuses separate." },
    { t: "Time", c: "bad", d: "Hacking ends Sunday 1:00 PM and the only artifact the site names is final slides. Reserve the last three hours for the single-vs-multi-agent number and the slides." },
    { t: "In-person rule", c: "ok", d: "Every team member must attend in person; remote contributors cannot be counted as members." }
  ],
  analogies: [
    { ch: "Choosing pass and fail thresholds after seeing results", f: "Medicine", h: "Trial registries", d: "Journals began requiring clinical trials to be registered before enrollment in 2005, so outcomes could not be swapped after the fact. Our claim-test rule is the same move." },
    { ch: "Who checks the checker?", f: "Finance", h: "Auditor independence", d: "Audits are only trusted when the auditor is independent of the firm audited, which US law tightened in 2002. The repo's assessor-is-not-builder rule copies it." },
    { ch: "A published result turns out wrong", f: "Law and publishing", h: "Amend, do not erase", d: "Statutes are amended and journals print errata; the old text remains citable. Nanopub supersede and retract works the same way." },
    { ch: "Models that can only be tested on data they have seen", f: "Protein science", h: "Blind prediction (CASP)", d: "The CASP competition, running since 1994, asks groups to predict structures that are not yet public. That held-out discipline is widely credited with the field's progress, including AlphaFold. Our lineage-split holdout is the biological version." },
    { ch: "Is the proof even about the right statement?", f: "Mathematics", h: "Formalizing doubted proofs", d: "The Liquid Tensor Experiment formalized a hard 2020 theorem in Lean to settle doubt about its correctness. Formal checking can bring trust to results people hesitate to believe." },
    { ch: "One claim, several meanings", f: "Population genetics", h: "Fisher's theorem reread", d: "Fisher's fundamental theorem was long misread. Price's 1972 paper clarified the partial-change reading in which it holds. Enumerating readings up front, as you propose, would have saved decades." },
    { ch: "Does an elegant pattern model prove the mechanism?", f: "Developmental biology", h: "Digits as a Turing system", d: "A 2014 study showed mouse digit patterning is consistent with a Turing-type system using specific signals. It took a specific gene perturbation, not a pretty simulation, to make the case." },
    { ch: "Different species, same module", f: "Developmental genetics", h: "Pax6 eye switch", d: "Mouse Pax6 can induce ectopic eyes in fruit flies (1995). Evidence that deep modules are shared is what makes chimeric design a research question." },
    { ch: "Generating without a single planner", f: "Economics", h: "Prices as signals", d: "Markets coordinate people with distinct information without a central planner. The analogue for agents is a cheap shared signal, here the nanopub registry and the claim graph, rather than orders." },
    { ch: "Provenance of every number", f: "Manufacturing", h: "Traceability", d: "Parts are tracked from raw material to product. Every number in a claim test traces to a file with a download URL, time, size and SHA-256." }
  ],
  recs: [
    { r: "Run the single-agent vs. swarm comparison on a real task", w: "Collective Capability (25%) + Execution (10%)", f: "Two systems race on the same 20 claims and you get a number. Even a modest win is a result; a loss is an honest finding.", how: "Fix the task, the rubric (verified dataset rate, fabricated-identifier rate = 0, minutes), and log both runs." },
    { r: "Resolve more claims with pre-registered tests, starting with proved math laws", w: "Scientific/Technical Impact (25%)", f: "Every verdict is a small discovery. So far 2 of 4 tests refuted a classic claim.", how: "Prefer claims whose rubric scores are high on testability and whose dataset the assessors named." },
    { r: "Make the held-out set first, then publish its checksums", w: "Execution + Impact", f: "You get to say 'we froze the exam before we built the student'.", how: "One page, a table of dataset, URL, size, SHA-256, split rule. No agent may read the test side." },
    { r: "Formalize one cheap theorem end to end, in Lean, with no stub", w: "Impact + Execution", f: "The moment a green check appears for a law of biology.", how: "Pick an algebraic one such as neutral substitution rate equals mutation rate; state the assumptions in the file header." },
    { r: "Smoke-test one BioNeMo model as a claim-checker", w: "Platform fit; Collective Capability", f: "Call ESMFold or Boltz-2 on one real sequence and attach the result to a claim as a nanopub.", how: "Hosted ESMFold needs no GPU. Record model version and confidence in provenance." },
    { r: "Offer the MCP server and this dashboard to other teams", w: "Collaboration bonus (up to +10)", f: "Other teams' agents using ours.", how: "Post the endpoint in the event channel with a two-line quickstart." },
    { r: "Add an interpretations list to claims", w: "Impact (rigor)", f: "A claim that explains how it could be wrong.", how: "Start with Fisher's theorem, then the 16 proved claims." },
    { r: "Keep this dashboard the shared source of truth", w: "Execution", f: "One URL the whole team opens.", how: "Rebuild with node dashboard/build.mjs after every merge; agents add facts to data, not prose." }
  ],
  sources: [
    { f: "Hackathon rubric, weights, prizes, schedule, judges", s: "https://scienceclawhack.ai/", v: "read today" },
    { f: "Compute and credit offers", s: "Organizers' PDF 'ScienceClaw Compute' (Drive link supplied by the team)", v: "read today, 5 image-only pages unread" },
    { f: "Claims, status, truth scores", s: "docs/claims.json in github.com/fractastical/delphi (graph built 2026-10-31 03:41)", v: "computed" },
    { f: "Claim-test results", s: "claim-tests/*/result.json in the same repo", v: "computed" },
    { f: "Team roster and ideas", s: "Message from the team lead in this session", v: "anecdote" },
    { f: "Agent proposal and harness critique", s: "Issue #17 in github.com/fractastical/delphi", v: "read today" },
    { f: "BioNeMo model list", s: "Issue #14 in github.com/fractastical/delphi", v: "read today, not smoke-tested" },
    { f: "MCP server availability", s: "https://delphisci-mcp.fly.dev/mcp", v: "probed today: initialize and tools/list answered" },
    { f: "Pax6, CASP, Liquid Tensor, trial registration, Rule 110", s: "Background knowledge of the author", v: "not re-verified this session; check before citing externally" },
    { f: "Dataset sources for the holdout (ProteinGym, MaveDB, Open Tree of Life, TimeTree, GBIF)", s: "Background knowledge", v: "not downloaded or checked" }
  ]
};
