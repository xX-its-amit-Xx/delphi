// The builders' pre-registered decision rules, transcribed from each claim test's result.json prose and
// applied to the held-out rows alone. Used by run-claim-exam.mjs (the exam) and holdout/power-analysis.mjs
// (clade sizing). Each rule's `min_n` is the builder's own underpowered threshold, applied unchanged.
const mean = a => a.reduce((p, q) => p + q, 0) / a.length;
const rank = a => { const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]); const r = []; idx.forEach(([, i], k) => r[i] = k + 1); return r; };
const pearson = (a, b) => { const ma = mean(a), mb = mean(b); let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; } return sab / Math.sqrt(saa * sbb); };
const ols = (x, y) => { const mx = mean(x), my = mean(y); let sxy = 0, sxx = 0; for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; } const slope = sxy / sxx; const n = x.length; let sse = 0; for (let i = 0; i < n; i++) sse += (y[i] - (my + slope * (x[i] - mx))) ** 2; const se = n > 2 ? Math.sqrt(sse / (n - 2) / sxx) : null; return { slope, se, ci95: se != null ? [slope - 1.96 * se, slope + 1.96 * se] : null }; };

export const RULES = {
  'kimura-heterozygosity': {
    min_n: 50, // "INCONCLUSIVE (underpowered) if fewer than 50 species qualify"
    heldOutKey: 'holdout_aves',
    evaluate(h, main) {
      const sp = h.bird_species || [];
      const x = sp.map(s => s.log10_popsize), y = sp.map(s => Math.log10(s.diversity));
      const n = sp.length;
      const fit = n > 2 ? ols(x, y) : { slope: null, se: null, ci95: null };
      const rho = n > 2 ? pearson(rank(x), rank(y)) : null;
      const measured = { value: fit.slope, unit: 'OLS slope of log10(pi) on log10(census N) among held-out species only', n, uncertainty: fit.ci95 ? `95% CI [${fit.ci95[0].toFixed(3)}, ${fit.ci95[1].toFixed(3)}] (normal approximation)` : null, extra: { spearman_rho_heldout: rho, heldout_mean_residual_from_training_fit: h.bird_mean_residual_log10_pi_from_main_fit ?? null, training_fit: { slope: main.ols_slope, ci95: main.ols_slope_ci95, n: main.n_species } } };
      if (n < this.min_n) return { measured, verdict: 'inconclusive', reason: `underpowered: ${n} held-out species, the pre-registered rule needs ${this.min_n}` };
      const hi = fit.ci95[1];
      const verdict = rho > 0.5 && fit.slope >= 0.3 && hi >= 0.5 ? 'supports' : (hi < 0.25 || rho <= 0) ? 'refutes' : 'mixed';
      return { measured, verdict, reason: 'pre-registered thresholds applied to held-out species alone (p-value for rho not computed; slope CI by normal approximation)' };
    }
  },
  'hamilton-senescence': {
    min_n: 15, // "INCONCLUSIVE (underpowered) if fewer than 15 species qualify"
    heldOutKey: 'holdout_aves',
    evaluate(h) {
      const sp = h.bird_species || [];
      const n = sp.length, rising = sp.filter(s => s.rho > 0).length;
      const meanRho = n ? mean(sp.map(s => s.rho)) : null;
      const frac = n ? rising / n : null;
      const measured = { value: frac, unit: 'fraction of held-out species with Spearman rho(age, adult mortality) > 0', n, extra: { rising, falling: sp.filter(s => s.rho < 0).length, flat: sp.filter(s => s.rho === 0).length, mean_spearman_rho: meanRho } };
      if (n < this.min_n) return { measured, verdict: 'inconclusive', reason: `underpowered: ${n} held-out species, the pre-registered rule needs ${this.min_n}` };
      return { measured, verdict: frac >= 0.8 && meanRho > 0.3 ? 'supports' : frac < 0.5 ? 'refutes' : 'mixed', reason: 'pre-registered thresholds applied to held-out species alone' };
    }
  }
};
