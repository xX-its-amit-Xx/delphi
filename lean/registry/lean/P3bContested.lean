/-
# perturb-depth-cap contested by an observation (registry record observations/jamieson2023b-pseudoliparis-8336m.json)

A teleost (Pseudoliparis sp. indet. 1, Liparidae) was recorded at 8336 m in the Izu-Ogasawara Trench
(Jamieson et al. 2026, Biodiversity Data Journal 14:e182172, PMID 41822858, PMC12976738, citing Jamieson et al.
2023, doi:10.1016/j.dsr.2023.104132). The law's hypothesis `OsmolyteDepthCap`, applied to that fish (its internal
osmolality at 8336 m does not exceed seawater), proves `False`: the observation and the law cannot both hold.
The second theorem shows the conflict is with the law's own instance (`measured`, the witness line through the
Yancey 2014 points), not only with some hypothetical parameter choice.
-/
import Delphi.Perturb

namespace Delphi.Registry

theorem depthCap_contradicts_8336 (O : Delphi.Perturb.OsmolyteDepthCap) (hreg : O.osm 8336 ≤ O.sw) : False :=
  Delphi.Perturb.no_teleost_below O hreg (by norm_num)

theorem depthCap_measured_contradicts_8336 (hreg : Delphi.Perturb.measured.osmolyte.osm 8336 ≤ Delphi.Perturb.measured.osmolyte.sw) : False :=
  depthCap_contradicts_8336 _ hreg

end Delphi.Registry

#print axioms Delphi.Registry.depthCap_contradicts_8336
#print axioms Delphi.Registry.depthCap_measured_contradicts_8336
