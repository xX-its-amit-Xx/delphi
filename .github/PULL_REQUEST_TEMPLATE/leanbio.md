## LeanBio proposal

<!-- Criteria: CONTRIBUTING-LEANBIO.md. Delete the sections that do not apply (e.g. a grounding fix has no Lean). -->

**Record id / law id:** <!-- the claim id, e.g. maynardsmith-hitchhiking -->

**Claim in one sentence a high schooler can read:**

**Source:** <!-- DOI / PMID / dataset id / repo file, plus the quoted sentence for literature. Every identifier must resolve. -->

### Pipeline (CI checks these)
- [ ] `node pipeline/leanbio/run.mjs` re-run; `pipeline/leanbio/cache/` and `pipeline/leanbio/out/` committed
- [ ] at least one entity grounded; ambiguous groundings listed below
- [ ] belief computed and at or above `queue.min_belief` (`pipeline/leanbio/belief-params.json`): belief = ___ (E = ___, R = ___)
- [ ] `node pipeline/leanbio/check.mjs` and `node pipeline/leanbio/test.mjs` pass

Ambiguous or ungroundable entities, and how you resolved them (with source):

### Lean statement
- [ ] empirical premises are named hypotheses with sources (no `axiom`); no `sorry` / `admit` / `unsafe` / `native_decide`
- [ ] `#print axioms` shows only `propext`, `Classical.choice`, `Quot.sound`
- [ ] non-vacuity witness: <!-- declaration name and the values used -->
- [ ] `propose.mjs` mutants: ___ of ___ rejected
- [ ] scope stated (taxa, life stages, ranges, basis)
- [ ] joint consistency with lawset ___: <!-- outcome line from propose.mjs -->
- [ ] `propose.mjs ... --write` status: `candidate`
- [ ] `node dashboard/build-lean-api.mjs` then `node lean/registry/check-exposed.mjs` passes
- [ ] decision logged in `pipeline/leanbio/proposals.json`

**What the Lean statement says, in English, and how it matches the claim:**

**What it does not establish:** <!-- a theorem proves a consequence of its hypotheses, never that organisms obey them -->

### Boundaries
- [ ] no nanopub signed or published; drafts are unsigned and name no human ORCID, e-mail or key
- [ ] nothing about the held-out exam clade (`holdout/README.md`)
- [ ] no credentials or credit links anywhere

### Acceptance (for the reviewer, not the proposer)
Acceptance is a separate human step: set `approval.approved_by_role` (a role, never a name) in the law file and cut a
lawset with `node lean/registry/release.mjs`. The proposer's agent never accepts its own law.
