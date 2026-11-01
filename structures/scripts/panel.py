"""Species panel and protein panel definitions for the structures/ layer.

Taxon ids are NOT hard-coded from memory: resolve_taxa() looks every name up in the
UniProt taxonomy API and writes structures/taxa.json. Gene-symbol candidates per protein
are the zebrafish symbol from our causal chains plus the symbol used by other clades'
nomenclature; every hit is checked against a fetched UniProt record, never assumed.

BIRDS: class Aves is this project's frozen holdout. No bird taxon appears in this panel.
"""

# label -> (scientific name to resolve, flight/glide category, notes)
SPECIES = [
    # gliding / "flying" fish
    ("flying fish (Exocoetidae)",      "Exocoetidae",            "glider_fish",      "family-level probe; the convergent lat4a F326L lineage"),
    ("gliding halfbeak (Hemiramphidae)", "Hemiramphidae",        "glider_fish",      "family-level probe; Daane 2021's second enlarged-fin lineage"),
    ("medaka (Oryzias latipes)",       "Oryzias latipes",        "proxy_nonglider_fish", "PROXY for Exocoetidae: same order Beloniformes, has a reference proteome"),
    # non-gliding fish controls
    ("zebrafish (Danio rerio)",        "Danio rerio",            "control_fish",     "the species every intervention in genotype/ was done in"),
    ("needlefish (Belonidae)",         "Belonidae",              "control_fish",     "beloniform control, family-level probe"),
    # powered flight
    ("little brown bat (Myotis lucifugus)",  "Myotis lucifugus",  "powered_flight",  ""),
    ("greater mouse-eared bat (Myotis myotis)", "Myotis myotis",  "powered_flight",  ""),
    ("greater horseshoe bat (Rhinolophus ferrumequinum)", "Rhinolophus ferrumequinum", "powered_flight", ""),
    ("large flying fox (Pteropus vampyrus)", "Pteropus vampyrus", "powered_flight",  ""),
    ("black flying fox (Pteropus alecto)",   "Pteropus alecto",   "powered_flight",  ""),
    ("fruit fly (Drosophila melanogaster)",  "Drosophila melanogaster", "powered_flight_insect", "insect flight; orthology to vertebrate genes is distant or absent"),
    # gliding mammals
    ("sugar glider (Petaurus breviceps)",    "Petaurus breviceps", "glider_mammal",  ""),
    ("colugo (Galeopterus variegatus)",      "Galeopterus variegatus", "glider_mammal", ""),
    ("northern flying squirrel (Glaucomys sabrinus)", "Glaucomys sabrinus", "glider_mammal", ""),
    ("Siberian flying squirrel (Pteromys volans)",    "Pteromys volans",    "glider_mammal", ""),
    # non-gliding mammal controls
    ("mouse (Mus musculus)",           "Mus musculus",           "control_mammal",   ""),
    ("human (Homo sapiens)",           "Homo sapiens",           "control_mammal",   ""),
]

# protein key -> dict(zebrafish symbol, assembly state from our chains, symbol candidates)
PROTEINS = {
    "kcnk5b": dict(
        label="Kcnk5b / KCNK5 (K2P potassium channel)",
        assembly="domain-swapped DIMER (2 subunits, each with 2 pore domains)",
        symbols=["kcnk5b", "kcnk5", "KCNK5", "kcnk5a"],
        fly_symbols=["sand", "Ork1", "CG1688"],
        note="zebrafish alf alleles are dominant gain of function in this channel"),
    "kcnh2a": dict(
        label="Kcnh2a / KCNH2 (hERG-family channel)",
        assembly="TETRAMER (4 subunits)",
        symbols=["kcnh2a", "kcnh2", "KCNH2", "kcnh6a"],
        fly_symbols=["eag", "sei"],
        note="the longfin lof allele is cis-regulatory, not coding"),
    "gja1b": dict(
        label="Gja1b / Cx43 (gap-junction alpha-1)",
        assembly="HEXAMER (one connexon); a full channel is two connexons docked = 12 subunits",
        symbols=["gja1b", "gja1", "GJA1", "gja1a"],
        fly_symbols=["inx2", "ogre", "Inx2"],
        note="insects have innexins, not connexins; absence in Drosophila is real, not an annotation gap"),
    "slc43a2a": dict(
        label="Slc43a2a / Lat4a / SLC43A2 (L-type amino-acid transporter 4)",
        assembly="monomer or homodimer; not established in our sources",
        symbols=["slc43a2a", "slc43a2", "SLC43A2", "slc43a2b"],
        fly_symbols=["minidiscs", "JhI-21", "sobremesa"],
        note="carries the flying-fish convergent F326L and the zebrafish nr21 T200K"),
    "hhip": dict(
        label="Hhip / HHIP (Hedgehog-interacting protein)",
        assembly="monomer binding one Hedgehog ligand",
        symbols=["hhip", "HHIP"],
        fly_symbols=[],
        note="hhip loss is our only sourced route to a LARGER pectoral fin"),
    "shha": dict(
        label="Shha / SHH (Sonic hedgehog)",
        assembly="monomer; signalling N-terminal domain binds Hhip, Ptch1, Cdo/Boc",
        symbols=["shha", "shh", "SHH", "shhb"],
        fly_symbols=["hh"],
        note="the ligand Hhip sequesters"),
    "tbx5a": dict(
        label="Tbx5a / TBX5 (T-box transcription factor)",
        assembly="monomer on DNA; T-box DNA-binding domain",
        symbols=["tbx5a", "tbx5", "TBX5", "tbx5b"],
        fly_symbols=["Doc1", "org-1"],
        note="forelimb/pectoral fin identity"),
    "prdm1a": dict(
        label="Prdm1a / PRDM1 (PR/SET + zinc-finger transcription factor)",
        assembly="monomer on DNA; 5 zinc fingers",
        symbols=["prdm1a", "prdm1", "PRDM1", "prdm1b"],
        fly_symbols=["Hamlet", "ham"],
        note="m805 premature stop in the SET domain"),
}
