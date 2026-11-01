#!/bin/bash
#SBATCH -J kcnk5b-leap
#SBATCH -p short
#SBATCH -c 2
#SBATCH --mem=8G
#SBATCH -t 00:40:00
#SBATCH -o /scratch/shenoy.am/delphi-md/kcnk5b/logs/leap_%j.log
B=/scratch/shenoy.am/delphi-md/kcnk5b/build; cd $B
module load miniconda3/25.9.1
source activate /scratch/shenoy.am/delphi-md/kcnk5b/env/md
for v in ${LEAPSYS:-WT W169L F241Y}; do
  grep -E "^(ATOM|HETATM|TER)" ${v}_bilayer.pdb > ${v}_pack_noh.pdb
  cat > ${v}_leap.in <<EOT
source leaprc.protein.ff14SB
source leaprc.lipid21
source leaprc.water.tip3p
fil = loadpdb ${v}_filter.pdb
pk = loadpdb ${v}_pack_noh.pdb
desc pk.46
bond pk.46.SG pk.301.SG
sys = combine {fil pk}
setBox sys vdw
charge sys
addIonsRand sys Cl- 0
addIonsRand sys K+ 0
charge sys
saveamberparm sys ${v}.parm7 ${v}.rst7
savepdb sys ${v}_leap.pdb
quit
EOT
  tleap -f ${v}_leap.in > ${v}_leap.log 2>&1
  echo "== $v"; grep -E "RESIDUE name|Total unperturbed charge|Total perturbed|FATAL|Fatal|Error|Box dimensions|addIons|Placed|Adding" ${v}_leap.log | sort | uniq -c
  grep -A2 "Warning" ${v}_leap.log | grep -v -E "^--|Warning|split into|Name change" | sort | uniq -c | head
  awk '$1=="ATOM" && $3=="CA" && ($5==5||$5==50||$5==259||$5==260||$5==305||$5==514){print "chk",$4,$5}' ${v}_leap.pdb
  awk '$1=="ATOM"||$1=="HETATM"{n++} END{print "atoms",n}' ${v}_leap.pdb
  grep -c "K+ " ${v}_leap.pdb; grep -c "Cl- " ${v}_leap.pdb; grep -E "^(HETATM|ATOM).{13}(K\+|WAT)" ${v}_leap.pdb | head -4
  printf "HMassRepartition\noutparm ${v}_hmr.parm7\nquit\n" | parmed -O -p ${v}.parm7 > ${v}_hmr.log 2>&1
  ls -la ${v}_hmr.parm7 ${v}.rst7
done
