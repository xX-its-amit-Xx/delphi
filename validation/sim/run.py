"""Simulations that check three Lean results (pre-registered in validation/PREREG.md).

    OMP_NUM_THREADS=2 python validation/sim/run.py

Writes validation/sim/results.json. Every cell has its own seed stream from SeedSequence(20261031).spawn,
in the order of PREREG.md, so a clean checkout reproduces every number. Idealised models only; nothing here
is about real organisms.
"""
import hashlib, json, math, os, platform, sys, time
os.environ.setdefault("OMP_NUM_THREADS", "2")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "2")
import numpy as np
import scipy
from scipy import stats, linalg

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MASTER_SEED = 20261031
R_WF = 40_000
ALPHA = 0.01


def cp_two_sided(k, n, conf):
    a = 1 - conf
    lo = 0.0 if k == 0 else stats.beta.ppf(a / 2, k, n - k + 1)
    hi = 1.0 if k == n else stats.beta.ppf(1 - a / 2, k + 1, n - k)
    return float(lo), float(hi)


def cp_upper(k, n, conf):
    return 1.0 if k == n else float(stats.beta.ppf(conf, k + 1, n - k))


def wf_prob(x, M, s):
    return (1 + s) * x / (M + s * x)


def simulate_wf(M, i, s, R, rng, cap_factor=200):
    """R replicates of Wright-Fisher with mutant fitness 1+s, run to absorption or cap. Returns (fixed, lost, unresolved, max_gen)."""
    x = np.full(R, i, dtype=np.int64)
    active = np.arange(R)
    gen = 0
    cap = cap_factor * M
    while active.size and gen < cap:
        xa = x[active]
        x[active] = rng.binomial(M, wf_prob(xa.astype(float), M, s))
        xa = x[active]
        active = active[(xa > 0) & (xa < M)]
        gen += 1
    fixed = int((x == M).sum())
    unresolved = int(active.size)
    return fixed, R - fixed - unresolved, unresolved, gen


def exact_fixation(M, i, s):
    """Exact eventual fixation probability of the same chain: solve (I - Q) h = r on transient states 1..M-1."""
    states = np.arange(1, M)
    p = wf_prob(states.astype(float), M, s)
    k = np.arange(M + 1)
    P = stats.binom.pmf(k[None, :], M, p[:, None])  # rows: transient states, cols: 0..M
    Q = P[:, 1:M]
    r = P[:, M]
    h = linalg.solve(np.eye(M - 1) - Q, r)
    return float(h[i - 1])


def kimura_approx(M, i, s):
    if s == 0:
        return i / M
    return (1 - math.exp(-2 * s * i)) / (1 - math.exp(-2 * s * M))


def i_values(M, which):
    vals = []
    for w in which:
        v = {"1": 1, "M/10": M // 10, "M/2": M // 2, "M-1": M - 1}[w]
        if w == "M/10" and v == 1:
            continue
        if v not in vals:
            vals.append(v)
    return vals


def sex_cell(K, q0, f, mode, R, rng, gens=8, f_sex_mult=1.0, daughter_p=0.5, count_all_offspring=False):
    """Individual-based asexual vs sexual females. Returns per-replicate sums and log-odds slopes."""
    sums = np.zeros((R, 4))  # asexual mothers, asexual output, sexual mothers, sexual output
    slopes = []
    for r in range(R):
        a = int(round(q0 * K)); b = K - a
        odds_t = [math.log(a / b)]
        for g in range(gens):
            if mode == "fixed":
                a_off = a * f
                s_off = int(round(b * f * f_sex_mult))
            else:
                a_off = int(rng.poisson(a * f))
                s_off = int(rng.poisson(b * f * f_sex_mult))
            a_d = a_off  # all daughters
            s_d = int(rng.binomial(s_off, daughter_p))  # mating is assumed never limited by males
            sums[r] += (a, a_off if count_all_offspring else a_d, b, s_off if count_all_offspring else s_d)
            D = a_d + s_d
            if D > K:
                a = int(rng.hypergeometric(a_d, s_d, K)); b = K - a
            else:
                a, b = a_d, s_d
            if a == 0 or b == 0:
                break
            odds_t.append(math.log(a / b))
            if a / (a + b) >= 0.95:
                break
        if len(odds_t) >= 3:
            t = np.arange(len(odds_t))
            slopes.append(float(np.polyfit(t, odds_t, 1)[0]))
    G = (sums[:, 1].sum() / sums[:, 0].sum()) / (sums[:, 3].sum() / sums[:, 2].sum())
    idx = rng.integers(0, R, size=(2000, R))
    bs = sums[idx].sum(axis=1)
    Gb = (bs[:, 1] / bs[:, 0]) / (bs[:, 3] / bs[:, 2])
    return float(G), float(Gb.std(ddof=1)), slopes


def main():
    t_start = time.time()
    prereg = open(os.path.join(ROOT, "PREREG.md"), "rb").read()
    ss = np.random.SeedSequence(MASTER_SEED)
    # Cells in PREREG order: 15 A, 21 B, 2 controls, 12 C, 3 variants = 53 streams.
    A_cells = [(M, i) for M in (10, 50, 200, 1000) for i in i_values(M, ["1", "M/10", "M/2", "M-1"])]
    B_cells = [(s, M, i) for s in (0.001, 0.01, 0.1) for M in (10, 50, 200, 1000) for i in i_values(M, ["1", "M/10"])]
    N_cells = [(-0.01, 200, 20), (-0.001, 200, 20)]
    C_cells = [(K, q0, f, mode) for (K, q0) in ((1000, 0.1), (100_000, 0.01)) for f in (2, 4, 10) for mode in ("fixed", "poisson")]
    V_cells = [("V1 count sons too", dict(count_all_offspring=True), 1.0),
               ("V2 males double sexual fecundity", dict(f_sex_mult=2.0), 1.0),
               ("V3 sexual broods 2/3 daughters", dict(daughter_p=2 / 3), 1.5)]
    assert (len(A_cells), len(B_cells)) == (15, 21), (len(A_cells), len(B_cells))
    children = ss.spawn(len(A_cells) + len(B_cells) + len(N_cells) + len(C_cells) + len(V_cells))
    kS = len(A_cells) + len(B_cells) + len(N_cells)
    out = {"prereg_sha256": hashlib.sha256(prereg).hexdigest(), "master_seed": MASTER_SEED,
           "python": sys.version.split()[0], "numpy": np.__version__, "scipy": scipy.__version__, "platform": platform.platform(),
           "A": [], "B": [], "controls": [], "C": [], "variants": []}
    ci = 0

    def wf_record(M, i, s, child, family_k, test):
        rng = np.random.default_rng(child)
        t = time.time()
        fixed, lost, unres, gens = simulate_wf(M, i, s, R_WF, rng)
        ex = exact_fixation(M, i, s)
        frac = fixed / R_WF
        lo, hi = cp_two_sided(fixed, R_WF, 1 - ALPHA / family_k)
        slo, shi = cp_two_sided(fixed, R_WF, 1 - ALPHA / kS)
        rec = dict(M=M, i=i, s=s, R=R_WF, fixed=fixed, lost=lost, unresolved=unres, max_generations_run=gens,
                   fraction=frac, i_over_M=i / M, exact=ex, kimura_diffusion=kimura_approx(M, i, s),
                   S_ci=[slo, shi], S_pass=bool(slo <= ex <= shi), spawn_key=list(child.spawn_key), seconds=round(time.time() - t, 2))
        if test == "two-sided":
            rec.update(ci=[lo, hi], passed=bool(lo <= i / M <= hi), exact_minus_i_over_M=ex - i / M)
        else:
            up = cp_upper(fixed, R_WF, 1 - ALPHA / family_k)
            rec.update(upper=up, passed=bool(up >= i / M))
        return rec

    for (M, i) in A_cells:
        out["A"].append(wf_record(M, i, 0.0, children[ci], len(A_cells), "two-sided")); ci += 1
        print("A", out["A"][-1]["M"], out["A"][-1]["i"], out["A"][-1]["fraction"], out["A"][-1]["passed"], out["A"][-1]["seconds"], flush=True)
    for (s, M, i) in B_cells:
        out["B"].append(wf_record(M, i, s, children[ci], len(B_cells), "upper")); ci += 1
        print("B", s, M, i, out["B"][-1]["fraction"], out["B"][-1]["passed"], out["B"][-1]["seconds"], flush=True)
    for (s, M, i) in N_cells:
        rec = wf_record(M, i, s, children[ci], len(B_cells), "upper"); ci += 1
        rec["detected_violation"] = not rec["passed"]
        out["controls"].append(rec)
        print("control", s, rec["fraction"], rec["detected_violation"], flush=True)
    zC = stats.norm.ppf(1 - ALPHA / len(C_cells) / 2)
    z2 = stats.norm.ppf(1 - ALPHA / 6 / 2)
    for (K, q0, f, mode) in C_cells:
        rng = np.random.default_rng(children[ci]); key = list(children[ci].spawn_key); ci += 1
        t = time.time()
        G, se, slopes = sex_cell(K, q0, f, mode, 200, rng)
        sl = np.array(slopes)
        rec = dict(K=K, q0=q0, f=f, mode=mode, replicates=200, G=G, G_se=se, G_ci=[G - zC * se, G + zC * se],
                   C1_pass=bool(G - zC * se <= 2 <= G + zC * se),
                   slope_mean=float(sl.mean()), slope_se=float(sl.std(ddof=1) / math.sqrt(len(sl))), slope_n=len(sl),
                   slope_growth_factor=float(math.exp(sl.mean())), spawn_key=key, seconds=round(time.time() - t, 2))
        if K == 100_000:
            rec["C2_ci"] = [rec["slope_mean"] - z2 * rec["slope_se"], rec["slope_mean"] + z2 * rec["slope_se"]]
            rec["C2_pass"] = bool(rec["C2_ci"][0] <= math.log(2) <= rec["C2_ci"][1])
        out["C"].append(rec)
        print("C", K, f, mode, round(G, 4), rec["C1_pass"], rec.get("C2_pass"), rec["seconds"], flush=True)
    zV = stats.norm.ppf(1 - ALPHA / 3 / 2)
    for (name, kw, expected) in V_cells:
        rng = np.random.default_rng(children[ci]); key = list(children[ci].spawn_key); ci += 1
        G, se, slopes = sex_cell(100_000, 0.01, 4, "poisson", 200, rng, **kw)
        rec = dict(variant=name, expected=expected, G=G, G_se=se, ci=[G - zV * se, G + zV * se],
                   passed=bool(G - zV * se <= expected <= G + zV * se), slope_growth_factor=float(math.exp(np.mean(slopes))) if slopes else None, spawn_key=key)
        out["variants"].append(rec)
        print("V", name, round(G, 4), rec["passed"], flush=True)

    out["summary"] = {
        "T1_neutral": f'{sum(r["passed"] for r in out["A"])}/{len(out["A"])} cells pass',
        "T2_selection": f'{sum(r["passed"] for r in out["B"])}/{len(out["B"])} cells pass',
        "controls_detected": f'{sum(r["detected_violation"] for r in out["controls"])}/{len(out["controls"])}',
        "S_simulator_vs_exact": f'{sum(r["S_pass"] for r in out["A"] + out["B"] + out["controls"])}/{kS} cells agree',
        "max_abs_exact_minus_i_over_M": max(abs(r["exact_minus_i_over_M"]) for r in out["A"]),
        "unresolved_replicates": sum(r["unresolved"] for r in out["A"] + out["B"] + out["controls"]),
        "T3_C1": f'{sum(r["C1_pass"] for r in out["C"])}/{len(out["C"])} cells pass',
        "T3_C2": f'{sum(r["C2_pass"] for r in out["C"] if "C2_pass" in r)}/{sum("C2_pass" in r for r in out["C"])} cells pass',
        "variants_as_expected": f'{sum(r["passed"] for r in out["variants"])}/{len(out["variants"])}',
        "seconds": round(time.time() - t_start, 1),
    }
    with open(os.path.join(HERE, "results.json"), "w") as fh:
        json.dump(out, fh, indent=1)
    print(json.dumps(out["summary"], indent=1))


if __name__ == "__main__":
    main()
