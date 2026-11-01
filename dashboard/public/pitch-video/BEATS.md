# Pitch film — beat sheet

Two minutes, hard budget, hard cuts, cold open. The page is a fixed JS timeline, not scroll-driven:
`index.html` plays itself from t=0, `?t=<seconds>` jumps to any moment, and `record.mjs` drives it
through Edge and writes a real `.webm`.

**Total 120.0 s, 15 beats.** It opens on motion and consequence — a real design failing in a real
simulator — and holds the title until after that lands. The arc after the cold open is the user's
own, in the user's own order; nothing was reordered and nothing was dropped. **Ten of the fifteen
beats carry live pages, seven of them screen-recorded in motion rather than shown as stills.**

## The four deliverables

A corner marker names which deliverable the film is inside at any moment, and the close names all
four together.

| # | Deliverable | Beats |
|---|---|---|
| 1 | **LeanBio Forum**, and the framework for adding to it — nanopub-backed submission, Lean, agent debate on existing evidence, then it enters as an axiom or it does not | 5, 6, 7 |
| 2 | **MCP · API · CLI**, built around personas, use cases and the big questions | 8 |
| 3 | **Design Studio (MorphoSwarm)** — named as in development, because it is | 9, 10 |
| 4 | **Validation harness** — the part that says no | 11, 12, 13 |

## The cut

| # | in | dur | Beat | What is on screen | Real asset |
|---|----|-----|------|-------------------|-----------|
| 0 | 0:00 | 5.0 | **COLD OPEN** | No title. Three full-bleed live pages, hard-cut: our winged zebrafish failing to leave the water (`launch 0.67 m/s · required 8.64`, then **FAIL** stamped in red), the gene alignment (`74 loci differ · 1 reproduced`), the organism opened (`13 systems · 67 organs · 257 cell types`). | **clips** `cold-sim`, `cold-gene`, `cold-blueprint` |
| 1 | 0:05 | 8.0 | **The fire: tacit knowledge** | Only now the title. "Biology design knowledge lives primarily as **TACIT** knowledge." A construction drawing starts and dissolves before it resolves. Founder slate A. | type + generative SVG |
| 2 | 0:13 | 7.0 | **The asymmetry** | A Lean proof closes, kernel-checked. The same shape of claim in biology gets a dashed empty box: no check exists. | — |
| 3 | 0:20 | 10.0 | **The desk** | A desk piled with maths papers. Every one slides off. The maths side counts what fell; the biology side stays empty. | `facts.json` |
| 4 | 0:30 | 7.0 | **Nine in ten** | Ten programme bars; nine go dark. Both sources on screen, the unit of analysis called out. Then: return focus to **theoretical biology**. | `facts.json` |
| 5 | 0:37 | 11.0 | **LeanBio Forum** | Deliverable 1. Upload your own nanopub-backed theorem. Gate 1: Lean. Gate 2: agent debate on existing evidence. Both, or neither — then it enters as a biological axiom. | `shots/leanbio-capability.jpg` |
| 6 | 0:48 | 12.0 | **The swarm expands the literature** | The longest beat. The real claim graph blooms out of four seed thinkers: 903 claims, 4,905 nanopub drafts, 16 tests, 57 Lean theorems, the real 387 links drawing between them, real theorem titles flashing past. | `tree.json`, built from `graph.json` |
| 7 | 1:00 | 5.0 | **Three architectures** | Single / decentralised / centralised, each with its real call pattern and its real per-call budget from `ARMS.md`. On screen: "Pre-registered before the first call. 3 architectures × 4 stages × 3 tasks, every run logged. At n = 3 we claim no winner." | `facts.json` |
| 8 | 1:05 | 5.0 | **MCP · API · CLI** | Deliverable 2. The counts, then a **real call with a real answer**: `node mcp/cli.mjs check …` returning `cannot-evaluate` and naming exactly what it is missing. "Thirty-five laws. It would not guess at one of them." | `cli-transcript.txt` |
| 9 | 1:10 | 9.0 | **Text to organism** | Deliverable 3. "a fish, with wings" types itself into Design Studio (MorphoSwarm), marked **in development**, then cascades down nine layers to sequence and developmental time. | **clips** `studio`, `blueprint` |
| 10 | 1:19 | 7.0 | **Wings, more than once** | Bat, insect, flying fish — three independent inventions, with real sourced numbers for each. States on screen that no bird appears, and why. | `facts.json` → `physics/flier/spec.json` |
| 11 | 1:26 | 8.0 | **The same solver flies both** | Deliverable 4. The real flying fish and our winged zebrafish, side by side, both running in the live simulator. The right-hand page marks itself HYPOTHETICAL. | **clips** `sim-ff`, `sim-wz` |
| 12 | 1:34 | 7.0 | **The validation harness** | Closest functional analogue → differences annotated → scored in LeanBio → physics on the mesh, beside the alignment expanding through every scale. | **clips** `gene`, `validate` |
| 13 | 1:41 | 12.0 | **The machine says no** | The validator's own gate text, unedited. 0.67 m/s against 8.64 required. Lifting area 166.37× too small. 22 of 73 requirements assessable, 19 unresolved. Composite **withheld**, with the numbers that prove why. "This is not a fish that works. It is a machine that can say no." | `shots/validate-gate.jpg` |
| 14 | 1:53 | 7.0 | **Round trip, and the four** | Design studio + harness as a second MCP server. The round trip: the predicted sequence back into a fresh session — is it the phenotype we asked for? The close names all four deliverables. Founder slate B. | — |

## Which beats move and which are still

- **Moving, live screen recordings:** 0 (three of them, full-bleed), 9 (two), 11 (two, side by
  side), 12 (two).
- **Moving, generated:** 1 (the drawing that never resolves), 3 (48 papers falling off the desk),
  4 (nine programmes going out), 6 (the whole literature bloom, drawn frame by frame from the real
  graph), 7 (the agents and their message lines).
- **Still:** 2, 5, 8, 10, 13, 14 — each is type, data, or one screenshot that has to be *read*
  rather than watched. Beat 13 is deliberately still, because the gate text is the thing being read.

## The honesty is the pitch

- **Our own headline design fails, twice.** It fails in the cold open before the film has said a
  word, and beat 13 is the longest beat after the swarm bloom and is entirely our design being
  refused. The gate text is the real page, unedited.
- **No composite score anywhere.** Adding one criterion the design already meets moves the composite
  from 0.4676 ("implausible") to 0.878 ("plausible"). A number that moves like that is not a score,
  and the film says so on screen with both numbers legible instead of quietly omitting it.
- **A real refusal from a real tool.** Beat 8 is an actual CLI call whose actual answer is
  "cannot-evaluate", listing the four inputs it would need. The system declining to guess is the
  point.
- **A comparison announced, and a winner refused.** All 36 benchmark cells (3 arms × 4 stages ×
  3 tasks) ran, every call logged with its prompt, raw output, tokens, cost and stop reason. Beat 7
  says so and then says "at n = 3 we claim no winner", because n = 3 cannot support a significance
  claim either way. One preliminary per-arm finding exists and is deliberately **not** in the film:
  a post-hoc run is still testing whether it reflects the architecture or the budget allocation, and
  the answer changes what it would mean. Announcing the comparison and refusing the verdict is the
  same move as withholding the composite score.
- **No bald zero for biology.** Beat 3's biology side of the desk carries no numeral unless
  `deck/FACTS.md` supplies a defensible one.
- **The counters never show a zero.** A counter that has not started yet reads as a dash, because a
  zero on that screen would be a claim.

## Rules this cut obeys

- **No Aves.** No bird file is read by anything in this folder, no bird number appears, and beat 10
  says so on screen. The wing comparison is bat / insect / flying fish, all three of which this
  repository holds real measurements for. `holdout/check-leaks.mjs` attributes nothing to
  `pitch-video/`.
- **No credentials** in any file here or on any captured screen.
- **Legibility at 1080p.** Nothing below 20 px at 1920 wide; body copy 23–34 px, beat headlines
  56–112 px, cold-open strikes 96 px, the FAIL stamp 168 px.
- **No audio.** The film reads with the sound off.
- `prefers-reduced-motion` on the live page drops every animation and leaves each beat composed at
  rest. The recording runs with motion on.

## Music — the Suno brief

No music was generated: this session has no browser automation, so the film is cut silent and reads
silent. To add a track, generate at **exactly 2:00** and lay it under the video; every cut below is
a place a transient belongs.

> **Suno prompt.** Instrumental, no vocals, no lyrics. Dark cinematic tech-documentary score,
> 2:00 exactly. 120 BPM, 4/4, D minor. Open HARD: a single impact hit at 0:00 with a low sub drop,
> then an urgent ticking pulse under the first five seconds. At 0:05 pull almost everything away to
> one sustained low drone and sparse ticks. Add a four-on-the-floor kick and a rising arpeggiated
> synth at 0:30. Bring in low strings and a slow build at 0:48 that keeps rising through 1:05. Full
> intensity — driving percussion, wide pads, urgent ostinato — from 1:10 to 1:40. At 1:41 cut almost
> everything away to one held low note and a slow heartbeat pulse for twelve seconds. At 1:53 return
> with one resolved, confident chord progression; let it ring out and stop cleanly at 2:00.

**Cut markers** (seconds from the start; a transient on each): `0.0 · 5.0 · 13.0 · 20.0 · 30.0 ·
37.0 · 48.0 · 60.0 · 65.0 · 70.0 · 79.0 · 86.0 · 94.0 · 101.0 · 113.0`

**Intensity curve**: 0–5 hard open · 5–30 sparse · 30–48 pulse · 48–70 build · 70–101 full ·
101–113 drop to almost nothing (this is the beat where our own design fails) · 113–120 resolve.

## Founder footage

Two slates, both marked PLACEHOLDER in amber on screen with the intended shot written on them:

- **Wideshot A** — beat 1 (after the cold open), bottom left. Wide, static, founder alone at a lab
  bench or whiteboard, 3–4 s, no dialogue, cool key light to match the grade.
- **Wideshot B** — beat 14, right column. Founder to camera, medium, 3–4 s, delivering the closing line.

Replace the `.slate` element in `index.html` with a `<video>` or `<img>`. **The edit length does not
change**, because both slates live inside existing frames rather than taking time of their own.

## The one naming note

The repository is still labelled **DELPHI** on every page, so DELPHI appears in the captured screens
and clips. The film presents the system as **LeanBio Forum** and says on screen in beat 5 that the
screens have not caught up, rather than hiding it.

## Numbers and where each one comes from

Every figure on screen is read at run time from `facts.json` or `tree.json`; none is typed into the
markup. Each entry in `facts.json` names its source file.

| On screen | Value | Source |
|---|---|---|
| launch speed vs v_min | 0.67 m/s vs 8.64 m/s | `validate-show/run-winged-zebrafish.json` → `gate` |
| lifting area shortfall | 166.37× (1.91 cm² against 317.76 cm²) | same file, `limiting_factor` |
| draws | glided in 0.0 % of 200 draws | same file, `gate` |
| functional resolution | 22 of 73 assessable, 19 of 22 unresolved | same file → `functional_resolution.result` |
| composite values withheld | 0.4676 → 0.878 | the project's own scorer, confirmed 2026-11-01 |
| gene-diff cold open | 74 loci differ, 1 reproduced | `gene-diff/data.json`, shown as the live page |
| anatomy cold open | 13 systems · 67 organs · 257 cell types | `blueprint3d/`, shown as the live page |
| CLI answer | lawset 1.8.1 · 18 out-of-scope · 17 cannot-evaluate | `cli-transcript.txt`, a real run |
| claims distilled | 903 in the graph (880 in `docs/claims.json`; Wolfram 321, Thompson 291, Darwin 247, …) | `graph.json`, `docs/claims.json` |
| nanopub drafts | 4,905 `.trig` files | repository tree, excluding `node_modules` |
| tests / theorems | 16 tests, 57 theorems | `graph.json` → `counts.byType` |
| LeanBio records | 941 | `pipeline/leanbio/out/records.json` |
| capability map | 14 personas · 32 use cases · 14 grand questions · 64 real tools | `leanbio/capability.json` → `counts` |
| bat | 9.13 % flight muscle (7.8 % min); 6.5–14.25 N/m² | `physics/flier/spec.json` (Bullen & McKenzie 2004 via PMC10966098; `comparison-data.csv`) |
| insect | 559 W/kg hovering; 7.3–14.7 % efficiency | `physics/flier/spec.json` (PMC12606204) |
| flying fish | AR 10.7; L/D max 4.37 | `physics/flier/spec.json` (Park & Choi 2010) |
| clinical attrition | "roughly nine in ten drug programmes" | cleared wording; BIO/Informa/QLS 2011–2020 and Wong, Siah & Lo 2019 |
| formal library size | see `facts.json` → `maths_side` | `deck/FACTS.md` when it lands |

## Could not source

- **The "700"** suggested for the maths side has no source and is used nowhere in this film.
- **`deck/FACTS.md` did not exist when this was cut.** It is owned by another agent. Two entries in
  `facts.json` behave safely without it:
  - `maths_side` uses the independently checked mathlib figure (250,000+ machine-checked theorems,
    December 2025 survey figure) relayed by the session coordinator.
  - `biology_side` has **no numeral at all**. The desk's biology side renders an empty dashed slot.
    A bald "0 novel proven biology theorems" is not shipped on this project's own authority, because
    prior formal-methods-in-biology work exists — systems-biology model checking, process calculi
    for biochemistry, formalised phylogenetics — and a flat zero may simply be false. When FACTS.md
    lands, set `biology_side.verified` true and copy its exact permissible wording into
    `biology_side.value` / `.label`. Nothing else changes.
- **The swarm benchmark had no graded result.** All 36 cells had executed and every call was logged,
  but grading was still in flight and no `RESULTS.md` existed when this was cut. Beat 7 therefore
  announces the comparison and refuses the verdict. If graded results land, set
  `swarm_benchmark.has_results` true and write `result_line` with the metric, the direction and the
  n; the beat switches on that flag alone. Do not write a winner this file has not read.
- **No music.** This session cannot reach Suno. The prompt and the cue list are above.

## Files

| File | What it is |
|---|---|
| `index.html` | The self-playing page. `?t=90` jumps to 1:30, `?paused=1` holds, `?rec=1` hides the scrub bar. Space pauses, arrows seek ±5 s, number keys jump to a beat. |
| `facts.json` | Every number and its source. The only place to change a figure. |
| `tree.json` | The literature-tree data, written by `build-tree.mjs` from `graph.json`. |
| `cli-transcript.txt` | The real CLI call and its real answer, as shown in beat 8. |
| `shots/` + `manifest.json` | Stills of the live pages, with the page errors each one reported. |
| `clips/` + `manifest.json` | The live pages screen-recorded in motion. Seven at 960×540 plus three cropped 1280×720 re-encodes for the full-bleed cold open; about 4.6 MB in all. |
| `shoot.mjs` | Captures the stills. `node … shoot.mjs [id …]` |
| `clips.mjs` | Screen-records the live pages and re-encodes them small. `node … clips.mjs [id …]` |
| `build-tree.mjs` | Slims `graph.json` into `tree.json`. |
| `record.mjs` | Drives the page in Edge and writes the video to `C:/Temp/pitch-video-out/`. |
| `frames.mjs` | Pulls a frame at every beat time out of the finished video, or out of the live page with `--page`, so the cut can be looked at rather than assumed. |

Nothing in this folder is committed or deployed by any of these scripts.
