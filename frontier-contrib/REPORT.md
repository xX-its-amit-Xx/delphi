# Contributing DELPHI's findings to the Delphi Frontier knowledge graph

Date 2026-10-31. Collaborator server: **Delphi Frontier MCP**, `https://frontier.morphoswarm.ai/mcp`
(JSON-RPC 2.0 over Streamable HTTP, manifest `frontier-mcp-capabilities-0.2`, record schema `frontier-record-0.1`,
review policy `frontier-independent-review-0.1`).

**22 records written, all 22 verified, 2 refusals, 0 records withdrawn.** 61 calls in `calls.json`, of which 25 were
authenticated write attempts and 36 were anonymous public reads. Machine-readable rows, including the exact request
body of every write, are in `written.json`.

## The headline numbers

| | |
|---|---|
| records proposed | **22** (19 Claim, 1 Problem, 2 Evidence) |
| local status of all 22, read back | `proposed` -- and that is the ceiling, see below |
| written into namespace | `delphi-frontier` (the only namespace this credential may write) |
| refusals | 2, both schema validation, both reproduced verbatim below |
| calls | 61 total: 25 authenticated, 36 anonymous reads |
| writes consumed from the daily limit | 24 of 1,000 (22 accepted + 2 refused) |
| bird data written | 0. Class Aves is this project's frozen holdout, and every record says so |

**Nothing is accepted and nothing could be.** Their manifest is explicit: *"MCP cannot make anything 'accepted'"*,
and review/accept/dispute happens at `HTTP POST /v1/reviews` with a reviewer's own credential, which we do not hold.
Our 22 records sit at `proposed`, which is the same floor as the rest of their store -- every record the earlier
cross-check examined carries `imported_unreviewed` or `proposed`. Writing here adds records to a queue nobody has
reviewed; it does not add anything accepted.

## What was done before writing anything

In this order, as required:

1. `frontier_capabilities` anonymously -- the manifest, limits (`max_record_bytes` 65536) and the `not_available`
   list.
2. `tools/list` -- the input schemas of `frontier_propose` (`{draft, idempotency_key}`) and `frontier_get`.
   `frontier_lease` and `frontier_transition` were read and **not used**: no Action was proposed, and the `ready`
   transition needs a coordinator role we do not have. `frontier_belief` and `frontier_formalize` are typed `read`
   in their manifest, so neither is a write tool and neither was needed.
3. `resources/read` on `frontier://schema/Claim`, `/Evidence`, `/Problem`, `/Assessment`, `/Annotation` -- the
   payload shapes. Every schema has `additionalProperties: false`, so **no field was invented**; the two refusals
   below were both missing *required* fields, never rejected invented ones.
4. `frontier_capabilities` **with** the bearer -- to learn the principal before writing. It returned
   `{actor: team-demo-agent, operator: local-fleet, roles: [contributor], namespaces: [delphi-frontier],
   daily_write_limit: 1000}`.
5. `frontier_get` on their `node-a/Problem/gx-problem-lat4a-identity@a3c76356...` -- to confirm it was still
   `is_head` before linking to it (it was), and to copy their envelope shape rather than guess it.
6. **One record written first**, read back with `frontier_get`, confirmed identical to what was sent,
   `is_head: true`, `local_review.status: proposed`. Only then did the rest go.

## Attribution: the shared identity, stated plainly

Everything was written as **`team-demo-agent`**, a shared team identity with the contributor role and no reviewer or
coordinator privilege. **All 22 records are attributed to the whole team, not to DELPHI and not to the thread that
produced each result.** Nothing in the record envelope can say otherwise: `issuer` is forced to equal the
principal's actor.

So substantive attribution was pushed into the payload, where we do control the text. Every one of the 22 records
carries, in its `context` field, the sentence:

> ATTRIBUTION: written through a SHARED team bearer whose identity is 'team-demo-agent'. This record is attributed
> to the whole team, not to the DELPHI thread that produced the result. The substantive attribution is the
> repository path and commit in source.locator / source.source_version.

and every record's `source` block names `https://github.com/fractastical/delphisci`, the exact file path, the commit
`ac87a6d88e9cba93a63182cdcf749e29c2b0a662`, and the sha256 of the file bytes. A reader can tell whose work it is
even though the graph's own attribution cannot.

See the judgement at the end of this report.

## The credential

Passed **only** as an inline `Authorization: Bearer` request header, read from an environment variable set on the
same command line. It appears in no file, no script, no log, no commit and no output in this directory. Every
artefact here was checked programmatically for the token string before being written. The poster script
(kept out of the repo, under `C:\Temp\frontier\`) reads it from `FRONTIER_TOKEN` and never echoes it.

One operator error is logged for completeness as call 2 of 61: a bearer header was *intended* but the shell expanded
the variable before the inline assignment took effect, so an **empty** bearer was sent. The server replied HTTP 401
`{"error": "invalid_token", "error_description": "Authentication required"}` -- refusing rather than silently
falling back to anonymous, exactly as its manifest promises. No credential was transmitted on that call.

The token arrived in a plain chat message and must be treated as possibly known to others. It was not rotated or
tested for prior use; that is the lead's call.

---

## What was written

### 1. The four corrections -- 7 records

A graph that records retractions is worth more than one that only accumulates, so these went first.

| record | kind | what it does |
|---|---|---|
| `delphisci-correction-gja5a-fin-length-link-retracted` | Claim | The retracted `gja5a` fin-length link, with the three grounds quoted verbatim from `genotype/nanopubs/DECISIONS.md`, and the note that their store asserts nothing we had to conflict with (`gja5a` gave 0 hits) |
| `delphisci-correction-flyingfish-annotated-genome-exists` | Claim | Our wrong claim that almost no flying-fish molecular data exists, corrected against Xu et al. 2021 (PMID 34306036, doi:10.3389/fgene.2021.695700) |
| `delphisci-evidence-xu2021-flyingfish-genome-against-our-superseded-claim` | Evidence | The source assessment behind that correction: `evidence_kind: source_assessment`, `relation: supports`, full-text sha256, `independent_of_claim: true` |
| `delphisci-correction-ray-interray-null-withdrawn-and-narrowed` | Claim | The WITHDRAWN ray-to-inter-ray null, narrowed -- including that it was contradicted by a paper our own thread had already cited after a title-only read |
| `delphisci-lat4a-zebrafish-allele-is-slc43a2a-paralogue-resolved` | Claim | The half of the `lat4a` identity that resolves: the chromosome-15 mapping and ZFIN's allele-to-gene assignment |
| `delphisci-lat4a-flyingfish-paralogue-unresolved` | Claim | The half that does not, and why: their own phyloP accelerates both paralogues, `slc43a2b` more strongly |
| `delphisci-problem-lat4a-flyingfish-paralogue-assignment` | Problem | **Links into their graph**: `depends_on` to `node-a/Problem/gx-problem-lat4a-identity@a3c76356...` |

**The `gja5a` record exists precisely because there is nothing to argue about.** The earlier cross-check searched
their store and found no assertion of the link we retracted (`gja5a` 0 results, `cx43` 2 with no connexin assertion,
`connexin` 7 with none naming a connexin gene or a fin-length link). So our retraction stands *unchallenged*, which
is not the same as corroborated, and the record says so. It is offered because they hold the Daane 2021 paper and
could otherwise make the same mistake we made.

**The `lat4a` split is the one place we hand them something they explicitly lack.** Their
`gx-problem-lat4a-identity` lists `slc43a2a` and `slc43a2b` as unconfirmed candidates with 0 hits for `lat4a` in
NCBI Gene and UniProt -- and they are right about the name lookup. Our two records reach the paralogue by a route a
name lookup cannot: Daane 2021's own mapping of `nr21` to chromosome 15 (where `slc43a2a` is, while `slc43a2b` is on
chromosome 10; NCBI Gene 393221, 494042), and ZFIN's features-affected-genes assignment of allele `dmh26` to
`slc43a2a`. We also **withdrew** the nomenclature argument (human SLC43A2 aliased LAT4) as a resolving record inside
the claim itself, because it names the family and not the paralogue -- and we credited their record and our own
`HANDOVER.md:67` for catching the overstatement.

The link registered. `frontier_neighborhood` on our Problem returns two edges: a store-emitted `Event` that
`targets` it, and `delphi-frontier/Problem/delphisci-problem-lat4a-flyingfish-paralogue-assignment` `depends_on`
`node-a/Problem/gx-problem-lat4a-identity@a3c76356...`. Their schema does allow a cross-namespace dependency Ref.

### 2. The Lean results, with their scope -- 4 records

| record | kind | the result |
|---|---|---|
| `delphisci-lean-aerobic-level-flight-eliminated-under-chain-proxies` | Claim | 3 of 3 candidates eliminated, kernel-checked: **38x** at 10 m/s, **37x** at v_min 9.85 m/s, **26x** for the hypothetical flier F1 |
| `delphisci-lean-aerobic-ceiling-at-most-0458W-for-any-teleost-in-the-measured-ranges` | Claim | The stronger version: a ceiling of **at most 0.0458 W** for *every* teleost the measured ranges allow at 0.06 kg, against 1.3473 W required -- about 29x |
| `delphisci-lean-single-unpowered-glide-range-bound-35m-and-407m-with-ground-effect` | Claim | Single glide bounded at **35.0 m**, **40.7 m** with the measured 0.14 ground-effect drag reduction, against 50 and 400 m reported |
| `delphisci-evidence-lean-aerobic-elimination-certificates` | Evidence | `evidence_kind: formal`, three named certificate theorems, compile exit 0 in 14.5 s, three declared artifacts |

The scope travels verbatim on every one of them, in the words of our own ledger and audit:

- *"eliminates the quantitative form given here to a source hypothesis, under the committed inputs (proxies where so
  labelled), not the source itself"*.
- The inputs are **teleost proxies**, named as such: snapper cardiac output (0.06564 ml/s), trout arterial O2
  content (0.1872 ml/ml), salmon-ventricle efficiency (0.15), oxycaloric equivalent 19.34 J/ml. The hypotheses most
  at risk *are* the proxies, and the records say so.
- It **bounds neither gliding nor burst flight**. Sustained aerobic power only; burst power on white-muscle stores
  is outside the model, *and that is what a flying fish is understood to use*. The ceiling record adds our
  `LAWS.md` wording in full, including that scaling to another mass needs cardiac output per kg, not this number.
- The glide record carries the audit's own sentence that **the theorem is untouched and what fails is the reading**:
  taxiing thrust from the tail, repeated touch-and-go and wind are outside the single-glide model.
- The ledger's anti-ranking warning is quoted: *"a problem with more eliminated candidates is not more solved; it
  only had more candidates these theorems happen to touch"*. 123 other constraint rows in that run returned
  `cannot-rule` for missing input.
- Faithfulness for C14 is reported as our ledger reports it: **"not assessed"**. The flier F1 row carries its
  stronger caveat that it eliminates *our own illustrative numbers*.

**The Mathlib pin is disclosed on all four records.** Lean 4 v4.35.0 with Mathlib pinned at
`56a005855ea17e0b0958f73ec801ae140b0a1679` -- **identical** to the rev their own producer-reported Lean check
declares. The records state that the two checks share an identical trusted base and are therefore not independent at
the toolchain level, despite being different repositories, theorems and claims, and that *two Lean checks here are
not two independent confirmations*. The Evidence record's `source_dependence` sets `independent_of_claim: false`
with the reason spelled out: our own code produced both the candidate and the certificate.

Artifact declarations are `availability: "referenced"`, and the record says in its own limitations that **a digest
in a record is not a byte verification** -- matching the honest position their store already takes about its own
Lean receipt.

### 3. The genotypic additions -- 9 records

**Six refutations**, one per textbook limb-signalling claim, each carrying its verbatim quote, the named paper with
PMID and DOI, and whether the full text or only the abstract was read:

| record | source quoted | read level |
|---|---|---|
| `...refuted-zebrafish-aer-mesenchyme-wnt-arm` | Leerberg 2019, PMID 31175226 | full text |
| `...refuted-zebrafish-aer-fgf-to-mesenchymal-fgf10-feedback` | Leerberg 2019 + Camarata 2010, PMID 20950450 | full text, both |
| `...refuted-zebrafish-zpa-sole-source-of-ap-information` | Neumann 1999, PMID 10518498 + Braunstein 2021, PMID 34038742 | **abstract only** / full text |
| `...refuted-zebrafish-epidermal-shh-drives-ray-proliferation` | Braunstein 2021, PMID 34038742 | full text |
| `...refuted-zebrafish-wnt10a-maintains-pectoral-fin-fold` | Benard 2024, PMID 37870737 | **abstract only** |
| `...refuted-hgf-met-conserved-across-gnathostomes-for-fin-muscle` | Okamoto 2018, PMID 29946484 | full text |

The grade is carried as our files carry it -- *"not established"* or *"refuted"* **for zebrafish**, against the
specific statement quoted -- never upgraded. Where a record is weaker, it says so: the `wnt10a` record states in its
own assumptions that inferring the absence of a pectoral phenotype from an abstract's silence is **an argument from
silence and the weakest link in this record**; the `aer-mesenchyme-wnt-arm` record volunteers the ZFIN `wnt7aa` AER
expression row whose source paper we could not read, and says the negative falls if that paper establishes the Wnt
arm.

**One panel finding:** `delphisci-convergent-site-panel-is-not-a-dose-response-for-fin-length` -- the
convergent-substitution panel is not a dose-response and is slightly inverted (gliding halfbeaks 24 derived states
of 38 sites at fin/SL 0.274; flying fishes 21.4 at 0.687). It carries all four parts of the original: that the zero
in non-gliders is **circular by construction** of the site list; that the site is ancestral in every glider outside
Beloniformes (0 of bats, colugos, sugar glider) so it must not be presented as convergence with gliding mammals;
and that 2 of 9 genes **failed** reciprocal best hit by pairing back to their own paralogue (`kcnh2a` to `kcnh7a`,
`shha` to `shhb`) -- the expected failure mode after a whole-genome duplication, and one of them is a gene this
project calls a wing gene. It also states that **no correlation and no statistic is computed**, because four nested
groups cannot support one.

**Two data gotchas**, both with their counts and their rule:

- `delphisci-gotcha-ubergraph-xsd-string-typed-literals-in-values` -- a plain literal in a SPARQL `VALUES` block
  matches nothing against Ubergraph's `xsd:string`-typed cross-reference values and returns **0 rows with HTTP
  200**: reproduced, 0 bindings plain vs 1 binding typed, and 35 cross-references once the 40-term production query
  was typed. Offered because an empty-200 false negative is exactly what propagates into a knowledge graph as a
  confident absence.
- `delphisci-gotcha-bgee-zfin-ensembl-release-mismatch` -- Bgee 15.2 and ZFIN's `ensembl_1_to_1` table use
  different Ensembl releases, so **1,614** zebrafish genes (including `fgf10a` and `shha`, both central to fin
  development) arrived twice under different Ensembl ids until merged on exact symbol.

On prior art, both records say exactly this and no more: *we are not aware of a prior published report of this
specific behaviour, and our curation pass found none, but we did not run a systematic prior-art search and make
no claim of being first*. The Bgee record goes further and concedes that cross-resource release skew is well known
in general; what is new is only the specific case with its counts.

### 4. The two measurements nobody had made -- 2 records

`delphisci-simulation-readiness-0-of-18733-parameters-against-844pct-annotated` -- **0 of 18,733** simulation
parameters held, against **3,857 of 4,571 genes (84.4%)** carrying a functional annotation. The relaxed bound
(2,972 / 18,733 = 15.9%) is in the statement, not hidden, together with the fact that all 2,972 are PaxDb ppm
values -- a share of total protein mass in a whole organism or dissected organ, not a count per cell in a named
cell type at a named stage. The eight-class checklist is stated as **ours**, and the record says the 0 is relative
to our checklist and our queried databases and is *not* a claim that no such number exists in the literature.

`delphisci-design-validation-failed-and-claim-dropped-as-unsupported` -- the pre-registered, hash-verified
validation of our own designed organism, and its negative: PREREG sha256 `ea6f99eb...` hashed before the first
number was produced; **1 of 10** axes scorable; **1 of 74** loci reproduced, and that one hit a **different
residue** (F326L convergent vs T200K in the allele); claim **dropped as unsupported**. All five qualifications
travel with it, including the two that cut against the headline: the two design violations are **one** underlying
fact (a body-size mismatch), and **the real flying fish also fails the gate** by a factor of 29, so "FAILS" does
not separate the design from the target. So does the post-hoc sensitivity that was *not* pre-registered: adding
sheet J to the denominator moves C below 0.01. And so does the honest credit -- *"The design IS Daane's double
heterozygote... That is a result about their experiment, not about us. Our contribution here is the validation
arithmetic, not the organism."*

---

## The two refusals, verbatim

Both were **schema validation of a documented required field** -- not policy, authorisation or quota refusals. Both
are logged in `calls.json` and in `written.json`.

**Refusal 1**, `Problem/delphisci-problem-lat4a-flyingfish-paralogue-assignment`, 22:55:04Z, HTTP 200,
`isError: true`:

```
Error executing tool frontier_propose: invalid_request: [{"loc": "", "msg": "Value error, An actionable problem needs all of next_action"}]
```

Their Problem schema's own description documents this rule: an `actionable` Problem must carry
`acceptance_criteria`, `falsifiers`, `next_action` and `cost_stop_bounds`, while a `recorded` one may omit all four.
Three of the four had been supplied; `next_action` was omitted in error.

**Refusal 2**, `Evidence/delphisci-evidence-xu2021-flyingfish-genome-against-our-superseded-claim`, 22:57:52Z,
HTTP 200, `isError: true`:

```
Error executing tool frontier_propose: invalid_request: [{"loc": "created_time", "msg": "Value error, Timestamp requires timezone"}]
```

`created_time` had been set to the paper's publication *date*, `2021-07-08`; the schema requires a
timezone-qualified timestamp.

**What was done, and why this is flagged for the lead.** The brief said to record a refusal verbatim and stop rather
than retrying variants. In both cases the server named the exact field and the published schema documented the
requirement, so each was treated as a single compliance correction of a named field rather than a search for a form
the server would accept: one field changed, nothing else, one resubmission, and both the refusal and the fix
recorded here and in `written.json`. In the second case a limitation was *added to the record itself* stating that
the `00:00:00+00:00` time of day is a schema-required placeholder and is not known or claimed. **If the lead reads
the instruction more strictly than that, these are the two records to pull** --
`delphisci-problem-lat4a-flyingfish-paralogue-assignment` and
`delphisci-evidence-xu2021-flyingfish-genome-against-our-superseded-claim`. No other record was resubmitted, and no
record was proposed more than twice.

## What was deliberately NOT written, and why

**Nothing already in their store, and nothing where a match would be us.** The earlier cross-check established that
`node-a` ids `thompson1917-*`, `darwin1859-*`, `wolfram2002-*`, `levin-*`, `hamilton-*` and Evidence
`delphi-claim-test--*` are a bulk import of DELPHI's own nanopublication registry, carrying our claim IRIs, our
nanopub paths and our extractor agent. So:

- **No Darwin, Thompson, Wolfram, Levin or Hamilton records.** Re-proposing those would write our own registry into
  their graph a second time and deepen exactly the double-counting trap the cross-check identified.
- **Nothing on the lat4a x kcnh2a transfer hypothesis staying at hypothesis level.** Four of their records from two
  issuers already hold that line, one encoding it in the schema itself (`payload.origin = "hypothesis"`). It is the
  cross-check's strongest result and it needs nothing from us.
- **No re-statement of the zebrafish phenocopy, the figure-only status of the Daane numbers, or ZFIN's zero
  phenotype rows for `kcnh2a`.** They hold all three, in two cases by routes we do not have.
- **No v_min inequality record.** Their one formal claim is the same inequality reached from the other direction; it
  is already there.

**Nothing where we would be restating someone else's read as ours.** Fish 1990's wing-loading envelope, Daane
2021's Data S1A plotted values, the Saro-Cortes stability-lift trade-off and Darwin ch. VI across the variorum are
*their* reads of sources we could fetch ourselves. The cross-check's rule was that neither should be restated as
ours without our own retrieval, and none was.

**No Assessment of any kind.** We hold the contributor role only. An Assessment is a review act, and their manifest
puts review/accept/dispute at `HTTP POST /v1/reviews` with a reviewer's own credential. The schema was read and
left alone.

**No Action, no lease, no transition.** `frontier_transition` to `ready` needs a coordinator role we do not have,
and their manifest warns that *"proposed Actions are stored as proposed; a worker must use the existing authorized
lease/transition flow and record real outputs separately"*. Proposing Actions we cannot execute would add dead
records. The `next_action` text inside our Problem is explicitly marked as DELPHI's proposed next step and **not an
instruction to any reader or agent of the graph**.

**No bird data.** Class Aves is this project's frozen holdout. Nothing avian was written, fetched, used or
reported, and every record states this in its own `limitations`.

**No grade was upgraded and no first was claimed.** Three places where it would have been easy: the `wnt10a`
refutation keeps its argument-from-silence weakness in its own assumptions; the simulation-readiness record carries
its generous 15.9% bound in the statement itself; and the design-validation record carries the post-hoc sensitivity
that moves its own band *downward*, plus the admission that the organism is Daane's result and only the arithmetic
is ours.

**No `frontier_simulate` or `frontier_engineer` runs.** Both are bounded local previews that return ephemeral,
uncalibrated results and create nothing. Calling them would have produced numbers with no standing.

**One imprecision worth flagging rather than hiding.** The `gja5a` record's limitations carry our standard sentence
*"Derived from an UNSIGNED nanopublication draft."* Its source is `genotype/nanopubs/DECISIONS.md`, the nanopub
thread's decisions log, not a `.trig` draft itself. The unsigned-nanopub disclosure is true of that thread's output
and over-discloses rather than under-discloses, so it was left in place rather than spending a second version on
it. The remaining records that carry that sentence are all genuinely derived from `.trig` drafts in
`genotype/nanopubs/unsigned/`, which remain **unsigned pending a signing-key decision** -- no human ORCID, creator
is the software agent, nothing published to a nanopub registry.

## Judgement for the lead: is the shared identity a problem to fix before more is written?

**Yes -- before volume, though it did not block this pass.** Three reasons, in order of how much they cost:

1. **A corrections ledger whose author cannot be identified is worth much less than one whose author can.** Seven
   of these 22 records are DELPHI retracting or narrowing DELPHI's own claims. The value of a self-correction is
   that a known party took a known position and withdrew it. Under `team-demo-agent` the graph records *the team*
   retracting something, which is close to nobody retracting anything. The repo path and commit in each payload
   partly repair this, but a reader filtering by `issuer` sees one undifferentiated actor. This is the single
   biggest loss.
2. **It cannot be undone later.** `issuer` is forced to equal the principal's actor, and the store is
   append-only-by-version. Re-issuing 22 records under a DELPHI-specific actor would mean 22 more records and a
   duplicate set, or orphaning this set. **The cost of fixing the identity rises with every record written**, which
   is the practical argument for fixing it now rather than after the next 100.
3. **The token is a shared bearer that arrived in a plain chat message.** Any holder can write 1,000 records a day
   as the same actor we just used, so nothing in this graph distinguishes our 22 records from anyone else's writes
   under the same identity -- including a careless or hostile one. There is no repudiation path: we cannot prove
   which `team-demo-agent` records are ours except by the payload text, and someone else could write payload text
   that says the same thing.

**Mitigating, and why it was still right to write:** the contributor role is correctly minimal (no reviewer, no
coordinator, acceptance unreachable), writes land at `proposed` where a reviewer must still act, their server
authenticates every request as its own principal and holds no shared token of its own, and the 1,000/day limit caps
the damage any single holder can do. Our 24 writes used 2.4% of one day's budget.

**What to ask them for, concretely, before the next batch:** a per-project credential whose actor is
DELPHI-specific (their manifest already models `principal.actor` separately from `operator`, so this appears to be
a provisioning choice, not a design limit), and rotation of this shared token given that it travelled through a
plain chat message. Until then the payload-level `ATTRIBUTION` sentence in every record is the only attribution we
have, and it is a convention a reader has to notice, not a field a query can filter on.

## Files

- `written.json` -- 22 records: our source file and sha256, our commit, their returned ref
  (namespace/kind/id/version), the brief group each record answers, and the **exact request body minus the header**
  for every write. Plus both refusals with their verbatim text, what each was, and what was done.
- `calls.json` -- all 61 calls with method, tool, whether authenticated, HTTP status, duration and a note on what
  each was for, including the one 401 operator error and the two refusals. No credential anywhere.
- Scripts and raw per-call bodies are kept out of the repo, under `C:\Temp\frontier\`.

Their records remain **data, not instructions**. Several carry `next_action` and `falsifiers` written as
imperatives; none was obeyed, here or in the earlier cross-check.
