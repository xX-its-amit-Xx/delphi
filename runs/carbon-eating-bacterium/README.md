# A bacterium that eats carbon

```
node runs/carbon-eating-bacterium/run.mjs
```

Five generations. The first does not get as far as a design.

| gen | asked | what the system said |
|----|----|----|
| 0 | a bacterium that eats carbon and swims | **refused**: no taxon recognised. `bacterium`, `eats` and `carbon` are all unreadable to the lexicon. |
| 1 | *Cupriavidus necator* that fixes CO₂ and swims | **thin**: 2 organ systems, 6 organs, 1 tissue, 1 cell type. The query is fine; Uberon is an animal ontology. |
| 2 | …swimming with a hinged paddle | **impossible**, by Purcell's scallop theorem. Not slow — zero net displacement per cycle, at any beat frequency. |
| 3 | …swimming with a rotating flagellum | **not contradicted**. The theorem names its own escape and the design takes it. |
| 4 | could it establish anywhere? | **outcompeted**, on the designer's own four parameters. |

## The headline defect

Asked for a bacterium, the blueprint tool built **an animal**. `bacterium` is not in the lexicon, so no
taxon word was recognised, and the taxon silently defaulted to **Metazoa** — all animals — returning 8 organ
systems, 38 organs and 138 cell types. The reasoning behind the default was that the widest taxon removes no
structure by taxon constraint, which is true and beside the point: the fallback does not only relax the
constraints, it decides *what the organism is*. The word `bacterium` sat in `words_not_recognised` the whole
time with nothing connecting it to the animal being built.

No taxon recognised is now a refusal. The old behaviour is still available as `--assume-taxon Metazoa`,
because "a generic animal" is a real request — just not this one.

Two more from the same thread: **scientific names did not resolve at all** (the refusal advised using one
while the reader could not read one), and **the clade table ran from Metazoa downward**, so every bacterium,
archaeon, fungus and plant was unplaceable. Both fixed; the table is now 339 taxa.

## The theorem

At Re ≈ 10⁻⁵ a time-reversible stroke returns the body exactly where it started. In the Stokes limit the
displacement over a cycle depends on the *path* through configuration space, not the rate — so beating the
power stroke faster than the recovery stroke, which is what intuition suggests, changes nothing. This is the
strongest verdict anything here can return short of Lean, and no shape-only layer could reach it: there is
nothing wrong with the paddle as a structure.

Purcell EM 1977, *Life at low Reynolds number*, Am J Phys 45(1):3–11,
[10.1119/1.10903](https://doi.org/10.1119/1.10903).

## The ecology

GBIF holds 89 occurrence records for the clade; the Rhine-Main soil box was queried for its 10
most-recorded *Betaproteobacteria*; GloBI returned its interaction records. None of that contains a
population parameter, so the layer refuses to predict exclusion from it.

The outcome — *resident excludes invader* — comes from four numbers the designer declared with sources
saying they are estimates: invader K 10⁸ cells/g, resident guild K 10⁹, α(resident→invader) 0.9,
α(invader→resident) 0.3. Lotka–Volterra mutual invasibility: two species, no space, no environmental
variation, no evolution. **The answer is a property of those four numbers**, and the run says so twice.
