# Draft replies for #34, #35, #36 (lead session posts; nothing was posted or sent by this agent)

Target repo paths: tracks/issues/replies/issue-34.md, issue-35.md, issue-36.md (split on the headings).
No new web pages were opened for these three in this run; they consolidate files already in the repo.

---
## #34 Broad Institute fish biologists - NEEDS-AMIT
Source: tracks/research/agents/pp-broad-fish-biologists.json (run 2026-11-12).
Verified there (institutional page or DOI): three zebrafish groups linked to the Broad as associate
members, at Boston Children's, at MGH/BWH (the two pages disagree on which hospital) and one whose
2025 paper gives a Basel affiliation, so current Broad status is NOT confirmed. A fourth directory
entry has no verified fish paper. No Broad-affiliated medaka, killifish, cavefish or stickleback
group was found. Every track link is a hypothesis; nobody has been contacted.

Proposed decision (for the user to accept or change):
- Offer: one page, "we machine-check a published scaling law against your already-public data and
  send you the result; no data request, no commitment".
- Order: start with the group whose Broad affiliation is confirmed and current.
- Before any contact: re-open each person's own page (the earlier run's guessed bio URLs returned 404).

Single missing fact: who makes first contact - the user personally, as a Broad colleague, or the
team lead? (Agents must not; the rules forbid contacting anyone.)

---
## #35 Funding opportunities - PARTLY
Sources: tracks/research/agents/pp-funding-computational-biology.json and
pp-funding-bioelectricity-organism-design.json (both read 2026-11-12; NOT re-fetched today).
Nearest dated items as recorded there:
| Programme | Deadline as read 2026-11-12 | Size as read | Re-verify at |
|---|---|---|---|
| NSF eMB 25-509 | March 1, annual (next: 2027-03-01) | $2-6M programme total, 10-15 awards, 3 yr | nsf.gov solicitation 25-509 |
| NSF BIO Core 26-517 | any time | $280M programme, 250-300 awards | nsf.gov solicitation 26-517 |
| HFSP | annual, letter of intent end of March | not read (page 404) | hfsp.org |
| Wellcome Discovery Awards | any time | average GBP 3.5M | wellcome.org |
| Templeton Life Sciences | 2026 round closed | not read | templeton.org |
| Anthropic AI for Science | rolling | up to $20,000 API credits, 6 months | support.claude.com article 11199177 |
Not read in the earlier run (still open): Schmidt, DARPA, Sloan, Moore, CZI/Biohub, HHMI, Simons.
No programme page read names formal verification of biology as a funded topic.
Patch: add a "re-verified on" column to the funding table and a script that re-fetches each URL
and diffs the deadline text (suggested path tracks/scripts/recheck-funding.py; not written - out of time).

Missing fact for eligibility: which legal entity applies (a university, the Broad, or a company)?
NSF and Wellcome eligibility depends on it.

---
## #36 Sentry - BLOCKED
Sources: issue body and its 2026-11-13 update (fetched from the GitHub API today; zero comments, so
no reply yet from any bot or agent); tracks/research/agents/pp-sentry-agent-platform.json.
State: sentry.io is error monitoring with a hosted MCP server (OAuth) for reading a Sentry account;
nothing found that routes messages between agents. Unrelated agent-messaging products exist.
No tool, credential or config for it exists on this machine. Nothing can be connected without
an account the user owns.

Single missing fact: the URL (or product name) of the "Sentry" used before, and the login that
owns it. With that, the connection step is one MCP entry; without it, the issue stays blocked.
Recommended label change: keep "blocked", add "needs-user".
