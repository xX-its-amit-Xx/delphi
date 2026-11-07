// Adjacent-field lab-in-the-loop candidates for DELPHI. Twelve real people, five field clusters.
//
// A sibling file (outreach/fish-biologists.mjs) covers the fish biologists. This file covers the
// ADJACENT fields and uses the same candidate schema so the two merge.
//
// ============================== THE PRIVACY RULE, FIRST ==============================
// These are real people. Everything below comes from the PUBLIC PROFESSIONAL RECORD ONLY: published
// papers, institutional lab pages, public talks, funded-grant announcements, preprints, and the
// public pages of open consortia. Specifically:
//
//   - NO personal contact details. No email address, no phone number, no social handle. The only
//     URLs here are institutional or lab websites and article landing pages. Several of the
//     open-access full texts read while building this file carry corresponding-author email
//     addresses in their front matter; none was copied, and outreach/test-adjacent-fields.mjs
//     regexes the whole serialised export to keep it that way.
//   - NO personal inferences. Nothing here about anyone's nationality, age, family, health,
//     politics or employment circumstances. Institutional affiliations are quoted from the record
//     (a paper byline or a staff page), not guessed, and rank/title is omitted where sources
//     disagreed.
//   - EVERY claim about interest or openness is either sourced to something the person publicly
//     wrote or said, or carries kind: 'inferred' and says what publication fact it is inferred FROM.
//     An inference is never written as though it were their stated intention.
//
// ============================== THE QUOTE RULE ==============================
// A FABRICATED QUOTE ATTRIBUTED TO A REAL PERSON IS THE WORST POSSIBLE OUTPUT OF THIS FILE.
// Every string in `real_quotes` was read back character-for-character out of a fetched source:
// an open-access full text or abstract from Europe PMC / PubMed, a bioRxiv abstract, or a lab or
// university web page fetched for that purpose. Where a quoted span is a FRAGMENT of a longer
// sentence, `context` says so. Where a passage sits in a jointly authored essay whose per-author
// section boundaries could not be resolved, `context` says that too, and the quote is attributed to
// the paper rather than to one coauthor's voice. Candidates for whom nothing could be verified
// word-for-word carry `real_quotes: []`; AN EMPTY ARRAY BEATS AN INVENTED QUOTE. Seven intended
// quotes were dropped under this rule; see QUOTE_ATTRITION.
//
// Article metadata and abstracts were obtained from PubMed. DOI links accompany every article cited
// (see DOI_LINKS / `doi` on every entry in `flagship_papers`).
//
// ============================== WHAT THIS FILE IS FOR, AND NOT FOR ==============================
// This is a reading list and a set of honest offers, not a mailing list. There is nothing here that
// could be used to contact anyone; the next step for any of these twelve is a public channel
// (a paper, a seminar, a consortium meeting, a department's own contact page).

/** Recursive freeze, so a consumer cannot quietly rewrite a quote, drop a caution, or edit a gap. */
const deepFreeze = (o) => {
  if (o && (typeof o === 'object') && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
};

/** The closed field-cluster vocabulary. A `field` outside this set is a bug, not a nuance. */
export const FIELD_CLUSTERS = deepFreeze({
  XENOBOTS: 'xenobots-synthetic-living-machines',
  ORTHOLOGY: 'comparative-genomics-ortholog-conjecture',
  BIOMECHANICS: 'biomechanics-functional-morphology',
  THEORY: 'theoretical-mathematical-biology',
  ORIGINS: 'origins-of-life-protocells',
});

/** The project's three stated goals, as the brief states them. Used as the goal vocabulary below. */
export const GOALS = deepFreeze({
  BIOMATERIALS: 'agentic-biomaterials',
  LAWS: 'reverse-engineering-biological-laws-and-constraints',
  OPEN_QUESTIONS: 'open-biological-questions-including-origins-of-life',
});

/** The Delphi / Nous / Aletheia layers, as devlog/framework.mjs defines them. */
export const LAYERS = deepFreeze({
  DELPHI: 'generation',
  NOUS: 'inference',
  ALETHEIA: 'disclosure',
});

/** Marker vocabulary for openness_evidence. Everything is one or the other; nothing is unmarked. */
export const EVIDENCE_KINDS = deepFreeze({ STATED: 'stated', INFERRED: 'inferred' });

// ===================================================================================================
// THE CANDIDATES
// ===================================================================================================

export const CANDIDATES = deepFreeze([

  // ------------------------------------------------------------------- xenobots / living machines
  {
    id: 'levin-michael',
    name: 'Michael Levin',
    institution: 'Allen Discovery Center and Department of Biology, Tufts University, Medford, MA, USA',
    lab_url: 'https://drmichaellevin.org/',
    field: FIELD_CLUSTERS.XENOBOTS,
    why_relevant_to_delphi:
      'He is the clearest case in the literature of a programme that treats ANATOMY, not sequence, as the ' +
      'addressable layer. Our design surface is an edit list against a reference assembly; his is a ' +
      'bioelectric state that cells read as an instruction about large-scale form. If "agentic ' +
      'biomaterials" means anything concrete, it means the thing his lab builds. He also supplies the ' +
      'target vocabulary for goal two: the biobot work is explicitly framed as a way to find the ' +
      'constraints on what shapes cells can be talked into.',
    flagship_papers: [
      {
        title: 'Bioelectric signaling: Reprogrammable circuits underlying embryogenesis, regeneration, and cancer',
        year: 2021, journal: 'Cell', doi: '10.1016/j.cell.2021.02.034', pmid: '33826908',
        why_it_matters:
          'The review that states the control layer: endogenous membrane-potential distributions carrying ' +
          'morphogenetic information. This is the layer our formats do not have a field for.',
      },
      {
        title: 'Technological Approach to Mind Everywhere: An Experimentally-Grounded Framework for Understanding Diverse Bodies and Minds',
        year: 2022, journal: 'Frontiers in Systems Neuroscience', doi: '10.3389/fnsys.2022.768201', pmid: '35401131',
        why_it_matters:
          'The framework paper. Relevant to us less for the cognition claims than for its insistence that ' +
          'problem-solving in ANATOMICAL space is the same kind of search as problem-solving in behavioural ' +
          'space - which is exactly the claim a design pipeline would have to encode to be useful here.',
      },
      {
        title: 'Motile Living Biobots Self-Construct from Adult Human Somatic Progenitor Seed Cells',
        year: 2023, journal: 'Advanced Science', doi: '10.1002/advs.202303575', pmid: '38032125',
        why_it_matters:
          'Anthrobots: motile multicellular constructs from genetically unmodified adult human cells. The ' +
          'strongest single demonstration that novel anatomy and novel behaviour can be obtained with NO ' +
          'genome edit at all - i.e. entirely outside the space our pipeline can represent.',
      },
    ],
    key_figures_or_findings: [
      'Anthrobots self-construct from single adult human lung-derived cells, reach 30-500 microns, and move ' +
        'by surface cilia at 5-50 microns/second, with motility pattern correlated to morphology ' +
        '(bioRxiv preprint abstract, 10.1101/2022.08.04.502707; published as 10.1002/advs.202303575).',
      'Anthrobots induced repair across wounds in human neural cell sheets in vitro (same source).',
      'The jointly authored Soft Robotics essay (10.1089/soro.2022.0142) names the long-run target of this ' +
        'programme as an "anatomical compiler" and the platform as "a sandbox in which to crack the ' +
        'morphogenetic code". The essay carries per-author sections and we did not resolve which coauthor ' +
        'wrote that paragraph, so it is recorded here as a finding of the paper, not as his words.',
    ],
    real_quotes: [
      {
        quote: 'These bioelectrical networks process morphogenetic information that controls gene expression, enabling cell collectives to make decisions about large-scale growth and form.',
        source_title: 'Bioelectric signaling: Reprogrammable circuits underlying embryogenesis, regeneration, and cancer',
        doi_or_url: 'https://doi.org/10.1016/j.cell.2021.02.034',
        context: 'Sole-author review; sentence from the published abstract, retrieved from PubMed. Verbatim, whole sentence.',
      },
      {
        quote: 'TAME formalizes a non-binary (continuous), empirically-based approach to strongly embodied agency.',
        source_title: 'Technological Approach to Mind Everywhere: An Experimentally-Grounded Framework for Understanding Diverse Bodies and Minds',
        doi_or_url: 'https://doi.org/10.3389/fnsys.2022.768201',
        context: 'Sole-author Perspective; sentence from the abstract of the open-access full text. Verbatim, whole sentence.',
      },
      {
        quote: 'By controlling microenvironmental cues in bulk, entirely novel structure, behavior, and biomedically-relevant capabilities can be discovered in morphogenetic processes without direct genetic editing or manual sculpting.',
        source_title: 'Motile Living Biobots Self-Construct from Adult Human Somatic Progenitor Seed Cells (preprint)',
        doi_or_url: 'https://doi.org/10.1101/2022.08.04.502707',
        context:
          'Closing sentence of the bioRxiv preprint abstract, retrieved from the bioRxiv API; he is the ' +
          'corresponding author of record on that preprint. Verbatim, whole sentence. Quoted from the ' +
          'preprint rather than the journal version (10.1002/advs.202303575) because the preprint abstract ' +
          'is the text we could read back word-for-word.',
      },
    ],
    public_record:
      'Lab website at drmichaellevin.org (self-described mission: to "develop fundamental understanding of ' +
      'how minds of all kinds arise, scale, persist, and change"); the three papers above; the jointly ' +
      'authored Soft Robotics essay; the bioRxiv preprint record.',
    collaboration_angle: {
      the_exchange:
        'They have a design surface we cannot express and a wet lab that closes the loop in days. We have a ' +
        'law registry, a Lean layer, and a holdout discipline - i.e. machinery for stating a constraint ' +
        'precisely and then being told NO by evidence. The natural joint object is a FORMALISED ' +
        'MORPHOSPACE CONSTRAINT: take a claim their platform already tests informally ("this shape coheres ' +
        'the noisy actions of its parts and that one does not"), state it as a checkable proposition, and ' +
        'let their builds falsify it.',
      what_we_must_bring:
        'A representation that can hold a CELL ARRANGEMENT, which we do not have today - see ' +
        'THE_HONEST_GAP. Until then we must bring the honest version: we cannot propose a construct, so we ' +
        'come as the formalisation and refusal layer for claims their platform generates, not as a design ' +
        'partner. We must also bring an actual negative result of our own (the holdout exists; use it) ' +
        'rather than a pitch.',
      concrete_first_step:
        'Pick one published morphology-to-behaviour correlation from the Anthrobots paper, write it as a ' +
        'proposition with its measurement procedure attached, and show where our own scorer disagrees with it.',
    },
    openness_evidence: [
      {
        kind: EVIDENCE_KINDS.STATED,
        evidence:
          'The Soft Robotics essay is explicitly addressed to other disciplines and closes: "We hope new ' +
          'fields can emerge as boundaries arising from technological limitations are overcome, furthering ' +
          'practical applications from regenerative medicine to useful synthetic living machines."',
        source: 'https://doi.org/10.1089/soro.2022.0142',
        caveat: 'A jointly authored sentence; it is the paper\'s stated hope, not a sentence we can assign to one coauthor.',
      },
      {
        kind: EVIDENCE_KINDS.INFERRED,
        evidence:
          'INFERENCE FROM THE PUBLICATION RECORD: the coauthor list on the reconfigurable-organism papers ' +
          'spans a biology department, a computer science department and a robotics group across two ' +
          'institutions, which is what sustained cross-field collaboration looks like in the record. This ' +
          'is our reading of the bylines, not a statement of anyone\'s intention.',
        source: 'https://doi.org/10.1073/pnas.1910837117',
      },
    ],
    caution:
      'The highest-visibility name here and therefore the most contacted; a cold approach with nothing ' +
      'built is likely to read as noise. The framing in the TAME paper is contested in the philosophy of ' +
      'mind, and the project should not import those claims as settled just because it wants the ' +
      'experimental platform. Hardest caution of all: on the xenobot problem we are the ones with nothing ' +
      'to offer. Do not disguise that.',
  },

  {
    id: 'bongard-josh',
    name: 'Josh Bongard',
    institution: 'Department of Computer Science, University of Vermont, Burlington, VT, USA',
    lab_url: 'https://www.meclab.org/',
    field: FIELD_CLUSTERS.XENOBOTS,
    why_relevant_to_delphi:
      'He is the search half of the xenobot pipeline: the person who has actually built the optimiser that ' +
      'proposes a body. That is precisely the component our pipeline lacks. His earlier self-modelling ' +
      'work is also the closest existing analogue of what our simulate-then-score loop is trying to be, ' +
      'and it predates the biology by fifteen years.',
    flagship_papers: [
      {
        title: 'Resilient Machines Through Continuous Self-Modeling',
        year: 2006, journal: 'Science', doi: '10.1126/science.1133687',
        why_it_matters:
          'A machine that infers its own morphology from experience and re-plans when the morphology ' +
          'changes. The template for "the design system should discover its own body model", which is a ' +
          'capability our scorer assumes it already has.',
      },
      {
        title: 'A scalable pipeline for designing reconfigurable organisms',
        year: 2020, journal: 'Proceedings of the National Academy of Sciences',
        doi: '10.1073/pnas.1910837117', pmid: '31932426',
        why_it_matters:
          'The pipeline paper. Note the architecture: evolve in a physics engine, filter for buildability, ' +
          'then build from cells. The "buildability filter" is the piece our pipeline has no analogue of.',
      },
      {
        title: 'Biological Robots: Perspectives on an Emerging Interdisciplinary Field',
        year: 2023, journal: 'Soft Robotics', doi: '10.1089/soro.2022.0142', pmid: '37083430',
        why_it_matters:
          'The field\'s own self-audit, including its vocabulary disagreements and its statement that the ' +
          'constructs are not yet useful. Unusually candid, and therefore a good model for how we should ' +
          'write up our own limits.',
      },
    ],
    key_figures_or_findings: [
      'The 2020 pipeline evolved designs in simulation, then applied a build filter that also removed ' +
        'designs more than 50% muscle in order to reserve room for other cell types - a worked example of a ' +
        'manufacturability constraint stated as a design-space restriction.',
      'The Soft Robotics essay reports that the team itself does not agree on what to call these things, ' +
        'listing reconfigurable organisms, computer-designed organisms, biobots, xenobots, engineered living ' +
        'systems, biological robots and biomachines as competing internal terms.',
    ],
    real_quotes: [
      {
        quote: 'our ability to create novel lifeforms is currently limited to varying existing organisms or bioengineering organoids in vitro',
        source_title: 'A scalable pipeline for designing reconfigurable organisms',
        doi_or_url: 'https://doi.org/10.1073/pnas.1910837117',
        context:
          'Fragment of the second sentence of the abstract (the sentence opens "However,"). He is the last ' +
          'and corresponding author of record. Verbatim fragment, read from the open-access full text.',
      },
      {
        quote: 'It is important to remember that xenobots are not yet useful: they cannot solve any problems at all.',
        source_title: 'Biological Robots: Perspectives on an Emerging Interdisciplinary Field',
        doi_or_url: 'https://doi.org/10.1089/soro.2022.0142',
        context:
          'Verbatim, whole sentence, from the open-access full text. The essay is jointly authored with ' +
          'per-author sections and we did NOT resolve which coauthor wrote this paragraph; he is a ' +
          'coauthor. Attribute to the paper, not to his voice.',
      },
      {
        quote: 'To make the design problem tractable for human minds, the solution space must be winnowed down to a vanishingly small subset of possible forms and functions.',
        source_title: 'Biological Robots: Perspectives on an Emerging Interdisciplinary Field',
        doi_or_url: 'https://doi.org/10.1089/soro.2022.0142',
        context:
          'Verbatim, whole sentence, same open-access full text and the same unresolved per-author ' +
          'authorship caveat. Quoted because it is the field\'s own statement of why an automated designer ' +
          'is needed at all.',
      },
    ],
    public_record:
      'The lab site at meclab.org carries the lab name (Morphology, Evolution & Cognition Laboratory) and ' +
      'sections for people, publications, education and press, but no prose research statement, so no ' +
      'self-description is quoted from it. His directorship of that lab and his UVM computer science ' +
      'appointment are reported on institutional and press pages; the three papers above are the primary ' +
      'record used here. The lab site also links personal social accounts, which are deliberately not ' +
      'recorded in this file.',
    collaboration_angle: {
      the_exchange:
        'He has the one thing our design surface cannot do - propose a body - and a published habit of ' +
        'stating what his systems cannot do. We have a law registry and a proof layer that could turn a ' +
        'buildability filter from a heuristic into a stated constraint with a provenance trail.',
      what_we_must_bring:
        'A buildability constraint we can actually formalise, and an admission that our edit-list format ' +
        'cannot encode the objects his optimiser searches over. Realistically we must also bring compute ' +
        'or engineering effort rather than ideas: the ideas on that side are ahead of ours.',
      concrete_first_step:
        'Re-express the published 50%-muscle build filter as a checkable constraint in our registry format ' +
        'and report what it does and does not capture. Small, concrete, and it fails visibly if we are wrong.',
    },
    openness_evidence: [
      {
        kind: EVIDENCE_KINDS.STATED,
        evidence:
          'The Soft Robotics essay is written as an answer to "questions and critiques which have arisen in ' +
          'response to our research program" and invites the boundary between fields to be redrawn.',
        source: 'https://doi.org/10.1089/soro.2022.0142',
        caveat: 'Jointly authored; a stated position of the paper, which he coauthored.',
      },
      {
        kind: EVIDENCE_KINDS.INFERRED,
        evidence:
          'INFERENCE FROM THE PUBLICATION AND SOFTWARE RECORD: the 2020 paper deposits its source code ' +
          'publicly (a GitHub repository named in the paper\'s data-availability statement), which is ' +
          'consistent with a group that expects others to reuse the pipeline. Our inference from the ' +
          'deposit, not a statement of intent.',
        source: 'https://doi.org/10.1073/pnas.1910837117',
      },
    ],
    caution:
      'Our pipeline has nothing to trade on the design side, so this is an asymmetric ask and should be ' +
      'made as one. His own published position is that these constructs solve no problems yet, so any ' +
      'pitch that leans on near-term application will land badly. Note also that the record we could ' +
      'verify for him is thinner than for the others in this cluster: his lab page has no research prose, ' +
      'so the profile rests almost entirely on papers.',
  },

  {
    id: 'kriegman-sam',
    name: 'Sam Kriegman',
    institution: 'Northwestern University, Evanston/Chicago, IL, USA (appointments reported in computer science, mechanical engineering, and chemical and biological engineering)',
    lab_url: 'http://www.xenobot.group/',
    field: FIELD_CLUSTERS.XENOBOTS,
    why_relevant_to_delphi:
      'First author on both reconfigurable-organism papers, and the person whose current programme is ' +
      'explicitly about making automatic body design EFFICIENT rather than merely possible. That is the ' +
      'same problem our generation layer would face the moment it could represent a body at all. He is ' +
      'also the most plausible early-career partner in this cluster: the work is close enough to ' +
      'computation that our side has something to say.',
    flagship_papers: [
      {
        title: 'A scalable pipeline for designing reconfigurable organisms',
        year: 2020, journal: 'Proceedings of the National Academy of Sciences',
        doi: '10.1073/pnas.1910837117', pmid: '31932426',
        why_it_matters:
          'States, in the introduction, why genome engineering is not the route to multicellular shape. ' +
          'That sentence is the cleanest external statement of our own design-surface problem.',
      },
      {
        title: 'Kinematic self-replication in reconfigurable organisms',
        year: 2021, journal: 'Proceedings of the National Academy of Sciences',
        doi: '10.1073/pnas.2112672118', pmid: '34845026',
        why_it_matters:
          'Shape, not sequence, is the variable that is optimised - and the optimisation changes a ' +
          'population-level property (replication). A direct demonstration that geometry is a first-class ' +
          'design parameter, which our format stores but cannot propose.',
      },
      {
        title: 'Biological Robots: Perspectives on an Emerging Interdisciplinary Field',
        year: 2023, journal: 'Soft Robotics', doi: '10.1089/soro.2022.0142', pmid: '37083430',
        why_it_matters:
          'Contains the field\'s own account of searching parts of design space human engineers do not ' +
          'visit, and of the compute cost of doing so - a constraint our simulate-and-score loop shares.',
      },
    ],
    key_figures_or_findings: [
      'In the 2021 paper, unmodified progenitors kinematically self-replicated only one generation in four ' +
        'of five independent trials at 25-150 cells/mm2; designed progenitor shape was the intervention ' +
        'that extended replication cycles.',
      'The 2021 paper reports that in a cluttered environment the unmodified progenitors cannot move enough ' +
        'to self-replicate at all - i.e. the environment, not the genome, is the binding constraint.',
      'Northwestern reports a 2025 NSF CAREER award for "Differentiable Evolution: Efficient Automatic ' +
        'Design of Embodied Intelligence", described as using error-tracing methods borrowed from neural ' +
        'network learning to find and revise the body parts causing poor performance.',
    ],
    real_quotes: [
      {
        quote: 'Single-cell organisms have been modified by refactored genomes, but such methods are not yet scalable to rational control of multicellular shape or behavior',
        source_title: 'A scalable pipeline for designing reconfigurable organisms',
        doi_or_url: 'https://doi.org/10.1073/pnas.1910837117',
        context:
          'He is first author. Verbatim sentence from the introduction of the open-access full text, with ' +
          'the trailing bracketed reference marker omitted. This is the sentence we should quote back at ' +
          'ourselves before claiming an edit list is a design surface for a body.',
      },
      {
        quote: 'In a cluttered environment, the wild-type progenitors cannot move enough to self-replicate.',
        source_title: 'Kinematic self-replication in reconfigurable organisms',
        doi_or_url: 'https://doi.org/10.1073/pnas.2112672118',
        context: 'He is first author. Verbatim, whole sentence, from the open-access full text.',
      },
      {
        quote: 'Roboticists have no idea how to manually design a robot as athletic and intelligent as even the simplest animals.',
        source_title: 'Sam Kriegman receives prestigious NSF CAREER Award (Northwestern Engineering news item)',
        doi_or_url: 'https://www.mccormick.northwestern.edu/news/articles/2025/06/sam-kriegman-receives-prestigious-nsf-career-award/',
        context:
          'Direct quotation attributed to him in his own institution\'s announcement of the award. Verbatim, ' +
          'whole sentence, read back from the raw page bytes; on the page it sits inside a longer quoted ' +
          'block that continues "We could take inspiration from the evolutionary design of animals."',
      },
    ],
    public_record:
      'Lab site at xenobot.group (stated focus: understanding "the emergence of adaptive complexity in ' +
      'natural systems" and using that to build new kinds of adaptive robots); Northwestern faculty and ' +
      'robotics-institute profiles; the 2025 NSF CAREER award announcement; the three papers above.',
    collaboration_angle: {
      the_exchange:
        'His CAREER programme is about gradients through a body-design space. Our registry is a store of ' +
        'constraints that such a search would have to respect, and our Lean layer can state one so it ' +
        'cannot be quietly violated. That is a real, small, non-obvious contribution we could make without ' +
        'owning a wet lab.',
      what_we_must_bring:
        'Differentiable, or at least machine-checkable, constraints - not prose laws. We must also bring ' +
        'the admission that our organism format can store per-cell geometry but has no operator that ' +
        'PROPOSES one, so we cannot be the generator in this partnership; we can only be the constraint ' +
        'and audit side.',
      concrete_first_step:
        'Take one constraint from our 62-law registry that is actually geometric, encode it as a penalty ' +
        'his optimiser could call, and publish the negative result if it turns out the law is not ' +
        'differentiable in any useful sense.',
    },
    openness_evidence: [
      {
        kind: EVIDENCE_KINDS.STATED,
        evidence:
          'The lab\'s own site frames part of its robot work as scientific instrumentation for studying how ' +
          'animals evolve, grow, move, sense and think - an explicitly cross-disciplinary stated purpose.',
        source: 'http://www.xenobot.group/',
      },
      {
        kind: EVIDENCE_KINDS.INFERRED,
        evidence:
          'INFERENCE FROM THE PUBLIC RECORD: an early-career researcher with a new CAREER award whose ' +
          'stated aim is making automated design more efficient has a standing need for methods ' +
          'contributions. We infer receptiveness to a methods collaboration from the award\'s public ' +
          'abstract and his appointment span across three engineering departments; he has not said this.',
        source: 'https://www.mccormick.northwestern.edu/news/articles/2025/06/sam-kriegman-receives-prestigious-nsf-career-award/',
      },
    ],
    caution:
      'His stated bottleneck is search efficiency, not formalisation, so a constraint-logic offer may be ' +
      'answered with "that is not my problem" - and that answer would be correct. The institutional detail ' +
      'here is drawn from university pages and a news item rather than a paper byline, so treat the ' +
      'department list as reported, not as a byline-verified affiliation.',
  },

  {
    id: 'davies-jamie',
    name: 'Jamie Davies',
    institution: 'Deanery of Biomedical Sciences, Edinburgh Medical School, University of Edinburgh, Edinburgh, UK',
    lab_url: 'https://biomedical-sciences.ed.ac.uk/about/meet-our-staff/prof-jamie-davies',
    field: FIELD_CLUSTERS.XENOBOTS,
    why_relevant_to_delphi:
      'He named the field. "Synthetic morphology" is his 2008 term, and his 2008 statement of its aim - ' +
      'programming cells to organise themselves into specified novel arrangements - is the most precise ' +
      'published description of the design surface we do not have. He is also the only person in this ' +
      'cluster whose stated motivation is explicitly goal two: building simple synthetic systems in order ' +
      'to TEST theories of morphogenesis that cannot be tested in real embryos. That is our Nous layer\'s ' +
      'ambition, done in cells.',
    flagship_papers: [
      {
        title: 'Synthetic morphology: prospects for engineered, self-constructing anatomies',
        year: 2008, journal: 'Journal of Anatomy', doi: '10.1111/j.1469-7580.2008.00896.x', pmid: '18510501',
        why_it_matters:
          'The founding statement, and it is structured as an engineering requirements document: libraries ' +
          'of sensor, regulatory and effector modules, then a graded set of proof-of-concept challenges. ' +
          'Read it as the specification our organism format is missing.',
      },
      {
        title: 'Using synthetic biology to explore principles of development',
        year: 2017, journal: 'Development', doi: '10.1242/dev.144196', pmid: '28351865',
        why_it_matters:
          'Argues that building a system that obeys a claimed developmental principle is how you verify the ' +
          'principle. This is the same move as our proof layer, with cells as the checker.',
      },
      {
        title: 'Synthetic self-patterning and morphogenesis in mammalian cells: a proof-of-concept step towards synthetic tissue development',
        year: 2017, journal: 'Engineering Biology', doi: '10.1049/enb.2017.0013',
        why_it_matters:
          'The demonstration rather than the manifesto: engineered modules driving pattern and shape in ' +
          'mammalian cells. Shows the gap between the 2008 requirements list and what is actually buildable.',
      },
    ],
    key_figures_or_findings: [
      'The 2008 paper gives two distinct reasons for synthetic morphology, one clinical (tissue engineering) ' +
        'and one epistemic (rigorous testing of morphogenetic theory), and argues the module library needed ' +
        'may already be within reach - a claim worth checking against what has actually shipped since.',
      'The Edinburgh staff page states his core interest as "how the simple becomes complex" and describes ' +
        'the use of synthetic biology to design genetic circuits that let cells form multicellular patterns ' +
        'and structures.',
    ],
    real_quotes: [
      {
        quote: 'with the aim of programming cells to organize themselves into specific, novel arrangements, structures and tissues',
        source_title: 'Synthetic morphology: prospects for engineered, self-constructing anatomies',
        doi_or_url: 'https://doi.org/10.1111/j.1469-7580.2008.00896.x',
        context:
          'Sole-author review. Verbatim FRAGMENT of the opening sentence of the abstract, retrieved from ' +
          'PubMed. Quoted because "arrangements" is exactly the noun our format cannot take as input.',
      },
      {
        quote: 'construction of simple novel systems according to theories of morphogenesis gained from study of real embryos will provide a means of testing those theories rigorously, something that is very difficult to do by manipulation of complex embryos',
        source_title: 'Synthetic morphology: prospects for engineered, self-constructing anatomies',
        doi_or_url: 'https://doi.org/10.1111/j.1469-7580.2008.00896.x',
        context: 'Verbatim FRAGMENT of a longer sentence in the same abstract (the sentence begins "The second is that"). Retrieved from PubMed.',
      },
      {
        quote: "It is also being applied to evo-devo studies to explore alternative mechanisms of development and 'roads not taken' by natural evolution.",
        source_title: 'Using synthetic biology to explore principles of development',
        doi_or_url: 'https://doi.org/10.1242/dev.144196',
        context:
          'Sole-author review. Verbatim, whole closing sentence of the abstract, retrieved from PubMed, ' +
          'including his own single quotation marks around "roads not taken".',
      },
    ],
    public_record:
      'University of Edinburgh staff page (used here as the lab URL); the three papers above. That staff ' +
      'page also lists a legacy Davies Laboratory address on an Edinburgh anatomy host, which did not ' +
      'respond when we tried to fetch it over HTTPS, so it is not used as the lab URL here. He is also ' +
      'credited on the page with maintaining two public databases (Guide to Pharmacology and GUDMAP).',
    collaboration_angle: {
      the_exchange:
        'He wants developmental principles stated precisely enough to be built and thereby tested. We want ' +
        'biological laws stated precisely enough to be machine-checked. These are the same want, approached ' +
        'from opposite ends, and his 2008 requirements list is a ready-made target schema for the part of ' +
        'our format that does not exist.',
      what_we_must_bring:
        'A formalisation of at least one morphogenetic principle that is faithful enough that he would ' +
        'recognise it - which means accepting his correction, not ours, on what the principle says. We must ' +
        'also bring a representation for cell arrangement, and we must say plainly that we do not have one. ' +
        'Offering a genome-edit planner to a synthetic-morphology lab is offering the wrong tool.',
      concrete_first_step:
        'Formalise one challenge from the 2008 graded challenge list as a machine-checkable specification ' +
        'and show which of our existing format fields can and cannot express it. The failures are the ' +
        'interesting output.',
    },
    openness_evidence: [
      {
        kind: EVIDENCE_KINDS.STATED,
        evidence:
          'The 2008 paper closes by proposing a set of graded challenges "the achievement of which would ' +
          'provide valuable proofs of concept" - an open invitation to the field, published as such.',
        source: 'https://doi.org/10.1111/j.1469-7580.2008.00896.x',
      },
      {
        kind: EVIDENCE_KINDS.INFERRED,
        evidence:
          'INFERENCE FROM THE PUBLIC RECORD: he is credited with maintaining two public community databases ' +
          'and has published a review arguing synthetic construction is how development\'s principles get ' +
          'verified. We read that as a disposition toward shared infrastructure; it is our inference from ' +
          'the record, not a statement he has made about collaborating with us or anyone.',
        source: 'https://biomedical-sciences.ed.ac.uk/about/meet-our-staff/prof-jamie-davies',
      },
    ],
    caution:
      'The founding paper is from 2008 and its "library may be within reach" optimism should not be quoted ' +
      'as a current assessment. His present emphasis, per the staff page, is substantially kidney ' +
      'development and tissue engineering, so synthetic morphology may not be where his effort sits today. ' +
      'We also could not verify a working dedicated lab website, so the profile rests on a university ' +
      'staff page plus papers - a thinner base than it looks.',
  },

  // --------------------------------------------------- comparative genomics / ortholog conjecture
  {
    id: 'dessimoz-christophe',
    name: 'Christophe Dessimoz',
    institution: 'Department of Computational Biology, University of Lausanne, and SIB Swiss Institute of Bioinformatics, Lausanne, Switzerland (the lab site also names UCL / London in its page title; its affiliation list does not repeat it, so it is reported rather than asserted here)',
    lab_url: 'https://lab.dessimoz.org/',
    field: FIELD_CLUSTERS.ORTHOLOGY,
    why_relevant_to_delphi:
      'Our analogy module assumes that an orthologue is a safe place to carry a function across. He is a ' +
      'coauthor of the paper that tested that assumption and found it holds - WEAKLY. "Weakly, but ' +
      'significantly" is in his paper\'s title, and a weak effect is not a licence for a single-edit ' +
      'design decision. He also runs the infrastructure (OMA) and co-runs the benchmarking consortium that ' +
      'would tell us whether our orthologue calls are any good.',
    flagship_papers: [
      {
        title: 'Resolving the Ortholog Conjecture: Orthologs Tend to Be Weakly, but Significantly, More Similar in Function than Paralogs',
        year: 2012, journal: 'PLoS Computational Biology', doi: '10.1371/journal.pcbi.1002514', pmid: '22615551',
        why_it_matters:
          'The pro-conjecture side of the dispute, and more useful to us for its METHOD than its verdict: it ' +
          'enumerates four confounders (authorship bias, GO term frequency variation, background-similarity ' +
          'variation, propagated annotation bias) that any reuse of GO annotations must control. Our ' +
          'analogy module controls for none of them.',
      },
      {
        title: 'Standardized benchmarking in the quest for orthologs',
        year: 2016, journal: 'Nature Methods', doi: '10.1038/nmeth.3830',
        why_it_matters:
          'A community benchmark with a public service behind it. This is the external yardstick our ' +
          'orthologue step currently lacks, and submitting to it is a measurable, unflattering test.',
      },
      {
        title: 'Inferring Orthology and Paralogy',
        year: 2019, journal: 'Methods in Molecular Biology', doi: '10.1007/978-1-4939-9074-0_5',
        why_it_matters:
          'The methods chapter. Worth reading precisely because it separates the graph-based from the ' +
          'tree-based definitions, a distinction our pipeline currently collapses.',
      },
    ],
    key_figures_or_findings: [
      'The 2012 analysis spans experimentally supported functional annotations from 13 genomes; the ' +
        'orthologue advantage is reported as strongest for sub-cellular localization.',
      'Same paper: only a weak decrease in functional similarity with increasing sequence divergence - i.e. ' +
        'percent identity is a poor proxy for functional conservation, which is the proxy our analogy ' +
        'module leans on hardest.',
      'The Quest for Orthologs consortium web page describes itself as "a joint effort to benchmark, ' +
        'improve and standardize orthology predictions through collaboration" and reports that more than 30 ' +
        'phylogenomic databases contribute results; the next meeting listed is QfO 9, 29-30 August 2026, in ' +
        'Lausanne.',
    ],
    real_quotes: [
      {
        quote: 'After controlling for these biases, we observe that orthologs have generally more similar functional annotations than paralogs.',
        source_title: 'Resolving the Ortholog Conjecture: Orthologs Tend to Be Weakly, but Significantly, More Similar in Function than Paralogs',
        doi_or_url: 'https://doi.org/10.1371/journal.pcbi.1002514',
        context:
          'He is the last author. Verbatim, whole sentence, from the abstract of the open-access full text. ' +
          'Note the conditional clause: the result is downstream of the bias controls, not independent of them.',
      },
      {
        quote: 'We observe only a weak decrease in functional similarity with increasing sequence divergence.',
        source_title: 'Resolving the Ortholog Conjecture: Orthologs Tend to Be Weakly, but Significantly, More Similar in Function than Paralogs',
        doi_or_url: 'https://doi.org/10.1371/journal.pcbi.1002514',
        context: 'Verbatim, whole sentence, same abstract and source.',
      },
    ],
    public_record:
      'Lab site at lab.dessimoz.org, which describes itself as a "Laboratory of Computational Evolutionary ' +
      'Biology" that "seeks to better understand evolutionary and functional relationships between genes, ' +
      'genomes, and species"; the OMA orthology resource; the public Quest for Orthologs consortium pages; ' +
      'the three papers above.',
    collaboration_angle: {
      the_exchange:
        'He has the benchmark and the bias taxonomy; we have a pipeline that silently assumes the ' +
        'conjecture and a holdout discipline for finding out when an assumption is load-bearing. The honest ' +
        'joint object is a measurement OF US: run our analogy module against the Quest for Orthologs ' +
        'benchmark and publish where it fails.',
      what_we_must_bring:
        'Our orthologue calls in a submittable form, and a prior commitment to publish the result whichever ' +
        'way it goes. We must also bring the four confounders from his 2012 paper actually implemented in ' +
        'our code, because turning up with uncontrolled GO-similarity numbers would waste his time and ' +
        'would be the kind of false-clean result this project has produced before.',
      concrete_first_step:
        'Implement the propagated-annotation-bias control from the 2012 paper in our analogy module and ' +
        'report how much of our current orthologue-transfer confidence survives it.',
    },
    openness_evidence: [
      {
        kind: EVIDENCE_KINDS.STATED,
        evidence:
          'The Quest for Orthologs consortium, which he co-leads per the Nature Methods benchmarking paper, ' +
          'publicly describes itself as a collaborative benchmarking effort, invites contributions to its ' +
          'site, and announces open meetings.',
        source: 'https://questfororthologs.org/',
        caveat: 'A consortium statement, not a personal one. Quoted as the consortium\'s own words.',
      },
      {
        kind: EVIDENCE_KINDS.INFERRED,
        evidence:
          'INFERENCE FROM THE PUBLICATION RECORD: his group publishes open resources (OMA) and ' +
          'community-standard benchmarks rather than closed methods. We read that as openness to external ' +
          'method submissions; it is our reading, not his stated position on any particular collaboration.',
        source: 'https://doi.org/10.1038/nmeth.3830',
      },
    ],
    caution:
      'He is on one side of a live scientific dispute and Hahn is on the other. Approaching both without ' +
      'saying so would be dishonest, and approaching either while pretending the literature is settled ' +
      'would be worse. His 2012 result is also narrower than it is usually cited as: it is about ' +
      'annotation similarity after bias correction, not about whether a given orthologue will do a given ' +
      'job in a designed organism. Do not cite it as support for a design decision it does not support.',
  },

  {
    id: 'hahn-matthew',
    name: 'Matthew Hahn',
    institution: 'Department of Biology and Department of Computer Science, Indiana University, Bloomington, IN, USA',
    lab_url: 'https://hahnlab.github.io/',
    field: FIELD_CLUSTERS.ORTHOLOGY,
    why_relevant_to_delphi:
      'He ran the test twice, nine years apart, and both times the answer went against the assumption our ' +
      'analogy module is built on. He is therefore the single most useful person in this file for goal two: ' +
      'he is a worked example of reverse-engineering a biological "law" and finding it is not one. His 2011 ' +
      'conclusion - that cellular context beats sequence - is a direct hit on the premise that a ' +
      'sequence-similar gene in another organism will do the same job.',
    flagship_papers: [
      {
        title: 'Testing the Ortholog Conjecture with Comparative Functional Genomic Data from Mammals',
        year: 2011, journal: 'PLoS Computational Biology', doi: '10.1371/journal.pcbi.1002073', pmid: '21695233',
        why_it_matters:
          'The paper that opened the dispute. Over 8,900 genes, two independent data types, and the ' +
          'conclusion that paralogues are often the better functional predictor. If our module ranks ' +
          'orthologues first, this is the paper it has to answer.',
      },
      {
        title: 'The ortholog conjecture revisited: the value of orthologs and paralogs in function prediction',
        year: 2020, journal: 'Bioinformatics', doi: '10.1093/bioinformatics/btaa468', pmid: '32657391',
        why_it_matters:
          'The revisit, on much more data, and the key conceptual move for us: it SEPARATES the question ' +
          '"how does function evolve" from "what should I use to predict function". Our pipeline conflates ' +
          'them, and the paper shows the conflation changes the answer.',
      },
    ],
    key_figures_or_findings: [
      'The 2020 study uses experimental annotations from over 40,000 proteins drawn from over 80,000 ' +
        'publications, across human/mouse and two yeasts, and reports strong evidence against the ' +
        'conjecture specifically in the prediction setting.',
      'The 2011 study reports that same-species paralogues are consistently more functionally similar than ' +
        'different-species paralogues, and that same-chromosome paralogue pairs are more similar than ' +
        'different-chromosome pairs - both findings that point at context rather than sequence.',
      'The 2020 paper\'s own summary position is that the type of homologue used for function transfer is ' +
        'largely irrelevant and that maximising the amount of data is what helps - which, if true, means our ' +
        'orthologue-first ranking is not just weakly supported but beside the point.',
    ],
    real_quotes: [
      {
        quote: 'Both datasets show that paralogs are often a much better predictor of function than are orthologs, even at lower sequence identities.',
        source_title: 'Testing the Ortholog Conjecture with Comparative Functional Genomic Data from Mammals',
        doi_or_url: 'https://doi.org/10.1371/journal.pcbi.1002073',
        context: 'He is a corresponding author of record. Verbatim, whole sentence, from the abstract (retrieved from PubMed and confirmed against the open-access full text).',
      },
      {
        quote: 'We conclude that the most important factor in the evolution of function is not amino acid sequence, but rather the cellular context in which proteins act.',
        source_title: 'Testing the Ortholog Conjecture with Comparative Functional Genomic Data from Mammals',
        doi_or_url: 'https://doi.org/10.1371/journal.pcbi.1002073',
        context: 'Verbatim, whole closing sentence of the same abstract. This is the sentence our analogy module should be made to argue with.',
      },
      {
        quote: 'we find strong evidence against the ortholog conjecture in the context of function prediction, though questions about the evolution of function remain difficult to address',
        source_title: 'The ortholog conjecture revisited: the value of orthologs and paralogs in function prediction',
        doi_or_url: 'https://doi.org/10.1093/bioinformatics/btaa468',
        context: 'Verbatim FRAGMENT of a longer sentence in the Results section of the structured abstract, retrieved from PubMed. The hedge in the second clause is his, and is the honest part.',
      },
      {
        quote: 'our results support the view that the types of homologs used for function transfer are largely irrelevant to the task of function prediction',
        source_title: 'The ortholog conjecture revisited: the value of orthologs and paralogs in function prediction',
        doi_or_url: 'https://doi.org/10.1093/bioinformatics/btaa468',
        context: 'Verbatim FRAGMENT of a longer sentence in the same structured abstract (the sentence begins "Taken as a whole,").',
      },
    ],
    public_record:
      'Lab site at hahnlab.github.io (navigation only - the landing page carries no research prose, so ' +
      'nothing is quoted from it; an older institutionally hosted mirror exists but did not present a ' +
      'valid certificate for its hostname when fetched); the two papers above; the affiliations on those ' +
      'papers\' bylines. Note that the 2020 paper\'s code is deposited in a public repository named in the ' +
      'article.',
    collaboration_angle: {
      the_exchange:
        'He has a negative result we are quietly contradicting. The useful collaboration is adversarial in ' +
        'the good sense: let him or his published method tell us how much of our analogy module\'s ' +
        'confidence is unearned. For goal two he is also a method template - his 2020 separation of ' +
        '"evolution of" from "prediction of" is the kind of distinction our law registry should be making ' +
        'and is not.',
      what_we_must_bring:
        'Our analogy module\'s actual confidence numbers, and the willingness to have them reduced. We must ' +
        'bring the distinction his 2020 paper draws, applied to our own claims, BEFORE asking him anything ' +
        '- otherwise we are asking him to do our reading for us. We have nothing experimental to offer him ' +
        'and should not imply otherwise.',
      concrete_first_step:
        'Re-run our orthologue-transfer scoring with paralogues included on equal footing, as his 2020 ' +
        'result would recommend, and report whether our verdicts change. If they do not change, that is ' +
        'evidence the module was not using the distinction at all.',
    },
    openness_evidence: [
      {
        kind: EVIDENCE_KINDS.INFERRED,
        evidence:
          'INFERENCE FROM THE PUBLICATION RECORD: the 2020 paper names a public code repository and the work ' +
          'is a deliberate, data-expanded revisit of a nine-year-old dispute rather than a defence of a ' +
          'prior position. We read that as a disposition to re-open settled questions on evidence. This is ' +
          'our inference; he has made no statement to us or about this project.',
        source: 'https://doi.org/10.1093/bioinformatics/btaa468',
      },
      {
        kind: EVIDENCE_KINDS.INFERRED,
        evidence:
          'INFERENCE FROM THE PUBLICATION RECORD: his byline on both papers spans a biology and a computer ' +
          'science department, and his coauthors include computer scientists at other institutions, which is ' +
          'the shape of a group used to working with methods people. Inferred from bylines only.',
        source: 'https://doi.org/10.1371/journal.pcbi.1002073',
      },
    ],
    caution:
      'NO STATED-OPENNESS EVIDENCE WAS FOUND FOR HIM. Both entries above are marked inferred and that is ' +
      'all we have; his lab landing page carries no research or collaboration prose. Also: his result is ' +
      'the one that makes our analogy module look worst, which is a reason to approach him and a reason to ' +
      'expect a short answer. And the dispute is genuinely unresolved - citing him as "the" answer while ' +
      'citing Dessimoz as outdated would misrepresent the literature in the direction that happens to suit ' +
      'our narrative.',
  },

  // -------------------------------------------------------------- biomechanics / functional morphology
  {
    id: 'patek-sheila',
    name: 'Sheila Patek',
    institution: 'Department of Biology, Duke University, Durham, NC, USA',
    lab_url: 'https://pateklab.biology.duke.edu/',
    field: FIELD_CLUSTERS.BIOMECHANICS,
    why_relevant_to_delphi:
      'She measures the ceiling. Her programme is about what a mechanical arrangement can and cannot ' +
      'achieve - latch-mediated spring actuation, power amplification, the physical limits of fast ' +
      'movement - which is the empirical counterpart of our design scorer\'s claim to know whether a body ' +
      'plan works. Her 2011 position that a large diversity of elastic mechanisms reduces to a few ' +
      'physical principles is, structurally, exactly the kind of claim our law registry exists to hold.',
    flagship_papers: [
      {
        title: 'From bouncy legs to poisoned arrows: elastic movements in invertebrates',
        year: 2011, journal: 'Journal of Experimental Biology', doi: '10.1242/jeb.038596', pmid: '21613512',
        why_it_matters:
          'The reduction-to-principles paper: different configurations of a few basic building blocks ' +
          'produce different functions. That is a compositional grammar for mechanisms, and it is far ' +
          'closer to something formalisable than most of comparative morphology.',
      },
      {
        title: 'Extreme impact and cavitation forces of a biological hammer: strike forces of the peacock mantis shrimp Odontodactylus scyllarus',
        year: 2005, journal: 'Journal of Experimental Biology', doi: '10.1242/jeb.01831',
        why_it_matters:
          'The measurement that made the field: a quantified upper bound on biological impact. A design ' +
          'scorer that cannot reproduce a bound like this is not measuring performance.',
      },
      {
        title: 'Muscle-spring dynamics in time-limited, elastic movements',
        year: 2016, journal: 'Proceedings of the Royal Society B: Biological Sciences', doi: '10.1098/rspb.2016.1561',
        why_it_matters:
          'Formalises the trade-off between muscle and spring when time is the binding constraint - a ' +
          'genuine constraint theorem in biomechanical dress, and a candidate for our registry.',
      },
    ],
    key_figures_or_findings: [
      'The 2011 commentary explicitly compares single rapid movements against rhythmic movements across six ' +
        'invertebrate examples and identifies the evolutionary dynamics of elastic mechanisms as one of two ' +
        'open frontiers.',
      'Her lab\'s stated scope on its own site runs from performance limits of rapid motion to spring-loaded ' +
        'latch systems to acoustic biomechanics in marine crustaceans - three measurement modalities, which ' +
        'matters because a constraint we propose has to be falsifiable in at least one of them.',
    ],
    real_quotes: [
      {
        quote: 'Elastic mechanisms in the invertebrates are fantastically diverse, yet much of this diversity can be captured by examining just a few fundamental physical principles.',
        source_title: 'From bouncy legs to poisoned arrows: elastic movements in invertebrates',
        doi_or_url: 'https://doi.org/10.1242/jeb.038596',
        context:
          'She is first author. Verbatim, whole opening sentence of the abstract, retrieved from PubMed. ' +
          'This is the claim we would want to help make machine-checkable.',
      },
      {
        quote: 'The Patek Lab is dedicated to biological discovery and multidisciplinary translation at the intersection of evolution and mechanics.',
        source_title: 'Patek Lab website (Evolutionary Biomechanics), Duke University',
        doi_or_url: 'https://pateklab.biology.duke.edu/',
        context:
          'Verbatim, whole sentence, read back from the raw bytes of the lab\'s own landing page. A ' +
          'lab-site statement, i.e. institutional voice rather than a sentence from a paper. The page ' +
          'continues: "We seek the unifying principles that guide, limit and promote the evolutionary ' +
          'diversity of biomechanical systems".',
      },
    ],
    public_record:
      'Lab site at pateklab.biology.duke.edu; a Duke Scholars profile; the three papers above; a TED ' +
      'mainstage talk on measuring the mantis shrimp strike (ted.com/talks/sheila_patek_the_shrimp_with_a_kick) ' +
      '- listings disagree about that talk\'s year and exact title, so neither is asserted here; public ' +
      'lectures including an NSF distinguished lecture and university evening lectures on extreme movement.',
    collaboration_angle: {
      the_exchange:
        'She can tell us whether a body our scorer calls plausible could actually do anything, and she has ' +
        'the high-speed measurement capability to settle it. We can offer the converse service: take one of ' +
        'her stated principles, write it as a proposition with units and a measurement procedure, and show ' +
        'where published specimens violate it. Our repository has already produced one case of a scorer ' +
        'calling a geometrically impossible animal typical; that is the kind of failure her data would catch.',
      what_we_must_bring:
        'Units, error bars, and a mechanism model she would recognise - not a plausibility score. Our ' +
        'physics layer currently returns inconclusive on most envelope questions, and we must say so rather ' +
        'than lead with the cases that worked. We must also bring the measurement procedure attached to ' +
        'every proposed constraint, because a constraint she cannot test is not a contribution.',
      concrete_first_step:
        'Formalise the time-limited muscle-versus-spring trade-off from the 2016 paper as a registry law ' +
        'with explicit units, then test it against our own organism inventory and report the violations.',
    },
    openness_evidence: [
      {
        kind: EVIDENCE_KINDS.STATED,
        evidence:
          'Her lab\'s own site describes its purpose as including "multidisciplinary translation", and ' +
          'carries a public-facing page on why the research matters - a stated outward orientation.',
        source: 'https://pateklab.biology.duke.edu/',
      },
      {
        kind: EVIDENCE_KINDS.INFERRED,
        evidence:
          'INFERENCE FROM THE PUBLIC RECORD: a sustained history of mainstage and public lectures, and ' +
          'coauthorship with engineers and physicists on the spring-dynamics work, is the profile of someone ' +
          'who explains the work across field boundaries. Inferred from the talk and publication record; not ' +
          'a statement about willingness to collaborate with us.',
        source: 'https://doi.org/10.1098/rspb.2016.1561',
      },
    ],
    caution:
      'Her field has a low tolerance for unmeasured claims, and our design scorer is currently an ' +
      'unmeasured claim. Approaching with a plausibility number and no units would be the worst possible ' +
      'opening. Our own physics thread has already recorded two of three envelope cases as inconclusive - ' +
      'bring that, not the third. Finally, her organisms are arthropods and crustaceans, so analogies to ' +
      'vertebrate body plans should be made carefully or not at all.',
  },

  {
    id: 'sponberg-simon',
    name: 'Simon Sponberg',
    institution: 'School of Physics and School of Biological Sciences, Georgia Institute of Technology, Atlanta, GA, USA',
    lab_url: 'https://sponberg.gatech.edu/',
    field: FIELD_CLUSTERS.BIOMECHANICS,
    why_relevant_to_delphi:
      'He is the person in this file who already works the way our Nous layer wants to: physics-trained, ' +
      'explicitly reaching for "the formal language of control theory" to state what a body-plus-nervous-' +
      'system can do. His 2011 result - that a single muscle\'s control authority over body dynamics is ' +
      'set by mechanical feedback rather than by the neural signal - is a constraint claim of exactly the ' +
      'form our registry should hold and cannot currently express.',
    flagship_papers: [
      {
        title: "Shifts in a single muscle's control potential of body dynamics are determined by mechanical feedback",
        year: 2011, journal: 'Philosophical Transactions of the Royal Society B: Biological Sciences',
        doi: '10.1098/rstb.2010.0368',
        why_it_matters:
          'A quantified statement about how much of an organism\'s behaviour one actuator can change. Our ' +
          'design surface implicitly assumes that changing a part changes the whole in a predictable way; ' +
          'this paper measures how badly that assumption fails.',
      },
      {
        title: 'The emergent physics of animal locomotion',
        year: 2017, journal: 'Physics Today', doi: '10.1063/pt.3.3691',
        why_it_matters:
          'A physicist\'s framing of locomotion for a physics audience. Useful to us as a model of how to ' +
          'present biological constraint claims to readers who will ask for the derivation.',
      },
      {
        title: 'Perturbing the muscle work loop paradigm to unravel the neuromechanics of unsteady locomotion',
        year: 2023, journal: 'Journal of Experimental Biology', doi: '10.1242/jeb.243561', pmid: '37042414',
        why_it_matters:
          'Organises a field\'s methods into two named approaches and states the limitations of each. That ' +
          'is a taxonomy of measurement validity - the thing our Aletheia layer is supposed to produce and ' +
          'mostly has not.',
      },
    ],
    key_figures_or_findings: [
      'The 2023 review classifies the field into a top-down approach (replay natural perturbed conditions ' +
        'in isolated muscle experiments) and a bottom-up approach (add complexity, load and feedback to an ' +
        'isolated work loop), and states that each in isolation has several limitations.',
      'Same review: the explicit remedy proposed is control theory as a shared formal language - a ' +
        'biomechanist independently reaching for formalisation.',
      'He is reported as a co-investigator on a six-year, $15 million NSF-funded institute on muscle ' +
        'control during agile movement (public institutional announcement, not a paper).',
    ],
    real_quotes: [
      {
        quote: 'Muscle function during movement is more than a simple, linear transformation of neural activity into force.',
        source_title: 'Perturbing the muscle work loop paradigm to unravel the neuromechanics of unsteady locomotion',
        doi_or_url: 'https://doi.org/10.1242/jeb.243561',
        context: 'He is first author. Verbatim, whole opening sentence of the abstract, retrieved from PubMed.',
      },
      {
        quote: 'new models and experimental methods coupled with the formal language of control theory give several avenues for synthesizing an understanding of muscle function under unsteady conditions',
        source_title: 'Perturbing the muscle work loop paradigm to unravel the neuromechanics of unsteady locomotion',
        doi_or_url: 'https://doi.org/10.1242/jeb.243561',
        context: 'Verbatim FRAGMENT of the closing sentence of the same abstract (the sentence begins "In isolation, each of these approaches has several limitations, but"). The hedge in the first half is his and matters.',
      },
    ],
    public_record:
      'Lab site at sponberg.gatech.edu (the Agile Systems Lab; the site labels its science "Forays into ' +
      'the world of movement"); Georgia Tech departmental pages giving the joint physics and biological ' +
      'sciences appointment; the public announcement of the NSF movement-sciences institute; the three ' +
      'papers above.',
    collaboration_angle: {
      the_exchange:
        'He already wants a formal language for what bodies can do. We have a Lean layer and a law ' +
        'registry. The overlap is unusually literal: take one neuromechanical constraint he has measured ' +
        'and produce a machine-checked statement of it, with the measurement procedure as a hypothesis of ' +
        'the theorem rather than a footnote.',
      what_we_must_bring:
        'A theorem whose English gloss actually matches its formal statement - our registry has produced ' +
        'the opposite failure before, and it is the failure he would notice first. We must also bring the ' +
        'proof artefacts, not a claim about them, and we must accept that control theory is his native ' +
        'language and Lean is not, so the formalisation has to be legible to him or it is useless.',
      concrete_first_step:
        'Formalise the mechanical-feedback-limits-control-authority claim from the 2011 paper and ask him ' +
        'whether the formal statement says what he measured. If the answer is no, that is the most valuable ' +
        'single result this collaboration could produce early.',
    },
    openness_evidence: [
      {
        kind: EVIDENCE_KINDS.STATED,
        evidence:
          'The 2023 review explicitly proposes control theory as a shared formal language for synthesising ' +
          'results across the field - a published call for formal, cross-disciplinary method.',
        source: 'https://doi.org/10.1242/jeb.243561',
      },
      {
        kind: EVIDENCE_KINDS.INFERRED,
        evidence:
          'INFERENCE FROM THE PUBLIC RECORD: a joint appointment across physics and biology, coauthorship ' +
          'with mechanical engineers, and co-investigator status on a large multi-institution institute are ' +
          'the marks of someone who already works in consortia. Inferred from appointments and bylines, not ' +
          'from any statement about collaborating with this project.',
        source: 'https://sponberg.gatech.edu/',
      },
    ],
    caution:
      'His standard of formalisation is a physicist\'s, which means our Lean statements would be judged on ' +
      'whether they say anything new, not on whether they compile. Our own record includes theorems that ' +
      'were sound and vacuous; bring that history. His systems are insects and human muscle, so our ' +
      'vertebrate-body-plan framing does not transfer automatically. We also have no experimental ' +
      'capability to offer and should not let "lab-in-the-loop" imply otherwise.',
  },

  // ------------------------------------------------- theoretical / mathematical biology, formalisation
  {
    id: 'fontana-walter',
    name: 'Walter Fontana',
    institution: 'Department of Systems Biology, Harvard Medical School, Boston, MA, USA',
    lab_url: 'https://fontana.hms.harvard.edu/',
    field: FIELD_CLUSTERS.THEORY,
    why_relevant_to_delphi:
      'The single closest match in this file to "machine-checkable biology" as an existing practice. ' +
      'Kappa is a rule-based language with a real analysis toolchain, built on the explicit requirement ' +
      'that a model be a transparent, formal and executable representation of the facts it rests on. His ' +
      '1998 work with Schuster is also the canonical treatment of a question our design surface silently ' +
      'assumes away: which phenotypes are reachable from which, and whether the map is continuous.',
    flagship_papers: [
      {
        title: 'Continuity in Evolution: On the Nature of Transitions',
        year: 1998, journal: 'Science', doi: '10.1126/science.280.5368.1451', pmid: '9603737',
        why_it_matters:
          'Defines nearness between phenotypes via accessibility through genotype change. That is the ' +
          'formal object our edit-list design surface needs and does not have: a metric on the space it ' +
          'claims to search.',
      },
      {
        title: 'The Kappa platform for rule-based modeling',
        year: 2018, journal: 'Bioinformatics', doi: '10.1093/bioinformatics/bty272',
        why_it_matters:
          'A working, maintained formal-methods toolchain for biology, with static analysis and causality ' +
          'extraction. Before we build our own, we should know exactly what this already does.',
      },
      {
        title: 'Sizing Up Allometric Scaling Theory',
        year: 2008, journal: 'PLoS Computational Biology', doi: '10.1371/journal.pcbi.1000171', pmid: '18787686',
        why_it_matters:
          'A formal audit of a famous biological law, with Savage. It shows how a scaling result\'s ' +
          'validity depends on an approximation regime nobody had stated - which is the characteristic ' +
          'failure mode of every law in our registry.',
      },
    ],
    key_figures_or_findings: [
      'The lab\'s stated current interests include using Kappa for "computational experiments" on ' +
        'energetics and statistical mechanics, extending causality analysis into organic chemistry, and ' +
        'revisiting genotype-to-phenotype mapping and plasticity - three of which overlap this project ' +
        'directly.',
      'The lab states that a large model still needs explaining, and names extracting explanations in order ' +
        'to simplify a model as a central challenge. That is the same problem as our registry\'s: a law you ' +
        'cannot read is not a law you can check.',
      'The 1998 paper reports that sudden adaptive progress coincides mostly, but not always, with ' +
        'discontinuous shape transformations, and assigns a key role to neutral genetic drift - a result ' +
        'that should temper any claim that a design search over edits maps smoothly onto form.',
    ],
    real_quotes: [
      {
        quote: 'a transparent, formal and executable representation of the facts it rests upon',
        source_title: 'Fontana Lab research page, Department of Systems Biology, Harvard Medical School',
        doi_or_url: 'https://fontana.hms.harvard.edu/research',
        context:
          'Verbatim FRAGMENT of a longer sentence on the lab\'s own research page (the sentence begins ' +
          '"Rather, we require that a good model be at least one that is"). Lab-site voice, fetched for ' +
          'this file. Quoted because it is the design requirement our proof layer should be held to.',
      },
      {
        quote: 'To distinguish continuous from discontinuous evolutionary change, a relation of nearness between phenotypes is needed.',
        source_title: 'Continuity in Evolution: On the Nature of Transitions',
        doi_or_url: 'https://doi.org/10.1126/science.280.5368.1451',
        context: 'Verbatim, whole opening sentence of the abstract, retrieved from PubMed. He is first author.',
      },
    ],
    public_record:
      'Lab site at fontana.hms.harvard.edu, including a research page that states the lab\'s model-quality ' +
      'requirement and its current interests and describes its approach as computational and theoretical; ' +
      'the Kappa platform and its documentation; the three papers above.',
    collaboration_angle: {
      the_exchange:
        'He has two decades of experience with the exact failure mode our Nous layer is most exposed to: a ' +
        'formal model that is sound, executable, and says nothing. He also has the toolchain. The exchange ' +
        'is that we bring a domain - whole-organism form and constraint - that Kappa has not been pointed ' +
        'at, and a corpus of candidate laws to formalise.',
      what_we_must_bring:
        'An honest account of our registry\'s vacuity problem, including the cases where the Lean matched ' +
        'the symbols but not the English. We must also bring a concrete formalisation target rather than a ' +
        'request for advice, and we must be prepared to hear that Kappa is the wrong formalism for ' +
        'whole-organism geometry - which it may well be, since its native objects are molecular ' +
        'interactions, not bodies.',
      concrete_first_step:
        'Attempt one of our registry laws in Kappa, or in a Kappa-style rule formalism, and write up ' +
        'precisely where the formalism refuses to express it. A clean refusal is the result we want.',
    },
    openness_evidence: [
      {
        kind: EVIDENCE_KINDS.STATED,
        evidence:
          'The lab\'s research page names an active external collaboration on extending causality analysis ' +
          'to organic chemistry with the developers of another tool, and Kappa is distributed as a public ' +
          'platform with a published methods paper.',
        source: 'https://fontana.hms.harvard.edu/research',
      },
      {
        kind: EVIDENCE_KINDS.INFERRED,
        evidence:
          'INFERENCE FROM THE PUBLICATION RECORD: he coauthored a formal critique of an allometric scaling ' +
          'theory outside his own molecular domain, with an ecologist-physicist, which is evidence of ' +
          'willingness to formalise someone else\'s biology. Our inference from that byline, not a stated ' +
          'intention.',
        source: 'https://doi.org/10.1371/journal.pcbi.1000171',
      },
    ],
    caution:
      'Kappa\'s native subject is molecular interaction networks; whole-organism morphology is not obviously ' +
      'in its range, and pretending otherwise would waste the introduction. The 1998 Science work is nearly ' +
      'three decades old and should be cited as foundational, not current. Most importantly: a lab whose ' +
      'stated standard is transparency and executability will read our registry quickly, and what it will ' +
      'find first is the vacuity. Lead with that rather than being caught by it.',
  },

  {
    id: 'savage-van',
    name: 'Van Savage',
    institution: 'Department of Ecology and Evolutionary Biology and Department of Computational Medicine, University of California, Los Angeles, CA, USA; external faculty, Santa Fe Institute',
    lab_url: 'https://savagelab.eeb.ucla.edu/',
    field: FIELD_CLUSTERS.THEORY,
    why_relevant_to_delphi:
      'He is the person who took the most famous quantitative law in biology and asked what its ' +
      'derivation actually licenses. The answer - that the canonical 3/4 exponent holds only in an ' +
      'infinite-size limit, and that a finite-size treatment predicts something else - is the single best ' +
      'cautionary case for a project building a registry of biological laws. Goal two, in its most ' +
      'uncomfortable form.',
    flagship_papers: [
      {
        title: 'The predominance of quarter-power scaling in biology',
        year: 2004, journal: 'Functional Ecology', doi: '10.1111/j.0269-8463.2004.00856.x',
        why_it_matters:
          'The empirical case FOR the law, by the same person who later audited it. Read with the 2008 ' +
          'paper, the pair is a worked example of holding a law and its limits at once.',
      },
      {
        title: 'Sizing Up Allometric Scaling Theory',
        year: 2008, journal: 'PLoS Computational Biology', doi: '10.1371/journal.pcbi.1000171', pmid: '18787686',
        why_it_matters:
          'Derives the finite-size corrections and shows the predicted exponent moves to about 0.81 over ' +
          'the mammalian size range. A law that changes value when you state its approximation regime is ' +
          'exactly what our registry must be able to represent and currently cannot.',
      },
      {
        title: 'Curvature in metabolic scaling',
        year: 2010, journal: 'Nature', doi: '10.1038/nature08920',
        why_it_matters:
          'The empirical follow-through: the relationship is not a straight line in log-log space. Any ' +
          'scaling law our scorer applies as a single exponent is, on this evidence, wrong in a measurable ' +
          'way.',
      },
    ],
    key_figures_or_findings: [
      'The 2008 paper identifies eight assumptions underlying the canonical model and tests the exponent\'s ' +
        'sensitivity to each in the presence of finite-size corrections, reporting that several derived ' +
        'trends also appear at odds with data.',
      'Its own closing assessment is that the framework remains useful for reasoning about allometric ' +
        'scaling while the canonical model may need amendments - a both/and verdict, which is the kind our ' +
        'registry tends to flatten into a yes or a no.',
      'The 2010 Nature paper and the 2008 audit share coauthors with the Fontana lab, which means a ' +
        'formal-methods route into this material already exists.',
    ],
    real_quotes: [
      {
        quote: 'Failure to clarify and to explore the nature of this approximation has led to debates about the WBE model that were at cross purposes.',
        source_title: 'Sizing Up Allometric Scaling Theory',
        doi_or_url: 'https://doi.org/10.1371/journal.pcbi.1000171',
        context:
          'He is first author. Verbatim, whole sentence, from the abstract (retrieved from PubMed and ' +
          'confirmed against the open-access full text). Quoted because it describes, exactly, how a law ' +
          'registry without stated approximation regimes generates argument instead of knowledge.',
      },
      {
        quote: 'the WBE model predicts a scaling exponent of 0.81, seemingly at odds with data',
        source_title: 'Sizing Up Allometric Scaling Theory',
        doi_or_url: 'https://doi.org/10.1371/journal.pcbi.1000171',
        context: 'Verbatim FRAGMENT of a longer sentence in the same abstract (the sentence begins "When accounting for these corrections over a size range spanning the eight orders of magnitude observed in mammals,").',
      },
      {
        quote: 'Our work illustrates the utility of the WBE framework in reasoning about allometric scaling, while at the same time suggesting that the current canonical model may need amendments to bring its predictions fully in line with available datasets.',
        source_title: 'Sizing Up Allometric Scaling Theory',
        doi_or_url: 'https://doi.org/10.1371/journal.pcbi.1000171',
        context: 'Verbatim, whole closing sentence of the same abstract.',
      },
    ],
    public_record:
      'Lab site at savagelab.eeb.ucla.edu (the site carries news, publications and software - Angicart for ' +
      'vasculature from 3D images, Biotraits for temperature responses - but no prose research statement, ' +
      'so none is quoted); a Santa Fe Institute profile; UCLA departmental pages; a publicly posted ' +
      'research statement and CV linked from the lab site; the three papers above.',
    collaboration_angle: {
      the_exchange:
        'Every law in our registry has an unstated domain of validity, and he has published the canonical ' +
        'demonstration of what that costs. What we can offer in return is machinery he does not have: a ' +
        'place to record a law together with its approximation regime, its derivation assumptions, and a ' +
        'machine-checkable statement of which of them a given application relies on.',
      what_we_must_bring:
        'Our registry\'s scaling laws with their assumption sets made explicit, and the admission that we ' +
        'currently store exponents without regimes. We must bring a schema he would accept, not a request ' +
        'that he adapt to ours. We should also expect to be asked for data, and we have none of our own at ' +
        'the scale his work uses.',
      concrete_first_step:
        'Take one scaling law in our registry, attach its eight-assumption provenance in the style of the ' +
        '2008 paper, and show what our scorer does differently once the regime is stated. If nothing ' +
        'changes, the law was decorative.',
    },
    openness_evidence: [
      {
        kind: EVIDENCE_KINDS.STATED,
        evidence:
          'His lab distributes named software tools publicly (Angicart, Biotraits) from the lab site, and ' +
          'he holds an external faculty position at an institute whose stated purpose is cross-disciplinary ' +
          'theory.',
        source: 'https://savagelab.eeb.ucla.edu/',
        caveat: 'Institutional and software-distribution facts; not a personal statement about collaborating.',
      },
      {
        kind: EVIDENCE_KINDS.INFERRED,
        evidence:
          'INFERENCE FROM THE PUBLICATION RECORD: he published both the strongest empirical case for ' +
          'quarter-power scaling and the audit that undercut its derivation. We read that as a researcher ' +
          'who will engage a formal challenge to a result he is associated with. Inferred from the two ' +
          'papers; he has stated nothing of the kind.',
        source: 'https://doi.org/10.1371/journal.pcbi.1000171',
      },
    ],
    caution:
      'Metabolic scaling is one of the most acrimonious disputes in quantitative biology and we have no ' +
      'standing in it; arriving with an opinion rather than a tool would be a mistake. The 2008 paper is a ' +
      'critique of a model he also helped support, so citing it as "Savage refutes scaling" misrepresents ' +
      'both him and the paper. And his lab page has no research prose, so the profile rests on papers plus ' +
      'a linked CV - no stated collaboration posture was found.',
  },

  // --------------------------------------------------------------------- origins of life / protocells
  {
    id: 'adamala-kate',
    name: 'Katarzyna (Kate) Adamala',
    institution: 'Department of Genetics, Cell Biology, and Development, University of Minnesota, Twin Cities, Minneapolis, MN, USA',
    lab_url: 'https://protobiology.org/',
    field: FIELD_CLUSTERS.ORIGINS,
    why_relevant_to_delphi:
      'She bridges the two things we are worst at. Her protocell work is squarely goal three; her ' +
      'synthetic-minimal-cell work is a buildable, programmable living system that is neither a genome ' +
      'edit nor an organoid - i.e. the same category of object as a xenobot, approached from chemistry. ' +
      'And she co-founded an explicitly open community for exactly this, which is a real, stated door ' +
      'rather than an inferred one.',
    flagship_papers: [
      {
        title: 'Nonenzymatic Template-Directed RNA Synthesis Inside Model Protocells',
        year: 2013, journal: 'Science', doi: '10.1126/science.1241888', pmid: '24288333',
        why_it_matters:
          'Solves a specific blocking incompatibility - magnesium needed for RNA copying destroys fatty ' +
          'acid membranes - by adding citrate. A clean example of a constraint that is not in any genome ' +
          'and that no sequence-level design surface could have found.',
      },
      {
        title: 'Present and future of synthetic cell development',
        year: 2023, journal: 'Nature Reviews Molecular Cell Biology', doi: '10.1038/s41580-023-00686-9', pmid: '38102450',
        why_it_matters:
          'A six-author field roadmap. Useful as the current consensus statement of what a built cell can ' +
          'and cannot yet do - the honest baseline any claim of ours about designed organisms has to sit ' +
          'beside.',
      },
    ],
    key_figures_or_findings: [
      'The 2013 result: citrate protects fatty acid membranes from high magnesium while still allowing RNA ' +
        'copying, and also protects single-stranded RNA from magnesium-catalysed degradation - one additive ' +
        'resolving two antagonistic requirements at once.',
      'Her lab\'s own site describes synthetic minimal cells as "programmable liposomal bioreactors capable ' +
        'of expressing proteins from DNA (or RNA) genome" and lists origins of life, biocomputing, space ' +
        'biology and astrobiology among its areas.',
      'The Build-a-Cell community, which the lab site names her as co-founder and leader of, describes ' +
        'itself as "Open collaboration supporting the science and engineering of building synthetic cells", ' +
        'runs free open workshops and a weekly seminar series, and is NSF-funded as a Research Coordination ' +
        'Network (award 1901145).',
    ],
    real_quotes: [
      {
        quote: 'This combination of properties has allowed us to demonstrate the chemical copying of RNA templates inside fatty acid vesicles',
        source_title: 'Nonenzymatic Template-Directed RNA Synthesis Inside Model Protocells',
        doi_or_url: 'https://doi.org/10.1126/science.1241888',
        context: 'She is first author. Verbatim FRAGMENT of the closing sentence of the abstract, retrieved from PubMed (the sentence continues about copying efficiency).',
      },
      {
        quote: 'Synthetic minimal cells are programmable liposomal bioreactors capable of expressing proteins from DNA (or RNA) genome.',
        source_title: 'Adamala Lab website ("Prototyping biology")',
        doi_or_url: 'https://protobiology.org/',
        context:
          'Verbatim, whole sentence, from the lab\'s own site as fetched for this file. Lab-site voice. ' +
          'Note the site does not name an institution; the affiliation above comes from her 2023 paper\'s ' +
          'byline instead.',
      },
    ],
    public_record:
      'Lab site at protobiology.org; the public pages of the Build-a-Cell community, which name her as ' +
      'co-founder; the two papers above and their bylines; the NSF Research Coordination Network award ' +
      'recorded on the Build-a-Cell site.',
    collaboration_angle: {
      the_exchange:
        'Honestly: thin on our side, and this is the cluster where we should say so loudest. What we could ' +
        'plausibly offer is bookkeeping rather than biology - a formal record of the antagonistic ' +
        'constraints a built cell has to satisfy simultaneously (the magnesium-versus-membrane shape of ' +
        'problem), with provenance, so that a constraint satisfied in one subsystem is not quietly ' +
        'reintroduced by another.',
      what_we_must_bring:
        'An admission that we have nothing to offer origins-of-life research today, followed by one small ' +
        'concrete thing rather than a vision. Build-a-Cell is open, which makes the right move ' +
        'participation on their terms - attend, listen, contribute a tool if one turns out to be wanted - ' +
        'not a collaboration proposal. We must NOT present our organism format as relevant: it represents ' +
        'genomes and geometry of extant organisms and has no way to describe a protocell.',
      concrete_first_step:
        'Join the open community as a participant, not a proposer, and attempt one machine-checkable ' +
        'statement of a published protocell compatibility constraint. If nobody wants it, that is the ' +
        'answer.',
    },
    openness_evidence: [
      {
        kind: EVIDENCE_KINDS.STATED,
        evidence:
          'Build-a-Cell, which she co-founded, states on its own site that it is "an open community ' +
          'supporting people working together to build a diversity of synthetic cells", that its workshops ' +
          'are free and open to anyone interested in cell-building, and it invites people to join its ' +
          'working groups, seminar series and mentorship programme.',
        source: 'https://www.buildacell.org/',
        caveat: 'A community statement for a community she co-founded, not a personal statement about this project.',
      },
      {
        kind: EVIDENCE_KINDS.INFERRED,
        evidence:
          'INFERENCE FROM THE PUBLIC RECORD: the 2023 roadmap has six authors across five countries and ' +
          'four disciplines, and her lab site lists areas spanning biocomputing, space biology and ' +
          'astrobiology. We read that breadth as receptiveness to unfamiliar collaborators. Inferred from ' +
          'the byline and the lab site, not stated.',
        source: 'https://doi.org/10.1038/s41580-023-00686-9',
      },
    ],
    caution:
      'The honest position is that we have nothing they need, and the brief says to acknowledge that; ' +
      'this profile should not be read as a pitch. Her 2013 first-author work was done at a different ' +
      'institution from her current one, so the paper byline and the current affiliation differ - do not ' +
      'conflate them. Her lab site names no institution, so the affiliation here comes from a paper ' +
      'byline. And Build-a-Cell\'s openness is a property of a community, not a personal commitment: ' +
      'joining a community is not the same as having a collaborator.',
  },

  {
    id: 'otto-sijbren',
    name: 'Sijbren Otto',
    institution: 'Centre for Systems Chemistry, Stratingh Institute for Chemistry, University of Groningen, Groningen, the Netherlands',
    lab_url: 'https://otto-lab.com/',
    field: FIELD_CLUSTERS.ORIGINS,
    why_relevant_to_delphi:
      'He has a running system in which replication, selection, diversification and the beginnings of ' +
      'metabolism all emerge from molecules nobody designed for the purpose - and, critically, he reports ' +
      'the DIRECTION the system drifts without intervention: toward lower complexity, because smaller ' +
      'replicators replicate faster. That is a constraint on open-ended design that no genome-level model ' +
      'contains, and it is the kind of statement our registry should be able to hold.',
    flagship_papers: [
      {
        title: 'Mechanosensitive Self-Replication Driven by Self-Organization',
        year: 2010, journal: 'Science', doi: '10.1126/science.1182767',
        why_it_matters:
          'The founding result: self-assembly in a mixture of interconverting oligomers produces ' +
          'self-replication, with mechanical agitation driving exponential growth. Replication as a ' +
          'consequence of physical organisation, not of encoded instructions.',
      },
      {
        title: 'An Approach to the De Novo Synthesis of Life',
        year: 2021, journal: 'Accounts of Chemical Research', doi: '10.1021/acs.accounts.1c00534', pmid: '34964346',
        why_it_matters:
          'The programme statement, and unusually explicit about what remains undone: compartmentalisation ' +
          'and open-ended evolution. A model for how to write a roadmap that names its own holes.',
      },
    ],
    key_figures_or_findings: [
      'The replicator systems show spontaneous diversification onto different food sets, history dependence ' +
        'of replicator composition, and the spontaneous emergence of parasitic behaviour - three ' +
        'population-level phenomena arising with no genome at all.',
      'Peptide-based replicator assemblies were found to organise their peptide units so as to create ' +
        'microenvironments capable of catalysis, including of the reactions producing their own precursors ' +
        '- reported as the first examples of assimilating a proto-metabolism.',
      'Operating the replicators in a chemically fuelled out-of-equilibrium replication-destruction regime ' +
        'promoted increases in molecular complexity, counteracting an inherent drift toward lower ' +
        'complexity. The drift direction is the transferable finding.',
    ],
    real_quotes: [
      {
        quote: 'Among these, life represents perhaps the ultimate synthetic challenge.',
        source_title: 'An Approach to the De Novo Synthesis of Life',
        doi_or_url: 'https://doi.org/10.1021/acs.accounts.1c00534',
        context: 'Sole-author Account. Verbatim, whole sentence, from the Conspectus, read from the open-access full text.',
      },
      {
        quote: 'Fueling counteracts the inherent tendency of replicators to evolve toward lower complexity (caused by the fact that smaller replicators tend to replicate faster).',
        source_title: 'An Approach to the De Novo Synthesis of Life',
        doi_or_url: 'https://doi.org/10.1021/acs.accounts.1c00534',
        context:
          'Verbatim, whole sentence, including his parenthesis, from the same Conspectus. This is the ' +
          'sentence most worth formalising: a stated constraint with a stated mechanism and a stated ' +
          'intervention that lifts it.',
      },
      {
        quote: 'We are interested in a variety of subjects at the interface of chemistry, biology, and the synthesis of life.',
        source_title: 'Otto Research Group website',
        doi_or_url: 'https://otto-lab.com/',
        context: 'Verbatim, whole sentence, from the group\'s own site as fetched for this file. Group-site voice, not a paper.',
      },
    ],
    public_record:
      'Group site at otto-lab.com; a University of Groningen staff page listing systems chemistry, origin ' +
      'of life, catalysis and supramolecular chemistry as his expertise; the two papers above; public ' +
      'colloquium listings on the de novo synthesis of life.',
    collaboration_angle: {
      the_exchange:
        'His programme generates exactly the kind of statement our Nous layer is for: a directional claim ' +
        'about how a population of replicators drifts, with a named cause and a named counter-measure. We ' +
        'could offer a formal statement of that claim and of the conditions under which it holds. In return ' +
        'we would get a constraint that is substrate-independent, which is rare and valuable for a registry ' +
        'otherwise full of vertebrate-specific laws.',
      what_we_must_bring:
        'A formalisation that a chemist would recognise as his claim, and nothing else. We must bring the ' +
        'explicit acknowledgement that we have no chemistry, no wet lab, and no prior work on ' +
        'non-genomic replicators, and that this is us asking to learn. We must also avoid implying our ' +
        'organism format applies - it cannot represent a replicator with no genome.',
      concrete_first_step:
        'Write the complexity-drift claim as a formal proposition with its hypotheses explicit (replication ' +
        'rate decreasing in size; fuelling regime) and check whether the formal statement is strong enough ' +
        'to be interesting or so hedged it is vacuous. Report either way.',
    },
    openness_evidence: [
      {
        kind: EVIDENCE_KINDS.STATED,
        evidence:
          'His group site states an interest spanning "the interface of chemistry, biology, and the ' +
          'synthesis of life", and the 2021 Account is explicitly framed as a roadmap with named remaining ' +
          'steps - a published invitation to the rest of the problem.',
        source: 'https://otto-lab.com/',
      },
      {
        kind: EVIDENCE_KINDS.INFERRED,
        evidence:
          'INFERENCE FROM THE PUBLIC RECORD: his staff page lists an editor-in-chief role for a systems ' +
          'chemistry journal, and the 2010 Science paper has six authors across chemistry subfields. We ' +
          'read field-building and multi-author practice as openness to outside contributions; this is our ' +
          'inference, not a statement.',
        source: 'https://doi.org/10.1126/science.1182767',
      },
    ],
    caution:
      'Like the rest of this cluster, we have nothing to offer him today, and the gap is larger here ' +
      'because the substrate is chemistry rather than cells. Systems chemistry has its own formalisms and ' +
      'may regard an external proof layer as solving a problem it does not have. The complexity-drift claim ' +
      'is reported for his specific replicator systems; generalising it into a universal law would be ' +
      'precisely the overreach our registry is supposed to prevent.',
  },

]);

// ===================================================================================================
// WHY THESE FIELDS - frozen
// ===================================================================================================

/**
 * Each cluster mapped to the project goal it serves and the Delphi/Nous/Aletheia layer it belongs to.
 * The layer naming follows devlog/framework.mjs: Delphi = generation, Nous = inference,
 * Aletheia = disclosure.
 */
export const WHY_THESE_FIELDS = deepFreeze({
  [FIELD_CLUSTERS.XENOBOTS]: {
    cluster: FIELD_CLUSTERS.XENOBOTS,
    goal: GOALS.BIOMATERIALS,
    also_serves: [GOALS.LAWS],
    layer: LAYERS.DELPHI,
    layer_name: 'Delphi',
    why:
      'This cluster IS goal one. "Agentic biomaterials" has no other referent in the current literature: ' +
      'organisms assembled from cells whose agency does the construction, with no genome edit anywhere in ' +
      'the pipeline. It sits in the generation layer because what it supplies is a design surface - and it ' +
      'is the layer where we are most exposed, because our generator cannot address that surface at all. ' +
      'It also serves goal two, since the field\'s own stated purpose includes finding what shapes cells ' +
      'can be induced to adopt, which is a constraint discovery programme.',
    what_it_would_change_here:
      'It would force the organism format to acquire a representation of cell ARRANGEMENT as an input, not ' +
      'just as stored geometry, and would force the generator to have an operator that proposes one.',
  },
  [FIELD_CLUSTERS.ORTHOLOGY]: {
    cluster: FIELD_CLUSTERS.ORTHOLOGY,
    goal: GOALS.LAWS,
    also_serves: [GOALS.BIOMATERIALS],
    layer: LAYERS.NOUS,
    layer_name: 'Nous',
    why:
      'The ortholog conjecture is a biological "law" that our analogy module uses as a premise in an ' +
      'inference: this gene is the orthologue, therefore it does that job here too. The literature does ' +
      'not come out cleanly - one careful study finds the conjecture holds weakly after bias correction, ' +
      'another finds strong evidence against it in the prediction setting - so the premise is not safe. ' +
      'That makes this an inference-layer problem: the question is not what the world is but what follows ' +
      'from what, and the answer is less than we assumed.',
    what_it_would_change_here:
      'It would turn the orthologue step from an unstated premise into a stated one with a measured ' +
      'reliability, and it would force the four annotation confounders into our code.',
  },
  [FIELD_CLUSTERS.BIOMECHANICS]: {
    cluster: FIELD_CLUSTERS.BIOMECHANICS,
    goal: GOALS.LAWS,
    also_serves: [GOALS.BIOMATERIALS],
    layer: LAYERS.ALETHEIA,
    layer_name: 'Aletheia',
    why:
      'These are the people who can say NO on evidence about a body plan. They measure what a shape can ' +
      'actually do, in units, with error bars. That is the disclosure layer\'s entire job: not to propose ' +
      'and not to derive, but to measure against the world and refuse. Our repository already contains the ' +
      'failure this cluster exists to catch - a design scorer calling a geometrically impossible animal ' +
      'typical - and only a measurement could catch it.',
    what_it_would_change_here:
      'It would attach a measurement procedure to every geometric or performance constraint we assert, so ' +
      'that a constraint which cannot be tested is visibly marked as untested rather than scored.',
  },
  [FIELD_CLUSTERS.THEORY]: {
    cluster: FIELD_CLUSTERS.THEORY,
    goal: GOALS.LAWS,
    also_serves: [GOALS.OPEN_QUESTIONS],
    layer: LAYERS.NOUS,
    layer_name: 'Nous',
    why:
      'Goal two is reverse-engineering biological laws, and this cluster is the only one with a track ' +
      'record of auditing what a biological law\'s derivation actually licenses - finite-size corrections ' +
      'to a scaling exponent, accessibility metrics on phenotype space, rule-based formalisms with static ' +
      'analysis behind them. It is squarely the inference layer, and it is where our characteristic ' +
      'failure lives: a theorem can be sound, compile, and say nothing, or say something other than its ' +
      'English gloss.',
    what_it_would_change_here:
      'It would require every law in the registry to carry its approximation regime and assumption set, ' +
      'and would supply an external standard for whether a formalisation is non-vacuous.',
  },
  [FIELD_CLUSTERS.ORIGINS]: {
    cluster: FIELD_CLUSTERS.ORIGINS,
    goal: GOALS.OPEN_QUESTIONS,
    also_serves: [GOALS.BIOMATERIALS],
    layer: LAYERS.ALETHEIA,
    layer_name: 'Aletheia',
    why:
      'Goal three names origins of life explicitly. It belongs to the disclosure layer for the reason this ' +
      'repository has already recorded: it is the limiting case of aletheia as un-forgetting. The event ' +
      'left almost no record, and the record it left has been overwritten by its own descendants, so the ' +
      'honest output is mostly a careful account of what is not known. It also touches goal one, because a ' +
      'protocell is a living system built without a genome to edit - the same category of object as a ' +
      'biobot, reached from chemistry.',
    what_it_would_change_here:
      'Almost nothing, today, and that is the point: it is the cluster where the correct contribution is ' +
      'to listen and to mark what we cannot represent. See THE_HONEST_GAP.',
  },
});

// ===================================================================================================
// THE HONEST GAP - frozen
// ===================================================================================================

/**
 * What we would be unable to offer a partner in each cluster TODAY. Written so that a partner reading it
 * would recognise their own field's description, and so that nobody on this side can later claim they
 * were not told.
 */
export const THE_HONEST_GAP = deepFreeze({
  by_cluster: {
    [FIELD_CLUSTERS.XENOBOTS]: {
      cluster: FIELD_CLUSTERS.XENOBOTS,
      what_a_partner_would_want:
        'A system that proposes a construct: these cell types, in this arrangement, at this scale, ' +
        'predicted to do this - and a buildability filter that rules out the arrangements their wet lab ' +
        'cannot realise.',
      what_we_have:
        'An organism format that can STORE a genome and per-cell geometry, a simulation engine, a design ' +
        'scorer, a law registry, a Lean layer, and a holdout.',
      what_we_cannot_offer_today:
        'The design surface itself. Our generator\'s output is an EDIT LIST AGAINST A REFERENCE ASSEMBLY. ' +
        'Every proposal it can make has the form "change this base, this gene, this allele in an existing ' +
        'organism". NOTHING IN THE PIPELINE CAN PROPOSE A CELL ARRANGEMENT. The formats represent genomes ' +
        'and they represent per-cell geometry, but geometry is only ever read back from something that ' +
        'already exists; there is no operator anywhere that takes a desired behaviour and emits a spatial ' +
        'configuration of cells. Since a cell arrangement is THE ENTIRE DESIGN SURFACE for this field, we ' +
        'cannot express a single candidate design in it. Not badly - at all.',
      the_blunt_version:
        'We cannot say "take these cells and put them there". That sentence is the field, and our ' +
        'vocabulary has no way to write it down. On this cluster we are not a weaker design partner, we ' +
        'are not a design partner.',
      what_we_could_honestly_offer_instead:
        'The constraint and audit side: formalising a buildability filter, recording provenance, stating a ' +
        'morphology-to-behaviour claim precisely enough to be falsified by their next build. Useful, ' +
        'secondary, and not what they would ask for first.',
      what_would_have_to_change:
        'A representation whose primitive is a positioned cell population rather than a sequence variant, ' +
        'and a generator with a proposal operator over that representation. That is new work, not a ' +
        'configuration change.',
    },
    [FIELD_CLUSTERS.ORTHOLOGY]: {
      cluster: FIELD_CLUSTERS.ORTHOLOGY,
      what_a_partner_would_want:
        'A method submitted to a shared benchmark, with controls for the known annotation biases, and a ' +
        'clear separation between claims about how function evolves and claims about how to predict it.',
      what_we_have: 'An analogy module that maps a requested trait onto an orthologue and scores the mapping.',
      what_we_cannot_offer_today:
        'A benchmarked orthology method, or any external validation of our orthologue calls. We control for ' +
        'none of the four confounders the 2012 paper enumerates, we do not distinguish graph-based from ' +
        'tree-based orthology, and we have never submitted anything to the community benchmark. We also ' +
        'have no functional data of our own - every number we would bring is derived from their resources.',
      the_blunt_version:
        'We are a consumer of this field\'s output that has never been measured by this field\'s yardstick, ' +
        'and we are using as a premise a conjecture that two careful groups cannot agree on.',
      what_we_could_honestly_offer_instead:
        'Ourselves as a test case: run our module against the benchmark, publish the failures, and ' +
        'contribute the negative result. That is a real contribution and it costs them almost nothing.',
      what_would_have_to_change:
        'Implement the bias controls, split the evolution question from the prediction question in our own ' +
        'code, and stop ranking orthologues first until we can show it helps.',
    },
    [FIELD_CLUSTERS.BIOMECHANICS]: {
      cluster: FIELD_CLUSTERS.BIOMECHANICS,
      what_a_partner_would_want:
        'Predictions with units, error bars, and a mechanism - something a high-speed camera or a force ' +
        'plate could contradict.',
      what_we_have:
        'A design scorer, a physics layer, and a glide/envelope analysis that returned inconclusive on most ' +
        'of what it was asked.',
      what_we_cannot_offer_today:
        'A performance prediction anyone could falsify. Our scores are relative plausibility, not forces, ' +
        'velocities or powers. Most of our envelope results are inconclusive, and our one documented ' +
        'scorer failure was a body plan that is geometrically impossible being ranked as typical - which ' +
        'means the scorer was not measuring mechanics at all. We have no experimental capability ' +
        'whatsoever: no specimens, no rig, no measurements of our own.',
      the_blunt_version:
        'We would be asking them to measure our guesses. That is a legitimate thing to ask for, but it is ' +
        'a favour, not a collaboration, until we can state a constraint with units and a procedure.',
      what_we_could_honestly_offer_instead:
        'Formalisation of their own principles into checkable constraints with explicit measurement ' +
        'procedures, plus a systematic search of our inventory for specimens that violate them.',
      what_would_have_to_change:
        'Dimensional quantities throughout the scorer, an uncertainty model, and a rule that an untestable ' +
        'constraint is marked not-established rather than scored.',
    },
    [FIELD_CLUSTERS.THEORY]: {
      cluster: FIELD_CLUSTERS.THEORY,
      what_a_partner_would_want:
        'Formal statements that are non-vacuous, whose informal glosses match their formal content, and ' +
        'whose domains of validity are explicit.',
      what_we_have: 'A 62-law registry, a Lean layer with proved theorems, and mutation benchmarks over them.',
      what_we_cannot_offer_today:
        'An assurance that our formal statements say what we claim. Our registry stores laws WITHOUT their ' +
        'approximation regimes, which is exactly the failure the finite-size scaling audit documents. Our ' +
        'own recorded failure mode is a theorem that is sound and says nothing, and its quieter cousin - a ' +
        'theorem whose English gloss does not match its formal statement - passes every check we currently ' +
        'have. Several of our flagship results are marked inconclusive.',
      the_blunt_version:
        'A formal-methods partner would read our registry and find the vacuity before we finished ' +
        'describing it. We should lead with that rather than be caught by it.',
      what_we_could_honestly_offer_instead:
        'A domain they have not formalised - whole-organism form and constraint - and a corpus of candidate ' +
        'laws, offered as material to be stress-tested rather than as results.',
      what_would_have_to_change:
        'Approximation regimes and assumption sets as required fields on every registry law, and a ' +
        'gloss-versus-formal-content check that can actually fail.',
    },
    [FIELD_CLUSTERS.ORIGINS]: {
      cluster: FIELD_CLUSTERS.ORIGINS,
      what_a_partner_would_want:
        'Chemistry, or a formalism that already handles non-genomic replicators and out-of-equilibrium ' +
        'systems, or data.',
      what_we_have: 'None of those.',
      what_we_cannot_offer_today:
        'We have nothing to offer this field yet, and that is the whole of the honest answer. No chemistry, ' +
        'no protocell capability, no out-of-equilibrium modelling, ' +
        'and no representation that can describe a replicator with no genome - our organism format\'s ' +
        'primitives are a reference assembly and its variants, which presupposes exactly the thing origins ' +
        'research is trying to explain the arrival of. Goal three names this field and we come to it ' +
        'empty-handed.',
      the_blunt_version:
        'We should not approach this cluster as a collaborator. We should approach it as a student, ' +
        'through the open community that already exists, and we should say in the first sentence that we ' +
        'have nothing to offer yet.',
      what_we_could_honestly_offer_instead:
        'At most, bookkeeping: a formal record of mutually antagonistic constraints a built system must ' +
        'satisfy at once, with provenance, so a requirement satisfied in one subsystem is not silently ' +
        'violated by another. Offered, not proposed.',
      what_would_have_to_change:
        'A representation whose primitive is a population of interconverting molecules rather than a ' +
        'genome. That is a different project, not an extension of this one.',
    },
  },
  the_sharpest_one:
    'Xenobots. Our formats represent genomes and they represent per-cell geometry, but NOTHING IN THE ' +
    'PIPELINE CAN PROPOSE A CELL ARRANGEMENT - and a cell arrangement is the entire design surface for ' +
    'that field. Our generator emits edit lists against a reference assembly, so every design it can ' +
    'express presupposes an organism that already has the body we would be trying to specify. The field ' +
    'our first stated goal points at is the one field whose design problem we cannot write down.',
  the_rule:
    'Each gap above is stated in the terms a partner in that field would use, and names the specific ' +
    'missing capability rather than a general shortfall. A gap described vaguely enough to sound modest ' +
    'is a gap being hidden.',
});

// ===================================================================================================
// VERIFICATION AND PROVENANCE
// ===================================================================================================

/** Every DOI cited in this file, once each, in the order the candidates appear. */
export const ALL_DOIS = deepFreeze([...new Set(
  CANDIDATES.flatMap((c) => c.flagship_papers.map((p) => p.doi)),
)]);

/** Convenience: resolvable links for every cited article, as the PubMed terms of use require. */
export const DOI_LINKS = deepFreeze(ALL_DOIS.map((d) => `https://doi.org/${d}`));

/** How the identifiers in this file were checked, and what the check returned. */
export const DOI_VERIFICATION = deepFreeze({
  checked_on: '2026-11-06/2026-11-07 (one working session, which crossed the date boundary)',
  method:
    'Each paper was first LOCATED by bibliographic query against api.crossref.org/works (never by ' +
    'guessing a DOI string), then the returned DOI was re-fetched individually at ' +
    'api.crossref.org/works/{doi} and its title, year, container title and author surnames were read back ' +
    'and compared against what this file claims. PMIDs were obtained from PubMed via its MCP tool, which ' +
    'also returned the DOI for each record; the two agreed in every case.',
  distinct_dois_cited: 30,
  resolved_against_crossref: 30,
  failed_to_resolve: 0,
  notes: [
    'Three DOIs returned HTTP 429 on the first pass and resolved on a rate-limited retry; they are ' +
      'counted as resolved, not as failures.',
    'One quote is cited to a bioRxiv preprint DOI (10.1101/2022.08.04.502707) rather than to a Crossref ' +
      'journal record, because the quoted sentence is in the preprint abstract. Its published counterpart ' +
      '(10.1002/advs.202303575) is cited in flagship_papers and did resolve.',
    'The preprint record was retrieved through the bioRxiv API, which reported its published DOI as ' +
      '10.1002/advs.202303575 - an independent confirmation of the link between the two.',
  ],
});

/** Quotes that were intended and then dropped, because they could not be verified word-for-word. */
export const QUOTE_ATTRITION = deepFreeze({
  kept: 32,
  dropped: 7,
  why_dropped: [
    'A quote from the 2013 Communications of the ACM article on evolutionary robotics - paywalled, no ' +
      'abstract retrievable, so no sentence could be read back.',
    'A quote from the 2017 Physics Today article on the emergent physics of animal locomotion - paywalled; ' +
      'the DOI resolves but the text does not.',
    'A quote from the 2023 Nature Reviews Molecular Cell Biology synthetic-cell roadmap - PubMed returns ' +
      '"[Abstract not available]" and the full text is paywalled.',
    'A lab-site self-description for the Morphology, Evolution & Cognition Laboratory - the landing page ' +
      'carries navigation only and states no research focus, so there was nothing to quote.',
    'A lab-site self-description for the Hahn Lab - same reason: the landing page has no research prose.',
    'A lab-site self-description for the Savage Lab - same reason: news and software links, no mission text.',
    'A passage containing the phrase "anatomical compiler", which would have been the single best quote in ' +
      'this file, attributed to one coauthor. The Soft Robotics essay carries per-author sections and we ' +
      'could not resolve which coauthor wrote that paragraph, so the phrase is recorded as a finding of ' +
      'the paper instead of as anyone\'s words.',
  ],
  the_rule:
    'Where a sentence was wanted and could not be traced to a source this file could read back, it was ' +
    'dropped or demoted to a paraphrase marked as such. An empty real_quotes array would have been ' +
    'preferable to any invention; no candidate ended up needing one.',
});

export const PROVENANCE = deepFreeze({
  article_metadata:
    'Article metadata and abstracts were obtained from PubMed. DOI links accompany every article cited ' +
    '(see DOI_LINKS and the `doi` field on every entry in flagship_papers).',
  full_texts:
    'Open-access full texts were retrieved from Europe PMC as JATS XML and tag-stripped locally, so that ' +
    'quoted sentences could be read back character-for-character rather than recalled. Where only an ' +
    'abstract was available, quotes come from the abstract and `context` says so.',
  preprints: 'Preprint records were retrieved from the bioRxiv API.',
  identifiers: 'DOIs were located and then re-verified against Crossref; see DOI_VERIFICATION.',
  web_pages:
    'Lab and university pages were fetched individually for this file. Quotes taken from them are marked ' +
    'in `context` as institutional or lab-site voice rather than as a sentence from a paper. Each of the ' +
    'five web-page quotes was then RE-VERIFIED a second time against the raw bytes of the page, ' +
    'tag-stripped locally, rather than being trusted from a summarising fetch - a step that caught two ' +
    'errors: a sentence recorded as a clause when the page carries it as a full sentence, and a quote ' +
    'stored as a fragment when the whole sentence was available. One lab URL listed on a university ' +
    'staff page did not respond and is recorded as not used.',
  what_is_NOT_here:
    'No contact details of any kind, no social handles, and no inference about any person beyond what ' +
    'their publication and institutional record supports. Entries in openness_evidence marked `inferred` ' +
    'are OUR readings of the publication record and are not claims about anyone\'s intentions.',
});

// ===================================================================================================
// CROSS-CHECKS
// ===================================================================================================

/**
 * Structural self-check over the exports. Returns an array of problem strings; empty means consistent.
 * Kept here rather than only in the test file so a consumer can assert on it too.
 */
export function crossCheckClusters() {
  const problems = [];
  const clusterIds = Object.values(FIELD_CLUSTERS);
  const goalIds = Object.values(GOALS);
  const layerIds = Object.values(LAYERS);

  for (const c of CANDIDATES) {
    if (!clusterIds.includes(c.field)) problems.push(`${c.id}: field "${c.field}" is outside FIELD_CLUSTERS`);
  }
  for (const id of clusterIds) {
    if (!CANDIDATES.some((c) => c.field === id)) problems.push(`cluster ${id} has no candidates`);
    const w = WHY_THESE_FIELDS[id];
    if (!w) { problems.push(`cluster ${id} missing from WHY_THESE_FIELDS`); }
    else {
      if (!goalIds.includes(w.goal)) problems.push(`cluster ${id}: goal "${w.goal}" is outside GOALS`);
      if (!layerIds.includes(w.layer)) problems.push(`cluster ${id}: layer "${w.layer}" is outside LAYERS`);
    }
    if (!THE_HONEST_GAP.by_cluster[id]) problems.push(`cluster ${id} missing from THE_HONEST_GAP.by_cluster`);
  }
  for (const id of Object.keys(WHY_THESE_FIELDS)) {
    if (!clusterIds.includes(id)) problems.push(`WHY_THESE_FIELDS has unknown cluster ${id}`);
  }
  for (const id of Object.keys(THE_HONEST_GAP.by_cluster)) {
    if (!clusterIds.includes(id)) problems.push(`THE_HONEST_GAP.by_cluster has unknown cluster ${id}`);
  }
  const ids = CANDIDATES.map((c) => c.id);
  if (new Set(ids).size !== ids.length) problems.push('duplicate candidate id');
  if (ALL_DOIS.length !== DOI_VERIFICATION.distinct_dois_cited) {
    problems.push(`ALL_DOIS has ${ALL_DOIS.length} entries but DOI_VERIFICATION claims ${DOI_VERIFICATION.distinct_dois_cited}`);
  }
  const quoteCount = CANDIDATES.reduce((n, c) => n + c.real_quotes.length, 0);
  if (quoteCount !== QUOTE_ATTRITION.kept) {
    problems.push(`${quoteCount} quotes present but QUOTE_ATTRITION claims ${QUOTE_ATTRITION.kept} kept`);
  }
  return problems;
}
