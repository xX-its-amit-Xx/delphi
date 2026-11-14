# One-page contract skeleton: materials R&D pilot with an architecture practice

Status: DRAFT for the project lead. Nobody has been contacted. Not legal advice.
The brief's partner name was written as "Mamu Money"; we read it as the London practice
Mamou-Mani (fabrication arm Fab.Pub). That reading is NOT yet confirmed by the user.

## Why this shape (each line has a page opened on 2026-11-13; quotes checked by verify.py)
- The practice already runs a material-intake route: Fab.Pub says "We can help define the testing pathway".
- They already compound fillers into PLA and PETG in-house (Tate Modern piece, open until 11 April 2027),
  and already have a named flame-retardant blend with no published class. So the gap we can fill is
  measured evidence and checked design rules, not another filler.
- Public UK practice for small R&D contracts is two-stage and stage-gated: a short feasibility stage,
  then a separate decision on a prototype stage; the supplier keeps its IP (SBRI brochure 2015;
  a 2026 Contracts for Innovation call: 6-9 months, "phase 1 of a potential 2 phase competition").
- Scale anchors for a London installation: GBP 36,000 + VAT (up to three months on site, 12.5 % design
  fee, 10 % minimum contingency) and GBP 50,000 + VAT (design, fabrication, install, removal).
  Fab.Pub's own form: minimum budget GBP 250, minimum 2 weeks.
- Fire: for an interior lining the England guidance asks C-s3, d2 in ordinary rooms and B-s3, d2 in
  circulation spaces. A plastic lining gets no easier route: the thermoplastic TP(a)/TP(b) route covers
  windows, rooflights, lighting diffusers and suspended ceilings only. A structure up for 28 days or less
  is exempt from the Building Regulations, but the Fire Safety Order's risk assessment still applies.

## Parties and scope
Supplier: the DELPHI team (design rule + Lean-checked bound + small Formlabs test coupons).
Client: the practice and/or its fabrication arm. Subject: ONE passive, moisture-responsive printed
element concept for an INTERIOR, NON-STRUCTURAL installation piece. Fixed price per phase; the client
may stop at each gate and pays only for phases started.

## Phase 1 - Paper and coupon feasibility (4-6 weeks)
Deliverables: (a) one-page design rule sheet: thickness, layer ratio, expected curvature and response
time, each with its source; (b) the Lean file stating the bound the design must stay under, plus the
one-command check; (c) 10 printed coupons and the print file; (d) a "what was wrong" log.
Acceptance tests (pass/fail, measured by the supplier, raw data handed over):
 A1. Lean check script exits 0 with zero `sorry` and zero new axioms; named hypotheses are listed.
 A2. Coupon curvature measured at 30 % and 90 % relative humidity, n >= 5; every measured value is at
     or below the checked ceiling (a value above it means the law or the measurement is wrong: stop).
 A3. Prediction frozen in writing BEFORE measuring; reported error = |predicted - measured| / measured.
 A4. Response time to 90 % of final curvature reported in minutes, n >= 5.
Gate: client decides go / no-go on Phase 2.

## Phase 2 - Client-material prototype (8-12 weeks)
Deliverables: (a) the same rule re-fitted to ONE client blend, printed by the client at their scale
(supplier does not operate their robots); (b) three panels of at least 300 mm; (c) test report.
Acceptance tests:
 B1. Humidity cycling 30-90 % for at least 170 cycles (the published benchmark's count); curvature
     loss between cycle 1 and the last cycle reported; pass threshold agreed in writing at the gate.
 B2. Indicative small-flame test to EN ISO 11925-2 at an accredited lab on the client blend:
     flame spread <= 150 mm within 60 s (the class B/C/D small-flame criterion). Reported as
     INDICATIVE only.
 B3. Mass and thickness of every panel within +/- 10 % of the rule sheet.
 B4. Holdout: one geometry the supplier has never fitted is predicted first, then measured.
Gate: go / no-go on Phase 3.

## Phase 3 - Installation-ready evidence pack (8-12 weeks, optional)
Deliverables: (a) drawings and print files for one interior piece of up to about 2 m; (b) a test plan
and quotation from an accredited lab for the full classification tests (EN 13823 and EN ISO 11925-2,
classification to EN 13501-1); (c) hand-over of the rule sheet, the Lean file and the data.
Acceptance tests:
 C1. All files open and print on the client's machines without supplier help (client signs off).
 C2. Every number in the pack traces to a raw data file or a cited page (client spot-checks 10).
 C3. The fire test plan names the lining class the venue needs (C-s3, d2 or B-s3, d2) and the
     specimen count; the venue's fire engineer, not the supplier, confirms it.

## Intellectual property (starting position, to negotiate)
Each side keeps what it brought. The Lean library stays open source (Apache-2.0). The client owns the
physical prototypes and gets a non-exclusive licence to use the rule sheet on its own projects.
Jointly made material recipes: owned by the client; the supplier may publish methods and negative
results after a 60-day review. (The UK Lambert model agreements are the public template; none of the
seven one-to-one models covers joint ownership.)

## Explicitly NOT promised
- No Euroclass or any fire classification, and no claim the piece meets building-regulation guidance.
- No outdoor, wet-area, structural, load-bearing or facade use; no wind, impact or creep rating.
- No energy, comfort or daylight saving for a building (no measured benefit exists in the literature).
- No service life beyond the cycles actually run; no compostability or carbon claim.
- No claim that a Lean check proves the material works: it only proves the stated bound follows from
  the stated assumptions.
- No regulatory sign-off, insurance cover, or approval by any venue, engineer or authority.
- Prices: none are quoted here. The anchors above are other people's public budgets, not our fee.
