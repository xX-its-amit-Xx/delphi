#!/bin/bash
# Step 0: the three index pages (generic User-Agent), then run the python steps listed in the report's reproduce list.
S=/d/Users/ashenoy00000/delphi-work/agents2/scratch/bm-formlabs-all-resins
mkdir -p $S/web $S/old $S/img
UA="delphi-research/0.1"
curl -sL -A "$UA" -o $S/materials.html https://formlabs.com/materials/
curl -sL -A "$UA" -o $S/solvent.html https://formlabs.com/support/solvent-compatibility/
curl -sL -A "$UA" -o $S/datasheets.html https://formlabs.com/materials/data-sheets/
curl -sL -A "$UA" -o $S/old/clear_v5_old.pdf "https://formlabs-media.formlabs.com/filer_public/dd/7f/dd7f3de9-55ae-4c82-ac52-408a4b5df64d/clear_resin_v5_tds___formlabs.pdf"
curl -sL -A "$UA" -o $S/web/formlabs.com_blog_advanced-3dp-techniques_.html https://formlabs.com/blog/advanced-3dp-techniques/
curl -sL -A "$UA" -o $S/web/forum.formlabs.com_t_gluing-elastic-50a-and-durable-resins-t.html https://forum.formlabs.com/t/gluing-elastic-50a-and-durable-resins-together-two-different-resins-in-general/31779
curl -sL -A "$UA" -o $S/web/forum.formlabs.com_t_gluing-two-elastic-resin-parts_26763.html https://forum.formlabs.com/t/gluing-two-elastic-resin-parts/26763
curl -sL -A "$UA" -o $S/web/products_form-4.html https://formlabs.com/products/form-4/
