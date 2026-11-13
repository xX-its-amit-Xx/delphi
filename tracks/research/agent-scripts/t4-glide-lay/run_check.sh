#!/bin/bash
# Re-runs the earlier designer's port check (read-only on its folder) against the downloaded MIT repo.
M=$(cygpath -m /d/Users/ashenoy00000/delphi-work/data/glide-seeds/repo/EffectFoldAngleAutorotatingSeeds-master/model/)
B=$(cygpath -m /d/Users/ashenoy00000/delphi-work/agents/scratch/design-glide)
python $B/check_port.py "$M" "$B" 2>&1 | grep -E "^==|port-vs-stored|stored min"
python -c "
import sys;sys.path.insert(0,'$B');import bem
r=lambda p,k:bem.eq(p,k)
print('psi15 KL1.81', r(15,1.81)); print('psi35 KL1.2', r(35,1.2))
"
