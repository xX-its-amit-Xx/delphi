#!/bin/bash
# Generates Amber mdin files. tleap numbering: resid 1-2 filter K+, 3-512 protein; FW = first of the two filter waters (set by run_md.sh).
# Restraint masks: HEAVY = protein heavy atoms + filter ions; BB = backbone + filter ions.
FW=${FW:?set FW}; FW2=$((FW+1)); HEAVY="':1-512,${FW}-${FW2}&!@H='"; BB="':3-512@CA,C,N,O|:1-2,${FW}-${FW2}'"
common_npt="ntp=3, csurften=3, gamma_ten=0.0, ninterface=2, barostat=2, pres0=1.0, mcbarint=100,"
mk() { # name nstlim dt wt mask irest ntx extra
cat > $1.in <<EOT
$1
 &cntrl
  imin=0, irest=$6, ntx=$7, nstlim=$2, dt=$3,
  ntc=2, ntf=2, cut=10.0, iwrap=1,
  ntt=3, gamma_ln=1.0, temp0=303.15, ig=-1,
  ntpr=5000, ntwr=25000, ntwx=12500, ntxo=2, ioutfm=1,
  $8
  ntr=$( [ "$4" = 0 ] && echo 0 || echo 1 ), restraint_wt=$4, restraintmask=$5,
 /
EOT
}
cat > min.in <<EOT
min
 &cntrl
  imin=1, maxcyc=5000, ncyc=2500, ntb=1, cut=10.0,
  ntr=1, restraint_wt=10.0, restraintmask=$HEAVY, ntpr=500,
 /
EOT
cat > heat.in <<EOT
heat 0->303.15 K NVT
 &cntrl
  imin=0, irest=0, ntx=1, nstlim=125000, dt=0.002, ntb=1,
  ntc=2, ntf=2, cut=10.0, iwrap=1, tempi=0.0,
  ntt=3, gamma_ln=1.0, temp0=303.15, ig=-1, nmropt=1,
  ntpr=5000, ntwr=25000, ntwx=0, ntxo=2, ioutfm=1,
  ntr=1, restraint_wt=10.0, restraintmask=$HEAVY,
 /
 &wt type='TEMP0', istep1=0, istep2=100000, value1=0.0, value2=303.15 /
 &wt type='TEMP0', istep1=100001, istep2=125000, value1=303.15, value2=303.15 /
 &wt type='END' /
EOT
mk eq1 250000 0.002 5.0 "$HEAVY" 1 5 "ntb=2, $common_npt"
mk eq2 250000 0.002 2.5 "$HEAVY" 1 5 "ntb=2, $common_npt"
mk eq3 125000 0.004 1.0 "$HEAVY" 1 5 "ntb=2, $common_npt"
mk eq4 250000 0.004 0.5 "$BB"    1 5 "ntb=2, $common_npt"
mk eq5 250000 0.004 0.1 "$BB"    1 5 "ntb=2, $common_npt"
# production: 2.5 ns segments, 4 fs, no restraints. First segment of each replica regenerates velocities.
for r in 1 2; do
  sed "s/ig=-1/ig=${r}${r}${r}${r}1/" > prod_r${r}_start.in <<EOT
prod replica $r start (new velocities at 303.15 K)
 &cntrl
  imin=0, irest=0, ntx=1, tempi=303.15, nstlim=625000, dt=0.004,
  ntc=2, ntf=2, cut=10.0, iwrap=1, ntb=2, $common_npt
  ntt=3, gamma_ln=1.0, temp0=303.15, ig=-1,
  ntpr=5000, ntwr=25000, ntwx=12500, ntxo=2, ioutfm=1, ntr=0,
 /
EOT
done
cat > prod_cont.in <<EOT
prod continuation
 &cntrl
  imin=0, irest=1, ntx=5, nstlim=625000, dt=0.004,
  ntc=2, ntf=2, cut=10.0, iwrap=1, ntb=2, $common_npt
  ntt=3, gamma_ln=1.0, temp0=303.15, ig=-1,
  ntpr=5000, ntwr=25000, ntwx=12500, ntxo=2, ioutfm=1, ntr=0,
 /
EOT
