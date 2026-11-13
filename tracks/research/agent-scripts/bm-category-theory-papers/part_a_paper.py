# Findings about arXiv:2604.26367 (the paper). Each entry: (claim, source, confidence, value, quote_key, quote)
S = "https://arxiv.org/html/2604.26367v2"
A = [
("Bibliographic identity: Marom, Tibbits, Zardini, Buehler; arXiv v1 29 Apr 2026, v2 20 Aug 2026 (cond-mat.soft primary); journal version J. Mech. Phys. Solids vol 216, article 106780, issued 2026-10 (Crossref). Confirms the earlier agent (spec-marom-buehler-deep.json).",
 S, "high", "arXiv:2604.26367v2; doi:10.1016/j.jmps.2026.106780", "paper", "arXiv:2604.26367v2 [cond-mat.soft] 20 Aug 2026"),

("PLAIN: the paper treats a living or engineered material as a 'machine with a dial and a response'. Each OBJECT is one such machine at one length scale (a single fibre, a layer, a strip, a whole scale). A MORPHISM is a rule that turns the fine-scale machine into the coarse-scale one (for example averaging many fibres into one layer). 'Preserves dynamics' means: let the fine machine run for a moment and then summarise it, or summarise first and then let the coarse machine run, and you get the same answer.",
 S, "high", "", "paper", "evolving at the fine scale and then mapping through"),

("PRECISE: an object of Dyn is a triple S=(X,E,f): X a finite-dimensional state space, E a finite-dimensional stimulus space, f the law, with dynamics xdot = f(x,e). (Appendix A.2 upgrades X and E to smooth manifolds and f to a smooth map X x E -> TX.)",
 S, "high", "S=(X,E,f); xdot=f(x,e)", "paper", "is the governing law that determines how the state evolves under a given stimulus"),

("PRECISE: a morphism (alpha, alpha_E): (X,E,f)->(Y,F,g) is a pair of smooth maps satisfying the simulation condition d(alpha)_x(f(x,e)) = g(alpha(x), alpha_E(e)) for all (x,e) (paper eq 4 / A.11). 'Preserve dynamics' means exactly this identity; the authors gloss it as 'the map commutes with time evolution'.",
 S, "high", "d alpha_x (f(x,e)) = g(alpha(x), alpha_E(e))", "paper", "In words, the map commutes with time evolution"),

("Composition is component-wise and the simulation condition is closed under it; the proof is the chain rule (Appendix A.2). Nat and Art are defined as FULL subcategories of Dyn whose objects 'arise from natural or biological mechanisms' / 'are realized as engineered or fabricated systems': membership is a label, not a mathematical predicate.",
 S, "high", "", "paper", "is the full subcategory whose objects are realized as engineered or fabricated systems"),

("Only ONE biological system is instantiated, the pine cone, as five objects F_fib -> L_lam -> T_tis -> S_elem -> O_org. Wheat awns, the Venus flytrap and nacre are one-sentence motivation (Sec. 1, Sec. 3) with NO equation or parameter; chiral seed pods appear once, in Case II, as the motivation for the twist mismatch. So the premise that the paper gives equations and parameters for awns, pods and the flytrap is false (confirms the earlier agent).",
 S, "high", "pine cone: 5 objects; awns/pods/flytrap/nacre: 0 equations", "paper", "Each of these can be represented as a chain of objects in"),

("Pine-cone fibre scale (eq 5-6): state (m, eps_L, eps_T) in R^3, stimulus u = relative humidity, first-order relaxation m' = -(m - m_eq(u))/tau_m, eps_L' = -(eps_L - chi_L (m - m0))/tau_L, eps_T' = -(eps_T - chi_T (m - m0))/tau_T. I searched the whole text: no numerical value of tau_m, tau_L, tau_T, chi_L, chi_T, m0 or m_eq(u) is given anywhere (script check_no_numbers.py).",
 S, "high", "no numeric parameter values in paper text", "paper", "We model the dynamics as a first-order relaxation toward equilibrium"),

("Lamina scale (eq 8-9): alpha_1 averages N fibre states; the lamina law has the same relaxation form. Only the uniform case (all fibres same parameters and orientation) is treated; heterogeneous fibres are deferred to a presheaf formulation.",
 S, "high", "", "paper", "the fibers within a lamina share the same constitutive parameters and the same orientation"),

("Tissue scale (eq 11-14): X_tis = X_lam^M, laminae evolve independently; effective strain along the tissue axis eps = eps_L cos^2(phi) + eps_T sin^2(phi); for M=2 the reduction beta_thk returns the mismatch eps_1 - eps_2.",
 S, "high", "", "paper", "Each lamina evolves independently under the shared humidity input"),

("Element scale (eq 15-17): kappa = C_geom * delta_eps_thk with the Timoshenko coefficient C_geom = (1/h) 6(1+mu)^2 / [3(1+mu)^2 + (1+mu n)(mu^2 + 1/(mu n))], mu = h1/h2, n = E1/E2, h = h1+h2; element law with a mismatch relaxation time tau_Delta (no value given). This is the 'f(m,n)' of the project record with h*C_geom = f.",
 S, "high", "kappa = C_geom * d_eps", "paper", "the Timoshenko bilayer formula [33] gives the intrinsic curvature as"),

("Organ scale (eq 18): opening angle of a clamped scale of uniform curvature, theta(L) = integral of kappa ds = L*kappa; organ = K independent elements; observable = mean opening angle. No new constitutive law at this scale.",
 S, "high", "theta = L*kappa", "paper", "No new constitutive laws are introduced at this scale."),

("PROVED BY CONSTRUCTION (on paper, Appendix A): Dyn is a category; Nat/Art are full subcategories; a reduction compatible with the dynamics induces a unique quotient dynamics (A.4, flat-space argument only needs well-definedness); alpha_geom (with geometry adjoined at zero dynamics) and alpha_3 are morphisms; Spec, Comp are categories; F, pi, E are functors. Most are definitional: pi sends every Spec morphism to an identity because Spec morphisms are DEFINED as pi-preserving; F is conjugation by chosen diffeomorphisms that are 'typically identities'.",
 S, "high", "", "paper", "the maps $\\iota_{S}$ and $\\jmath_{S}$ are typically identities"),

("LEFT TO EXPERIMENT, in the authors' words: verification is a claim about composition, not about any single model; model fidelity, material variability and fabrication tolerance 'remain empirical'. The paper's own concession is that some betas shown in the figures (strain components, curvature, mean opening angle) are 'terminal observables' that 'need not, by themselves, carry enough state to define closed dynamics', i.e. they are not Dyn morphisms.",
 S, "high", "", "paper", "The fidelity of the models themselves, together with material variability and fabrication tolerances, remains empirical"),

("Experiment: four bilayer strips (L=100 mm, w=10 mm, h1=h2=0.6 mm), multi-material FFF, measured at equilibrium only. Table 3 predicted vs measured (mean +/- s.d.): baseline hygro bend 36.4 vs 35.3+/-3.1 deg (n=3); Case I thermal bend 52.0 vs 55.7+/-4.2 (n=3); Case II hygro twist 41.3 vs 41.3+/-2.2 (n=4); Case III thermal twist 23.0 vs 23.3+/-2.5 (n=3). All within one s.d. of the mean.",
 S, "high", "n=3,3,4,3 specimens", "paper", "All four predictions agree with the measured mean to within one standard deviation."),

("The experimental validation is static: 'the deformed geometry was empirically measured at equilibrium'. No relaxation time is predicted or measured, so the DYNAMIC half of 'stimulus-response dynamical systems' (the tau's in eq 6, 9, 17) is untested by the paper.",
 S, "high", "0 time-resolved measurements", "paper", "In all cases the deformed geometry was empirically measured at equilibrium."),

("Case II (twist) uses a different pair of materials at +45 and -45 degrees (PA6-GF and PA612-CF), but eq 28 (delta_eps_12 = (eps_L1 - eps_T1) sin 2phi) is derived for an antisymmetric bilayer in which both layers share the same eps_L, eps_T. The paper says the twist curvature 'follows from plate theory for antisymmetric laminates' without giving the formula.",
 S, "high", "", "paper", "the twist curvature $\\tau$ follows from plate theory for antisymmetric laminates"),

("Case III (thermal twist) is presented as generated 'purely through composition' of the Case-I thermal fibre object and the Case-II twist reduction. This is the only composed case; the claim of |F_i|*|beta_j| verified candidates rests on 2x2 = 4 instances.",
 S, "high", "1 composed case of 4", "paper", "Any library of validated constitutive laws"),

("Future-work statement relevant to a joint paper: the authors propose the simulation condition as 'a type-level filter ... returning rejected candidates to the proposer with an explicit interface failure', but the paper shows only successes and no rejected candidate.",
 S, "high", "0 rejected candidates shown", "paper", "returning rejected candidates to the proposer with an explicit interface failure"),

("NEW (my derivation, checked numerically by closure_check.py, not stated in the paper): Proposition A.25 says alpha_geom is a Dyn morphism 'with the element dynamics defined as in the main text' because the element law is 'exactly' the pushforward. That holds ONLY IF tau_L = tau_T = tau_Delta (the fibre law eq 6 has separate tau_L, tau_T) AND the two laminae carry the same moisture m (then Delta_eps^0 is a function of the single m of eq 17; with m_A != m_B it depends on both). With tau_L=1, tau_T=5, two tissue states with the same (Delta_eps, m_A, m_B) had d(Delta_eps)/dt = -0.0095 and -0.0895, so no induced dynamics on (Delta_eps, m) exists and the compatibility condition A.15 fails. The paper states neither hypothesis.",
 "own calculation: agents2/scripts/bm-category-theory-papers/closure_check.py", "high (numeric counterexample, plain-python arithmetic)", "residual 1.7e-16 when tau_L=tau_T; dD/dt -0.0095 vs -0.0895 otherwise", "paper", "This is exactly the element law used in Section 3."),

("NEW (my derivation): 'F reduces to parameter substitution' cannot be literally true for the time constants. Condition A.42 asks for a diffeomorphism iota with d(iota)(f) = f'(iota, j). For one relaxation x' = -(x-a)/tau against x' = -(x-a')/tau', differentiate A.42 at the fixed point x=a: iota'(a)(-1/tau) = -iota'(a)/tau', and iota'(a) != 0 for a diffeomorphism, so tau = tau'. Hence swapping the biological tau for a printed filament's tau is NOT an instance of A.42 for any choice of iota (only chi, a and the coefficients can be absorbed by rescaling coordinates). Because Dyn has no time-rescaling morphism, 'same law, different parameters' leaves Dyn whenever the speed differs.",
 "own derivation (two lines, above); paper A.42 quoted", "high (elementary; scalar case; not machine-checked)", "tau' must equal tau", "paper", "This condition expresses that the engineered object preserves the state-space organization and evolution law of the biological one up to relabeling and parameter substitution."),
]
