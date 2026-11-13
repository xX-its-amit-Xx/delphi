#!/usr/bin/env bash
# Re-fetches every external file used by t4-glide-deep into D:/Users/ashenoy00000/delphi-work/data (skips files that exist).
set -u
D=D:/Users/ashenoy00000/delphi-work/data
UA="delphi-research/0.1"
mkdir -p $D/t4-glide-deep-pdfs $D/t4-glide-deep-html $D/t4-glide-repo
for id in 1811.12221 1902.08038 2408.08864 2010.12553 2508.05106 2503.22606 2107.00738; do
  f=$D/t4-glide-deep-pdfs/$id.pdf
  [ -s $f ] || { curl -sL -A "$UA" -o $f https://arxiv.org/pdf/$id; sleep 3; }
  [ -s ${f%.pdf}.raw.txt ] || pdftotext $f ${f%.pdf}.raw.txt
done
[ -s $D/t4-glide-deep-html/smith2015.xml ] || curl -s -A "$UA" -o $D/t4-glide-deep-html/smith2015.xml "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC4485961/fullTextXML"
[ -s $D/t4-glide-deep-html/wies.xml ] || curl -s -A "$UA" -o $D/t4-glide-deep-html/wies.xml "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC9659746/fullTextXML"
if [ ! -s $D/t4-glide-repo/repo.zip ]; then
  curl -sL -A "$UA" -o $D/t4-glide-repo/repo.zip https://github.com/jerabaul29/EffectFoldAngleAutorotatingSeeds/archive/refs/heads/master.zip
  (cd $D/t4-glide-repo && unzip -q -o repo.zip -d x)
fi
echo "file | bytes | sha256"
for f in $D/t4-glide-deep-pdfs/*.pdf $D/t4-glide-deep-html/*.xml $D/t4-glide-repo/repo.zip; do
  echo "$f | $(stat -c %s $f) | $(sha256sum $f | cut -d' ' -f1)"
done
