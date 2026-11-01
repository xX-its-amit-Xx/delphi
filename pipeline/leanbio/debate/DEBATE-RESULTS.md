# DEBATE-RESULTS: what the debate decided, per law

Generated from `out/rulings.json` by `report.mjs`. 12 law(s) ruled on, under criteria
`leanbio-debate-criteria/1.2.0`, sha256 `13ee79891caebd62799dc8947b73de041c9488c39a395861d34cf157a0f10169`.

**Nothing here is accepted.** A survivor is written to the registry as `candidate` (dashed in the studio, served by
the MCP immediately, `binding: false` in `checkDesign`) and a promotion request is queued for a human. See
[`README.md`](README.md), "The automation question".

## The run

| | |
|---|---|
| laws ruled on | 12 |
| verdicts | 1 REJECT, 11 NEEDS-WORK |
| headless `claude -p` invocations | 26 across every run (at most 3 at once; the last run's cap was 20) |
| cost reported by the CLI | $2.22 across every run |
| model | claude-sonnet-5-5 |
| stopped because | the queue emptied |
| criteria locked at | 2026-11-01T05:33:08.573Z, before any debate ran |
| superseded criteria versions | leanbio-debate-criteria/1.1.0, leanbio-debate-criteria/1.0.0 |

4 law(s) were ruled on by the mechanical gates alone, with no worker invocation, because the invocation cap was reached: `fisher-kpp-speed`, `hamilton-rule`, `maynardsmith-hawk-dove`, `turing-wavelength`. Those rulings are marked below; they are honest gate outcomes, not debated verdicts.

## Verdicts

| law | verdict | C1 | C2 | C3 | C4 | C5 | C6 | C7 | debated | record |
|---|---|---|---|---|---|---|---|---|---|---|
| `disc-heterurus-mass-exponent` | **REJECT** | pass | pass | **fail** | pass | contested | **fail** | **fail** | yes | failed-theorem |
| `development-growth-asymptote` | **NEEDS-WORK** | unclear | pass | unclear | unclear | pass | unclear | unclear | yes | candidate-with-requirements |
| `disc-flying-fish-fin-ratio-gap` | **NEEDS-WORK** | pass | pass | **fail** | pass | pass | unclear | pass | yes | candidate-with-requirements |
| `disc-measured-wing-loading-band` | **NEEDS-WORK** | pass | pass | **fail** | pass | pass | pass | pass | yes | candidate-with-requirements |
| `disc-pectoral-length-allometry` | **NEEDS-WORK** | pass | pass | **fail** | pass | pass | unclear | **fail** | yes | candidate-with-requirements |
| `fisher-kpp-speed` | **NEEDS-WORK** | unclear | pass | unclear | unclear | pass | unclear | unclear | gates only | candidate-with-requirements |
| `fisher-sex-ratio` | **NEEDS-WORK** | unclear | pass | unclear | unclear | pass | unclear | unclear | yes | candidate-with-requirements |
| `hamilton-rule` | **NEEDS-WORK** | unclear | pass | unclear | unclear | pass | unclear | unclear | gates only | candidate-with-requirements |
| `kimura-heterozygosity` | **NEEDS-WORK** | unclear | pass | **fail** | pass | pass | unclear | pass | yes | candidate-with-requirements |
| `maynardsmith-hawk-dove` | **NEEDS-WORK** | unclear | pass | unclear | unclear | pass | unclear | unclear | gates only | candidate-with-requirements |
| `turing-ddi` | **NEEDS-WORK** | unclear | pass | **fail** | pass | pass | unclear | pass | yes | candidate-with-requirements |
| `turing-wavelength` | **NEEDS-WORK** | unclear | pass | unclear | unclear | unclear | unclear | unclear | gates only | candidate-with-requirements |

## What the debate REJECTED, and why

### `disc-heterurus-mass-exponent` — REJECT

**Why:** Fires on five wild-type Exocoetidae in its own declared scope (C6). In addition, the bound is a sample CI circular with the fit it came from (C7), and it is declared at family scope on single-subspecies evidence (C3). Do not resubmit unchanged. Narrowing the scope to the subspecies would remove the C6 hits and the E1/E2 contradiction, but it would leave a CI of a fit presented as a law, which cannot constrain a design.

**Note:** propose.mjs had this contested with E1, E2, but a hard gate fails: the candidate is wrong, so the contest is settled against it rather than left open (CRITERIA.md 1.2.0 precedence)

**The wild-type organisms it fires on** (5 of 5 evaluated, all inside the law's own declared scope):

| organism | measured | fails | source |
|---|---|---|---|
| *Cheilopogon atrisignis* | {"massExponent":3.011} | `q.massExponent ≤ 1.484` | physics/length-weight.csv (sha256 5feec47148a2c973) <- FishBase length-weight list page |
| *Cheilopogon unicolor* | {"massExponent":2.971} | `q.massExponent ≤ 1.484` | physics/length-weight.csv (sha256 5feec47148a2c973) <- FishBase length-weight list page |
| *Cypselurus poecilopterus* | {"massExponent":2.908} | `q.massExponent ≤ 1.484` | physics/length-weight.csv (sha256 5feec47148a2c973) <- FishBase length-weight list page |
| *Hirundichthys affinis* | {"massExponent":2.985} | `q.massExponent ≤ 1.484` | physics/length-weight.csv (sha256 5feec47148a2c973) <- FishBase length-weight list page |
| *Hirundichthys oxycephalus* | {"massExponent":2.91} | `q.massExponent ≤ 1.484` | physics/length-weight.csv (sha256 5feec47148a2c973) <- FishBase length-weight list page |

**The referee's ruling:** C6 fails: five real flying-fish species inside the declared Exocoetidae scope have mass exponents of 2.9 to 3.0, well above the law's 1.484 ceiling. Under the 1.2.0 precedence rule that outranks the C5 contest with E1/E2, so this is a rejection and not CONTESTED. The law is just the 95% CI of a 14-specimen fit over an 8 cm length span, tested against the data it was fitted to (C7), and it is declared at family scope on one-subspecies evidence (C3). The proponent itself said it should not be promoted. A slope near 1 is most likely an artefact of the narrow range and small n, not a property of the animal. Record as a failed-theorem, not an open question.

## Every law, in full

### `disc-heterurus-mass-exponent` — **REJECT**

> Within Cheilopogon heterurus doederleini, body mass scales with body length as L^b with b inside its 95% CI [0.478, 1.484] (OLS on log-log, n = 14 specimens, b = 0.981, r^2 = 0.601).

Scope `["Exocoetidae"]`. Decided 2026-11-01T05:44:12.815Z. Record type `failed-theorem`.
Verdicts the gates allowed: REJECT. How: the referee ruled within what the gates allow, with per-criterion reasons.

**PROPONENT** (no web tools; argues from the candidate and the accepted set)

- strongest case: In the only specimen-level dataset we hold for C. heterurus doederleini (14 fish, r^2 = 0.60), the fitted length-weight slope is 0.98 with 95% CI [0.48, 1.48], and that interval excludes the cubic exponent of about 3 that the accepted laws impose, which is an honest flag that this study's data are in tension with the family-level band.
- what it says the law rules out: {"massExponent":3} — A C. heterurus doederleini design committing a fitted mass exponent of 3.0 (isometric cubic scaling) lies outside the 95% CI [0.478, 1.484] from the 14 Makiguchi-2013 specimens, so this law declares it malformed. Likewi…
- bound kind, by its own account: **record-bound** — 
- narrowest scope it will defend: ["Cheilopogon heterurus doederleini"]
- closest accepted law: `E2` — E2 permits a mass exponent in [2.90, 3.02] and forbids anything below 2.90. This law permits only [0.478, 1.484] and so forbids 2.90 to 3.02, which is E2's whole band. The two bands do not overlap, s…
- **it names its own weakest point:** The interval's lower and upper ends are sampling statistics from a very narrow length range (0.257 to 0.340 m), and a slope near 1 is physically implausible for fish mass vs. length (isometry is 3). It is almost certainly an artefact of small n, a narrow range and length-measurement noise, and not a biological property. It also contradicts the accepted laws E1 and E2 in Lean, so promoting it would put the registry in an inconsistent state. I expect the critic to attack here and I do not think the law should be promoted as a constraint.

**CRITIC** (had `WebFetch`/`WebSearch`; never saw the proponent's case)

- would it let this constrain a design? **no**
- worst attack: **scope**
- A 95% CI from 14 specimens spanning an 8 cm length range of one subspecies, declared at family scope, is a description of the sample that is proven contradictory to the accepted E1/E2 bands (2.90-3.02) and would wrongly forbid ordinary flying-fish designs.

| attack | verdict | finding |
|---|---|---|
| vacuity | serious | The law only says the fitted exponent lies in [0.478, 1.484], a band that is the CI of the very fit. Any design committing a mass exponent in that range passes, and the band is so wide it includes isometry-ish values (1.0) and also most implausible ones. The … |
| constants | serious | Both constants (0.478, 1.484) are the endpoints of the 95% CI of the OLS fit to the same CSV; kind is 'derived' only by an inference rule, not declared by the proposer. They are sample statistics, not biological constants. The source cites a CSV with a hash a… |
| scope | fatal | The declared taxon is the family Exocoetidae, but the evidence is 14 specimens of one subspecies (Cheilopogon heterurus doederleini) from one study. The statement itself says 'Within C. heterurus doederleini'. The scope field overreaches by a family, and the … |
| definition-restatement | minor | It is not a definition restatement: it is an empirical regression result. But it is a description of a fit statistic, not a mechanism. It forbids something the accepted laws do not already forbid only in the sense that it contradicts them: E1 and E2 require a… |
| fires-on-real-organism | serious | The accepted laws (E2) cite fitted exponents of 2.90-3.02 from field studies with n of 117 to 2769 in flying fishes, which sit far outside this law's band. I did not fetch those sources, so this rests on the quoted E2 basis. A law that declares those populati… |
| circularity | fatal | The bound is the 95% CI of the fit to all 14 specimens, and the law is then 'tested' against that same fit: the witness b = 0.981 is the fitted slope. Nothing was held back, so it is circular by construction. A CI on a slope also does not bound the true slope… |
| designer-cost | fatal | If accepted, it would turn RED any flying-fish design with a physically sensible cubic-ish mass exponent (2.9-3.02), which is what the large field studies in E2 report. It would also contradict E1/E2 in Lean for the whole family, so every design satisfying on… |

**EVIDENCE** (GET, never HEAD; Europe PMC REST, Crossref, and the repository bytes)

- mechanical fetch: **all-constants-found-in-source** — {"constants":2,"found":2,"not_in_text":0,"text_not_retrievable":0,"unreachable":0}
- the checker worker: all constants verified = **false**. Neither CI bound is verified: the report's 'found' verdicts are artifacts of matching 0.478 and 1.484 to the integers 0 and 1 in unrelated rows. The bounds are fitted OLS statistics (n = 14, wide CI from a narrow length range) that should be recomputed from the makiguchi-2013 mass and length columns, not looked up as literals, and I did not do that recomputation.
- it caught these matcher errors: Both 'found' verdicts are false positives. The matcher fell back to 0-decimal rounding, so 0.478 matched '0' and 1.484 matched '1'. That rule will match any numeric CSV.; The matched contexts come from rows for other sources (a Cypselurus hiraii row and a park-choi-2010 row), not the makiguchi-2013 specimen rows the source string names.; The report did not check the cited row subset or the columns (mass and length) that the fit would be computed from.; The statement also quotes b = 0.981, r^2 = 0.601 and n = 14. These are not listed as constants and were not checked at all.
  - `0.478`: instrument said `found`, checker says `false-positive`, kind seen `derived`
  - `1.484`: instrument said `found`, checker says `false-positive`, kind seen `derived`

**REFEREE** (saw everything; bound by the gates)


| criterion | verdict | reason |
|---|---|---|
| C1 binds something real *(hard gate)* | pass | a witness satisfies the law, and the in-range design {"massExponent":0} is rejected by 0.478 ≤ q.massExponent |
| C2 constants sourced *(hard gate)* | pass | all 2 non-structural constant(s) declared with an allowed kind and a source; every constant was found in its cited source by a GET |
| C3 scope honest | **fail** | Scope declares taxa [Exocoetidae], but all evidence is 14 specimens of one subspecies (Cheilopogon heterurus doederleini) from one study, with lengths of 0.257 to 0.340 m. The statement itself says 'Within Cheilopogon heterurus doederleini'. The proponent conceded this and the critic called it fata… |
| C4 independent | pass | It is not a definition and not a rearrangement of E1/E2. It is a fitted-slope CI with content of its own. It is also not implied by E1/E2: its band [0.478, 1.484] is disjoint from their [2.90, 3.02], and the independence probes show 0 sampled points where it forbids something they allow. The only r… |
| C5 consistent *(hard gate)* | contested | propose.mjs proved a contradiction with E1, E2 in Lean; the accepted law is not demoted and this candidate is not promoted |
| C6 wild type survives *(hard gate)* | **fail** | the law fires on 5 wild-type organism(s) inside its own scope. Cheilopogon atrisignis (Kuroshio off Taiwan / 2008-2017.) has {"massExponent":3.011}, which fails q.massExponent ≤ 1.484 (physics/length-weight.csv (sha256 5feec47148a2c973) <- FishBase length-weight list page). A real animal does not v… |
| C7 not circular | **fail** | The bound is the 95% CI of the OLS fit to all 14 specimens, and the witness is that same fitted slope (0.981). Nothing was held back (n_independent = 0). The statement does not say it is a record or sampling bound, and the caveats mention only the narrow range, one species and one study. The propon… |

**Ruling.** C6 fails: five real flying-fish species inside the declared Exocoetidae scope have mass exponents of 2.9 to 3.0, well above the law's 1.484 ceiling. Under the 1.2.0 precedence rule that outranks the C5 contest with E1/E2, so this is a rejection and not CONTESTED. The law is just the 95% CI of a 14-specimen fit over an 8 cm length span, tested against the data it was fitted to (C7), and it is declared at family scope on one-subspecies evidence (C3). The proponent itself said it should not be promoted. A slope near 1 is most likely an artefact of the narrow range and small n, not a property of the animal. Record as a failed-theorem, not an open question.

**What a human should check:** Recompute the slope and CI from the 14 makiguchi-2013 mass and length rows in physics/glide-data.csv. A slope of about 1 is implausible for fish mass against length, so check for mixed length kinds, a unit or column error, or mass and length swapped in the CSV. Also fix the 0-decimal rounding fallback in the evidence matcher, which can pass any numeric CSV.

---

### `development-growth-asymptote` — **NEEDS-WORK**

> For a cohort whose length at age follows von Bertalanffy, length(t) = Linf*(1 - exp(-K*(t - t0))) with asymptotic length Linf > 0 and Brody coefficient K > 0 (a named hypothesis), length is strictly below Linf at every age, strictly increasing in age, and two cohorts sharing K reach the same fraction of their own asymptote at the same age measured from their own t0, however different their asymptotic lengths.

Scope `["Exocoetidae"]`. Decided 2026-11-01T05:41:18.616Z. Record type `candidate-with-requirements`.
Verdicts the gates allowed: NEEDS-WORK / REJECT. How: the referee worker returned no parseable verdict; the gates decide and the ruling is recorded as unrefereed.

**PROPONENT** (no web tools; argues from the candidate and the accepted set)

- strongest case: Given a declared von Bertalanffy curve with Linf > 0 and K > 0, the Lean theorem proves that no age yields a length at or above Linf, that length rises strictly with age, and that same-K cohorts reach identical fractions of their own asymptote at identical ages since t0, so a design pairing a length with a curve that cannot produce it is malformed.
- what it says the law rules out: {"standard_length_m":0.25,"growth_Linf_m":0.233} — Under the fitted Hirundichthys affinis curve (Linf = 23.3 cm FL, K = 3.12/yr, t0 = 0.01 yr), length is strictly below Linf at every age, so a cohort claiming a length of 25 cm against a 23.3 cm asymptote is malformed: n…
- bound kind, by its own account: **impossibility** — 
- narrowest scope it will defend: ["Hirundichthys affinis (validated row, NW Barbados)","the 7 Exocoetidae species with a FishBase VB row, as compiled fits only"]
- closest accepted law: `E2` — E2 bounds the length-weight exponent b in [2.90, 3.02], so it constrains how mass scales with length for adults in a fitted size range. It says nothing about how length changes with age or about a ce…
- **it names its own weakest point:** The theorem is algebra that follows from the hypothesis: the biology lives entirely in the assumption that the cohort follows VB, which rests on 12 secondary FishBase rows for 7 of 75 species and one validated row whose paper was not seen. The critic will say this is a tautology about a functional form, not a biological law, and that Linf is a fitted mean that real individuals exceed, so the browser check would flag real fish. In addition, growth_Linf_m is not an engine state field, so the check mostly returns cannot-evaluate.

**CRITIC** (had `WebFetch`/`WebSearch`; never saw the proponent's case)

- would it let this constrain a design? **no**
- worst attack: **vacuity**
- The Lean statement is a tautology of the von Bertalanffy formula that no organism can falsify, and the only operational content, SL < a fitted Linf, treats a mean curve parameter from a secondary compilation as a hard maximum length.

| attack | verdict | finding |
|---|---|---|
| vacuity | fatal | The statement is a theorem about the functional form. Under the hypothesis Linf>0, K>0, Linf*(1-exp(-K(t-t0))) < Linf always holds, since exp>0. It is strictly increasing in t since K>0. The shared-K claim is an algebraic identity: 1-exp(-K(t-t0)) does not de… |
| constants | serious | The statement has no constants, but the scope ranges and the default curve have numbers: Linf 23.3 cm, K 3.12/yr, t0 0.01 yr, and ranges Linf 13.5 to 30.5 and K 0.86 to 3.65. They come from a FishBase compilation (kind secondary). The source record says the O… |
| scope | serious | Declared taxa is the whole family Exocoetidae, but the evidence is 12 rows over 7 of 75 species. 68 species have no growth row. The rows come from different localities, years and length types (FL or TL). Only one row is marked validated. The curve is a fit to… |
| definition-restatement | fatal | The law restates the definition of the von Bertalanffy function as a theorem. 'Below the asymptote' and 'K sets the shape' are properties of the formula's algebra, not of an organism. None of E1, E2 or E5 covers growth in time, so the candidate does not dupli… |
| fires-on-real-organism | serious | I did not search for or fetch a specific measurement, so I cannot name an animal and numbers. Structurally, the browser check (SL < Linf) is known to misfire for any VB fit: Linf is the mean asymptote of a fitted curve, and individuals above it are expected i… |
| circularity | serious | The scope ranges (Linf, K) are the min and max of the same 12 rows that make up the evidence, so nothing was held back. There is no independent test. Because the Lean statement is a theorem, no data test it either way. The 12 rows are also not independent: th… |
| designer-cost | serious | As wired to the browser check, a design whose SL is at or above the Linf of its fitted taxon turns RED. A designer who wants a larger-than-average flying fish, which individuals within the wild population can be, would be blocked by a mean fitted parameter. L… |

**EVIDENCE** (GET, never HEAD; Europe PMC REST, Crossref, and the repository bytes)

- mechanical fetch: **nothing-to-check** — {"constants":0,"found":0,"not_in_text":0,"text_not_retrievable":0,"unreachable":0}
- the checker worker did not run (every constant was found verbatim in its cited source, or the invocation cap was reached).

**REFEREE** (saw everything; bound by the gates)


| criterion | verdict | reason |
|---|---|---|
| C1 binds something real *(hard gate)* | unclear | the candidate declares no shared_scope.atoms, so the studio has nothing to evaluate and the law binds no design today. The proposer did not say whether this is deliberate; declare shared_scope.atoms over quantities a design carries, or declare browser_check_absent with missing_inputs |
| C2 constants sourced *(hard gate)* | pass | the statement carries no empirical constant (structural literals only), so there is nothing to source |
| C3 scope honest | unclear | the referee gave no reason |
| C4 independent | unclear | the referee gave no reason |
| C5 consistent *(hard gate)* | pass | propose.mjs constructed a joint witness with every accepted law whose scope overlaps |
| C6 wild type survives *(hard gate)* | unclear | the candidate declares no shared_scope.atoms, so there is no formula to evaluate against a wild-type organism: C6 is untested, not satisfied |
| C7 not circular | unclear | the referee gave no reason |

---

### `disc-flying-fish-fin-ratio-gap` — **NEEDS-WORK**

> Every measured flying fish has pectoral/SL at least 0.406, and every measured non-flying-fish beloniform (flying halfbeaks, halfbeaks, needlefish) at most 0.389: the groups do not overlap (n = 49 flying fish, 60 others).

Scope `["Beloniformes"]`. Decided 2026-11-01T05:35:24.308Z. Record type `candidate-with-requirements`.
Verdicts the gates allowed: NEEDS-WORK / REJECT. How: the referee ruled within what the gates allow, with per-criterion reasons.

**PROPONENT** (no web tools; argues from the candidate and the accepted set)

- strongest case: In 109 measured beloniform specimens, the shortest-finned flying fish (0.406 pectoral/SL) still exceeds the longest-finned non-flying relative (0.389), so a single threshold cleanly separates gliders from non-gliders in this dataset.
- what it says the law rules out: {"flyingFishMinFinRatio":0.35,"otherBeloniformMaxFinRatio":0.389} — The law asserts 0.406 <= flyingFishMinFinRatio and otherBeloniformMaxFinRatio <= 0.389, with the non-flying maximum strictly below the flying minimum. A design with a 'flying fish' whose pectoral/SL is 0.35 (below 0.406…
- bound kind, by its own account: **record-bound** — 
- narrowest scope it will defend: ["the specific flying fish (Exocoetidae), flying halfbeak, halfbeak and needlefish specimens in Daane 2021 Data S1A"]
- closest accepted law: `none (the accepted-laws list for overlapping scope is empty)` — No accepted law overlaps this scope, so there is nothing for it to restate. That is weaker support than it sounds: the absence of overlap only shows nobody has accepted a rival, not that the law carr…
- **it names its own weakest point:** It is a record bound with no mechanism: the extremes come from one museum dataset (n = 49 versus 60), the constants are only 'cited' by inference, and the 0.017 gap could close with one new specimen, so it may not constrain any organism design the studio could actually build.

**CRITIC** (had `WebFetch`/`WebSearch`; never saw the proponent's case)

- would it let this constrain a design? **no**
- worst attack: **circularity**
- The 0.406 and 0.389 bounds are just the sample minimum and maximum of the 109 specimens they were derived from, with no held-out data, so the law describes one dataset, not a constraint on Beloniformes.

| attack | verdict | finding |
|---|---|---|
| vacuity | serious | The statement is a description of a sample's min and max, not a rule about organisms. Its atoms only compare two summary quantities, and the witness satisfies them with equal values (0.406 and 0.389). Any dataset with a gap would pass. It can only be false fo… |
| constants | serious | Both constants are labelled 'cited', but the label was inferred by candidates.mjs, not declared. The source is a local cache CSV plus 'Daane 2021 Data S1' with no table, column or row named. 0.406 and 0.389 are really the rounded sample min (0.40625) and samp… |
| scope | serious | Declared taxa is Beloniformes, but the evidence is 109 museum specimens from one dataset, in three non-flying groups (flying halfbeak, halfbeak, needlefish). Beloniformes also includes sauries (Scomberesocidae) and ricefishes/medaka (Adrianichthyidae), which … |
| definition-restatement | minor | It is not a definition. It is an empirical separation between two groups. However, it is partly circular with the group definition: 'flying fish' are defined by gliding, which is associated with enlarged pectoral fins, so a gap in relative pectoral length is … |
| fires-on-real-organism | survives | I did no searches and fetched nothing. I have no measurement of a non-avian beloniform that breaks the gap, so I make no claim either way. Candidates worth checking are short-finned or juvenile exocoetids (for example, two-wing versus four-wing flying fish, a… |
| circularity | fatal | The bound is the min and max of the same 109 specimens it is 'tested' on. Nothing was held back. The number of independent observations is at most 109 specimens, and fewer in terms of species, since specimens within a species are not independent. The law desc… |
| designer-cost | serious | If it turned designs RED, it would forbid any beloniform with a pectoral/SL between 0.389 and 0.406, and would imply that a non-flying beloniform with a pectoral/SL above 0.389, or a flying fish below 0.406, is invalid. That would block intermediate or transi… |

**EVIDENCE** (GET, never HEAD; Europe PMC REST, Crossref, and the repository bytes)

- mechanical fetch: **all-constants-found-in-source** — {"constants":2,"found":2,"not_in_text":0,"text_not_retrievable":0,"unreachable":0}
- the checker worker: all constants verified = **false**. Neither 0.406 nor 0.389 was verified: the 'found' verdicts are matcher false positives on a rounded '0.4' in a halfbeak row, the cached CSV's hash does not match the cited hash, and both numbers are group min/max ratios derived from length columns (0.40625 and 0.38843), so they need recomputation from a hash-verified copy of Data S1 before the gap claim can be trusted.
- it caught these matcher errors: Both constants were 'found' only through a 1-decimal rounding to '0.4', which matches almost any number in the file. The context shown is a halfbeak row with a raw length value of 0.4. It is not 0.406 or 0.389, and it is not a ratio.; Both constants were given an identical matched context, which shows the match was not specific to either number.; The cited hash 9c941299f5869e56 does not match the file's computed sha256 prefix 4f654c701f6196dc (hash_ok: false). The report still declared 'all-constants-found-in-source'. The file in the repo is not the file the law cites, so its provenance is unconfirmed.; The law's numbers are derived statistics (the min and max of recomputed ratios) and would not appear verbatim in a raw data CSV. A text-search matcher cannot verify them. They need recomputation from the length columns.
  - `0.406`: instrument said `found`, checker says `false-positive`, kind seen `derived`
  - `0.389`: instrument said `found`, checker says `false-positive`, kind seen `derived`

**REFEREE** (saw everything; bound by the gates)


| criterion | verdict | reason |
|---|---|---|
| C1 binds something real *(hard gate)* | pass | a witness satisfies the law, and the in-range design {"flyingFishMinFinRatio":0,"otherBeloniformMaxFinRatio":0.389} is rejected by 0.406 ≤ q.flyingFishMinFinRatio; q.otherBeloniformMaxFinRatio < q.flyingFishMinFinRatio |
| C2 constants sourced *(hard gate)* | pass | all 2 non-structural constant(s) declared with an allowed kind and a source; every constant was found in its cited source by a GET |
| C3 scope honest | **fail** | Scope declares taxa Beloniformes with no life stages, but the evidence is 109 museum specimens from one dataset (Daane 2021 Data S1A) covering flying fish plus only flying halfbeaks, halfbeaks and needlefish. Sauries (Scomberesocidae) and Adrianichthyidae are unsampled, and no life stage is recorde… |
| C4 independent | pass | No accepted law overlaps this scope, so it restates nothing. It is an empirical separation of two groups, not a definition or an algebraic rearrangement. The critic's point that it is partly a correlate of how 'flying fish' are grouped (gliding implies long pectorals) is a minor mechanism-independe… |
| C5 consistent *(hard gate)* | pass | propose.mjs constructed a joint witness with every accepted law whose scope overlaps |
| C6 wild type survives *(hard gate)* | unclear | 24 wild-type organism(s) are in scope but none carries flyingFishMinFinRatio, otherBeloniformMaxFinRatio: the law cannot be evaluated against a real animal, so it may not be promoted |
| C7 not circular | pass | The thresholds are the min and max of the same 109 specimens, with nothing held out, so this is a record bound. It is not presented as an impossibility. statement_en says 'every measured' and 'n = 49 ... 60', evidence.caveats says 'not an impossibility; one new specimen can break it', and the propo… |

**Ruling.** No hard gate fails, but C6 is unclear and C3 fails, so the law cannot be promoted. The law is an honestly labelled record bound over a single dataset: the flying-fish minimum pectoral/SL of 0.40625 exceeds the non-flying-beloniform maximum of 0.38843 in 109 specimens. It is not sold as an impossibility, so it is not a C7 reject, and it restates no accepted law. The scope claims the whole order Beloniformes on one museum dataset, and the atoms are group extremes that no wild-type organism carries, so the studio cannot test it against any animal. The sourcing is also doubtful, because the evidence checker found the cached CSV's hash does not match the cited one.

**What would make it promotable:**

- Narrow scope to taxa: [Exocoetidae, Hemiramphidae, Belonidae, as sampled in Daane 2021 Data S1A], life_stages: [adult], and state it is museum specimens (n = 109). Drop the claim over Beloniformes as an order.
- Fix the source citation: re-fetch Data S1A, record its true sha256 (the cached file hashes to 4f654c701f6196dc, not the cited 9c941299f5869e56), and cite a table or column locator plus a DOI/PMID for Daane 2021. [WITHDRAWN: the cited hash is correct; the hash check itself was the bug - see corrections]
- Declare meta.constants explicitly with kind 'derived' (not an inferred 'cited'), stating the derivation: min/max of pectoral length over standard length across the 49 flying-fish and 60 other rows. Give the unrounded values 0.40625 and 0.38842975, and note the rounding is conservative (0.406 < 0.40625 and 0.389 > 0.38843, so the stated gap is slightly narrower than the measured one).
- Make the law checkable per organism by declaring a per-animal quantity (pectoralOverSL) and a group-membership input, so the atoms read 'flying fish: pectoralOverSL ≥ 0.406; non-flying beloniform: pectoralOverSL ≤ 0.389'. Add measured pectoral/SL values to wildtype.json for the in-scope species so C6 can evaluate. Alternatively supply held-out specimens, which also addresses C7.
- Keep the record-bound wording in statement_en and caveats, and add that the 0.389 to 0.406 band is an unobserved gap in the sample, not a forbidden region (transitional or juvenile forms are not excluded).

**What a human should check:** Recompute the minimum pectoral/SL over the 49 flying-fish rows and the maximum over the 60 non-flying rows from a hash-verified copy of Daane 2021 Data S1A. No role did this: the evidence checker read nothing, and the cached file's hash mismatches the cited one. Confirm 0.40625 and 0.38843, and confirm which species and life stages the 109 rows cover.

---

### `disc-measured-wing-loading-band` — **NEEDS-WORK**

> Every measured flying-fish specimen with mass and lifting area in the project has wing loading W/(A_pectoral + A_pelvic + A_body) between 37.025 and 46.375 N/m^2 (n = 4).

Scope `["Exocoetidae"]`. Decided 2026-11-01T05:34:31.786Z. Record type `candidate-with-requirements`.
Verdicts the gates allowed: PROMOTE-TO-CANDIDATE / NEEDS-WORK / REJECT. How: the referee ruled within what the gates allow, with per-criterion reasons.

**PROPONENT** (no web tools; argues from the candidate and the accepted set)

- strongest case: Across the four Park and Choi 2010 Cypselurus hiraii specimens, the measured wing loading lies in 37.0 to 46.4 N/m^2, which is a transparent, reproducible flag for any design that sits well outside the only measured flying-fish wing loadings in the project.
- what it says the law rules out: {"wingLoading":80} — A design with W/(A_pectoral+A_pelvic+A_body) = 80 N/m^2 is about 1.7x the highest measured value (46.375) and about 2.2x the lowest-adjacent measured values, so it falls outside the band and is flagged as outside everyt…
- bound kind, by its own account: **record-bound** — 
- narrowest scope it will defend: ["Cypselurus hiraii"]
- closest accepted law: `E1` — E1 constrains scaling exponents (areaExponent < 2, wingLoadingExponent > 1, massExponent in [2.90, 3.02]) and says nothing about the absolute level of wing loading in N/m^2. This law forbids a design…
- **it names its own weakest point:** n = 4 of one species, in stuffed or model form, with three near-identical sizes. The declared family-wide scope (Exocoetidae) is not supported, and wing loading naturally rises with body size (about L^1 in isometry), so the band is a statement about one body size and not a property of the family. The 37.025 and 46.375 literals also differ from the listed support values (37.026, 46.374) by 0.001, which the critic may call a provenance mismatch.

**CRITIC** (had `WebFetch`/`WebSearch`; never saw the proponent's case)

- would it let this constrain a design? **no**
- worst attack: **circularity**
- The 37.025-46.375 N/m^2 band is the min and max of four prepared models of one species, so it holds by construction and cannot be extended to the family Exocoetidae.

| attack | verdict | finding |
|---|---|---|
| vacuity | serious | The law is not a tautology: a fish with wing loading 30 or 60 N/m^2 would falsify it. But the bound is just the min and max of four numbers, so it is a description of the sample. Any fish that is not one of these four records can fail it. |
| constants | serious | The bounds 37.025 and 46.375 are the sample minimum and maximum, each widened by about 0.001. So they are fitted to the data and are not independent measurements. The kind 'measured' was inferred by candidates.mjs, not declared. The source names 'Table 1' of … |
| scope | fatal | The declared scope is the whole family Exocoetidae, but the evidence is 4 stuffed or model specimens of one species, Cypselurus hiraii. They are not four independent organisms. They are probably four prepared models of one species, and model M has its pelvic … |
| definition-restatement | minor | The statement is not a definition. But E1 already gives wingLoadingExponent > 1, which means loading rises with size. A constant band over a family contradicts that growth. E2 and E5 constrain mass exponent and fin ratio, and they do not overlap this law. So … |
| fires-on-real-organism | serious | I found no measurement of a non-avian organism that violates the band, and I did not search. By E1's allometry (wing loading exponent > 1), a juvenile or an adult much larger than SL 0.2 m would leave the band. That is an inference from E1 and I have no measu… |
| circularity | fatal | The bounds are the min and max of the 4 values, so every one of the 4 passes by construction. Nothing was held back. The effective independent n is at most 1 species, and probably less, because the four rows are likely related models of the same fish. The ban… |
| designer-cost | serious | If the band makes designs RED, it forbids any Exocoetidae design outside 37 to 46 N/m^2. That includes larger or smaller flying fish, and other genera such as Exocoetus. Under E1, a larger fish has a higher loading, so a legitimate lineage is excluded. The ba… |

**EVIDENCE** (GET, never HEAD; Europe PMC REST, Crossref, and the repository bytes)

- mechanical fetch: **all-constants-found-in-source** — {"constants":2,"found":2,"not_in_text":0,"text_not_retrievable":0,"unreachable":0}
- the checker worker: all constants verified = **false**. Neither 37.025 nor 46.375 appears in the cited source: the FETCH_REPORT hits are false positives on an unrelated row. The numbers are padded band edges derived from four computed wing loadings (37.026 to 46.374) on stuffed specimens of one species, and I could not read the CSV, so the law's numbers remain unverified.
- it caught these matcher errors: Both matches are spurious: the quoted context holds neither 37.025 nor 46.375, and the same context is reported for both constants.; The 'kg vs g, rounded' rule is too permissive. It accepted a match with no numeric relation to the target.; The matcher did not flag that the literals (37.025, 46.375) differ from the support values (37.026, 46.374). The band edges are not source values.; The wing loading is not a column in the CSV (the snippet shows mass and areas only). It is computed as weight over area, so the 'measured' kind is wrong. The literals are derived and then padded.
  - `37.025`: instrument said `found`, checker says `false-positive`, kind seen `derived`
  - `46.375`: instrument said `found`, checker says `false-positive`, kind seen `derived`

**REFEREE** (saw everything; bound by the gates)


| criterion | verdict | reason |
|---|---|---|
| C1 binds something real *(hard gate)* | pass | a witness satisfies the law, and the in-range design {"wingLoading":0} is rejected by 37.025 ≤ q.wingLoading |
| C2 constants sourced *(hard gate)* | pass | all 2 non-structural constant(s) declared with an allowed kind and a source; every constant was found in its cited source by a GET |
| C3 scope honest | **fail** | Scope declares the whole family Exocoetidae with no life stages and no ranges. All four observations are models or stuffed specimens of Cypselurus hiraii (Park and Choi 2010), at about SL 0.2 m, and L1, L2 and L3 are near-identical in size. The proponent concedes the scope is wider than the evidenc… |
| C4 independent | pass | It is not a definition. E1 constrains scaling exponents, E2 the mass exponent, and E5 pectoral/SL; none fixes an absolute wing loading in N/m^2, so the candidate adds a constraint none of them imposes. The critic's claim that it conflicts with E1 is an inference with no measurement, and the C5 gate… |
| C5 consistent *(hard gate)* | pass | propose.mjs constructed a joint witness with every accepted law whose scope overlaps |
| C6 wild type survives *(hard gate)* | pass | the law holds for all 4 wild-type organism(s) in scope that carry wingLoading (Cypselurus hiraii, Cypselurus hiraii, Cypselurus hiraii, Cypselurus hiraii) |
| C7 not circular | pass | The band is the min and max of its own four values, so it holds by construction, which makes the circularity attack factually right. But statement_en limits the claim to 'every measured specimen ... in the project (n = 4)', and the caveats say 'a record bound, not an impossibility'. It is presented… |

**Ruling.** The law is an honest record bound: the min and max wing loading of four Park and Choi 2010 Cypselurus hiraii models, with caveats saying it is not an impossibility. No hard gate failed and it adds content that E1, E2 and E5 lack. It fails C3 because it declares the whole family Exocoetidae on evidence from one species, mostly near-identical prepared models. That is fixable by narrowing the scope, so this is NEEDS-WORK and not REJECT. It cannot be promoted until the scope is narrowed and the provenance of the band edges is cleaned up.

**What would make it promotable:**

- Declare scope taxa: ["Cypselurus hiraii"] and not Exocoetidae, with life_stages stated as prepared models/stuffed specimens and a ranges entry for standard length of about 0.20 m (the Park and Choi L1, L2, L3 and M sizes).
- Restate statement_en as a record over 4 Park and Choi 2010 models (n = 4, effective independent n of 1 to 2), and keep the caveat 'a record bound, not an impossibility'. Note that model M has its pelvic fins folded.
- Fix the constants: either set the edges to the exact values 37.026 and 46.374, or declare 37.025 and 46.375 as derived (min/max of the four computed values, widened by 0.001) with the derivation stated. Declare the kind explicitly and drop the inferred 'measured', because wing loading is computed from mass and area and is not a CSV column.
- Re-run the evidence check so that it reads physics/glide-data.csv and shows the mass and area rows that give the four loadings.

**What a human should check:** Open physics/glide-data.csv and confirm that the four computed wing loadings are 45.092, 37.026, 46.374 and 40.208, and that 37.025 and 46.375 are padded edges and not source values. That settles the C2 dispute between the gate and the evidence checker.

---

### `disc-pectoral-length-allometry` — **NEEDS-WORK**

> Across museum flying-fish specimens, pectoral fin length scales with standard length as SL^b with the exponent inside its 95% CI [1.017, 1.099] (OLS on log-log, n = 49, b = 1.058, r^2 = 0.983).

Scope `["Exocoetidae"]`. Decided 2026-11-01T05:35:40.226Z. Record type `candidate-with-requirements`.
Verdicts the gates allowed: NEEDS-WORK / REJECT. How: the referee ruled within what the gates allow, with per-criterion reasons.

**PROPONENT** (no web tools; argues from the candidate and the accepted set)

- strongest case: In 49 preserved specimens from 3 Exocoetidae species spanning SL 1.68-24 cm, pectoral length scales almost isometrically with SL (b = 1.058, 95% CI [1.017, 1.099], r^2 = 0.983), which gives the Design Studio a size-scaling check that E5's single-size ratio band cannot provide.
- what it says the law rules out: {"finLengthExponent":0.8} — A committed pectoral-length-on-SL log-log slope of 0.8 (negative allometry, fin relatively shorter as the fish grows) lies below the CI lower bound 1.017. The law also rejects an exponent of 1.25 (strong positive allome…
- bound kind, by its own account: **record-bound** — 
- narrowest scope it will defend: ["Exocoetidae (3 species in the sample, preserved museum specimens only)"]
- closest accepted law: `E5` — E5 bounds the ratio pectoral/SL at one size: 0.406 to 0.823, per specimen. This law bounds how the ratio changes with size, the log-log slope. A design can keep every specimen's ratio inside [0.406, …
- **it names its own weakest point:** The band is a CI of a sample estimate from one dataset, so it is a statement about the sampling uncertainty of the mean slope and not a limit on organisms. A designer's committed exponent is a single value, and a value like 1.00 or 1.12 falling outside the CI would be flagged even though it is well within what the data (r2 0.983) and within-species variation could produce. The pooling of 3 species with ontogeny is a second serious weakness: the exponent may be a Simpson-type artefact. It also shares its single source with E5, so it is not independent evidence.

**CRITIC** (had `WebFetch`/`WebSearch`; never saw the proponent's case)

- would it let this constrain a design? **no**
- worst attack: **circularity**
- The band is the 95% confidence interval of a pooled OLS fit to 49 museum specimens from only 3 species, tested against that same sample with nothing held back, and it is declared for the whole family Exocoetidae. It describes the sample rather than biology, and it only marginally excludes isometry.

| attack | verdict | finding |
|---|---|---|
| vacuity | serious | The law is a statement about a single fitted quantity, finLengthExponent, with atoms 1.017 ≤ b ≤ 1.099. The witness b = 1.058 is simply the fit's own point estimate. The only way the law can be false is if a designer commits an exponent outside the band. It s… |
| constants | serious | Both constants are statistics computed from the same 49-specimen file. They are 'derived' only in the sense that the proposer's own script produced them. The kind was inferred by candidates.mjs, not declared. The CI is a sampling statement, not a biological c… |
| scope | serious | The declared scope is the whole family Exocoetidae, but the evidence is 49 preserved museum specimens from only 3 species. Exocoetidae has roughly 70 species in several genera. The pooled fit mixes between-species and ontogenetic variation (SL 1.68 to 24 cm, … |
| definition-restatement | serious | E5 already bounds pectoral/SL to 0.406-0.823 from the same Daane Data S1 file. A slope near 1 (isometry) is largely the same fact restated in log form. The law is a different summary of the same 49 points as E5. It forbids something E5 does not only in that i… |
| fires-on-real-organism | minor | I did not find or fetch a published per-species pectoral-on-SL slope for a flying fish, so I cannot name a counterexample with measurements. The law would be falsified by a within-species ontogenetic series with a slope outside [1.017, 1.099], and the pooled … |
| circularity | fatal | The band is the 95% CI of the very fit that produced it, tested on the same 49 specimens. The witness is the fitted b, so it passes by construction. No observations were held back. A 95% CI also does not bound the exponent of a new population or a new species… |
| designer-cost | serious | The law would turn a design RED if its committed fin-length exponent is below 1.017 (including exact isometry, b = 1) or above 1.099. Isometric growth is a normal developmental pattern, and the data reject it only marginally (t about 2.01). A species with str… |

**EVIDENCE** (GET, never HEAD; Europe PMC REST, Crossref, and the repository bytes)

- mechanical fetch: **all-constants-found-in-source** — {"constants":2,"found":2,"not_in_text":0,"text_not_retrievable":0,"unreachable":0}
- the checker worker: all constants verified = **false**. Neither 1.017 nor 1.099 is verified as appearing in the source: both are derived OLS CI bounds (the computed values are 1.0176 and 1.0982, outward-rounded) that the fetch report's 1-decimal matcher falsely matched to raw data cells (1.0 and 1.1). The cited CSV hash also does not match the file in the repo, so the law should be treated as unverified until someone recomputes the fit from the correctly hashed Data S1A.
- it caught these matcher errors: Rounding-to-1-decimal matching turned the 3-decimal values 1.017 and 1.099 into 1.0 and 1.1, which match ordinary raw data cells. Both 'found' verdicts are false positives.; The matcher does not distinguish a raw measurement from a derived statistic. A fitted CI bound cannot be 'found' in the source data by string match. It would have to be recomputed from the data.; The repo file hash mismatch (cited 9c941299f5869e56, actual 4f654c701f6196dc, hash_ok false) did not stop the report from giving a 'found' verdict.; Europe PMC full text was 0 bytes (open_access false), so only the abstract and the CSV were searched. The paper's text was never checked.
  - `1.017`: instrument said `found`, checker says `false-positive`, kind seen `derived`
  - `1.099`: instrument said `found`, checker says `false-positive`, kind seen `derived`

**REFEREE** (saw everything; bound by the gates)


| criterion | verdict | reason |
|---|---|---|
| C1 binds something real *(hard gate)* | pass | a witness satisfies the law, and the in-range design {"finLengthExponent":0} is rejected by 1.017 ≤ q.finLengthExponent |
| C2 constants sourced *(hard gate)* | pass | all 2 non-structural constant(s) declared with an allowed kind and a source; every constant was found in its cited source by a GET |
| C3 scope honest | **fail** | Scope declares the whole family Exocoetidae with empty life_stages and empty ranges. The evidence is 49 preserved specimens from 3 species, pooled across species and ontogeny, SL 1.68-24 cm, larvae and juveniles included. The proponent concedes the scope is wider than the evidence, and the critic a… |
| C4 independent | pass | E5 bounds the pectoral/SL ratio at a single size, and this law bounds the log-log slope across sizes. A design with every specimen's ratio inside [0.406, 0.823] can still have a slope of 0.8 or 1.25, which E5 permits and this law rejects. E1 and E2 constrain mass and area exponents and share no qua… |
| C5 consistent *(hard gate)* | pass | propose.mjs constructed a joint witness with every accepted law whose scope overlaps |
| C6 wild type survives *(hard gate)* | unclear | 24 wild-type organism(s) are in scope but none carries finLengthExponent: the law cannot be evaluated against a real animal, so it may not be promoted |
| C7 not circular | **fail** | The proponent concedes this is a record bound: the 95% CI of a pooled OLS fit, tested on the same 49 specimens (which clustered by species/lot give about 3 independent species-level observations), with nothing held back. The witness is the fitted point estimate, so it passes by construction. The st… |

**Ruling.** The law binds a single quantity, the pooled log-log slope of pectoral length on SL, to the 95% CI [1.017, 1.099] from 49 preserved specimens of 3 species. It does add a size-scaling constraint that E5's single-size ratio band does not. It cannot be promoted for three reasons. C6 is unclear because no in-scope wild-type organism carries the exponent. C3 fails because the family-wide scope rests on 3 unnamed species with pooled ontogeny. C7 fails because a record bound is not labelled as one. The C2 gate passes, but the evidence checker shows the 'found' verdicts were matcher false positives, the cited file hash does not match, and the CI bounds were never recomputed. None of the defects is un-fixable, so this is NEEDS-WORK, not REJECT.

**What would make it promotable:**

- Narrow scope to the 3 sampled species, named, with life_stages covering larva/juvenile/adult as pooled, ranges SL 1.68-24 cm, and state 'preserved specimens, pooled across species and ontogeny'. Do not declare Exocoetidae.
- State in statement_en and evidence.caveats that this is a record bound: the CI of a pooled OLS slope in a single sample of 49 specimens, with no held-back data and about 3 independent species-level observations. It is not an impossibility.
- Fix the provenance: reconcile the cited sha256 (9c941299f5869e56) with the repo file (4f654c701f6196dc), then recompute the OLS slope and CI from the correctly hashed Data S1A. Declare 1.017 and 1.099 as derived with the stated derivation (the recomputation script and its rounding), not found by string match. [WITHDRAWN: the cited hash is correct; the hash check itself was the bug - see corrections]
- Make C6 evaluable: add a finLengthExponent to wildtype.json for in-scope organisms. Compute it only from within-species size series where such data exist (for example, per-species slopes from the same Data S1A rows), or else keep the law out of the Studio.
- Consider reporting the exponent per species, or an RMA slope, so that the pooled Simpson-type artefact the proponent flags can be checked.

**What a human should check:** Which file Data S1A actually is: whether the repo CSV (hash 4f654c701f6196dc) is the one the 49-specimen fit was run on, and whether recomputing the fit from it reproduces slope 1.058 and CI [1.0176, 1.0982].

---

### `fisher-kpp-speed` — **NEEDS-WORK**

> For a Fisher-KPP gene wave with dispersal coefficient D > 0, selection coefficient s > 0 and minimal speed c > 0 satisfying c^2 = 4*s*D (a named hypothesis), the relation c*k <= D*k^2 + s holds at every exponential decay rate k, strictly except at the single minimiser 2*D*k = c, so c is the minimum of the family of linear spreading speeds and is attained at exactly one decay rate; and at fixed dispersal a larger selection coefficient gives a strictly larger minimal speed.

Scope `["any"]`. Decided 2026-11-01T05:36:45.623Z. Record type `candidate-with-requirements`.
Verdicts the gates allowed: NEEDS-WORK / REJECT. How: the referee worker returned no parseable verdict; the gates decide and the ruling is recorded as unrefereed.

**EVIDENCE** (GET, never HEAD; Europe PMC REST, Crossref, and the repository bytes)

- mechanical fetch: **all-constants-found-in-source** — {"constants":1,"found":1,"not_in_text":0,"text_not_retrievable":0,"unreachable":0}
- the checker worker did not run (every constant was found verbatim in its cited source, or the invocation cap was reached).

**REFEREE** (saw everything; bound by the gates)


| criterion | verdict | reason |
|---|---|---|
| C1 binds something real *(hard gate)* | unclear | the candidate declares no shared_scope.atoms, so the studio has nothing to evaluate and the law binds no design today. The proposer says so itself (browser_check_absent: provable-but-not-checkable; it would need dispersal_coefficient_D (km^2 per generation), selection_coefficient_s (dimensionless),… |
| C2 constants sourced *(hard gate)* | pass | all 1 non-structural constant(s) declared with an allowed kind and a source; every constant was found in its cited source by a GET |
| C3 scope honest | unclear | the referee gave no reason |
| C4 independent | unclear | the referee gave no reason |
| C5 consistent *(hard gate)* | pass | propose.mjs constructed a joint witness with every accepted law whose scope overlaps |
| C6 wild type survives *(hard gate)* | unclear | no wild-type organism in leanbio-debate-wildtype/1.0.0 falls inside the scope ["any"]: the law is untested against any real animal, so it may not be promoted (CRITERIA.md C6) |
| C7 not circular | unclear | the referee gave no reason |

---

### `fisher-sex-ratio` — **NEEDS-WORK**

> For a rare mutant parent with resource R > 0 splitting fraction x into sons (cost cs > 0 each) and the rest into daughters (cost cd > 0 each) in a population of Nm > 0 males and Nd > 0 females, with Shaw-Mohler fitness wAlloc(x) = (1-x)*R/cd + x*R*Nd/(cs*Nm) (a named hypothesis): if cs*Nm < cd*Nd then fitness strictly increases in x so a more male-biased parent strictly invades; if cd*Nd < cs*Nm then a more female-biased parent strictly invades; and only when cs*Nm = cd*Nd does every allocation do equally well. Hence no sex allocation is uninvadable unless total investment in the two sexes is equal, of which the 1:1 ratio is the special case cs = cd.

Scope `["any"]`. Decided 2026-11-01T05:42:36.742Z. Record type `candidate-with-requirements`.
Verdicts the gates allowed: NEEDS-WORK / REJECT. How: the referee worker returned no parseable verdict; the gates decide and the ruling is recorded as unrefereed.

**PROPONENT** (no web tools; argues from the candidate and the accepted set)

- strongest case: Given the Shaw-Mohler fitness function, kernel-checked arithmetic shows that any sex allocation with cs*Nm ≠ cd*Nd is strictly invadable by a more biased rare mutant, so a design claiming evolutionary stability for unequal total investment is refuted, with 1:1 as the special case cs = cd.
- what it says the law rules out: {"R":1,"cs":1,"cd":1,"Nm":100,"Nd":50} — Here cs*Nm = 100 > cd*Nd = 50. Then wAlloc(x) = (1-x)*1 + x*50/100 = 1 - 0.5x, which strictly decreases in x. A more female-biased rare mutant therefore strictly invades, so a design that claims this allocation (2 males…
- bound kind, by its own account: **impossibility** — 
- narrowest scope it will defend: ["Sexual, panmictic species with autosomal sex-ratio control, one father and one mother per offspring, no local mate competition and no sex-specific resource competition, in the formal model only"]
- closest accepted law: `fisher-ftns` — fisher-ftns says mean fitness rises at a rate equal to the variance in fitness, for fixed fitnesses at one locus. It is silent on sex allocation and permits any unequal-investment allocation to be a …
- **it names its own weakest point:** The theorem is linear algebra on wAlloc, which is an assumed hypothesis that already encodes the Fisher argument (reproductive value inversely proportional to sex number). Nm and Nd are held fixed rather than responding to the population's mean allocation, and no observation tests anything. The critic will say the Lean proof adds rigor to an assumption and not to biology, and that the declared 'any' taxa scope is much wider than the model's panmictic, autosomal, no-LMC conditions.

**CRITIC** (had `WebFetch`/`WebSearch`; never saw the proponent's case)

- would it let this constrain a design? **no**
- worst attack: **definition-restatement**
- The theorem is the sign of the slope of a linear function whose form (Fisher's whole argument) is assumed as a hypothesis, and the browser row maps it onto adult counts and an 'any' taxon scope that its own basis contradicts, so it would flag stable-but-unequal designs without having been tested against any organism.

| attack | verdict | finding |
|---|---|---|
| vacuity | serious | As a Lean theorem it is vacuous. Under SexRatioHyp, wAlloc is affine in x with slope R(cd*Nd - cs*Nm)/(cd*cs*Nm). Every positive assignment of R, cs, cd, Nm, Nd satisfies exactly one of the three cases, so the theorem cannot be false for any input. The browse… |
| constants | minor | The law declares no constants, so nothing is miscalibrated. The substantive input, the Shaw-Mohler fitness form, is a named hypothesis. It is cited to Fisher (1930, a book with no DOI) and to Shaw & Mohler 1953, with no page, table or equation number given. I… |
| scope | serious | taxa ['any'] with an empty observations list claims every organism. The basis then excludes most of them: it requires panmixia, autosomal control, no LMC and no local resource competition or enhancement. Sex-linked drivers, haplodiploid worker control, hermap… |
| definition-restatement | serious | The Lean content is the sign of the slope of a linear function that the hypothesis hands over, and that hypothesis already encodes Fisher's argument (reproductive value inversely proportional to sex number). The biology is all in the hypothesis and the proof … |
| fires-on-real-organism | minor | I found no measured counterexample to the theorem inside its stated scope, and I did not fetch any source. The weakness is in the browser check. It uses adult_males and adult_females, but Fisher's balance concerns investment in sons and daughters up to indepe… |
| circularity | survives | No data were fitted, so the law is not circular. It is also not tested: no observations stand behind it. It is a deduction from a cited hypothesis. |
| designer-cost | minor | The law only refutes a claim of evolutionary stability; it does not make a design impossible. A real cost arises if the row is read without scope screening. Designs with female-biased investment from LMC or LRC, such as fig wasps or bushbabies, or with sex-li… |

**EVIDENCE** (GET, never HEAD; Europe PMC REST, Crossref, and the repository bytes)

- mechanical fetch: **nothing-to-check** — {"constants":0,"found":0,"not_in_text":0,"text_not_retrievable":0,"unreachable":0}
- the checker worker did not run (every constant was found verbatim in its cited source, or the invocation cap was reached).

**REFEREE** (saw everything; bound by the gates)


| criterion | verdict | reason |
|---|---|---|
| C1 binds something real *(hard gate)* | unclear | the candidate declares no shared_scope.atoms, so the studio has nothing to evaluate and the law binds no design today. The proposer did not say whether this is deliberate; declare shared_scope.atoms over quantities a design carries, or declare browser_check_absent with missing_inputs |
| C2 constants sourced *(hard gate)* | pass | the statement carries no empirical constant (structural literals only), so there is nothing to source |
| C3 scope honest | unclear | the referee gave no reason |
| C4 independent | unclear | the referee gave no reason |
| C5 consistent *(hard gate)* | pass | propose.mjs constructed a joint witness with every accepted law whose scope overlaps |
| C6 wild type survives *(hard gate)* | unclear | the candidate declares no shared_scope.atoms, so there is no formula to evaluate against a wild-type organism: C6 is untested, not satisfied |
| C7 not circular | unclear | the referee gave no reason |

---

### `hamilton-rule` — **NEEDS-WORK**

> For a social trait whose change in mean breeding value is dp = k*(r*b - c) with k > 0 and 0 <= r <= 1 (a named hypothesis, the Price-equation form with b and c as partial regressions of fitness on the partner's and the actor's genotype), the trait increases if and only if c < r*b, and decreases if and only if r*b < c. Both directions hold, which makes the rule a criterion rather than a sufficient condition.

Scope `["any"]`. Decided 2026-11-01T05:42:46.379Z. Record type `candidate-with-requirements`.
Verdicts the gates allowed: NEEDS-WORK / REJECT. How: the referee worker returned no parseable verdict; the gates decide and the ruling is recorded as unrefereed.

**EVIDENCE** (GET, never HEAD; Europe PMC REST, Crossref, and the repository bytes)

- mechanical fetch: **nothing-to-check** — {"constants":0,"found":0,"not_in_text":0,"text_not_retrievable":0,"unreachable":0}
- the checker worker did not run (every constant was found verbatim in its cited source, or the invocation cap was reached).

**REFEREE** (saw everything; bound by the gates)


| criterion | verdict | reason |
|---|---|---|
| C1 binds something real *(hard gate)* | unclear | the candidate declares no shared_scope.atoms, so the studio has nothing to evaluate and the law binds no design today. The proposer says so itself (browser_check_absent: not-checkable-in-principle (no rule-out direction); it would need relatedness (regression coefficient), benefit_to_recipient (fit… |
| C2 constants sourced *(hard gate)* | pass | the statement carries no empirical constant (structural literals only), so there is nothing to source |
| C3 scope honest | unclear | the referee gave no reason |
| C4 independent | unclear | the referee gave no reason |
| C5 consistent *(hard gate)* | pass | propose.mjs constructed a joint witness with every accepted law whose scope overlaps |
| C6 wild type survives *(hard gate)* | unclear | the candidate declares no shared_scope.atoms, so there is no formula to evaluate against a wild-type organism: C6 is untested, not satisfied |
| C7 not circular | unclear | the referee gave no reason |

---

### `kimura-heterozygosity` — **NEEDS-WORK**

> Under the infinite-alleles equilibrium H*(1+4*Ne*mu) = 4*Ne*mu (a named hypothesis), equilibrium heterozygosity lies strictly between 0 and 1 for every positive effective size and neutral mutation rate, and of two populations the one with the larger product Ne*mu has strictly the larger equilibrium heterozygosity.

Scope `["any"]`. Decided 2026-11-01T05:36:24.857Z. Record type `candidate-with-requirements`.
Verdicts the gates allowed: NEEDS-WORK / REJECT. How: the referee ruled within what the gates allow, with per-criterion reasons.

**PROPONENT** (no web tools; argues from the candidate and the accepted set)

- strongest case: Given the Kimura-Crow infinite-alleles equilibrium as an explicit named hypothesis, any design that states a neutral equilibrium heterozygosity outside (0,1), or ranks it opposite to Ne*mu, is kernel-proved inconsistent with that hypothesis.
- what it says the law rules out: {"Ne":1000,"mu":0.00001,"H":0.9} — Under the named hypothesis H*(1+4*Ne*mu) = 4*Ne*mu, theta = 4*1000*1e-5 = 0.04, so H = 0.04/1.04 ≈ 0.0385. A stated neutral equilibrium heterozygosity of 0.9 contradicts the hypothesis. The law also rejects any H <= 0 o…
- bound kind, by its own account: **impossibility** — 
- narrowest scope it will defend: ["diploid, autosomal, neutral loci in randomly mating populations at mutation-drift equilibrium with constant effective size"]
- closest accepted law: `kimura-fixation-probability` — kimura-fixation-probability concerns the probability that a single mutant allele fixes (equal to its initial frequency when neutral) and says nothing about standing diversity. This law constrains equ…
- **it names its own weakest point:** The theorem is a one-line algebraic consequence of H = theta/(1+theta) (strict monotonicity and range in (0,1) are immediate), so the critic will say it restates the hypothesis and adds no biology. It also has no empirical evidence behind it (observations is empty, no n), Lewontin's paradox contradicts the hypothesis when applied to real species, and the studio cannot check it because sim-engine has no Ne, mu or H fields.

**CRITIC** (had `WebFetch`/`WebSearch`; never saw the proponent's case)

- would it let this constrain a design? **no**
- worst attack: **vacuity**
- The conclusion is just the algebra of its own hypothesis H(1+4Ne mu)=4Ne mu, so it is true of every organism that meets the hypothesis, forbids nothing else, and has no observations behind it.

| attack | verdict | finding |
|---|---|---|
| vacuity | fatal | Given the hypothesis H(1+4Ne mu)=4Ne mu with Ne,mu>0, H = theta/(1+theta) follows. This lies in (0,1) and is strictly increasing in theta by pure algebra. The conclusion is a theorem of the hypothesis, so it is true for every assignment satisfying the hypothe… |
| constants | minor | The statement has no numeric constants in the usual sense. The factor 4 is the diploid autosomal convention and is derived from the 1964 model, but the Kimura-Crow citation is a DOI with no equation or page named. I did not fetch it. Ne, mu and H are free inp… |
| scope | serious | taxa ['any'] with an empty observations list. Nothing was measured in any organism. The scope text itself restricts the law to neutral loci, constant Ne, equilibrium, infinite alleles and diploid autosomal inheritance. Those restrictions are not in the taxa f… |
| definition-restatement | serious | The law is an algebraic rearrangement of the named hypothesis (H = theta/(1+theta)), plus the fact that theta/(1+theta) is monotone. It adds no biology. Among the accepted laws, kimura-fixation-probability and genotype-substitution-time cover other Kimura qua… |
| fires-on-real-organism | minor | The theorem cannot fire on an organism, since it holds under its hypothesis. The hypothesis as applied to real species does fail. Lewontin's paradox, which the candidate itself cites, says observed diversity varies far less than Ne estimates predict. I did no… |
| circularity | survives | No data were fitted. The result is a deduction from the hypothesis and no bound was fitted to specimens. Circularity is not the issue. The cost is that no observation backs the law at all. |
| designer-cost | serious | If the law is wired in as a check on annotated Ne, mu and H, it would turn red any design whose stated heterozygosity departs from theta/(1+theta). Real lineages often have lower or higher H than their Ne*mu predicts, through selection at linked sites, bottle… |

**EVIDENCE** (GET, never HEAD; Europe PMC REST, Crossref, and the repository bytes)

- mechanical fetch: **nothing-to-check** — {"constants":0,"found":0,"not_in_text":0,"text_not_retrievable":0,"unreachable":0}
- the checker worker did not run (every constant was found verbatim in its cited source, or the invocation cap was reached).

**REFEREE** (saw everything; bound by the gates)


| criterion | verdict | reason |
|---|---|---|
| C1 binds something real *(hard gate)* | unclear | the candidate declares no shared_scope.atoms, so the studio has nothing to evaluate and the law binds no design today. The proposer says so itself (browser_check_absent: provable-but-not-checkable; it would need effective_population_size (Ne, individuals), neutral_mutation_rate_per_generation (mu),… |
| C2 constants sourced *(hard gate)* | pass | the statement carries no empirical constant (structural literals only), so there is nothing to source |
| C3 scope honest | **fail** | scope.taxa is ['any'] and ranges is {}, so the structured scope names no ranges for Ne, mu or H. The conditions that actually limit the law (neutral locus, infinite alleles, constant Ne, equilibrium, diploid autosomal so that the factor is 4) appear only in the free-text basis. The proponent conced… |
| C4 independent | pass | No accepted law constrains equilibrium heterozygosity. kimura-fixation-probability (neutral fixation = initial frequency), favored-fixation-lower-bound and genotype-substitution-time concern substitution and fixation, and fisher-ftns concerns the rate of change of mean fitness. A design with correc… |
| C5 consistent *(hard gate)* | pass | propose.mjs constructed a joint witness with every accepted law whose scope overlaps |
| C6 wild type survives *(hard gate)* | unclear | no wild-type organism in leanbio-debate-wildtype/1.0.0 falls inside the scope ["any"]: the law is untested against any real animal, so it may not be promoted (CRITERIA.md C6) |
| C7 not circular | pass | No data were fitted. The statement is explicitly conditional ('Under the infinite-alleles equilibrium ... (a named hypothesis)'). It is a deduction from a stated model premise, not an observed extreme presented as an impossibility. The proponent's own bound_kind_why says it is model-internal, and t… |

**Ruling.** The law is a kernel-checked consequence of the Kimura-Crow infinite-alleles equilibrium: H lies strictly in (0,1) and rises strictly with Ne*mu. It is not a tautology and not a restatement of any accepted law, since none constrains heterozygosity. No hard gate failed, but two things block promotion. C1 and C6 are both unclear: the law declares no shared atoms, so the studio cannot evaluate it, and no wild-type organism was tested. C3 also fails, because 'any' taxa with empty ranges leaves the real limiting conditions only in prose. This is NEEDS-WORK and not REJECT because every defect is a missing mapping or a mis-stated scope, not a false claim or a record bound sold as an impossibility. It is not PROMOTE because an untestable law does not get to turn designs dashed.

**What would make it promotable:**

- Declare shared_scope.atoms for effective_population_size (Ne), neutral_mutation_rate_per_generation (mu) and observed_heterozygosity (H), with units and the mapping a design would use to supply them, so nonvacuity.mjs can search for a rejecting assignment such as Ne=1000, mu=1e-5, H=0.9.
- Fill scope.ranges with Ne>0, mu>0 and 0<H<1. Move the model conditions (neutral locus, infinite alleles, constant Ne, mutation-drift equilibrium, diploid autosomal so the factor is 4) out of free text into explicit scope.assumed entries, and state that haploid, X-linked, organellar, selected, non-equilibrium and census-size uses are excluded.
- Either keep taxa as 'any' but state in scope.basis that it means 'wherever the hypothesis holds' with no empirical taxon claim, or narrow the taxa to a diploid autosomal group for which an independent Ne, mu and H are available.
- Add at least one wild-type organism with measured Ne, mu and H, each with a source, to wildtype.json, inside the declared scope, so C6 can evaluate the law instead of returning unclear. If no such organism can be sourced, C6 stays unclear and the law cannot be promoted.
- Add evidence.caveats stating that this is a model-internal implication and not a discovery about biology, and that it is in tension with Lewontin's paradox when applied to census-size or poorly estimated Ne. Cite an equation or page in Kimura & Crow 1964 for H = theta/(1+theta) with theta = 4*Ne*mu.

**What a human should check:** Why C6 skipped every dossier organism as 'outside the law's declared scope' when the scope is taxa ['any']. Either the scope matcher does not treat 'any' as a wildcard, or the dossier lacks the Ne, mu and H quantities and the skip message is misleading. This ruling treats C6 as unclear on the data as reported, but a person should confirm which it is. They should also decide whether a purely model-internal, thin-content theorem is worth adding to the studio once it is made evaluable.

---

### `maynardsmith-hawk-dove` — **NEEDS-WORK**

> For a symmetric Hawk-Dove contest with resource value V > 0, injury cost C > V and escalation probability p fixed by p*C = V (a named hypothesis), p lies strictly inside (0,1); Hawk and Dove have equal payoff against a population escalating with probability p; a population escalating less often than p gives Hawk a strictly higher payoff and one escalating more often gives Dove a strictly higher payoff, so p is invaded from neither side; and the payoff at p is strictly below V/2, the all-Dove payoff, which is the cost of conflict.

Scope `["any"]`. Decided 2026-11-01T05:36:45.109Z. Record type `candidate-with-requirements`.
Verdicts the gates allowed: NEEDS-WORK / REJECT. How: the referee worker returned no parseable verdict; the gates decide and the ruling is recorded as unrefereed.

**EVIDENCE** (GET, never HEAD; Europe PMC REST, Crossref, and the repository bytes)

- mechanical fetch: **nothing-to-check** — {"constants":0,"found":0,"not_in_text":0,"text_not_retrievable":0,"unreachable":0}
- the checker worker did not run (every constant was found verbatim in its cited source, or the invocation cap was reached).

**REFEREE** (saw everything; bound by the gates)


| criterion | verdict | reason |
|---|---|---|
| C1 binds something real *(hard gate)* | unclear | the candidate declares no shared_scope.atoms, so the studio has nothing to evaluate and the law binds no design today. The proposer says so itself (browser_check_absent: provable-but-not-checkable; it would need resource_value_V (arbitrary fitness units), injury_cost_C (same units), escalation_prob… |
| C2 constants sourced *(hard gate)* | pass | the statement carries no empirical constant (structural literals only), so there is nothing to source |
| C3 scope honest | unclear | the referee gave no reason |
| C4 independent | unclear | the referee gave no reason |
| C5 consistent *(hard gate)* | pass | propose.mjs constructed a joint witness with every accepted law whose scope overlaps |
| C6 wild type survives *(hard gate)* | unclear | no wild-type organism in leanbio-debate-wildtype/1.0.0 falls inside the scope ["any"]: the law is untested against any real animal, so it may not be promoted (CRITERIA.md C6) |
| C7 not circular | unclear | the referee gave no reason |

---

### `turing-ddi` — **NEEDS-WORK**

> For the linearisation of a two-morphogen reaction-diffusion system about a homogeneous steady state with positive diffusivities, negative Jacobian trace, positive Jacobian determinant and Turing's inequality 4*du*dv*detJ < (dv*fu + du*gv)^2 with dv*fu + du*gv > 0 (a named hypothesis), there is a strictly positive squared wavenumber at which the dispersion relation is negative, so the homogeneous state is linearly unstable to a spatial mode; and the two diffusivities are necessarily unequal, so no equal-diffusivity system stable without diffusion can pattern, whatever its kinetics.

Scope `["any"]`. Decided 2026-11-01T05:36:45.097Z. Record type `candidate-with-requirements`.
Verdicts the gates allowed: NEEDS-WORK / REJECT. How: the referee ruled within what the gates allow, with per-criterion reasons.

**PROPONENT** (no web tools; argues from the candidate and the accepted set)

- strongest case: A two-morphogen design that is stable without diffusion and declares equal diffusivities cannot be a Turing patterner, for any kinetics at all, and this is a kernel-checked consequence of the dispersion relation, not a fitted regularity.
- what it says the law rules out: {"du":1,"dv":1,"fu":0.5,"fv":-1,"gu":1,"gv":-0.8} — These numbers satisfy the stability-without-diffusion conditions: trace = -0.3 < 0 and detJ = -0.4 + 1.0 = 0.6 > 0. With du = dv = d, the quantity dv*fu + du*gv equals d*(fu+gv) = -0.3 d < 0. This contradicts the named …
- bound kind, by its own account: **impossibility** — 
- narrowest scope it will defend: []
- closest accepted law: `genotype-genetic-code` — No accepted law shares quantities with this one, so none is a true neighbour. The closest in form is genotype-genetic-code, another table-free-of-measurement 'claim X is impossible given structure Y'…
- **it names its own weakest point:** The critic will say that the du ≠ dv half is a near-trivial corollary: with du = dv, dv*fu + du*gv = d*trace < 0, which directly contradicts the hypothesis. They will also say that the law has no measured constants and no observations, and that the declared taxa 'any' and life stages embryo/larva are unsupported because nothing links real embryos to a two-morphogen reaction-diffusion model. Finally, the studio cannot check it today: browser_check is absent because sim-engine has no morphogen state (provable-but-not-checkable).

**CRITIC** (had `WebFetch`/`WebSearch`; never saw the proponent's case)

- would it let this constrain a design? **no**
- worst attack: **scope**
- The theorem is mathematically sound, but it is a statement about a model class with no organismal evidence behind 'taxa: any', and the English version ('no equal-diffusivity system can pattern, whatever its kinetics') claims more than the Lean proof, which covers only linear instability of a two-species scalar-diffusion system; letting it turn designs RED would forbid organisms whose patterning falls outside that model.

| attack | verdict | finding |
|---|---|---|
| vacuity | serious | The Lean statement is a conditional theorem about a 2x2 linear system. No assignment of du, dv, fu, fv, gu, gv can make it false, because the hypothesis TuringHyp already contains the inequalities that give the conclusion. The du ≠ dv half is a one-line conse… |
| constants | survives | The statement has no numeric constants. The only sourced item is the hypothesis, cited to Turing 1952 by DOI with no section or equation named. That is thin, but the content is standard linear-stability algebra. |
| scope | serious | The scope is taxa ['any'] and life stages embryo and larva. The mathematics has nothing to do with taxa or stages. The evidence block has zero observations, and the one empirical see_also is the CIMA chemical reaction, which is not an organism. The English st… |
| definition-restatement | minor | It is not a definition. It is the standard Turing necessary and sufficient linear condition, restated in squared form, plus a corollary (du ≠ dv). No accepted law covers reaction-diffusion or Turing instability. The listed laws are about flight, oxygen, popul… |
| fires-on-real-organism | survives | No non-avian counterexample found. Within the hypotheses (two species, linear, free scalar diffusion) the theorem is true, so no organism's measurements can violate it. Real organisms that pattern with similar effective diffusivities do so by mechanisms outsi… |
| circularity | survives | There is no fitted bound and no data. It is a deductive theorem, so there is no circularity, and equally no empirical support. |
| designer-cost | serious | The law is correct on its own terms, but its usable half (reject equal diffusivities) is only safe if 'diffusivity' means the effective diffusivity of the free species in the model. A designer who declares equal free diffusivities for two morphogens, while on… |

**EVIDENCE** (GET, never HEAD; Europe PMC REST, Crossref, and the repository bytes)

- mechanical fetch: **nothing-to-check** — {"constants":0,"found":0,"not_in_text":0,"text_not_retrievable":0,"unreachable":0}
- the checker worker did not run (every constant was found verbatim in its cited source, or the invocation cap was reached).

**REFEREE** (saw everything; bound by the gates)


| criterion | verdict | reason |
|---|---|---|
| C1 binds something real *(hard gate)* | unclear | the candidate declares no shared_scope.atoms, so the studio has nothing to evaluate and the law binds no design today. The proposer says so itself (browser_check_absent: provable-but-not-checkable; it would need morphogen_diffusivity_activator (du, m^2/s), morphogen_diffusivity_inhibitor (dv, m^2/s… |
| C2 constants sourced *(hard gate)* | pass | the statement carries no empirical constant (structural literals only), so there is nothing to source |
| C3 scope honest | **fail** | Scope declares taxa ['any'] and life stages embryo/larva, but the evidence block has zero observations and no organism, diffusivity or Jacobian stands behind it. The proponent itself concedes scope_supported taxa is []. The scope's own basis text says the law does not show that any developmental sy… |
| C4 independent | pass | It is not a definition: it is the linear-stability condition for a 2x2 reaction-diffusion system and a corollary (du != dv). The du != dv half is a short consequence of the hypothesis (equal d gives d*trace < 0, contradicting dv*fu + du*gv > 0), but that is the content of the Turing result and not … |
| C5 consistent *(hard gate)* | pass | propose.mjs constructed a joint witness with every accepted law whose scope overlaps |
| C6 wild type survives *(hard gate)* | unclear | no wild-type organism in leanbio-debate-wildtype/1.0.0 falls inside the scope ["any"]: the law is untested against any real animal, so it may not be promoted (CRITERIA.md C6) |
| C7 not circular | pass | It is a deductive theorem, not a bound fitted to data, so there is nothing to be circular with. It is correctly presented as an impossibility within a stated model class (two species, linearised, homogeneous steady state, fixed domain). The proponent and the scope basis say it is model-bound and sh… |

**Ruling.** The Lean theorem is sound and non-trivial as mathematics: within a two-species, linearised, scalar-diffusion reaction-diffusion model, equal diffusivities with stable kinetics cannot give diffusion-driven instability. It is independent of every accepted law and circles nothing. It cannot be promoted for three reasons. First, C1 is unclear because it declares no shared atoms, so the studio cannot evaluate it. Second, C6 is unclear because no wild-type organism lies in scope, so it has never been tested against a real animal. Third, C3 fails because it claims taxa 'any' and embryo/larva with no organismal evidence, and the English statement says 'can pattern' where the proof covers only linear Turing instability. None of this is unfixable, so the verdict is NEEDS-WORK, not REJECT.

**What would make it promotable:**

- Declare shared_scope.atoms for morphogen_diffusivity_activator (du, m^2/s), morphogen_diffusivity_inhibitor (dv, m^2/s) and the Jacobian entries fu, fv, gu, gv (1/s), so the studio can evaluate the law. The rejecting design is du = dv with fu + gv < 0, claiming Turing patterning. The proponent's example (du = dv = 1, fu = 0.5, fv = -1, gu = 1, gv = -0.8) can be exhibited as numbers.
- Restate scope.taxa as [] with a basis that says the law is a theorem about a model class, or restrict it to a named system with a source that shows it is modelled as two-morphogen reaction-diffusion. Drop the embryo/larva life stages unless an organism is cited, or state that they are labels for where the model class is applied.
- Rewrite statement_en to match the Lean theorem: 'no two-species, scalar-diffusion, linearised reaction-diffusion system that is stable without diffusion and has equal diffusivities has a diffusion-driven (Turing) instability'. Remove 'can pattern', and state that growth, mechanics, advection, cell-contact (Notch-Delta), cross-diffusion and three or more species are outside it.
- State that the checker applies to the effective diffusivities of the free species, so binding or sequestration is not misread as equal diffusivity (the critic's designer-cost point).
- For C6, supply wild-type measurements of morphogen diffusivities and kinetic Jacobians for at least one organism in scope (for example a zebrafish or Drosophila patterning system with published du, dv), or accept that the law stays NEEDS-WORK until one exists. Add a locator (equation or section) to the Turing 1952 citation.

**What a human should check:** Whether the studio should carry a reaction-diffusion state at all. Only the du != dv half is usable without measurement, and that half follows directly from the hypothesis. A person should decide whether a design-time check that flags 'equal diffusivities plus a Turing claim' is worth adding, given the risk of false RED flags on designs that pattern by mechanisms outside the model.

---

### `turing-wavelength` — **NEEDS-WORK**

> For the onset relation q^2*(du*dv) = det J on the squared critical wavenumber q = k_c^2, with du > 0, dv > 0, det J > 0 and q > 0 (a named hypothesis), any two solutions for the same du, dv and det J are equal -- so the tissue size, which the relation does not mention, cannot enter the critical wavenumber -- and multiplying both diffusivities by m > 1 at fixed kinetics gives a new squared critical wavenumber qm with qm*m = q exactly, hence strictly smaller, so the critical wavelength grows as the square root of the diffusivity scale.

Scope `["any"]`. Decided 2026-11-01T05:42:46.380Z. Record type `candidate-with-requirements`.
Verdicts the gates allowed: NEEDS-WORK / REJECT. How: the referee worker returned no parseable verdict; the gates decide and the ruling is recorded as unrefereed.

**EVIDENCE** (GET, never HEAD; Europe PMC REST, Crossref, and the repository bytes)

- mechanical fetch: **nothing-to-check** — {"constants":0,"found":0,"not_in_text":0,"text_not_retrievable":0,"unreachable":0}
- the checker worker did not run (every constant was found verbatim in its cited source, or the invocation cap was reached).

**REFEREE** (saw everything; bound by the gates)


| criterion | verdict | reason |
|---|---|---|
| C1 binds something real *(hard gate)* | unclear | the candidate declares no shared_scope.atoms, so the studio has nothing to evaluate and the law binds no design today. The proposer did not say whether this is deliberate; declare shared_scope.atoms over quantities a design carries, or declare browser_check_absent with missing_inputs |
| C2 constants sourced *(hard gate)* | pass | the statement carries no empirical constant (structural literals only), so there is nothing to source |
| C3 scope honest | unclear | the referee gave no reason |
| C4 independent | unclear | the referee gave no reason |
| C5 consistent *(hard gate)* | unclear | the candidate carries no propose.mjs status (no `status_after_propose` in its meta, no board task naming it and no registry entry), so joint consistency with the accepted set is unknown. Run lean/registry/propose.mjs and record the outcome; this is a metadata gap, not an inconsistency |
| C6 wild type survives *(hard gate)* | unclear | the candidate declares no shared_scope.atoms, so there is no formula to evaluate against a wild-type organism: C6 is untested, not satisfied |
| C7 not circular | unclear | the referee gave no reason |

---

## The promotion queue

**Empty: no law reached PROMOTE-TO-CANDIDATE or CONTESTED, so there is nothing for a human to decide yet.**

Two consequences, stated rather than glossed:

- The automatic half of the pipeline (a survivor written to the registry as `candidate`, served by the MCP and
  drawn dashed in the studio) was **not exercised on a real law in this run**, because no real law survived. It is
  exercised by `test.mjs` end to end — the fixture law reaches PROMOTE-TO-CANDIDATE, a request is queued carrying
  the ruling and the criteria hash, `approve` refuses an agent role, refuses an unqueued law and refuses a law that
  is not in the registry, and `refuse` requires a reason — and the runs here were additionally given `--no-write`,
  since every candidate debated was already in the registry or not promotable.
- A debate that promotes nothing is not evidence that the pipeline promotes nothing. It is evidence about this
  round: eleven of twelve candidates are correct theorems with no mapping from their quantities to anything a
  design carries, and the criteria refuse to promote a constraint that no real organism can test.

## Records emitted for `lean/registry/open-questions/`

One per ruling, in `out/records/`. A rejection is a result, not a bin.

| law | record | why |
|---|---|---|
| `development-growth-asymptote` | `candidate-with-requirements` | C1_binds_something_real is unclear: the candidate declares no shared_scope.atoms, so the studio has nothing to evaluate and the law binds no design today. The proposer did not say whether this is deliberate; declare shared_scope.atoms over quantities a design… |
| `disc-flying-fish-fin-ratio-gap` | `candidate-with-requirements` | Narrow scope to taxa: [Exocoetidae, Hemiramphidae, Belonidae, as sampled in Daane 2021 Data S1A], life_stages: [adult], and state it is museum specimens (n = 109). Drop the claim over Beloniformes as an order.; Fix the source citation: re-fetch Data S1A, reco… |
| `disc-heterurus-mass-exponent` | `failed-theorem` | fires on a wild-type organism inside its own scope, so it is wrong about biology |
| `disc-measured-wing-loading-band` | `candidate-with-requirements` | Declare scope taxa: ["Cypselurus hiraii"] and not Exocoetidae, with life_stages stated as prepared models/stuffed specimens and a ranges entry for standard length of about 0.20 m (the Park and Choi L1, L2, L3 and M sizes).; Restate statement_en as a record ov… |
| `disc-pectoral-length-allometry` | `candidate-with-requirements` | Narrow scope to the 3 sampled species, named, with life_stages covering larva/juvenile/adult as pooled, ranges SL 1.68-24 cm, and state 'preserved specimens, pooled across species and ontogeny'. Do not declare Exocoetidae.; State in statement_en and evidence.… |
| `fisher-kpp-speed` | `candidate-with-requirements` | C1_binds_something_real is unclear: the candidate declares no shared_scope.atoms, so the studio has nothing to evaluate and the law binds no design today. The proposer says so itself (browser_check_absent: provable-but-not-checkable; it would need dispersal_c… |
| `fisher-sex-ratio` | `candidate-with-requirements` | C1_binds_something_real is unclear: the candidate declares no shared_scope.atoms, so the studio has nothing to evaluate and the law binds no design today. The proposer did not say whether this is deliberate; declare shared_scope.atoms over quantities a design… |
| `hamilton-rule` | `candidate-with-requirements` | C1_binds_something_real is unclear: the candidate declares no shared_scope.atoms, so the studio has nothing to evaluate and the law binds no design today. The proposer says so itself (browser_check_absent: not-checkable-in-principle (no rule-out direction); i… |
| `kimura-heterozygosity` | `candidate-with-requirements` | Declare shared_scope.atoms for effective_population_size (Ne), neutral_mutation_rate_per_generation (mu) and observed_heterozygosity (H), with units and the mapping a design would use to supply them, so nonvacuity.mjs can search for a rejecting assignment suc… |
| `maynardsmith-hawk-dove` | `candidate-with-requirements` | C1_binds_something_real is unclear: the candidate declares no shared_scope.atoms, so the studio has nothing to evaluate and the law binds no design today. The proposer says so itself (browser_check_absent: provable-but-not-checkable; it would need resource_va… |
| `turing-ddi` | `candidate-with-requirements` | Declare shared_scope.atoms for morphogen_diffusivity_activator (du, m^2/s), morphogen_diffusivity_inhibitor (dv, m^2/s) and the Jacobian entries fu, fv, gu, gv (1/s), so the studio can evaluate the law. The rejecting design is du = dv with fu + gv < 0, claimi… |
| `turing-wavelength` | `candidate-with-requirements` | C1_binds_something_real is unclear: the candidate declares no shared_scope.atoms, so the studio has nothing to evaluate and the law binds no design today. The proposer did not say whether this is deliberate; declare shared_scope.atoms over quantities a design… |

## Are the criteria strong enough?

1 rejected, 0 contested, 11 sent back for work, 0 promoted to candidate.

The criteria bite in a specific place: **10 of 12** laws could not be evaluated against any
real animal at all (C6 `unclear`), which blocks promotion without rejecting the law. That is the honest state of
most of this round: they are theorems about models, formalized correctly, with no mapping from their quantities
to anything a design carries. The criteria say so rather than promoting them on the strength of a correct proof.

What the debate did NOT establish:

- **The soft criteria rest on one referee.** C3, C4 and C7 are a single language model's judgement, recorded with
  reasons so a human can disagree, but not independently replicated.
- **The critic mostly did not fetch.** It had `WebFetch` and `WebSearch`; the per-law transcripts record how many
  calls it actually made (`transcripts/<law>/critic.json`, `tool_calls`). Where that count is 0, its
  `fires-on-real-organism` attack is reasoning from the candidate, not a search of the literature, and the
  criteria correctly refuse to let an unsourced counterexample decide a verdict. Across this whole run the critic
  and evidence-checker workers made **0 web tool calls in total**: every counterexample offered was
  reasoning, not a literature search, and the one law that was rejected for firing on real animals was caught by
  the mechanical wild-type check, not by a critic.
- **C6 is only as broad as `wildtype.json`.** 34 organisms, drawn from this repository's own measured CSVs. A law
  whose scope contains none of them is `unclear`, not safe.
- **No Lean kernel ran here.** `propose.mjs` did that before the candidate arrived; the gates evaluate the
  declared atoms in floating point, which is how the studio evaluates them too.

