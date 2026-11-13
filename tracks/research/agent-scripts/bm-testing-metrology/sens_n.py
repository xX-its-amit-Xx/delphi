"""How well must the modulus ratio n be measured?  Uses the project-record Timoshenko coefficient
f(m,n) = 6(1+m)^2 / [3(1+m)^2 + (1+m n)(m^2 + 1/(m n))], ceiling 3/2 at m = n^(-1/2).
If the designer picks the thickness ratio m from an estimated n_est but the true ratio is n_true, how much curvature is lost?
Run: python sens_n.py   (prints a table, writes sens_n_out.json)
"""
import json, math


def f(m, n):
    return 6 * (1 + m) ** 2 / (3 * (1 + m) ** 2 + (1 + m * n) * (m ** 2 + 1 / (m * n)))


rows = []
for n_true in (2, 10, 50):
    for factor in (0.5, 0.7, 0.8, 1.0, 1.25, 1.5, 2.0):
        n_est = n_true * factor
        m_used = n_est ** -0.5
        rows.append(dict(n_true=n_true, n_est_over_true=factor, m_used=round(m_used, 4),
                         f_achieved=round(f(m_used, n_true), 4), f_ceiling=1.5,
                         loss_pct=round((1 - f(m_used, n_true) / 1.5) * 100, 2)))
for r in rows:
    print(r)
# check ceiling
assert abs(f(10 ** -0.5, 10) - 1.5) < 1e-12
# also: error in thickness h enters kappa = f * d_eps / h directly (1:1), error in d_eps 1:1
json.dump(rows, open('sens_n_out.json', 'w'), indent=1)
