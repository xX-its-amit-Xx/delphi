You are preparing a PRE-REGISTERED empirical test plan for a historical claim in biology, to the standard of a clinical-trial pre-registration.

For the claim below, produce one test plan as JSON matching the schema you were given:
- hypothesis: one sentence stating what must be true of the data if the claim holds.
- pass_criterion and fail_criterion: a measured quantity with a numeric threshold, written before any data is seen.
- interpretation: how the author's 19th/early-20th-century terms map onto quantities a public dataset actually records; state any modern reinterpretation.
- dataset: exactly ONE real, public, currently existing dataset that could decide the test. Give its true title, its publisher, its landing page URL and its DOI if it has one.

Hard rules. Breaking any of them makes the plan worthless:
1. Never invent a dataset, DOI, accession or URL. Every identifier you write must resolve to a real page about that dataset. A plausible-looking URL that does not exist is worse than no URL.
2. If you are not sure a dataset exists under that URL, either verify it or name a different dataset you are sure about. Well-known portals (GBIF, NCBI, Dryad, Zenodo, PANGAEA, figshare, government statistical agencies, museum collection databases) are safer than a specific paper's supplement you half-remember.
3. If no suitable public dataset exists, set dataset to null and explain in no_dataset_reason. An honest null scores better than a fabricated identifier.
4. Prefer a dataset whose landing page lists downloadable files or an API, and say which fields would be used.
5. Test the claim as the author stated it, within its stated scope. Do not test a weakened paraphrase.
6. List in identifiers every URL and DOI that appears anywhere in your plan.
Output only the JSON object.
