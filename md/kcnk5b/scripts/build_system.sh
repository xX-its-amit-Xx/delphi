#!/bin/bash
#SBATCH -J kcnk5b-build
#SBATCH -p short
#SBATCH -c 8
#SBATCH --mem=24G
#SBATCH -t 03:00:00
#SBATCH -o /scratch/shenoy.am/delphi-md/kcnk5b/logs/build_%j.log
set -x
B=/scratch/shenoy.am/delphi-md/kcnk5b/build; cd $B
module load miniconda3/25.9.1
source activate /scratch/shenoy.am/delphi-md/kcnk5b/env/md
export KEY_MODELLER=MODELIRANJE
[ -s kcnk5b_F241Y_model.pdb ] || python build_models.py 5 > modeller.log 2>&1 || { tail -30 modeller.log; exit 1; }
grep -E "BEST|DONE" modeller.log
for v in WT W169L F241Y; do
  python prep_system.py kcnk5b_${v}_model.pdb $v
  pdb4amber -i ${v}_oriented.pdb -o ${v}_amber.pdb -y --no-conect > ${v}_pdb4amber.log 2>&1
done
# Pack the WT bilayer; mutants get the identical environment (protein swap) unless a lipid clashes
pk() { packmol-memgen --pdb $1_amber.pdb --preoriented --lipids POPC --ratio 1 --dist 15 --dist_wat 17.5 \
       --salt --salt_c K+ --saltcon 0.15 --notprotonate --nottrim --overwrite -o $1_bilayer.pdb > $1_packmol.log 2>&1; }
[ -s WT_bilayer.pdb ] || pk WT
for v in W169L F241Y; do
  python swap_protein.py WT_bilayer.pdb ${v}_amber.pdb ${v}_bilayer.pdb > ${v}_swap.log 2>&1; rc=$?
  cat ${v}_swap.log
  if [ $rc -eq 3 ]; then echo "lipid clash for $v -> packing separately"; pk $v; fi
done
for v in WT W169L F241Y; do
  box=$(grep CRYST1 ${v}_bilayer.pdb | head -1 | awk '{print $2, $3, $4}')
  grep -E "^(ATOM|HETATM|TER)" ${v}_bilayer.pdb > ${v}_pack_noh.pdb
  cat > ${v}_leap.in <<EOT
source leaprc.protein.ff14SB
source leaprc.lipid21
source leaprc.water.tip3p
fil = loadpdb ${v}_filter.pdb
pk = loadpdb ${v}_pack_noh.pdb
sys = combine {fil pk}
bond sys.50.SG sys.305.SG
set sys box {$box}
charge sys
addIonsRand sys Cl- 0
addIonsRand sys K+ 0
charge sys
saveamberparm sys ${v}.parm7 ${v}.rst7
savepdb sys ${v}_leap.pdb
quit
EOT
  tleap -f ${v}_leap.in > ${v}_leap.log 2>&1
  grep -E "Total unperturbed charge|Warning|Error|FATAL|Added" ${v}_leap.log | sort | uniq -c | head -20
  # sanity: residues 50/305 must be CYX, 5 and 260 = first residue of each chain
  awk '$1=="ATOM" && ($5==50||$5==305||$5==5||$5==259||$5==260||$5==514||$5==515) && $3=="CA"{print "chk",$4,$5}' ${v}_leap.pdb
  awk '$1=="ATOM"||$1=="HETATM"{n++} END{print "atoms",n}' ${v}_leap.pdb
  parmed -p ${v}.parm7 > ${v}_hmr.log 2>&1 <<EOT
HMassRepartition
outparm ${v}_hmr.parm7
quit
EOT
done
ls -la *.parm7 *.rst7
