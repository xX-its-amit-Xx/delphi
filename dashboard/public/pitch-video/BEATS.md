# Pitch film — beat sheet

Two minutes, hard budget, hard cuts. The page is a fixed JS timeline, not scroll-driven:
`index.html` plays itself from t=0, `?t=<seconds>` jumps to any moment, and `record.mjs` drives it
through Edge and writes a real `.webm`.

**Total 120.0 s, 14 beats.** The arc is the user's own, in the user's own order; nothing was
reordered and nothing was dropped. Seven of the screens are **live pages screen-recorded in motion**,
not stills.

| # | in | dur | Beat | What is on screen | Real asset |
|---|----|-----|------|-------------------|-----------|
| 1 | 0:00 | 9.0 | **The fire: tacit knowledge** | "Biology design knowledge lives primarily as **TACIT** knowledge." A construction drawing starts, dissolves before it resolves, starts again. Founder slate A sits bottom-left. | type + generative SVG |
| 2 | 0:09 | 8.0 | **The asymmetry** | A Lean proof closes, kernel-checked. The same shape of claim in biology gets a dashed empty box: no check exists. "Agents have no formal way to verify a biological design at any scale. And they are extraordinarily good at mathematics." | — |
| 3 | 0:17 | 10.0 | **The desk** | A desk piled with maths papers. Every one slides off. The maths side counts up what fell; the biology side of the desk stays empty. | `facts.json` |
| 4 | 0:27 | 8.0 | **Nine in ten** | Ten programme bars; nine go dark. "Roughly nine in ten drug programmes that enter clinical trials never reach approval." Both sources on screen, and the unit of analysis called out. Then: return focus to **theoretical biology**. | `facts.json` |
| 5 | 0:35 | 11.0 | **LeanBio Forum** | The deliverable. Upload your own nanopub-backed theorem. Gate 1: it holds up in Lean. Gate 2: it survives agent debate on existing evidence. Both, or neither — then it enters as a biological axiom. | `shots/leanbio-capability.jpg` |
| 6 | 0:46 | 12.0 | **The swarm expands the literature** | The longest beat. The real claim graph blooms out of four seed thinkers: 903 claims, 4,905 nanopub drafts, 16 tests, 57 Lean theorems, with the real 387 links drawing between them and real theorem titles flashing past. | `tree.json`, built from `graph.json` |
| 7 | 0:58 | 6.0 | **Three architectures** | Single / decentralised / centralised, each with its real call pattern and its real per-call budget from `ARMS.md`. **No result is claimed** — the benchmark had not produced one. | `facts.json` |
| 8 | 1:04 | 5.0 | **MCP server one** | 14 personas, 32 use cases, 14 grand questions, 941 records, over the capability map. One of the fourteen questions quoted in full. | `shots/leanbio-capability.jpg` |
| 9 | 1:09 | 9.0 | **Text to organism** | "a fish, with wings" types itself, then cascades down nine layers to the sequence and to developmental time. | **clips** `studio.webm`, `blueprint.webm` |
| 10 | 1:18 | 7.0 | **Wings, more than once** | Bat, insect, flying fish — three independent inventions, with real sourced numbers for each. States on screen that no bird appears and why. | `facts.json` → `physics/flier/spec.json` |
| 11 | 1:25 | 8.0 | **The same solver flies both** | Real flying fish and our winged zebrafish, side by side, both running in the live simulator. The right-hand page marks itself HYPOTHETICAL. | **clips** `sim-ff.webm`, `sim-wz.webm` |
| 12 | 1:33 | 8.0 | **The validation harness** | Closest functional analogue → differences annotated → scored in LeanBio → physics on the mesh, beside the alignment expanding through every scale. | **clips** `gene.webm`, `validate.webm` |
| 13 | 1:41 | 12.0 | **The machine says no** | The validator's own gate text, unedited. Launch 0.67 m/s against 8.64 required. Lifting area 166.37× too small. 22 of 73 requirements assessable, 19 unresolved. Composite score **withheld**, with the reason. "This is not a fish that works. It is a machine that can say no." | `shots/validate-gate.jpg` |
| 14 | 1:53 | 7.0 | **Second server, round trip, close** | Design studio + harness as a second MCP server. Then the round trip: the predicted sequence back into a fresh Design Studio session — is it the phenotype we asked for? Founder slate B. | — |

## The honesty is the pitch

- **Our own headline design fails.** Beat 13 is the longest beat after the swarm bloom and it is
  entirely our design being refused. The gate text is a screenshot of the real page, unedited.
- **No composite score anywhere.** Adding one criterion the design already meets moves the composite
  from 0.4676 ("implausible") to 0.878 ("plausible"). A number that moves like that is not a score,
  and the film says so on screen instead of quietly omitting it.
- **No result claimed for the swarm benchmark.** Beat 7 shows the three architectures and states that
  `swarm/benchmark/runs/` held validation only when this was cut.
- **No bald zero for biology.** Beat 3's biology side of the desk carries no numeral unless
  `deck/FACTS.md` supplies a defensible one. See "Could not source" below.
- **The counters never show a zero.** A counter that has not started yet reads as a dash, because a
  zero on that screen would be a claim.

## Rules this cut obeys

- **No Aves.** No bird file is read by anything in this folder, no bird number appears, and beat 10
  says so on screen. The wing comparison is bat / insect / flying fish, all three of which this
  repository holds real measurements for.
- **No credentials** in any file here or on any captured screen.
- **Legibility at 1080p.** Nothing below 20 px at 1920 wide; body copy 23–34 px, beat headlines
  56–112 px, hero word 200 px.
- **No audio.** The film reads with the sound off.
- `prefers-reduced-motion` on the live page drops every animation and leaves each beat composed at
  rest. The recording runs with motion on.

## Music — the Suno brief

No music was generated: this session has no browser automation, so the film is cut silent and reads
silent. To add a track, generate at **exactly 2:00** and lay it under the video; every cut below is
a place a transient belongs.

> **Suno prompt.** Instrumental, no vocals, no lyrics. Dark cinematic tech-documentary score,
> 2:00 exactly. 120 BPM, 4/4, D minor. Start with a single sustained low synth drone and a sparse
> ticking pulse, almost nothing else, for the first 27 seconds. Add a four-on-the-floor kick and a
> rising arpeggiated synth at 0:27. Bring in low strings and a slow build at 0:46 that keeps rising
> through 1:04. Full intensity — driving percussion, wide pads, urgent ostinato — from 1:09 to 1:40.
> At 1:41 cut almost everything away to one held low note and a slow heartbeat pulse for ten
> seconds. At 1:53 return with one resolved, confident chord progression and let it ring out and
> stop cleanly at 2:00. No sudden silence anywhere except the planned drop at 1:41.

**Cut markers** (seconds from the start; a transient on each): `0.0 · 9.0 · 17.0 · 27.0 · 35.0 ·
46.0 · 58.0 · 64.0 · 69.0 · 78.0 · 85.0 · 93.0 · 101.0 · 113.0`

**Intensity curve**: 0–27 sparse · 27–46 pulse · 46–69 build · 69–101 full · 101–113 drop to almost
nothing (this is the beat where our own design fails) · 113–120 resolve.

## Founder footage

Two slates, both marked PLACEHOLDER in amber on screen with the intended shot written on them:

- **Wideshot A** — beat 1, bottom left. Wide, static, founder alone at a lab bench or whiteboard,
  3–4 s, no dialogue, cool key light to match the grade.
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
| claims distilled | 903 in the graph (880 in `docs/claims.json`; Wolfram 321, Thompson 291, Darwin 247, …) | `graph.json`, `docs/claims.json` |
| nanopub drafts | 4,905 `.trig` files | repository tree, excluding `node_modules` |
| tests / theorems | 16 tests, 57 theorems | `graph.json` → `counts.byType` |
| LeanBio records | 941 | `pipeline/leanbio/out/records.json` |
| capability map | 14 personas · 32 use cases · 14 grand questions · 64 real tools · 278 references | `leanbio/capability.json` → `counts` |
| bat | 9.13 % flight muscle (7.8 % min); 6.5–14.25 N/m² | `physics/flier/spec.json` (Bullen & McKenzie 2004 via PMC10966098; `comparison-data.csv`) |
| insect | 559 W/kg hovering; 7.3–14.7 % efficiency | `physics/flier/spec.json` (PMC12606204) |
| flying fish | AR 10.7; L/D max 4.37 | `physics/flier/spec.json` (Park & Choi 2010) |
| clinical attrition | "roughly nine in ten drug programmes" | cleared wording; BIO/Informa/QLS 2011–2020 and Wong, Siah & Lo 2019 |
| formal library size | see `facts.json` → `maths_side` | `deck/FACTS.md` when it lands |

## Could not source

- **The "700"** suggested for the maths side has no source and is used nowhere in this film.
- **`deck/FACTS.md` did not exist when this was cut.** It is owned by another agent. Two entries in
  `facts.json` are marked `verified:false`-aware and behave safely without it:
  - `maths_side` uses the independently checked mathlib figure (250,000+ machine-checked theorems,
    December 2025 survey figure) relayed by the session coordinator.
  - `biology_side` has **no numeral at all**. The desk's biology side renders an empty dashed slot.
    A bald "0 novel proven biology theorems" is not shipped on this project's own authority, because
    prior formal-methods-in-biology work exists — systems-biology model checking, process calculi
    for biochemistry, formalised phylogenetics — and a flat zero may simply be false. When FACTS.md
    lands, set `biology_side.verified` true and copy its exact permissible wording into
    `biology_side.value` / `.label`. Nothing else changes.
- **The swarm benchmark has no result.** Beat 7 is built to work either way; if results land, set
  `swarm_benchmark.has_results` true and write `result_line` with the metric and the n.

## Files

| File | What it is |
|---|---|
| `index.html` | The self-playing page. `?t=90` jumps to 1:30, `?paused=1` holds, `?rec=1` hides the scrub bar. Space pauses, arrows seek ±5 s, number keys jump to a beat. |
| `facts.json` | Every number and its source. The only place to change a figure. |
| `tree.json` | The literature-tree data, written by `build-tree.mjs` from `graph.json`. |
| `shots/` + `manifest.json` | Stills of the live pages, with the page errors each one reported. |
| `clips/` + `manifest.json` | The live pages screen-recorded in motion, 960×540 VP9, ~2.1 MB in all. |
| `shoot.mjs` | Captures the stills. `node … shoot.mjs [id …]` |
| `clips.mjs` | Screen-records the live pages and re-encodes them small. `node … clips.mjs [id …]` |
| `build-tree.mjs` | Slims `graph.json` into `tree.json`. |
| `record.mjs` | Drives the page in Edge and writes the video to `C:/Temp/pitch-video-out/`. |
| `frames.mjs` | Pulls a frame at every beat time out of the finished video (or `--page`, out of the live page) so the cut can be looked at rather than assumed. |

Nothing in this folder is committed or deployed by any of these scripts.
