#!/usr/bin/env python3
"""Fetch every number the flight figures use, straight from the public APIs, and cache it
with the endpoint URL and the retrieval time beside it.

Nothing here is typed in from memory. If an endpoint refuses, the cache records the refusal
and the figure drops that row rather than guessing it.

    python dashboard/figures/fetch_sources.py            # all steps
    python dashboard/figures/fetch_sources.py uniprot    # one step
Writes dashboard/figures/cache/*.json
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
CACHE = HERE / "cache"
CACHE.mkdir(parents=True, exist_ok=True)
UA = {"user-agent": "delphisci-figures (ScienceClaw DELPHI; contact via repo)"}


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def get(url: str, tries: int = 4) -> dict:
    """Return {url, retrieved, ok, body|error}. Never raises; a refusal is data."""
    last = None
    for a in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                raw = r.read().decode("utf8", "replace")
            return {"url": url, "retrieved": now(), "ok": True, "http": 200,
                    "body": json.loads(raw)}
        except urllib.error.HTTPError as e:
            last = {"url": url, "retrieved": now(), "ok": False, "http": e.code,
                    "error": "HTTP %d %s" % (e.code, e.reason)}
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(2.0 * (a + 1))
                continue
            return last
        except Exception as e:  # noqa: BLE001 - network/JSON, all recorded the same way
            last = {"url": url, "retrieved": now(), "ok": False, "http": None,
                    "error": "%s: %s" % (type(e).__name__, e)}
            time.sleep(1.5 * (a + 1))
    return last


# ------------------------------------------------------------------ the taxa the figures use
# The locomotion label is a literature-level category, not something an API returns; the
# figures say so. Everything else about these taxa below is fetched.
TAXA = [
    # key,            ncbi_taxid, display,                        locomotion, pbdb_name
    ("diptera",            7147, "Diptera (flies)",               "powered",  "Diptera"),
    ("arachnida",          6854, "Arachnida (spiders, mites)",    "none",     "Arachnida"),
    ("exocoetidae",       76072, "Exocoetidae (flying fishes)",   "gliding",  "Exocoetidae"),
    ("belonidae",         94935, "Belonidae (needlefishes)",      "none",     "Belonidae"),
    ("aves",               8782, "Aves (birds)",                  "powered",  "Aves"),
    ("crocodylia",      1294634, "Crocodylia (crocodilians)",     "none",     "Crocodylia"),
    ("chiroptera",         9397, "Chiroptera (bats)",             "powered",  "Chiroptera"),
    ("felidae",            9681, "Felidae (cats)",                "none",     "Felidae"),
    ("pteromyini",       337748, "Pteromyini (flying squirrels)", "gliding",  "Pteromyini"),
    # Sciurini, not Sciuridae: NCBI nests Pteromyini inside Sciuridae, so the family cannot sit
    # beside it as a tip. Sciurini (tree squirrels) is its sister tribe within Sciurinae.
    ("sciurini",         337752, "Sciurini (tree squirrels)",     "none",     "Sciurini"),
    ("cynocephalidae",    30657, "Cynocephalidae (colugos)",      "gliding",  "Cynocephalidae"),
    ("hominidae",          9604, "Hominidae (great apes)",        "none",     "Hominidae"),
]

# the small curated gene set: vertebrate paired-appendage / axial programme vs insect wing genes
GENES = [
    ("TBX5",   "vertebrate paired appendage"),
    ("SHH",    "vertebrate paired appendage"),
    ("FGF10",  "vertebrate paired appendage"),
    ("HOXD13", "vertebrate paired appendage"),
    ("PAX1",   "vertebrate axial / vertebrae"),
    ("vg",     "insect wing (vestigial)"),
    ("ap",     "insect wing (apterous)"),
    ("nub",    "insect wing (nubbin)"),
]

# UniProt needs species-level organisms, not the clades above: a clade-wide query returns
# whichever member happens to be annotated. These are the species the matrix is built on,
# and the clade each one stands for is stated on the figure.
SPECIES = [
    ("drosophila",  7227,   "Drosophila melanogaster",    "Diptera (flies)"),
    ("danio",       7955,   "Danio rerio",                "ray-finned fish (teleost)"),
    ("oryzias",     8090,   "Oryzias latipes",            "Beloniformes (medaka)"),
    ("gallus",      9031,   "Gallus gallus",              "Aves (birds)"),
    ("myotis",      59463,  "Myotis lucifugus",           "Chiroptera (bats)"),
    ("ictidomys",   43179,  "Ictidomys tridecemlineatus", "Sciuridae (squirrels)"),
    ("galeopterus", 482537, "Galeopterus variegatus",     "Cynocephalidae (colugos)"),
    ("human",       9606,   "Homo sapiens",               "Hominidae (great apes)"),
]


def dump(name: str, obj) -> None:
    (CACHE / name).write_text(json.dumps(obj, indent=1), encoding="utf8")
    print("  wrote cache/" + name)


def step_taxonomy() -> None:
    """NCBI Taxonomy: lineage (the topology the cladogram is drawn from) and rank."""
    out = {}
    for key, taxid, *_ in TAXA:
        r = get("https://api.ncbi.nlm.nih.gov/datasets/v2/taxonomy/taxon/%d" % taxid)
        node = None
        if r.get("ok"):
            nodes = r["body"].get("taxonomy_nodes") or []
            node = (nodes[0].get("taxonomy") if nodes else None)
        out[key] = {"taxid": taxid,
                    "source": {k: r[k] for k in ("url", "retrieved", "ok", "http")},
                    "error": r.get("error"),
                    "organism_name": (node or {}).get("organism_name"),
                    "common_name": (node or {}).get("common_name"),
                    "rank": (node or {}).get("rank"),
                    "lineage": (node or {}).get("lineage"),
                    "counts": (node or {}).get("counts")}
        print("  tax %-15s %-28s rank=%-8s lineage=%d" % (
            key, out[key]["organism_name"], out[key]["rank"], len(out[key]["lineage"] or [])))
        time.sleep(0.45)
    dump("ncbi_taxonomy.json", out)


def step_lineage_names() -> None:
    """Names for the internal nodes of the cladogram: every taxid appearing in a lineage."""
    tx = json.loads((CACHE / "ncbi_taxonomy.json").read_text(encoding="utf8"))
    ids = sorted({i for v in tx.values() for i in (v.get("lineage") or [])})
    out = {}
    B = 40
    for i in range(0, len(ids), B):
        chunk = ids[i:i + B]
        r = get("https://api.ncbi.nlm.nih.gov/datasets/v2/taxonomy/taxon/"
                + ",".join(str(c) for c in chunk))
        if r.get("ok"):
            for n in r["body"].get("taxonomy_nodes") or []:
                t = n.get("taxonomy") or {}
                if t.get("tax_id"):
                    out[str(t["tax_id"])] = {"name": t.get("organism_name"),
                                             "rank": t.get("rank")}
        else:
            print("  lineage names chunk %d: %s" % (i, r.get("error")))
        time.sleep(0.45)
    resolved = len(out)
    out["_source"] = {"endpoint": "https://api.ncbi.nlm.nih.gov/datasets/v2/taxonomy/taxon/<ids>",
                      "retrieved": now(), "resolved": resolved, "requested": len(ids),
                      "unresolved": [i for i in ids if str(i) not in out]}
    dump("ncbi_lineage_names.json", out)
    print("  resolved %d/%d internal node names" % (resolved, len(ids)))


def step_genomes() -> None:
    """NCBI Datasets genome: assemblies under each taxon, and the reference-genome subset."""
    out = {}
    for key, taxid, disp, *_ in TAXA:
        base = ("https://api.ncbi.nlm.nih.gov/datasets/v2/genome/taxon/%d"
                "/dataset_report?page_size=1" % taxid)
        rec = {"taxid": taxid, "display": disp}
        a = get(base)
        rec["assemblies"] = {"url": a["url"], "retrieved": a["retrieved"], "ok": a.get("ok"),
                             "total_count": (a.get("body") or {}).get("total_count"),
                             "error": a.get("error")}
        first = ((a.get("body") or {}).get("reports") or [None])[0]
        if first:
            rec["example_assembly"] = {
                "accession": first.get("accession"),
                "organism": (first.get("organism") or {}).get("organism_name"),
                "level": (first.get("assembly_info") or {}).get("assembly_level"),
                "release_date": (first.get("assembly_info") or {}).get("release_date"),
                "scaffold_n50": (first.get("assembly_stats") or {}).get("scaffold_n50"),
                "total_sequence_length":
                    (first.get("assembly_stats") or {}).get("total_sequence_length"),
            }
        time.sleep(0.45)
        b = get(base + "&filters.reference_only=true")
        rec["reference_genomes"] = {"url": b["url"], "retrieved": b["retrieved"],
                                    "ok": b.get("ok"),
                                    "total_count": (b.get("body") or {}).get("total_count"),
                                    "error": b.get("error")}
        time.sleep(0.45)
        out[key] = rec
        print("  genomes %-15s %6s assemblies, %5s reference" % (
            key, rec["assemblies"]["total_count"], rec["reference_genomes"]["total_count"]))
    dump("ncbi_genomes.json", out)


def step_pbdb() -> None:
    """Paleobiology Database: first/last appearance and occurrence count per taxon."""
    out = {}
    for key, _taxid, _disp, _loco, pbdb in TAXA:
        r = get("https://paleobiodb.org/data1.2/taxa/single.json?name=%s&show=app" % pbdb)
        rec = {"pbdb_name": pbdb,
               "source": {k: r[k] for k in ("url", "retrieved", "ok", "http")},
               "error": r.get("error")}
        if r.get("ok"):
            recs = (r["body"] or {}).get("records") or []
            rec["warnings"] = (r["body"] or {}).get("warnings")
            if recs:
                d = recs[0]
                rec.update({"pbdb_taxon_no": d.get("oid"), "accepted_name": d.get("nam"),
                            "pbdb_rank": d.get("rnk"),
                            "firstapp_max_ma": d.get("fea"), "firstapp_min_ma": d.get("fla"),
                            "lastapp_max_ma": d.get("lea"), "lastapp_min_ma": d.get("lla"),
                            "n_occs": d.get("noc")})
            else:
                rec["note"] = "no PBDB record returned for this name"
        out[key] = rec
        print("  pbdb %-15s first %s-%s Ma, %s occurrences %s" % (
            key, rec.get("firstapp_max_ma"), rec.get("firstapp_min_ma"), rec.get("n_occs"),
            rec.get("error") or rec.get("note") or ""))
        time.sleep(0.8)
    dump("pbdb_appearances.json", out)


def step_pbdb_oldest() -> None:
    """Sanity check on every PBDB first appearance: the individual occurrences behind it.

    taxa/single reports a first appearance but not which record sets it. Here we pull every
    occurrence overlapping a 60-Myr window that starts at that first appearance, sort by
    early age ourselves (the API's order=max_ma.desc is rejected, HTTP 400), and keep the
    oldest few, so a lone outlier record shows up as a gap to the next one.
    """
    app = json.loads((CACHE / "pbdb_appearances.json").read_text(encoding="utf8"))
    out = {"_meta": {"endpoint": "https://paleobiodb.org/data1.2/occs/list.json"
                                 "?base_name=<taxon>&max_ma=<fea+1>&min_ma=<fea-60>"
                                 "&timerule=overlap&show=ref",
                     "note": "order=max_ma.desc returned HTTP 400 'Bad value for parameter "
                             "order (was max_ma)', so records are sorted client-side by eag",
                     "retrieved": now()},
           "taxa": {}}
    for key, _taxid, _disp, _loco, pbdb in TAXA:
        fea = app.get(key, {}).get("firstapp_max_ma")
        rec = {"pbdb_name": pbdb, "taxa_single_firstapp_max_ma": fea}
        if fea is None:
            rec["note"] = "no first appearance to check"
            out["taxa"][key] = rec
            continue
        hi, lo = float(fea) + 1.0, max(0.0, float(fea) - 60.0)
        url = ("https://paleobiodb.org/data1.2/occs/list.json?base_name=%s&max_ma=%g"
               "&min_ma=%g&timerule=overlap&show=ref" % (pbdb, hi, lo))
        r = get(url)
        rec["source"] = {k: r[k] for k in ("url", "retrieved", "ok", "http")}
        rec["error"] = r.get("error")
        if r.get("ok"):
            occ = (r["body"] or {}).get("records") or []
            occ.sort(key=lambda x: (-float(x.get("eag") or 0), -float(x.get("lag") or 0)))
            rec["n_in_window"] = len(occ)
            rec["oldest"] = [{"oid": x.get("oid"), "identified_name": x.get("idn"),
                              "accepted_name": x.get("tna"), "interval": x.get("oei"),
                              "eag": x.get("eag"), "lag": x.get("lag"),
                              "reference_id": x.get("rid"), "reference": x.get("ref")}
                             for x in occ[:6]]
            if occ:
                top = float(occ[0]["eag"])
                n_at_top = sum(1 for x in occ if float(x["eag"]) == top)
                nxt = next((x for x in occ if float(x["eag"]) < top), None)
                rec["n_records_at_oldest_age"] = n_at_top
                rec["refs_at_oldest_age"] = sorted({x.get("rid") for x in occ
                                                    if float(x["eag"]) == top})
                rec["next_older_age_eag"] = float(nxt["eag"]) if nxt else None
                rec["gap_to_next_myr"] = round(top - float(nxt["eag"]), 2) if nxt else None
        out["taxa"][key] = rec
        print("  pbdb-oldest %-15s n=%-4s oldest %s (%s, %d rec / %s) next %s gap %s" % (
            key, rec.get("n_in_window"),
            (rec.get("oldest") or [{}])[0].get("eag"),
            (rec.get("oldest") or [{}])[0].get("identified_name"),
            rec.get("n_records_at_oldest_age") or 0,
            ",".join(rec.get("refs_at_oldest_age") or []),
            rec.get("next_older_age_eag"), rec.get("gap_to_next_myr")))
        time.sleep(0.8)

    # Diptera: the intervals between the Devonian record and the Triassic ones
    dip = {}
    for iv in ("Devonian", "Carboniferous", "Permian", "Triassic"):
        u = ("https://paleobiodb.org/data1.2/occs/list.json?base_name=Diptera&interval=%s"
             "&show=ref" % iv)
        r = get(u)
        recs = ((r.get("body") or {}).get("records") or []) if r.get("ok") else []
        dip[iv] = {"url": u, "retrieved": r["retrieved"], "ok": r.get("ok"),
                   "error": r.get("error"), "n_occurrences": len(recs) if r.get("ok") else None,
                   "oids": [x.get("oid") for x in recs][:10]}
        print("  diptera %-13s %s occurrences" % (iv, dip[iv]["n_occurrences"]))
        time.sleep(0.8)
    out["diptera_by_interval"] = dip

    # Names and references behind the suspect first appearances, as PBDB classifies them
    lookups = [
        ("Schizophora", "https://paleobiodb.org/data1.2/taxa/single.json?name=Schizophora&show=class,app"),
        ("ref:88595", "https://paleobiodb.org/data1.2/refs/single.json?id=88595"),
        ("Walteria", "https://paleobiodb.org/data1.2/taxa/list.json?name=Walteria&show=class,app,attr"),
        ("Mehliella", "https://paleobiodb.org/data1.2/taxa/list.json?name=Mehliella&show=class,app,attr"),
        ("Plesiarctomys", "https://paleobiodb.org/data1.2/taxa/list.json?name=Plesiarctomys&show=class,app,attr"),
        ("Galeopithecidae", "https://paleobiodb.org/data1.2/taxa/list.json?name=Galeopithecidae&show=class,app,attr"),
        ("Praeornis", "https://paleobiodb.org/data1.2/taxa/list.json?name=Praeornis&show=class,app,attr"),
        ("Cynocephalidae_occurrences", "https://paleobiodb.org/data1.2/occs/list.json?base_name=Cynocephalidae&show=loc,ref"),
    ]
    for name, u in lookups:
        r = get(u)
        out.setdefault("lookups", {})[name] = {
            "url": u, "retrieved": r["retrieved"], "ok": r.get("ok"), "error": r.get("error"),
            "records": ((r.get("body") or {}).get("records") if r.get("ok") else None)}
        time.sleep(0.8)

    # Individual occurrences the figure either corrects away from or corrects to. The ages
    # drawn come from these records, never typed in.
    occ_ids = ["occ:1656545", "occ:964190",              # Diptera: Devonian record, Triassic
               "occ:621595", "occ:1484801", "occ:1211201", "occ:699894",   # Crocodylia
               "occ:1349001", "occ:2064049",             # Sciurini
               "occ:227167",                              # Cynocephalidae
               "occ:1364420", "occ:1364422"]              # Exocoetidae (lean thread input)
    occs = {}
    for oid in occ_ids:
        u = ("https://paleobiodb.org/data1.2/occs/single.json?id=%s&show=ref,class,loc"
             % oid.split(":")[1])
        r = get(u)
        rec = (((r.get("body") or {}).get("records") or [None])[0]) if r.get("ok") else None
        occs[oid] = {"url": u, "retrieved": r["retrieved"], "ok": r.get("ok"),
                     "error": r.get("error"), "record": rec}
        time.sleep(0.6)
    out["occurrences"] = occs

    # What else is in the collections that hold the two suspect records
    colls = {}
    for oid in ("occ:1656545", "occ:621595"):
        cid = ((occs.get(oid) or {}).get("record") or {}).get("cid")
        if not cid:
            continue
        u = "https://paleobiodb.org/data1.2/occs/list.json?coll_id=%s&show=class" % cid.split(":")[1]
        r = get(u)
        recs = ((r.get("body") or {}).get("records") or []) if r.get("ok") else []
        phyla, classes = {}, {}
        for x in recs:
            phyla[x.get("phl")] = phyla.get(x.get("phl"), 0) + 1
            classes[x.get("cll")] = classes.get(x.get("cll"), 0) + 1
        colls[oid] = {"collection": cid, "url": u, "retrieved": r["retrieved"], "ok": r.get("ok"),
                      "error": r.get("error"), "n_occurrences": len(recs),
                      "phyla": phyla, "classes": classes}
        print("  collection of %s (%s): %d occurrences, phyla %s" % (oid, cid, len(recs), phyla))
        time.sleep(0.8)
    out["collections"] = colls
    dump("pbdb_oldest.json", out)


def step_uniprot() -> None:
    """UniProtKB: does a reviewed entry with this gene name exist for this organism?

    This is presence/absence of a UniProt entry, nothing more. It is NOT an orthology call.
    The query is restricted to reviewed (Swiss-Prot) entries and to the exact taxid, and
    results are then filtered to entries whose own organism taxid matches, so a hit means
    that species has a curated entry under that gene name.
    """
    out = {"_meta": {"endpoint": "https://rest.uniprot.org/uniprotkb/search",
                     "query_form": "gene:<GENE> AND organism_id:<taxid> AND reviewed:true",
                     "means": "presence of a reviewed UniProtKB entry whose gene name matches; "
                              "not an orthology assertion",
                     "retrieved": now()},
           "cells": {}}
    for gkey, gclass in GENES:
        for skey, taxid, sname, clade in SPECIES:
            q = "gene:%s+AND+organism_id:%d+AND+reviewed:true" % (gkey, taxid)
            url = ("https://rest.uniprot.org/uniprotkb/search?query=" + q
                   + "&format=json&size=5"
                   + "&fields=accession,id,gene_names,protein_name,organism_id,reviewed,"
                   + "xref_orthodb")
            r = get(url)
            cell = {"gene": gkey, "gene_class": gclass, "species_key": skey, "taxid": taxid,
                    "species": sname, "clade": clade,
                    "source": {k: r[k] for k in ("url", "retrieved", "ok", "http")},
                    "error": r.get("error")}
            if r.get("ok"):
                res = (r["body"] or {}).get("results") or []
                res = [e for e in res if (e.get("organism") or {}).get("taxonId") == taxid]
                cell["n_hits"] = len(res)
                cell["accessions"] = [e.get("primaryAccession") for e in res][:5]
                cell["entry_names"] = [e.get("uniProtkbId") for e in res][:5]
                cell["gene_names_returned"] = [
                    [(g.get("geneName") or {}).get("value")] +
                    [s.get("value") for s in (g.get("synonyms") or [])]
                    for e in res for g in (e.get("genes") or [])][:5]
                cell["protein_names"] = [
                    (((e.get("proteinDescription") or {}).get("recommendedName") or {})
                     .get("fullName") or {}).get("value") for e in res][:5]
                # OrthoDB cross-references carried by the entry itself: the orthogroup
                # assignment comes from OrthoDB, not from us.
                cell["orthodb_groups"] = sorted({
                    x.get("id") for e in res for x in (e.get("uniProtKBCrossReferences") or [])
                    if x.get("database") == "OrthoDB" and x.get("id")})
            out["cells"]["%s|%s" % (gkey, skey)] = cell
            print("  uniprot %-7s %-27s -> %s" % (
                gkey, sname,
                cell.get("n_hits") if cell.get("error") is None else "ERR " + str(cell["error"])))
            time.sleep(0.35)
    dump("uniprot_presence.json", out)


# The species the orthology matrix is built on. OrthoDB is keyed on annotated genomes, so the
# matrix can only hold species OrthoDB has one for; Exocoetidae is carried deliberately to show
# that it has none.
ODB_SPECIES = [
    ("drosophila",  7227,   "Drosophila melanogaster",    "Diptera - powered flight"),
    ("danio",       7955,   "Danio rerio",                "teleost - no flight"),
    ("oryzias",     8090,   "Oryzias latipes",            "Beloniformes - flying fish's order"),
    ("hirundichthys", 938393, "Hirundichthys speculiger", "Exocoetidae - gliding"),
    ("gallus",      9031,   "Gallus gallus",              "Aves - powered flight"),
    ("myotis",      59463,  "Myotis lucifugus",           "Chiroptera - powered flight"),
    ("glaucomys",   64683,  "Glaucomys volans",           "Pteromyini - gliding"),
    ("galeopterus", 482537, "Galeopterus variegatus",     "Cynocephalidae - gliding"),
    ("human",       9606,   "Homo sapiens",               "Hominidae - no flight"),
]

# Seed proteins: the curated UniProt entry for each gene in the organism where it is curated.
# Every accession below was returned by the uniprot step above, not recalled.
ODB_SEEDS = [
    ("TBX5",   "Q99593", 9606, "vertebrate paired appendage"),
    ("SHH",    "Q15465", 9606, "vertebrate paired appendage"),
    ("FGF10",  "O15520", 9606, "vertebrate paired appendage"),
    ("HOXD13", "P35453", 9606, "vertebrate paired appendage"),
    ("PAX1",   "P15863", 9606, "vertebrate axial / vertebrae"),
    ("vg",     "Q26366", 7227, "insect wing (vestigial)"),
    ("ap",     "P29673", 7227, "insect wing (apterous)"),
    ("nub",    "P31368", 7227, "insect wing (nubbin)"),
]

ODB = "https://data.orthodb.org/current"


def step_orthodb() -> None:
    """OrthoDB: for each seed protein, the Metazoa-level orthogroup it belongs to, and how
    many genes each target species contributes to that group.

    The orthogroup assignment is OrthoDB's, not ours. A Metazoa-level OrthoDB group is a
    gene family, not a set of one-to-one orthologs; the figure says so.
    """
    out = {"_meta": {"endpoints": [ODB + "/search?query=<accession>&level=33208&species=33208",
                                   ODB + "/group?id=<og>",
                                   ODB + "/orthologs?id=<og>&species=<taxids>"],
                     "level": "Metazoa (NCBI taxid 33208)",
                     "means": "membership of an OrthoDB Metazoa-level orthogroup, which is a "
                              "gene family; not a one-to-one ortholog assertion",
                     "retrieved": now(),
                     "species": [{"key": k, "taxid": t, "name": n, "role": r}
                                 for k, t, n, r in ODB_SPECIES]},
           "genes": {}}

    sp_param = ",".join(str(t) for _k, t, _n, _r in ODB_SPECIES)
    for gene, acc, seed_taxid, gclass in ODB_SEEDS:
        rec = {"gene": gene, "seed_uniprot": acc, "seed_taxid": seed_taxid,
               "gene_class": gclass}
        s = get("%s/search?query=%s&level=33208&species=33208&limit=5" % (ODB, acc))
        rec["search"] = {"url": s["url"], "retrieved": s["retrieved"], "ok": s.get("ok"),
                         "error": s.get("error")}
        groups = ((s.get("body") or {}).get("data") or []) if s.get("ok") else []
        rec["groups_returned"] = groups
        if len(groups) != 1:
            rec["note"] = ("OrthoDB returned %d groups for this accession at Metazoa level; "
                           "a single unambiguous group is required, so this row is dropped"
                           % len(groups))
            out["genes"][gene] = rec
            print("  odb %-7s %s -> %d groups, DROPPED" % (gene, acc, len(groups)))
            time.sleep(0.6)
            continue
        og = groups[0]
        rec["orthogroup"] = og
        time.sleep(0.6)

        m = get("%s/group?id=%s" % (ODB, og))
        rec["group_meta"] = {"url": m["url"], "retrieved": m["retrieved"], "ok": m.get("ok"),
                             "error": m.get("error")}
        gd = (m.get("body") or {}).get("data") or {}
        rec["group_name"] = gd.get("name")
        # OrthoDB's free-text group name is sometimes a fragment ("10" for the FGF group), so
        # the InterPro domain OrthoDB counts most often in the group is carried too; the
        # figure labels rows with it and names OrthoDB as its source.
        ipr = sorted((gd.get("interpro_domains") or []),
                     key=lambda d: -(d.get("count") or 0))
        rec["top_interpro"] = ({"id": ipr[0].get("id"),
                                "description": ipr[0].get("description"),
                                "count": ipr[0].get("count")} if ipr else None)
        rec["group_level"] = gd.get("level_name")
        rec["group_gene_count"] = (gd.get("phyletic_profile") or {}).get("gene_count")
        rec["group_species_count"] = (gd.get("phyletic_profile") or {}).get("present_in") \
            or (gd.get("phyletic_profile") or {}).get("species_count")
        time.sleep(0.6)

        o = get("%s/orthologs?id=%s&species=%s" % (ODB, og, sp_param))
        rec["orthologs"] = {"url": o["url"], "retrieved": o["retrieved"], "ok": o.get("ok"),
                            "error": o.get("error")}
        per = {}
        if o.get("ok"):
            for blk in (o["body"] or {}).get("data") or []:
                org = blk.get("organism") or {}
                oid = str(org.get("id") or "")
                tx = oid.split("_")[0] if "_" in oid else oid
                genes = [((gg.get("gene_id") or {}).get("id"), gg.get("description"))
                         for gg in blk.get("genes") or []]
                e = per.setdefault(tx, {"name": org.get("name"), "orthodb_ids": [],
                                        "n_genes": 0, "examples": []})
                e["orthodb_ids"].append(oid)
                e["n_genes"] += len(genes)
                e["examples"] += [g[0] for g in genes if g[0]][:3]
            rec["n_species_blocks"] = len((o["body"] or {}).get("data") or [])
        rec["per_taxid"] = per
        row = []
        for k, t, n, _r in ODB_SPECIES:
            hit = per.get(str(t))
            row.append("%s=%s" % (k, hit["n_genes"] if hit else 0))
        out["genes"][gene] = rec
        print("  odb %-7s %-16s %-38s %s" % (gene, og, (rec["group_name"] or "")[:38],
                                             " ".join(row)))
        time.sleep(0.6)
    dump("orthodb_groups.json", out)


# Clades to ask OrthoDB about. The point of the probe is that an empty column in figure 3 can
# be stated as "OrthoDB has no annotated genome under this taxon" instead of guessed at.
ODB_CLADES = [
    ("belonoidei",    123731, "Belonoidei (flying fishes, needlefishes, halfbeaks)"),
    ("exocoetidae",    76072, "Exocoetidae (flying fishes)"),
    ("belonidae",      94935, "Belonidae (needlefishes)"),
    ("beloniformes",   76071, "Beloniformes (the flying fish's order)"),
    ("aves",            8782, "Aves (birds)"),
    ("chiroptera",      9397, "Chiroptera (bats)"),
    ("sciuridae",      55153, "Sciuridae (squirrels)"),
    ("pteromyini",    337748, "Pteromyini (flying squirrels)"),
    ("cynocephalidae", 30657, "Cynocephalidae (colugos)"),
    ("diptera",         7147, "Diptera (flies)"),
    ("hominidae",       9604, "Hominidae (great apes)"),
]


def step_orthodb_coverage() -> None:
    """How many species does OrthoDB have under each clade?

    Asked by querying every retained orthogroup restricted to that clade and taking the union
    of the species that come back. A clade that returns nothing from every group has no
    annotated genome in OrthoDB; one group alone could not settle that.
    """
    groups = json.loads((CACHE / "orthodb_groups.json").read_text(encoding="utf8"))
    ogs = [(g, r["orthogroup"]) for g, r in groups["genes"].items() if r.get("orthogroup")]
    out = {"_meta": {"endpoint": ODB + "/orthologs?id=<og>&species=<clade taxid>",
                     "orthogroups_probed": [o for _g, o in ogs],
                     "means": "union over all probed orthogroups of the OrthoDB species "
                              "returned under that clade taxid; zero everywhere means "
                              "OrthoDB has no annotated genome under the clade",
                     "retrieved": now()},
           "clades": {}}
    for key, taxid, label in ODB_CLADES:
        seen, calls, errs = {}, [], []
        for gene, og in ogs:
            r = get("%s/orthologs?id=%s&species=%d" % (ODB, og, taxid))
            calls.append({"gene": gene, "orthogroup": og, "url": r["url"],
                          "retrieved": r["retrieved"], "ok": r.get("ok")})
            if not r.get("ok"):
                errs.append({"gene": gene, "error": r.get("error")})
            else:
                for blk in (r["body"] or {}).get("data") or []:
                    org = blk.get("organism") or {}
                    seen[str(org.get("id"))] = org.get("name")
            time.sleep(0.45)
        out["clades"][key] = {"taxid": taxid, "label": label, "calls": calls, "errors": errs,
                              "n_orthodb_species": len(seen),
                              "orthodb_species": sorted(set(seen.values()))}
        print("  odb-cov %-15s %3d OrthoDB species  %s" % (
            key, len(seen),
            ", ".join(sorted(set(seen.values()))[:4]) + (" ..." if len(seen) > 4 else "")))
    dump("orthodb_coverage.json", out)


if __name__ == "__main__":
    import sys
    steps = {"taxonomy": step_taxonomy, "lineage": step_lineage_names,
             "genomes": step_genomes, "pbdb": step_pbdb, "pbdb_oldest": step_pbdb_oldest,
             "uniprot": step_uniprot,
             "orthodb": step_orthodb, "orthodb_coverage": step_orthodb_coverage}
    which = sys.argv[1:] or list(steps)
    for s in which:
        print("[" + s + "]")
        steps[s]()
