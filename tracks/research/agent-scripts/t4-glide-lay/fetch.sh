#!/bin/bash
# Fetch primary sources for t4-glide-lay into scratch; prints size and sha256.
S=/d/Users/ashenoy00000/delphi-work/agents2/scratch/t4-glide-lay
UA="delphi-research/0.1"
cd "$S" || exit 1
get(){ curl -sL -A "$UA" -o "$1" "$2"; printf '%s\t%s bytes\t%s\t%s\n' "$1" "$(stat -c %s "$1")" "$(sha256sum "$1"|cut -d' ' -f1)" "$2"; }
get cr_physreve.json "https://api.crossref.org/works/10.1103/physreve.100.013108"
get cr_prl.json "https://api.crossref.org/works/10.1103/physrevlett.122.024501"
get cr_jeb.json "https://api.crossref.org/works/10.1242/jeb.00739"
get cr_science.json "https://api.crossref.org/works/10.1126/science.1174196"
get cr_jfm.json "https://api.crossref.org/works/10.1017/jfm.2022.89"
get arx_1811.xml "http://export.arxiv.org/api/query?id_list=1811.12221"
get arx_1902.xml "http://export.arxiv.org/api/query?id_list=1902.08038"
get repo_readme.md "https://raw.githubusercontent.com/jerabaul29/EffectFoldAngleAutorotatingSeeds/master/README.md"
get repo_license "https://raw.githubusercontent.com/jerabaul29/EffectFoldAngleAutorotatingSeeds/master/LICENSE"
