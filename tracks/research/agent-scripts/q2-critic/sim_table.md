| split | model | noise SD | r vs noisy labels (reported) | r vs true values | analytic ceiling | reported/ceiling |
|---|---|---|---|---|---|---|
| random_pairs | RF_ligand+protein | 0.0 | 0.916 (sd 0.010) | 0.916 | 1.000 | 0.92 |
| random_pairs | RF_ligand+protein | 0.4 | 0.904 (sd 0.011) | 0.914 | 0.989 | 0.91 |
| random_pairs | RF_ligand+protein | 0.8 | 0.871 (sd 0.012) | 0.910 | 0.958 | 0.91 |
| series_heldout | RF_ligand+protein | 0.0 | 0.803 (sd 0.006) | 0.803 | 1.000 | 0.80 |
| series_heldout | RF_ligand+protein | 0.4 | 0.797 (sd 0.008) | 0.805 | 0.989 | 0.81 |
| series_heldout | RF_ligand+protein | 0.8 | 0.774 (sd 0.010) | 0.805 | 0.958 | 0.81 |
| family_heldout | RF_ligand+protein | 0.0 | 0.577 (sd 0.164) | 0.577 | 1.000 | 0.58 |
| family_heldout | RF_ligand+protein | 0.4 | 0.581 (sd 0.163) | 0.588 | 0.987 | 0.59 |
| family_heldout | RF_ligand+protein | 0.8 | 0.569 (sd 0.167) | 0.596 | 0.952 | 0.60 |
| both_heldout | RF_ligand+protein | 0.0 | 0.192 (sd 0.124) | 0.192 | 1.000 | 0.19 |
| both_heldout | RF_ligand+protein | 0.4 | 0.200 (sd 0.122) | 0.203 | 0.987 | 0.20 |
| both_heldout | RF_ligand+protein | 0.8 | 0.187 (sd 0.114) | 0.197 | 0.952 | 0.20 |
| random_pairs | RF_ligand_only | 0.0 | 0.265 (sd 0.029) | 0.265 | 1.000 | 0.26 |
| random_pairs | RF_ligand_only | 0.4 | 0.259 (sd 0.029) | 0.263 | 0.989 | 0.26 |
| random_pairs | RF_ligand_only | 0.8 | 0.245 (sd 0.028) | 0.257 | 0.958 | 0.26 |
| series_heldout | RF_ligand_only | 0.0 | 0.126 (sd 0.048) | 0.126 | 1.000 | 0.13 |
| series_heldout | RF_ligand_only | 0.4 | 0.125 (sd 0.050) | 0.127 | 0.989 | 0.13 |
| series_heldout | RF_ligand_only | 0.8 | 0.120 (sd 0.044) | 0.125 | 0.958 | 0.13 |
| family_heldout | RF_ligand_only | 0.0 | 0.192 (sd 0.072) | 0.192 | 1.000 | 0.19 |
| family_heldout | RF_ligand_only | 0.4 | 0.187 (sd 0.067) | 0.189 | 0.987 | 0.19 |
| family_heldout | RF_ligand_only | 0.8 | 0.175 (sd 0.061) | 0.183 | 0.952 | 0.18 |
| both_heldout | RF_ligand_only | 0.0 | -0.098 (sd 0.150) | -0.098 | 1.000 | -0.10 |
| both_heldout | RF_ligand_only | 0.4 | -0.095 (sd 0.141) | -0.095 | 0.987 | -0.10 |
| both_heldout | RF_ligand_only | 0.8 | -0.095 (sd 0.133) | -0.100 | 0.952 | -0.10 |

True-value SD in world seed 0 = 2.641; n pairs = 24000; seeds = [0, 1, 2, 3, 4]