// WHERE THE EMBRYO IS: the dish, and the place the eggs are actually laid.
//
// ============================== WHY THIS IS NOT A BACKDROP ==============================
// Switching between "petri dish" and "the wild" changes a measured temperature, and temperature drives
// the developmental clock through a published law (staging.mjs). So the toggle does not re-skin a scene -
// it re-times it. A sun-warmed pool margin at 34.9 C runs the same embryo about 35 % faster than a 28.5 C
// incubator, and a spring-fed well at 24.5 C runs it about 22 % slower.
//
// ============================== THE FINDING THE TOGGLE EXPOSES ==============================
// Both ends of the measured wild temperature range fall OUTSIDE the 25-33 C window in which the
// developmental clock was validated. The dish sits comfortably inside it. So the laboratory is the easy
// case and the wild is the one where our own clock is extrapolating - which is the opposite of how a
// "realistic environment" toggle is usually sold, and is the more interesting thing to show.
//
// ============================== WHAT IS NOT HERE, AND MUST NOT BE INVENTED ==============================
// Egg survival in the wild is NOT PUBLISHED. The standard reference states directly that the impact of
// predation and competition on wild zebrafish survival and reproduction is "entirely unknown". A scene
// that shows eggs being eaten at some rate would be inventing the single number nobody has. Predation is
// therefore depicted as something that HAPPENS, never as a rate.
//
// Danio rerio only.

export const WILD = {
  id: 'wild',
  what: 'a shallow, vegetated margin of a floodplain pool in the Indian subcontinent',
  habitat: {
    type: 'shallow, slow-moving streams and - particularly - still pools that form alongside streams during the monsoons; also rice paddies, drainage ditches and stock ponds',
    source: 'Parichy 2015, eLife 4:e05635, doi 10.7554/eLife.05635',
    also: 'silt-bottomed, well-vegetated pools and rice paddies adjacent to slow-moving streams (Engeszer et al. 2007, Zebrafish 4:21-40, doi 10.1089/zeb.2006.9997 - abstract only, the full text was not readable)',
    native_range: 'Pakistan, India, Bangladesh, Nepal, Myanmar',
  },
  the_one_observed_courtship_site: {
    depth_cm: [3, 10],
    substrate: 'muddy',
    cover: 'dense vegetation at the edge of a stream crossing grazed land',
    temperature_C: 27.5,
    temperature_of_the_main_stream_C: 25.9,
    why_this_matters: 'this is the single most scene-relevant measurement available: the only wild courtship bout anyone recorded, with its depth, substrate and temperature. Note the margin was 1.6 C warmer than the stream it sat beside - the fish were in the warm shallow edge, not the channel.',
    source: 'Sundin et al. 2019, Zebrafish, doi 10.1089/zeb.2019.1778',
    caveat: 'courtship was observed; SPAWNING was not. One bout, one site, one October.',
  },
  depth_range_cm: { value: [0, 60], what: 'from surface level down to 60 cm across the field literature', source: 'Alestrom et al. 2019, Lab Anim, doi 10.1177/0023677219869037' },
  substrate: { value: 'a wide range of bottom substrates, primarily silt', source: 'Alestrom et al. 2019', variants: 'silty agricultural drain, small gravel and sand off a slow stream, rocky river, silty-muddy side-pool (Roy & Bhat 2018, doi 10.1098/rsos.170978)' },
  turbidity_NTU: { value: [2.03, 20.90], n_sites: 12, source: 'Morgan et al. 2019, Conserv Physiol, doi 10.1093/conphys/coz036, Table 1' },
  temperature_C: {
    measured_at_occupied_sites: [24.5, 34.9],
    hottest_occupied: { value: 35.3, where: 'an unvegetated, fully sun-exposed shallow pond on a sand bank, holding a shoal of about 100 fish' },
    avoided: { value: 37.2, where: 'an adjacent connected pond - no fish observed' },
    literature_range: [12.3, 38.6],
    source: 'Morgan et al. 2019 and Sundin et al. 2019',
    the_point: 'the measured occupied range runs past BOTH ends of the 25-33 C window where the developmental clock was validated.',
  },
  chemistry: {
    conductivity_uS_cm: [62.3, 218.0],
    pH: { value: [7.1, 7.6], n_sites: 5, caveat: 'measured at 5 of 12 sites only' },
    dissolved_oxygen_mg_L: { value: [3.92, 8.92], n_sites: 5, caveat: 'measured at 5 of 12 sites only' },
    hardness: null,
    hardness_why: 'NOT SOURCED for the wild. The only figure available is an aquarium-keeping value, which is not a field measurement.',
    source: 'Morgan et al. 2019 Table 1 / Sundin et al. 2019 Table 1, 12 sites in North West Bengal, 26-28 October 2016',
  },
  flow: { value: 'slow to still', numeric: null, why_no_number: 'the only source with measured velocity classes contradicts itself between its results and its conclusions, so no number is carried. Qualitative descriptions across the literature agree on "shallow, slow-flowing" and "still pools".' },
  spawning: {
    time_of_day: { value: 'near daybreak', source: 'Parichy 2015', caveat: 'qualitative in every source. The exact lag between light onset and first spawning is NOT published as a measured number.' },
    season: { value: 'primarily the summer monsoons, when ephemeral pools appear; recorded April to August, extended to October by an observed late-October courtship', source: 'Parichy 2015; Sundin et al. 2019' },
    mode: { value: 'group spawners and egg scatterers; females are choosy about oviposition sites and males defend territories around them', source: 'Spence et al. 2008, Biol Rev 83:13-34, doi 10.1111/j.1469-185X.2007.00030.x - ABSTRACT ONLY, the full text was not readable in this run' },
    trigger: { value: 'shallow water. A laboratory breeding vessel works by raising a platform so the depressions are 12.7 mm deep, which "immediately triggers spawning behavior" - the mechanical link between the wild shallow margin and the dish', source: 'Adatto et al. 2011, PLoS One 6:e21715, doi 10.1371/journal.pone.0021715' },
  },
  the_eggs: {
    fate: 'shed a few at a time and settling freely rather than adhering to the bottom - demersal and non-adhesive',
    parental_care: 'NONE. Nonguarding egg scatterers.',
    eaten_by_the_parents: 'yes - standard laboratory equipment exists specifically to prevent it, with mesh-floored mating inserts that let embryos fall through "while protecting them from cannibalization by adults"',
    survival_rate: null,
    survival_rate_why_null: 'NOT PUBLISHED. The standard reference states that the impact of competition and predation on the survival and reproduction of wild zebrafish remains "entirely unknown". Any number in a scene here would be invented.',
    predators: 'named likely predators of ADULTS include snakehead fish, knifefish, catfish and dragonfly larvae. For eggs and larvae the literature offers only "a great many species probably eat zebrafish eggs and larvae", which its author marks as speculation.',
    source: 'FishBase reproduction record (Riehl & Baensch 1991; Breder & Rosen 1966); Adatto et al. 2011; Parichy 2015',
  },
  default_temperature_C: 27.5,
  default_temperature_why: 'the measured temperature at the one observed wild courtship site - the most defensible single number for "where the eggs were laid".',
};

export const DISH = {
  id: 'dish',
  what: 'a 9 cm Petri dish in a 28.5 C incubator',
  vessel: { value: 'up to 100 embryos in 35 ml in a 9 cm Petri dish', source: 'Alestrom et al. 2019', alternatives: '25 embryos per 35 mm dish if the water is changed daily, which the standard handbook notes is NOT optimal for growth; 15-25 embryos in 100 ml in a 250 ml beaker is better' },
  medium: {
    name: 'E3',
    composition_mM: { NaCl: 5, KCl: 0.17, CaCl2: 0.33, MgSO4: 0.33 },
    source: 'as printed in Seli et al. 2024, Int J Mol Sci 25:4104, doi 10.3390/ijms25074104',
    caveat: 'E3 is NOT in the standard handbook\'s recipe chapter, and published variants DISAGREE about the magnesium salt (sulfate against chloride hexahydrate). The usual attributed origin is a 2002 textbook whose text was not readable in this run. State which variant a scene uses.',
    handbook_alternative: { name: 'Embryo Medium (Hank\'s-based)', composition_mM: { NaCl: 13.7, KCl: 0.54, MgSO4: 1.0, CaCl2: 1.3, Na2HPO4: 0.025, KH2PO4: 0.044, NaHCO3: 4.2 }, pH: 7.2, source: 'The Zebrafish Book 4th ed. (volumetric), with the millimolar values independently matching those published in Avdesh et al. 2012, doi 10.3791/4196' },
  },
  methylene_blue: { value: '0.5 mg/l', why: 'to reduce fungal infections', source: 'Alestrom et al. 2019', note: 'absent from the standard handbook\'s recipes, which uses a dilute bleach wash against mould instead - and warns that bleaching can toughen the chorion.' },
  temperature_C: { value: 28.5, tolerance: 0.5, why: 'the staging standard and "the best temperature for growth and for accurate staging"; embryos survive 24-33 C', source: 'Kimmel et al. 1995; The Zebrafish Book 4th ed.; Alestrom et al. 2019' },
  light_cycle: { value: '14 h light : 10 h dark', source: 'The Zebrafish Book 4th ed.; Avdesh et al. 2012', note: 'a complete dark period matters for reproductive performance; facility light intensity is 54-334 lux at the tank front (Alestrom et al. 2019).' },
  chemistry: { conductivity_uS_cm: [150, 1700], pH: [6.5, 8.0], hardness_dGH: [3, 8], source: 'Alestrom et al. 2019' },
  hatching: { value: 'asynchronous, sporadically through the whole third day (48-72 h) and occasionally later', source: 'Kimmel et al. 1995', note: 'the staging paper says outright that hatching "is not useful as a staging index", so it must not drive a clock.' },
  dechorionation: { value: 'optional, not standard. Most procedures are easier with the chorion removed, and dechorionated embryos develop normally without it.', source: 'The Zebrafish Book 4th ed., Ch. 4.1' },
  default_temperature_C: 28.5,
};

export const ENVIRONMENTS = [DISH, WILD];

/** What actually differs, as numbers rather than atmosphere. */
export function contrast() {
  return {
    temperature: { dish: DISH.default_temperature_C, wild: WILD.default_temperature_C, wild_measured_range: WILD.temperature_C.measured_at_occupied_sites,
      consequence: 'the clock runs at a different speed. staging.rateAt() gives the factor, and flags the wild end as extrapolated beyond the law\'s validated window.' },
    conductivity: { dish_uS_cm: DISH.chemistry.conductivity_uS_cm, wild_uS_cm: WILD.chemistry.conductivity_uS_cm,
      consequence: 'wild water is substantially LESS conductive than facility water - the field paper notes explicitly that wild conductivity was lower than what is commonly used in zebrafish facilities. The dish is not a neutral version of the wild; it is saltier.' },
    turbidity: { dish: 'clear by construction', wild_NTU: WILD.turbidity_NTU.value, consequence: 'anything seen through wild water is seen through 2 to 21 NTU of silt. A perfectly clear wild scene is a choice, and should be labelled as one.' },
    predation: { dish: 'none', wild: 'present but UNQUANTIFIED - see WILD.the_eggs.survival_rate_why_null' },
    parental_care: { dish: 'the parents are removed; mesh floors stop them eating the eggs', wild: 'none, and the adults eat the eggs' },
    validated_clock: { dish: 'inside the 25-33 C window where the developmental law was validated', wild: 'OUTSIDE it at both ends of the measured occupied range' },
  };
}

export function environment(id) { return ENVIRONMENTS.find(e => e.id === id) ?? null; }
