#!/usr/bin/env bash
# Greps the Mathlib pinned by the project (rev in lean/lake-manifest.json) for names that bear on the difficulty ratings.
M=D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/.lake/packages/mathlib/Mathlib
for pat in "finrank_range_add_finrank_ker" "theorem integral_pow" "theorem Real.sin_eq_zero_iff\b|theorem sin_eq_zero_iff\b" "convexOn_zpow"; do
  printf '%s -> %s hits\n' "$pat" "$(grep -rEl "$pat" $M | wc -l)"
done
for pat in "Laman" "Hashin" "Voigt" "Reuss" "Euler buckling|buckling" "Young's modulus|Young modulus" "rigidity matrix|Maxwell.*rigid" "Gibson" "Poisson's ratio|Poisson ratio" "Timoshenko" "Griffith" "Flory"; do
  printf '%s -> %s files\n' "$pat" "$(grep -rEli "$pat" $M | wc -l)"
done
