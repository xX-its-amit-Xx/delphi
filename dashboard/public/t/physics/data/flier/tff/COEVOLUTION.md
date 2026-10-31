# Does flight-surface size co-evolve with oxygen transport at altitude? A logged search, and what it found

Physics thread, 2026-10-31 ~21:15 UTC, for the hypothesis stated by the project lead: "wing evolution likely co-evolves with
oxygen processing, since oxygen is thinner at higher altitudes." The hypothesis is physically motivated by the co-design map
(`tff.json`: the feasible region in wing loading against aerobic capacity shrinks with altitude on both axes), but a map of a
model is not comparative evidence. **No bird data** (Aves is the frozen holdout); high-altitude mammal haemoglobin is allowed
as O₂-side evidence only.

## Searches (all in `physics/SEARCHES.md`, Europe PMC, 2026-10-31T21:13Z)

| tag | query (short) | hits | relevant to the co-variation claim |
|---|---|---|---|
| `epmc-coevo-bats-altitude` | bats AND (altitude OR high elevation OR hypoxia) AND (wing loading OR wing area OR wing size) | 99 | none of the first 12 titles concern wing size against altitude or O₂ transport (community, occupancy, drinking, gliding, echolocator size) |
| `epmc-coevo-insects-altitude` | insects AND (altitude OR hypoxia OR hypobaric) AND (wing loading OR wing size OR wing area) AND flight | 198 | two candidate titles: a bumblebee dispersal out of the Qinghai-Tibet Plateau (10.1073/pnas.2513080122) and moth trait patterns along a Western Himalayan elevational gradient (10.1002/ece3.73083); **not read**, so not cited as evidence either way |
| `epmc-coevo-hb-altitude` | high altitude AND haemoglobin AND (oxygen affinity OR P50) AND mammal AND adaptation | 290 | O₂-side titles exist (Tibetan antelope pulmonary adaptation 10.3390/ani16203260; HBB function across species 10.1002/advs.78002); **not read**; they concern the O₂ side alone, not wings |
| `epmc-lung-diffusing` | diffusing capacity AND (lung OR respiratory surface) AND (bat OR air-breathing fish) | 137 | clinical hits; nothing on a bat lung or an air-breathing fish; no value fetched (this is why the TFF's air-breathing surface has no area) |

## Verdict, as the standing order asks

- **Support:** none found. No fetched source compares wing (or flight-surface) size with O₂ transport capacity across
  altitude in bats or insects.
- **Against:** none found.
- **Not found:** the comparative test the hypothesis needs (wing loading or relative wing area regressed on altitude of
  occurrence with haemoglobin affinity, haematocrit or cardiac output as covariates, in bats or insects) did not appear in
  these searches. Two insect elevational-gradient titles would be the first things to read; they were not read here.
- The O₂-side half (that high-altitude mammals adapt haemoglobin affinity) has a literature, by title; none of it was read
  for this note, so it is not cited as a finding.

**Status of the co-evolution claim: hypothesis, not supported by comparative data in this search.** What the model says is
narrower and is stated as such in `tff.json`: under the real fin polar and the trout haemoglobin curve, flight at a given
altitude needs either lower wing loading or higher O₂ delivery, with a square-root trade between them; that is a consequence of
the lift equation and the Hill curve, not an observation about evolution.
