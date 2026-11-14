# Pre-registration: cs-enhancer-rank
Written (UTC, from shell `date -u`): 2026-11-14T04:18:00Z — before any activity value was aggregated, plotted or fitted.
Only the file header and row count (6,214,483 barcode rows) had been looked at.

Data: GEO GSE184426, file GSE184426_ExP_1Kx1K_counts.txt.gz (Bergman et al. 2022, ExP STARR-seq, K562, barcode-level counts).
Columns used: promoter, enhancer, DNA_input, reads_rep1..4 (raw reads; weighted_reads not used).

## Held-out rule (cannot be tuned)
- H_enh (whole enhancers): enhancer id string with int(sha256(id).hexdigest()[:8],16) % 5 == 0. All cells of these enhancers are held out.
- H_cell (cells): among the remaining enhancers, cells with int(sha256(promoter+"|"+enhancer).hexdigest()[:8],16) % 5 == 0.
- Development = everything else. All filters, pseudocounts, noise model and thresholds are chosen on development only and then frozen in frozen.json.
- The held-out parts are read exactly once, by `run.py final`.

## Law under test
Multiplicative model: log2 activity(p,e) = mu + a_e + b_p (activity = enhancer strength x promoter strength).
Lean bound: EPSpec.no_reversal_of_monotone / Q1.no_reversal — any model f(p,e)=h_p(a_e) with monotone h_p (includes multiplicative and saturating) allows ZERO true rank reversals; so reversals beyond measurement noise falsify the whole class.

## Final metrics (single evaluation)
1. R^2 of the multiplicative model (fit on development cells) on H_cell cells. Baselines: development grand mean (R^2=0 by construction), promoter-only, enhancer-only. Ceiling: replicate-half reliability. Broken-input control: enhancer labels of development cells shuffled before fitting; R^2 must drop.
2. Rank flips on H_enh: over all pairs of held-out enhancers and all pairs among the 50 promoters with the largest total DNA_input (a non-outcome quantity), the fraction of quadruples ordered significantly (|z|>3 on both promoters, z from the development noise model) that are in opposite order. Compared with (a) 0 allowed by the Lean theorem for the noise-free class, (b) the fraction produced by simulating the additive fit plus the development noise model. Broken-input control: permute enhancer labels independently per promoter; flip fraction must rise toward 0.5.

## Amendment 1 (2026-11-14T04:19:44Z) — made after the development rehearsal, before the held-out files were read
The development rehearsal showed the replicate-only noise model is too optimistic: the 4 RNA replicates share the same barcodes, so barcode-to-barcode
variation is invisible to it. Change (development data only): each cell's barcodes are split in two halves by the last base of the barcode (A/C vs G/T);
the SD of the half-difference of log2 activity, by decile of total RNA, divided by 2, gives a barcode-level standard error. The frozen SE per cell is the
larger of the replicate SE and the barcode SE. Everything else is unchanged. Held-out cells had not been loaded by any analysis step at this point.
