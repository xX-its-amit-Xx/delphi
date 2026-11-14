export const meta = {
  name: 'delphi-six-tracks',
  description: 'Sift the Buehler corpus, explore four paper tracks plus flying fish, and scope a printable biomaterial for the contracting route',
  phases: [
    { title: 'Corpus', detail: '12 agents classify 795 Buehler works against the six tracks' },
    { title: 'Tracks', detail: 'per track: scout candidates, map Lean laws, design a freeze-and-test' },
    { title: 'Materials', detail: 'chemistry, physics, Formlabs, partner, IP and adjacent-lab specialists' },
  ],
}

const REPO = 'D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci'
const LEAN = 'D:/Users/ashenoy00000/delphi-work/upstream/leanbio'
const OUT = 'D:/Users/ashenoy00000/delphi-work/agents'

const RULES = `
RULES THAT APPLY TO EVERYTHING YOU RETURN
1. Skip-if-done: your output file is ${OUT}/<your label>.json. If it already exists and parses as complete JSON for this task, return its contents and stop. Otherwise, when you finish, write your structured result there (create the folder if needed) AND return it.
2. Do NOT write, edit or commit anything inside ${REPO} or ${LEAN}. Read only. Scratch files go under ${OUT}/scratch/<your label>/.
3. Every citation must carry a DOI or arXiv id that YOU fetched and saw resolve in this run (e.g. https://api.crossref.org/works/<doi>, https://export.arxiv.org/api/query?id_list=<id>, Europe PMC, or the publisher page). Set verified=true only then. If you could not fetch it, set verified=false. Never supply a DOI from memory as verified. A shorter list of real citations beats a longer list with one invented entry.
4. Every number must say where it came from: a fetched page (give the URL), a file you read (give the path), or your own calculation (show it). No number from memory presented as a finding; if you must use background knowledge, label it "unverified background".
5. A frozen holdout applies to this project: do NOT use, cite or mention [held-out clade] or any [held-out clade] species, their anatomy, or [held-out clade] flight literature anywhere in your output, even where it would be the natural comparison. Use fish, mammals, insects, plants, seeds, engineered gliders instead.
6. Send no personal identifiers (names, emails, account ids) to any outside service. Use a generic User-Agent. Do not sign up for anything, accept terms, or download files over 20 MB.
7. Say plainly what you could not find or could not verify. An honest gap is a result.
`

// ---------------------------------------------------------------- phase 1: the corpus
const N_WORKS = 795, BATCHES = 12
const per = Math.ceil(N_WORKS / BATCHES)
const batches = Array.from({ length: BATCHES }, (_, i) => ({ i, from: i * per, to: Math.min(N_WORKS, (i + 1) * per) }))

const CORPUS_SCHEMA = {
  type: 'object',
  properties: {
    batch: { type: 'integer' },
    works_read: { type: 'integer' },
    relevant: { type: 'array', items: { type: 'object', properties: {
      doi: { type: 'string' }, openalex: { type: 'string' }, title: { type: 'string' }, year: { type: 'integer' },
      venue: { type: 'string' },
      tracks: { type: 'array', items: { type: 'integer' } },
      relevance: { type: 'integer' },
      theme: { type: 'string' },
      why: { type: 'string' },
      quote_from_abstract: { type: 'string' },
      has_abstract: { type: 'boolean' },
    }, required: ['title', 'year', 'tracks', 'relevance', 'theme', 'why', 'has_abstract'] } },
    themes_seen: { type: 'array', items: { type: 'object', properties: { theme: { type: 'string' }, count: { type: 'integer' } }, required: ['theme', 'count'] } },
    notes: { type: 'string' },
  },
  required: ['batch', 'works_read', 'relevant', 'themes_seen'],
}

const corpusPrompt = (b) => `You are classifying part of Markus J. Buehler's bibliography for a research programme.

Read ${REPO}/tracks/research/corpus/buehler.json. It has a "works" array of ${N_WORKS} records sorted newest first. Your batch is works[${b.from}:${b.to}] (Python slice). Read EVERY record in your batch: title, year, venue, authors, abstract (may be null), concepts.

The programme has six tracks:
 1 = a single gene circuit: shifting a reporter's dose-response
 2 = microbial self-organisation: spatial patterns
 3 = multicellular tissue morphology: lumen geometry and shape
 4 = organism-scale design: a fin or body constraint model validated with a passive glide surrogate (physical model)
 5 = a NEW BIOMATERIAL whose design is constrained by formal laws of morphology and mechanics, printable on a Formlabs resin or SLS printer as a proof of concept, pitched to an architecture practice. THIS IS THE MOST IMPORTANT TRACK FOR THIS CORPUS.
 6 = the existing flying-fish evaluation framework: formal (Lean 4) laws used to eliminate designs; knowledge graphs; agentic discovery; category theory for science.

For each work that is relevant to at least one track, return an entry. relevance is 1-5 (5 = directly usable: it states a design rule, a measured property, a printed/fabricated demonstration, a formal framework, or a method we would reuse). Be generous for track 5 and 6; most of this corpus is materials. theme is a short label you choose and reuse (e.g. "silk", "collagen/bone", "nacre-like printed composite", "category theory / ologs", "generative AI for materials", "fracture", "mycelium / living material", "hygromorph / stimulus-response", "architected lattice", "protein design").

STRICT: work only from the record in the file. quote_from_abstract must be copied verbatim from that record's abstract (max 40 words) and should be the sentence carrying the most concrete claim or number; leave it empty when the abstract is null. Do not add facts about a paper from memory. Do not look anything up online for this task.

Also return themes_seen: every theme you used, with how many works in your batch fall in it, INCLUDING works you judged irrelevant (give those a theme too, e.g. "sonification", "editorial").
Your label is corpus-${String(b.i).padStart(2, '0')}.
${RULES}`

// ---------------------------------------------------------------- phase 2: the tracks
const TRACKS = [
  { n: 1, slug: 'reporter', title: 'Shifting a reporter\'s response (single biological circuit)',
    loop: 'pick ONE circuit, compose the model, freeze it, test it',
    want: 'a small, well-characterised synthetic or natural gene circuit with a fluorescent reporter where a design change predictably SHIFTS the dose-response (threshold EC50, Hill slope, dynamic range) and where public quantitative data exist to test a frozen prediction without new wet-lab work. Think: inducible promoters, toggle switches, feed-forward loops, CRISPRi tuning, optogenetic circuits, ribosome-binding-site libraries, promoter libraries with measured transfer functions.',
    laws: 'gene-regulatory-dynamics, Hill-type input-output, anything on monotone systems; and what is MISSING' },
  { n: 2, slug: 'patterns', title: 'Changes in spatial patterns (microbial self-organisation)',
    loop: 'agree the phenotype, connect the mechanisms, test a NEW condition',
    want: 'a microbial self-organisation system with a quantifiable spatial phenotype (pattern wavelength, ring spacing, sector count, colony morphology, front speed) where a mechanistic model predicts how the pattern changes under a condition not used to fit it, with public image or measurement data. Think: synthetic Turing or band-forming E. coli, range expansion sectoring, biofilm wrinkling, chemotactic bands, quorum-sensing stripes, Bacillus colony morphologies.',
    laws: 'Turing.lean (pattern wavelength, instability conditions), reaction-diffusion, Fisher-KPP front speed, cell geometry and Plateau laws' },
  { n: 3, slug: 'lumen', title: 'Changes in lumen geometry (multicellular tissue morphology)',
    loop: 'start from AVAILABLE data, reproduce morphogenesis, test ONE shape prediction',
    want: 'a lumen-forming multicellular system with public quantitative imaging or measurements (MDCK cysts, epithelial organoids, zebrafish Kupffer\'s vesicle or inner ear or gut, blastocoel, mammary or pancreatic acini, bile canaliculi) where lumen shape or size follows from a physical law (Laplace pressure, osmotic or hydraulic balance, tension, Murray scaling) and one shape prediction can be frozen and tested against data not used to fit.',
    laws: 'physiology-laplace, MurrayCubic.lean, plateau-triple-junction-120, cell geometry, Hydrostatics.lean' },
  { n: 4, slug: 'glide', title: 'A fin or body constraint model in a passive glide surrogate (organism-scale design)',
    loop: 'validate the mechanical model, build a PHYSICAL comparison, review the biological bridge',
    want: 'a passive glide experiment that could be 3D printed and dropped or towed: a fish-like or seed-like body with fins at a controllable aspect ratio, area, and position, where a mechanical model predicts glide ratio, sink rate, or stability, and the prediction can be frozen before the build. Include published physical-model glide studies of flying fish, gliding fish larvae, gliding mammals, gliding snakes, gliding frogs, gliding lizards, and autorotating or gliding seeds (maple samara, Alsomitra/Javan cucumber), with their measured numbers. NO [held-out clade] material.',
    laws: 'Flight.lean, flight-climb-glide-law, aspect-ratio-induced-drag, fin-length-ratio, flight-allometry-law, scaling-area-law, the AFlyingFish certificate and eliminations' },
  { n: 5, slug: 'biomaterial', title: 'A new biomaterial obeying formal laws, printed on Formlabs (contracting route)',
    loop: 'use the Buehler + Marom pipeline and the partner\'s gaps to find a material; print a proof of concept',
    want: 'a concrete, printable, PASSIVE stimulus-responsive or structurally hierarchical material architecture whose geometry is fixed by a formal law (Timoshenko bilayer curvature for hygromorphs, hollow-tube bending efficiency, Murray branching, Plateau junctions, elastic similarity scaling) so the law NARROWS the design space to a few printable candidates and predicts a number we can measure after printing. It should plausibly matter to an architecture practice known for parametric, bio-based, digitally fabricated pavilions (humidity-responsive facade or shading elements, lightweight lattice, self-shaping parts).',
    laws: 'Hygromorphs.lean (Timoshenko bilayer; the category of stimulus-response systems), HollowTube.lean, MurrayCubic.lean, Mechanics.lean, Scaling.lean, elastic-similarity, scaling-bending-law' },
  { n: 6, slug: 'flyingfish', title: 'The flying fish and its evaluation framework (existing work, latest law set)',
    loop: 'reuse the elimination framework for the other tracks; keep it on law set 1.6.0',
    want: 'what has CHANGED in the law library since late October 2026 (new modules, the registry and lawsets, certificates such as EliminationsFlier, EliminationsTff, EliminationsPhysiology, the discovered disc-* laws about flying fish fin ratio and wing loading), and exactly how the elimination-certificate pattern (a theorem of the form *_rules_out showing a design violates a law under stated parameters) can be reused by tracks 1-5. Also the published physical and field measurements of flying fish glide performance.',
    laws: 'everything under lean/Delphi/Certificates, lean/registry/laws, lean/registry/lawsets, lean/registry/discovered, CHANGELOG.md' },
]

const CAND = { type: 'object', properties: {
  name: { type: 'string' }, system: { type: 'string' }, phenotype_measured: { type: 'string' },
  why_it_fits: { type: 'string' },
  public_data: { type: 'array', items: { type: 'object', properties: { what: { type: 'string' }, url: { type: 'string' }, licence: { type: 'string' }, size: { type: 'string' }, fetched_ok: { type: 'boolean' } }, required: ['what', 'url', 'fetched_ok'] } },
  the_test: { type: 'string' }, cost_and_time: { type: 'string' }, biggest_risk: { type: 'string' },
  score: { type: 'integer' },
}, required: ['name', 'system', 'phenotype_measured', 'why_it_fits', 'public_data', 'the_test', 'biggest_risk', 'score'] }
const CITE = { type: 'object', properties: {
  authors: { type: 'string' }, year: { type: 'integer' }, title: { type: 'string' }, venue: { type: 'string' },
  doi_or_arxiv: { type: 'string' }, verified: { type: 'boolean' }, how_verified: { type: 'string' }, used_for: { type: 'string' },
}, required: ['authors', 'year', 'title', 'doi_or_arxiv', 'verified', 'used_for'] }

const SCOUT_SCHEMA = { type: 'object', properties: {
  track: { type: 'integer' }, summary: { type: 'string' },
  candidates: { type: 'array', items: CAND }, recommended: { type: 'string' },
  measured_numbers: { type: 'array', items: { type: 'object', properties: { quantity: { type: 'string' }, value: { type: 'string' }, source: { type: 'string' } }, required: ['quantity', 'value', 'source'] } },
  citations: { type: 'array', items: CITE }, could_not_find: { type: 'array', items: { type: 'string' } },
}, required: ['track', 'summary', 'candidates', 'recommended', 'citations', 'could_not_find'] }

const LAW_SCHEMA = { type: 'object', properties: {
  track: { type: 'integer' }, lawset_version: { type: 'string' },
  existing: { type: 'array', items: { type: 'object', properties: {
    file: { type: 'string' }, theorem_or_def: { type: 'string' }, statement_plain: { type: 'string' },
    assumptions_outside_kernel: { type: 'string' }, how_it_constrains_this_track: { type: 'string' },
    registry_id: { type: 'string' }, status: { type: 'string' },
  }, required: ['file', 'theorem_or_def', 'statement_plain', 'how_it_constrains_this_track'] } },
  missing: { type: 'array', items: { type: 'object', properties: {
    law: { type: 'string' }, statement_math: { type: 'string' }, why_needed: { type: 'string' },
    difficulty: { type: 'string' }, source: { type: 'string' },
  }, required: ['law', 'statement_math', 'why_needed', 'difficulty'] } },
  elimination_pattern: { type: 'string' }, changes_since_october: { type: 'array', items: { type: 'string' } },
  sorry_or_axiom_flags: { type: 'array', items: { type: 'string' } },
}, required: ['track', 'existing', 'missing', 'elimination_pattern'] }

const DESIGN_SCHEMA = { type: 'object', properties: {
  track: { type: 'integer' }, chosen: { type: 'string' }, one_paragraph: { type: 'string' },
  model: { type: 'string' },
  frozen_predictions: { type: 'array', items: { type: 'object', properties: {
    id: { type: 'string' }, statement: { type: 'string' }, number: { type: 'string' },
    refuted_if: { type: 'string' }, data_or_measurement: { type: 'string' },
  }, required: ['id', 'statement', 'refuted_if', 'data_or_measurement'] } },
  steps: { type: 'array', items: { type: 'string' } },
  what_is_frozen_and_when: { type: 'string' }, what_would_make_this_a_paper: { type: 'string' },
  risks: { type: 'array', items: { type: 'string' } }, first_week: { type: 'array', items: { type: 'string' } },
  compute_needed: { type: 'string' }, physical_build: { type: 'string' },
}, required: ['track', 'chosen', 'one_paragraph', 'model', 'frozen_predictions', 'steps', 'risks', 'first_week'] }

const scoutPrompt = (t) => `You are the SCOUT for track ${t.n}: ${t.title}.
The loop the team wants to run on this track: ${t.loop}.

Find ${t.want}

Search the open literature and data repositories (Europe PMC REST, Crossref, arXiv, bioRxiv, Zenodo, Dryad, BioStudies/IDR, Figshare, GitHub). Return 3 to 6 candidates ranked by score (1-10), where a high score means: a quantitative phenotype, a mechanistic model that makes a number, PUBLIC data you actually fetched (set fetched_ok honestly), and a test doable in weeks not months. For each give the exact test we would run. Collect measured numbers with sources. Recommend ONE and say why in two sentences.
Your label is scout-${t.slug}.
${RULES}`

const lawPrompt = (t) => `You are the LAW MAPPER for track ${t.n}: ${t.title}.

Read the Lean 4 law library at ${LEAN}. Start with README.md, lean/registry/README.md, lean/registry/CHANGELOG.md, lean/registry/lawsets/ (current.json and the file it names), and lean/registry/laws/*.json. Then read the Lean sources most relevant to this track: ${t.laws}. The modules live under lean/Delphi, lean/Delphi/Certificates, lean/ThompsonLaws, lean/DarwinLaws.

Return:
- lawset_version as recorded in the registry.
- existing: every theorem, definition or certificate that constrains this track. Copy theorem names EXACTLY as they appear in the file and give the file path relative to the repo root. State it in plain language, and copy what the file header says is assumed OUTSIDE the kernel. Say concretely how it narrows a design space on this track.
- missing: laws that would have to be formalised for this track to run the "law narrows the design space, experiment tests what is left" loop. Write each as mathematics, say why it is needed, rate difficulty in Lean 4 with Mathlib (easy / moderate / hard) with one reason, and give a source.
- elimination_pattern: read lean/Delphi/Certificates and explain in 5-8 sentences exactly how a *_rules_out certificate is structured, with one real example quoted, and how this track would write its own.
- sorry_or_axiom_flags: grep the files you cite for "sorry", "axiom", "admit", "native_decide" and report every hit with file and line. Report "none found" explicitly if so.
${t.n === 6 ? '- changes_since_october: from CHANGELOG.md, the git log (git -C ' + LEAN + ' log --stat -30) and lawsets, list what is new.' : ''}
Your label is laws-${t.slug}.
${RULES}`

const designPrompt = (t, scout) => `You are the EXPERIMENT DESIGNER for track ${t.n}: ${t.title}.
The loop: ${t.loop}.

A scout has returned these candidates (JSON):
${JSON.stringify(scout).slice(0, 14000)}

Choose ONE (normally the scout's recommendation; override it if another is more testable, and say why). Design the freeze-and-test protocol in the house style of this project, which is PRE-REGISTRATION AS A GIT COMMIT: predictions are written down with numeric refutation thresholds and committed before the data module or the build exists.

Return: the model written out (equations, parameters, which are fitted and on what, which are held out); 3 to 6 frozen predictions each with a number or a direction, an explicit "refuted if" threshold, and the data or measurement that tests it; ordered steps; exactly what is frozen and at which step; what result would make this a paper and what result would be merely confirmatory; the risks; a concrete first week; compute needed (the team has a laptop-class Windows box, Modal credits, and possibly a university GPU cluster); and any physical build (the team can print on Formlabs printers).
Prefer a design where being wrong is informative. Do not design a test that cannot fail.
Your label is design-${t.slug}.
${RULES}`

// ---------------------------------------------------------------- phase 3: materials specialists
const SPEC_SCHEMA = { type: 'object', properties: {
  topic: { type: 'string' }, summary: { type: 'string' },
  findings: { type: 'array', items: { type: 'object', properties: {
    claim: { type: 'string' }, value: { type: 'string' }, source_url_or_path: { type: 'string' }, confidence: { type: 'string' },
  }, required: ['claim', 'source_url_or_path', 'confidence'] } },
  table: { type: 'array', items: { type: 'object', properties: {
    name: { type: 'string' }, fields: { type: 'string' }, source: { type: 'string' },
  }, required: ['name', 'fields', 'source'] } },
  recommendations: { type: 'array', items: { type: 'string' } },
  citations: { type: 'array', items: CITE }, could_not_find: { type: 'array', items: { type: 'string' } },
}, required: ['topic', 'summary', 'findings', 'recommendations', 'citations', 'could_not_find'] }

const SPECIALISTS = [
  { slug: 'formlabs-materials', topic: 'The Formlabs materials library as a design space',
    ask: 'Build a table of the materials currently sold for Formlabs printers (Form 4 / Form 4B / Form 4L SLA resins and Fuse 1+ SLS powders). Fetch formlabs.com material pages and the published technical data sheets. For AT LEAST 12 materials give, in the table row\'s "fields" string as key=value pairs with units: printer family; tensile modulus (green and post-cured if both given); ultimate tensile strength; elongation at break; flexural modulus; heat deflection temperature; Shore hardness for elastomers; water absorption (24 h, %) if published; minimum layer thickness; any bio-based content claim (e.g. Nylon 11); biocompatibility class. Flag which PAIRS of materials differ most in stiffness and in water uptake, because a bilayer needs contrast. Also report whether Formlabs supports multi-material printing in one job, Open Material Mode / third-party resins, and the minimum printable wall and feature size.' },
  { slug: 'partner-architecture', topic: 'Mamou-Mani Architects: what they build, with what, and where the material gaps are',
    ask: 'Research the London practice Mamou-Mani (Arthur Mamou-Mani) and its fabrication arm FabPub. Fetch their site and reputable press. List their major built projects with year, material and fabrication method (e.g. large pavilions, bioplastic PLA installations, timber structures, 3D printed furniture and modules), their stated design philosophy (parametric, circular, bio-based, digital fabrication), their software pipeline (e.g. Grasshopper plugins they authored), and any statements about material limitations, durability, sustainability, fire, moisture, or what they wish materials could do. Then name 3-5 concrete GAPS a law-constrained, printable, stimulus-responsive or hierarchical biomaterial could fill for a practice like this, each tied to a source. Also: what would a credible small proof-of-concept object look like to them (scale, function, aesthetics)?' },
  { slug: 'hygromorph-4d', topic: 'Hygromorphic and 4D-printed self-shaping materials: state of the art and its numbers',
    ask: 'Survey passive humidity- or water-driven shape-changing bilayers and 4D printing: pine cone scale mechanics, wheat awns, seed pods; engineered wood-veneer and printed hygromorphs for architecture (e.g. meteorosensitive pavilions and facades from Stuttgart ICD), 4D printing with hydrogels and with wood-filled filaments, and work from the MIT Self-Assembly Lab. Collect MEASURED numbers: curvature achieved, layer thicknesses and thickness ratio, hygroscopic expansion coefficients, moduli, response time and its scaling with thickness, number of cycles survived, force or blocking moment. Identify what has NOT been done: specifically any vat-photopolymer (SLA/DLP) or SLS hygromorph, and any hygromorph whose design space was narrowed by a formally verified law. Say whether Timoshenko\'s 1925 bimetal formula predicts the measured curvatures and how large the reported errors are.' },
  { slug: 'resin-chemistry', topic: 'Chemistry: which printable photopolymers and powders swell, and by how much',
    ask: 'This is the chemistry question that decides feasibility. For acrylate/methacrylate photopolymer resins of the kind used in desktop SLA, and for polyamide 11/12 SLS powders and TPU: find measured water uptake (% mass at saturation and at 24 h), the linear hygroscopic swelling strain or coefficient of hygroscopic expansion, diffusion coefficient of water, and how modulus changes wet vs dry. Polyamides are known to be hygroscopic; get numbers for PA11 and PA12 from data sheets or papers. Find hydrophilic or hydrogel-forming photopolymers printable on an open SLA machine (PEGDA, HEMA, acrylic acid, urethane acrylates) with their swelling ratios. Conclude: which realistic material pair on ONE Formlabs printer, or bonded from two prints, gives the largest differential hygroscopic strain, and estimate that strain with its source. Also flag chemistry risks: incomplete cure, leaching, creep, hydrolysis, UV ageing.' },
  { slug: 'bilayer-physics', topic: 'Physics: design equations for a printed self-shaping bilayer, beyond the textbook formula',
    ask: 'Derive and state the design equations a printed hygromorph must satisfy, with sources. (a) Timoshenko bilayer curvature as a function of differential strain, thickness ratio m and modulus ratio n; the m that maximises curvature for given n; (b) the response time scaling t ~ h^2 / D for diffusion-limited actuation and what it implies at printable thicknesses of 0.1 to 2 mm with polymer water diffusivities; (c) blocking force or moment and work density; (d) the Gaussian-curvature / geometric-incompatibility limit for plates versus strips (when a bilayer plate cannot bend in two directions and how strip width matters); (e) how anisotropy or printed stiffener patterns (ribs, slits, lattice infill) steer bending direction, as in pine cone scales and seed pods; (f) buckling and creep limits. Then compute, with the arithmetic shown, a small table of predicted radius of curvature for bilayer strips 40 mm long, total thickness 0.4, 0.8 and 1.6 mm, at differential strains of 0.2 %, 0.5 %, 1 % and 2 %, for modulus ratio 1 and 10 at the optimal thickness ratio. State what measurement resolution would be needed to distinguish the law\'s prediction from a 20 % error.' },
  { slug: 'architecture-gaps', topic: 'Gaps in bio-based and biomaterials for architecture in 2025-2026',
    ask: 'Survey the current state and unmet needs of bio-based and bio-inspired materials in architecture and construction: mycelium composites, bioplastics (PLA, PHA), engineered timber, bacterial cellulose, algae- and chitosan-based materials, living building materials, and passive climate-responsive building skins. For each give maturity, measured mechanical and durability numbers where published, and the main reason it is not widely used (moisture, fire rating, creep, cost, certification, scale). Identify where PASSIVE responsiveness (no power, no sensors, no actuators) has a real building-performance case, with any measured energy or comfort numbers. Finish with the 5 gaps most addressable by a small team that can design computationally and print on desktop SLA/SLS machines, ranked.' },
  { slug: 'ip-landscape', topic: 'Patents and prior art around law-constrained, printed stimulus-responsive architectural materials',
    ask: 'The team was told an investor may want to "license your patent". Scope the landscape at a high level, not as legal advice. Search Google Patents and the literature for: humidity-responsive / hygromorphic building elements; 4D-printed self-shaping structures; bilayer actuators made by additive manufacturing; computational design methods for self-shaping materials; and methods that use formal verification or theorem provers to constrain a material or product design space. List the most relevant patent families (number, assignee, year, one-line claim scope) and the closest academic prior art. Say what appears crowded and what appears open, and what KIND of thing could plausibly be novel here (a material composition, a geometry, a design-and-verification method, a certified design file format). Be explicit that this is a preliminary scan.' },
  { slug: 'marom-buehler-deep', topic: 'Deep read: Marom, Tibbits, Zardini and Buehler 2026 (JMPS) and Marom and Buehler 2025 (MRS Bulletin)',
    ask: 'Read arXiv:2604.26367 in full (fetch the abstract page and the HTML or PDF full text), and the code repository github.com/lamm-mit/CategoryTheoryDesign (README and source tree). Also fetch what is public of doi:10.1557/s43577-025-00987-8. Also list Lee Marom\'s other publications via Crossref or arXiv author search. Report precisely: the category the paper defines (objects, morphisms, what "preserve dynamics" means), which biological systems it treats (pine cone scales, wheat awns, seed pods, the Venus flytrap) and the governing equation and PARAMETER VALUES used for each, what is proved by construction versus left to experiment, the engineered systems it designs and whether anything was physically fabricated or measured, every quantitative result, and its stated limitations and future work. Then read ' + LEAN + '/lean/ThompsonLaws/Hygromorphs.lean and say exactly which of the paper\'s statements are already machine-checked there and which are not. Finally: what would the authors most want from a Lean-verified, printed demonstration, and what would make a joint paper with them novel rather than a restatement?' },
  { slug: 'levin-bioelectric', topic: 'Levin lab: xenobots, bioelectricity, and an optogenetic, hands-off variant',
    ask: 'The brief mentions Michael Levin, a nonprofit in bioelectricity, and "an optogenetic version of xenobots (no imaging or direct interaction)" where "light sensors trigger movements", with the aim of describing something "from genome to locomotion" in a .life design file and validating it computationally. Survey: the xenobot papers (design by evolutionary algorithm, cilia-driven locomotion, kinematic self-replication), anthrobots, and any optogenetic control of Xenopus or of ciliated or contractile tissues (channelrhodopsin, bPAC, optogenetic control of ciliary beating or of cardiomyocyte contraction in biobots). Give measured numbers: size, speed, lifetime, cell counts. Explain what an optogenetic, closed-loop-free design would need (which opsin, which effector, what light dose, what locomotion mode) and what can be validated purely computationally today (which simulators exist and are open). Also read ' + REPO + '/organism-format/ (README and the life/ examples) and say what the .life format can already express and what it lacks for this. Identify the bioelectricity nonprofits associated with this area. Keep claims tied to fetched sources.' },
]

const specPrompt = (s) => `You are a specialist reporting on: ${s.topic}.

${s.ask}

Put structured rows in "table" (name + a "fields" string of key=value pairs with units + source URL). Put each discrete factual claim in "findings" with its source and a confidence of high / medium / low.
Your label is spec-${s.slug}.
${RULES}`

// ---------------------------------------------------------------- run
const corpusP = parallel(batches.map(b => () =>
  agent(corpusPrompt(b), { label: `corpus-${String(b.i).padStart(2, '0')}`, phase: 'Corpus', schema: CORPUS_SCHEMA, effort: 'medium' })))

const tracksP = parallel(TRACKS.map(t => () => parallel([
  () => agent(scoutPrompt(t), { label: `scout-${t.slug}`, phase: 'Tracks', schema: SCOUT_SCHEMA })
    .then(sc => sc ? agent(designPrompt(t, sc), { label: `design-${t.slug}`, phase: 'Tracks', schema: DESIGN_SCHEMA })
      .then(d => ({ scout: sc, design: d })) : { scout: null, design: null }),
  () => agent(lawPrompt(t), { label: `laws-${t.slug}`, phase: 'Tracks', schema: LAW_SCHEMA }),
]).then(([sd, laws]) => ({ track: t.n, slug: t.slug, title: t.title, scout: sd ? sd.scout : null, design: sd ? sd.design : null, laws }))))

const specP = parallel(SPECIALISTS.map(s => () =>
  agent(specPrompt(s), { label: `spec-${s.slug}`, phase: 'Materials', schema: SPEC_SCHEMA }).then(r => ({ slug: s.slug, result: r }))))

const [corpus, tracks, specialists] = await Promise.all([corpusP, tracksP, specP])
const got = corpus.filter(Boolean)
log(`corpus: ${got.length}/${BATCHES} batches, ${got.reduce((a, c) => a + c.relevant.length, 0)} relevant works; tracks: ${tracks.filter(Boolean).length}/6; specialists: ${specialists.filter(x => x && x.result).length}/${SPECIALISTS.length}`)
return {
  corpus_batches_returned: got.length, corpus_batches_expected: BATCHES,
  corpus_missing: batches.filter((b, i) => !corpus[i]).map(b => b.i),
  tracks: tracks.map((t, i) => t ? { n: t.track, slug: t.slug, scout: !!t.scout, design: !!t.design, laws: !!t.laws } : { n: TRACKS[i].n, failed: true }),
  specialists: specialists.map((s, i) => ({ slug: SPECIALISTS[i].slug, ok: !!(s && s.result) })),
  out_dir: OUT,
}
