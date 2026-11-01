#!/bin/bash
#SBATCH -J kcnk5b-env
#SBATCH -p short
#SBATCH -c 4
#SBATCH --mem=16G
#SBATCH -t 01:30:00
#SBATCH -o /scratch/shenoy.am/delphi-md/kcnk5b/logs/env_%j.log
module load miniconda3/25.9.1
export CONDA_PKGS_DIRS=/scratch/shenoy.am/delphi-md/kcnk5b/env/pkgs
conda create -y -p /scratch/shenoy.am/delphi-md/kcnk5b/env/md -c conda-forge -c salilab \
  python=3.11 ambertools=24 modeller mdanalysis numpy scipy matplotlib biopython hole2 || \
conda create -y -p /scratch/shenoy.am/delphi-md/kcnk5b/env/md -c conda-forge -c salilab \
  python=3.11 ambertools modeller mdanalysis numpy scipy matplotlib biopython
conda list -p /scratch/shenoy.am/delphi-md/kcnk5b/env/md | grep -E "ambertools|modeller|mdanalysis|hole|packmol|parmed|numpy"
