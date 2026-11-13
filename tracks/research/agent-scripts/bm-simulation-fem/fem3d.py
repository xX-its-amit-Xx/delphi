"""3-D linear-elastic finite-element model of a finite-width free two-layer strip.

Axes: x = length, y = thickness (layer 1 swells, y in [0,h1]; layer 2 on top, y in [h1,1]),
z = width. Isotropic 3-D free strain d_eps in layer 1 (thermal analogy), 27-node
triquadratic hexahedra (scikit-fem ElementHex2). Quarter model with symmetry planes
x=0 (ux=0) and z=0 (uz=0); one extra pin (uy at the origin) removes the rigid translation.
Linear kinematics: this is the small-deflection regime (no geometric nonlinearity).
Reports kappa_x (along the length) and kappa_z (across the width, centre line of the
mid-length section; negative = anticlastic, i.e. opposite sign to kappa_x).
"""
import _env  # noqa: F401
import numpy as np
import skfem as fe
from skfem import MeshHex, Basis, ElementHex2, ElementVector, BilinearForm, LinearForm, asm, condense
from skfem.helpers import ddot, sym_grad, trace


def graded_half_width(wh, edge=0.25, growth=1.5, cap=2.0):
    """z nodes from 0 (symmetry plane) to wh (free edge) with fine spacing at the edge."""
    steps = []
    s = edge
    total = 0.0
    while total < wh - 1e-12:
        s_use = min(s, wh - total)
        steps.append(s_use); total += s_use
        s = min(s * growth, cap)
    steps = steps[::-1]  # coarse at centre, fine at edge
    # merge a tiny first step
    if len(steps) > 1 and steps[0] < 0.3 * steps[1]:
        steps[1] += steps[0]; steps = steps[1:]
    return np.concatenate([[0.0], np.cumsum(steps)])


def solve3d(m, n, w_over_h, L=20.0, nu1=0.3, nu2=0.3, d_eps=1e-3, nx_per_h=1, ny1=2, ny2=2):
    h2 = 1.0 / (1 + m); h1 = m * h2
    nx = max(4, int(round(L / 2 * nx_per_h)))
    x = np.linspace(0, L / 2, nx + 1)
    y = np.concatenate([np.linspace(0, h1, ny1 + 1), np.linspace(h1, 1.0, ny2 + 1)[1:]])
    z = graded_half_width(w_over_h / 2)
    mesh = MeshHex.init_tensor(x, y, z)
    basis = Basis(mesh, ElementVector(ElementHex2()), intorder=4)
    ycen = mesh.p[1][mesh.t].mean(axis=0)
    is1 = ycen < h1
    E_el = np.where(is1, float(n), 1.0)
    nu_el = np.where(is1, nu1, nu2)
    mu = E_el / (2 * (1 + nu_el))
    lam = E_el * nu_el / ((1 + nu_el) * (1 - 2 * nu_el))
    eps = np.where(is1, d_eps, 0.0)
    nq = basis.X.shape[1]
    def tile(a): return np.repeat(a[:, None], nq, axis=1)

    @BilinearForm
    def stiff(u, v, w):
        e, f = sym_grad(u), sym_grad(v)
        return 2 * w['mu'] * ddot(e, f) + w['lam'] * trace(e) * trace(f)

    @LinearForm
    def load(v, w):
        return w['kf'] * w['eps'] * trace(sym_grad(v))

    K = asm(stiff, basis, mu=tile(mu), lam=tile(lam))
    F = asm(load, basis, kf=tile(2 * mu + 3 * lam), eps=tile(eps))
    D1 = basis.get_dofs(lambda p: np.isclose(p[0], 0.0), skip=['u^2', 'u^3']).all()
    D3 = basis.get_dofs(lambda p: np.isclose(p[2], 0.0), skip=['u^1', 'u^2']).all()
    Dp = basis.get_dofs(lambda p: np.isclose(p[0], 0.0) & np.isclose(p[1], 0.0) & np.isclose(p[2], 0.0),
                        skip=['u^1', 'u^3']).all()
    D = np.unique(np.concatenate([D1, D3, Dp]))
    uu = fe.solve(*condense(K, F, D=D))
    uy = uu[basis.nodal_dofs[1]]
    px, py, pz = mesh.p
    res = {'ndof': K.shape[0], 'nelem': mesh.t.shape[1]}
    # kappa_x along z=0
    kx = []
    for yc in (0.0, 1.0):
        sel = np.isclose(py, yc) & np.isclose(pz, 0.0) & (px <= 0.5 * L / 2 + 1e-12)
        o = np.argsort(px[sel]); xs, ys = px[sel][o], uy[sel][o]
        A = np.vstack([np.ones_like(xs), xs ** 2 / 2, xs ** 4]).T
        kx.append(np.linalg.lstsq(A, ys, rcond=None)[0][1])
    res['kappa_x'] = 0.5 * sum(kx)
    # kappa_z at x = 0 over |z| <= 0.6 * w/2 (quadratic + quartic fit)
    kz = []
    zmax = 0.6 * w_over_h / 2 if w_over_h > 2 else w_over_h / 2  # narrow strips: use the whole half-width
    for yc in (0.0, 1.0):
        sel = np.isclose(py, yc) & np.isclose(px, 0.0) & (pz <= zmax + 1e-12)
        o = np.argsort(pz[sel]); zs, ys = pz[sel][o], uy[sel][o]
        if len(zs) >= 5:
            A = np.vstack([np.ones_like(zs), zs ** 2 / 2, zs ** 4]).T
        else:
            A = np.vstack([np.ones_like(zs), zs ** 2 / 2]).T
        kz.append(np.linalg.lstsq(A, ys, rcond=None)[0][1])
    res['kappa_z'] = 0.5 * sum(kz)
    return res


if __name__ == "__main__":
    import time
    t = time.time()
    r = solve3d(1.0, 1.0, 4.0)
    print(r, 'kx/deps=', r['kappa_x'] / 1e-3, 'kz/kx=', r['kappa_z'] / r['kappa_x'], round(time.time() - t, 1), 's')
