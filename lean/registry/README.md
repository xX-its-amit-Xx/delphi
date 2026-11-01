# Lean law registry: versioned, extensible law sets

The laws the Design Studio judges against are not a fixed list. New laws arrive (from a person, an agent,
or an observation), old ones get contested or retired, and every past verdict must stay reproducible. This
folder holds that lifecycle. Nothing here is ever deleted: retiring or contesting a law changes its status
and its history, never removes its file.

## Layout (stable; the loader in lib/lean-source.mjs reads it)

| path | what |
|---|---|
| `lean/registry/laws-registry.schema.json` | JSON Schema (draft 2020-12) for one law file |
| `lean/registry/laws/<law_id>.json` | one file per law, at its CURRENT version (schema above) |
| `lean/registry/law-versions/<law_id>@<version>.json` | every superseded version of a law, kept so older law sets stay reproducible (`loadLawVersion(id, version)` in registry-lib.mjs) |
| `lean/registry/lawsets/lawset-<semver>.json` | a law-set release: `{version, created, previous, laws:[{law_id, version, content_hash, status, kind}]}` |
| `lean/registry/lawsets/current.json` | `{version, file}`: the current law set |
| `lean/registry/CHANGELOG.md` | one section per law-set release |
| `lean/registry/proposals/<law_id>/` | a proposal: `law.lean`, `meta.json`, and `result.json` written by propose.mjs |
| `lean/registry/discovered/` | machine-proposed drafts written by discover.mjs (`index.json` + one folder per draft, same shape as a proposal) |
| `lean/registry/build-registry.mjs` | bootstrap: builds `laws/` and lawset 1.0.0 from lean/laws.json, lean/constraints.json, lean/empirical.json and the Lean modules |
| `lean/registry/release.mjs` | cuts a new lawset from the current law files (`node lean/registry/release.mjs <semver> "<note>"`) |
| `lean/registry/propose.mjs` | lifecycle for a new law; CLI and importable `propose(file, meta)` |
| `lean/registry/discover.mjs` | mines the project's sourced data for candidate regularities |
| `lean/registry/contest.mjs` | records an observation that contradicts a law (`contest(law_id, observation)`) |
| `lean/registry/observations/` | observation records used by contest.mjs |
| `lean/registry/perturb-metas.mjs` | the meta.json of the seven lean/Delphi/Perturb.lean laws, and the run that proposed them |
| `lean/registry/lean/Witnesses.lean` | non-vacuity witnesses for the named hypotheses, plus the shared-scope bridges (compiled with `lake env lean`) |
| `lean/registry/registry-lib.mjs` | shared helpers: canonical JSON, `contentHash(law)`, loading laws and lawsets |
| `lean/registry/test.mjs` | tests |

`check-exposed.mjs`, `AGENTS-RULE.md` and `UPSTREAM-SUGGESTION.md` in this folder belong to the Lean-API
agent, not to the registry.

## One law file (`laws/<law_id>.json`)

```
law_id            string, the file name without .json
version           semver of THIS law; bump on any change to the hashed content
kind              'physical' | 'biological'
class             'theorem' | 'theorem-from-hypothesis' | 'named-hypothesis' | 'empirical-observation' | 'convention' | 'gap'
status            'proposed' | 'candidate' | 'accepted' | 'contested' | 'retired'
lean_ref          {module, theorem, structure?, commit, statement_sha256, content_hash}
                  module: path under the repo (lean/Delphi/X.lean); theorem: fully qualified name or null;
                  statement_sha256: sha256 of the theorem/structure statement text in the module at `commit`;
                  content_hash: same value as the top-level content_hash (kept here for the loader)
statement_en      plain-English statement
hypotheses        [{name, statement, value?, unit?, source?}]  named empirical premises, never `axiom`
scope             {taxa:[...], life_stages:[...], ranges:{quantity:{min,max,unit}}, kernelChecked:[...], assumed:[...]}
shared_scope      {atoms:[Lean Prop text over q.<quantity>], quantities:{name:{unit, description}}, bridge}
                  only laws that constrain observable quantities carry atoms; the joint-consistency check uses them
evidence          {sources:[...], observations:[...], n_organisms?, n_observations?}
sources           flat list of source strings (also inside evidence; kept top-level for the loader)
non_vacuity_witness  {lean, statement} or null with a reason
constraints       eliminate-pipeline constraint ids this law backs (C9, E2, ...)
introduced_in     law-set version that first contained it
supersedes, superseded_by   law_id or null
retired_reason    string or null
contested_with    [{law_id, reason, proof?}]  for status 'contested'
approval          {approved_by_role, date, basis}  REQUIRED for 'accepted'; a role, never a personal identifier
origin            {by_role, kind:'bootstrap'|'human'|'agent'|'observation'|'machine-discovery'}
history           [{version, date, change}]
content_hash      sha256 over the canonical JSON of the hashed fields (below)
```

Hashed fields: `law_id, version, kind, class, lean_ref.module, lean_ref.theorem, lean_ref.structure,
lean_ref.statement_sha256, statement_en, hypotheses, scope, shared_scope, non_vacuity_witness`. Status,
approval, history and evidence are NOT hashed: a law changes status without changing what it says. Any edit
to a hashed field must bump `version`; test.mjs fails if a hash does not match.

## Versions of one law

A change to what a law says (its Lean statement, hypotheses, scope or shared-scope atoms) is a new VERSION of the same
`law_id`: semver per law, major for a changed statement. The old version's file is copied to
`law-versions/<law_id>@<old>.json` (with `superseded_by: <law_id>@<new>`), the new file carries
`supersedes: <law_id>@<old>`, its Lean statement is a NEW declaration (the old one stays compiled), and a new law
set pins the new version. Example: `perturb-pressure` 1.0.0 (`Delphi.Perturb.closed_bladder_rules_out`, pressure
`p0 + k d` with the Studio fixing k = 0.1 atm/m) was superseded in law set 1.4.0 by 2.0.0
(`Delphi.Hydro.closed_bladder_rules_out` in lean/Delphi/Hydrostatics.lean, pressure `p0 + rho g d`).

## Status lifecycle

```
proposed --propose.mjs (builds, no sorry/axiom, witness, jointly consistent, mutants rejected)--> candidate
candidate --human approval: approval.approved_by_role set by a person, then release.mjs--> accepted
propose.mjs finds a proved contradiction with an accepted law -------------------------------> contested
any --> retired (retired_reason, superseded_by; file stays)
```

Promotion to `accepted` is never automated. A person edits the law file to set
`approval: {approved_by_role: "<role, e.g. project-lead>", date, basis}` and `status: "accepted"`, then
cuts a lawset with release.mjs. release.mjs refuses an `accepted` law without `approval.approved_by_role`, and
refuses an approval field that looks like an e-mail address or a personal name pattern is not checkable, so the
rule is: write a role.

Bootstrap note: the laws in force in lean/constraints.json before the registry existed were entered as
`accepted` with `approval.approved_by_role: "bootstrap-grandfathered"` and a basis saying so. No individual
review of each law was recorded by the registry; the role string says exactly that.

## Scope (and the 'out-of-scope' verdict)

Every law states `scope.taxa`, `scope.life_stages`, `scope.ranges` and `scope.basis`, taken from its sources.
Where a CHECK is narrower than its law, `constraint_scopes[<constraint id>]` overrides it. The scaling theorems
(cube, area and wing-loading laws) hold for any isometric family. C7b, C2a, C8e, C9c and C8c, however, are
evaluated by comparing the design with one flying-fish specimen (Cypselurus hiraii, Park and Choi 2010 Table 1
model L3), so those rows are scoped to Exocoetidae. E2 rests on six flying-fish length-weight studies, so it is
scoped to Exocoetidae adults. A design that names no taxon is out of scope for every law whose taxa are not
`any`. lib/lean-scope.mjs (the Lean-API thread's) applies the same rules for checkDesign; the two taxonomies
must stay in step. A taxon outside the small table (`SCOPE_PARENT` in browser-check-lawset.fragment.mjs) is
treated as out of scope, never red.

Sanity rule, enforced in test.mjs: no ACCEPTED law may be red for an unedited measured wild type within its own
scope. If one is, the law or its constants is wrong and must be contested (`contest.mjs`).

## Using it from the Design Studio (browser-check.mjs API)

`lean/eliminate/browser-check.mjs` is generated by `lean/eliminate/build-browser-check.mjs`, which reads this
registry; the judging code is in `lean/eliminate/browser-check-lawset.fragment.mjs`. New exports:

```js
import { check, checkRaw, judgeRows, LAWSET_VERSION, LAWSETS, CONSTRAINT_LAW, LAW_INFO, scopeCheck } from './browser-check.mjs';
LAWSET_VERSION                 // '1.2.0': the current law set when the file was generated
Object.keys(LAWSETS)           // every released law set: ['1.0.0', '1.1.0', '1.2.0'] (for a "judge against" picker)
check(design)                  // judged against LAWSET_VERSION
check(design, { lawset: '1.0.0' })            // judged against an older law set (reproduces old verdicts)
check(design, { includeCandidates: true })    // candidate laws may also produce red (flag them in the UI)
checkRaw(design)               // the formulas alone, no law-set judgement (the old check())
```

The design should carry `taxon` (e.g. 'Danio rerio', 'Exocoetidae', 'Cypselurus hiraii') and `life_stage`
('embryo' | 'larva' | 'juvenile' | 'adult'). Each row gains the following fields:

| field | meaning |
|---|---|
| `verdict` | `holds`, `violated` (red), `cannot-evaluate`, **`contested`** (amber: the formula says violated but the law is contested), **`candidate-violated`** (grey/flagged: a candidate law the formula says is violated), **`out-of-scope`** (grey), **`not-in-lawset`** (the law is proposed, retired, or absent from the chosen law set) |
| `computed_verdict` | what the formula said before the law-set judgement |
| `lawset` | the law-set version this row was judged against: show "judged against law set vX.Y.Z" |
| `law` | `{law_id, version, kind: 'physical'\|'biological', status}` in that law set |
| `scope_check` | `{in_scope, reason, scope}` |
| `display` | `'red' \| 'amber' \| 'grey' \| 'green' \| 'none'` (use this rather than re-deriving colour from `verdict`) |

Only `display: 'red'` means "violates a law". A Studio page that still maps `/^viol/` to red keeps working:
`contested` and `out-of-scope` do not match it, and `candidate-violated` does not either.

## Proposing a law (propose.mjs)

`node lean/registry/propose.mjs <law.lean> --meta <meta.json> [--write] [--lawset X.Y.Z] [--no-mutants]`, or
`await propose(file, meta, opts)`. The steps, the meta.json fields and the outcomes are in the file header. A
library module (`lean/Delphi/*.lean`) is referenced in place; any other file is copied to
`proposals/<law_id>/law.lean`. Outcomes: `candidate` (all checks passed), `contested` (a contradiction with an
accepted law was PROVED in Lean; both ids are recorded, and the accepted law gets an `open_conflicts` entry but
keeps its status), `proposed` (rejected or undecided; reasons listed). Joint consistency works on the
shared-scope atoms, which propose.mjs first proves equivalent to the proposal's Lean structure (bridge). For the
accepted empirical laws that equivalence is `Delphi.Registry.bridge_E1..E5` in `lean/registry/lean/Witnesses.lean`.

## Discovering laws (discover.mjs)

`node lean/registry/discover.mjs` mines sourced project data and writes MACHINE-PROPOSED drafts to
`discovered/<id>/{law.lean, meta.json}` plus `discovered/index.json` (with each draft's fate once it has been
proposed). Drafts enter no law set until they pass propose.mjs and a human approves them.

## Contesting by observation (contest.mjs)

`node lean/registry/contest.mjs <law_id> --observation observations/<id>.json` records a measured organism that
contradicts a law within its scope. A candidate law becomes `contested`; an accepted law gets an
`open_conflicts` entry for a human. Cut a release afterwards. Example: `observations/jamieson2023b-pseudoliparis-8336m.json`
contests `perturb-depth-cap` (lawset 1.2.0).
