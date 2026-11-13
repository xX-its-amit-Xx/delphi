#!/bin/sh
# EPO publication server serves EP specs without a browser. Saves to data/ip-deep.
curl -s -m 60 -A "delphi-research/0.1" -o D:/Users/ashenoy00000/delphi-work/data/ip-deep/EP4019251B1_epo_publication_server.html \
  "https://data.epo.org/publication-server/rest/v1.2/patents/EP4019251NWB1/document.html"
sha256sum D:/Users/ashenoy00000/delphi-work/data/ip-deep/EP4019251B1_epo_publication_server.html   # expect db7ec298...353a, 115885 bytes
python -I txt.py D:/Users/ashenoy00000/delphi-work/data/ip-deep/EP4019251B1_epo_publication_server.html D:/Users/ashenoy00000/delphi-work/data/ip-deep/EP4019251B1_epo_publication_server.txt
