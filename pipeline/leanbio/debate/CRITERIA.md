# Referee criteria for the LeanBio law debate

**Version `leanbio-debate-criteria/1.2.0`. Fixed 2026-11-01, BEFORE any debate ran.** This file is hashed into
`criteria.lock.json`; `debate.mjs` refuses to run if the hash of this file does not match the lock, and every ruling
records the hash it was decided under. Changing a criterion means a new version, a new lock and a note in
`DEBATE-RESULTS.md` saying which rulings used which version. Rulings are never re-scored silently.

A candidate law arrives from the discovery agent as a Lean file plus a meta file (`law_id`, `statement_en`,
`lean.structure`/`lean.theorem`, `lean.witness`, `shared_scope.atoms`, `scope`, `sources`, `evidence`). It has already
passed `lean/registry/propose.mjs` (it builds, no `sorry`/`axiom`, a witness compiles, mutants are rejected). The
debate asks a different question: **is this law fit to constrain a design?** `propose.mjs` asks whether the Lean is
sound. The referee asks whether the Lean is about biology.

## The seven criteria

Each is scored `pass` / `fail` / `unclear`. The ones marked **HARD GATE** are decided mechanically from the candidate,
the evidence check and the repo's data; a `fail` on a hard gate ends the debate as REJECT and the language-model
referee cannot overturn it (it may only add reasons). The others are the referee's judgement, argued by the proponent
and attacked by the critic, and a `fail` there is normally NEEDS-WORK rather than REJECT.

### C1 — Does it bind anything real? **HARD GATE**

Two things must both hold:

1. **Non-vacuity witness.** `meta.lean.witness` names a declaration that compiles and is about this law (inherited
   from `propose.mjs` step (c), re-read here, not re-run). A law nothing can satisfy constrains nothing.
2. **A rejecting design.** There must exist an assignment of the law's own shared quantities, inside the law's stated
   ranges and physically reachable for an organism of its scope, that the law declares **false**. The debate requires
   this witness to be exhibited as numbers, not asserted. `nonvacuity.mjs` searches the atoms for one.

A law that is true for every assignment of its quantities is **vacuous for design purposes** even if it is a theorem,
and is REJECTED. This is the criterion a tautology fails.

**Two outcomes, not one.** C1 `fail` is reserved for a law that *cannot* bind: a tautology over its own quantities, or
a witness whose numbers contradict the law's own statement. A law that declares **no shared scope at all** — no atoms,
no shared quantities, so the studio has nothing to evaluate — is a different thing: it is *provable but not
checkable*, and the fix is to declare the quantities a design would have to carry. That is C1 `unclear`, it blocks
promotion exactly as C6 `unclear` does, and the verdict is NEEDS-WORK naming the missing inputs. A proposer who
declares `browser_check_absent` with `missing_inputs` and `would_constrain_if_supplied` has been honest about this and
is told what to add; a proposer who simply omitted a shared scope is told the same thing. Neither is rejected for it.

(Amendment, 1.0.0 -> 1.1.0, made before the first ruling: 1.0.0 collapsed both into `fail`, which would have REJECTED
every honest round-2 theorem for a defect that is a missing mapping, not a false claim. No ruling was decided under
1.0.0; `out/rulings.json` did not exist when this was changed, and the lock records both hashes.)

### C2 — Is every empirical constant sourced, with its kind? **HARD GATE**

Every numeric literal in the law's statement (the Lean statement text and `shared_scope.atoms`) that is not a
structural constant (0, 1, 2, and exponents of the law's own algebraic form) must appear in
`meta.constants[]` as `{value, unit, kind, source}` where:

- `kind` is one of `measured`, `derived`, `cited`, `calibrated`, `assumed` (the repo's provenance vocabulary);
- `source` names a retrievable artefact: a DOI, a PMID/PMCID, or a repo file with a content hash;
- the **evidence checker** must have found the value (or a value it is derived from, with the derivation stated) in
  that source by an actual GET of the source. A source that 404s, is paywalled with no fetched text, or does not
  contain the number is a `fail`.

`kind: assumed` or `kind: calibrated` for a constant that appears in the statement is a **fail**: a calibrated number
is never a result, and an assumed one is a placeholder. Such a law may be interesting; it may not constrain a design.

### C3 — Is the scope explicit and honest?

`meta.scope` must name taxa, life stages and the ranges of the quantities. The referee asks whether the scope is
**wider than the evidence**: four stuffed specimens of one species do not license a scope of `Teleostei`, and a
single-species measurement does not license a family. A scope that reads `taxa: []` (meaning everything) with
species-level evidence is a `fail`. Narrowing scope is the usual NEEDS-WORK fix.

### C4 — Is it independent of the accepted set, or a restatement?

A `fail` if the law is (a) a definition dressed as a theorem (it is true by the meaning of its terms — "wing loading
is weight over area"), (b) an algebraic rearrangement of an accepted law with no new content, or (c) implied by an
accepted law over the overlapping scope. The referee is given the accepted laws whose scope overlaps, with their
statements, and must say for each whether the candidate adds a constraint that one does not already impose.
Restating a definition is a REJECT, not a NEEDS-WORK: no narrowing fixes it.

### C5 — Is it consistent with the accepted set? **HARD GATE**

`propose.mjs` already answers this: status `candidate` means a joint witness was constructed; status `contested`
means a contradiction with an accepted law was proved in Lean. A candidate that arrives `contested` gets verdict
**CONTESTED** and goes to the human queue with both law ids — it is not rejected (the accepted law may be the wrong
one) and it is not promoted.

### C6 — Would it have fired on the wild-type organisms? **HARD GATE**

The decisive criterion. A real animal must not violate an accepted law in that law's own scope. `wildtype.mjs`
evaluates the candidate's `shared_scope.atoms` against every wild-type organism in `wildtype.json` whose taxon is
inside the candidate's scope, using that organism's **measured** quantities only. If the law evaluates **false** for
any wild-type organism in its own scope, the law is wrong about biology and is REJECTED, whatever its Lean status.

Two honest outcomes are not failures: `out-of-scope` (no wild-type organism in `wildtype.json` falls inside the
scope) and `cannot-evaluate` (the organisms in scope lack the quantities the atoms need). Both are reported as
such and leave C6 `unclear`; a law with C6 `unclear` can still reach NEEDS-WORK but **never**
PROMOTE-TO-CANDIDATE — an untestable constraint does not get to turn designs dashed.

### C7 — Is it circular with the data it was derived from?

A bound fitted to n observations and then tested against those same n observations has been tested against nothing.
The referee asks whether the law is a **record bound** (the extremes seen so far, which the next specimen may break)
or an **impossibility** (a mechanism forbids crossing it). A record bound is not rejected for being one — it is
rejected for being *presented* as an impossibility. `statement_en` and `evidence.caveats` must say which it is. Honest
record bounds are NEEDS-WORK at worst; a record bound sold as a law is a REJECT.

## Verdicts

| verdict | when | what happens |
|---|---|---|
| **PROMOTE-TO-CANDIDATE** | every hard gate `pass`, C6 `pass` (not `unclear`), no soft criterion `fail` | written to the registry as status `candidate` (`propose.mjs`, never `accepted`), and a promotion request is queued for a human |
| **NEEDS-WORK** | no hard gate `fail`, but a soft criterion fails or C6 is `unclear` | not written; the ruling names exactly what must change |
| **REJECT** | any hard gate `fail`, or C4/C7 fails in the un-fixable way above | not written; the ruling names why, and the law id is recorded so the discovery agent does not resubmit it unchanged |
| **CONTESTED** | C5 contested, **or the candidate asserts one arm of a known open dispute** | not written as a candidate; queued for a human with both law ids |

### Known open disputes (added in 1.1.0)

A candidate that asserts one side of a question this project holds open is CONTESTED, not promotable, however clean its
Lean is: promoting one arm would settle by automation a question the evidence has not settled. The disputes are listed
in `open-disputes.json` (currently: the kcnk5b membrane-potential sign, the teleost depth cap, the lat4a paralogue
identity). `lean/registry/open-questions/` is the first-class home for such a question, with an arm per side.

## Record types emitted (1.1.0)

Every ruling also emits one record for `lean/registry/open-questions/`, so a rejection is a result and not a bin:

| ruling | record type | why |
|---|---|---|
| REJECT where the evidence points **both ways** (C5 contested, an arm of a known dispute, or the critic produced a sourced counter-measurement the proponent's source contradicts) | `open-question` with an arm per side | the question is live; neither arm may constrain a design while it is |
| REJECT as vacuous, unsourced, or firing on a wild-type organism | `failed-theorem` with that reason | the statement is settled and wrong (or unsupported); it is kept so nobody reproposes it |
| NEEDS-WORK | `candidate-with-requirements` | the referee's list of what would make it promotable travels with the law |
| PROMOTE-TO-CANDIDATE | `promotion-request` | queued for a human; the law itself is already in the registry as `candidate` |

### Precedence when more than one criterion bites (1.2.0)

Decided before the first ruling, because the first real candidate hit it:

1. **A C6 `fail` outranks everything, including a C5 contest.** If a real wild-type animal violates the candidate in
   the candidate's own scope, the candidate is wrong, and a contest it has with an accepted law is thereby settled
   against the candidate, not left open. The verdict is REJECT, and the contested law id is still recorded so a
   reader can see the contest existed. A rejection for firing on a real animal is a `failed-theorem` record, not an
   open question: nothing is open about it.
2. Then a C1 or C2 `fail`: REJECT.
3. Then C5 `contested`, or a match against a known open dispute: CONTESTED, and an `open-question` record with an arm
   per side.
4. Then any `unclear` (C1, C2, C5 or C6): NEEDS-WORK at best.
5. Otherwise the referee rules freely within the criteria.

The referee writes a reason per criterion. A ruling with a bare verdict and no per-criterion reasons is itself invalid
and is recorded as `NEEDS-WORK (referee gave no reasons)`.

## What this does NOT decide

Acceptance. No verdict in this file promotes a law to `accepted`. See `README.md`, "The automation question".
