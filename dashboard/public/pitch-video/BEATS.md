# Pitch video — beat sheet

Two minutes, hard budget. The page is a fixed JS timeline, not scroll-driven: `index.html` plays
itself from t=0 and `?t=<seconds>` jumps to any beat. `record.mjs` drives it through Playwright and
writes a real `.webm`.

Total **120.0 s**. Every beat below is `start → end (duration)`. The beats are the user's own arc,
in the user's own order; nothing was reordered and nothing was dropped.

| # | t | dur | Beat | What is on screen | Real asset |
|---|---|-----|------|-------------------|-----------|
| 1 | 0:00 | 10.0 | **The fire: tacit knowledge** | "Biology design knowledge lives primarily as **tacit** knowledge." Lines of a drawing start and dissolve before they resolve — the thing experts know and cannot write down. | — (type + generative SVG) |
| 2 | 0:10 | 9.0 | **No way to verify** | Split screen. Left: a Lean proof closes, kernel-checked. Right: the same shape of claim in biology, with no verdict available. "Agents have no formal way to verify a biological design at any scale — the way they do with mathematics. And they are extraordinarily good at mathematics." | Lean goal/QED block styled from `/t/lean/` |
| 3 | 0:19 | 12.0 | **The desk** | A desk piled with maths papers. Every one of them slides off. What is left on the maths side is the formal-library count; the biology side of the desk is empty. | numbers from `facts.json` ← `deck/FACTS.md` |
| 4 | 0:31 | 10.0 | **Nine in ten** | Ten programme bars; nine go out. "Roughly nine in ten drug programmes that enter clinical trials never reach approval." Then: return focus to **theoretical** biology, and design experiments strategically. | `facts.json` (sources on screen) |
| 5 | 0:41 | 13.0 | **LeanBio Forum** | The deliverable. Users upload their own nanopub-backed theorems. A theorem enters as a **biological axiom** only if it holds up in Lean **and** survives agent debate on existing evidence. Two gates, both hard. Carries the project's own honest line about what Lean does and does not settle. | `shots/leanbio-capability.jpg`, `shots/leanbio.jpg` |
| 6 | 0:54 | 10.0 | **Where the theorems came from** | Darwin, Thompson, Wolfram, Turing — primary, secondary and tertiary claims. Decentralised agent swarms distilled assertions into nanopubs and debated the evidence **before** anything was formalised. | `shots/swarm-board.jpg`, `shots/graph.jpg` |
| 7 | 1:04 | 6.0 | **Served as an MCP server** | Personas, use cases, the big biological questions, custom endpoints. | `shots/leanbio-capability.jpg` |
| 8 | 1:10 | 11.0 | **Text to organism** | "a fish, with wings." The theorems constrain the model: a phenotypic or morphological change on a base organism, mapped down to the genetic changes needed to support it at every layer of biology, and developmentally. | `shots/studio.jpg`, `shots/blueprint3d.jpg` |
| 9 | 1:21 | 8.0 | **Stress-test** | Physics simulation, flow matching and developmental simulation push on the design. | `shots/physics-sim.jpg` |
| 10 | 1:29 | 9.0 | **Validation harness** | Predicted sequence + desired function go in. It finds the closest existing **functional** analogue, annotates the functional differences interpretably, scores the design formally in LeanBio, and runs physics on the resulting mesh. | `shots/gene-diff.jpg`, `shots/validate-show.jpg` |
| 11 | 1:38 | 13.0 | **The machine says no** | Our own headline design fails. Launch 0.67 m/s against a minimum flying speed of 8.64 m/s. Lifting area 166× too small. Functional resolution reaches 22 of 73 requirements. No composite score is shown. "This is not a fish that works. It is a machine that can say no." | `shots/validate-gate.jpg` (the real gate text) |
| 12 | 1:51 | 9.0 | **Second server, and the round trip** | Design studio + validation harness served as a second MCP server, so anyone can design their own organism. Then the round trip: feed the predicted genetic sequence back into Design Studio in a fresh session and see whether it predicts the same phenotype. | `shots/studio.jpg` |

## Rules this cut obeys

- **No Aves.** No bird data appears on any screen. The functional-resolution ledger on screen states
  "No Aves data (frozen holdout)" itself.
- **No composite score.** Three different values for one design are under investigation, so the video
  shows the three gate results separately and never a single number.
- **No credentials** in any file in this folder or on any captured screen.
- **Legibility at 1080p.** Nothing below 24 px at 1920 wide; body copy is 30–34 px, beat headlines
  64–120 px.
- **No audio.**
- `prefers-reduced-motion` on the live page drops transforms and pans and keeps only cross-fades.
  The recording runs with motion on.

## The one naming note

The repository is still labelled **DELPHI** on every page, so DELPHI appears in the captured
screenshots. The pitch presents the system as **LeanBio Forum**, and beat 5 says on screen that the
screens still carry the old name rather than hiding it.

## Numbers and where each one comes from

Every figure on screen is read at build time from a file in this repo, never typed into the page by
hand. `facts.json` in this folder is the only place a number is written, and each entry names its
source file.

| On screen | Value | Source |
|---|---|---|
| launch speed vs v_min | 0.67 m/s vs 8.64 m/s | `dashboard/public/validate-show/run-winged-zebrafish.json` → `gate` |
| lifting area shortfall | 166.37× (1.91 cm² against 317.76 cm²) | same file, `limiting_factor` |
| functional resolution | 22 of 73 requirements assessable | same file → `functional_resolution.result.coverage` |
| unresolved differences | 19 of 22 classified | same file → `functional_resolution.result.counts` |
| gene-diff headline | 1 of 74 loci reproduced | `dashboard/public/gene-diff/data.json` (shown as the live page) |
| claims distilled | 880 (Wolfram 321, Thompson 291, Darwin 247, …) | `docs/claims.json` |
| LeanBio records | 941 | `pipeline/leanbio/out/records.json` |
| Lean laws proved | 23 proved of 41 listed; 62 in the registry | `lean/laws.json`, `lean/registry/laws/` |
| capability map | 14 personas · 32 use cases · 14 grand questions · 64 real tools | `dashboard/public/leanbio/capability.json` |
| clinical attrition | "roughly nine in ten drug programmes" | `deck/FACTS.md` (cleared wording; BIO/Informa/QLS 2011–2020 and Wong, Siah & Lo 2019) |
| formal library size | see `facts.json` | `deck/FACTS.md` |

## Could not source

- The "700" the user suggested for the maths side has **no source** and is not used anywhere.
- The biology side of the desk carries a numeral only if `deck/FACTS.md` supplies a defensible one.
  If it does not, beat 3 plays with an **empty** biology side and no numeral: the papers falling and
  the empty desk carry the point without a claim the project cannot defend. See `facts.json` →
  `biology_side.verified`.

## Files

- `index.html` — the self-playing page. `?t=90` jumps to 1:30. `?paused=1` holds. `?rec=1` is what
  the recorder loads (hides the scrub bar).
- `facts.json` — every number and its source. The only place to change a figure.
- `shoot.mjs` — captures the live dashboard pages into `shots/` (JPEG, 1600×900) plus
  `shots/manifest.json`, which records page errors so a broken screen cannot pass as a working one.
- `record.mjs` — drives the page in Edge and writes the `.webm` to `C:/Temp/pitch-video-out/`.
- `frames.mjs` — pulls a frame at every beat time out of the finished video so the cut can be
  looked at rather than assumed.
