"""Check the claim the contracting route rests on, before anyone builds anything on it.

    python tracks/scripts/check-timoshenko-ceiling.py

CLAIM (from the bilayer-physics agent, which derived it and could not find it stated in a source):
for the Timoshenko bilayer coefficient

    f(m, n) = 6(1+m)^2 / [ 3(1+m)^2 + (1+mn)(m^2 + 1/(mn)) ]

with m = h_stiff/h_active and n = E_stiff/E_active, the value is at most 3/2 for all m, n > 0, with
equality exactly when m^2 n = 1.

Why it matters more than it looks: curvature is kappa = f * d_eps / h. If f has a ceiling of 3/2
reached at a thickness ratio that depends only on n, then at the optimum

    R = 1 / kappa = h / (1.5 * d_eps)

and the MODULUS RATIO HAS DROPPED OUT. The hardest quantity to measure on a printed part stops
mattering, and the prediction becomes parameter-free: measure the swelling strain on a free coupon
and the total thickness with callipers, and the law names the radius with nothing fitted.

The proof is one application of AM-GM. Expanding the second bracket,

    (1+mn)(m^2 + 1/(mn)) = m^2 + 1/(mn) + m^3 n + 1

and AM-GM on the two terms that carry n gives m^3 n + 1/(mn) >= 2*sqrt(m^2) = 2m, with equality iff
m^3 n = 1/(mn), i.e. m^2 n = 1. So the denominator is at least 3(1+m)^2 + 1 + m^2 + 2m = 4(1+m)^2,
and f <= 6/4 = 3/2.

This script does not take that on trust. It (1) evaluates f on a dense grid and reports the maximum,
(2) checks f = 3/2 exactly along m = n^(-1/2) in exact rational arithmetic, and (3) runs a numerical
optimiser from many starts to try to BEAT 3/2. A ceiling nobody tried to break is not a ceiling.
"""
from fractions import Fraction as F


def f_float(m, n):
    num = 6.0 * (1.0 + m) ** 2
    den = 3.0 * (1.0 + m) ** 2 + (1.0 + m * n) * (m * m + 1.0 / (m * n))
    return num / den


def f_exact(m, n):
    """Same function in exact rationals, so the equality case is not a floating-point near-miss."""
    num = 6 * (1 + m) ** 2
    den = 3 * (1 + m) ** 2 + (1 + m * n) * (m * m + F(1, 1) / (m * n))
    return num / den


def main():
    ok = True

    # (1) dense grid over six decades in each variable
    best, best_at = 0.0, None
    m = 1e-3
    while m <= 1e3:
        n = 1e-3
        while n <= 1e3:
            v = f_float(m, n)
            if v > best:
                best, best_at = v, (m, n)
            n *= 1.05
        m *= 1.05
    print(f"(1) grid maximum over m,n in [1e-3, 1e3]: f = {best:.12f} at m={best_at[0]:.4g}, n={best_at[1]:.4g}")
    print(f"    m^2 n at that point = {best_at[0] ** 2 * best_at[1]:.6f}  (the equality condition says 1)")
    if best > 1.5 + 1e-9:
        print("    FAIL: the grid exceeds 3/2")
        ok = False

    # (2) exact arithmetic along the predicted optimum, for n a perfect square so m = 1/sqrt(n) is rational
    print("(2) exact rational check along m = n^(-1/2):")
    for root in (1, 2, 3, 5, 10, 31):
        n = F(root * root, 1)
        m = F(1, root)
        v = f_exact(m, n)
        mark = "ok" if v == F(3, 2) else "FAIL"
        if v != F(3, 2):
            ok = False
        print(f"    n={int(n):5d}  m=1/{root:<3d}  f = {v}  [{mark}]")
    # and a non-square n via a rational approximation to 1/sqrt(n): f must be just BELOW 3/2
    n = F(7, 1)
    m = F(37796, 100000)  # ~ 1/sqrt(7)
    print(f"    n=7, m~1/sqrt(7) (rational): f = {float(f_exact(m, n)):.12f}  (strictly under 1.5, as it must be)")

    # (3) try to beat the ceiling: Nelder-Mead-ish random restarts in log space
    import math
    import random
    random.seed(20261112)
    worst = 0.0
    for _ in range(4000):
        lm, ln = random.uniform(-7, 7), random.uniform(-7, 7)
        step = 0.7
        cur = f_float(math.exp(lm), math.exp(ln))
        for _ in range(400):
            improved = False
            for dlm, dln in ((step, 0), (-step, 0), (0, step), (0, -step), (step, step), (-step, -step)):
                v = f_float(math.exp(lm + dlm), math.exp(ln + dln))
                if v > cur:
                    cur, lm, ln, improved = v, lm + dlm, ln + dln, True
            if not improved:
                step *= 0.5
                if step < 1e-12:
                    break
        worst = max(worst, cur)
    print(f"(3) best of 4000 hill-climbs from random starts: f = {worst:.12f}")
    if worst > 1.5 + 1e-9:
        print("    FAIL: an optimiser beat 3/2")
        ok = False

    # what the ceiling buys, in the numbers the proof of concept would use
    print("\nwhat the ceiling means for a printed strip, R = h / (1.5 * d_eps):")
    print(f"    {'h (mm)':>8} {'d_eps':>8} {'R (mm)':>9} {'tip angle over 40 mm':>22}")
    for h in (0.4, 0.8, 1.6):
        for de in (0.002, 0.005, 0.01, 0.02):
            R = h / (1.5 * de)
            ang = math.degrees(40.0 / R)
            print(f"    {h:8.1f} {de * 100:7.1f}% {R:9.1f} {ang:21.1f} deg")

    # the cost of not being at the optimum, which is the design advice that follows from it
    print("\ncost of using equal layers (m=1) instead of the optimum, by modulus ratio n:")
    for n in (1, 2, 5, 10, 50, 100):
        print(f"    n={n:4d}: f(1,n) = {f_float(1.0, n):.4f}  ->  {100 * f_float(1.0, n) / 1.5:5.1f}% of the ceiling"
              f"   (optimum at m = {n ** -0.5:.3f})")

    print("\nVERDICT:", "the ceiling holds in every check" if ok else "THE CLAIM FAILED A CHECK")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
