#!/bin/bash
#SBATCH -J kcnk5b-md
#SBATCH -p gpu
#SBATCH --gres=gpu:v100-sxm2:1
#SBATCH -c 8
#SBATCH --mem=24G
#SBATCH -t 08:00:00
#SBATCH -o /scratch/shenoy.am/delphi-md/kcnk5b/logs/md_%j.log
# Resumable: every stage/segment is skipped if its restart exists. 3 systems x 2 replicas share ONE GPU.
module load AMBER/24 cuda/12.3.0 2>/dev/null || module load AMBER/24
nvidia-smi --query-gpu=name,memory.total --format=csv
T0=$(date +%s); WALL=${WALL:-$((8*3600))}; DEADLINE=$((T0 + WALL - 20*60))
B=/scratch/shenoy.am/delphi-md/kcnk5b/build; R=/scratch/shenoy.am/delphi-md/kcnk5b/run
MAXSEG=${MAXSEG:-40}; mkdir -p $R
log(){ echo "[$(date +%H:%M:%S)] $*"; }
# a stage is complete only when pmemd printed its final banner (rst7 is also written periodically during a run)
done_(){ [ -s $1.rst7 ] && grep -q -E "Final Performance Info|FINAL RESULTS" $1.out 2>/dev/null; }
run_stage(){ # v name in prev ref
  local v=$1 n=$2 in=$3 prev=$4 ref=$5
  while [ -e $n.lock ]; do sleep 30; done   # a CPU equilibration job (cpu_equil.sh) is running this stage
  done_ $n && return 0
  local try
  for try in 1 2; do
    pmemd.cuda -O -i $in -p ${v}_hmr.parm7 -c $prev.rst7 -ref $ref.rst7 -o $n.out -r $n.rst7 -x $n.nc -inf $n.mdinfo
    local rc=$?; done_ $n && break
    log "$v $n attempt $try FAILED rc=$rc"; tail -5 $n.out
  done
  done_ $n || return 1
  log "$v $n done"
}
replica(){ # v r
  local v=$1 r=$2 prev=eq5 s=1 t1 dur=0
  while [ $s -le $MAXSEG ]; do
    local n=prod_r${r}_s$(printf %02d $s)
    if done_ $n; then prev=$n; s=$((s+1)); continue; fi
    local now=$(date +%s); local need=$(( dur>0 ? dur : 2700 ))
    [ $((now + need)) -gt $DEADLINE ] && { log "$v r$r stop before $n (time)"; return 0; }
    local in=prod_cont.in; [ $prev = eq5 ] && in=prod_r${r}_start.in
    t1=$(date +%s)
    run_stage $v $n $in $prev $prev || return 1
    dur=$(( $(date +%s) - t1 )); log "$v r$r $n took ${dur}s"
    prev=$n; s=$((s+1))
  done
}
system(){ # v
  local v=$1; mkdir -p $R/$v; cd $R/$v
  cp -n $B/${v}_hmr.parm7 $B/${v}.rst7 . ; [ -s start.rst7 ] || cp ${v}.rst7 start.rst7
  export FW=$(awk '$1=="ATOM" && $4=="WAT"{print $5; exit}' $B/${v}_leap.pdb); log "$v filter waters resid $FW-$((FW+1))"
  [ -s min.in ] || bash $B/make_mdin.sh
  run_stage $v min min.in start start
  local emin=$(awk '/NSTEP/{getline; e=$2} END{print e}' min.out 2>/dev/null)
  log "$v final minimisation energy $emin"
  if ! done_ min || awk -v e="$emin" 'BEGIN{exit !(e+0 >= 0)}'; then
    # SPFP GPU minimisation can stall on packmol lipid-lipid overlaps: 300 double-precision CPU steps, then GPU again
    log "$v GPU minimisation failed -> 300-step CPU pre-minimisation"
    rm -f min.rst7; [ -s start_packmol.rst7 ] || cp start.rst7 start_packmol.rst7
    sed "s/maxcyc=5000, ncyc=2500/maxcyc=300, ncyc=300/" min.in > min_cpu.in
    pmemd -O -i min_cpu.in -p ${v}_hmr.parm7 -c start_packmol.rst7 -ref start_packmol.rst7 -o min_cpu.out -r min_cpu.rst7 || return 1
    cp min_cpu.rst7 start.rst7
    run_stage $v min min.in start start || return 1
  fi
  run_stage $v heat heat.in min min || return 1
  if ! run_stage $v eq1 eq1.in heat heat; then
    log "$v eq1 failed with MC barostat -> Berendsen (barostat=1, taup=1.0) for all NPT inputs"
    sed -i 's/barostat=2, pres0=1.0, mcbarint=100,/barostat=1, pres0=1.0, taup=1.0,/' eq*.in prod*.in
    rm -f eq1.rst7; run_stage $v eq1 eq1.in heat heat || return 1
  fi
  # restraint reference = previous stage (box shrinks ~18% during eq1 as packing vacuum closes)
  for e in eq2 eq3 eq4 eq5; do p=eq$(( ${e#eq} - 1 )); run_stage $v $e $e.in $p $p || return 1; done
  replica $v 1 & replica $v 2 & wait
}
# take over from any CPU equilibration jobs of this task (own jobs only), then clear their stage locks
for n in eqWT eqF241Y eqW169L; do scancel -u shenoy.am -n $n 2>/dev/null; done; sleep 15; rm -f $R/*/*.lock
for v in ${SYSTEMS:-WT W169L F241Y}; do system $v > $R/${v}_driver.log 2>&1 & done
wait
log "all done"; grep -h -E "took|stop|FAILED|done" $R/*_driver.log | tail -40
