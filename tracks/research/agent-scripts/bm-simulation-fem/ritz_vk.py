"""Geometrically nonlinear (von Karman) Rayleigh-Ritz model of a free rectangular two-layer plate
with differential swelling: finds the equilibrium (stationary) shapes and tells when a wide strip
leaves the spherical (two-way curved) shape and becomes a cylinder.

Plate [-a,a] x [-b,b] (a = L/2, b = w/2), h = 1 total thickness, layer 2 modulus E2 = 1.
Bottom layer 1 (thickness h1 = m h2, modulus n) has free in-plane strain d_eps.
Classical laminate theory (A, B, D) + von Karman membrane strains,
 eps0 = (u_x + w_x^2/2, v_y + w_y^2/2, u_y + v_x + w_x w_y), kappa = (-w_xx, -w_yy, -2 w_xy).
Energy density: 1/2 [eps0;k]^T S [eps0;k] - [N_T;M_T].[eps0;k], S=[[A,B],[B,D]].
Trial fields (even symmetry), xi = x/a, eta = y/b:
 w = sum over even monomials xi^(2i) eta^(2j), 1 <= i+j <= Pw (default 2), scaled so c1 = w_xx(0), c2 = w_yy(0)
 u = a xi * sum_{i+j<=Pu} p_ij xi^(2i) eta^(2j) ;  v = b eta * sum q_ij xi^(2i) eta^(2j)
Stationary points are found by Newton / trust-region (scipy trust-exact) with exact gradient
and Hessian. This is an approximation (polynomial trial space); accuracy is checked against the
linear 3-D FEM in s05.
"""
import _env  # noqa: F401
import numpy as np
from numpy.polynomial.legendre import leggauss
from scipy.optimize import minimize


def laminate(m, n, nu1, nu2, e1, e2=0.0):
    h2 = 1.0 / (1 + m); h1 = m * h2
    z = [-0.5, -0.5 + h1, 0.5]
    Es = [float(n), 1.0]; nus = [nu1, nu2]; eps = [e1, e2]
    A = np.zeros((3, 3)); B = np.zeros((3, 3)); D = np.zeros((3, 3)); NT = np.zeros(3); MT = np.zeros(3)
    for i in range(2):
        E, nu = Es[i], nus[i]
        Q = E / (1 - nu ** 2) * np.array([[1, nu, 0], [nu, 1, 0], [0, 0, (1 - nu) / 2]])
        z0, z1 = z[i], z[i + 1]
        A += Q * (z1 - z0); B += Q * (z1 ** 2 - z0 ** 2) / 2; D += Q * (z1 ** 3 - z0 ** 3) / 3
        et = np.array([eps[i], eps[i], 0.0])
        NT += Q @ et * (z1 - z0); MT += Q @ et * (z1 ** 2 - z0 ** 2) / 2
    S = np.block([[A, B], [B, D]])
    return S, np.concatenate([NT, MT])


class Ritz:
    def __init__(self, m, n, nu1, nu2, d_eps, a, b, Pu=2, Pw=2, ng=14):
        self.S, self.T = laminate(m, n, nu1, nu2, d_eps)
        self.a, self.b = a, b
        xg, wg = leggauss(ng)
        XI, ETA = np.meshgrid(xg, xg, indexing='ij')
        WT = np.outer(wg, wg) * a * b  # area element (x,y) = a b dxi deta
        self.xi, self.eta, self.wt = XI.ravel(), ETA.ravel(), WT.ravel()
        xi, eta = self.xi, self.eta
        # basis lists: each entry gives value function and derivatives in (x, y)
        # w terms
        def mono(px, py, cx, cy):
            # d^i/dx^i d^j/dy^j of xi^px eta^py with scale cx*cy; returns dict of derivatives wrt x,y
            return None
        # w basis: (coef, px, py) of  coef * xi^px * eta^py * length scale
        wb = []
        for tot in range(1, Pw + 1):
            for i in range(tot, -1, -1):
                j = tot - i
                wb.append((0.5 * a ** (2.0 * i / tot) * b ** (2.0 * j / tot), 2 * i, 2 * j))
        # order check: the first two entries must be xi^2 and eta^2 (curvatures c1, c2)
        assert wb[0][1:] == (2, 0) and wb[1][1:] == (0, 2)
        ub, vb = [], []
        for i in range(Pu + 1):
            for j in range(Pu + 1 - i):
                ub.append((a, 1 + 2 * i, 2 * j))   # a*xi * xi^(2i) eta^(2j)
                vb.append((b, 2 * i, 1 + 2 * j))   # b*eta * xi^(2i) eta^(2j)
        self.nw, self.nu, self.nv = len(wb), len(ub), len(vb)
        N = self.nw + self.nu + self.nv
        self.N = N
        G = len(xi)
        def d(coef, px, py, dx, dy):
            # derivative of coef*xi^px*eta^py wrt x (dx times), y (dy times); x = a xi, y = b eta
            c = coef
            ppx, ppy = px, py
            for _ in range(dx):
                c = c * ppx / a if ppx > 0 else 0.0
                ppx -= 1
            for _ in range(dy):
                c = c * ppy / b if ppy > 0 else 0.0
                ppy -= 1
            if c == 0.0 or ppx < 0 or ppy < 0:
                return np.zeros(G)
            return c * xi ** ppx * eta ** ppy
        Wx = np.zeros((G, N)); Wy = np.zeros((G, N)); Wxx = np.zeros((G, N)); Wyy = np.zeros((G, N)); Wxy = np.zeros((G, N))
        Ux = np.zeros((G, N)); Uy = np.zeros((G, N)); Vx = np.zeros((G, N)); Vy = np.zeros((G, N))
        for k, (c, px, py) in enumerate(wb):
            Wx[:, k] = d(c, px, py, 1, 0); Wy[:, k] = d(c, px, py, 0, 1)
            Wxx[:, k] = d(c, px, py, 2, 0); Wyy[:, k] = d(c, px, py, 0, 2); Wxy[:, k] = d(c, px, py, 1, 1)
        for k, (c, px, py) in enumerate(ub):
            Ux[:, self.nw + k] = d(c, px, py, 1, 0); Uy[:, self.nw + k] = d(c, px, py, 0, 1)
        for k, (c, px, py) in enumerate(vb):
            Vx[:, self.nw + self.nu + k] = d(c, px, py, 1, 0); Vy[:, self.nw + self.nu + k] = d(c, px, py, 0, 1)
        self.Wx, self.Wy = Wx, Wy
        # linear part of r = [exx, eyy, gxy, kxx, kyy, kxy]
        self.R0 = np.stack([Ux, Vy, Uy + Vx, -Wxx, -Wyy, -2 * Wxy], axis=1)  # (G, 6, N)

    def r_and_J(self, q):
        wx = self.Wx @ q; wy = self.Wy @ q
        r = self.R0 @ q if False else np.einsum('gkn,n->gk', self.R0, q)
        r[:, 0] += 0.5 * wx ** 2; r[:, 1] += 0.5 * wy ** 2; r[:, 2] += wx * wy
        J = self.R0.copy()
        J[:, 0, :] += wx[:, None] * self.Wx
        J[:, 1, :] += wy[:, None] * self.Wy
        J[:, 2, :] += wx[:, None] * self.Wy + wy[:, None] * self.Wx
        return r, J

    def energy(self, q):
        r, J = self.r_and_J(q)
        return float(np.sum(self.wt * (0.5 * np.einsum('gi,ij,gj->g', r, self.S, r) - r @ self.T)))

    def grad(self, q):
        r, J = self.r_and_J(q)
        sig = r @ self.S - self.T  # (G,6)
        return np.einsum('g,gk,gkn->n', self.wt, sig, J)

    def hess(self, q):
        r, J = self.r_and_J(q)
        sig = r @ self.S - self.T
        H = np.einsum('g,gkn,kl,glm->nm', self.wt, J, self.S, J)
        H += np.einsum('g,g,gn,gm->nm', self.wt, sig[:, 0], self.Wx, self.Wx)
        H += np.einsum('g,g,gn,gm->nm', self.wt, sig[:, 1], self.Wy, self.Wy)
        H += np.einsum('g,g,gn,gm->nm', self.wt, sig[:, 2], self.Wx, self.Wy) \
            + np.einsum('g,g,gn,gm->nm', self.wt, sig[:, 2], self.Wy, self.Wx)
        return 0.5 * (H + H.T)

    def solve(self, c1, c2, d_eps, maxiter=400):
        q0 = np.zeros(self.N); q0[0] = c1; q0[1] = c2
        # the curvature enters with sign: w_xx = c1 means kappa_xx = -c1; bottom layer expands -> w concave up
        res = minimize(self.energy, q0, jac=self.grad, hess=self.hess, method='trust-exact',
                       options=dict(gtol=1e-13 * max(1.0, abs(d_eps)), maxiter=maxiter))
        q = res.x
        H = self.hess(q)
        lam_min = np.linalg.eigvalsh(H)[0]
        return dict(q=q, E=res.fun, c1=q[0], c2=q[1], gnorm=np.linalg.norm(self.grad(q)), lam_min=lam_min,
                    success=bool(res.success))


def f_closed(m, n):
    return 6 * (1 + m) ** 2 / (3 * (1 + m) ** 2 + (1 + m * n) * (m ** 2 + 1 / (m * n)))


def clt_free_curvature(m, n, nu1, nu2, d_eps):
    """Linear classical laminate theory, free plate: curvature = (D - B A^-1 B)^-1 (M_T - B A^-1 N_T)."""
    S, T = laminate(m, n, nu1, nu2, d_eps)
    A, B, D = S[:3, :3], S[:3, 3:], S[3:, 3:]
    NT, MT = T[:3], T[3:]
    Ai = np.linalg.inv(A)
    k = np.linalg.solve(D - B @ Ai @ B, MT - B @ Ai @ NT)
    return k  # [kxx, kyy, kxy] with kxx = -w_xx
