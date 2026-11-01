// edit_plan: the germline editing plan for a design's gene edits, as part of the validation suite.
// Same {name, title, description, inputSchema, handler} shape as TOOLS in server.mjs; registration patch for
// the hub in tools/EDITPLAN-REGISTER.md. server.mjs is NOT edited here. http.mjs serves this as
// POST /tool/edit_plan through its tools/ discovery already.
//
// The plan is a PROPOSAL for a wet lab to check. It is never described as validated, and the tool refuses any
// species other than Danio rerio.
import { envelope, p } from '../lib/envelope.mjs';
import { getDoc } from './studio.mjs';
import { editPlan, editPlansForDoc, panel, provenanceFor, SCOPE, wrap } from '../validate/editplan/plan.mjs';
import { SPECIES_REFUSAL, ON_TARGET_RULE, OFFTARGET_DB, OFFTARGET_METHODS, NCBI_QUEUE_EXPERIENCE, MIT_CITATION, FEASIBILITY, FALSIFIERS, ARM_LENGTH_EVIDENCE, CUT_DISTANCE_EVIDENCE, ASSEMBLY, DOENCH } from '../validate/editplan/editplan.mjs';
import * as LOCAL from '../validate/editplan/grcz11-local.mjs';
import * as EVO2 from '../validate/editplan/evo2.mjs';

const ORG = { description: 'Organism: a saved document id, a repository organism/design id (winged-zebrafish, flying-fish, ...), or an inline organism document. Its gene-level edits are each turned into an editing plan. Use `gene` + `change` instead to plan one edit directly.', anyOf: [{ type: 'string' }, { type: 'object' }] };

export const EDITPLAN_TOOLS = [
  {
    name: 'edit_plan',
    title: 'Germline editing plan for a design\'s gene edits (proposal, not a protocol)',
    description:
      'For each gene-level edit on a design, the concrete zebrafish germline editing plan: the exact GRCz11 ' +
      'coordinates of the change (gene -> canonical transcript -> CDS -> codon -> chromosome position, with the ' +
      'reference codon CHECKED against the genome), SpCas9/SaCas9/Cas12a protospacers in the required window with ' +
      'their cut sites, a full ssODN donor with homology arms and silent PAM/seed blocking mutations, a base-editor ' +
      'route where the change is a transition and a designed pegRNA where it is a transversion, an off-target search ' +
      'against GRCz11 with the gene context of every close mismatched site, an `evo2` block that RANKS the edit and ' +
      'its silent blocking mutations by Evo2 (NVIDIA NIM / BioNeMo) sequence likelihood, a `ranking` section holding ' +
      'every order the plan computes with the rule behind each, and - as first-class output - what is NOT ' +
      'established, plus a "what would falsify this plan" section. ' +
      'Every number is labelled. There are TWO on-target scores and the difference matters: `on_target_doench2014` ' +
      'is a PUBLISHED model (Doench 2014 Rule Set 1, coefficients fetched from the paper and self-tested) fitted in ' +
      'mouse and human cells, so applying it to zebrafish is a cross-species transfer; `on_target` is OUR heuristic ' +
      'with weights we chose. Neither is Doench 2016 Rule Set 2, which cannot be reimplemented from published ' +
      'numbers. The off-target search is an EXHAUSTIVE local scan of the GRCz11 primary assembly - complete for ' +
      'substitutions, but blind to bulges, to alternative loci and to the laboratory strain\'s own genome. Evo2 ' +
      'likelihoods RANK and never gate, and are NOT phenotype predictions. HDR rates are other papers\' loci. ' +
      'Danio rerio only: it refuses every other species, and will not produce a human or other mammalian plan.',
    inputSchema: {
      type: 'object',
      properties: {
        organism: ORG,
        gene: { type: 'string', description: 'Zebrafish gene symbol (resolved through Ensembl; an unresolvable symbol is a refusal, not a guess). Use with `change`.' },
        change: { type: 'string', description: 'The edit: a protein change "p.W169L" / "p.Y285*", or "knockout". Anything else is refused rather than guessed at.' },
        species: { type: 'string', description: 'Must be danio_rerio (the default). Any other value is refused: this tool does not plan human or other mammalian edits.' },
        window: { type: 'integer', description: 'For a point change: the cut site must be within this many bp of the edited codon (default 30). Cut-site proximity is the main lever on knock-in efficiency (Prykhozhij 2018).' },
        arms: { enum: ['symmetric', 'asymmetric', 'both'], description: 'ssODN homology-arm style. Default: both (40/40 and the asymmetric variant).' },
        offtarget: { type: 'boolean', description: 'Run the GRCz11 off-target search. Default true. By default this is a LOCAL EXHAUSTIVE scan of the whole GRCz11 primary assembly (~22 s per guide, cached) which is complete for substitutions at or under 4 mismatches. Set false for a fast structural answer; the plan then says the search did not run, and absence of listed off-targets is NOT evidence of specificity.' },
        offtarget_method: { enum: ['auto', 'local', 'ncbi'], description: 'Off-target backend. "auto" (default) uses the local exhaustive index if it is built, else NCBI BLAST. "local" requires the index (build once: node sim-engine/validate/editplan/grcz11-local.mjs build). "ncbi" forces the NCBI BLAST URL API, which is a heuristic aligner and which did not return at all in our runs (see edit_plan_methods off_target.ncbi_blast).' },
        offtarget_guides: { type: 'integer', description: 'How many guides to search (default 3). The local search is cheap enough to search every guide a lab would weigh against the others.' },
        evo2: { type: 'boolean', description: 'Build the Evo2 (NVIDIA NIM / BioNeMo) block, which RANKS candidate edits and silent blocking mutations by sequence likelihood. Default true. With no NVIDIA_API_KEY every Evo2 field is {ran:false, reason} and the plan is complete without it: the model never gates anything. A likelihood is NOT a phenotype prediction and NOT evidence of safety or specificity.' },
        network: { type: 'boolean', description: 'Allow network calls (Ensembl REST, Kazusa, and the off-target backend). Default true. Everything is cached under C:/Temp/editplan-cache (EDITPLAN_CACHE_DIR). No credentials are used; the Evo2 key, if present, is read from the environment only and never written anywhere.' },
        panel_only: { type: 'boolean', description: 'Return just the validation-report panel section, not the full plans.' },
      },
    },
    handler: async args => {
      if (args.species && args.species !== 'danio_rerio') {
        return envelope({ refused: true, refusal: `species "${args.species}" refused. ${SPECIES_REFUSAL}` },
          [p('refusal', args.species, 'assumed', 'editplan.mjs SPECIES_REFUSAL: a hard, code-enforced scope limit')],
          'A refusal, not a plan. ' + SPECIES_REFUSAL);
      }
      const opts = { network: args.network !== false, window: args.window ?? 30, offtarget: args.offtarget !== false,
        offtargetMethod: args.offtarget_method || 'auto', ...(args.offtarget_guides ? { offtargetGuides: args.offtarget_guides } : {}),
        evo2: args.evo2 !== false, arms: args.arms === 'asymmetric' ? 'asymmetric' : 'symmetric' };
      let plans, origin;
      if (args.gene && args.change) { plans = [await editPlan(args.gene, args.change, opts)]; origin = `${args.gene} ${args.change}`; }
      else if (args.organism) { const { doc } = await getDoc(args.organism); plans = await editPlansForDoc(doc, opts); origin = doc.id || 'inline document'; }
      else return envelope({ refused: true, refusal: 'give either an organism (whose gene edits are planned) or gene + change' },
        [p('refusal', null, 'assumed', 'missing arguments')], 'A refusal, not a plan.');
      if (args.panel_only) return envelope({ for: origin, panel: panel(plans) }, provenanceFor(plans), SCOPE);
      return wrap(plans, `Planned for: ${origin}.`);
    },
  },
  {
    name: 'edit_plan_methods',
    title: 'How edit_plan computes every number, and what each number is not',
    description: 'The scoring rules, the off-target search, the reagent precedents, the feasibility statements with their citations, and the falsifier list - without running a plan. Read this before quoting any number edit_plan produced.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => envelope({
      species_limit: SPECIES_REFUSAL,
      on_target: {
        two_numbers_and_the_difference_matters:
          '`on_target_doench2014` is a PUBLISHED model whose coefficients were fetched from the paper and self-tested. ' +
          '`on_target` is OUR heuristic with weights we chose. Neither is Doench 2016 Rule Set 2. Never quote the ' +
          'heuristic as if it were published, and never quote either as a measured efficiency.',
        published_model: { model: 'Doench 2014 Rule Set 1', citation: DOENCH.CITATION, coefficient_source: DOENCH.COEFFICIENT_SOURCE_URL,
          coefficient_precision: DOENCH.COEFFICIENT_PRECISION_NOTE, applies_to: 'SpCas9, 20-nt spacer, NGG PAM only',
          context: DOENCH.CONTEXT_SPEC, self_test: DOENCH.selfTest(), what_it_is_not: DOENCH.RULE_SET_1_NOT },
        rule_set_2: DOENCH.RULE_SET_2,
        our_heuristic: ON_TARGET_RULE,
      },
      off_target: {
        default_method: 'local-exhaustive',
        methods: OFFTARGET_METHODS,
        local_index: LOCAL.indexStatus(),
        local_search: { assembly: ASSEMBLY, program: 'every position of both strands tested; PAM-anchored on the most restrictive PAM base, then a mismatch count with early exit. No seeding step, so no substitution site at or under the limit can be missed.',
          exhaustive_for: 'substitutions, over the sequences indexed (the GRCz11 primary assembly: 25 chromosomes, MT, 967 unplaced scaffolds)',
          pam_is_checked: 'yes, at every reported site - unlike the BLAST path, which searched the spacer alone',
          limits: 'no BULGES (DNA/RNA insertions or deletions at the target), which Cas9 tolerates; the primary assembly only, so no alternative loci and NOT the laboratory strain\'s own genome; nothing about chromatin, expression or delivery. A sequence match is not a cut, and this is not a measurement - GUIDE-seq or CIRCLE-seq in the actual fish is.' },
        ncbi_blast: { database: OFFTARGET_DB, program: 'NCBI BLAST URL API, blastn-short, word_size 7, expect 1000, hitlist 500', kept_but_not_default: NCBI_QUEUE_EXPERIENCE },
        scoring: 'Hsu 2013 position weights, aggregated as the MIT specificity', citation: MIT_CITATION,
      },
      evo2: EVO2.METHODS,
      evo2_status: await EVO2.status().catch(e => ({ ran: false, reason: e.message })),
      arm_length_evidence: ARM_LENGTH_EVIDENCE,
      cut_site_distance_evidence: CUT_DISTANCE_EVIDENCE,
      feasibility: FEASIBILITY,
      falsifiers: FALSIFIERS,
    }, [
      p('on-target, published model', 'Doench 2014 Rule Set 1', 'measured-secondhand', `${DOENCH.CITATION}; coefficients fetched and self-tested (${DOENCH.selfTest().ok ? 'PASSES' : 'FAILS'}). Fitted in mouse and human cells: using it on zebrafish is a cross-species transfer.`),
      p('on-target, Rule Set 2', null, 'assumed', `NOT implemented: ${DOENCH.RULE_SET_2.what_it_would_take}`),
      p('on-target, our heuristic', ON_TARGET_RULE.id, 'assumed', 'weights chosen by us from published observations; not fitted and not validated'),
      p('off-target weights', 'Hsu 2013', 'measured-secondhand', MIT_CITATION),
      p('off-target site list', 'local exhaustive scan of the GRCz11 primary assembly', 'derived', 'complete for substitutions; blind to bulges, to alternative loci and to the laboratory strain\'s genome'),
      p('HDR rate', '1-4 % error-free', 'measured', 'Boel et al. 2018, Dis Model Mech 11:dmm035352 - their loci, not ours'),
      p('ssODN symmetric arm length', '60/60 nt', 'measured-secondhand', 'Boel 2018\'s measured optimum of 120 nt total; the per-arm split is ours'),
      p('cut-site distance thresholds', '<10 nt ideal, 20-30 % of maximum at 20 nt', 'measured-secondhand', 'Paquet 2016 in MURINE cells, quoted in Prykhozhij 2018\'s introduction - not zebrafish data'),
      p('Evo2 likelihood', EVO2.MODEL, 'assumed', EVO2.WHAT_IT_IS_NOT),
    ], 'Methods only: no plan, no coordinates, no guides. ' + SCOPE),
  },
];
