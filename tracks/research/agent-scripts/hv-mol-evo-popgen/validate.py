# Two quick checks of population-genetic axioms against reported values.
# Opened sources: Kong 2012 (doi:10.1038/nature11396) mu = 1.20e-8 /site/generation;
# Chimpanzee genome 2005 abstract (doi:10.1038/nature04072) ~35 million single-nucleotide changes;
# Langergraber 2012 (doi:10.1073/pnas.1211740109) fossils 6-7 Myr, genetic split >= 7-8 Myr.
# ASSUMED (not opened): aligned genome 2.8e9 bp; generation time 25 or 29.7 yr; Haldane limit 1 per 300 generations.
mu = 1.20e-8
changes = 35e6
L = 2.8e9
d = changes / L
print("divergence d =", round(d, 5))
for g in (25.0, 29.7):
    T = d / (2 * mu) * g / 1e6
    print(f"V1 neutral clock k=mu: g={g} yr -> split {T:.1f} Myr (fossil 6-7 Myr; ratio {T/6.5:.2f})")
# V2 Haldane cost: selective substitutions <= 1 per 300 generations per lineage
for g in (25.0,):
    gens = 6.5e6 / g
    per_lineage = changes / 2
    haldane_max = gens / 300
    print(f"V2 Haldane: generations/lineage={gens:.0f}, observed subs/lineage={per_lineage:.3g}, "
          f"per generation={per_lineage/gens:.1f}, Haldane max adaptive={haldane_max:.0f}, "
          f"max adaptive fraction={haldane_max/per_lineage:.2e}")
    print("neutral expectation per generation (mu*L) =", round(mu * L, 1))
