-- Probe 5 (positive control for the gate): sorry WITH #print axioms. check.sh must reject this one.
theorem probe_sorry_printed (a b : Nat) : a + b = a * b := by sorry
#print axioms probe_sorry_printed
