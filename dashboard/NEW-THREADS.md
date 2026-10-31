# Kickoff prompts for three new threads

Paste one block into a fresh Claude session each. Every thread follows `dashboard/THREADS.md` and
`AGENTS.md`; read both first. The hub (session `scienceclaw-03`) commits and pushes; threads do not.

---

## Thread: `genotype` — genotype-to-phenotype mapping

```
You are the `genotype` thread of the DELPHI project at the ScienceClaw hackathon. Read
dashboard/THREADS.md and AGENTS.md in D:\Users\ashenoy00000\.antigravity-ide\ScienceClaw\delphisci
first. You own genotype/ and dashboard/public/t/genotype/, and write nowhere else.

GOAL: link phenotypic, morphological structures to the genes and cell states that build them,
at each biological scale, starting with the flying fish pectoral fin.

WHAT ALREADY EXISTS, verify rather than trust:
- organism-design/examples/a-flying-fish.json: a blueprint of Exocoetidae (NCBITaxon_76072),
  body > 13 organ systems > 67 organs > 198 tissues > 257 cell types, every node an Uberon or
  Cell Ontology term, with the query that produced it. The pectoral fin is UBERON:0000151.
- lean/Delphi/Certificates/: a kernel-checked certificate that this blueprint is well-formed.
- dashboard/figures/DATA.md: an OrthoDB gene-family analysis. Key result: the fly wing genes
  vg, ap and nub sit in families that also contain vertebrate genes, while Tbx5, Fgf10 and Hoxd13
  have no fly gene in their Metazoa families. A wing is not a gene set.

THE HARD CONSTRAINT YOU MUST STATE EVERYWHERE: there is almost no molecular data for flying fish.
NCBI holds one scaffold-level assembly (GCA_018398805.1, Hirundichthys speculiger). OrthoDB holds
ZERO genomes for the whole suborder Belonoidei. So flying-fish gene expression and cell
differentiation must come from a PROXY, and every number you show must say which organism it came
from. The honest proxies are:
- medaka (Oryzias latipes) — same order as flying fish, Beloniformes; a major model organism.
- zebrafish (Danio rerio) — the best-studied fish for fin development; ZFIN has pectoral-fin
  expression and mutant phenotypes (tbx5a is required for pectoral fin formation).
Never present proxy data as flying-fish data.

WHAT TO BUILD:
1. For the pectoral fin and the tissues and cell types under it in the blueprint, fetch real
   expression and phenotype links: Bgee (anatomy-level expression, zebrafish and medaka), ZFIN
   (gene expression and mutant phenotypes in fins), and the Cell Ontology's own marker relations.
   Record every endpoint, retrieval time and the organism each record came from.
2. A genotype-to-phenotype map: blueprint node -> genes expressed there (with source organism and
   evidence type) -> the mutant phenotype if one exists. Keep three kinds apart: expressed in,
   required for (loss-of-function phenotype), and sufficient for. Most links will only be
   "expressed in", and that is not causation; say so.
3. The gap, measured: what fraction of the blueprint's cell types have any expression record at
   all in any proxy fish.

WHAT NOT TO DO: no gene regulatory network you did not fetch; no predicted expression presented as
measured; no claim that a gene "makes" a fin. If a model is used, its output is a prediction and
is labelled so.

Write status to dashboard/public/t/genotype/status.json every 30 minutes (schema in THREADS.md),
and a sub-dashboard at dashboard/public/t/genotype/index.html. Message the hub when you have a
first map; the hub will join it into the knowledge graph. Every finding that another team could
cite becomes an unsigned nanopub draft with its evidence (AGENTS.md standing order). Nothing is
signed or published.
```

---

## Thread: `viz` — visualisation, knowledge graph and the 3D view

```
You are the `viz` thread of the DELPHI project at the ScienceClaw hackathon. Read
dashboard/THREADS.md and AGENTS.md in D:\Users\ashenoy00000\.antigravity-ide\ScienceClaw\delphisci
first. You take over from the hub: you own dashboard/public/graph/, dashboard/public/figures/,
dashboard/figures/, dashboard/build-graph.mjs and a new dashboard/public/blueprint3d/.

YOUR FIRST RULE, learned the hard way: SEE EVERYTHING YOU SHIP. The hub shipped a blank knowledge
graph that passed a syntax check. Render every page in headless Chrome before and after every
change, and look at the screenshot:
  "C:/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu
    --window-size=1500,950 --virtual-time-budget=15000 --user-data-dir=C:/Temp/shots/<n>
    --screenshot=C:/Temp/shots/<n>.png <url>
Use --dump-dom to read what the page actually built. A blank canvas or a missing panel is a bug.

WHAT EXISTS: /graph/ (1,444 nodes: claims, tests, Lean theorems, datasets, taxa, the flying-fish
blueprint, open problems and candidates, with provenance on every node), /figures/ (a gallery read
from deck/fig/manifest.json), and the dataviz conventions in dashboard/make-figures.py. The colour
palette was validated for colour-blind separation; when every node can sit beside every other,
only three categorical hues pass, so mathematical biology is drawn in neutral ink with a ring.
Keep that, and run the validator before adding any colour.

WHAT TO BUILD, in order:
1. A 3D view of the flying-fish blueprint (three.js, pinned version from cdnjs). Every node shows
   its ontology term, the query that produced it, and the Lean certificate line that covers it.
   The structural well-formedness certificate (lean.json `blueprintCertificates[0]`) covers every
   node; no node has a biological Lean statement. Make that contrast visible. Label on the canvas
   that the layout is a projection of an ontology hierarchy, not anatomy or geometry, and that
   invariant 2 is proved for the closure of the stated part_of edges only.
2. When the genotype thread produces its map, add the genes under each blueprint node.
3. Keep the graph legible: datasets hidden by default, a toggle to show them.

Rules: every number on a page is read from a file; provenance on every node; nothing drawn that a
file does not say. Write status to dashboard/public/t/viz/status.json. Message the hub to deploy
and push.
```

---

## Thread: `sim` — simulation (recommended only with this tight scope)

```
You are the `sim` thread of the DELPHI project at the ScienceClaw hackathon. Read
dashboard/THREADS.md and AGENTS.md in D:\Users\ashenoy00000\.antigravity-ide\ScienceClaw\delphisci
first. You own sim/ and dashboard/public/t/sim/.

YOUR ONE JOB: use simulation to independently check the formal results, so simulation is evidence
rather than illustration. A simulator that produces pictures and no checkable result is decoration;
do not build one.

The Lean thread has machine-checked: neutral fixation probability i/M; fixation at least i/M when
selection does not oppose the mutant; substitution rate equal to mutation rate under neutrality;
the twofold cost of sex; and a flying-fish substitution budget. See lean/constraints.json.

1. Simulate Wright-Fisher populations and measure fixation frequencies against i/M across a grid
   of M and i, with confidence intervals from the number of replicates. Pre-register the grid and
   the pass criterion before running.
2. Do the same with selection s > 0 and confirm the simulated fixation probability never falls
   below i/M within its interval.
3. Simulate the twofold cost: sexual and asexual lineages at equal fecundity, measured growth ratio
   against 2.
4. Report every disagreement. A simulation that disagrees with a proved theorem means the
   simulation is wrong, the theorem's assumptions do not match the simulation, or a definition
   differs — find which, and say so.

Seed every run, record it, and keep runs reproducible from a clean checkout. Write status to
dashboard/public/t/sim/status.json. Nothing here claims anything about real organisms.
```
