#!/bin/bash
# Third fetch: the individual files read after fetch.sh / fetch2.sh. Writes to the same data folder, appends to MANIFEST.tsv.
D=/d/Users/ashenoy00000/delphi-work/data/bm-bioinspired-gen; cd $D
UA="delphi-research/0.1"
get(){ curl -sL -A "$UA" --max-time 90 -o "$1" "$2"; printf "%s\t%s\t%s\t%s\t%s\n" "$1" "$2" "$(date -u +%F)" "$(stat -c %s $1)" "$(sha256sum $1|cut -d' ' -f1)" >> MANIFEST.tsv; }
B=https://raw.githubusercontent.com/lamm-mit/Bioinspired123D/main
for p in notebooks/scripts/inference/vlm_critic.py notebooks/scripts/inference/blender_exec.py notebooks/scripts/inference/nodes.py notebooks/scripts/dataset/qualitycheck.py data/raw/biodataset_basecodes.csv; do get b123d_$(echo $p|tr / _) $B/$p; done
get arxiv_2603.29592.html https://arxiv.org/html/2603.29592
get gh_ctd_repo.json https://api.github.com/repos/lamm-mit/CategoryTheoryDesign
get ctd_gh_scripts_README.md https://raw.githubusercontent.com/lamm-mit/CategoryTheoryDesign/main/gh_scripts/README.md
get svv_svv_tree_data_data.py https://raw.githubusercontent.com/SimVascular/svVascularize/main/svv/tree/data/data.py
get svv_Copyright-Notice.txt https://raw.githubusercontent.com/SimVascular/svVascularize/main/Copyright-Notice.txt
get hf_b123d.json "https://huggingface.co/api/models?search=bioinspired3d&limit=5"
get cr_hsu2022.json https://api.crossref.org/works/10.1063/5.0082338
get llmto3d_site.html https://cdml-lab.github.io/LLMto3D
echo "--- text extraction + grep of the quotes used"
python -I - <<'PY'
import re,html,sys
sys.stdout.reconfigure(encoding='utf-8',errors='replace')
t=open('arxiv_2603.29592.html',encoding='utf8',errors='ignore').read()
t=re.sub(r'<(script|style)[\s\S]*?</\1>','',t); t=re.sub(r'<[^>]+>',' ',t); t=html.unescape(re.sub(r'\s+',' ',t))
open('arxiv_2603.29592.txt','w',encoding='utf8').write(t)
for q in ['not explicitly enforced during generation','mesh-level checks performed after each Blender execution','achieves a score of 54%','exported from Blender as STL files and fabricated via 3D printing','Stratasys F120 using ABS material with SR-30 dissolvable support']:
    print(bool(re.search(re.escape(q),t)),q)
PY
