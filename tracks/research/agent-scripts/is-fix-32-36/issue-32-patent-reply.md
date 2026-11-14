# #32 Financing and "license your patent" - draft reply (NEEDS-AMIT)

Target repo path: tracks/issues/replies/issue-32.md (new file; lead session posts it).
Not legal advice, not freedom-to-operate, not a patentability opinion.

## What is already answered in the repo
- tracks/research/agents/bm-ip-landscape-deep.json (run 2026-11-12) read claim 1, assignee and status
  of each prior-art family from its Google Patents page. Examples it records:
  US 11155025 B2 (MIT/Stratasys, granted, active), US 9931829 B2 (MIT, granted, active),
  US 12225924 B2 (Carnegie Mellon, granted), US 2015/0158244 A1 (abandoned parent).
- The same file's could_not_find says: no patent or application held by the team was searched
  for by name, and "license your patent" is unconfirmed.
- tracks/research/agents/pp-meeting-notes-decoder.json also lists "Source for 'license your patent'
  (no patent identified)" as not found.

## What could plausibly be claimed (the four options in the issue, ranked by this agent's judgement)
1. Design-and-verification METHOD (generate a geometry, check it against machine-proved laws,
   emit a certificate). Least crowded by the composition and geometry families listed above;
   software-method claims face subject-matter eligibility hurdles in the US.
2. Certified design-FILE FORMAT. Usually protected by copyright, a specification and a trademark
   rather than a patent; an open licence may serve the project better.
3. GEOMETRY. Crowded: the granted families above claim specific bilayer or groove geometries.
4. COMPOSITION. Crowded and needs wet-lab data the project does not have.
These rankings are a judgement, not a search result.

## The single missing fact (only the user can supply)
Does a filed patent or provisional application exist - yes or no - and if yes, its application
number and the named applicant?
- If yes: this agent's next step is a claim-by-claim comparison with the prior-art table.
- If no: "license your patent" is a plan; anything already public (the repo is public) starts
  novelty clocks, so a patent attorney should be asked before more is published.

## Not done
- No search of patent offices by any person's name (rule: no names sent to outside services).
- Espacenet, Patentscope and Lens refused automated access in the earlier run; not retried.
