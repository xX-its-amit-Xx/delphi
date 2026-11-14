# A printed panel that opens when damp, designed through its crosslinks

**Status: draft for Amit. Nobody has been contacted. Not legal advice. No price is quoted.**
The partner name in the brief is read as the London practice Mamou-Mani and its workshop Fab.Pub. Amit has not yet confirmed that reading.

## The idea in plain words

Print a thin sheet from a plant-based resin. Dip one face in a natural crosslinker, a small molecule that ties the polymer chains together. The dipped face now swells less in damp air than the other face. When the air gets humid, one side grows and the other does not, so the sheet curls, the way a pine cone scale does. No motor, no wiring, no glue line.

The amount of crosslinker is the design dial. More crosslinks make the sheet stiffer and make it swell less. Too few and a blade droops under its own weight. Too many and it no longer curls enough. The proposal is to find that window by proof and measurement before printing anything large.

## What is new here

Other groups have printed humidity-curling bilayers from wood and from hydrogels. The practice already compounds natural powders into its own print material. What neither has is a machine-checked statement of what a given material **cannot** do, attached to the data that says so. That is the deliverable: design rules whose logic a computer has checked line by line (in Lean, a proof checker), plus the measurements that feed them.

A checked rule can only rule a design out. It can never certify that a design works. Every rule below is of that kind.

## The proposed material (a hypothesis, not yet made)

- **Base resin:** acrylated soybean oil, thinned with a bio-based diluent. Neat, it is too thick for a desktop vat printer (11.8 Pa·s). Thinned soybean-oil resins have been printed at 405 nm, the wavelength Formlabs printers use, on other desktop machines. No opened paper used a Formlabs printer.
- **Water-absorbing phase:** a methacrylated polysaccharide (cellulose or chitosan derivative) mixed in.
- **Crosslinker dip, one face only:** citric acid or tannic acid. Citric acid roughly doubled the stiffness of a starch and cellulose film (13.4 to 29.6 MPa). A tannic acid soak doubled stiffness and cut swelling threefold in a printed gel (abstract only).
- **Photoinitiator:** not TPO, the common one. It was added to the EU list of substances of very high concern in 2023.
- **Printer route:** Formlabs Open Material Mode accepts any 405 nm resin. It is a one-time purchase per printer. Formlabs publishes no viscosity limit, and third-party resin failures are outside the warranty.

Nobody has shown this exact combination. It is the most credible first recipe from what was read, and the first bench step is cheap: cast a film, dip one face, and see whether it curls.

## What has been proved (all files pass the kernel check)

| Rule | What it rules out | File |
|---|---|---|
| Curvature ceiling | No two-layer strip can curl tighter than 1.5 × (swelling difference) ÷ thickness, whatever the layer ratio | `tracks/lean/HygromorphCeilingCheck.lean` |
| Crosslink window | If stiffness rises and swelling falls with crosslink density, every density above one threshold misses the target curl and every density below another is too soft. If the thresholds cross, no recipe in that family works | `lb-crosslinker-laws__CrosslinkerWindow.lean` (14 theorems) |
| Droop | A horizontal blade longer than a computable length sags past the limit, whatever its thickness | `lb-print-structure-laws__PrintStructureLaws.lean` (21 theorems) |
| Speed | A layer of thickness h cannot respond faster than h² ÷ (π² × diffusivity) | same file |
| Length cap | Droop and opening angle together cap blade length. Making the blade thicker does not help. Only a stiffer material at the same swelling does | same file |
| Fire, repaired | The earlier fire certificate had three theorems pointing the wrong way. Version 2 states which results can rule a coating out and which only say "cannot rule out" | `lb-fire-certificate-v2__FireCoatingCertificateV2.lean` (11 theorems) |

The physics formulas are assumptions written into each theorem by name. The proofs show the conclusions follow from them. They do not prove the formulas.

## What the data say so far

- **Curvature law on real bilayers.** On 12 wood bilayer records the law predicted curvature with nothing fitted, median measured ÷ predicted 1.17. On the 2 records set aside in advance it was within 7% and 24%. That is only two held-out records from one paper.
- **A warning from the same data.** 9 of those 12 records sit above the ceiling, up to 2.06 against 1.5. The strips were wide and thick, and the swelling difference was inferred, not measured. Either the inferred swelling is too small or the narrow-strip assumption fails. This must be settled on our own coupons before the ceiling is quoted to a client.
- **Crosslinking trend.** In material systems set aside in advance, 9 of 11 dose series moved the way the rule says (stiffer, less swelling). Ten of the 11 come from one paper, so the real evidence is nearer 3 or 4 independent series.
- **Where the rule did not fit.** For genipin and chitosan the simple swelling formula does not apply (the paper's own numbers put it outside the formula's range), and film strength fell with more genipin. "Stiffer with more crosslinker" is a thing to measure, not assume.
- **In liquid water the ceiling barely constrains anything.** Gels swell so much that almost any curl is allowed. The ceiling matters in humid air, where swelling is a few percent. That is the regime a building element lives in, and it is the one with the least data.

## The print files

Four files are ready (`tracks/print/`, on the dashboard): one single-print plate for the dipped-face route, and two plates plus a bonding jig for testing the law with stock Formlabs resins first. Each plate carries free coupons, strips, a ladder of ten fingers of stepped thickness, and a five-blade louvre tile 46 × 48 mm.

Thicknesses were doubled from the first design after a check against Formlabs' published minimums (0.4 mm supported wall). The thickness ratio is unchanged. The cost is half the curl and about four times the response time. One limit is still not met: Formlabs' print service asks for 1.5 mm walls in Flexible 80A, and the swelling layer is 0.8 mm. Nothing has been printed.

With the stand-in resins and a placeholder brief (droop under 10% of length, opening 30 degrees, response within an hour), the checked rules already rule out a 120 mm horizontal blade: it droops 26% and takes 3.7 hours. A demonstrator should hang its blades vertically or support both ends.

## The contract, in three stages

Each stage has a fixed price and a stop-or-go decision. The client pays only for stages started.

1. **Feasibility, 4 to 6 weeks.** A one-page rule sheet, the checked proof files with a one-command check, printed coupons with the print files, and a log of what was wrong. Pass means: every measured curl is at or under the ceiling, and each prediction was written down before its measurement.
2. **Prototype in the client's own material, 8 to 12 weeks.** The rules re-fitted to one of their blends, three panels of 300 mm or more printed on their machines, humidity cycling for at least 170 cycles, one indicative small-flame test at an accredited lab, and one geometry predicted before it is measured.
3. **Evidence pack, 8 to 12 weeks, optional.** Drawings and files for one interior piece up to about 2 m, and a costed plan for full fire classification by an accredited lab.

Stage lengths and the split of ownership are our proposal, not copied from a public example; none was found for this kind of contract. Starting position: each side keeps what it brought, the proof library stays open, the client owns the prototypes and any jointly made recipe.

## What is not promised

- No fire class. An interior plastic lining in England needs class C-s3, d2 in ordinary rooms and gets no easier route for being printed. A structure up for 28 days or less is exempt from the Building Regulations, but a fire risk assessment still applies.
- No outdoor, structural or facade use, and no claim about energy, comfort or daylight.
- No service life beyond the cycles actually run.
- No claim that a proof shows the material works. It shows only that the stated limit follows from the stated assumptions.

## The three biggest risks

1. **Cure depth.** Bio-fillers absorb the printer's light. One unfilled bio-resin cured only 0.11 mm in 110 seconds. Measure the working curve first.
2. **Creep.** No creep test was found. One soybean resin lost 90% of its stiffness between 20 and 80 °C, which a sunlit panel can reach.
3. **Leachables.** No data on what cured bio-resins give off was found. The common diluents in printed soybean resins are not bio-based.

## First three steps, in order

1. Cast a film of the thinned resin, dip one face in citric acid, measure the swelling of each face and the curl in humid air. A few days, no printer needed.
2. Print the stock-resin plates and measure the free coupons, then the bonded strips, against predictions written down first. This tests the ceiling on narrow strips with measured swelling.
3. Ask the client for their real limits (allowed droop, opening angle, response time, mounting) and re-run the rules against them.

*Sources and scripts: `tracks/research/agents/pr-*.json`, `lb-*.json`, `cs-hygromorph-bilayer.json`, `cs-crosslink-swelling.json`. Numbers marked "abstract only" or "snippet" there have not been read in full text.*
