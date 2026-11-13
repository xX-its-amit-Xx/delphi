"""Own calculations used in the report. Run: python -I calc.py"""
# Aurora LCA (aurora page): PLA vs ABS kgCO2
pla, abs_ = 2333.89, 8890.42
print("Aurora saving kg", round(abs_-pla,2), " fraction", round(1-pla/abs_,4))
# Altostrata page: 0.49 kg CO2-e (PLA) vs 2-3 kg CO2-e (petroleum equivalent), per kg
for p in (2.0, 3.0):
    print("Altostrata saving vs", p, "=", round(1-0.49/p,4))
# The Roe: 30 modules, ~20 kg, 15-20 h each
print("Roe mass kg", 30*20, " robot-hours", 30*15, "-", 30*20)
# Sandwaves: 58 elements, ~160 kg
print("Sandwaves mass kg", 58*160)
# Monolith wall (Fab.Pub): 260 panels, >800 h
print("Monolith h/panel >=", round(800/260,2))
# Galaxia: 18000 screws at 1.8 kN each, if all loaded in parallel (upper bound, not a claim)
print("Galaxia nominal screw capacity sum kN", 18000*1.8)
# Roe module areal-mass cannot be computed: module surface area not stated.
