"""Part volume of the planned strips versus one 1 L cartridge. Standard library only.
Counts and sizes: agents/design-biomaterial.json physical_build (coupons ~70 strips 60 x 4 mm at 5 thicknesses; 30 bilayers
40 x 4 x 1.0 mm; 6 Tough-backed; 5 twins; 6 spare 2 mm wide; 18 humid-air strips 20 mm). Supports, rafts, test prints and
tank fill are NOT counted, so real use is higher by an unknown factor (no Formlabs figure for tank fill was read)."""
th = [0.2, 0.33, 0.5, 0.67, 0.8]
coupon = sum(14 * 60 * 4 * t for t in th) / 1000          # 70 strips = 14 per thickness, mm3 -> cm3
main = (30 + 6 + 5) * 40 * 4 * 1.0 / 1000 + 6 * 40 * 2 * 1.0 / 1000
humid = 18 * 20 * 4 * 1.0 / 1000
tot = coupon + main + humid
print('coupons %.1f cm3, main set %.1f cm3, humid-air set %.1f cm3, total part volume %.1f mL' % (coupon, main, humid, tot))
print('= %.1f %% of one 1000 mL cartridge if everything were one resin; real split is across 3 resins' % (tot / 10))
