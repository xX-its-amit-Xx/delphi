#!/bin/bash
# Fetch primary sources for bm-bioinspired-generative-design; records url, date, size, sha256 into MANIFEST.tsv
D=/d/Users/ashenoy00000/delphi-work/data/bm-bioinspired-gen
mkdir -p $D; cd $D
UA="delphi-research/0.1"
get(){ # name url
  curl -sL -A "$UA" --max-time 60 -o "$1" "$2"
  printf "%s\t%s\t%s\t%s\t%s\n" "$1" "$2" "$(date -u +%F)" "$(stat -c %s $1)" "$(sha256sum $1|cut -d' ' -f1)" >> MANIFEST.tsv
}
: > MANIFEST.tsv
get arxiv_bioinspired123d.xml "http://export.arxiv.org/api/query?id_list=2603.29592"
get arxiv_sciagents.xml "http://export.arxiv.org/api/query?id_list=2409.05556"
get gh_b123d_repo.json "https://api.github.com/repos/lamm-mit/Bioinspired123D"
get gh_b123d_tree.json "https://api.github.com/repos/lamm-mit/Bioinspired123D/git/trees/HEAD?recursive=1"
get gh_b123d_readme.md "https://raw.githubusercontent.com/lamm-mit/Bioinspired123D/main/README.md"
get gh_sci_repo.json "https://api.github.com/repos/lamm-mit/SciAgentsDiscovery"
get gh_sci_tree.json "https://api.github.com/repos/lamm-mit/SciAgentsDiscovery/git/trees/HEAD?recursive=1"
get gh_sci_readme.md "https://raw.githubusercontent.com/lamm-mit/SciAgentsDiscovery/main/README.md"
get gh_gr_repo.json "https://api.github.com/repos/lamm-mit/GraphReasoning"
get cr_b123d.json "https://api.crossref.org/works/10.1088/3050-287X/ae61d1"
cat MANIFEST.tsv
