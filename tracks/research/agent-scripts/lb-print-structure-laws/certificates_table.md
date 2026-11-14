# Certificates applied to the five proof-of-concept objects

Placeholder brief (author's choice, NOT a client requirement): horizontal cantilever, sag <= 10 % of length, tip rotation >= 30 deg, slowest-mode time <= 1 h.

## favourable / in air

| part | L mm | h mm | sag mm (sag/L) | tau h | theta_max deg | h window mm [floor, min(speed, rot)] | L_cap mm | eliminated by |
|---|---|---|---|---|---|---|---|---|
| 1 strip | 30 | 1 | 1.09 (0.04) | 0.41 | 82 | [0.60, min(1.56, 2.72)] | 610.4 | none |
| 2 comb, 0.5 mm rung | 30 | 0.5 | 4.38 (0.15) | 0.10 | 163 | [0.60, min(1.56, 2.72)] | 610.4 | sag |
| 2 comb, 1.0 mm rung | 30 | 1 | 1.09 (0.04) | 0.41 | 82 | [0.60, min(1.56, 2.72)] | 610.4 | none |
| 2 comb, 2.0 mm rung | 30 | 2 | 0.27 (0.01) | 1.64 | 41 | [0.60, min(1.56, 2.72)] | 610.4 | speed |
| 3 tile (as 3 mm strip) | 60 | 1 | 17.51 (0.29) | 0.41 | 163 | [1.71, min(1.56, 5.45)] | 610.4 | sag, empty window |
| 4 tree trunk | 50 | 2 | 2.11 (0.04) | 1.64 | 68 | [1.30, min(1.56, 4.54)] | 610.4 | speed |
| 4 tree branch | 25 | 1 | 0.53 (0.02) | 0.41 | 68 | [0.46, min(1.56, 2.27)] | 610.4 | none |
| 4 tree twig | 12.5 | 0.5 | 0.13 (0.01) | 0.10 | 68 | [0.16, min(1.56, 1.14)] | 610.4 | none |
| 5 louvre blade | 120 | 3 | 31.13 (0.26) | 3.68 | 109 | [4.83, min(1.56, 10.90)] | 610.4 | sag, speed, empty window |

## central / in air

| part | L mm | h mm | sag mm (sag/L) | tau h | theta_max deg | h window mm [floor, min(speed, rot)] | L_cap mm | eliminated by |
|---|---|---|---|---|---|---|---|---|
| 1 strip | 30 | 1 | 5.21 (0.17) | 1.36 | 59 | [1.32, min(0.86, 1.96)] | 66.3 | sag, speed, empty window |
| 2 comb, 0.5 mm rung | 30 | 0.5 | 20.86 (0.70) | 0.34 | 118 | [1.32, min(0.86, 1.96)] | 66.3 | sag, empty window |
| 2 comb, 1.0 mm rung | 30 | 1 | 5.21 (0.17) | 1.36 | 59 | [1.32, min(0.86, 1.96)] | 66.3 | sag, speed, empty window |
| 2 comb, 2.0 mm rung | 30 | 2 | 1.30 (0.04) | 5.43 | 29 | [1.32, min(0.86, 1.96)] | 66.3 | speed, rotation, empty window |
| 3 tile (as 3 mm strip) | 60 | 1 | 83.43 (1.39) | 1.36 | 118 | [3.73, min(0.86, 3.92)] | 66.3 | sag, speed, empty window |
| 4 tree trunk | 50 | 2 | 10.06 (0.20) | 5.43 | 49 | [2.84, min(0.86, 3.27)] | 66.3 | sag, speed, empty window |
| 4 tree branch | 25 | 1 | 2.51 (0.10) | 1.36 | 49 | [1.00, min(0.86, 1.63)] | 66.3 | sag, speed, empty window |
| 4 tree twig | 12.5 | 0.5 | 0.63 (0.05) | 0.34 | 49 | [0.35, min(0.86, 0.82)] | 66.3 | none |
| 5 louvre blade | 120 | 3 | 148.33 (1.24) | 12.22 | 78 | [10.55, min(0.86, 7.84)] | 66.3 | sag, speed, length cap, empty window |

## favourable / submerged

| part | L mm | h mm | sag mm (sag/L) | tau h | theta_max deg | h window mm [floor, min(speed, rot)] | L_cap mm | eliminated by |
|---|---|---|---|---|---|---|---|---|
| 1 strip | 30 | 1 | 0.10 (0.00) | 0.41 | 82 | [0.18, min(1.56, 2.72)] | 6850.0 | none |
| 2 comb, 0.5 mm rung | 30 | 0.5 | 0.39 (0.01) | 0.10 | 163 | [0.18, min(1.56, 2.72)] | 6850.0 | none |
| 2 comb, 1.0 mm rung | 30 | 1 | 0.10 (0.00) | 0.41 | 82 | [0.18, min(1.56, 2.72)] | 6850.0 | none |
| 2 comb, 2.0 mm rung | 30 | 2 | 0.02 (0.00) | 1.64 | 41 | [0.18, min(1.56, 2.72)] | 6850.0 | speed |
| 3 tile (as 3 mm strip) | 60 | 1 | 1.56 (0.03) | 0.41 | 163 | [0.51, min(1.56, 5.45)] | 6850.0 | none |
| 4 tree trunk | 50 | 2 | 0.19 (0.00) | 1.64 | 68 | [0.39, min(1.56, 4.54)] | 6850.0 | speed |
| 4 tree branch | 25 | 1 | 0.05 (0.00) | 0.41 | 68 | [0.14, min(1.56, 2.27)] | 6850.0 | none |
| 4 tree twig | 12.5 | 0.5 | 0.01 (0.00) | 0.10 | 68 | [0.05, min(1.56, 1.14)] | 6850.0 | none |
| 5 louvre blade | 120 | 3 | 2.77 (0.02) | 3.68 | 109 | [1.44, min(1.56, 10.90)] | 6850.0 | speed |

## Length cap for other moduli (same 3.17 % strain assumed, which no stiff resin has shown)

- Flexible 80A V2 upper prior 11 MPa: 610 mm
- Tough 1000 932 MPa: 51718 mm
- Rigid 10K 10000 MPa: 554909 mm
