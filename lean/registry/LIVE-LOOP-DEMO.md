# The law loop, closed and demonstrated

**What Amit asked for:** a new Lean bio statement, once debated, should "automatically update the MCP server,
and thus the constraints on design studio + validation tool (which should do a second round of checks using
Lean)."

This file is the demonstration that it does, with the commands and the output captured at each hop on
**2026-11-01**. It is not a description of the loop; every block below is the real output of the command above
it, and every one can be re-run.

**Subject:** `turing-ddi` 1.1.0, a genuine candidate from the LeanBio discovery agent's adversarial round — a
diffusion-driven-instability condition for a two-morphogen reaction-diffusion system. Not a law I wrote for the
occasion. (A second, deliberately trivial subject, `test-loop-only-density-sanity`, was used while the real
candidates were still being debated; it was **retired in law set 1.8.1** as soon as this was captured, and law
set 1.8.0 still pins it so this demonstration stays reproducible.)

---

## 0. The finding that made the loop worth closing

A law could be **accepted, released in a law set, served by every tool and still evaluate nothing.**

Every row in the generated evaluator `lean/eliminate/browser-check.mjs` was a **hand-written formula** keyed by
a constraint id in a hard-coded `USED` list in the generator. A law whose constraint id was not in that list
produced no row. It still appeared in `lean_laws_list`, in `lean_law_get`, in the `/api/lean/` mirror, on both
MCP servers, in the Studio's law list and in the law set — so every surface reported a design as checked against
it, and **no arithmetic ran.** The only trace was an entry in `laws_without_browser_evaluation`, which nothing
failed on.

When the guard for this was written (see §5) and run for the first time, it immediately found a live case that
nobody had noticed: `aerobic-power-bound`, an **accepted** law, evaluated nothing, because it and
`fick-principle` both claimed constraint `C14` and the generator broke the tie **alphabetically**. A design that
broke the aerobic ceiling had its violation reported under `fick-principle` for no better reason than the letter
f, and `aerobic-power-bound` — the law whose theorem does the ruling out — reported nothing at all.

False assurance is worse than no law: a law base that says a design was checked when it was not is not a weaker
law base, it is a misleading one. Two things follow, and both are in this release:

1. A law can now carry its own evaluator as **data** (`browser_check`), so a new law binds with **no code edit**.
2. `check-exposed` **fails** when an accepted law evaluates nothing, and the only way out is a reviewed
   exemption that states the reason and what would make the law bind.

`aerobic-power-bound` / `fick-principle` was then decided by the law owner: C14 and C14b belong to
`aerobic-power-bound`, and `fick-principle` owns no constraint, because it is the named **hypothesis** the
eliminating law rests on and a premise should not own an eliminating constraint. The guard now passes, and a
third guard (`bind:ambiguous`) fails if two laws ever claim one constraint id again — silent tie-breaking was
the defect, independent of that instance.

---

## 1. BEFORE: the law is in the registry and reaches 3 of 8 surfaces

```bash
node lean/registry/law-surfaces.mjs turing-ddi --design '{"taxon":"Danio rerio","life_stage":"adult","SL_m":0.04,"mass_kg":0.0009,"Du":1,"Dv":1,"f_u":5,"f_v":-6,"g_u":6,"g_v":-7}'
```

```
law-surfaces turing-ddi@1.1.0 (status candidate) against law set 1.7.0 at 2026-11-01T05:36:25.597Z
design: {"taxon":"Danio rerio","life_stage":"adult","SL_m":0.04,"mass_kg":0.0009,"Du":1,"Dv":1,"f_u":5,"f_v":-6,"g_u":6,"g_v":-7}
  [FAIL] a registry-lawset  (lawsets/current.json (1.7.0))
        law set 1.7.0 does not pin turing-ddi: it is in the registry but in no release, so every caller ignores it
  [ ok ] b browser-checker  (lean/eliminate/browser-check.mjs)
        1 row(s) attributed to this law: TURING1 -> violated (declarative: Dv f_u + Du g_v > 2 sqrt(Du Dv det J)  (diffusion-driven instability))
  [FAIL] c static-mirror  (dashboard/public/api/lean/ (index.json, laws/, current.json, changes.json))
        index.json: present; laws/turing-ddi.json: present (status candidate, version 1.1.0); current.json (1.7.0): MISSING; changes feed: not named in any entry
  [ ok ] d sim-engine-mcp  (sim-engine/tools/lean-tools.mjs via sim-engine/contract.json + lean-cli.mjs)
        lean_laws_list: returns it; lean_law_get: turing-ddi@1.1.0 status candidate; contract.json carries all 8 lean_* tools: true; envelope source local lawset_version 1.7.0
  [ ok ] e hosted-mcp  (mcp/cli.mjs laws (the hosted delphisci server's own path through the same handlers))
        58 laws; turing-ddi present
  [FAIL] f studio-verdict  (dashboard/public/api/lean/browser-check.mjs + current.json, via lean-client.js checkState)
        the Studio draws no row for turing-ddi: the mirror's law set 1.7.0 does not pin it
  [FAIL] g optimizer-rule  (sim-engine/tools/studio.mjs optimize -> sim-engine/lib/lean.mjs leanVerdicts)
        the rule never sees this law: lean_check returns no row for it (no row attributed)
  [FAIL] h validation-tool  (sim-engine/validate/lean-rounds.mjs (validate_design round 2) + lean-components.mjs)
        validate_design round 2 (law set 1.7.0): no row for this law; newly_violated_since 1.7.0 -> 1.8.0: none

3/8 surfaces reached.
```

Read that carefully: the law is **already** in the registry, **already** served by both MCP servers and both
CLIs, and its evaluator row **already** computes `violated` for this design. It is in no law set, so the
Studio, the optimizer and the validation tool all correctly ignore it. Being listed by a tool is not the same as
binding anything, and this is the difference the eight-surface check exists to make visible.

## 2. The release: one command, and nothing else is edited

```bash
node lean/registry/release.mjs 1.8.0 "<the note, in lean/registry/CHANGELOG.md>"
```

```
## 1.8.0 (2026-11-01)
...
### Added
- added `fisher-kpp-speed` 1.1.0 (biological, candidate)
- added `kimura-heterozygosity` 1.1.0 (biological, candidate)
- added `maynardsmith-hawk-dove` 1.1.0 (biological, candidate)
- added `test-loop-only-density-sanity` 1.0.0 (physical, candidate)
- added `turing-ddi` 1.1.0 (biological, candidate)
### Changed
- `E2` 1.0.0 -> 1.1.0
- `aerobic-power-bound` 1.0.0 -> 1.1.0
- `fick-principle` 1.2.0 -> 1.3.0
- `scaling-area-law` 1.0.0 -> 1.1.0
- `scaling-strength-law` 1.0.0 -> 1.1.0
- `thompson1917-ch02-10` 1.0.0 -> 1.1.0
- `thompson1917-ch03-07` 1.0.0 -> 1.1.0

regenerated lean/eliminate/build-browser-check.mjs ok, dashboard/build-lean-api.mjs ok,
dashboard/build-lean-api.mjs ok; browser-check knows 1.0.0, 1.1.0, 1.2.0, 1.3.0, 1.4.0, 1.5.0, 1.6.0, 1.7.0,
1.8.0; lawsets/current.json -> 1.8.1
```

That last line is the loop. `release.mjs`:

1. refuses the release if any law's `content_hash` does not match its content, or an `accepted` law has no
   recorded human approval;
2. writes the immutable `lawsets/lawset-1.8.0.json` and the CHANGELOG section;
3. **regenerates the browser checker, then asks the regenerated file whether it now embeds 1.8.0**;
4. only then moves `lawsets/current.json`. If step 3 fails, the pointer does **not** move, so every caller keeps
   judging against the previous set and nothing is half-released. (That failure mode was real: moving the
   pointer first once made every `checkDesign` call throw mid-release.)
5. rebuilds the static mirror a second time, because the mirror embeds the current pointer.

No file was hand-edited between §1 and §3.

## 3. AFTER: 8 of 8, and the design's verdict changes

The same law, the same numbers, one stage change so the row is in scope (`turing-ddi` is scoped to
`life_stages: [larva, juvenile, embryo]`; an adult design is correctly `out-of-scope`, which is itself worth
seeing — a scoped law says nothing about an organism outside its scope, rather than passing it):

```bash
node lean/registry/law-surfaces.mjs turing-ddi \
  --design '{"taxon":"Danio rerio","life_stage":"larva","SL_m":0.004,"mass_kg":3e-7,"Du":1,"Dv":1,"f_u":5,"f_v":-6,"g_u":6,"g_v":-7}' \
  --from 1.7.0
```

```
law-surfaces turing-ddi@1.1.0 (status candidate) against law set 1.8.0 at 2026-11-01T05:37:10.047Z
  [ ok ] a registry-lawset   pinned turing-ddi@1.1.0 status candidate content_hash 90a7d5ef5876...
  [ ok ] b browser-checker   1 row(s) attributed to this law: TURING1 -> violated (declarative: Dv f_u + Du g_v > 2 sqrt(Du Dv det J))
  [ ok ] c static-mirror     index.json: present; laws/turing-ddi.json: present (status candidate, version 1.1.0);
                             current.json (1.8.0): present; changes feed: named in the 1.8.0 entry
  [ ok ] d sim-engine-mcp    lean_laws_list: returns it; lean_law_get: turing-ddi@1.1.0 status candidate;
                             contract.json carries all 8 lean_* tools: true; envelope source local lawset_version 1.8.0
  [ ok ] e hosted-mcp        58 laws; turing-ddi present
  [ ok ] f studio-verdict    TURING1: violated -> grey (candidate: shown, never binding) (law status candidate)
  [ ok ] g optimizer-rule    the rule sees 1 row(s) for this law: TURING1 violated [advisory: status candidate].
                             Violated but NOT binding (status candidate), so optimize reports it and does not reject:
                             candidate is the automatic ceiling and a candidate law never silently kills a design.
  [ ok ] h validation-tool   validate_design round 2 (law set 1.8.0): TURING1 violated;
                             newly_violated_since 1.7.0 -> 1.8.0: turing-ddi/TURING1

8/8 surfaces reached.
```

Hop **f** is the Design Studio path evaluated through the files the browser actually fetches
(`/api/lean/current.json` + `/api/lean/browser-check.mjs`, judged the way
`dashboard/public/blueprint3d/lean-client.js checkState` judges them). Hop **g** is the optimizer's own rule
from `sim-engine/tools/studio.mjs optimize`. Both say the same thing, and both say it about a **candidate**
law: **shown, never binding.** No law was auto-accepted anywhere in this demonstration; `candidate` is the
automatic ceiling and nothing here claims a human approved anything.

The changes feed, which is how a consumer learns the law base moved without being told:

```bash
node -e "const f=require('./dashboard/public/api/lean/changes.json'); ..."
```
```json
{ "current_lawset": "1.8.0", "version": "1.8.0", "date": "2026-11-01", "href": "lawsets/1.8.0.json",
  "diff_added": [ {"law_id":"fisher-kpp-speed","version":"1.1.0","status":"candidate"},
                  {"law_id":"kimura-heterozygosity","version":"1.1.0","status":"candidate"},
                  {"law_id":"maynardsmith-hawk-dove","version":"1.1.0","status":"candidate"},
                  {"law_id":"test-loop-only-density-sanity","version":"1.0.0","status":"candidate"},
                  {"law_id":"turing-ddi","version":"1.1.0","status":"candidate"} ] }
```

The same feed is served as Atom at `/api/lean/changes.xml` and as the `lean_changes(since_version)` tool, so a
client that last saw 1.7.0 can ask what it missed.

## 4. The second Lean round (what Amit asked for by name)

`validate_design` used to check once. It now runs **two** rounds and reports both:

* **round 1** against the law set in force **when the design was made** — read off the `lawset_version` that
  `organism.mjs appendEdit` stamps on every edit, so it is evidence, not a guess. Law sets are immutable and pin
  each law at a version, so round 1 genuinely **reproduces** the old verdict rather than approximating it.
* **round 2** against the **current** law set, re-resolved at call time.

```bash
node -e "import('./sim-engine/validate/lean-rounds.mjs').then(async m => {
  const d = {taxon:'Danio rerio',life_stage:'larva',SL_m:0.004,mass_kg:3e-7,Du:1,Dv:1,f_u:5,f_v:-6,g_u:6,g_v:-7};
  console.log(JSON.stringify(await m.leanRounds({design:d, from:'1.7.0'}), null, 1)); })"
```

```json
{
 "rounds_identical": false,
 "round1": { "lawset_version": "1.7.0", "ran_at": "2026-11-01T05:37:21.703Z", "lawset_basis": "explicit",
             "excluded_turing": { "constraint": "TURING1", "law_id": "turing-ddi", "why": "not in lawset 1.7.0" } },
 "round2": { "lawset_version": "1.8.0", "ran_at": "2026-11-01T05:37:21.716Z" },
 "law_base_moved": { "from": "1.7.0", "to": "1.8.0",
   "admitted": ["fisher-kpp-speed@1.1.0/candidate", "kimura-heterozygosity@1.1.0/candidate",
                "maynardsmith-hawk-dove@1.1.0/candidate", "test-loop-only-density-sanity@1.0.0/candidate",
                "turing-ddi@1.1.0/candidate"] },
 "newly_violated_since": [ {
   "law_id": "turing-ddi", "law_version": "1.1.0", "constraint": "TURING1", "status": "candidate",
   "binding": false, "kind": "biological",
   "inputs": { "quantity": -2, "bound": 2, "op": ">" },
   "message": "Diffusion-driven instability exists, and equal diffusivities cannot produce it: ... fails for the
               committed numbers ... [advisory: law status is candidate, not accepted]",
   "law_base_change": { "kind": "admitted", "law_id": "turing-ddi", "version": "1.1.0", "status": "candidate" },
   "why": "law turing-ddi@1.1.0 was admitted to law set 1.8.0 after this design was made (status candidate);
           the design did not change, the law base did" } ],
 "verdict_changed": true,
 "summary": "Round 1 judged this design against law set 1.7.0 ...; round 2 against 1.8.0. 5 law(s) admitted,
             7 changed, 0 withdrawn since. The design now breaks 1 law(s) it did not break when it was made
             (turing-ddi), of which 0 are binding."
}
```

Round 1 does not merely omit the law — it says **why** it is silent (`excluded: not in lawset 1.7.0`). A design
that was fine when it was made and is not fine now is reported as exactly that, with the release that did it
named.

### Why `newly_violated_since` is split three ways

A row that violates in round 2 and not round 1 has three possible causes, and conflating them would make the
field useless:

| field | cause |
|---|---|
| `newly_violated_since` | the law was **admitted or changed** since; `law_base_change` names the release |
| `newly_binding_since` | the violation **already existed** and only the law's **status** rose to accepted |
| `newly_violated_without_a_law_change` | the law is pinned **identically** in both sets, so the two rounds were not given the same numbers: a **caller bug**, never a law change |

`no_longer_violated_since` and `newly_unjudged_since` exist for the same reason in the other direction: a law
base reported as only ever tightening is not being reported honestly, and a row that **stopped** being judged is
a loss of coverage, not a design improvement.

The `newly_binding_since` case, on real registry history, is the sharpest illustration of why one round is not
enough. Law set 1.5.0 raised `perturb-thermal` from `candidate` to `accepted`. The same design, unchanged:

```bash
node sim-engine/validate/lean-rounds.test.mjs
```
```
ok   a law admitted after the design was made shows up under newly_violated_since
ok   round 1 reproduces the OLD verdict: the law is simply absent from the law set it was made under
ok   a law promoted to accepted shows up under newly_binding_since, not newly_violated_since
ok   both rounds record their law-set version and the time they ran
ok   identical law sets are reported as identical BY CONSTRUCTION, never as "nothing has changed"
ok   a violation that appears with NO law change is reported apart, as a caller bug
ok   the law set a design was made under is read off its edits, not guessed
ok   validate_design reports BOTH rounds, with the law-set version and timestamp of each
```

Under 1.4.0 that design's row was **grey** (advisory). Under 1.5.0 it is **red**. The design did not move; the
relation did not move; the registry decided the law was one that counts. Without round 2, the only way to learn
that is for someone to remember to re-run the check.

Scores are **unchanged by construction**: round 2 uses the current law set, which is what the scorer's single
pass already used. Nothing in `sim-engine/validate/score*.mjs`, `evaluation/` or `benchmark/` was touched; the
hook note for the scorer thread is `sim-engine/validate/LEAN-ROUND2-HOOK.md`.

## 5. What makes staleness impossible, or at least loud

`node lean/registry/check-exposed.mjs` now fails on all of these, where before it noted some and missed the rest:

| check | fails when | why it matters |
|---|---|---|
| `bind:accepted` | an **accepted** law produces no row attributed to it | the false-assurance case of §0. The only way out is an entry in `NO_DESIGN_ROW` **with the reason and what would make it bind** |
| `bind:exempt-stale` | such an exemption has stopped being true | the exemption list cannot rot into a list of excuses |
| `bind:unclaimed` | the evaluator emits a row no law claims | `lean_check` silently drops it as unmapped and no surface shows it |
| `bind:ambiguous` | two laws claim one constraint id | which law a violation is reported under must be a decision, not file order |
| `bind:declared` | a `browser_check` block is not wired to its law or emits no row | a declared row that maps back to no law is invisible |
| `a:unreleased` | an accepted law is pinned by no law set | `lean_check` excludes it: accepted and judging nothing |
| `stale:checker` | `current.json` names a law set the generated checker does not embed | every `checkDesign` returns `unknown-lawset` and nothing is evaluated |
| `stale:page-checker` | the Studio page's bundled evaluator has forgotten the **current** law set | the "bundled copy went stale by 7 hours" failure, made loud. A byte-level lag stays a note, because `lean-client.js` prefers the mirror's copy; forgetting the current law set is a failure, because anything importing the page copy directly then judges every row `unknown-lawset` |
| `stale:mirror`, `stale:contract` | the mirror or the published contract differs from the sources | content comparison, not timestamps |

Candidate and proposed laws that evaluate nothing are a **note**, not a failure: they bind nothing by status
anyway. The note says to give them a block before they are accepted.

The guards were made to fail before they were trusted:

```bash
node lean/registry/loop.test.mjs
```
```
ok   a law in the registry and in no law set is reported as not pinned by any release
ok   a law missing from the static /api/lean/ mirror FAILS check-exposed (surface c)
ok   an ACCEPTED law that produces no row in the generated evaluator FAILS bind:accepted
ok   the bind:accepted message names the reason the law evaluates nothing, not just that it does
ok   check-exposed as a whole is RED while a law is missing from a surface
```

That test writes two fixture laws into `lean/registry/laws/`, runs `check-exposed`, asserts it goes red for the
right reasons, and deletes them in a `finally` block.

## 6. How a law comes to bind, with no code edit

This is the part that makes the loop a loop rather than a chore. A law file may carry a `browser_check` block,
and the row for it is generated from that block — **data, not code**:

```json
"constraints": ["TURING1"],
"browser_check": {
  "constraint": "TURING1",
  "quantity": "Dv * f_u + Du * g_v",
  "op": "gt",
  "bound": "2 * sqrt(Du * Dv * (f_u * g_v - f_v * g_u))",
  "inputs": ["Du", "Dv", "f_u", "f_v", "g_u", "g_v"],
  "relation": "Dv f_u + Du g_v > 2 sqrt(Du Dv det J)  (diffusion-driven instability)",
  "note": "... 'violated' here means the committed Jacobian and diffusivities do NOT give a Turing instability;
           it says nothing about whether any pattern forms in an organism.",
  "band": "hypothesis", "tolerance": "relative"
}
```

Expressions are **parsed, never `eval`'d** (numbers, spec field names, `+ - * / ^`, parentheses, unary minus and
`sqrt abs log log10 exp min max pow`; no property access, no unknown call, and an identifier that happens to
name a global or a prototype member reads as **missing**). A missing input gives `cannot-evaluate` and names
it — a declared row never defaults a number it was not given. The block is **inside `content_hash`**, so
editing it needs a version bump, exactly like editing the statement; it is `undefined` rather than `null` when
absent, so **all 53 pre-existing laws kept their hashes byte-for-byte** and every released law-set pin stayed
valid (checked, not assumed).

A law may also bring **its own reference data**, for a number no engine state carries — `lookups` resolves a
table out of a repository JSON file at generation time, keyed by a design field, and embeds it as plain data so
the generated module stays dependency-free. Which row decided the verdict, and whether a fallback row was used,
is reported **in the row**: a reference value chosen silently is the same false assurance as a law that
evaluates nothing. Full grammar and field list: `lean/registry/README.md`, "Declarative browser check".

```bash
node lean/eliminate/browser-check-declared.test.mjs
```
```
ok   arithmetic, precedence and functions
ok   an identifier with no value yields null, never 0 or NaN
ok   the expression grammar is closed: no eval, no property access, no unknown call
ok   a reference table resolves by the design field, and a fallback is labelled as one
ok   every declarative block in the registry is wired to its law and emits a row
ok   a declarative row reports holds / violated / cannot-evaluate on the same relation
```

Four of the discovery agent's five survivors now carry such a block and bind through the whole chain. The fifth,
`development-growth-asymptote` 1.0.0 (candidate, released in 1.8.1), arrived with `constraints: []` and no
block, so **it evaluates nothing and binds nothing yet** — `check-exposed` reports it as a note today and would
fail it as `bind:accepted` the moment anyone promoted it. That is the honest state of it, written down rather
than discovered later.

## 7. Re-running the whole thing

```bash
node lean/eliminate/build-browser-check.mjs         # the evaluator, from lean/constraints.json + the registry
node dashboard/build-lean-api.mjs                   # the static mirror and the changes feed
node lean/registry/check-exposed.mjs                # every law on every surface; exit 1 on any failure
node lean/registry/law-surfaces.mjs <law_id>        # ONE law, hop by hop, with what each hop returned
node lean/registry/loop.test.mjs                    # the surface guards, made to fail first
node lean/eliminate/browser-check-declared.test.mjs # the declarative evaluator
node sim-engine/validate/lean-rounds.test.mjs       # the second Lean round, on real registry history
node lean/registry/release.mjs <semver> "<note>"    # cut a release: regenerates, verifies, then moves the pointer
```

Everything above is Node only. No Lean toolchain, no `lake`, and no Lean build was run for this demonstration:
whether the proofs compile is the separate `lake build` check, and every verdict here is a **floating-point
evaluation of the Lean-backed formulas, not a kernel check**. No Aves data is read or emitted anywhere in the
chain, and no credential is involved at any hop.

## 8. Known open link

`dashboard/public/blueprint3d/browser-check.mjs`, the Studio page's own bundled copy of the evaluator, is
maintained by another thread's `dashboard/build-graph.mjs` and currently embeds law sets up to 1.7.0, not the
current 1.8.1. `check-exposed` **fails** on this (`stale:page-checker`) rather than noting it. Law verdicts in
the Studio are unaffected, because `lean-client.js` prefers `/api/lean/browser-check.mjs`, which
`dashboard/build-lean-api.mjs` regenerates on every release; what is affected is anything importing the page
copy directly, such as `perturb.js`'s fallback, which would judge every row `unknown-lawset`. The fix is one
command, `node dashboard/build-graph.mjs`, owned by the Viz thread. It is listed here rather than silently left
because the whole point of this work is that a stale link should be loud.
