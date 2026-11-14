# #30 Anthropic Lean grant: what to formalise with 3 million tokens
Goes to: comment on the issue, and the "open decisions" list in STATE.md.
Status: NEEDS-AMIT (a decision), with a narrowed recommendation.

Checked: tracks/issues/ISSUES.md line 94 lists the 14 placeholder laws; lean/LAWS.md line 90 marks fin-length-ratio as "not formalised" and "an input the model carries".

Finding that changes option (a): the 14 are not 14 theorems waiting to be proved.
- 1 is retired (test-loop-only-density-sanity).
- 4 are "disc-" records of measurements, and fin-length-ratio is a measured input. These are data; nothing beyond "the number lies in the recorded range" can honestly be proved. (This classification is my reading of the names plus the one LAWS.md row; I did not open each registry entry.)
- About 8 have mathematical content: aspect-ratio-induced-drag, elastic-similarity, fick-principle, gene-regulatory-dynamics, gill-o2-uptake, muscle-power-premise, taxiing-thrust, walking-pendulum-speed.

Recommendation: option (a) restricted to those 8, then the remainder on option (c) question 2's three statements (attenuation bound, variance decomposition, cycle consistency), which are short real-analysis facts. Mark the 5 data records and the retired one "empirical, no theorem intended" in the registry instead of proving something hollow.

Unknowns: the source and terms of "3 million tokens" were never found (pp-meeting-notes-decoder.json); that record says the public AI for Science programme is stated in dollars of API credit, not tokens. The repo holds no measured tokens-per-theorem figure, so no budget arithmetic is given.

Single missing fact from Amit: where the 3-million-token figure comes from (which programme, and whether it counts input plus output).
