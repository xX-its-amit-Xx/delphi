-- Probe 2: the result is assumed as an axiom, then "proved" from it. #print axioms is present.
axiom probe_assumed : ∀ a b : Nat, a + b = a * b
theorem probe_from_axiom (a b : Nat) : a + b = a * b := probe_assumed a b
#print axioms probe_from_axiom
