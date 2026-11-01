// The editing plan AS A SECTION OF A DESIGN'S VALIDATION REPORT.
//
// Requirement: "a panel section in the validation output so a design's report carries its editing plan".
// validate/score.mjs (validateDesign) is the validation thread's file, not this thread's, so it is NOT edited
// here. Instead this wrapper calls validateDesign and appends the section, and tools/EDITPLAN-REGISTER.md
// carries the three-line patch for doing it in place once that file's owner wants it.
//
// The section is appended, never merged: no editing-plan number is folded into the design score, the verdict
// or any gate. A plan for an edit says nothing about whether the design is plausible, and the house rule that
// a residue is a STATE and not a phenotype applies here too - a guide RNA is even further from a phenotype
// than a residue is.
import { validateDesign } from '../score.mjs';
import { editPlansForDoc, panel, SCOPE as EDITPLAN_SCOPE } from './plan.mjs';
import { getDoc } from '../../tools/studio.mjs';

/** validate_design's report with the editing plan appended as one more section. */
export async function validateDesignWithEditPlan(args = {}) {
  const base = await validateDesign(args);
  const { doc } = await getDoc(args.organism);
  const plans = await editPlansForDoc(doc, { network: args.network !== false, offtarget: args.offtarget === true, window: args.window ?? 30 });
  base.result.editing_plan = {
    ...panel(plans),
    plans,
    how_it_relates_to_the_rest_of_this_report:
      'This section is APPENDED, not merged. No number in it enters the design score, the verdict or any gate, ' +
      'and nothing in it is evidence that the design is plausible: it is the opposite kind of statement - what it ' +
      'would take to attempt the build, and why each step might fail. In particular, this report\'s own verdict ' +
      'above is what decides whether the design is worth building, and for the winged zebrafish that verdict was ' +
      'recorded as (NOT CLOSE / largely UNSHOWN, Lean gate FAILS).',
  };
  base.scope = `${base.scope} EDITING PLAN SECTION: ${EDITPLAN_SCOPE}`;
  return base;
}
