#!/bin/sh
# usage: epmc_fulltext.sh PMCID -> saves plain text (tags stripped) into data dir
D=/d/Users/ashenoy00000/delphi-work/data/bm-polyamide
curl -s -A "delphi-research/0.1" "https://www.ebi.ac.uk/europepmc/webservices/rest/$1/fullTextXML" -o "$D/$1.xml"
printf 'https://www.ebi.ac.uk/europepmc/webservices/rest/%s/fullTextXML\t%s\t%s\t%s\t%s.xml\n' $1 $(date -u +%F) $(wc -c <"$D/$1.xml") $(sha256sum "$D/$1.xml"|cut -d' ' -f1) $1 >> $D/MANIFEST.tsv
python -I - "$D/$1.xml" "$D/$1.txt" <<'P'
import re,sys,html
s=open(sys.argv[1],encoding='utf8').read()
s=re.sub(r'</(p|title|label|td|th|tr|caption)>','\n',s)
s=re.sub(r'<[^>]+>','',s); s=html.unescape(s)
open(sys.argv[2],'w',encoding='utf8').write(s)
print(len(s))
P
