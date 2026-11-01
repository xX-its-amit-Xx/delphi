#!/bin/bash
#SBATCH -J kcnk5b-w169l-min
#SBATCH -p short
#SBATCH -n 16
#SBATCH --mem=16G
#SBATCH -t 01:00:00
#SBATCH -o /scratch/shenoy.am/delphi-md/kcnk5b/logs/w169l_cpumin_%j.log
# W169L: full 5000-step minimisation in double precision on CPU (GPU SPFP stalled on packmol overlaps)
module load AMBER/24
cd /scratch/shenoy.am/delphi-md/kcnk5b/run/W169L
cp start_packmol.rst7 start.rst7
mpirun -np $SLURM_NTASKS pmemd.MPI -O -i min.in -p W169L_hmr.parm7 -c start.rst7 -ref start.rst7 -o min.out -r min.rst7 -inf min.mdinfo
grep -E "^ +[0-9]+ +-?[0-9]" min.out | tail -n 3
