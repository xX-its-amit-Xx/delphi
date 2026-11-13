#!/usr/bin/env bash
# Fetch the public data for track 6 (flying fish). Run from anywhere. Needs: curl, sha256sum, md5sum.
# DATA root defaults to D:/Users/ashenoy00000/delphi-work/data/flyingfish ; override with DATA=...
set -euo pipefail
DATA="${DATA:-/d/Users/ashenoy00000/delphi-work/data/flyingfish}"
UA="delphi-research/0.1"
mkdir -p "$DATA/deng2019" "$DATA/makiguchi2013"

# 1. Deng et al. 2019, Bioinspiration & Biomimetics 14:046009, Zenodo record 8382768 (CC-BY-4.0)
curl -sL -A "$UA" -o "$DATA/deng2019/Deng_2019_Bioinspir._Biomim._14_046009.pdf" \
  "https://zenodo.org/api/records/8382768/files/Deng_2019_Bioinspir._Biomim._14_046009.pdf/content"
# Zenodo lists md5 f7c5348f72d19a383076e7f0bda2e3cb and size 1550487
echo "f7c5348f72d19a383076e7f0bda2e3cb  $DATA/deng2019/Deng_2019_Bioinspir._Biomim._14_046009.pdf" | md5sum -c -

# 2. Makiguchi et al. 2013, Aquatic Biology 18:105-111, publisher open-access PDF
curl -sL -A "$UA" -o "$DATA/makiguchi2013/b018p105.pdf" \
  "https://www.int-res.com/articles/ab2013/18/b018p105.pdf"

# 3. Daane et al. 2021 Data S1 (Current Biology supplement mmc2.xlsx) and Park & Choi 2010 PDF cannot be re-fetched
#    automatically: PMC serves a JavaScript proof-of-work page, Elsevier CDN and the publisher return 403 to curl.
#    They are read from the project's own cached copies (see README in the result JSON) and hashed:
#      delphisci/genotype/cache/daane2021_data_s1_mmc2.xlsx
#      delphisci/physics/prior-art/raw/wb-park-choi-2010.pdf
echo "sizes and sha256:"
sha256sum "$DATA"/deng2019/*.pdf "$DATA"/makiguchi2013/*.pdf
ls -l "$DATA"/deng2019 "$DATA"/makiguchi2013
