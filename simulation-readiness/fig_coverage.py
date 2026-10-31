#!/usr/bin/env python
"""Figure: for each parameter a dynamical simulation needs, how many of the 4,571
genes in the vetted map have it in a fetched source.

Reads simulation-readiness/readiness.json. Writes simulation-readiness/coverage.svg.

Design: one axis (number of genes, 0 to 4,571). Two series from the validated
categorical palette, slots 1 and 2 (blue #2a78d6 / orange #eb6834, re-stepped for
dark: #3987e5 / #d95926; both modes pass the validator's five checks). Both series
are direct-labelled as well as in the legend, so identity is never colour alone.
The functional-annotation reference bar is a neutral annotation mark, not a series.
A count too small to draw is a baseline tick with its number beside it, never an
invisible bar. The regulatory network sits in its own stat block, because its
denominator is gene PAIRS: it is never drawn on the gene axis.
Every mark carries its source, query and retrieval date in a <title>.
No bird data: Aves is this project's frozen holdout.
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
d = json.load(open(os.path.join(HERE, "readiness.json"), encoding="utf-8"))
N = d["gene_set"]["n_genes"]
it = d["items"]
pax = it["a"]["what_exists_instead"]["paxdb_ppm"]
sab = it["e"]["sources_queried"]["SABIO-RK"]
cen = d["bionumbers"]["census"]
h = it["h"]
st = h["sources_queried"]
wp = st["STRING_v12_zebrafish"]["whole_zebrafish_proteome"]
EPMC = d["europe_pmc_literature_hits"]["queries"]

CW = 6.35          # approximate advance width of one char at 12.5px in a UI sans
CW_SM = 6.0


def esc(s):
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def com(n):
    return "{:,}".format(n)


# label, strict, substitute, substitute label, provenance tooltip, kind
ROWS = [
    ("Functional annotation (GO, Reactome, KEGG)",
     d["gene_set"]["with_any_pathway_annotation"], 0, None,
     "genotype/pathways.slim.json, built from the ZFIN GO association file, Reactome v98 (every "
     "zebrafish row inferred by orthology from human) and KEGG dre, retrieved 2026-10-31. This is "
     "the premise under test, not a simulation parameter: a pathway name is a categorical label.",
     "ref"),
    ("(a) absolute abundance, molecules per cell",
     0, pax["our_genes_with_a_ppm_value_in_any_fetched_dataset"], "have a PaxDb ppm value instead",
     "Strict: no fetched source gives any of these genes a count per cell or a calibrated "
     "concentration in a named cell type at a named stage. Substitute: PaxDb v6.1 Danio rerio, "
     "pax-db.org/downloads/latest/datasets/7955/ (%d datasets offered), retrieved 2026-10-31. Its "
     "unit is ppm, a share of total protein mass in a whole organism or a dissected organ. "
     "Expression Atlas holds %d zebrafish experiments, all in TPM or FPKM, which the checklist "
     "excludes." % (pax["n_zebrafish_datasets_offered"],
                    it["a"]["what_exists_instead"]["expression_atlas"]["zebrafish_experiments"]),
     "pair"),
    ("(b) protein half-life or degradation rate", 0, 0, None,
     "BioNumbers census (every zebrafish entry in the database, %d of them, all result pages "
     "followed): not one is a protein half-life. PaxDb offers no zebrafish turnover dataset among "
     "its %d. Europe PMC returns %s papers on the subject, so the measurement exists in prose and "
     "figures, not in a table a simulation could read."
     % (cen["rows_whose_organism_column_is_zebrafish"], pax["n_zebrafish_datasets_offered"],
        com(EPMC["protein_halflife"]["hit_count"])), "pair"),
    ("(c) mRNA half-life", 0, 0, None,
     "BioNumbers census: no zebrafish mRNA half-life. Europe PMC returns %s papers. No queried "
     "database holds it per gene." % com(EPMC["mrna_halflife"]["hit_count"]), "pair"),
    ("(d) transcription rate or promoter strength", 0, 0, None,
     "BioNumbers census: no zebrafish transcription rate or promoter strength. Europe PMC returns "
     "%s papers." % com(EPMC["transcription_rate"]["hit_count"]), "pair"),
    ("(e) Kd, or Km and kcat if an enzyme", 0, 0, None,
     "SABIO-RK holds %s kinetic-law entries over %s UniProt accessions. %d of those accessions are "
     "zebrafish (%s entries for Danio rerio in all), and not one of the five genes behind them "
     "(adh8a, adh8b, grk1a, grk7a, ido1) is in this map. BRENDA's only open programmatic endpoint, "
     "the DSMZ SPARQL prototype, has no Km, kcat, Ki or Kd class or predicate anywhere in its %s "
     "triples, and its website search for 'Danio rerio' returned no results. Queried 2026-10-31."
     % (com(sab["whole_database"]["kinlaw-entry"]),
        com(sab["distinct_uniprot_accessions_in_sabio_rk"]), sab["of_those_zebrafish_DANRE"],
        sab["danio_rerio_organism_row"]["entry_count"],
        com(it["e"]["sources_queried"]["BRENDA"]["triples"])), "pair"),
    ("(f) diffusion coefficient, if secreted", 4, 1, "more: a placeholder with no value",
     "Four secreted molecules have a fetched coefficient: Fgf8a, Lefty2, Squint and Cyclops "
     "(sim-engine/params/zebrafish-morphogens.json, fetched 2026-10-31), every one measured in the "
     "GASTRULA, two read in a primary source and the rest quoted second-hand. The fifth, Shh in the "
     "pectoral fin bud, which is what the first validation target needs, is an explicit placeholder "
     "with no value. Counted as molecules, not genes.", "pair"),
    ("(g) Hill coefficient or cooperativity", 0, 0, None,
     "SABIO-RK does carry 'Hill coefficient' among its %d parameter types, so the gap is zebrafish "
     "coverage, not schema. BioNumbers census: no zebrafish Hill coefficient. Europe PMC returns %s "
     "papers." % (it["g"]["sources_queried"]["SABIO-RK_parameter_types"]["n_parameter_types"],
                  com(EPMC["hill_coefficient"]["hit_count"])), "pair"),
]

LEGEND = [
    ("s1", "the quantity a simulation needs, as the checklist defines it"),
    ("s2", "the nearest substitute in a fetched source: wrong unit, wrong scale, or not measured"),
    ("ref", "functional annotation, shown for contrast (a label, not a quantity)"),
]

W = 1000
ML, MR, MT = 392, 196, 158
ROW_H = 34
PLOT_BOTTOM = MT + len(ROWS) * ROW_H
MB = 226
H = PLOT_BOTTOM + MB
XMAX = 4571.0
TICK_MIN = 34          # a bar narrower than this many genes is drawn as a tick


def X(v):
    return ML + (v / XMAX) * (W - ML - MR)


s = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" role="img" '
     'font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="12.5">' % (W, H)]
s.append('<title>Coverage of each simulation parameter across the 4,571 genes of the DELPHI '
         'genotype map</title>')
s.append('<desc>Horizontal bars. Functional annotation covers 3,857 of 4,571 genes. Items (a) to '
         '(g) of the simulation-parameter checklist cover 0, 0, 0, 0, 0, 4 and 0 genes '
         'respectively; 2,972 genes have a PaxDb ppm value as a substitute for item (a). The '
         'regulatory network is reported separately because its denominator is gene pairs.</desc>')
s.append("""<style>
 .viz{--s1:#2a78d6;--s2:#eb6834;--ref:#8a8a85;--ring:#fcfcfb}
 @media (prefers-color-scheme: dark){:root:where(:not([data-theme="light"])) .viz{
   --s1:#3987e5;--s2:#d95926;--ref:#9a9a95;--ring:#1a1a19}}
 :root[data-theme="dark"] .viz{--s1:#3987e5;--s2:#d95926;--ref:#9a9a95;--ring:#1a1a19}
 .viz text{fill:currentColor}
 .grid{stroke:currentColor;stroke-opacity:.12}
 .ax{stroke:currentColor;stroke-opacity:.35}
 .mut{opacity:.62}
 .s1{fill:var(--s1)}.s2{fill:var(--s2)}.ref{fill:var(--ref)}
 .tick1{stroke:var(--s1);stroke-width:3;stroke-linecap:round}
 .tick2{stroke:var(--s2);stroke-width:3;stroke-linecap:round}
</style>""")
s.append('<g class="viz">')

s.append('<text x="24" y="32" font-size="17" font-weight="700">Functional annotation is nearly '
         'complete. The quantities a simulation runs on are not there.</text>')
s.append('<text x="24" y="54" class="mut">For each of the %s genes in genotype/map.vetted.json, how '
         'many have the quantity in a source fetched on 2026-10-31. Hover any mark for the query.</text>'
         % com(N))
s.append('<text x="24" y="72" class="mut">Checklist items (a) to (g) are per gene. Item (h), the '
         'regulatory network, is below on its own scale: its denominator is gene pairs, not '
         'genes.</text>')
s.append('<text x="24" y="90" class="mut">Proxy species: zebrafish (Danio rerio). No flying-fish '
         'molecular data exists. No bird data: Aves is the frozen holdout.</text>')

ly = 112
for cls, lab in LEGEND:
    s.append('<rect x="24" y="%d" width="11" height="11" rx="2.5" class="%s"/>' % (ly - 9, cls))
    s.append('<text x="41" y="%d" class="mut">%s</text>' % (ly, esc(lab)))
    ly += 16

for v in (0, 1000, 2000, 3000, 4000, 4571):
    s.append('<line class="grid" x1="%.1f" y1="%d" x2="%.1f" y2="%d"/>'
             % (X(v), MT - 12, X(v), PLOT_BOTTOM + 6))
    s.append('<text x="%.1f" y="%d" text-anchor="middle" class="mut">%s</text>'
             % (X(v), PLOT_BOTTOM + 24, com(v)))
s.append('<line class="ax" x1="%.1f" y1="%d" x2="%.1f" y2="%d"/>'
         % (X(0), PLOT_BOTTOM + 6, X(XMAX), PLOT_BOTTOM + 6))
s.append('<text x="%.1f" y="%d" text-anchor="middle" class="mut">genes with the quantity '
         '(of %s)</text>' % ((ML + W - MR) / 2, PLOT_BOTTOM + 44, com(N)))

y = MT
BH = 13
for label, strict, sub, sublab, prov, kind in ROWS:
    tip = esc(prov)
    cy = y + BH / 2 + 4.5
    s.append('<text x="%d" y="%.1f" text-anchor="end">%s</text>' % (ML - 62, cy, esc(label)))
    # the primary count lives in its own column just left of the axis, so a zero is never
    # mistaken for the label on the substitute bar beside it
    s.append('<text x="%d" y="%.1f" text-anchor="end" font-weight="700">%s</text>'
             % (ML - 14, cy, com(strict)))
    cls = "ref" if kind == "ref" else "s1"
    tick_cls = "tick1"
    # primary mark
    if strict >= TICK_MIN:
        s.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%d" rx="4" class="%s">'
                 '<title>%s: %s of %s genes. %s</title></rect>'
                 % (X(0), y, X(strict) - X(0), BH, cls, esc(label), com(strict), com(N), tip))
        cursor = X(strict)
    else:
        s.append('<line class="%s" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f">'
                 '<title>%s: %s of %s genes%s. %s</title></line>'
                 % (tick_cls, X(0) + 1.5, y + 1, X(0) + 1.5, y + BH - 1, esc(label), com(strict),
                    com(N), " - too few to draw at this scale, shown as a tick" if strict else "",
                    tip))
        cursor = X(0) + 3
    # substitute mark, with a 2px surface gap from the primary fill
    if sub:
        if sub >= TICK_MIN:
            s.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%d" rx="4" class="s2" '
                     'stroke="var(--ring)" stroke-width="2">'
                     '<title>%s, substitute (%s): %s of %s genes. %s</title></rect>'
                     % (cursor + 2, y, X(sub) - X(0), BH, esc(label), esc(sublab or ""),
                        com(sub), com(N), tip))
            cursor = cursor + 2 + (X(sub) - X(0))
        else:
            s.append('<line class="tick2" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f">'
                     '<title>%s, substitute (%s): %s of %s genes - too few to draw at this scale. '
                     '%s</title></line>'
                     % (cursor + 4, y + 1, cursor + 4, y + BH - 1, esc(label), esc(sublab or ""),
                        com(sub), com(N), tip))
            cursor = cursor + 6
    # the substitute is labelled where it ends, in muted ink
    lx = cursor + 9
    if sub:
        txt = "%s %s" % (com(sub), sublab or "")
        s.append('<text x="%.1f" y="%.1f" class="mut">%s</text>' % (lx, cy, esc(txt)))
        lx += CW * len(txt)
    assert lx < W - 6, "row label overflows: %s -> %.0f" % (label, lx)
    y += ROW_H

# ------------------------------------------------- item (h), its own stat block
by = PLOT_BOTTOM + 66
s.append('<line class="grid" x1="24" y1="%d" x2="%d" y2="%d"/>' % (by, W - 24, by))
s.append('<text x="24" y="%d" font-weight="700">(h) the regulatory network, on its own scale: '
         '%s unordered pairs among the %s genes</text>'
         % (by + 20, com(h["possible_pairs"]["unordered_pairs"]), com(N)))

BLOCKS = [
    (com(h["any_experimental_support_edges"]),
     ["pairs with direct", "experimental support"],
     "0.0043% of all pairs",
     "STRING v12 zebrafish, experiments channel only (transferred evidence excluded), union with "
     "IntAct curated pairs between two of these genes (%d). Undirected and unsigned, with a "
     "confidence score rather than a strength. Across the WHOLE zebrafish proteome STRING holds "
     "only %s such edges, touching %d proteins, against %s edges whose experimental evidence is "
     "transferred from another species. Retrieved 2026-10-31."
     % (st["IntAct"]["distinct_pairs_both_of_which_are_our_genes"],
        com(wp["unordered_edges_with_direct_experimental_evidence"]),
        wp["zebrafish_proteins_touched_by_one"],
        com(wp["unordered_edges_whose_experimental_evidence_is_only_transferred_from_another_species"])),
     "s1"),
    (str(h["strict_count"]),
     ["signed, directed edges", "with an experiment"],
     "kcnh2a, lat4a, kcnk5b, calcineurin",
     "genotype/causal-chains.json cross_gene: epistasis and pathway-order statements, each with a "
     "verbatim quote from a fetched paper. None carries a rate constant.", "s1"),
    ("0",
     ["edges with a measured", "strength"],
     "in any fetched source",
     "No fetched source gives a strength, weight or rate constant for any edge between two of these "
     "genes.", "s1"),
    (com(st["CollecTRI_via_OmniPath"]["edges_transferable_to_our_genes_by_zfin_orthology"]),
     ["edges only by", "orthology transfer"],
     "human CollecTRI via ZFIN orthologs",
     "OmniPath serves taxa %s and refuses 7955, so CollecTRI's %s human signed TF-target edges can "
     "reach these genes only through ZFIN orthology, most of it protein BLAST. A hypothesis list, "
     "not zebrafish data, and one human edge can map to several zebrafish pairs. Retrieved "
     "2026-10-31."
     % (st["CollecTRI_via_OmniPath"]["organisms_omnipath_serves"],
        com(st["CollecTRI_via_OmniPath"]["human_signed_tf_target_edges"])), "s2"),
]
bw = (W - 48) / len(BLOCKS)
for i, (big, lines, sub, tip, cls) in enumerate(BLOCKS):
    bx = 24 + i * bw
    s.append('<g><title>%s</title>' % esc(tip))
    s.append('<rect x="%.1f" y="%d" width="4" height="62" rx="2" class="%s"/>' % (bx, by + 34, cls))
    s.append('<text x="%.1f" y="%d" font-size="25" font-weight="700">%s</text>'
             % (bx + 14, by + 58, esc(big)))
    ty = by + 76
    for ln in lines:
        s.append('<text x="%.1f" y="%d">%s</text>' % (bx + 14, ty, esc(ln)))
        assert bx + 14 + CW * len(ln) < bx + bw - 2, "stat label overflows: " + ln
        ty += 15
    s.append('<text x="%.1f" y="%d" class="mut">%s</text>' % (bx + 14, ty, esc(sub)))
    assert bx + 14 + CW_SM * len(sub) < bx + bw + 10, "stat sublabel overflows: " + sub
    s.append("</g>")

s.append('<text x="24" y="%d" class="mut">Headline: 0 of the %s numbers a minimal model needs are '
         'held - 4 per gene for (a) to (d), plus one strength per edge of the %d-edge list.</text>'
         % (H - 34, com(d["ratio"]["minimal_parameter_count"]), h["any_experimental_support_edges"]))
s.append('<text x="24" y="%d" class="mut">Relaxing item (a) to accept a PaxDb ppm value raises that '
         'to 2,972 of %s, or 15.9%%. Every query is logged in simulation-readiness/calls.json.</text>'
         % (H - 18, com(d["ratio"]["minimal_parameter_count"])))
s.append("</g></svg>")

svg = "\n".join(s)
open(os.path.join(HERE, "coverage.svg"), "w", encoding="utf-8").write(svg)
print("wrote coverage.svg  %d bytes  viewBox 0 0 %d %d" % (len(svg), W, H))
