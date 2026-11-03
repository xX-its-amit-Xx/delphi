// Line drawings for the pop-out panel, one per frame slot.
//
// THESE ARE SCHEMATIC. Each is a few hand-written paths meant to say "this is the wing you clicked" in a
// glance, and not one of them is traced from a specimen, scaled to a measurement, or species-specific: the
// same wing outline appears for a fly and for a mouse's proposed membrane. The panel labels them as
// schematic for exactly that reason. The only morphometric geometry in this repository is
// anatomy-model/parametric, which builds one teleost from Park and Choi's measurements.
//
// A slot with no drawing falls back to one per SHAPE, so a part is never shown someone else's picture.
(function () {
  const V = 'viewBox="0 0 200 120" preserveAspectRatio="xMidYMid meet"';

  const SLOT = {
    wing: `<path d="M18 86 C40 44 92 20 168 28 C150 44 128 56 104 64 C76 74 44 80 18 86 Z" class="fillsoft"/>
      <path class="hair" d="M22 84 C56 66 104 50 160 32"/><path class="hair" d="M28 82 C54 72 92 58 140 44"/>
      <path class="hair" d="M40 80 C62 74 90 66 124 54"/><path class="hair" d="M58 76 C76 72 98 66 118 60"/>
      <path class="hair" d="M74 56 C80 64 84 70 86 76"/><path class="hair" d="M100 46 C106 54 110 60 112 66"/>
      <path d="M18 86 C22 92 30 96 40 96"/>`,
    wing_membrane: `<path d="M26 34 L26 94" /><path d="M172 44 L172 86"/>
      <path d="M26 34 C70 24 136 30 172 44 C140 58 140 72 172 86 C136 100 70 106 26 94 C44 74 44 54 26 34 Z" class="fillsoft"/>
      <path class="hair" d="M26 40 C72 36 128 42 168 50"/><path class="hair" d="M30 88 C74 92 128 86 168 80"/>
      <path class="hair" d="M90 30 L92 100"/><path class="hair" d="M126 34 L128 98"/>`,
    eye: `<ellipse cx="100" cy="60" rx="66" ry="40" class="fillsoft"/><circle cx="100" cy="60" r="24"/>
      <circle cx="100" cy="60" r="9"/><path class="hair" d="M34 60 C60 36 140 36 166 60"/>
      <path class="hair" d="M34 60 C60 84 140 84 166 60"/><path class="hair" d="M100 20 L100 100"/>`,
    leg: `<path d="M40 20 L68 48 L56 78 L92 96 L130 92"/><path d="M130 92 L150 100 M130 92 L150 86"/>
      <circle cx="40" cy="20" r="7" class="fillsoft"/><circle cx="68" cy="48" r="5" class="fillsoft"/>
      <circle cx="56" cy="78" r="5" class="fillsoft"/><circle cx="92" cy="96" r="5" class="fillsoft"/>`,
    forelimb: `<path d="M34 26 C52 34 62 48 64 62"/><path d="M64 62 C80 70 96 76 112 78"/>
      <path d="M112 78 L140 70 M112 78 L142 80 M112 78 L138 90 M112 78 L128 98"/>
      <circle cx="34" cy="26" r="8" class="fillsoft"/><circle cx="64" cy="62" r="6" class="fillsoft"/>
      <circle cx="112" cy="78" r="6" class="fillsoft"/>`,
    hindlimb: `<path d="M38 22 C58 32 66 50 62 66 C58 82 72 92 96 94 L134 92"/>
      <path d="M134 92 L158 84 M134 92 L160 94"/><circle cx="38" cy="22" r="8" class="fillsoft"/>
      <circle cx="62" cy="66" r="6" class="fillsoft"/><circle cx="96" cy="94" r="6" class="fillsoft"/>`,
    head: `<path d="M44 60 C44 32 72 18 104 18 C142 18 166 38 166 60 C166 84 142 102 104 102 C72 102 44 88 44 60 Z" class="fillsoft"/>
      <circle cx="128" cy="48" r="11"/><path d="M44 60 C34 58 26 62 22 70"/>
      <path class="hair" d="M60 86 C80 96 120 96 142 84"/>`,
    brain: `<path d="M48 70 C40 46 60 26 92 26 C126 26 152 40 154 62 C156 84 134 96 104 96 C74 96 54 88 48 70 Z" class="fillsoft"/>
      <path class="hair" d="M62 44 C78 56 76 74 62 84"/><path class="hair" d="M92 32 C102 52 98 76 86 92"/>
      <path class="hair" d="M120 34 C128 54 126 76 114 94"/><path d="M48 70 C44 84 54 96 72 98"/>`,
    heart: `<path d="M100 100 C60 76 44 58 44 44 C44 28 58 20 72 24 C84 27 94 38 100 48 C106 38 116 27 128 24 C142 20 156 28 156 44 C156 58 140 76 100 100 Z" class="fillsoft"/>
      <path class="hair" d="M72 36 C84 46 92 58 98 70"/>`,
    gut: `<path d="M30 28 C78 20 90 44 60 54 C28 64 42 90 92 86 C140 82 150 56 170 44" class="fillsoft"/>
      <path class="hair" d="M34 34 C74 28 84 46 60 56"/>
      <path class="hair" d="M44 86 C70 94 118 90 142 72"/>`,
    lung: `<path d="M96 22 L96 48"/><path d="M96 48 C78 40 54 46 48 66 C42 88 58 102 78 98 C94 94 96 72 96 48 Z" class="fillsoft"/>
      <path d="M96 48 C114 40 138 46 144 66 C150 88 134 102 114 98 C98 94 96 72 96 48 Z" class="fillsoft"/>
      <path class="hair" d="M84 56 L70 78 M108 56 L122 78"/>`,
    liver: `<path d="M26 44 C60 26 140 26 172 46 C168 76 130 96 96 94 C62 92 32 72 26 44 Z" class="fillsoft"/>
      <path class="hair" d="M96 30 L96 92"/>`,
    kidney: `<path d="M74 24 C106 24 124 42 124 62 C124 84 104 98 82 94 C66 90 62 76 72 66 C80 58 78 46 66 42 C58 38 62 26 74 24 Z" class="fillsoft"/>`,
    muscle: `<path d="M24 60 C52 34 148 34 176 60 C148 86 52 86 24 60 Z" class="fillsoft"/>
      <path class="hair" d="M50 44 L50 76 M72 38 L72 82 M100 36 L100 84 M128 38 L128 82 M150 44 L150 76"/>`,
    flight_muscle: `<path d="M30 30 L170 30 M30 90 L170 90"/>
      <path d="M44 30 L44 90 M68 30 L68 90 M92 30 L92 90 M116 30 L116 90 M140 30 L140 90 M158 30 L158 90"/>
      <path class="hair" d="M30 60 L170 60"/>`,
    skin: `<path d="M20 36 L180 36 M20 56 L180 56 M20 86 L180 86"/>
      <path class="hair" d="M30 36 L30 56 M58 36 L58 56 M86 36 L86 56 M114 36 L114 56 M142 36 L142 56 M168 36 L168 56"/>
      <path class="hair" d="M40 56 C44 70 40 80 36 86 M80 56 C84 70 80 80 76 86 M124 56 C128 70 124 80 120 86"/>`,
    cuticle: `<path d="M20 40 C56 28 144 28 180 40"/><path d="M20 58 C56 46 144 46 180 58"/>
      <path class="hair" d="M48 40 L48 58 M86 36 L86 54 M124 36 L124 54 M158 40 L158 58"/>
      <path d="M62 66 L58 92 M106 64 L106 94 M150 66 L154 92"/>`,
    skeleton: `<path d="M100 18 L100 96"/><path d="M100 30 C72 36 56 52 50 70 M100 30 C128 36 144 52 150 70"/>
      <path class="hair" d="M100 46 C82 50 70 60 64 74 M100 46 C118 50 130 60 136 74"/>
      <path class="hair" d="M100 62 C88 66 80 74 76 84 M100 62 C112 66 120 74 124 84"/>
      <circle cx="100" cy="18" r="7" class="fillsoft"/>`,
    nerve_cord: `<path d="M24 60 L176 60"/><circle cx="52" cy="60" r="10" class="fillsoft"/>
      <circle cx="98" cy="60" r="10" class="fillsoft"/><circle cx="144" cy="60" r="10" class="fillsoft"/>
      <path class="hair" d="M52 70 L46 92 M52 50 L46 28 M98 70 L92 92 M98 50 L92 28 M144 70 L138 92 M144 50 L138 28"/>`,
    spinal_cord: `<path d="M20 50 L180 50 M20 66 L180 66"/>
      <path class="hair" d="M46 66 L40 92 M46 50 L40 26 M100 66 L94 92 M100 50 L94 26 M154 66 L148 92 M154 50 L148 26"/>`,
    trachea: `<path d="M100 20 L100 54"/><path d="M100 54 L56 92 M100 54 L144 92"/>
      <path class="hair" d="M56 92 L38 104 M56 92 L62 108 M144 92 L162 104 M144 92 L138 108"/>
      <circle cx="100" cy="20" r="6" class="fillsoft"/>`,
    gill: `<path d="M40 20 C40 60 40 80 40 100"/>
      <path d="M40 28 C80 30 120 36 160 44 M40 44 C80 46 120 52 160 60 M40 60 C80 62 120 68 160 76 M40 76 C80 78 120 84 160 92"/>`,
    antenna: `<path d="M30 100 C50 70 70 46 100 34 C124 24 148 24 170 30"/>
      <path class="hair" d="M96 36 L92 22 M116 30 L114 16 M136 26 L136 12"/>
      <circle cx="30" cy="100" r="7" class="fillsoft"/>`,
    mouthpart: `<path d="M70 20 L70 64 C70 84 86 96 100 96 C114 96 130 84 130 64 L130 20"/>
      <path class="hair" d="M86 24 L86 70 M100 22 L100 78 M114 24 L114 70"/>`,
    tail: `<path d="M24 54 C70 50 120 56 170 74"/><path d="M24 66 C70 64 118 70 166 86"/>
      <path class="hair" d="M60 52 L58 64 M100 56 L98 68 M140 64 L138 78"/>`,
    gonad: `<ellipse cx="100" cy="60" rx="48" ry="34" class="fillsoft"/>
      <circle cx="84" cy="52" r="8"/><circle cx="110" cy="64" r="10"/><circle cx="96" cy="76" r="6"/>`,
    fat_body: `<path d="M34 60 C34 38 58 26 86 30 C112 34 118 48 140 48 C164 48 174 64 164 80 C152 98 56 96 40 80 C33 72 34 66 34 60 Z" class="fillsoft"/>
      <circle cx="70" cy="56" r="9"/><circle cx="100" cy="66" r="11"/><circle cx="132" cy="62" r="8"/>`,
    flagellum: `<path d="M26 40 C26 28 52 28 52 40 L52 80 C52 92 26 92 26 80 Z" class="fillsoft"/>
      <path d="M52 60 C70 36 84 84 102 60 C120 36 134 84 152 60 C164 44 172 54 178 60"/>
      <path class="hair" d="M40 40 L40 80"/>`,
    cell_body: `<path d="M44 60 C44 40 62 30 100 30 C138 30 156 40 156 60 C156 80 138 90 100 90 C62 90 44 80 44 60 Z" class="fillsoft"/>
      <path class="hair" d="M62 48 C84 42 116 42 138 48"/>`,
    envelope: `<path d="M38 60 C38 38 60 26 100 26 C140 26 162 38 162 60 C162 82 140 94 100 94 C60 94 38 82 38 60 Z"/>
      <path class="hair" d="M46 60 C46 42 64 32 100 32 C136 32 154 42 154 60 C154 78 136 88 100 88 C64 88 46 78 46 60 Z"/>
      <path class="hair" d="M54 60 C54 46 70 38 100 38 C130 38 146 46 146 60 C146 74 130 82 100 82 C70 82 54 74 54 60 Z"/>`,
    nucleoid: `<path d="M44 60 C60 34 96 34 100 60 C104 86 140 86 156 60"/>
      <path d="M44 72 C60 46 96 46 100 72 C104 98 140 98 156 72" class="hair"/>
      <path class="hair" d="M56 50 L58 66 M84 44 L82 60 M118 60 L120 76 M146 54 L148 70"/>`,
    ribosome: `<circle cx="70" cy="56" r="16" class="fillsoft"/><circle cx="70" cy="76" r="11" class="fillsoft"/>
      <circle cx="124" cy="52" r="16" class="fillsoft"/><circle cx="124" cy="72" r="11" class="fillsoft"/>
      <path d="M24 64 L176 68" class="hair"/>`,
    carboxysome: `<path d="M100 22 L142 46 L142 94 L100 118 L58 94 L58 46 Z" class="fillsoft"/>
      <path class="hair" d="M100 22 L100 70 M100 70 L142 94 M100 70 L58 94"/>
      <circle cx="100" cy="70" r="7"/>`,
    storage_granule: `<circle cx="78" cy="58" r="26" class="fillsoft"/><circle cx="124" cy="72" r="18" class="fillsoft"/>
      <path class="hair" d="M66 48 C74 54 80 62 84 72"/>`,
    membrane_complex: `<path d="M20 44 L180 44 M20 76 L180 76"/>
      <path d="M62 36 L62 84 L98 84 L98 36 Z" class="fillsoft"/>
      <path d="M126 36 L126 84 L154 84 L154 36 Z" class="fillsoft"/>
      <path class="hair" d="M80 28 L80 36 M140 28 L140 36 M80 84 L80 94 M140 84 L140 94"/>`,
    surface: `<path d="M20 78 C60 66 140 66 180 78"/>
      <path d="M32 74 C28 56 24 44 22 32" /><path d="M54 70 C52 52 50 40 48 28"/>
      <path d="M78 68 C78 50 78 38 78 26"/><path d="M102 67 C104 49 106 37 108 25"/>
      <path d="M126 68 C130 50 134 38 138 28"/><path d="M150 71 C156 54 162 42 168 32"/>
      <path class="hair" d="M20 88 C60 78 140 78 180 88"/>`,
    interior: `<circle cx="100" cy="60" r="44" class="fillsoft"/>
      <circle cx="84" cy="50" r="11"/><circle cx="112" cy="58" r="13"/><circle cx="92" cy="78" r="9"/>
      <circle cx="118" cy="82" r="7"/>`,
    contractile: `<path d="M26 60 C54 40 146 40 174 60 C146 80 54 80 26 60 Z" class="fillsoft"/>
      <path d="M54 48 L54 72 M80 44 L80 76 M106 44 L106 76 M132 48 L132 72"/>`,
    thorax: `<path d="M40 60 C40 34 62 22 100 22 C138 22 160 34 160 60 C160 86 138 98 100 98 C62 98 40 86 40 60 Z" class="fillsoft"/>
      <path class="hair" d="M72 24 L72 96 M100 22 L100 98 M128 24 L128 96"/>`,
    abdomen: `<path d="M30 60 C30 40 56 28 100 28 C150 28 176 42 176 60 C176 78 150 92 100 92 C56 92 30 80 30 60 Z" class="fillsoft"/>
      <path class="hair" d="M62 32 C56 44 56 76 62 88 M96 29 C90 42 90 78 96 91 M132 32 C126 44 126 76 132 88"/>`,
    trunk: `<path d="M26 60 C26 38 56 26 100 26 C148 26 176 38 176 60 C176 82 148 94 100 94 C56 94 26 82 26 60 Z" class="fillsoft"/>
      <path class="hair" d="M60 30 C54 44 54 76 60 90 M100 26 C96 42 96 78 100 94 M140 30 C146 44 146 76 140 90"/>`,
    pectoral_fin: `<path d="M30 92 C54 54 100 26 168 26 C150 46 128 62 102 72 C74 82 50 88 30 92 Z" class="fillsoft"/>
      <path class="hair" d="M34 90 C66 66 112 44 164 28"/><path class="hair" d="M46 86 C72 70 108 52 148 36"/>
      <path class="hair" d="M62 82 C84 72 112 60 140 48"/>`,
    caudal_fin: `<path d="M30 60 L160 20 L130 60 L160 100 Z" class="fillsoft"/>
      <path class="hair" d="M40 58 L150 26 M40 62 L150 94"/>`,
    swim_bladder: `<ellipse cx="100" cy="60" rx="62" ry="30" class="fillsoft"/>
      <path class="hair" d="M38 60 C66 48 134 48 162 60"/>`,
    haltere: `<path d="M34 94 C56 78 78 66 100 58"/><circle cx="118" cy="48" r="20" class="fillsoft"/>
      <path class="hair" d="M106 36 C112 44 116 54 118 66"/>`,
    ear: `<path d="M118 20 C86 22 62 42 60 70 C58 94 74 104 88 98 C100 92 96 76 86 72 C76 68 78 54 92 48 C106 42 120 48 124 62" class="fillsoft"/>`,
    immune: `<circle cx="100" cy="60" r="34" class="fillsoft"/>
      <path class="hair" d="M100 26 L100 94 M66 60 L134 60 M76 36 L124 84 M124 36 L76 84"/>
      <circle cx="100" cy="60" r="10"/>`,
    endocrine: `<circle cx="74" cy="56" r="20" class="fillsoft"/><circle cx="124" cy="66" r="16" class="fillsoft"/>
      <path class="hair" d="M94 56 L104 62"/><circle cx="74" cy="56" r="6"/><circle cx="124" cy="66" r="5"/>`,
    malpighian: `<path d="M40 100 C58 76 54 50 74 34 C90 20 112 24 120 40"/>
      <path d="M52 100 C72 78 70 52 90 38 C106 26 128 30 136 46" class="hair"/>`,
    body: `<path d="M28 60 C28 36 58 22 104 22 C152 22 176 38 176 60 C176 82 152 98 104 98 C58 98 28 84 28 60 Z"/>
      <path class="hair" d="M104 22 L104 98 M28 60 L176 60"/>`,
  };

  // One per shape, for a part no slot drawing covers.
  const SHAPE = {
    sphere: `<circle cx="100" cy="60" r="36" class="fillsoft"/>`,
    blob: `<path d="M38 56 C38 36 62 26 92 30 C118 34 124 46 146 48 C168 50 174 68 160 82 C144 98 56 96 42 80 C36 72 38 62 38 56 Z" class="fillsoft"/>`,
    capsule: `<path d="M44 60 C44 42 58 32 100 32 C142 32 156 42 156 60 C156 78 142 88 100 88 C58 88 44 78 44 60 Z" class="fillsoft"/>`,
    rod: `<path d="M40 86 L150 34"/><path d="M36 92 L44 80 M146 40 L154 28"/>`,
    tube: `<path d="M30 48 C70 38 130 38 170 48"/><path d="M30 72 C70 82 130 82 170 72"/>`,
    blade: `<path d="M26 88 C54 52 102 28 174 30 C150 52 120 68 90 76 C66 82 44 86 26 88 Z" class="fillsoft"/>
      <path class="hair" d="M32 84 C66 62 110 44 166 32"/>`,
    shell: `<path d="M34 60 C34 38 60 26 100 26 C140 26 166 38 166 60 C166 82 140 94 100 94 C60 94 34 82 34 60 Z"/>
      <path class="hair" d="M44 60 C44 44 66 34 100 34 C134 34 156 44 156 60 C156 76 134 86 100 86 C66 86 44 76 44 60 Z"/>`,
    cone: `<path d="M40 92 L160 54 L40 30 Z" class="fillsoft"/>`,
    helix: `<path d="M24 60 C42 34 58 86 76 60 C94 34 110 86 128 60 C146 34 160 86 178 60"/>`,
    frame: `<path d="M40 30 L160 30 L160 90 L40 90 Z"/><path class="hair" d="M40 30 L160 90 M160 30 L40 90"/>`,
    cluster: `<circle cx="78" cy="52" r="13" class="fillsoft"/><circle cx="110" cy="46" r="10" class="fillsoft"/>
      <circle cx="96" cy="74" r="12" class="fillsoft"/><circle cx="126" cy="70" r="9" class="fillsoft"/>
      <circle cx="68" cy="78" r="8" class="fillsoft"/>`,
  };

  window.DRAWINGS = {
    /** inner SVG markup for a slot, falling back to the shape, then to a plain outline. */
    svg(slot, shape) {
      const inner = SLOT[slot] ?? SHAPE[shape] ?? SHAPE.sphere;
      const basis = SLOT[slot] ? `a schematic drawing for the "${slot}" slot` : (SHAPE[shape] ? `no drawing for the "${slot}" slot, so this is the generic "${shape}" shape` : 'no drawing and no shape, so this is a plain outline');
      return { svg: `<svg class="draw" ${V} role="img" aria-label="schematic line drawing of ${slot}">${inner}</svg>`, basis };
    },
    has(slot) { return Boolean(SLOT[slot]); },
    slots: Object.keys(SLOT),
  };
})();
