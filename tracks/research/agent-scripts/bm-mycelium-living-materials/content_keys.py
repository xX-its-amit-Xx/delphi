"""Key claims: (src_key, claim, quote, source_url)."""
EP = "https://www.ebi.ac.uk/europepmc/webservices/rest/%s/fullTextXML"
KEY_CLAIMS = [
("NIE", "The only measured in-air humidity data for a mycelium layer of bilayer relevance is Nie et al. 2026: a T. versicolor film with two grown layers, E = 23.7 MPa, volumetric moisture expansion 9.27 % (layer A) vs 3.38 % (layer B) between 30 % and 85 % RH, 0.22-0.30 mm per layer. (It contains PVA and glycerol.)",
 "Bulk moisture expansion rate ( ε b ) was higher for layer A (9.27%) than layer B (3.38%)", EP % "PMC13558639"),
("WANG", "A micrometre-thin layer of dried microbial cells is the largest humidity-strain living layer with a fitted model: cell volume is linear in RH, 1 um of cells on 200 um latex bends at 15 % RH and flattens at 95 % RH, and the fitted cell-layer modulus is 70 MPa.",
 "The top layer is composed of E. coli cells (1 μm thick), and the bottom layer is a latex sheet (200 μm thick). It bends at 15% RH (A) and becomes flat at 95% RH (B).", EP % "PMC5438213"),
("HEMP", "Particulate mycelium composites are a poor swelling layer: water uptake 6-436 %, drying shrinkage 2.78-17 %, and swelling is almost all through-thickness (205-244 %) with in-plane change under about 7 % and poor wet integrity.",
 "In contrast, in-plane dimensional changes were limited, with width and length changes generally remaining below approximately 7%.", EP % "PMC13707017"),
("SHENPUB", "The Buehler-corpus myco-composite (Shen 2024) reaches 160 MPa modulus and 0.72 MPa tensile strength only on a coarse paste-printed substrate (2 mm layers) and the living phase weakens that substrate; no growth on a Formlabs resin has been published that I could find.",
 "We found that our method yields the strongest mycelium composite reported to date with a modulus of 160 MPa and tensile strength of 0.72 MPa", "https://europepmc.org/article/MED/38315077"),
]
