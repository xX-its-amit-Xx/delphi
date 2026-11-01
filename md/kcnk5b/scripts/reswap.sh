#!/bin/bash
#SBATCH -J kcnk5b-reswap
#SBATCH -p short
#SBATCH -c 2
#SBATCH --mem=8G
#SBATCH -t 00:40:00
#SBATCH -o /scratch/shenoy.am/delphi-md/kcnk5b/logs/reswap_%j.log
cd /scratch/shenoy.am/delphi-md/kcnk5b/build
module load miniconda3/25.9.1
source activate /scratch/shenoy.am/delphi-md/kcnk5b/env/md
for v in WT W169L; do python swap_protein.py F241Y_bilayer.pdb ${v}_amber.pdb ${v}_bilayer.pdb > ${v}_swap.log 2>&1 || { cat ${v}_swap.log; exit 1; }; cat ${v}_swap.log; done
bash leap_hmr.sh
