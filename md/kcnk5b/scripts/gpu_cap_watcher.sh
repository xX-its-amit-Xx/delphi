#!/bin/bash
#SBATCH -J kcnk5b-capwatch
#SBATCH -p short
#SBATCH -c 1
#SBATCH --mem=1G
#SBATCH -t 14:00:00
#SBATCH -o /scratch/shenoy.am/delphi-md/kcnk5b/logs/capwatch_%j.log
# Fair-use guard: release the held kcnk5b GPU job only when fewer than 2 GPU jobs of shenoy.am are RUNNING
# (hard cap 2 GPUs across all sessions). Checks every 2 min. Never touches other jobs.
J=${GPUJOB:?}
while true; do
  st=$(squeue -j $J -h -o "%T %r" 2>/dev/null)
  [ -z "$st" ] && { echo "$(date) job $J gone; exit"; exit 0; }
  case "$st" in RUNNING*) echo "$(date) $J running; exit"; exit 0;; esac
  n=$(squeue -u shenoy.am -t R -h -o "%b" | grep -c gpu)
  if [ "$n" -lt 2 ] && echo "$st" | grep -q JobHeldUser; then
    echo "$(date) running GPU jobs=$n -> release $J"; squeue -u shenoy.am -t R -h -o "%i %P %j %b"; scontrol release $J
  fi
  sleep 120
done
