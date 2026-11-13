"""Shared model for the bm-poc-designs study (units: mm, MPa, s unless a name says otherwise).

Everything here is either (a) the project's verified law, imported from the project's own check script
(read only, no bytecode written into the repo), or (b) my own beam / diffusion arithmetic, which is
cross-checked against (a) in run_all.py.

Law (project record, Lean-checked ceiling):  kappa = f(m,n) * d_eps / h,   f <= 3/2,  equality iff m^2 n = 1.
"""
import importlib.util
import math
import sys

import numpy as np

sys.dont_write_bytecode = True  # never leave __pycache__ in the read-only repo

CEILING_SCRIPT = r"D:/Users/ashenoy00000/.antigravity-ide/ScienceClaw/delphisci/tracks/scripts/check-timoshenko-ceiling.py"


def load_ceiling_module():
    spec = importlib.util.spec_from_file_location("check_timoshenko_ceiling", CEILING_SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_ceil = load_ceiling_module()


def f_tim(m, n):
    """Timoshenko coefficient, taken from the project's script (scalar floats)."""
    return _ceil.f_float(m, n)


def f_tim_np(m, n):
    """Same formula, vectorised (identical algebra to the project script)."""
    m = np.asarray(m, float)
    n = np.asarray(n, float)
    num = 6.0 * (1.0 + m) ** 2
    den = 3.0 * (1.0 + m) ** 2 + (1.0 + m * n) * (m * m + 1.0 / (m * n))
    return num / den


# ---------------------------------------------------------------------------------------------
# Layered beam (Euler-Bernoulli, plane stress, perfect bonding). Layers listed bottom to top.
# ---------------------------------------------------------------------------------------------
def section(layers):
    """layers: list of (t, E). Returns A, S, I (sums of E*t, E*int z, E*int z^2) and the z-offset of each layer."""
    z = 0.0
    A = S = I = 0.0
    z0s = []
    for t, E in layers:
        z0, z1 = z, z + t
        z0s.append(z0)
        A = A + E * t
        S = S + E * (z1 ** 2 - z0 ** 2) / 2.0
        I = I + E * (z1 ** 3 - z0 ** 3) / 3.0
        z = z1
    return A, S, I, z0s


def kappa_uniform(layers, eigen):
    """Equilibrium curvature (1/mm) for uniform eigenstrains per layer. Positive = the top (active) side is convex."""
    A, S, I, z0s = section(layers)
    N = M = 0.0
    for (t, E), e, z0 in zip(layers, eigen, z0s):
        N = N + E * e * t
        M = M + E * e * t * (z0 + t / 2.0)
    return (A * M - S * N) / (A * I - S * S)


def flexural_rigidity(layers):
    """D = EI of the composite per unit width, N*mm (E in MPa, lengths in mm)."""
    A, S, I, _ = section(layers)
    return (A * I - S * S) / A


# ---------------------------------------------------------------------------------------------
# Diffusion into the top (active) layer, exposed on its outer face only, sealed by the bonded layer.
# c(zeta, tau) = 1 - sum_k B_k cos(a_k zeta) exp(-a_k^2 tau),  zeta = distance from bonded face / h_a,
# tau = D t / h_a^2, a_k = (2k+1) pi/2, B_k = 4 (-1)^k / ((2k+1) pi).
# p(tau) = int c dzeta (uptake fraction), q(tau) = int zeta c dzeta (first moment).
# ---------------------------------------------------------------------------------------------
_K = 4000
_k = np.arange(_K)
_a = (2 * _k + 1) * math.pi / 2.0
_sgn = np.where(_k % 2 == 0, 1.0, -1.0)
_B = 4.0 * _sgn / ((2 * _k + 1) * math.pi)


def pq(tau):
    tau = np.atleast_1d(np.asarray(tau, float))
    ex = np.exp(-np.outer(tau, _a ** 2))
    p = 1.0 - (ex * (_B * _sgn / _a)).sum(axis=1)
    q = 0.5 - (ex * (_B * (_sgn / _a - 1.0 / _a ** 2))).sum(axis=1)
    return p, q


_PT = np.logspace(-7, 3, 2500)
_PP = None


def _build_pt():
    global _PP
    ex = np.exp(-np.outer(_PT, _a ** 2))
    _PP = 1.0 - (ex * (_B * _sgn / _a)).sum(axis=1)


_build_pt()


def kappa_time(t_act, E_act, t_pas, E_pas, d_eps, tau, t_bond=0.0, E_bond=None, eps_pas=0.0):
    """Curvature at dimensionless time tau = D t/h_a^2 for bottom passive layer, (optional bond), top active layer.
    d_eps is the active layer's final free linear strain; eps_pas the passive layer's (uniform) strain.
    All inputs may be numpy arrays of equal shape (samples); tau is a 1-D array. Returns array [samples, len(tau)]."""
    t_act, E_act, t_pas, E_pas, d_eps = [np.asarray(x, float) for x in (t_act, E_act, t_pas, E_pas, d_eps)]
    t_bond = np.asarray(t_bond, float)
    E_bond = E_pas if E_bond is None else np.asarray(E_bond, float)
    eps_pas = np.asarray(eps_pas, float)
    layers = [(t_pas, E_pas), (t_bond, E_bond), (t_act, E_act)]
    A, S, I, z0s = section(layers)
    z0a = z0s[2]
    p, q = pq(tau)
    col = lambda x: np.asarray(x)[..., None]
    # passive layer: strain eps_pas (final value), zero on the bond layer. The passive layer fills with the same D through
    # its own outer face, so its (mean) strain ramps with p(D t / t_pas^2) = p(tau (t_act/t_pas)^2); p is interpolated from a
    # fine table. Mean-strain approximation (the first moment of its profile is neglected).
    tau_arr = np.atleast_1d(np.asarray(tau, float))
    scale = (t_act / t_pas) ** 2
    x = np.clip(col(scale) * tau_arr, _PT[0], _PT[-1])
    ramp = np.interp(x.ravel(), _PT, _PP).reshape(x.shape)
    Np = col(E_pas * eps_pas * t_pas) * ramp
    Mp = col(E_pas * eps_pas * t_pas * (z0s[0] + t_pas / 2.0)) * ramp
    Na = col(E_act * d_eps * t_act) * p
    Ma = col(E_act * d_eps * t_act) * (col(z0a) * p + col(t_act) * q)
    N = Np + Na
    M = Mp + Ma
    return (col(A) * M - col(S) * N) / col(A * I - S * S)


def tau_to_fraction(layers_args, frac=0.9, n_tau=240):
    """Dimensionless time at which curvature reaches `frac` of its final value (log grid + interpolation)."""
    tau = np.logspace(-4, 1.2, n_tau)
    layers_args = [np.atleast_1d(np.asarray(x, float)) for x in layers_args]
    k = kappa_time(*layers_args, tau=tau)
    kf = k[..., -1:]
    ratio = k / kf
    out = np.empty(ratio.shape[0])
    for i in range(ratio.shape[0]):
        out[i] = np.interp(frac, ratio[i], tau)
    return out


# ---------------------------------------------------------------------------------------------
# Geometry of a cantilever strip with uniform curvature
# ---------------------------------------------------------------------------------------------
def tip(L, kappa):
    """(deflection normal to the original axis, horizontal advance, tip angle rad) of an arc of length L."""
    kappa = np.asarray(kappa, float)
    th = L * kappa
    safe = np.where(np.abs(kappa) < 1e-12, 1e-12, kappa)
    return (1.0 - np.cos(th)) / safe, np.sin(th) / safe, th


def self_weight_sag(L, h_total, D_flex, rho_net=1090.0):
    """Tip sag (mm) of a cantilever under its own (net) weight: q L^4 / (8 D). rho_net in kg/m^3."""
    g = 9.81
    q = rho_net * g * 1e-9 * h_total  # N/mm per mm width  (kg/m^3 * m/s^2 = N/m^3 = 1e-9 N/mm^3)
    return q * L ** 4 / (8.0 * D_flex)


def ln_ratio(x):
    return math.log(1.0 + x)
