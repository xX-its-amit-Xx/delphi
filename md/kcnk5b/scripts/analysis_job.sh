#!/bin/bash
#SBATCH -J kcnk5b-ana
#SBATCH -p short
#SBATCH -c 2
#SBATCH --mem=16G
#SBATCH -t 02:00:00
#SBATCH -o /scratch/shenoy.am/delphi-md/kcnk5b/logs/ana_%j.log
# Analyse all COMPLETED production segments so far (safe while production is still running), then plot.
module load miniconda3/25.9.1
source activate /scratch/shenoy.am/delphi-md/kcnk5b/env/md
cd /scratch/shenoy.am/delphi-md/kcnk5b/build
OUT=${OUT:-/scratch/shenoy.am/delphi-md/kcnk5b/analysis}; export OUT
python analyze.py && python plot_results.py $OUT $OUT/plots
grep -h -E "took|stop|FAILED" ../run/*_driver.log | tail -n 30 > $OUT/run_log_tail.txt
ls -la $OUT $OUT/plots
