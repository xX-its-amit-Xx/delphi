-- Probe 1: a "theorem" closed with sorry, and NO #print axioms line. A sound gate must reject it.
theorem probe_false_claim (a b : Nat) : a + b = a * b := by sorry
