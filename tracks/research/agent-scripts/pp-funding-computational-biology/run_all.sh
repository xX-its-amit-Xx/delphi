#!/bin/bash
# Re-fetch all pages used in the report (needs curl, python3). Output in scratch dir; prints bytes + sha256 prefix.
D=$(dirname "$0")
$D/fetch.sh nsf-emb https://www.nsf.gov/funding/opportunities/emb-emerging-mathematics-biology/nsf25-509/solicitation
$D/fetch.sh nsf-biocore https://www.nsf.gov/funding/opportunities/bio-core-core-research-biological-sciences/nsf26-517/solicitation
$D/fetch.sh nsf-mb https://www.nsf.gov/funding/opportunities/mathematical-biology
$D/fetch.sh mira https://www.nigms.nih.gov/Research/mechanisms/MIRA/Pages/default
$D/fetch.sh r01 https://grants.nih.gov/grants-process/submit/submission-policies/standard-due-dates
$D/fetch.sh hfsp-rg https://www.hfsp.org/funding/hfsp-funding/research-grants
$D/fetch.sh wellcome-da https://wellcome.org/research-funding/schemes/wellcome-discovery-awards
$D/fetch.sh templeton-ls https://www.templeton.org/funding-areas/life-sciences
$D/fetch.sh templeton-cal https://www.templeton.org/grants/grant-calendar
$D/fetch.sh arpah-ofo https://arpa-h.gov/explore-funding/open-funding-opportunities
$D/fetch.sh anth-expand https://www.anthropic.com/news/ai-for-science-expands-foundations-research-institutions
$D/fetch.sh anth-ai https://www.anthropic.com/news/ai-for-science-program
$D/fetch.sh convergent-gi https://www.convergentresearch.org/get-involved
$D/fetch.sh astera-res https://astera.org/residency/
$D/fetch.sh coef-rfps https://coefficientgiving.org/funds/science-and-global-health-rd/
