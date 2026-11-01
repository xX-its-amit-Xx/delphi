// ORGAN / SYSTEM / TISSUE / CELL levels: no generative model, by decision, not by omission.
//
// Organ/system: a search on 2026-11-01 (README.md "Organ level: the search") found NO per-specimen organ-volume or
// organ-mass table for zebrafish or a flying fish. The zebrafish/medaka micro-CT atlases publish images or
// segmentations, not organ tables (Ding et al. 2019 eLife: 25 GB of volumes for five larvae; Weinhardt et al. 2018:
// data "on request"). Two real per-specimen organ tables exist, for OTHER fish:
//   - Syngnathus schlegeli (pipefish), 60 specimens, brain/kidney/gut/liver/heart/fat/gonad wet mass, CC0,
//     Tsuboi et al. 2016 Ecol Evol doi 10.1002/ece3.1873, Zenodo 10.5281/zenodo.4949841;
//   - Lepomis gibbosus (pumpkinseed), 756 complete rows, liver/gonad/gut mass, CC BY 4.0, Zenodo 10.5281/zenodo.17295493.
// A model trained on a pipefish or a sunfish would generate pipefish or sunfish organ proportions and present them as a
// zebrafish's or flying fish's. That is invented data with extra steps, so nothing is trained and this backend says so.
//
// Cell: no hosted cell-state generative model is reachable with a key we hold (see providers.mjs status).

export const ORGAN_CANDIDATE_DATA = [
  { species: 'Syngnathus schlegeli', n: 60, organs: ['brain', 'kidney', 'gut', 'liver', 'heart', 'visceral fat', 'testis/egg mass'], units: 'mg wet mass', licence: 'CC0',
    cite: 'Tsuboi M et al. (2016) Ecol Evol 6:647-655, doi 10.1002/ece3.1873', url: 'https://zenodo.org/api/records/4949841/files/s.schlegeli_organ_data.txt/content',
    issues: 'length column mislabelled "(mg)"; specimens SS2 and SS16 share identical liver/heart/fat values (likely a copy error)' },
  { species: 'Lepomis gibbosus', n: 756, organs: ['liver', 'gonad', 'gut (full and empty)'], units: 'g wet mass', licence: 'CC BY 4.0',
    cite: 'Fernandes T et al. (2025) Zenodo doi 10.5281/zenodo.17295493', url: 'https://zenodo.org/records/17295493/files/FieldSamplingData.csv?download=1', issues: 'only three organs' },
];

export function status(level) {
  if (level === 'cell') return { level, status: 'not configured', backend: null,
    need: 'a hosted single-cell generative model (e.g. a Geneformer/scGPT-class or virtual-cell model behind an API) and its key. None of the providers wired here (NVIDIA NIM, Nebius, Vertex) exposes one we could reach; BioNeMo Framework can train such models but that is a GPU training job, not an endpoint.' };
  return { level, status: 'no training data', backend: null,
    why: 'no per-specimen organ-size table exists for the studio organisms (zebrafish, flying fish); training on another species would present its organ proportions as theirs',
    candidate_data_other_species: level === 'tissue' ? [] : ORGAN_CANDIDATE_DATA };
}

export function generateNoData({ level }) {
  const s = status(level);
  return { status: s.status, candidates: [], backend: null, detail: s,
    scope: level === 'cell'
      ? 'Nothing generated: no cell-level generative endpoint is configured.'
      : `Nothing generated at the ${level} level: there is no real ${level}-size training set for zebrafish or flying fish, and this backend does not train on invented or other-species data. Use organism_edit for organ parameters.` };
}
