"""Build zebrafish Kcnk5b dimer (res 6-260) on mouse TASK-2 cryo-EM template 6WM0 (pH 8.5, open),
then make alf mutants W169L and F241Y (Perathoner 2014) by in-place mutation of the WT model
(both protomers), optimising only the mutated side chains + 5 A shell so WT/mutant differ only locally."""
import sys
from modeller import *
from modeller.automodel import *
from modeller.optimizers import ConjugateGradients, MolecularDynamics

ZF = open('Q6PFU3.seq').read().strip()
tmpl_pdb = '6WM0_prot.pdb'
log.verbose()
env = Environ(rand_seed=-12312)
env.io.hetatm = False
env.io.atom_files_directory = ['.']

# --- template sequence from the structure, 6-260 both chains
mdl_t = Model(env, file=tmpl_pdb, model_segment=('6:A', '260:B'))
aln = Alignment(env)
aln.append_model(mdl_t, align_codes='6WM0', atom_files=tmpl_pdb)
tseq = ''.join(r.code for r in mdl_t.residues)
assert len(tseq) == 2 * 255, len(tseq)
zf = ZF[5:260]
with open('kcnk5b.ali', 'w') as f:
    f.write('>P1;6WM0\nstructureX:%s:6:A:260:B::::\n%s/%s*\n' % (tmpl_pdb, tseq[:255], tseq[255:]))
    f.write('>P1;kcnk5b\nsequence:kcnk5b:6:A:260:B::::\n%s/%s*\n' % (zf, zf))

class MyModel(AutoModel):
    def special_restraints(self, aln):
        s1 = Selection(self.chains['A']).only_atom_types('CA')
        s2 = Selection(self.chains['B']).only_atom_types('CA')
        self.restraints.symmetry.append(Symmetry(s1, s2, 1.0))
    def special_patches(self, aln):
        self.rename_segments(segment_ids=['A', 'B'], renumber_residues=[6, 6])
    def user_after_single_model(self):
        self.restraints.symmetry.report(1.0)

a = MyModel(env, alnfile='kcnk5b.ali', knowns='6WM0', sequence='kcnk5b',
            assess_methods=(assess.DOPE, assess.GA341))
a.starting_model = 1
a.ending_model = int(sys.argv[1]) if len(sys.argv) > 1 else 5
a.md_level = refine.slow
a.make()
ok = [m for m in a.outputs if m['failure'] is None]
ok.sort(key=lambda m: m['DOPE score'])
best = ok[0]
print('BEST', best['name'], 'DOPE', best['DOPE score'], 'GA341', best['GA341 score'])
import shutil
shutil.copy(best['name'], 'kcnk5b_WT_model.pdb')
with open('model_scores.tsv', 'w') as f:
    f.write('model\tDOPE\tGA341\n')
    for m in ok: f.write('%s\t%.1f\t%s\n' % (m['name'], m['DOPE score'], m['GA341 score'][0]))

# --- in-place mutation (salilab mutate_model recipe)
def mutate(wt, resnum, restyp, out):
    e = Environ(rand_seed=-49837)
    e.io.hetatm = False
    e.edat.dynamic_sphere = False
    e.edat.dynamic_lennard = True
    e.edat.contact_shell = 4.0
    e.edat.update_dynamic = 0.39
    e.libs.topology.read(file='$(LIB)/top_heav.lib')
    e.libs.parameters.read(file='$(LIB)/par.lib')
    mdl1 = Model(e, file=wt)
    ali = Alignment(e)
    ali.append_model(mdl1, atom_files=wt, align_codes=wt)
    for ch in ('A', 'B'):
        Selection(mdl1.chains[ch].residues[str(resnum)]).mutate(residue_type=restyp)
    ali.append_model(mdl1, align_codes='mut')
    mdl1.clear_topology()
    mdl1.generate_topology(ali[-1])
    mdl1.transfer_xyz(ali)
    mdl1.build(initialize_xyz=False, build_method='INTERNAL_COORDINATES')
    mdl2 = Model(e, file=wt)
    mdl1.res_num_from(mdl2, ali)
    mdl1.write(file=out + '.tmp')
    mdl1.read(file=out + '.tmp')
    sel_mut = Selection(*[mdl1.chains[ch].residues[str(resnum)] for ch in ('A', 'B')])
    mdl1.restraints.make(sel_mut, restraint_type='stereo', spline_on_site=False)
    sel = sel_mut.select_sphere(5.0)  # shell
    # only the mutated residues move; shell provides environment
    mdl1.restraints.unpick_all()
    mdl1.restraints.pick(sel_mut)
    cg = ConjugateGradients()
    cg.optimize(sel_mut, max_iterations=200)
    md = MolecularDynamics()
    md.optimize(sel_mut, temperature=300, max_iterations=50)
    cg.optimize(sel_mut, max_iterations=200)
    mdl1.write(file=out)

mutate('kcnk5b_WT_model.pdb', 169, 'LEU', 'kcnk5b_W169L_model.pdb')
mutate('kcnk5b_WT_model.pdb', 241, 'TYR', 'kcnk5b_F241Y_model.pdb')
print('DONE')
