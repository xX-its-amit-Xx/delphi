#!/bin/bash
#SBATCH -p short
#SBATCH -N 1
#SBATCH -n 32
#SBATCH --mem=24G
#SBATCH -t 06:00:00
#SBATCH -o /scratch/shenoy.am/delphi-md/kcnk5b/logs/cpueq_%x_%j.log
# CPU (pmemd.MPI) equilibration while the GPU cap is full. Same inputs/order as run_md.sh. Each stage holds a .lock
# so the GPU job waits for it; stops starting new stages once the GPU job (GPUJOB) is running.
v=${V:?}; GPUJOB=${GPUJOB:?}
module load AMBER/24
cd /scratch/shenoy.am/delphi-md/kcnk5b/run/$v
log(){ echo "[$(date +%H:%M:%S)] $*"; }
done_(){ [ -s $1.rst7 ] && grep -q -E "Final Performance Info|FINAL RESULTS" $1.out 2>/dev/null; }
stage(){ # name in prev ref
  done_ $1 && return 0
  [ "$(squeue -j $GPUJOB -h -o %T 2>/dev/null)" = RUNNING ] && { log "GPU job running -> stop before $1"; exit 0; }
  touch $1.lock
  mpirun --bind-to none -np $SLURM_NTASKS pmemd.MPI -O -i $2 -p ${v}_hmr.parm7 -c $3.rst7 -ref $4.rst7 -o $1.out -r $1.rst7 -x $1.nc -inf $1.mdinfo
  rm -f $1.lock
  done_ $1 || { log "$v $1 FAILED"; exit 1; }
  log "$v $1 done (CPU) $(grep ns/day $1.out | tail -n 1)"
}
[ -s min.rst7 ] || { log "no min.rst7"; exit 1; }
[ -s min.in ] || FW=$(awk '$1=="ATOM" && $4=="WAT"{print $5; exit}' ../../build/${v}_leap.pdb) bash ../../build/make_mdin.sh
stage heat heat.in min min
stage eq1 eq1.in heat heat
for e in eq2 eq3 eq4 eq5; do p=eq$(( ${e#eq} - 1 )); stage $e $e.in $p $p; done
log "$v CPU equilibration complete"
