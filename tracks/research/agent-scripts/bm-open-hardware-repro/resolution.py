"""How fine must the instruments be? Standard library only. usage: python -I resolution.py
Inputs (each labelled with its source):
  strip 40 x 4 x 1.0 mm              : design-biomaterial.json physical_build (main set)
  density Flex80A V2 1.09 g/cm3 ; Tough 1000 1.07 g/cm3 : Formlabs TDS values as recorded in agents2/bm-formlabs-all-resins.json
  mass uptake 1 d : Flex80A V2 8 % (TDS slab), Flex80A V1 cube 0.7 %, Rigid 10K <0.1 % (Formlabs cube table, bm-formlabs-all-resins.json)
  Greenspan 1977 Table 3 column 'a' (this work), 20 C and 30 C, for salt temperature coefficients
Model: a reading quantised to step r has uniform error, sd = r/sqrt(12); a difference of two readings has sd = r/sqrt(6)."""
import math
r6 = lambda r: r / math.sqrt(6)
L, W, T = 40.0, 4.0, 1.0           # mm
V = L * W * T / 1000.0            # cm3
print('strip volume %.3f cm3' % V)
for name, rho in (('Flexible 80A V2', 1.09), ('Tough 1000', 1.07)):
    print('  %s mass = %.1f mg' % (name, rho * V * 1000))
print()
print('MASS: relative error of an uptake measurement = sd_diff / (m * uptake); uptakes are hypothetical levels to span the range')
m_mg = {'Flexible 80A V2 strip': 1.09 * V * 1000, 'Tough 1000 strip': 1.07 * V * 1000, '20x20x1 mm Tough-1000 coupon': 1.07 * 0.4 * 1000}
for r_mg in (0.1, 1.0):
    for lab, m in m_mg.items():
        for up in (8.0, 0.7, 0.1):
            err = r6(r_mg) / (m * up / 100) * 100
            print('  readability %.1f mg | %-30s | uptake %4.1f %% -> signal %7.3f mg, relative error %6.1f %%' % (r_mg, lab, up, m * up / 100, err))
print()
print('mass needed so that a 0.1 %% uptake is read to 5 %%: m = sd_diff/(0.05*0.001)')
for r_mg in (0.1, 1.0):
    print('  readability %.1f mg -> %.0f mg (%.2f g)' % (r_mg, r6(r_mg) / (0.05 * 0.001), r6(r_mg) / (0.05 * 0.001) / 1000))
print()
print('LENGTH (project record: free swelling strain known to ~5 %%; 0.2 %% strain on 40 mm = %.0f um, 5%% of that = %.1f um)' % (0.002 * 40000, 0.05 * 0.002 * 40000))
print('  strain 1.0 %% (Flex80A V2, 1 d, bm-resin-water-uptake-data): %.0f um on 40 mm' % (0.01 * 40000))
print('  strain 0.083 %% (ceiling-signal equal to 1 mm sag on 40 mm, bm-formlabs-printing-workflows): %.1f um' % (0.00083 * 40000))
print('  pixel pitch at 600 dpi %.1f um, 1200 dpi %.1f um, 2400 dpi %.1f um, 4800 dpi %.1f um' % tuple(25400 / d for d in (600, 1200, 2400, 4800)))
for fov, px in ((60, 4056), (60, 3000), (60, 1920)):
    print('  camera, field %d mm across %d px -> %.1f um/px' % (fov, px, fov * 1000 / px))
print('  caliper 10 um step: sd of a difference = %.1f um' % r6(10))
print('  caliper manufacturer accuracy +-0.03 mm quoted in some listings (search snippet) = 30 um')
print()
print('THICKNESS (project record: layer thickness to ~3 %)')
for h in (200, 100):
    tol = 0.03 * h
    print('  layer %d um -> 3 %% = %.1f um; pixel size should be <= tol/3 = %.1f um' % (h, tol, tol / 3))
print()
print('SALT JAR TEMPERATURE COEFFICIENTS from Greenspan 1977 Table 3 col a (20 C -> 30 C)')
for n, a, b in (('MgCl2', 33.07, 32.44), ('NaCl', 75.47, 75.09), ('K2SO4', 97.59, 97.00)):
    print('  %s: %.2f -> %.2f  = %.3f %%RH per C ; +-2 C gives +-%.2f %%RH' % (n, a, b, (b - a) / 10, abs(b - a) / 10 * 2))
print('  K2SO4 at 25 C interpolated = %.2f %%RH (linear between 97.59 and 97.00)' % ((97.59 + 97.00) / 2))
print('  Greenspan Table 2 25 C: MgCl2 32.78+-0.16, NaCl 75.29+-0.12 (as OCR-read from the NIST PDF)')
print()
print('DRYING TIME (very rough; D from bm-diffusion-kinetics: Flex80A V2 water D >= 6e-12 m2/s; t90 both faces = 0.212 h^2/D; drying ~2.5x slower than wetting)')
for h_mm in (0.2, 1.0):
    h = h_mm / 1000
    t = 0.212 * h * h / 6e-12 / 3600
    print('  thickness %.1f mm: wetting t90 %.2f h ; drying ~ %.2f h (assumes same D for IPA, which is NOT measured)' % (h_mm, t, 2.5 * t))
