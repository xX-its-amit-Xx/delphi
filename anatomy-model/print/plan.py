"""Derive the kit part plan and the cell-token registry from the project's own data.

No geometry here. Writes plan.json for the Blender build scripts to consume.
"""
import json, io, os, sys, collections

ROOT = sys.argv[1]
OUT = sys.argv[2]
R = lambda *p: os.path.join(ROOT, *p)
L = lambda p: json.load(io.open(p, encoding="utf-8"))

man = L(R("dashboard/public/blueprint3d/model/winged-zebrafish-manifest.json"))
data = L(R("dashboard/public/blueprint3d/data.json"))
fin = L(R("genotype/fin-subtree.json"))

META = {o["object"]: o for o in man["objects"]}
HN = man["objects"][0]["hypothetical_note"]

SYS_SLUG = {
    "integumental system": "integumental",
    "entire sense organ system": "sense-organ",
    "musculoskeletal system": "musculoskeletal",
    "nervous system": "nervous",
    "respiratory system": "respiratory",
    "circulatory system": "circulatory",
    "digestive system": "digestive",
    "gas bladder (no organ-system node; foregut derivative)": "gas-bladder",
    "renal system": "renal",
    "reproductive system": "reproductive",
    "hematopoietic system": "hematopoietic",
}

# ------------------------------------------------------------------ part plan
# kind: organ | tissue | case | carrier | token | card
# ops:  solidify / inflate / merge are recorded per part by the builder
P = []


def add(**kw):
    kw.setdefault("merged_from", [])
    kw.setdefault("notes", [])
    P.append(kw)
    return kw


def m(name, field, default=None):
    return META.get(name, {}).get(field, default)


V = ["vertebra_%02d" % i for i in range(1, 33)]
PR_L = ["pectoral_fin_ray_L_%02d" % i for i in range(1, 13)]
PR_R = ["pectoral_fin_ray_R_%02d" % i for i in range(1, 13)]

# --- body case: the integumental system doubles as the case the kit lives in ---
for side in ("L", "R"):
    for half in ("fore", "aft"):
        add(file="integumental__skin-of-body__case-%s-%s" % (side, half),
            kind="case", system="integumental", organ="skin of body",
            part="case %s %s" % (side, half),
            sources=["skin_" + side], level="organ",
            ontology_id="UBERON_0002097", ontology_label="skin of body",
            side=side, split=half, parent=None,
            op="solidify_shell", wall=1.6,
            notes=["the integumental system is the outer boundary of the animal, so it "
                   "is also the case the rest of the kit seats inside",
                   "split at mid-length so each half fits a 200 mm plate"])

# --- musculoskeletal: 4 carriers ---
add(file="musculoskeletal__axial__carrier-fore", kind="carrier",
    system="musculoskeletal", organ="axial skeleton", part="carrier fore",
    sources=[], level="organ system", ontology_id="UBERON_0002416",
    ontology_label="musculoskeletal system", side="mid",
    parent="integumental__skin-of-body__case-L-fore", holds=[
        "musculoskeletal__vertebral-column__segment-1",
        "musculoskeletal__vertebral-column__segment-2",
        "musculoskeletal__skull__half-L", "musculoskeletal__skull__half-R",
        "musculoskeletal__rib-cage__ribs-L", "musculoskeletal__rib-cage__ribs-R",
        "integumental__skin-of-body__cell-register-card"])
add(file="musculoskeletal__axial__carrier-aft", kind="carrier",
    system="musculoskeletal", organ="axial skeleton", part="carrier aft",
    sources=[], level="organ system", ontology_id="UBERON_0002416",
    ontology_label="musculoskeletal system", side="mid",
    parent="integumental__skin-of-body__case-L-aft", holds=[
        "musculoskeletal__vertebral-column__segment-3",
        "musculoskeletal__vertebral-column__segment-4",
        "musculoskeletal__dorsal-fin__fin", "musculoskeletal__anal-fin__fin",
        "musculoskeletal__caudal-fin__fin"])
for side in ("L", "R"):
    holds = ["musculoskeletal__pectoral-girdle__girdle-%s" % side,
             "musculoskeletal__pectoral-fin__membrane-%s" % side,
             "musculoskeletal__pectoral-fin__ray-carrier-%s" % side,
             "musculoskeletal__pelvic-fin__fin-%s" % side,
             "musculoskeletal__pectoral-muscle__muscle-%s" % side,
             "musculoskeletal__myotome__muscle-%s" % side]
    if side == "L":
        holds += ["musculoskeletal__pectoral-fin__cell-register-card",
                  "musculoskeletal__cleithrum__cell-register-card"]
    add(file="musculoskeletal__appendicular__carrier-%s" % side, kind="carrier",
        system="musculoskeletal", organ="appendicular skeleton",
        part="carrier %s" % side, sources=[], level="organ system",
        ontology_id="UBERON_0002416", ontology_label="musculoskeletal system",
        side=side, parent="integumental__skin-of-body__case-%s-fore" % side,
        holds=holds)

# --- musculoskeletal organ-level pieces ---
for side in ("L", "R"):
    add(file="musculoskeletal__pectoral-girdle__girdle-%s" % side, kind="organ",
        system="musculoskeletal", organ="pectoral girdle", part="girdle %s" % side,
        sources=["cleithrum_%s" % side, "scapula_%s" % side, "coracoid_%s" % side],
        level="organ", ontology_id="UBERON_0007830", ontology_label="pectoral girdle "
        "skeleton (the three bones are merged into one piece)", side=side,
        parent="musculoskeletal__appendicular__carrier-%s" % side,
        op="merge", merged_from=[
            {"object": "cleithrum_%s" % side, "ontology_id": "UBERON_0004741",
             "longest_dim_mm_at_kit_scale": 41.1},
            {"object": "scapula_%s" % side, "ontology_id": "UBERON_0006849",
             "longest_dim_mm_at_kit_scale": 2.6},
            {"object": "coracoid_%s" % side, "ontology_id": "UBERON_0004743",
             "longest_dim_mm_at_kit_scale": 5.7}],
        notes=["MERGED, and this is a real loss of separability: scapula (2.6 mm) and "
               "coracoid (5.7 mm) at kit scale are below the 6 mm minimum part size and "
               "would be unprintable and unhandleable alone. They are fused to the "
               "cleithrum, which is their true anatomical neighbour in the pectoral "
               "girdle. The three bones remain visually distinct on the piece.",
               "consequence: the kit cannot be used to teach the three girdle bones as "
               "separate elements"])
    add(file="musculoskeletal__pectoral-fin__membrane-%s" % side, kind="organ",
        system="musculoskeletal", organ="pectoral fin", part="membrane %s" % side,
        sources=["pectoral_fin_%s" % side], level="organ",
        ontology_id="UBERON_0000151", ontology_label="pectoral fin", side=side,
        parent="musculoskeletal__appendicular__carrier-%s" % side,
        op="solidify_shell", wall=1.2,
        notes=["the evidence-backed proportion of this design lives in this part: "
               "pectoral_area_over_SL2"])
    add(file="musculoskeletal__pectoral-fin__ray-carrier-%s" % side, kind="organ",
        system="musculoskeletal", organ="pectoral fin", part="ray carrier %s" % side,
        sources=PR_L if side == "L" else PR_R, level="organ",
        ontology_id="UBERON_4000175", ontology_label="fin ray", side=side,
        parent="musculoskeletal__appendicular__carrier-%s" % side,
        op="merge_and_inflate",
        notes=["MERGED: 12 individual fin rays onto one carrier. A single ray is a "
               "needle 2 mm thick at kit scale; printed loose it snaps and cannot be "
               "handled. The rays keep their individual shapes and spacing on the "
               "carrier, so the ray count and the fan geometry are still readable.",
               "consequence: the kit cannot be used to count or remove rays one by one"])
    add(file="musculoskeletal__pelvic-fin__fin-%s" % side, kind="organ",
        system="musculoskeletal", organ="pelvic fin", part="fin %s" % side,
        sources=["pelvic_fin_%s" % side, "pelvic_fin_rays_%s" % side], level="organ",
        ontology_id=None, ontology_label="pelvic fin (no ontology id in the source "
        "manifest)", side=side,
        parent="musculoskeletal__appendicular__carrier-%s" % side,
        op="merge_solidify_inflate",
        notes=["membrane and rays merged into one piece: separated, the 20 mm membrane "
               "and its rays are both too fragile at kit scale"])
    add(file="musculoskeletal__pectoral-muscle__muscle-%s" % side, kind="tissue",
        system="musculoskeletal", organ="pectoral muscle", part="muscle %s" % side,
        sources=["pectoral_muscle_%s" % side], level="tissue",
        ontology_id=None, ontology_label="pectoral muscle", side=side,
        parent="musculoskeletal__appendicular__carrier-%s" % side)
    add(file="musculoskeletal__myotome__muscle-%s" % side, kind="tissue",
        system="musculoskeletal", organ="myotome", part="muscle %s" % side,
        sources=["muscle_%s" % side], level="tissue",
        ontology_id=None, ontology_label="axial muscle / myotome", side=side,
        parent="musculoskeletal__appendicular__carrier-%s" % side)
    add(file="musculoskeletal__skull__half-%s" % side, kind="organ",
        system="musculoskeletal", organ="skull", part="half %s" % side,
        sources=["skull_%s" % side], level="organ", ontology_id=None,
        ontology_label="skull", side=side,
        parent="musculoskeletal__axial__carrier-fore", op="solidify_shell", wall=1.2,
        notes=["bilateral pair: the two halves mate on the midline"])
    add(file="musculoskeletal__rib-cage__ribs-%s" % side, kind="organ",
        system="musculoskeletal", organ="rib cage", part="ribs %s" % side,
        sources=["ribs_%s" % side], level="organ", ontology_id=None,
        ontology_label="ribs", side=side,
        parent="musculoskeletal__axial__carrier-fore", op="inflate",
        notes=["ribs are thin struts; inflated to the minimum wall, amount recorded"])

for i, lo in enumerate((1, 9, 17, 25), start=1):
    seg = V[lo - 1:lo + 7]
    add(file="musculoskeletal__vertebral-column__segment-%d" % i, kind="organ",
        system="musculoskeletal", organ="vertebral column",
        part="segment %d (vertebrae %d-%d)" % (i, lo, lo + 7),
        sources=seg, level="organ", ontology_id=None, ontology_label="vertebra",
        side="mid",
        parent="musculoskeletal__axial__carrier-%s" % ("fore" if i <= 2 else "aft"),
        op="merge",
        merged_from=[{"object": s, "ontology_id": None} for s in seg],
        notes=["MERGED: 8 vertebrae per segment. A single vertebra is 12-18 mm tall but "
               "only about 5 mm long at kit scale, with thin neural and haemal spines; "
               "32 loose vertebrae would be the bulk of the part count and most would "
               "snap. Four segments of eight keep the column's regional change in shape "
               "visible and still show every vertebra as a distinct form.",
               "consequence: individual vertebrae cannot be removed"])

for nm, obj, oid in (("dorsal-fin", ["dorsal_fin", "dorsal_fin_rays"], None),
                     ("anal-fin", ["anal_fin", "anal_fin_rays"], None),
                     ("caudal-fin", ["caudal_fin", "caudal_fin_rays"], None)):
    add(file="musculoskeletal__%s__fin" % nm, kind="organ",
        system="musculoskeletal", organ=nm.replace("-", " "), part="fin",
        sources=obj, level="organ", ontology_id=oid,
        ontology_label=nm.replace("-", " "), side="mid",
        parent="musculoskeletal__axial__carrier-aft",
        op="merge_solidify_inflate",
        notes=["membrane and rays merged: the median fins are a zero-thickness sheet "
               "plus needle rays, neither printable alone"])

# --- the other ten systems, one carrier each, organs 1:1 ---
OTHER = [
    ("sense-organ", "entire sense organ system", "UBERON_0004456",
     [("eye_L", "eye", "L"), ("eye_R", "eye", "R")]),
    ("nervous", "nervous system", "UBERON_0001016",
     [("brain", "brain", "mid"), ("spinal_cord", "spinal cord", "mid")]),
    ("respiratory", "respiratory system", "UBERON_0001004",
     [("gills_L", "gills", "L"), ("gills_R", "gills", "R")]),
    ("circulatory", "circulatory system", "UBERON_0001009",
     [("heart", "heart", "mid")]),
    ("digestive", "digestive system", "UBERON_0001007",
     [("oesophagus", "oesophagus", "mid"), ("intestine", "intestine", "mid"),
      ("liver", "liver", "mid")]),
    ("gas-bladder", "gas bladder", None, [("swim_bladder", "swim bladder", "mid")]),
    ("renal", "renal system", "UBERON_0001008",
     [("kidney", "kidney", "mid"), ("head_kidney", "head kidney", "mid")]),
    ("reproductive", "reproductive system", "UBERON_0000990",
     [("gonad_L", "gonad", "L"), ("gonad_R", "gonad", "R")]),
    ("hematopoietic", "hematopoietic system", "UBERON_0002390",
     [("spleen", "spleen", "mid")]),
]
for slug, syslabel, sysid, organs in OTHER:
    holds = []
    for obj, label, side in organs:
        f = "%s__%s__organ%s" % (slug, label.replace(" ", "-"),
                                 "-" + side if side in ("L", "R") else "")
        holds.append(f)
    add(file="%s__system__carrier" % slug, kind="carrier", system=slug,
        organ=syslabel, part="carrier", sources=[], level="organ system",
        ontology_id=sysid, ontology_label=syslabel, side="mid",
        parent="integumental__skin-of-body__case-L-fore", holds=holds)
    for obj, label, side in organs:
        f = "%s__%s__organ%s" % (slug, label.replace(" ", "-"),
                                 "-" + side if side in ("L", "R") else "")
        add(file=f, kind="organ", system=slug, organ=label, part="organ",
            sources=[obj], level=m(obj, "level", "organ"),
            ontology_id=m(obj, "ontology_id"),
            ontology_label=m(obj, "ontology_label", label), side=side,
            parent="%s__system__carrier" % slug, op="inflate_if_thin")

# ------------------------------------------------- cell tokens and registers
byid = {t["id"]: t for t in data["terms"]}
cells = {t["id"] for t in data["terms"] if t["level"] == "cell"}
kids = collections.defaultdict(list)
for e in data["edges"]:
    kids[e["whole"]].append(e["part"])

# which kit part does each UBERON organ belong to?
UB2PART = {
    "UBERON_0002097": ("integumental__skin-of-body__case-L-fore", "skin of body",
                       "musculoskeletal__axial__carrier-fore"),
    "UBERON_0000970": ("sense-organ__eye__organ-L", "eye",
                       "sense-organ__system__carrier"),
    "UBERON_0000955": ("nervous__brain__organ", "brain", "nervous__system__carrier"),
    "UBERON_0002240": ("nervous__spinal-cord__organ", "spinal cord",
                       "nervous__system__carrier"),
    "UBERON_0000948": ("circulatory__heart__organ", "heart",
                       "circulatory__system__carrier"),
    "UBERON_0001043": ("digestive__oesophagus__organ", "oesophagus",
                       "digestive__system__carrier"),
    "UBERON_0002107": ("digestive__liver__organ", "liver",
                       "digestive__system__carrier"),
    "UBERON_0002113": ("renal__kidney__organ", "kidney", "renal__system__carrier"),
    "UBERON_0000991": ("reproductive__gonad__organ-L", "gonad",
                       "reproductive__system__carrier"),
    "UBERON_0002106": ("hematopoietic__spleen__organ", "spleen",
                       "hematopoietic__system__carrier"),
}
CARD_SLUG = {
    "UBERON_0002097": "integumental__skin-of-body__cell-register-card",
    "UBERON_0000970": "sense-organ__eye__cell-register-card",
    "UBERON_0000955": "nervous__brain__cell-register-card",
    "UBERON_0002240": "nervous__spinal-cord__cell-register-card",
    "UBERON_0000948": "circulatory__heart__cell-register-card",
    "UBERON_0001043": "digestive__oesophagus__cell-register-card",
    "UBERON_0002107": "digestive__liver__cell-register-card",
    "UBERON_0002113": "renal__kidney__cell-register-card",
    "UBERON_0000991": "reproductive__gonad__cell-register-card",
    "UBERON_0002106": "hematopoietic__spleen__cell-register-card",
}

tokens = []
cards = []
tok_i = 0
for ub, cardfile in CARD_SLUG.items():
    organpart, organlabel, carrier = UB2PART[ub]
    cl = sorted(k for k in kids.get(ub, []) if k in cells)
    if not cl:
        continue
    rows = []
    for c in cl:
        tok_i += 1
        t = dict(file="cell-token__%s__%02d" % (organlabel.replace(" ", "-"), tok_i),
                 kind="token", index=tok_i,
                 cell_ontology_id=c.replace("_", ":"),
                 cell_label=byid[c]["label"],
                 organ=organlabel, organ_uberon=ub.replace("_", ":"),
                 organ_part=organpart, seats_into=cardfile,
                 source="dashboard/public/blueprint3d/data.json")
        tokens.append(t)
        rows.append(t)
    cards.append(dict(file=cardfile, kind="card", organ=organlabel,
                      organ_uberon=ub.replace("_", ":"), organ_part=organpart,
                      parent=carrier, rows=[dict(index=r["index"],
                      cl=r["cell_ontology_id"], label=r["cell_label"]) for r in rows],
                      source="dashboard/public/blueprint3d/data.json"))

# the 10 cell-in-structure nodes from the fin subtree; only those whose structure
# actually exists in this mesh get a token
FIN_MAP = {"UBERON:0000151": ("musculoskeletal__pectoral-fin__membrane-L", "pectoral fin",
                              "musculoskeletal__pectoral-fin__cell-register-card",
                              "musculoskeletal__appendicular__carrier-L"),
           "UBERON:0004741": ("musculoskeletal__pectoral-girdle__girdle-L", "cleithrum",
                              "musculoskeletal__cleithrum__cell-register-card",
                              "musculoskeletal__appendicular__carrier-L")}
CL_FOR = {"chondrocyte": "CL:0000138", "epidermal cell": "CL:0000362",
          "osteoblast": "CL:0000062", "myoblast": "CL:0000056",
          "chondroblast": "CL:0000058", "mesenchymal cell": "CL:0000134"}
fin_nodes = fin["layers"]["cell"]["nodes"]
not_in_mesh = []
grouped = collections.defaultdict(list)
for n in fin_nodes:
    ubs = [x["uberon"] for x in n.get("uberon_xref", [])]
    hit = next((u for u in ubs if u in FIN_MAP), None)
    if hit is None:
        not_in_mesh.append(dict(term=n["term"], label=n["label"], uberon=ubs,
                                why="the structure this cell sits in is not present in "
                                    "this mesh (developmental or sub-fin structure)"))
        continue
    grouped[hit].append(n)
for ub, nodes in grouped.items():
    organpart, organlabel, cardfile, carrier = FIN_MAP[ub]
    rows = []
    for n in nodes:
        tok_i += 1
        celltype = n["label"].split("/")[-1].strip()
        t = dict(file="cell-token__%s__%02d" % (organlabel.replace(" ", "-"), tok_i),
                 kind="token", index=tok_i,
                 cell_ontology_id=CL_FOR.get(celltype, "no CL id in source"),
                 cell_label=celltype, zfa_term=n["term"],
                 organ=organlabel, organ_uberon=ub, organ_part=organpart,
                 seats_into=cardfile, source="genotype/fin-subtree.json",
                 direct_expressed_in_genes=n.get("direct_expressed_in_genes"))
        tokens.append(t); rows.append(t)
    cards.append(dict(file=cardfile, kind="card", organ=organlabel, organ_uberon=ub,
                      organ_part=organpart, parent=carrier,
                      rows=[dict(index=r["index"], cl=r["cell_ontology_id"],
                                 label=r["cell_label"]) for r in rows],
                      source="genotype/fin-subtree.json"))

# organs in the kit with NO recorded cell type
have = {c["organ_part"] for c in cards}
no_cells = []
for p in P:
    if p["kind"] in ("organ", "tissue") and p["file"] not in have:
        no_cells.append(dict(part=p["file"], organ=p["organ"],
                             ontology_id=p.get("ontology_id"),
                             why="no cell type is recorded under this structure in "
                                 "data.json or fin-subtree.json, so the kit has no token "
                                 "for it. That is an absence of record, not evidence that "
                                 "the structure has no cell types."))

plan = dict(hypothetical_note=HN, parts=P, tokens=tokens, cards=cards,
            organs_without_cell_tokens=no_cells,
            fin_cell_nodes_not_in_mesh=not_in_mesh,
            counts=dict(structural=len(P), tokens=len(tokens), cards=len(cards),
                        total=len(P) + len(tokens) + len(cards)))
json.dump(plan, io.open(OUT, "w", encoding="utf-8"), indent=1)
print("PLAN", json.dumps(plan["counts"]))
print("by kind", json.dumps(dict(collections.Counter(p["kind"] for p in P))))
print("tokens", len(tokens), "cards", len(cards), "no-cell organs", len(no_cells),
      "fin nodes not in mesh", len(not_in_mesh))
