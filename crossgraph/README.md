# crossgraph — taking our own molecular claims to the literature's causal graph

This project asserts typed molecular statements extracted from text and grounded with Gilda. Nothing had
ever checked them against the literature's own assembled causal graph. This module does that against
**INDRA CoGEx** — and the first full run found more about our grounding than about our claims.

```
node crossgraph/cli.mjs --health
node crossgraph/cli.mjs --ground "sonic hedgehog"
node crossgraph/cli.mjs --between hgnc:10848 chebi:4021
node crossgraph/cli.mjs --density ALB --ns CHEBI
node crossgraph/cli.mjs --corroborate [--co-mentions] [--max 50] [--json] [--out DIR]
node crossgraph/test.mjs [--fail-once]
```

Read-only. No credential is used or needed, and no identifier of ours — no email, no account, no project
name — is sent in any request. The tests never touch the network: every service response is a recorded
fixture under `fixtures/`, captured 2026-11-06.

## What the first full run found

46 pairs from 941 records. The headline is not the corroboration rate:

| verdict | n | what it means |
|---|---:|---|
| **out-of-scope** | **31** | the entity's namespace holds **zero** nodes in CoGEx. Not asked. |
| absent-and-dense | 8 | no relation, both entities well connected — a real negative *if the grounding is sound* |
| related-but-we-asserted-nothing | 5 | the literature relates two things our record only co-mentions |
| corroborated | 1 | the asserted type is present, with its evidence |
| absent-but-sparse | 1 | no relation, and an entity is thinly covered — uninformative |

And the number that matters most: **39 of the 46 pairs carry a suspect grounding, which suppressed 4 of
the 8 negatives.**

## The finding: our groundings are not what the claims are about

Pairs the pipeline had grounded, found by inspecting the negatives rather than by trusting them:

| mention text | grounded to | in a text about |
|---|---|---|
| `"pi"` | **chebi:28874 phosphatidylinositol** | a cellular automaton — it is π |
| `"gas"` | **chebi:30778 gallic acid** | the same cellular automaton |
| `"star"` | **hgnc:11359 STAR** (steroidogenic acute regulatory protein) | the same |
| `"arcs"` | **hgnc:648 ARC** | geometric arcs in D'Arcy Thompson |
| `"salt"`, `"solutions"`, `"base"` | ChEBI class terms | correctly grounded, and useless as one end of a molecular relation |
| `"iodine compounds"` | chebi:24860 "iodine molecular entity" | a fuzzy match across a real distance |

A zero relation count between "gallic acid" and "STAR" says nothing whatsoever about a claim concerning
gases and stars in a cellular automaton. **So the suspicion check suppresses the negative rather than
reporting it beside it** — a verdict that looks like evidence and is not is worse than no verdict.

Three flags, strongest first: `name-mismatch` (neither the mention text nor the grounded name contains
the other), `generic-class-term` (a class of substance used as a substance), and `short-token-to-gene` (a
lowercase 2–4 letter word grounded to a gene symbol — the acronym collision). The first two suppress; the
third warns.

This is a finding about **our** pipeline. CoGEx answered every question correctly.

## The five kinds of nothing

The module exists mostly to keep these apart. Only the first two are evidence:

| verdict | is it evidence against our claim |
|---|---|
| `contradicted` — relations exist, the asserted type is not among them | **yes, strongest** |
| `absent-and-dense` — no relation, both entities richly connected | **yes**, unless grounding-suppressed |
| `absent-but-sparse` — no relation, an entity is thinly covered | no |
| `absent-density-unknown` — no relation, density could not be measured | no |
| `out-of-scope` — the namespace holds zero nodes | no: nothing was asked |
| `unavailable` — the service did not answer | no: nothing was asked |

A zero only becomes a negative when both entities are known to be dense, measured by a **bounded probe**
that returns a lower bound on distinct partners and says so. The dense/sparse cut at 10 partners is ours
and is labelled as ours.

## Two worked results

**A real negative on a production claim.** `thompson1917-ch09-06` is typed
`IncreaseAmount(hgnc:399 ALB → chebi:3311 calcium carbonate)`. CoGEx holds **no relation** between those
nodes while both have rich neighbourhoods (≥493 and ≥506 distinct partners in a bounded probe). Its
nanopub is on the test registry.

**But the verdict is uninterpretable, for a third reason.** The claim's own text reads *"Albumin increases
the **solubility** of calcium carbonate and phosphate"*. Increasing a salt's solubility is not increasing
its amount — if anything the reverse, since a more soluble salt precipitates less. INDRA has no statement
type for solubility, so the claim is **not expressible** as an INDRA statement at all. The typing came
from a regex on the trigger word `"increases"` plus the two nearest grounded molecular entities, and that
pattern cannot see *what* is being increased: in "A increases the solubility of B" the grammatical object
of the verb is the property, not B.

So a negative from the graph can mean three things, and `expressibility()` catches the third: the
literature disagrees, nobody wrote it down, **or we asked the wrong question**.

**A clean corroboration.** The draft statement `Inhibition(hgnc:10848 SHH → chebi:4021 cyclopamine)` is
present with 3 relations and **91 evidences**, 1 database-backed, max belief 0.611 — and Inhibition is the
best-supported of the five relation types between them.

Two leads also fell out of the co-mention pass, where the literature relates entities our records only
mention side by side: **FGF10/FGF8** (11 relations, 118 evidences) and **MET/HGF** (182 relations, 7,250
evidences, 4 database-backed).

## INDRA CoGEx, measured rather than quoted

Queried anonymously on 2026-11-06: **97,832,239 nodes and 610,528,123 relationships**, 5,425,420
`BioEntity` nodes, 15 node labels, 41 relationship types. The widely repeated **"54 million nodes / 325
million edges" is roughly 2× stale** and traces to a 2022 talk.

- Built by the **Gyori Lab at Northeastern University**; 126 keyless POST endpoints at
  `discovery.indra.bio/api`, swagger declaring no `securityDefinitions` and no `security`.
- **Code is BSD-2-Clause. The DATA has no stated licence** — `/terms`, `/license` and `/robots.txt` are
  all 404 and the README names none. Querying is one thing; redistributing derived sets inside signed
  records is another, and that question is open.
- **No peer-reviewed CoGEx paper exists** (PubMed returns 0 for `"INDRA CoGEx"`), so a record leaning on
  it must cite the code and the deployment with a retrieval date.

**It is human-centric, and that decides how it can be used here.** Namespace census: uniprot 3,041,951 ·
mesh 354,625 · chebi 216,218 · hgnc 49,013 · go 46,243 · hp 21,643 — and **zfin 0, zfa 0, ncbitaxon 0,
ensembl 0**, uberon 437. Gilda returns `[]` for `kcnk5b` while human `KCNK5` grounds to `hgnc:6280` at
0.778. That is why 31 of 46 pairs were out of scope: the organism-design work is *Danio rerio*.

The only route in is a human orthologue, which is **an assumption about conservation, not a lookup**. So
`humanOrthologueBridge()` is a separate function that labels its own assumption, uses string surgery it
admits is a heuristic, and names what would be better (Ensembl Compara, ZFIN orthology, the Alliance).
Zebrafish paralog pairs make it worse rather than better: `kcnk5a` and `kcnk5b` both map to one human
`KCNK5`, and the source literature attributes the absent *kcnk5b* loss-of-function phenotype to
redundancy between exactly that pair.

## REST, not Cypher — learned the hard way

The deployment exposes both 126 REST endpoints and an MCP endpoint with arbitrary read Cypher. The Cypher
tool is the tempting one and is not the supported surface. During development on 2026-11-06 it went from
answering in 10–30 ms to returning

```
Database unavailable: Couldn't connect to 172.31.76.196:7687
```

— an internal address — **within the hour**, while every REST endpoint kept answering correctly and
reproduced the same results exactly. So REST is the primary path here, Cypher is optional, and
`--health` reports both separately.

That outage improved the design. It forced the distinction between *no relation found* and *could not
ask*, which is now a pair of separate return values the caller cannot collapse.

## The files

| file | what it holds |
|---|---|
| `cogex.mjs` | the client: namespace scope rules and refusals, relations between two entities, the bounded density probe, grounding, the explicit orthologue bridge, and `health()`. |
| `corroborate.mjs` | candidate pairs (asserted vs co-mention vs self-loop), the verdicts, grounding suspicion, and expressibility. |
| `cli.mjs` | the commands above. |
| `fixtures/` | recorded service responses so the tests never need the network. |
| `test.mjs` | 29 assertions; 29 fail under `--fail-once`; 0 survive their own fault. |

## What this module may never conclude

Nothing, on its own. A statement missing from CoGEx means the assembled literature does not contain it —
not that it is false. A statement present means somebody wrote it down, possibly once, possibly in a
paper since retracted, which is why every verdict carries evidence counts, database-vs-reader provenance
and a retraction flag, and why **a bare relation count is never returned**. Nine relations can be nine
single-sentence automated readings.

Asserted pairs and co-mention pairs are never pooled: this project claims the first and not the second,
so a corroboration rate over both would be meaningless. And a capped run says how many pairs it did not
query, because a tally over a truncated set that looks like a coverage figure is the quiet way a report
lies.
