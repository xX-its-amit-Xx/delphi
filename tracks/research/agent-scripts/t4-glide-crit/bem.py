"""Python 3 port of the blade-element model in
github.com/jerabaul29/EffectFoldAngleAutorotatingSeeds (MIT), files
generate_seed_profile.py, compute_force_on_seed.py, lift_drag_coefficients.py,
figure_2D_maps.py. Geometry and force code follow the original line by line.
The equilibrium solver is NOT the original (which intersects matplotlib contour
lines on a 25x25 grid); here M(St)=0 is solved by bracketing + brentq and U then
follows in closed form because every force scales as U^2 at fixed St.
"""
import numpy as np
from scipy.optimize import brentq

L = 0.06
NU = 1.0e-6
G = 9.81
RHO = 1000.0


def CL(a_deg):
    return 0.225 + 1.58 * np.sin(np.radians(2.13 * a_deg - 7.2))


def CD(a_deg, reg=2.0):
    return (1.92 - 1.55 * np.cos(np.radians(2.04 * a_deg - 9.82))) / reg


def wing(psi_deg, KL, length_linear=0.015, total_length=0.075, n=100, radial_offset=0.0025):
    rc = L / KL
    psi = np.radians(psi_deg)
    R, H, PHI, DL = [], [], [], []
    step = float(length_linear) / n
    for s in np.arange(step, length_linear + step, step):
        sm = s - step / 2.0
        R.append(sm * np.sin(psi) + radial_offset)
        H.append(sm * np.cos(psi))
        PHI.append(90.0 - psi_deg)
        DL.append(step)
    Rend, Hend = R[-1], H[-1]
    lc = total_length - length_linear
    step = float(lc) / n
    th2 = -np.pi + psi
    rot = np.array([[np.cos(th2), np.sin(th2)], [-np.sin(th2), np.cos(th2)]])
    for s in np.arange(length_linear + step, total_length + step, step):
        sm = s - step / 2.0
        ang = float(sm - length_linear) / rc
        PHI.append(90.0 - psi_deg - np.degrees(ang))
        v = np.array([rc * (1 - np.cos(ang)), rc * np.sin(ang)])
        add = rot.dot(v)
        R.append(Rend - add[0])
        H.append(Hend - add[1])
        DL.append(step)
    return np.array(R), np.array(H), np.array(PHI), np.array(DL)


def forces(U, f, geom, pitch=15.0, camber=2.5, chord=0.015, reg=2.0):
    R, H, PHI, DL = geom
    om = 2 * np.pi * f
    ut = om * R
    un = U * np.cos(np.radians(PHI))
    beta = np.arctan2(un, ut)
    aoa = np.degrees(beta) - pitch
    q = 0.5 * RHO * (ut ** 2 + un ** 2) * chord * DL
    lift = q * CL(aoa + camber)
    drag = q * CD(aoa + camber, reg)
    fwd = np.sin(beta) * lift - np.cos(beta) * drag
    vert = (np.cos(beta) * lift + np.sin(beta) * drag) * np.cos(np.radians(PHI))
    return 2.0 * np.sum(fwd * R), 2.0 * np.sum(vert), aoa


def equilibria(psi_deg, KL, m_net=0.0012, st_lo=0.02, st_hi=1.6, nscan=400, **kw):
    """Return list of (Re, St, stable) for all roots of M(St)=0 with positive lift."""
    geom = wing(psi_deg, KL)
    U0 = 0.1

    def M(st):
        return forces(U0, st * U0 / L, geom, **kw)[0]

    sts = np.linspace(st_lo, st_hi, nscan)
    ms = np.array([M(s) for s in sts])
    out = []
    for i in range(len(sts) - 1):
        if ms[i] == 0 or ms[i] * ms[i + 1] < 0:
            st = brentq(M, sts[i], sts[i + 1])
            F0 = forces(U0, st * U0 / L, geom, **kw)[1]
            if F0 <= 0:
                continue
            U = U0 * np.sqrt(m_net * G / F0)
            stable = ms[i] > 0 > ms[i + 1]  # M>0 spins up below root, M<0 slows above
            out.append((U * L / NU, st, bool(stable)))
    return out


def eq(psi_deg, KL, **kw):
    e = [x for x in equilibria(psi_deg, KL, **kw) if x[2]]
    if not e:
        return (np.nan, np.nan)
    e.sort(key=lambda x: x[0])
    return e[0][0], e[0][1]
