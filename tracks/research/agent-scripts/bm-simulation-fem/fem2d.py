"""2-D finite-element model of a free two-layer strip with differential swelling.

Thermal-expansion analogy: layer 1 (bottom, y in [0,h1]) has isotropic free strain
d_eps (3-D isotropic swelling), layer 2 (top) has none. Free body, half model with a
symmetry plane at mid-length (x=0), 9-node quadrilaterals (scikit-fem ElementQuad2),
one layer-conforming mesh. Units: h = h1+h2 = 1, E2 = 1.

mode='plane_stress' : sigma_z = 0 (strip much narrower than its thickness is NOT this;
                      this is a thin sheet in the x-y plane, i.e. the beam-theory limit)
mode='plane_strain' : eps_z = 0 (strip much wider than its length; z is the width)
Curvature is read from a least-squares fit uy(x) = c0 + kappa*x^2/2 + c4*x^4 over the
central part of the strip (x from 0 to fit_frac*L/2); Saint-Venant end effects are
excluded. A second estimate comes from the top-minus-bottom axial displacement.
"""
import _env  # noqa: F401
import numpy as np
from scipy.sparse.linalg import splu
import skfem as fe
from skfem import MeshQuad, Basis, ElementQuad2, ElementVector, BilinearForm, LinearForm, asm, condense
from skfem.helpers import dot, ddot, sym_grad, eye, trace


def lame(E, nu, mode):
    mu = E / (2 * (1 + nu))
    lam3 = E * nu / ((1 + nu) * (1 - 2 * nu))
    if mode == 'plane_strain':
        return mu, lam3
    lam_ps = 2 * mu * lam3 / (lam3 + 2 * mu)  # = E nu/(1-nu^2)
    return mu, lam_ps


def f_closed(m, n):
    return 6 * (1 + m) ** 2 / (3 * (1 + m) ** 2 + (1 + m * n) * (m ** 2 + 1 / (m * n)))


def f_plane_strain_generalised(m, n, nu1, nu2):
    """Beam theory in plane strain (eps_z=0, sigma_y=0): sigma_x = E/(1-nu^2) [eps_x - (1+nu) eps*].
    Same Timoshenko algebra with E' = E/(1-nu^2), d_eps' = (1+nu1)*d_eps (layer 2 has no swelling)."""
    n_eff = n * (1 - nu2 ** 2) / (1 - nu1 ** 2)
    return (1 + nu1) * f_closed(m, n_eff)


def build_mesh(m, L, nx_per_h, ny1, ny2, grade=1.0):
    h = 1.0
    h2 = h / (1 + m)
    h1 = m * h2
    nx = max(4, int(round(L / 2 * nx_per_h)))
    # x nodes: finer near the free end x = L/2 (geometric grading toward the end)
    s = np.linspace(0, 1, nx + 1)
    x = (L / 2) * (s if grade == 1.0 else (1 - (1 - s) ** grade))
    y = np.concatenate([np.linspace(0, h1, ny1 + 1), np.linspace(h1, h, ny2 + 1)[1:]])
    mesh = MeshQuad.init_tensor(x, y)
    return mesh, h1, h2


def solve(m, n, mode='plane_stress', L=40.0, nu1=0.3, nu2=0.3, nx_per_h=2, ny1=4, ny2=4,
          d_eps=1e-3, fit_frac=0.5, grade=1.0):
    mesh, h1, h2 = build_mesh(m, L, nx_per_h, ny1, ny2, grade)
    basis = Basis(mesh, ElementVector(ElementQuad2()), intorder=4)
    # per-element material
    ycen = mesh.p[1][mesh.t].mean(axis=0)
    is1 = ycen < h1
    E_el = np.where(is1, n, 1.0)
    nu_el = np.where(is1, nu1, nu2)
    eps_el = np.where(is1, d_eps, 0.0)
    mu = np.zeros(len(E_el)); lam = np.zeros(len(E_el))
    for i in (True, False):
        sel = is1 == i
        mu_i, lam_i = lame(n if i else 1.0, nu1 if i else nu2, mode)
        mu[sel] = mu_i; lam[sel] = lam_i
    nq = basis.X.shape[1]
    def tile(a): return np.repeat(a[:, None], nq, axis=1)
    MU, LAM, EPS = tile(mu), tile(lam), tile(eps_el)

    # eigenstrain tensor: swelling eps* in all 3 directions. Stress = 2 mu e + lam tr e I - K* eps*,
    # where for plane strain K* eps* = (2 mu + 3 lam) eps* I (3-D bulk response, eps_z total = 0)
    # and for plane stress K* eps* = (2 mu + 2 lam) eps* I (in-plane eigenstrain only, sigma_z = 0).
    if mode == 'plane_strain':
        kfac = 2 * mu + 3 * lam
    else:
        kfac = 2 * mu + 2 * lam
    KF = tile(kfac)

    @BilinearForm
    def stiff(u, v, w):
        e, f = sym_grad(u), sym_grad(v)
        return 2 * w['mu'] * ddot(e, f) + w['lam'] * trace(e) * trace(f)

    @LinearForm
    def load(v, w):
        return w['kf'] * w['eps'] * trace(sym_grad(v))

    K = asm(stiff, basis, mu=MU, lam=LAM)
    F = asm(load, basis, kf=KF, eps=EPS)

    # boundary conditions: ux = 0 on x = 0 (mid-length symmetry), uy = 0 at node (0,0)
    dofs_x0 = basis.get_dofs(lambda x: np.isclose(x[0], 0.0), skip=['u^2'])
    D = dofs_x0.all()
    pin = basis.get_dofs(lambda x: np.isclose(x[0], 0.0) & np.isclose(x[1], 0.0), skip=['u^1']).all()
    D = np.unique(np.concatenate([D, pin]))
    uu = fe.solve(*condense(K, F, D=D))  # returns the full displacement vector

    # post-process: nodal displacement on y=0 (bottom) and y=h (top) lines
    X = basis.doflocs
    ux = uu[basis.nodal_dofs[0]]; uy = uu[basis.nodal_dofs[1]]
    px, py = mesh.p
    h = 1.0
    xmax = fit_frac * L / 2
    res = {}
    for name, ycoord in (('bottom', 0.0), ('top', h)):
        sel = np.isclose(py, ycoord) & (px <= xmax + 1e-12)
        order = np.argsort(px[sel])
        xs, ys = px[sel][order], uy[sel][order]
        A = np.vstack([np.ones_like(xs), xs ** 2 / 2, xs ** 4]).T
        c = np.linalg.lstsq(A, ys, rcond=None)[0]
        res['kappa_uy_' + name] = c[1]
        A2 = np.vstack([np.ones_like(xs), xs ** 2 / 2]).T
        res['kappa_uy2_' + name] = np.linalg.lstsq(A2, ys, rcond=None)[0][1]
    selt = np.isclose(py, h) & (px <= xmax + 1e-12)
    selb = np.isclose(py, 0.0) & (px <= xmax + 1e-12)
    ot, ob = np.argsort(px[selt]), np.argsort(px[selb])
    xs = px[selt][ot]
    diff = ux[selt][ot] - ux[selb][ob]
    # ux_top - ux_bot = -h * kappa * x for plane sections
    res['kappa_ux'] = -np.linalg.lstsq(xs[:, None], diff / h, rcond=None)[0][0]
    res['kappa'] = 0.5 * (res['kappa_uy_bottom'] + res['kappa_uy_top'])
    res['ndof'] = K.shape[0]
    res['h1'] = h1
    return res


if __name__ == "__main__":
    import sys
    r = solve(1.0, 1.0)
    print(r, 'f=', f_closed(1, 1), 'FEM kappa/d_eps=', r['kappa'] / 1e-3)
