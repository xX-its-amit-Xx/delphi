# NOTES-FOR-HUB.md — things I did not change

Written by the thread that made the simulator driveable from the 3D viewer (parameter intake,
presets, provenance, embedding contract). **No equation, constant or pre-registered threshold was
touched, no pre-registered test was re-run and nothing was re-labelled.** These are the things I
believe are wrong, or at least unresolved, and left alone because changing them is not my call.

## 1. `pectoral_area_over_SL2` means two different things, and one of them is impossible

The parametric schema says the parameter is *"membrane area of **BOTH** pectoral fins / SL²"*
(`design-schema.json`), and `build.py`'s `parameter_vs_mesh_check` prints the same number under
the key `pectoral_area_both_m2`. But `SPEC-MISMATCHES.md` item 1 reads the same Park & Choi number
as **one** fin's area: *"AR = pectoral span² / PECTORAL area (0.261² / 0.006377 = 10.68)"*, and the
schema's `derived_never_set_directly` says `pectoral_aspect_ratio` is *"span² / (area of **ONE**
pectoral fin), the Park & Choi 2010 convention"*.

Both readings cannot hold:

* if 0.006377 m² is **one** fin, the two fins come to 0.012754 m², which is **larger than the whole
  lifting area** the physics thread uses for the same specimen (0.012688 m², pectoral + pelvic +
  caudal). A fish cannot have more pectoral membrane than total lifting surface;
* if 0.006377 m² is **both** fins, then the aspect ratios quoted everywhere (10.68 for the real
  fish, 17.9 for the TFF) are span²/both-fins-area, and the words *"the area of ONE pectoral fin,
  the Park & Choi 2010 convention"* in the schema and in SPEC-MISMATCHES item 1 are wrong.

The manifests compute `pectoral_aspect_ratio` as span² / `pectoral_area_both_m2`
(0.24104²/0.013336 = 4.357; 0.66441²/0.024653 = 17.906), i.e. the **both-fins** arithmetic, whatever
the prose says. The simulator now follows the manifests, so its numbers agree with the meshes. One
of the two texts still needs correcting, and it is load-bearing: SPEC-MISMATCHES item 1's headline
("the TFF's fins are more slender than any measured flying fish") depends on which convention the
3.0–16.9 range of Fish 1990 was measured in, and that is not recorded here.

## 2. The simulator charges the TFF a flight muscle that does not fit

`tff-manifest.json` gives `flight_muscle_fit_fraction = 0.2953`: at 16 % of 60 g only 29.5 % of the
required muscle fits inside the body at the pectoral girdle (SPEC-MISMATCHES item 4). The
simulator's power budget still uses the full `flight_muscle_fraction = 0.16`
(`P_avail = f_muscle · m · p_muscle − P_inertial`), so **every powered number for the TFF, including
the 179 m climb and the 91 m altitude-model run in RUNS.md, assumes muscle the animal cannot hold.**
Charging only what fits would cut the available power to roughly 30 % of its present value.

I did not change it: it is a pre-registered-adjacent design-study readout and the fix is a decision
about the spec, not a display bug. The preset now says this at the top of the page in the loudest
note it has, and the embedding contract passes the note on. **The design study should either take the
muscle that fits, or state in the spec that the animal is bigger than 60 g.**

## 3. The transfer I had to invent, and how to stop needing it

The parametric schema carries the **pectoral** area; the simulator's aerodynamic reference area is
the **total lifting** area. The only bridge in the repository is the one specimen's ratio
0.012688 / 0.006377 = 1.98965, so the intake uses it and labels it `assumed` wherever it is applied
(`sim/EMBED.md` §1). Applying a flying fish's pectoral-to-total ratio to a zebrafish is an assumed
transfer and is shown as one.

It can be retired: every built mesh already measures its own `lifting_area_m2`
(`derived_from_the_mesh`). If the viewer sends `derived.lifting_area_m2` with a design, the ratio is
not used at all. **Better still would be a `lifting_area_over_SL2` parameter in the schema itself**,
since the simulator wants exactly that and every other consumer derives it anyway.

## 4. Two different animals are both called "the winged zebrafish"

* `sim/params.json` entry `zebrafish-winged-hypothetical`: 3.0 cm SL, 0.51 g, the flying fish's fin
  proportions scaled isometrically. This is the configuration RUNS.md reports (six glides of 12 to
  17 m; v_min 6.1 m/s).
* `anatomy-model/parametric/resolved/winged-zebrafish.json`: 3.88 cm SL, 0.69 g, the fin moved only
  part of the way (`pectoral_len_over_SL` 0.35 against the flying fish's 0.687).

They are different hypotheses with the same name and different conclusions (v_min 6.1 vs 8.2 m/s).
The preset loads the parametric one, because that is what the viewer shows, and says in a note that
the numbers differ from params.json's. **One of them should be renamed.**

## 5. Dead code in the simulator

`phaseOf(d,z)` is never called (`phaseNow` is the function the integrator uses) and its first branch
is wrong anyway: `if(z+(-d.lobe)<0 && z<0) return z < -d.lobe ? 'swim' : 'taxi';` followed by a
branch that returns `'taxi'` whichever way its own test goes. It has no effect on any result. I left
it because deleting code in a file whose runs are logged by line-level provenance seemed worse than
noting it.

## 6. What a reader should not take from the comparison table

Unchanged from before, and now stated on the page for every run that is not the committed one: the
comparison rows are a comparison with second-hand field figures. They are a test only when the
parameters are the pre-registered ones, which the page and the `postMessage` contract both report as
`validation.mode`.
