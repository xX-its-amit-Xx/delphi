#!/bin/bash
# Second fetch: other open tools. Appends to MANIFEST.tsv
D=/d/Users/ashenoy00000/delphi-work/data/bm-bioinspired-gen; cd $D
UA="delphi-research/0.1"
get(){ curl -sL -A "$UA" --max-time 60 -o "$1" "$2"; printf "%s\t%s\t%s\t%s\t%s\n" "$1" "$2" "$(date -u +%F)" "$(stat -c %s $1)" "$(sha256sum $1|cut -d' ' -f1)" >> MANIFEST.tsv; }
for r in ProjectSilkworm/Silkworm jhbastek/InvertibleTrussDesign li-zhengz/UnifyingTrussDesignSpace SimVascular/svVascularize cdml-lab/LLMto3D 3esign/c33d; do
  n=$(echo $r|tr / _)
  get gh_${n}_repo.json "https://api.github.com/repos/$r"
  get gh_${n}_tree.json "https://api.github.com/repos/$r/git/trees/HEAD?recursive=1"
  get gh_${n}_readme.md "https://api.github.com/repos/$r/readme" 
done
