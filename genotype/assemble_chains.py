"""Assemble the subagents' results into genotype/causal-chains.json, genotype/interactions.json and CAUSAL.md.

Reads every C:/Temp/genotype/agents/chains_*.json and interactions_*.json written by the parallel subagents
(their rules are in genotype/AGENT_BRIEF.md), validates each record, and merges them. Validation is strict and
its result travels with the data: a step or interaction that cites no source, or whose source carries no
identifier, or whose grade is not one of the five allowed words, is kept but flagged, and the flags are counted
in the output. Nothing is invented here and nothing is upgraded: this script only merges, checks and counts.

Node ids are checked against the blueprint (organism-design/examples/a-flying-fish.json) and the fin subtree
(genotype/fin-subtree.json); an id in neither is reported under unknown_node_ids.

Offline. Usage: python -I genotype/assemble_chains.py
"""
import collections, glob, json, os, re, time

HERE = os.path.dirname(os.path.abspath(__file__))
AGENTS = "C:/Temp/genotype/agents"
GRADES = ["missing", "hypothesis", "association", "necessity", "sufficiency", "mechanism"]
RANK = {g: i for i, g in enumerate(GRADES)}

fin = json.load(open(os.path.join(HERE, "fin-subtree.json"), encoding="utf8"))
fin_nodes = {n["term"]: n for L in fin["layers"].values() for n in L["nodes"]}
bp = json.load(open(os.path.join(HERE, "..", "organism-design", "examples", "a-flying-fish.json"), encoding="utf8"))
bp_nodes = {n["iri"].split("/")[-1].replace("_", ":", 1): n["label"] for n in bp["nodes"]}
known = set(fin_nodes) | set(bp_nodes)
unknown_nodes = collections.Counter()
def check_node(nid):
    if not nid: return None
    if nid in fin_nodes or nid in bp_nodes: return nid
    unknown_nodes[nid] += 1
    return nid
def node_label(nid):
    if nid in fin_nodes: return fin_nodes[nid]["label"]
    return bp_nodes.get(nid)
def node_level(nid):
    if nid in fin_nodes: return fin_nodes[nid]["level"]
    return "blueprint:" + bp.get("nodes", [{}])[0].get("level", "") if False else ("blueprint" if nid in bp_nodes else None)

flags = collections.Counter()
def check_sources(obj, where):
    out = []
    for s in (obj.get("sources") or []):
        if not isinstance(s, dict): flags["source not an object"] += 1; continue
        if not (s.get("pmid") or s.get("doi")): flags["source with no PMID or DOI"] += 1; s["_flag"] = "no identifier"
        if not s.get("quote"): flags["source with no verbatim quote"] += 1; s["_flag"] = (s.get("_flag", "") + "; no quote").strip("; ")
        out.append(s)
    if not out: flags[f"{where}: no sources at all"] += 1
    return out
def check_grade(g, where):
    if g not in RANK: flags[f"{where}: grade not one of the five words ({g!r})"] += 1; return "unrecognised:" + str(g)
    return g

# ------------------------------------------------------------------ causal chains
chain_files = sorted(glob.glob(os.path.join(AGENTS, "chains_*.json")))
genes, cross, per_agent = [], [], {}
for path in chain_files:
    try: d = json.load(open(path, encoding="utf8"))
    except Exception as e: flags[f"{os.path.basename(path)}: unreadable ({type(e).__name__})"] += 1; continue
    agent = d.get("agent") or os.path.basename(path)
    gs = d.get("genes") or []
    for g in gs:
        g["agent"] = agent
        steps = g.get("chain") or []
        for st in steps:
            st["evidence_grade"] = check_grade(st.get("evidence_grade"), f'{agent}/{g.get("symbol")}/{st.get("step")}')
            st["sources"] = check_sources(st, f'{agent}/{g.get("symbol")}/{st.get("step")}')
            if st.get("to_node"): st["to_node"] = check_node(st["to_node"]); st["to_node_label"] = node_label(st["to_node"])
        grades = [st["evidence_grade"] for st in steps if st["evidence_grade"] in RANK]
        g["best_grade"] = max(grades, key=lambda x: RANK[x]) if grades else None
        g["weakest_grade"] = min(grades, key=lambda x: RANK[x]) if grades else None
        g["chain_complete"] = len(steps) >= 4 and all(st["evidence_grade"] not in ("missing",) for st in steps)
        # A chain is only as strong as its weakest link: chain_strength is the weakest grade on the whole chain.
        # best_grade is the strongest single link, which is NOT the chain's strength and must not be read as it.
        g["chain_strength"] = g["weakest_grade"]
        g["reaches_necessity_or_better"] = bool(grades) and RANK[g["best_grade"]] >= RANK["necessity"]
        g["chain_strength_necessity_or_better"] = bool(grades) and RANK[g["weakest_grade"]] >= RANK["necessity"]
        srcs = [s for st in steps for s in st["sources"]]
        g["n_sources"] = len({(s.get("pmid") or s.get("doi")) for s in srcs} - {None})
        g["n_full_text_sources"] = len({(s.get("pmid") or s.get("doi")) for s in srcs if s.get("read") != "abstract only"} - {None})
        g["n_abstract_only_sources"] = len({(s.get("pmid") or s.get("doi")) for s in srcs if s.get("read") == "abstract only"} - {None})
        for nid in (g.get("fin_subtree_nodes") or []): check_node(nid)
        genes.append(g)
    for c in (d.get("cross_gene") or []):
        c["agent"] = agent; c["sources"] = check_sources(c, f"{agent}/cross_gene"); c["evidence_grade"] = check_grade(c.get("evidence_grade"), f"{agent}/cross_gene")
        cross.append(c)
    per_agent[agent] = {"file": os.path.basename(path), "genes": len(gs), "summary": d.get("summary"), "fetch_log": d.get("fetch_log")}

# ------------------------------------------------------------------ interactions
inter_files = sorted(glob.glob(os.path.join(AGENTS, "interactions_*.json")))
interactions, refuted, gaps_i, per_agent_i = [], [], [], {}
for path in inter_files:
    try: d = json.load(open(path, encoding="utf8"))
    except Exception as e: flags[f"{os.path.basename(path)}: unreadable ({type(e).__name__})"] += 1; continue
    agent = d.get("agent") or os.path.basename(path)
    for it in (d.get("interactions") or []):
        it["agent"] = agent
        it["evidence_grade"] = check_grade(it.get("evidence_grade"), f'{agent}/{it.get("id")}')
        it["sources"] = check_sources(it, f'{agent}/{it.get("id")}')
        for side in ("sender_node", "receiver_node"):
            if it.get(side):
                it[side] = check_node(it[side]); it[side + "_label"] = it.get(side + "_label") or node_label(it[side]); it[side + "_level"] = node_level(it[side])
        interactions.append(it)
    refuted += [{**r, "agent": agent} for r in (d.get("refuted_or_unsupported") or [])]
    gaps_i += [{"agent": agent, "gap": g} for g in (d.get("gaps") or [])]
    per_agent_i[agent] = {"file": os.path.basename(path), "interactions": len(d.get("interactions") or []), "summary": d.get("summary"), "fetch_log": d.get("fetch_log"),
                          **({"connexin_and_fin_length": d["connexin_and_fin_length"]} if d.get("connexin_and_fin_length") else {})}

# ------------------------------------------------------------------ calls made by the agents
calls = {}
for p in sorted(glob.glob(os.path.join(HERE, "cache", "calls_agent_*.json"))):
    try: d = json.load(open(p, encoding="utf8"))
    except Exception: continue
    cs = d.get("calls") or []
    calls[os.path.basename(p)] = {"calls": len(cs), "non_200": sum(1 for c in cs if c.get("status") != 200), "hosts": sorted({re.sub(r"^https?://([^/]+).*", r"\1", c["url"]) for c in cs})}

by_grade = collections.Counter(st["evidence_grade"] for g in genes for st in (g.get("chain") or []))
cov = {"genes_with_a_chain": len(genes),
       "metric_note": ("chain_strength is the WEAKEST grade on a chain and is the honest measure of it: a chain is only as strong as its weakest link. "
                       "genes_with_a_link_graded_X counts genes with at least one such link anywhere on the chain, which is a much weaker statement."),
       "chain_strength_distribution": dict(collections.Counter(g.get("chain_strength") for g in genes)),
       "chains_whose_weakest_link_is_necessity_or_better": sum(1 for g in genes if g.get("chain_strength_necessity_or_better")),
       "genes_with_a_link_graded_necessity_or_better": sum(1 for g in genes if g.get("reaches_necessity_or_better")),
       "genes_with_a_link_graded_mechanism": sum(1 for g in genes if g.get("best_grade") == "mechanism"), "genes_with_a_complete_four_step_chain": sum(1 for g in genes if g.get("chain_complete")),
       "best_single_link_grade_distribution": dict(collections.Counter(g.get("best_grade") for g in genes)), "deepest_level_distribution": dict(collections.Counter(g.get("deepest_level") for g in genes)),
       "steps_by_grade": dict(by_grade), "distinct_publications": len({(s.get("pmid") or s.get("doi")) for g in genes for st in (g.get("chain") or []) for s in st["sources"]} - {None})}

NOTE = ("Every link was produced by a subagent working under genotype/AGENT_BRIEF.md: nothing from memory, every statement from a document fetched in that "
        "run through the logged fetcher, a verbatim quote per source, and an evidence grade of association (expression only), necessity (loss of function), "
        "sufficiency (gain of function), mechanism (a pathway step shown experimentally) or hypothesis (proposed, not shown). A grade is about the link it sits "
        "on, not the gene. All of it is zebrafish or other proxy-species work: no flying-fish experiment exists. This file was merged and checked by "
        "genotype/assemble_chains.py, which upgrades nothing; validation flags travel with the data.")
chains_out = {"title": "Causal chains from gene to phenotype for the fin genes, with a source and an evidence grade on every link",
              "built": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "tool": "genotype/assemble_chains.py", "vetted": True, "note": NOTE,
              "constraint": fin["constraint"], "grades": {g: d for g, d in zip(GRADES, ["no fetched source for this link", "proposed or modelled in a paper, not shown there",
                            "expression or correlation only", "loss of function changes the structure or process", "gain of function changes it", "a pathway step shown experimentally"])},
              "coverage": cov, "validation_flags": dict(flags), "unknown_node_ids": dict(unknown_nodes), "agents": per_agent, "agent_calls": calls,
              "genes": sorted(genes, key=lambda g: (-RANK.get(g.get("best_grade") or "missing", 0), str(g.get("symbol")))), "cross_gene": cross}
json.dump(chains_out, open(os.path.join(HERE, "causal-chains.json"), "w", encoding="utf8"), separators=(",", ":"))

inter_out = {"title": "Tissue-to-tissue and cell-to-cell interactions in the pectoral fin, as directed arrows on blueprint and fin-subtree nodes",
             "built": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "tool": "genotype/assemble_chains.py", "vetted": True, "note": NOTE,
             "coverage": {"interactions": len(interactions), "by_grade": dict(collections.Counter(i["evidence_grade"] for i in interactions)),
                          "by_kind": dict(collections.Counter(i.get("kind", "signalling") for i in interactions)),
                          "by_context": dict(collections.Counter(i.get("context") for i in interactions)),
                          "orthology_inferred": sum(1 for i in interactions if i.get("orthology_inferred")),
                          "distinct_sender_nodes": len({i.get("sender_node") for i in interactions}), "distinct_receiver_nodes": len({i.get("receiver_node") for i in interactions}),
                          "distinct_publications": len({(s.get("pmid") or s.get("doi")) for i in interactions for s in i["sources"]} - {None})},
             "validation_flags": dict(flags), "unknown_node_ids": dict(unknown_nodes), "agents": per_agent_i, "agent_calls": calls,
             "interactions": sorted(interactions, key=lambda i: (-RANK.get(i["evidence_grade"], 0), str(i.get("sender_node")))), "refuted_or_unsupported": refuted, "gaps": gaps_i}
json.dump(inter_out, open(os.path.join(HERE, "interactions.json"), "w", encoding="utf8"), separators=(",", ":"))

# ------------------------------------------------------------------ CAUSAL.md
def cite(s):
    bits = [s.get("first_author"), s.get("year"), s.get("journal")]
    who = " ".join(str(b) for b in bits if b)
    ident = ("PMID " + s["pmid"]) if s.get("pmid") else ("doi " + s["doi"]) if s.get("doi") else "no identifier"
    return f'{who} ({ident})' + (" [abstract only]" if s.get("read") == "abstract only" else "")
def steps_md(g):
    out = []
    for st in (g.get("chain") or []):
        srcs = "; ".join(cite(s) for s in st["sources"]) or "**no source**"
        node = f' at {st["to_node_label"]} (`{st["to_node"]}`)' if st.get("to_node") else ""
        out.append(f'   - `{st.get("evidence_grade")}` {st.get("from") or ""} -> {st.get("to") or st.get("phenotype") or ""}{node}. {st.get("experiment_type") or ""}, {st.get("organism") or ""}, stage {st.get("stage") or "not stated"}. {srcs}')
    return "\n".join(out)
# Ranked by chain strength (the weakest link), then by how much of it was read in full text rather than in an
# abstract, then by the number of distinct publications. The full-text count is the tiebreak because two chains
# can carry the same grades while one of them rests on sentences from abstracts of papers that could not be fetched.
ranked = sorted(genes, key=lambda g: (-RANK.get(g.get("chain_strength") or "missing", 0), -g.get("n_full_text_sources", 0), -g.get("n_sources", 0), str(g.get("symbol"))))
md = [f"# Causal chains from gene to phenotype in the pectoral fin\n",
      f"Built {chains_out['built']} by `genotype/assemble_chains.py` from {len(chain_files)} subagent result files.",
      f"Every link carries its own source, organism, experiment type and evidence grade; the grades are, weakest to strongest,",
      f"`hypothesis`, `association`, `necessity`, `sufficiency`, `mechanism`. A link with no fetched source is `missing` and is named as a gap.",
      f"\n**All of this is proxy-species work, almost all zebrafish. No causal experiment exists in a flying fish.** A flying fish's wing is an enlarged pectoral fin.\n",
      f"## Coverage\n",
      f"| | |\n|---|---|",
      f"| genes with a chain | {cov['genes_with_a_chain']} |",
      f"| chains whose **weakest** link is `necessity` or better | {cov['chains_whose_weakest_link_is_necessity_or_better']} |",
      f"| genes with at least one link graded `necessity` or better | {cov['genes_with_a_link_graded_necessity_or_better']} |",
      f"| genes with at least one link graded `mechanism` | {cov['genes_with_a_link_graded_mechanism']} |",
      f"| complete four-step chains | {cov['genes_with_a_complete_four_step_chain']} |",
      f"| distinct publications cited | {cov['distinct_publications']} |",
      f"| fetched calls by the subagents | {sum(c['calls'] for c in calls.values())} |\n"]
if ranked:
    g = ranked[0]
    tied = [x.get("symbol") for x in ranked[1:] if x.get("chain_strength") == g.get("chain_strength")]
    md += [f"## Strongest chain end to end: {g.get('symbol')}\n",
           (f"**Tied on grades with {', '.join(tied)}**; ranked first because {g.get('n_full_text_sources')} of its cited papers were read in full text against "
            f"{g.get('n_abstract_only_sources')} read as abstracts only. Grades alone do not separate them, and the 'where it breaks' lines below say how they differ.\n" if tied else ""),
           f"Chain strength, meaning its weakest link: `{g.get('chain_strength')}`; strongest single link: `{g.get('best_grade')}`. "
           f"Deepest node with evidence: {node_label(g.get('deepest_node_with_evidence')) or g.get('deepest_node_with_evidence')} ({g.get('deepest_level')}).\n", steps_md(g), ""]
    if g.get("weakest_link"): md += [f"**Where it breaks:** {g['weakest_link']}\n"]
    if g.get("gaps"): md += ["**Gaps:** " + "; ".join(g["gaps"]) + "\n"]
md += ["## Every chain, strongest first\n",
       "Ordered by **chain strength**, the weakest grade on the chain, because that is what a chain actually supports. The strongest single link is shown beside it: "
       "a chain can hold one `mechanism` link and still be worth little if another link is `missing`.\n",
       "| gene | chain strength (weakest link) | strongest single link | deepest node | publications (full text / abstract only) | where it breaks |", "|---|---|---|---|---|---|"]
for g in ranked:
    md.append(f'| {g.get("symbol")} | `{g.get("chain_strength")}` | `{g.get("best_grade")}` | {node_label(g.get("deepest_node_with_evidence")) or g.get("deepest_node_with_evidence") or "none"} ({g.get("deepest_level") or "-"}) | {g.get("n_full_text_sources", 0)} / {g.get("n_abstract_only_sources", 0)} | {(g.get("weakest_link") or "not stated")[:200]} |')
if cross:
    md += ["\n## Claims spanning several genes\n"] + [f'- `{c.get("evidence_grade")}` {c.get("claim")} ({"; ".join(cite(s) for s in c["sources"]) or "no source"})' for c in cross]
gaps_all = [(g.get("symbol"), x) for g in genes for x in (g.get("gaps") or [])]
if gaps_all:
    md += ["\n## What could not be established\n"] + [f"- **{s}**: {x}" for s, x in gaps_all]
if flags:
    md += ["\n## Validation flags\n", "These are the assembler's own checks on the subagents' output; they are counted in `causal-chains.json`.\n"] + [f"- {k}: {v}" for k, v in sorted(flags.items(), key=lambda kv: -kv[1])]
md += ["\n## Interactions\n", f"{len(interactions)} tissue-to-tissue and cell-to-cell arrows are in `genotype/interactions.json` "
       f"({inter_out['coverage']['orthology_inferred']} inferred by orthology from another species' ligand-receptor data). "
       f"By grade: {inter_out['coverage']['by_grade']}."]
open(os.path.join(HERE, "CAUSAL.md"), "w", encoding="utf8").write("\n".join(md) + "\n")

print(json.dumps({"chains": cov, "interactions": inter_out["coverage"], "flags": dict(flags), "unknown_node_ids": dict(unknown_nodes), "agents": list(per_agent) + list(per_agent_i)}, indent=1))
for f, s in (("causal-chains.json", "chains"), ("interactions.json", "interactions")):
    print(f, round(os.path.getsize(os.path.join(HERE, f)) / 1e3), "KB")
