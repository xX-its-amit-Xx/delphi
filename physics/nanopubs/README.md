# Nanopublication records for the physics thread

Unsigned drafts only. Nothing in this directory is signed or published. An unsigned draft is not a publication
(AGENTS.md). The test registry comes first, and production needs the ORCID key owner's explicit approval every time.
No human is named in any record; the key owner adds an ORCID at signing time.

## Records (one per nanopub, Delphi ontology v2.0, hand-authored; no template declared, see DECISIONS.md)

| File | Claim in plain words | Status | Evidence |
|---|---|---|---|
| `unsigned/evidence-flying-fish-inside-envelope.trig` | A flying fish glides at or above the slowest speed its fins can hold it up at (v_min 9.85 m/s from its own measured wing loading and C_L,max; quoted glides 10 to 20 m/s) | supported | the v_min computation and its inputs |
| `unsigned/evidence-speed-vs-wing-loading-inconclusive.trig` | Across non-bird fliers airspeed grows as (W/S)^½ | inconclusive (underpowered: 2 glider taxa; powered set spans 0.93 decades) | the two regressions and every point's provenance |
| `unsigned/evidence-muscle-power-cannot-tell.trig` | A flying fish has the muscle power for level flight | inconclusive (missing input: no sourced muscle numbers) | P_req = 1.33 W and what would decide it |
| `unsigned/finding-flying-fish-glide-data-coverage.trig` | No open source gives mass, fin area and a measured glide speed for the same flying fish | supported, as a statement about the accessible literature on 2026-10-31 | the coverage count of `glide-data.csv` by column |

Each record carries all five items the standing order asks for: the claim in one plain sentence, its status, the evidence item
(inputs with source, locator, retrieval time and value kind; computed numbers; the repo files with their SHA-256), the
pre-registration (file, time, hash; the git commit is the hub's, pending), and what it does not establish.

## Build and check

```
python -I physics/nanopubs/build.py                       # drafts + manifest.json (hashes of the inputs)
java -jar C:/Temp/nanopub/nanopub.jar check -v physics/nanopubs/unsigned/<file>.trig
npx tsx lint.ts physics/nanopubs/unsigned --extracted      # from project-delphi-ontology/pipeline
```

Checked 2026-10-31: all four are `Valid (but not trusty)` under nanopub-java 1.95.0, with the three expected issues for an
unsigned, template-free draft (no assertion template, no provenance template, no signature). `check` exits 0 even on parse
errors (the claims thread found this first), so the verdict is read from the printed header, never the exit code.

The Delphi lint reported two kinds of finding on the first build, recorded here because the lint blocks a batch:
- `DUMMY-DOI` on `10.1098/rsif.2012.0794` (Bahlman et al. 2013). The DOI is real: it resolved in Crossref on 2026-10-31T18:15:48Z
  (`physics/prior-art/raw/cr-bahlman-2013.json`, title and journal match) and the full text was read from PubMed Central
  (PMC3565731). The lint's pattern mistakes the article number for a fabricated one. The record now says so in a comment.
- `COUNT-UNSTRUCTURED` on counts written in prose ("6 species"). The builder now carries each count as a structured
  statement beside the prose, in the form the lint reads.
