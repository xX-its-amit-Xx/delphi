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
import { SPECIES_REFUSAL, ON_TARGET_RULE, OFFTARGET_DB, MIT_CITATION, FEASIBILITY, FALSIFIERS } from '../validate/editplan/editplan.mjs';

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
      'against GRCz11 with the gene context of every mismatched site, and - as first-class output - what is NOT ' +
      'established, plus a "what would falsify this plan" section. ' +
      'Every number is labelled: on-target scores are a HEURISTIC (not Doench 2016 Rule Set 2, not a measured ' +
      'efficiency), off-target counts are a FLOOR from a heuristic aligner, HDR rates are other papers\' loci. ' +
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
        offtarget: { type: 'boolean', description: 'Run the GRCz11 off-target search (NCBI blastn-short against the zebrafish genome assembly). Default true. It takes minutes per guide and is cached; set false for a fast structural answer.' },
        network: { type: 'boolean', description: 'Allow network calls (Ensembl REST, Kazusa, NCBI BLAST). Default true. Everything is cached under C:/Temp/editplan-cache (EDITPLAN_CACHE_DIR). No credentials are used.' },
        panel_only: { type: 'boolean', description: 'Return just the validation-report panel section, not the full plans.' },
      },
    },
    handler: async args => {
      if (args.species && args.species !== 'danio_rerio') {
        return envelope({ refused: true, refusal: `species "${args.species}" refused. ${SPECIES_REFUSAL}` },
          [p('refusal', args.species, 'assumed', 'editplan.mjs SPECIES_REFUSAL: a hard, code-enforced scope limit')],
          'A refusal, not a plan. ' + SPECIES_REFUSAL);
      }
      const opts = { network: args.network !== false, window: args.window ?? 30, offtarget: args.offtarget !== false, arms: args.arms === 'asymmetric' ? 'asymmetric' : 'symmetric' };
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
      on_target: ON_TARGET_RULE,
      off_target: { database: OFFTARGET_DB, program: 'NCBI BLAST URL API, blastn-short, word_size 7, expect 1000, hitlist 500', scoring: 'Hsu 2013 position weights, aggregated as the MIT specificity', citation: MIT_CITATION,
        limits: 'a heuristic aligner can MISS sites; the primary assembly only; no bulges modelled. The count is a floor, never a ceiling.' },
      feasibility: FEASIBILITY,
      falsifiers: FALSIFIERS,
    }, [
      p('on-target rule', ON_TARGET_RULE.id, 'assumed', 'weights chosen by us from published observations; not fitted and not validated'),
      p('off-target weights', 'Hsu 2013', 'measured-secondhand', MIT_CITATION),
      p('HDR rate', '1-4 % error-free', 'measured', 'Boel et al. 2018, Dis Model Mech 11:dmm035352 - their loci, not ours'),
    ], 'Methods only: no plan, no coordinates, no guides. ' + SCOPE),
  },
];
