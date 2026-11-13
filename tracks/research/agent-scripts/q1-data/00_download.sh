#!/bin/sh
# Download GSE186265 supplementary files (3 files, ~7 MB) and verify sha256. Requires curl, sha256sum.
D=/d/Users/ashenoy00000/delphi-work/data/martinezara2022; mkdir -p $D; cd $D
B=https://ftp.ncbi.nlm.nih.gov/geo/series/GSE186nnn/GSE186265/suppl
for f in GSE186265_ActivitiesAndBoostIndices_Downstream.tsv.gz GSE186265_Activities_allcombinations_Upstream.tsv.gz GSE186265_BoostIndices_cCRE-P_Upstream.tsv.gz; do curl -s -A delphi-research/0.1 -O $B/$f; done
sha256sum *.gz
echo expect: 32336d6f3b8ed5aa0829e31d2a6b56665786637785f73841c872d998beb60a03 Upstream_allcombinations
