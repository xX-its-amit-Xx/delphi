import fs from 'fs';
const R='D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/lean/registry/';
const ls=JSON.parse(fs.readFileSync(R+'lawsets/lawset-1.8.1.json'));
const ph=[];const st={};
for(const l of ls.laws){const j=JSON.parse(fs.readFileSync(R+'laws/'+l.law_id+'.json'));st[l.status]=(st[l.status]||0)+1;
 if(!j.lean_ref||!j.lean_ref.theorem)ph.push(l.law_id+(j.lean_ref&&j.lean_ref.module?' (module only)':''));}
console.log('pinned',ls.laws.length,JSON.stringify(st));console.log('no theorem',ph.length,ph.join('; '));
const old=['turing-ddi-linear-condition','gene-regulatory-dynamics','physiology-q10','perturb-thermal','altitude-coupling','genotype-pleiotropy-closure','genotype-genetic-code','genotype-substitution-time','E7'];
for(const o of old)console.log(o,ls.laws.some(l=>l.law_id===o)?'pinned in 1.8.1':'NOT pinned in 1.8.1');
