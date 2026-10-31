// Hand-written prose and glossary for the enzyme-evolution page. Numbers are never hard-coded here;
// app.js substitutes them from data.json so the text cannot drift from the artifacts.
window.EV_CONTENT = {

glossary: {
  'enzyme': 'A protein that speeds up one chemical reaction in a cell. Change its shape slightly and it may work better, worse, or not at all.',
  'TrpB': 'Tryptophan synthase beta-subunit: the enzyme used here. The cell needs it to make tryptophan, one of the building blocks of protein, so a broken TrpB stops growth.',
  'residue': 'One amino-acid position in the protein chain. This study varies four of them (183, 184, 227 and 228), which sit together in the active site.',
  'genotype': 'Here, the four letters at those four positions, like VFVS. Twenty possible amino acids at four positions gives 20^4 = 160,000 combinations.',
  'parent': 'The enzyme the study started from, written VFVS. Every route begins here.',
  'fitness landscape': 'The map from each genotype to how well the organism carrying it grows. Peaks are good variants; valleys are broken ones.',
  'epistasis': 'When the effect of one mutation depends on which others are already present. It is why you cannot just add up single mutations to predict a combination.',
  'assay': 'One laboratory measurement. Here it means measuring the growth rate of cells carrying one variant. Assays cost money and time, which is the whole point of choosing them carefully.',
  'growth proxy': 'The score is how fast cells grow when they depend on this enzyme. It stands in for enzyme quality but is not a direct measurement of the enzyme in a tube.',
  'replicate': 'An independent repeat of the same measurement. Two replicates tell you roughly how noisy a number is, but two is not enough to put honest confidence bands on 159,129 of them.',
  'admissible': 'A step from one variant to the next counts as admissible only when the worst plausible score of the destination still beats the best plausible score of the origin. That is a deliberately strict rule.',
  'certificate': 'A machine-checkable statement that, under stated assumptions, a route exists (open) or cannot exist in the measured graph (blocked). It is a statement about this data under these assumptions, not about biology.',
  'cut': 'A wall across the map. If every way out of the region containing the start is a step the data cannot support, the target is unreachable within this graph, and that can be proved.',
  'kappa': 'The caution dial. It multiplies the error bar on every measurement before admissibility is judged. It is an assumed sensitivity parameter, not a confidence level, and the project says so loudly.',
  'abstention': 'The policy ran out of budget without being able to certify either answer, and said so instead of guessing. Abstentions are reported, never recoded as a negative result.',
  'false certificate': 'Issuing a confident open or blocked answer that the full data contradicts. The worst possible failure here, and the count was zero in every arm.',
  'RMST': 'Restricted mean survival time: the average number of assays spent, counting an unresolved episode as the full budget. It is a fair way to average when some runs never finish.',
  'LazySP': 'An established 2016 path-planning method that delays expensive checks until a candidate shortest path needs them. Adapted here as the strong baseline the project was missing.',
  'replay': 'Re-running a decision policy against measurements that already exist, revealing them only when the policy pays for them. It tests the chooser, not the biology.',
  'prior': 'A guess supplied by a model before any measurement, used to decide what to measure first. A prior can guide an experiment but can never replace it.',
  'ESM2': 'A protein language model. It reads sequences and predicts which ones look plausible, having never been told anything about this assay.',
  'BioNeMo': "NVIDIA's toolkit for running biology models on GPUs. Used here to run ESM2 over the full library.",
  'nanopublication': 'A small, citable, machine-readable package holding one claim plus who said it and where it came from. Here they are valid but unsigned drafts, not published to the public network.',
  'Lean': 'A proof assistant. It checks a mathematical argument step by step, so a human does not have to trust the author.',
  'Spearman': "A correlation that only cares about ranking order. 0 means the model's ordering is unrelated to the measured ordering; 1 means identical."
},

storyParas: [
  "An <t>enzyme</t> is a protein that makes one chemical reaction happen fast enough to keep a cell alive. This project takes one of them, <t>TrpB</t>, and asks a question that sounds simple and is not: if you want to turn today's enzyme into a better one by changing it a few letters at a time, is there a path where <em>every single step along the way still works</em>?",
  "That constraint is the whole difficulty. Evolution cannot take a leap through a broken intermediate and land on something better, because the broken intermediate dies first. So a route is only usable if each step is at least as good as the one before. Four <t>residue</t> positions were varied, giving a <t>genotype</t> of four letters, and the published study measured the growth of __MEASURED__ of the __LIBRARY__ possible combinations.",
  "With real measurements for almost the whole space, you can draw the <t>fitness landscape</t> and look for an uphill path from the <t>parent</t> enzyme __PARENT__ to the best published variant __TARGET__. The twist is that the obvious direct route does not work. Every one of the direct orderings has a step that goes downhill, so the shortest usable path is a detour, and the project's chosen route takes __ROUTELEN__ steps instead of four.",
  "The second difficulty is that measurements are noisy. Each variant was measured in two <t>replicate</t> flasks. If you believe the numbers exactly, many steps look fine. If you allow that each number could be off a little, some of those steps stop being defensible. The <t>kappa</t> dial below sets how much slack to allow, and it changes the answer: at the project's chosen setting __KAPPA__ the route survives, and it breaks once you demand a little more margin.",
  "So the real output is not a protein. It is a decision with its reasoning attached: here is the route, here is its weakest step, here is the measurement that would settle it, and here is a <t>certificate</t> a machine can check. When the evidence cannot support a route, the system asks for an experiment instead of inventing confidence. That is the part a laboratory could actually use."
],

storyData: [
  ['Where it came from', 'Johnston et al. 2024, published in PNAS, with the data archived at CaltechDATA under CC0. We did not generate it and neither did they during this hackathon.'],
  ['What the number means', 'How fast <i>E. coli</i> grew when its only route to tryptophan ran through this enzyme variant, as a <t>growth proxy</t>. Faster growth means a more useful enzyme, indirectly.'],
  ['What was excluded', '__EXCLUDED__ combinations were never measured; a separate file fills them in by guessing from neighbours. Those guesses are never used as observations here, and the overlap with real measurements is zero.'],
  ['What it cannot tell you', 'It is not a purified-enzyme measurement, not a catalytic rate constant, and not a measure of fitness in any wild organism. It is one assay in one engineered bacterium.']
],

storyCert: [
  ['It is', 'A proof that, <em>if</em> each variant\'s true score lies inside its stated interval, then every step of this route is non-decreasing, so the route is usable.'],
  ['It is also', 'For the negative case: a proof that every way out of the start\'s region is a step this data cannot support, so no usable route exists <em>in this measured graph</em>.'],
  ['It is not', 'A proof that the intervals contain the truth. That is assumed, and the project labels it assumption A1 rather than hiding it.'],
  ['It is not', 'A statement about biology. "Blocked" means blocked in a four-position subgraph of measured variants, never "evolution cannot do this".']
],

twoWhy: [
  "The two results are not actually in conflict once you look at what each one varied. On the enzyme benchmark the specialists are deterministic pieces of code inside a single process. They cannot misremember, hallucinate a dataset or run out of room to think, so sharing a ledger between them adds almost nothing: each one already computes the same thing from the same inputs. The gain from collaboration was within noise, and the project reports that as a negative result rather than burying it.",
  "In our claim swarm the agents are language models with finite context, and the failure they make is forgetting or inventing. There, splitting the work matters a great deal: the single agent ran out of room and left eight of twenty claims unanswered, while the group covered them. We were not measuring whether collaboration improves reasoning; we were measuring whether it beats a context limit. It does.",
  "The useful lesson sits between them. Collaboration pays when the bottleneck is attention, memory or verification capacity, and pays nothing when every member would compute the same answer anyway. A team claiming a collective advantage should say which of those two situations it is in, and the enzyme benchmark is the better-controlled of our two attempts because the arms are deterministic and the outcome is checked against full data."
],

swarmHonest: [
  "The honest description is that build-time organisation and run-time decentralization are different things, and only one of them is demonstrated here. Several agents wrote this code in parallel, under separate worktrees, with an integrator merging them. That is a real division of labour and it shows up in the commit history, but it is a software engineering fact, not a scientific result.",
  "Inside the benchmark, the five specialists exchange evidence messages and can challenge each other, which is closer to the real thing. Even so, a central process schedules them and the comparison found no advantage from their sharing. The project's own handoff says not to describe it as a proven decentralized laboratory, and we repeat that here rather than softening it for a slide."
],

risks: [
  ['The intervals are assumed, not measured', 'Everything rests on each variant\'s true score sitting inside its stated range. Two replicate flasks cannot justify that across 159,129 variants, and the project says so. If the real noise is larger or skewed, routes that look certified could contain a downhill step.', 'high'],
  ['The scoreboard\'s winner may be winning on one pair', 'The strong baseline certified __LAZY__ of 100 episodes against __Q2C__ for the original planner, but the project admits the gain concentrates in one repeated start-and-target pair. A benchmark with one hard pair repeated is not a benchmark of general method quality.', 'high'],
  ['Growth is not catalysis', 'A faster-growing cell is weak evidence about the enzyme itself. Anything that changes how much protein the cell makes, or how it tolerates the protein, moves the score without changing the chemistry.', 'medium'],
  ['Blocked means blocked here', 'A negative certificate covers the measured four-position subgraph only. __EXCLUDED__ unmeasured combinations and every path through the rest of the protein stay possible. Reading it as impossibility would be a serious error.', 'medium'],
  ['Retrospective replay flatters planners', 'The measurements already existed. A policy that asks for an expensive assay never has to wait three weeks for it or deal with a failed experiment. Real campaigns have both.', 'medium'],
  ['The collective result is a null, not a refutation', 'Finding no advantage at these budgets does not show collaboration cannot help. It shows this implementation, with deterministic specialists, did not gain from sharing.', 'low']
],

analogies: [
  ['Stepping stones, not a long jump', 'You want to cross a river. The far bank is four metres away, but you cannot jump four metres, so you need stones no more than a stride apart. The direct line has a gap; the usable crossing curves downstream and takes six strides. That is exactly the result here, with "stride" meaning one amino-acid change and "gap" meaning a step that goes downhill.'],
  ['A mountain pass, in fog', 'Hikers want a route that never loses altitude. Their altimeters are a little unreliable, so two readings that differ by less than the instrument error cannot be trusted to say which point is higher. The <t>kappa</t> dial is how much instrument error they allow, and turning it up closes passes they thought were open.'],
  ['The surveyor who refuses to sign', 'A structural engineer will not stamp a drawing when a load is unknown. They do not guess; they specify the test. The claim adapters do the same thing: asked to apply a population-genetics formula to a quantity it was never derived for, they refuse and name the reason instead of returning a number.'],
  ['Asking the right question beats a better guess', 'A doctor with a vague scan and a good hypothesis orders one decisive test. A doctor who orders the most impressive scan available may learn a lot and still not settle the question. The planner that chose assays to settle the decision beat the one that chased the highest predicted score, and the protein language model, the impressive scan here, added nothing.']
],

recs: [
  ['Fix the benchmark panel before trusting the ranking', 'The strongest result leans on one repeated endpoint pair. Draw a fresh panel of start-and-target pairs, pre-register it, and re-run the top three policies on it. This is a few hours of compute and it either keeps the headline or kills it honestly.', 'highest value'],
  ['Replace the assumed interval with a measured one', 'Find any TrpB variants with more than two replicates, anywhere in the literature, and use them to check whether the kappa-2 interval actually contains the truth. One real coverage check would convert the central assumption into a measurement.', 'highest value'],
  ['Make the refusals the product', 'The adapters that refuse an unlicensed calculation are the most transferable piece of this work and the least shown. Package them as a small library any team can call, with the refusal reason codes documented, and the reuse points for other teams follow.', 'high'],
  ['Report the null loudly', 'Two negative results, no collective advantage and no gain from the protein language model, are more credible than the positive one and most teams will not have any. Lead with them in the talk rather than putting them in an appendix.', 'high'],
  ['Connect the two swarm experiments', 'Our claim swarm found a collective advantage and this benchmark did not. Running one shared design across both, with the same outcome measure, would turn an awkward disagreement into the clearest finding either side has.', 'medium'],
  ['Sign the nanopublications, or stop calling them publications', 'They are valid drafts, unsigned and unpublished. Either get the key owner to publish them to the test network or keep describing them as drafts. The middle ground is where credibility goes to die.', 'medium']
]
};
