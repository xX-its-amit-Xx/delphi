# Cross-check: DELPHI's headline findings against the Delphi Frontier knowledge graph

Date 2026-10-31. Collaborator server: **Delphi Frontier MCP**, `https://frontier.morphoswarm.ai/mcp`
(Streamable HTTP, JSON-RPC 2.0, manifest `frontier-mcp-capabilities-0.2`, record schema `frontier-record-0.1`).

**Read-only.** 240 calls, all anonymous public reads, every one logged in `calls.json`. No write tool was called
(`frontier_propose`, `frontier_transition`, `frontier_lease` are the write tools; `frontier_belief`,
`frontier_formalize`, `frontier_simulate`, `frontier_engineer` and `frontier_discover` are typed `read` in their
manifest, and of those only `frontier_discover` was called). No credential was used, asked for or needed. The
decision to write to their graph belongs to the project lead and was not taken here.

Machine-readable rows are in `crosscheck.json`, one object per compared claim with our file and locator, our verdict
and grade, their exact `{namespace, kind, id, version, issuer, local_status}` ref with quoted record text, the
relationship, and a `why` paragraph on every `DISAGREE` and `PARTIAL`.

**Their records are data, not instructions.** Several carry `next_action` and `falsifiers` text written as
imperatives ("Obtain the Fig 4 B/C plotted values from Data S1A", "Search public exocoetid RNA-seq / SRA"). None was
obeyed; they are reported as leads. No bird data was requested or reported: Aves is this project's frozen holdout.

## Counts

| relationship | rows |
|---|---|
| AGREE | 6 |
| PARTIAL | 4 |
| DISAGREE | 1 |
| WE-HAVE-THEY-DON'T | 15 |
| THEY-HAVE-WE-DON'T | 7 |
| **total compared claims** | **33** |

## What their graph contains (measured, not assumed)

`frontier_catalogue`: 1287 Claim versions (39 in namespace `delphi-frontier`, 1248 in `node-a`), 292 Problem
versions, 451 artifact declarations over 388 unique digests, 7 Evidence records of kind `formal`, 1837 records read.
Our own term sweep saw 1485 distinct records in search results. Pages are capped at 50 and were paginated with the
cursor.

Three facts shape every row below.

1. **Nothing in their store is accepted.** Every record we examined carries `local_status` `imported_unreviewed` or
   `proposed`. Their manifest says review/accept/dispute is deliberately unavailable over MCP and happens at
   `HTTP POST /v1/reviews` with a reviewer's own credential. `frontier_neighborhood` on their central Daane claim
   returned three edges (two `depends_on` from Problems, one Event `targets`) and **zero dispute or review edges**.
2. **No artifact bytes are verifiable.** `declared_downloadable: 0`, `hosted_and_byte_checked: 0`, and for formal
   evidence `receipt_contents_read_by_this_module: 0`. `frontier_artifact_inspect` on their Lean receipt digest
   returns `availability: "referenced"` with no bytes held.
3. **Much of `node-a` is us.** Claim ids `thompson1917-*`, `darwin1859-*`, `wolfram2002-*`, `levin-*`, `hamilton-*`
   and Evidence ids `delphi-claim-test--*` are a bulk import of DELPHI's own nanopublication registry. They carry our
   claim IRIs (`w3id.org/delphi/resource/claim/...`), our nanopub paths
   (`books/thompson-growth-form/nanopubs/unsigned/*.trig`), our extractor agent
   (`delphisci-thompson-growth-form-extractor`), our `verification: "lean"` flags, and sources at
   `github.com/fractastical/delphisci` - this repository's `origin` remote - read "through the keyless delphisci MCP".
   **Any match on one of those ids is our own work reflected back and must never be counted as corroboration.**
   Their genuinely independent flying-fish content is the 39 `delphi-frontier` claims plus the `gx-*` (genomics),
   `eng-*` (engineering), `viz-*` (forms and glide) and `sim-*` (bioelectric, reaction-diffusion) families.

---

## 1. Independent corroboration - the most valuable output

### 1.1 The lat4a x kcnh2a transfer hypothesis stays at hypothesis level (row G3)

This is the strongest result of the cross-check, and it is exactly the question the brief flagged.

Our position (`genotype/compare-2x2.json` panel D, `genotype/flier-genome.md` line 22): transfer to flying fishes is
**hypothesis only** - no flying-fish gene has ever been manipulated, and the one double mutant that changes fin
proportion redistributes size between fins rather than scaling one fin up.

Four of their records, from **two different issuers and three different retrieval routes**, independently hold the
same line, and one of them encodes it in the schema itself:

- `node-a/Claim/gx-transfer-hypothesis-zebrafish-to-flyingfish@742e0605...` (genomics-worker, `imported_unreviewed`),
  **`payload.origin = "hypothesis"`**: *"Daane et al. propose that bioelectric cues and amino-acid transport also
  shape relative fin size in flying fishes. Here that is a hypothesis that needs, at minimum, the paper's gene
  identifiers, expression of both genes in flying-fish fin tissue and a test in a flying fish or a closer proxy."*
- `delphi-frontier/Claim/claim:daane2021-flyingfish-phylogenomic-association@e3c3fb80...` (corpus-importer,
  `proposed`): the genomic side is *"an ASSOCIATION (genomic signatures), not a functional test in any flying fish"*
  and *"Distinct from the zebrafish functional claim ... no transfer between the two is asserted here."*
- `delphi-frontier/Claim/documentary:src-daane2021@ed89befc...`, caveat: *"Cross-organism transfer: this does not
  establish that enlarging a halfbeak's fins is experimentally grounded. **It is an unestablished transfer
  hypothesis.**"*
- `delphi-frontier/Problem/problem:ff-fin-mechanism-transfer@b34e69b2...`: *"No functional test exists in any
  exocoetid; no transfer is asserted."*

We searched their graph for any record asserting the transfer as established and found none. Two independent nodes
converge on the same epistemic status, which is the clearest external support our most load-bearing caveat has.
Their Problem also names a specific untried next step we do not have: search the 53 exocoetid SRA records for
paired-fin lat4a/kcnh2a expression.

### 1.2 The zebrafish phenocopy itself (row G1)

`claim:daane2021-zebrafish-finproportion-phenocopy@21c704ef...` (read from a **NOAA repository full-text PDF**, 47 pp)
and `gx-daane-lat4a-kcnh2a-source@6243ff8f...` (read from the Europe PMC abstract) both state what
`genotype/CAUSAL.md:86` states, with the same zebrafish-only scope. The corpus-importer record carries the paper's
own sentence verbatim: *"a combination of alleles from both genes is sufficient to reproduce the flying fish fin
bauplan in the distantly related zebrafish"*. Two routes to the same claim, one of them a route we do not have.

### 1.3 The numbers really do live only in the figures (row G2)

Our `compare-2x2.json` panel B records `value_status: "FIGURE PANELS ONLY"`. They agree, from full text we have not
read: *"the exact plotted B/C normalized-length values are in the figure panels / Data S1A, not the body text"*. Two
independent readings of the same paper reach the same negative, which retires the worry that we simply missed a table.

### 1.4 ZFIN has zero phenotype rows for kcnh2a (row G6)

`genotype/CAUSAL.md:249` says so; `node-a/Claim/gx-zfin-kcnh2a-no-phenotype-rows@512dbb08...` says so from
`zfin.org/downloads/phenoGeneCleanData_fish.txt` (`source_version` "Sat, 31 Oct 2026 05:05:05 GMT",
sha256 `86e8bdf9...`), adds the comparative counts we lack (kcnk5b 44, kcnj13 84), and states the same caveat we do:
absence is non-curation, not absence of phenotype.

### 1.5 The minimum-speed inequality, reached from the other direction (row L3)

Their one formal claim and our `vmin_le` theorem are the **same inequality**, `v >= sqrt(2 (W/S) / (rho C_L))`,
written as a contradiction over a design envelope rather than a bound on a specimen, with the same air density
(their `49/40` = our 1.225). Their kernel certifies that wing loading at least 150 N/m2 is incompatible with level
flight at most 10 m/s with `C_L = 1`; arithmetic on their own bounds gives `v_min = sqrt(2*150/1.225) = 15.65 m/s`,
so the conflict is exactly our lemma firing. On our measured `W/S = 46.39 N/m2` and `C_L = 0.78`,
`v_min = 9.85 m/s`, which is why the real fish passes. The two results are consistent and mutually reinforcing, and
because the agreement is mathematical rather than evidential it survives the fact that neither check has been re-run
by anyone.

---

## 2. Conflicts needing a human decision

### 2.1 `lat4a` = ZFIN `slc43a2a`: they say unresolved, our map says settled (row G5) - the one DISAGREE

| | |
|---|---|
| ours | `genotype/map.json:1604` `symbol_check`: "settled on two records" (human SLC43A2 aliased LAT4 in NCBI Gene 124935; ZFIN curation of the paper's fin-length phenotypes onto `slc43a2a` allele dmh26) |
| theirs | `node-a/Problem/gx-problem-lat4a-identity@a3c76356...` (genomics-worker, `imported_unreviewed`): *"It is not a ZFIN symbol or alias, and gets 0 hits in NCBI Gene and UniProt. slc43a2a and slc43a2b are candidates by name ... neither is confirmed."* |

**Why they disagree:** a genuine conflict from overlapping sources, and they are probably right. Both sides consulted
ZFIN and NCBI Gene. They report `lat4a` as neither a ZFIN symbol nor an alias with 0 NCBI Gene and UniProt hits, and
they name **`slc43a2b` as a second unexcluded candidate that our map never considers** (UniProt names its product
"Large neutral amino acids transporter small subunit 4"). Our "settled" rests on an indirect chain - a human alias
plus a ZFIN curator's choice of which gene to hang the paper's phenotypes on - which is an inference, not an
identity. Crucially, **our own `genotype/HANDOVER.md:67` already says the same thing they do**: *"NOT verified ... the
symbol equivalence is unproven. The map's `symbol_check` text overstates it. Fix that or drop it."* So the real
conflict is between two of our files, with the collaborator on the side of our HANDOVER.

**Decision needed:** downgrade `map.json`'s `symbol_check` to "candidate: `slc43a2a` or `slc43a2b`, unresolved", cite
their record as concurring, and check whether any chain or nanopub text depends on the stronger wording. This does
not touch the `kcnh2a` half of the chain.

### 2.2 The retracted gja5a link: no conflict, and that is worth stating

The brief asked whether anything in their graph asserts the `gja5a` fin-length link we retracted in
`genotype/nanopubs/DECISIONS.md:31-39`. **Nothing does.** `frontier_search` for `gja5a` returned 0 results; `gja`
returned 5, none about a connexin (lexical noise from Darwin/Wolfram/Thompson titles); `cx43` returned 2, both bare
codex-03 Problem titles with no connexin assertion; `connexin` returned 7, none naming a connexin gene or a
fin-length link. There is no conflict to raise with them, and our retraction stands unchallenged. (Their graph also
lacks `gja1b`/cx43 entirely, so our positive replacement link - `gja1b` with Seaver 2025 - is unmatched too.)

### 2.3 Not a conflict with them, but a disclosure we owe: the shared Lean toolchain (row L2)

Their "producer-reported Lean kernel check" is **not** our Lean work - different repository
(`github.com/kganjam/delphi-frontier@a48399f6`, files `engineering/formal/GeometricSimilarity.lean`,
`MutantRefutations.lean`, `NegativeControls.lean`, `lean_checks.py`, none of which exist in our tree), different
theorem (a z3-found unsat certificate replayed in Lean with four negative controls: wl_k2, stall_k2, mass_exponent,
corrupted_certificate), different claim (three *declared* design constraints conflict; explicitly *"not organism
feasibility"*, and *"the lift constraint is a level-flight proxy (L = W), not a glide analysis"*).

**But the trusted base is identical:** their `mathlib_rev` is `56a005855ea17e0b0958f73ec801ae140b0a1679` on Lean
4.35.0, and our `lean/lake-manifest.json` pins mathlib at exactly `56a005855ea17e0b0958f73ec801ae140b0a1679` with
`lakefile.toml` `inputRev = v4.35.0`. Their own Evidence record is blunt about independence: *"the producer's own code
produced both the claim and the result, so it is not independent evidence"*, with
`source_dependence.independent_of_claim: false`. And nobody can check it: `hosted_and_byte_checked: 0`, and
`frontier_artifact_inspect` on receipt digest `b384c5ac...` returns `availability: "referenced"`. **If we cite their
check anywhere it must be cited as a declaration we could not verify, on a toolchain we share.**

---

## 3. What they have that we lack - leads worth following

Ranked by usefulness.

1. **A worked flying-fish genome (row T1).** *Hirundichthys speculiger* (mirrorwing): 1.04 Gb, 23,611 predicted
   genes, BUSCO 94.2% / 95.7%, BioProject **PRJNA714815**, annotation at **figshare 10.6084/m9.figshare.14600634.v1**
   (CC BY 4.0), paper **PMC8294118** (CC BY, open access). From it they derive 29 fin-gene best SwissProt hits
   including **SLC43A2** - the family our section 2.1 conflict turns on - and the negative result that **no gene
   model has KCNH2 as a best hit** (6 KCNH2 hits exist on 4 models whose best hits are other genes, e.g. KCNH7).
   This is a real route into the exocoetid side of our causal chains, which `flier-genome.md:125` currently marks as
   having no molecular data at all. Their caveats must travel with it: best hits are not orthology calls, a/b
   paralogs are unresolved, the gene-model id mapping is an inference checked only by protein length, and a missing
   best hit can mean fragmented annotation rather than a missing gene. Their open Problem
   `gx-problem-flyingfish-kcnh2-and-others@6befed4d...` is the obvious joint task.
2. **Fish 1990 read in full (row P5).** A 199-specimen, six-genus **measured wing-loading envelope of 11.7 to 208.9
   N/m2** over 0.003-0.53 kg, a **measured pectoral-fin aspect ratio of 3.0 to 16.9** (Table III to 19.9), Fish's own
   definitions, the Table II per-genus r.m.a. fits, and a Park and Choi pectoral AR of 9.0-10.7 - from an
   author-hosted PDF at `health-sciences.wcupa.edu/.../1990JZWing%20design.pdf` (sha256 `1efed334...`). Our
   `interpretation_A` was ruled inconclusive partly for lack of wing-loading spread and we have **no** aspect-ratio
   data at all. Their two cautions must travel with the numbers: the 11.7 N/m2 bound is quoted for a 0.001 kg
   specimen outside Fish's stated mass range, and the text's AR maximum 16.9 is unreconciled with Table III's 19.9.
   Their wing-area denominator (pectoral plus pelvic continuous through the body) is **not** our Park and Choi
   reference area, so the two cannot be mixed without restating the denominator.
3. **Daane 2021 full text (row G2).** NOAA repository PDF, 47 pp, sha256 `78cf3c28...`, plus the name of the
   supplement holding the plotted values (**Data S1A**). This is the route to closing our figure-only gap in
   `compare-2x2.json` panel B and in `CAUSAL.md`.
4. **Saro-Cortes et al. 2022 (row P6).** A robotic four-winged flying fish at Reynolds number about 30,000 shows
   *"a clear trade-off between stability and lift generation"*: never longitudinally stable at positive pitch, stable
   only at the posterior pelvic positions with negative pitch, and the optimum depends on the stage of locomotion. We
   hold no stability result of any kind. Worth adding to `physics/flier/` as a declared constraint, with their caveat
   that no coefficients were transferred to a fish.
5. **Darwin ch. VI read across the variorum (row A2).** *"Darwin calls flying fish 'our imaginary illustration' ...
   It is a conceivability argument against an objection, not a claim that flying fish are becoming flyers"*, and
   *"Darwin never writes 'Exocoetus' in the 1859/1860/1872 editions (independent grep)"*. Our
   `darwin-origin/claims.json` has no flying-fish claim at all. This is the same correction our prior-art report
   makes when it insists on "fin enlargement for gliding" rather than "fin-to-wing".
6. **Two sharpening negatives on kcnh2a (row T2).** ZFIN's 19 kcnh2a expression rows are **RT-PCR only, no in situ** -
   so they cannot localise to a cell type, which is precisely the resolution our chains report as missing; and in
   Daniocell, kcnh2a's top co-expression partner is kcnmb2 at **r = 0.082**, with all listed correlations small. Both
   strengthen our position that the kcnh2a arm is thin.
7. **A fin-ray bending surrogate (row T3).** `eng-finmech-claim-ei-crit@4998ef85...` gives
   `EI_crit = 1323/2048000 N m2` with an explicit decision rule. It supplies no real material data (EI is an assumed
   log-spaced sweep; the producer calls it a *"DECLARED ILLUSTRATION: not produced by the dx-guilds solver; numbers
   are test values, not a design claim"*), but it is a template that would turn our `breakLoad_ratio` and
   `bendingStress_ratio_sheet` rows from "cannot-evaluate" into evaluable the moment a measured EI appears.
8. **Davenport 2003, named as blocked.** `documentary:src-davenport2003@ac33d249...`: *"NOT READ ... Wiley served a
   Cloudflare challenge"*, with a third-party summary that larger fish place the centre of mass further behind the
   centre of wing pressure, capping two-winged size. A source neither side holds, and the one that would bear on
   maximum size.

---

## 4. What we have that they lack

Fifteen rows. In rough order of value to them.

- **The aerobic-power elimination (row L1).** Sustained aerobic level flight is **eliminated**, kernel-checked:
  `eta*E*Q*Ca = 0.0356593 W` against `P_req = 2943/2185 = 1.34691 W` at 10 m/s with `(L/D)max 4.37`, a **38x**
  shortfall for the real fish; `20601/21850 = 0.94284 W` (**26.4x**) for the hypothetical flier F1; three
  certificates `Delphi.Constraints.Eliminations.elim_*`, compile exit 0 in 12.5 s, 3 of 3 candidates eliminated.
  Their store has **nothing** on this: `aerobic` returns 0 records, `oxygen` returns 3 (all unrelated),
  `cardiac output arterial oxygen content` returns 0. This is the single largest asymmetry and the thing most worth
  offering them - with the ledger's own caveat that the hypotheses at risk are the proxies (snapper Q, trout Ca,
  salmon-ventricle eta) and that the theorem does not bound burst power on white-muscle stores, which is what the
  fish actually uses.
- **The six refutations of textbook limb signalling in zebrafish (rows G7.1 to G7.6).** All six unmatched. Searches
  that would have found a counterpart returned nothing: `apical ectodermal ridge Fgf Wnt` 0,
  `sonic hedgehog zebrafish fin` 0, `wnt10a median fin fold` 0, `HGF MET muscle precursor` 0, `hhip` 0, `prdm1a` 0.
  The 43 hits for `refuted` are every one of them an import of our own claim-tests. Their nearest adjacent record is
  one unrelated methodological Problem, `zebrafish-mutant-morphant-discrepancy-attribution@1b38f9eb...`. Because each
  of our six carries a verbatim quote from a fetched source (Leerberg 2019, Camarata 2010, Neumann 1999,
  Braunstein 2021, Benard 2024, Okamoto 2018), they are directly importable and are probably the highest-value thing
  we could hand over.
- **42 graded causal chains (row G8).** No graded gene-to-phenotype chain exists in their graph; their 10 hits for
  `causal chain` are bioelectric simulation scenarios. Their catalogue also reports `origin_declared: unknown` for
  1214 of 1287 claims, so most of their store has no declared epistemic origin, where every one of our links carries
  a grade.
- **Requirements 2, 3 and 4 of `flier-genome.md` (rows G10, G11, G12).** The myostatin analysis across seven teleost
  species with the explicit warning that the two senses of "16%" are different quantities; the all-negative survey of
  fish globin genetics against a five-times-bat-range requirement; the nine air-breathing routes with the decisive
  negative that **nothing is known for Beloniformes or Exocoetidae**. All three unmatched (`mstn` 0, `myostatin` 0,
  `air breathing gas bladder` 0). The Beloniformes negative is especially worth sending, since their
  `gx-problem-flyingfish-kcnh2-and-others` shows they are actively working that genome and would otherwise have to
  rediscover the same emptiness.
- **Physics verdicts B, C and A with their machinery (rows P1, P2, P3).** We compute from Park and Choi Table 1 and
  Table 2 where their record is abstract-and-relayed only and says *"no coefficients extracted; no calibrated-fish
  claim supported"*; our verdict C (cannot-tell, 22.12 W per kg of body mass required) and our underpowered scaling
  test (gliders 0.104 decades of wing loading, powered 0.931 decades) have no counterpart.
- **The Davenport 1992 allometric exponents (row L4).** We extracted 2.981 / 1.834 / 1.236 from the abstract and
  fired 11 theorems whose isometry hypotheses they violate. Their Davenport 1992 record is a bibliographic
  registration with no exponent in it, and *"its stability argument is not turned into a numeric limit here"*.
- **The staged simulator and its run log (row P4).** `physics/sim/RUNS.md` discloses which tests went post-hoc and
  why, and reconciles a 36.1 m glide against a 35 m Lean pure-glide bound via 8.9 m of taxi-speed-equivalent height.
  Their glide record is a single point-mass model on an assumed polar (C_Lmax 1.2, above the 0.78 measured on the
  Park and Choi specimen).
- **The prior-art survey (row A1).** 59 discover calls, 8 Europe PMC lookups, 22 fetches, 58 DOI checks, Phenoscape
  identified as the closest prior work. Their graph names no prior art in this space at all: `prior art` returns one
  unrelated Wolfram claim, and no record mentions Phenoscape, Uberon, the Cell Ontology, Monarch, the Human Reference
  Atlas or OpenWorm.
- **The gja5a retraction itself (row G4).** Worth sending precisely because they hold the Daane paper and could
  otherwise make the same mistake we made and corrected.

---

## 5. What should change in what we claim

1. **Fix `genotype/map.json:1604`.** Downgrade `lat4a = slc43a2a` from "settled on two records" to "candidate:
   `slc43a2a` or `slc43a2b`, unresolved", and cite `gx-problem-lat4a-identity` as an independent node reaching the
   same conclusion. `HANDOVER.md:67` already demands this; the collaborator's graph makes it unarguable, and adds the
   `slc43a2b` candidate we never considered. Then check whether any chain text or nanopub label leans on the stronger
   wording.
2. **State the shared Lean toolchain if their check is ever cited.** Their Lean 4.35.0 plus mathlib
   `56a005855ea17e0b0958f73ec801ae140b0a1679` is identical to our pin, so two apparently independent Lean checks
   share a trusted base; and their receipt bytes are unretrievable (`availability: "referenced"`,
   `hosted_and_byte_checked: 0`). Cite it as an unverified declaration, or not at all.
3. **Never count the `thompson1917-*` / `darwin1859-*` / `wolfram2002-*` / `levin-*` / `delphi-claim-test--*` records
   as external agreement.** They are our own registry imported into `node-a`, complete with our IRIs, nanopub paths
   and `verification: "lean"` flags. If any dashboard or pitch text counts "a second graph agrees with our Thompson
   claims", that line has to go. This is the double-counting risk the brief worried about, and it is real - just not
   where it was expected: not in the Lean check, but in the claim corpus.
4. **Nothing in the cross-check weakens the lat4a x kcnh2a caveat, the gja5a retraction, the aerobic-power
   elimination or any of the six refutations.** The first is independently corroborated four ways; the second is
   uncontested; the last two are unmatched, so untested from outside.
5. **Two optional strengthenings, if the lead follows them up:** the Fish 1990 wing-loading and aspect-ratio envelope
   would widen `interpretation_A`'s data, and Data S1A would replace `compare-2x2.json` panel B's figure-only status
   with numbers. Both are *their* reads of sources we could fetch ourselves; neither should be restated as ours
   without our own retrieval.
6. **Add the Saro-Cortes stability-lift trade-off to the flier constraints**, and record that we have no stability
   model of our own. It is the one aerodynamic finding they hold that we do not, and it constrains the four-wing
   configuration our forms assume.

## Files

- `crosscheck.json` - 33 rows, machine-readable, with their exact refs and quoted record text.
- `calls.json` - all 240 calls with arguments, timestamps, result-file paths and the three known failures
  (one server-side `storage_error` that succeeded on retry, two malformed-argument rejections that were corrected,
  and `frontier_discover` falling back to lexical mode because the query was not in their embedding cache).
- Raw per-call results are kept out of the repo, under `C:\Temp\xcheck\out\`.
