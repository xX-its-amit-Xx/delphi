-- Probe 4: contradictory hypotheses; the conclusion is unconstrained. Kernel-valid, physically empty.
theorem probe_vacuous (x : Nat) (h1 : x < 0) : x = 12345 := absurd h1 (Nat.not_lt_zero x)
#print axioms probe_vacuous
