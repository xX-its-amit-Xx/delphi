"""s01: independent numerical re-derivation of the Timoshenko coefficient.

Solves the 1-D two-layer (Euler-Bernoulli) problem by force and moment balance with
a linear solve (no closed form used), then compares with the project-record formula
f(m,n) = 6(1+m)^2 / [3(1+m)^2 + (1+mn)(m^2 + 1/(mn))]
over m in [0.05, 20], n in {1,2,5,10,50}. Also finds max_m f for each n and the
argmax, to compare with the ceiling 3/2 at m = n^(-1/2).
Layer 1 (bottom, thickness h1 = m*h2, modulus E1 = n*E2) carries free strain d_eps;
layer 2 carries 0. Curvature positive = layer 1 on the outside (longer side).
"""
import _env  # noqa: F401
import numpy as np

def f_closed(m, n):
    return 6 * (1 + m) ** 2 / (3 * (1 + m) ** 2 + (1 + m * n) * (m ** 2 + 1 / (m * n)))

def f_numeric(m, n, nu1=None, nu2=None):
    """Unknowns: mid-plane-free strain e0 and curvature k (per unit d_eps, h=1).
    Total strain e(z) = e0 + k*z with z from bottom (0..1). Stress s_i = E_i (e - eps_i).
    Balance: integral s dz = 0 and integral s z dz = 0."""
    h2 = 1.0 / (1.0 + m)
    h1 = m * h2
    E1, E2 = n, 1.0
    eps1, eps2 = 1.0, 0.0
    # integrals of 1 and z over layers
    def I0(a, b): return b - a
    def I1(a, b): return 0.5 * (b * b - a * a)
    def I2(a, b): return (b ** 3 - a ** 3) / 3.0
    A = np.array([
        [E1 * I0(0, h1) + E2 * I0(h1, 1), E1 * I1(0, h1) + E2 * I1(h1, 1)],
        [E1 * I1(0, h1) + E2 * I1(h1, 1), E1 * I2(0, h1) + E2 * I2(h1, 1)],
    ])
    b = np.array([
        E1 * eps1 * I0(0, h1) + E2 * eps2 * I0(h1, 1),
        E1 * eps1 * I1(0, h1) + E2 * eps2 * I1(h1, 1),
    ])
    e0, k = np.linalg.solve(A, b)
    return -k  # sign: expanding bottom layer gives dk/dz < 0 in this z convention

if __name__ == "__main__":
    ms = np.geomspace(0.05, 20, 81)
    ns = [1, 2, 5, 10, 50]
    lines = []
    worst = 0.0
    for n in ns:
        for m in ms:
            d = abs(f_numeric(m, n) - f_closed(m, n))
            worst = max(worst, d)
    lines.append(f"max |f_numeric - f_closed| over m in [0.05,20] (81 pts), n in {ns}: {worst:.3e}")
    lines.append("n, argmax_m (fine grid), max f, predicted m=n^-0.5, f at predicted, 1.5 - max f")
    for n in ns:
        mf = np.geomspace(0.02, 50, 400001)
        fv = f_closed(mf, n)
        i = int(np.argmax(fv))
        lines.append(f"n={n:>3}  argmax m={mf[i]:.5f}  max f={fv[i]:.10f}  n^-0.5={n**-0.5:.5f}  "
                     f"f(n^-0.5)={f_closed(n**-0.5, n):.12f}  1.5-max={1.5-fv[i]:.2e}")
    lines.append("")
    lines.append("f(m,n) table (rows m, columns n=1,2,5,10,50)")
    for m in [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20]:
        lines.append(f"m={m:<5} " + "  ".join(f"{f_closed(m, n):.4f}" for n in ns))
    lines.append("")
    lines.append("curvature loss relative to 3/2 at equal thickness m=1: " +
                 ", ".join(f"n={n}: {100*(1-f_closed(1,n)/1.5):.1f}%" for n in ns))
    txt = "\n".join(lines)
    print(txt)
    open(_env.OUT + r"\s01_output.txt", "w").write(txt + "\n")
