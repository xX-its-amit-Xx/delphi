#!/bin/bash
# Dump per-condition mean descent speeds from the MIT repo pickle (restricted unpickler by earlier scout), then compute the psi=0 / psi=35 ratio.
python D:/Users/ashenoy00000/delphi-work/agents/scratch/scout-glide/safe_unpickle.py D:/Users/ashenoy00000/delphi-work/data/glide-seeds/repo/EffectFoldAngleAutorotatingSeeds-master/model/all_results_experiments.pkl > $(dirname $0)/../../scratch/t4-glide-lay/pkl_dump.txt
grep -E "^(0|35)\.?0?, " $(dirname $0)/../../scratch/t4-glide-lay/pkl_dump.txt | grep -E "2\.16" | head -20
python -c "print('ratio 0.1011/0.0676 =', round(0.1011/0.0676,3))"
