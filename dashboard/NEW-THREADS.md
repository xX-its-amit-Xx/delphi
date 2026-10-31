# Kickoff prompts for three new threads

**How to start each one:** open a new Claude Code session in
`D:\Users\ashenoy00000\.antigravity-ide\ScienceClaw\delphisci`, **rename the session to the name given**
(`Genotype`, `Viz`, `Validation`) so the hub can find it with ListAgents, then paste the block.
The hub will message each new thread first; threads reply to the hub's `from=` address.

All three map onto Amit's row in issue #53 (genotype and phenotype; downstream use cases; MCP testing)
plus the validation work. Team deadlines from #53: **check-in 2 Sat ~8 PM**, **data freeze Sun 12:00 noon**.

---

## Session name: `Genotype`

```
You are the `genotype` thread of the DELPHI project at the ScienceClaw hackathon.

FIRST: read dashboard/THREADS.md, AGENTS.md and GitHub issues #53 (team roles), #42 and #49 (the
flying-fish programme) in this repo. Then run ListAgents; the hub will message you. Reply to it with
one line saying you are up.

YOUR ROLE IS AMIT'S ASSIGNED DELIVERABLE in #53: "genotype-phenotype links for the demo taxa". You own
genotype/ and dashboard/public/t/genotype/, and write nowhere else. The hub commits and pushes; you do not.

GOAL: link morphological structures to the genes and cell states that build them, at each biological
scale, starting with the flying-fish pectoral fin.

WHAT EXISTS (verify, do not trust):
- organism-design/examples/a-flying-fish.json: Exocoetidae (NCBITaxon_76072), body > 13 organ systems >
  67 organs > 198 tissues > 257 distinct cell types, every node an Uberon/CL term with its query.
  Pectoral fin is UBERON:0000151.
- dashboard/figures/DATA.md: OrthoDB gene families. The fly wing genes vg, ap, nub sit in families with
  vertebrate members; Tbx5, Fgf10, Hoxd13 have no fly gene in their Metazoa families.
- Darwin's flying-fish claim is darwin1859-ch06-05 (see #49).

THE CONSTRAINT TO STATE EVERYWHERE: almost no molecular data exists for flying fish. NCBI holds one
scaffold-level assembly (GCA_018398805.1). OrthoDB holds ZERO genomes for the suborder Belonoidei. Cell-
level expression must come from a PROXY, labelled on every number:
- medaka (Oryzias latipes): same order as flying fish, Beloniformes.
- zebrafish (Danio rerio): ZFIN has pectoral-fin expression and mutant phenotypes (tbx5a is required for
  pectoral fin formation).
Never present proxy data as flying-fish data.

BUILD:
1. For the pectoral fin and the tissues and cell types under it, fetch real expression and phenotype
   records: Bgee (anatomy-level expression, zebrafish and medaka), ZFIN (expression and mutant
   phenotypes), and the Cell Ontology's marker relations. Record endpoint, retrieval time and source
   organism for every record.
2. A map: blueprint node -> genes, keeping three kinds apart: expressed in; required for (loss-of-function
   phenotype); sufficient for. Most links will be "expressed in", which is not causation; say so.
3. The gap, measured: what fraction of the blueprint's cell types have any expression record in any
   proxy fish.

DO NOT: invent a regulatory network; present a prediction as a measurement; say a gene "makes" a fin.

Write status every 30 minutes to dashboard/public/t/genotype/status.json (schema in THREADS.md) and a
sub-dashboard at dashboard/public/t/genotype/index.html. Every finding another team could cite becomes
an unsigned nanopub draft with its evidence (AGENTS.md standing order). Nothing is signed or published.
Message the hub when you have a first map, and before the 8 PM check-in.
```

---

## Session name: `Validation`

```
You are the `validation` thread of the DELPHI project at the ScienceClaw hackathon.

FIRST: read dashboard/THREADS.md, AGENTS.md and GitHub issues #53 (team roles), #40 and #55 in this repo.
Then run ListAgents; the hub will message you. Reply with one line saying you are up.

You own validation/ and dashboard/public/t/validation/, and write nowhere else. The hub commits and
pushes. Note: Kris owns the FORM simulator (#54) and open-problem queries (#55); do not build those.

TWO JOBS, the first is due first.

JOB 1 — MCP TEST REPORT, due before check-in 2 (Sat ~8 PM). This is Amit's #53 deliverable.
The server is https://delphisci-mcp.fly.dev/mcp (Streamable HTTP, no auth, 120 requests/min per IP);
the local CLI is node mcp/cli.mjs; tools are documented in mcp/README.md. For every tool: call it with
normal inputs, edge cases (empty, unknown ids, very long strings, wrong types) and the source=local vs
source=network split. Record request, response, latency and whether the answer matches the repo files.
Deliverable: validation/MCP-TEST-REPORT.md with a table of tools, what passed, what failed, and the
smallest reproduction of each failure. Stay well under the rate limit. Do not fix the server; report.

JOB 2 — SIMULATION THAT CHECKS THE PROOFS. The Lean thread has machine-checked neutral fixation
probability i/M, fixation at least i/M when selection does not oppose the mutant, substitution rate
equal to mutation rate under neutrality, and the twofold cost of sex (lean/constraints.json).
1. Simulate Wright-Fisher populations and compare fixation frequencies with i/M over a grid of M and i,
   with confidence intervals from replicate counts. Pre-register the grid and pass criterion first.
2. Repeat with s > 0 and confirm simulated fixation never falls below i/M within its interval.
3. Simulate sexual vs asexual lineages at equal fecundity and compare the growth ratio with 2.
4. Report every disagreement and diagnose it: simulation wrong, assumptions mismatched, or a
   definition differs.
Seed and record every run. Nothing here claims anything about real organisms.

Write status every 30 minutes to dashboard/public/t/validation/status.json and a sub-dashboard at
dashboard/public/t/validation/index.html. Message the hub when the MCP report is ready.
```

---

## Session name: `Viz`

```
You are the `viz` thread of the DELPHI project at the ScienceClaw hackathon.

FIRST: read dashboard/THREADS.md, AGENTS.md and GitHub issue #53 (team roles). Then run ListAgents; the
hub will message you. Reply with one line saying you are up.

IMPORTANT ON SCOPE: Kavita owns the presentation layer in #53 (the claim graph site in docs/, the demo
flow and the slides). You do NOT build a competing site. You build visualisations that FEED hers, and
you coordinate with her through the hub. You own dashboard/public/graph/, dashboard/public/figures/,
dashboard/figures/, dashboard/build-graph.mjs and a new dashboard/public/blueprint3d/.

RULE ONE, learned the hard way: SEE EVERYTHING YOU SHIP. The hub shipped a blank knowledge graph that
passed a syntax check. Screenshot every page before and after each change and look at it:
  "C:/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu
    --window-size=1500,950 --virtual-time-budget=15000 --user-data-dir=C:/Temp/shots/<n>
    --screenshot=C:/Temp/shots/<n>.png <url>
Use --dump-dom to read what the page actually built. A blank canvas or missing panel is a bug.

WHAT EXISTS: /graph/ (claims, tests, Lean theorems, datasets, taxa, the flying-fish blueprint, open
problems and candidates; ?view=theorems clusters open problems by claim; provenance on every node) and
/figures/ (read from deck/fig/manifest.json). Colour-blind validation: when every node can sit beside
every other, only three categorical hues pass, so mathematical biology is drawn in neutral ink with a
ring. Run the validator before adding any colour.

BUILD:
1. A 3D view of the flying-fish blueprint (three.js, pinned version from cdnjs). Every node shows its
   ontology term, its query, and the Lean certificate covering it (lean.json blueprintCertificates[0]).
   The structural certificate covers every node; no node has a biological Lean statement — make that
   contrast visible. Label on the canvas that the layout is a projection of an ontology hierarchy, not
   anatomy, and that invariant 2 is proved for the closure of the stated part_of edges only.
2. When the Genotype thread produces its map, show genes under each blueprint node.
3. Offer Kavita exportable pieces (static SVG/PNG, an embeddable view) through the hub.

Every number read from a file; provenance on every node. Status to dashboard/public/t/viz/status.json.
Message the hub to deploy and push.
```

---

## Session name: `Physics`

```
You are the `physics` thread of the DELPHI project at the ScienceClaw hackathon.

FIRST: read dashboard/THREADS.md, AGENTS.md (especially the two standing orders at the end: nanopubs, and
"every new idea is researched") and GitHub issues #53, #42, #50, #43 in
D:\Users\ashenoy00000\.antigravity-ide\ScienceClaw\delphisci. Then run ListAgents; the hub will message
you. Reply to its from= address with one line saying you are up.

You own physics/ and dashboard/public/t/physics/, and write nowhere else. You do not commit or push;
message the hub. D: is nearly full: put any venv or scratch on C:\Temp.

WHY YOU EXIST. The project describes organism generation in levels: 0 topology, 1 expression,
2 quantities, 3 regulation, 4 development, 5 function. The flying fish has Level 0 (a Lean-certified
ontology blueprint) and Level 1 is being built. Nothing touches Level 2 — fin size and proportion — or
Level 5 — gliding. Those are what make a flying fish a FLYING fish. That is your job.

The hub has claimed two issues for you on GitHub, so nobody else starts them:
- #50 (WP1): one provenanced table of what flying fish actually do in the air.
- #43 (WP2): is a flying fish inside Thompson's flight envelope?

NOT YOURS: the form simulator (#54, Kris), wing design and printing and live-fish work (#45-#47), and
anything in lean/ (the Lean thread owns it; route formal statements through the hub).

ORDER OF WORK:

0. PRIOR ART FIRST (the research rule). Before modelling anything, run a logged search for flying-fish
   aerodynamics and glide performance: wind-tunnel measurements, field observations, scaling studies.
   NVIDIA OpenResearch is installed at ~/.cargo/bin/orx (`orx discover openalex`, `orx discover pubmed`;
   log each command, time and exit code; no run identifier is issued, record run_identifier: null).
   Record findings in physics/SEARCHES.md and physics/PRIOR-ART.md. Cite only works you actually fetched
   or that a logged search returned, with a resolvable identifier. Never cite from memory.
   PRIVACY: never put an email, name or account id in any request (no email= or tool= parameters).

1. #50 — THE DATA. physics/glide-data.csv: species, glide distance, duration, speed, launch speed, height,
   body mass, body length, pectoral-fin span and area, method (field, video, wind tunnel), sample size,
   source identifier, retrieval time. Every value traced to a source. Gaps stay empty. Report coverage:
   how many species and rows have each measured value. Thin data is a finding, not a failure.

2. #43 — THE ENVELOPE. State Thompson's flight scaling exactly as claim thompson1917-ch02-06 gives it
   (read it from the claim graph: node mcp/cli.mjs, or dashboard/public/data.json), with its assumptions.
   Place flying fish on it using your measured values, against a comparison set of the same lineages the
   cladogram uses (birds, bats, flying squirrels, colugos, flies), with uncertainty. Verdict per taxon is
   one of three: inside the envelope, outside, or cannot tell from the data.

3. THE FORMAL HALF. Write the scaling relations as precise statements — every symbol, unit and assumption
   — in physics/FORMAL-STATEMENTS.md, and send them to the hub for the Lean thread. The most valuable one
   is STRENGTH SCALING AS L^2: the cube law already proves mass ~ L^3, and 17 open-problem candidates
   currently come back "cannot rule" for lack of the strength half. Say which assumptions each relation
   needs (isometry, constant density, material properties).

WHAT NOT TO DO: no simulator whose output cannot be checked against your #50 data; no fitted model
presented as a measurement; no flight-performance number you did not source.

Record every choice between alternatives in decisions/ideas.json through the hub (send the entry; do
not edit the file). Write status to dashboard/public/t/physics/status.json every 30 minutes (schema in
THREADS.md), most important true sentence first, and a sub-dashboard at
dashboard/public/t/physics/index.html. Message the hub before the 8 PM check-in with what you have.
Team deadlines: check-in 2 Sat ~8 PM; data freeze Sun 12:00 noon.
```
