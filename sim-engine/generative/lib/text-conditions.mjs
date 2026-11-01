// Text -> conditions for the body-level generative model. Rule-based, no LLM (an optional LLM assist lives in
// backends/providers.mjs and its output is re-validated against THIS lexicon). The base organism comes from the
// spec thread's parser (lib/parse-text.mjs parseDesignText().spec.start_from), so both paths agree on what
// "zebrafish" or "70% zebrafish 30% flying fish" means and birds are refused in one place.
//
// An attribute becomes an OBSERVED value for one feature: target = reference family mean + k * (pooled within-family
// SD of that feature), k = +-1 by default, +-2 with "much/far/very", +-0.5 with "slightly/a bit". The model then
// generates the remaining features conditional on it (it learned how they co-vary in 16 123 real teleosts).

export const FEATURE_INDEX = { SL: 0, depth: 1, width: 2, peduncle_depth: 3, peduncle_width: 4, condition_K: 5, head_depth: 6 };

// [regex, feature, sign, label]. Body words only: "larger pectoral fins" must not touch SL.
const ATTRS = [
  [/\b(thicker|deeper|stronger|stouter|broader)[\s-]+(tail\s+stalk|caudal\s+peduncle|peduncle)\b/i, 'peduncle_depth', +1, 'deeper caudal peduncle'],
  [/\b(thinner|narrower|slimmer|shallower)[\s-]+(tail\s+stalk|caudal\s+peduncle|peduncle)\b/i, 'peduncle_depth', -1, 'shallower caudal peduncle'],
  [/\b(deeper|taller|higher)[\s-]+(body|bodied)\b|\bdeep[\s-]?bodied\b|\bdeeper\b(?![\s-]+(water|dive|sea))/i, 'depth', +1, 'deeper body'],
  [/\b(shallower|slenderer|more\s+slender|slender|thinner|elongated?|more\s+elongate)\b(?![\s-]+(fin|fins|peduncle|tail))/i, 'depth', -1, 'more slender / shallower body'],
  [/\bstreamlined\b/i, 'depth', -1, 'streamlined (shallower)'],
  [/\b(wider|broader|fatter|thicker)[\s-]+(body|bodied)\b|\b(wider|broader|fatter)\b(?![\s-]+(fin|fins|tail|peduncle|head|mouth|jaw|snout))/i, 'width', +1, 'wider body'],
  [/\b(narrower|flatter|more\s+compressed|laterally\s+compressed|compressed)\b(?![\s-]+(fin|fins))/i, 'width', -1, 'narrower (more compressed) body'],
  [/\b(heavier|stouter|plumper|chunkier|chunky|robust|fatter)\b(?![\s-]+(fin|fins))/i, 'condition_K', +1, 'heavier for its length (Fulton K)'],
  [/\b(lighter|leaner|lightweight)\b(?![\s-]+(fin|fins))/i, 'condition_K', -1, 'lighter for its length (Fulton K)'],
  [/\b(larger|bigger|longer)[\s-]+(body|fish|overall|animal)\b|\b(larger|bigger)\s+(?=(flying\s*fish|zebra\s*fish|fish)\b)/i, 'SL', +1, 'larger (longer) fish'],
  [/\b(smaller|shorter|tinier)[\s-]+(body|fish|overall|animal)\b|\b(smaller|shorter)\s+(?=(flying\s*fish|zebra\s*fish|fish)\b)/i, 'SL', -1, 'smaller (shorter) fish'],
];
const STRONG = /\b(much|far|very|considerably|greatly|dramatically|substantially)\b/i;
const WEAK = /\b(slightly|a\s+bit|a\s+little|somewhat|marginally|mildly)\b/i;

// Traits that are NOT in the training data: named, never silently dropped.
const NOT_IN_DATA = [
  [/\b(pectoral|pelvic|dorsal|anal|caudal)\s+fins?\b|\bwings?\b|\bfins?\b|\btail\s+lobes?\b/i, 'fin size or shape: FishShapes v1 has no fin measurements, so the body model cannot generate fins. Use organism_edit (or design_from_spec editable ranges) for fin parameters.'],
  [/\bhead\b|\bsnout\b|\bjaw\b|\bmouth\b/i, 'head length / jaw: FishShapes has head DEPTH and jaw length, but the parametric builder has no head-depth or jaw parameter; head_fraction_SL (head length) is not measured there.'],
  [/\bgills?\b|\bheart\b|\bliver\b|\bswim\s*bladder\b|\bmuscle\b|\bbrain\b|\bgut\b/i, 'organ traits: not body-level; the organ backend has no training data for the studio organisms (see generative/README.md).'],
];

// Common names -> FishShapes families, for "tuna-like", "shaped like a cichlid". Only families present in the model
// are honoured; the rest are reported.
export const COMMON_FAMILY = [
  [/\btuna|mackerel|bonito\b/i, 'Scombridae'], [/\bcarp|minnow|barb|danio|goldfish\b/i, 'Cyprinidae'], [/\bcichlids?\b/i, 'Cichlidae'],
  [/\bsalmon|trout|char\b/i, 'Salmonidae'], [/\beels?\b/i, 'Anguillidae'], [/\bpuffer(fish)?\b/i, 'Tetraodontidae'],
  [/\bangelfish\b/i, 'Pomacanthidae'], [/\bneedlefish\b/i, 'Belonidae'], [/\bhalfbeaks?\b/i, 'Hemiramphidae'],
  [/\bflying[\s-]?fish\b/i, 'Exocoetidae'], [/\bgob(y|ies)\b/i, 'Gobiidae'], [/\bwrasses?\b/i, 'Labridae'],
  [/\bdamselfish\b/i, 'Pomacentridae'], [/\bgroupers?\b/i, 'Serranidae'], [/\bperch(es)?\b/i, 'Percidae'],
  [/\bherrings?|sardines?\b/i, 'Clupeidae'], [/\bsurgeonfish|tang\b/i, 'Acanthuridae'], [/\bbutterflyfish\b/i, 'Chaetodontidae'],
  [/\bkillifish\b/i, 'Fundulidae'], [/\bsticklebacks?\b/i, 'Gasterosteidae'], [/\bcod\b/i, 'Gadidae'], [/\bjacks?|trevall(y|ies)\b/i, 'Carangidae'],
];

/** Find the body attributes, unsupported traits and a shape-family hint in free text. */
export function parseBodyText(text = '') {
  const attributes = []; const not_generated = [];
  const clauses = String(text).split(/[,;]|\band\b|\bwith\b|\bbut\b/i).map(s => s.trim()).filter(Boolean);
  for (const cl of clauses) {
    const k = STRONG.test(cl) ? 2 : WEAK.test(cl) ? 0.5 : 1;
    let hit = false;
    for (const [re, feature, sign, label] of ATTRS) {
      if (re.test(cl) && !attributes.some(a => a.feature === feature)) { attributes.push({ feature, sd_shift: sign * k, label, clause: cl }); hit = true; break; }
    }
    if (hit) continue;
    for (const [re, why] of NOT_IN_DATA) if (re.test(cl)) { not_generated.push({ clause: cl, reason: why }); break; }
  }
  let shape_family = null;
  const like = /\b(\w[\w\s-]*?)[\s-]+(like|shaped)\b|\b(?:shaped\s+)?like\s+an?\s+([\w\s-]+)/i.exec(text);
  if (like) {
    const phrase = like[1] || like[3] || '';
    for (const [re, fam] of COMMON_FAMILY) if (re.test(phrase)) { shape_family = { family: fam, phrase: like[0].trim() }; break; }
  }
  return { attributes, not_generated, shape_family };
}
