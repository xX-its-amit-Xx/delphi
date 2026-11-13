"""Symbolic check (sympy): linear-elastic bilayer, isotropic eigenstrain eps in layer 1 only.
Case A (beam / strip): sigma_y free, sigma_x = 0 (narrow strip)  -> Timoshenko f(m,n)
Case B (wide plate, cylinder, x-curvature suppressed, e_x uniform, plane stress sigma_z=0)
Case C (equibiaxial sphere, both curvatures equal) -> biaxial modulus E/(1-nu)
Layers: bottom z in [-a2,0] (E2,nu2, no eigenstrain), top z in [0,a1] (E1,nu1, eigenstrain eps).
Run: python plate_vs_beam.py   (needs sympy)"""
import sympy as sp
a1,a2,E1,E2,nu1,nu2,eps,k,d,c=sp.symbols('a1 a2 E1 E2 nu1 nu2 eps kappa d c',positive=True)
z=sp.symbols('z')
def integ(expr_top,expr_bot,weight=1):
    return sp.integrate(expr_top*weight,(z,0,a1))+sp.integrate(expr_bot*weight,(z,-a2,0))
# ---- Case A: beam
sA_top=E1*(d+k*z-eps); sA_bot=E2*(d+k*z)
solA=sp.solve([integ(sA_top,sA_bot),integ(sA_top,sA_bot,z)],[d,k],dict=True)[0]
kA=sp.simplify(solA[k])
m,n,h=sp.symbols('m n h',positive=True)
# Timoshenko f
f=6*(1+m)**2/(3*(1+m)**2+(1+m*n)*(m**2+1/(m*n)))
kA_sub=sp.simplify(kA.subs({a1:m*a2,E1:n*E2}))
tim=sp.simplify((f*eps/(a1+a2)).subs({a1:m*a2,E1:n*E2}) if False else (f*eps/((m+1)*a2)))
print("A: beam curvature - Timoshenko print difference (should be 0):", sp.simplify(kA_sub-tim))
# ---- Case B: wide plate cylinder, equal nu in both layers (nu), e_x=c uniform, e_y=d+k z
nu=sp.symbols('nu',positive=True)
def stress(E,eps_l,nu_l):
    Ep=E/(1-nu_l**2)
    ex=c; ey=d+k*z
    sx=Ep*(ex+nu_l*ey-(1+nu_l)*eps_l)
    sy=Ep*(ey+nu_l*ex-(1+nu_l)*eps_l)
    return sx,sy
sxT,syT=stress(E1,eps,nu); sxB,syB=stress(E2,0,nu)
eqs=[integ(sxT,sxB),integ(syT,syB),integ(syT,syB,z)]
solB=sp.solve(eqs,[c,d,k],dict=True)[0]
kB=sp.simplify(solB[k])
print("B: cylinder / beam curvature ratio, equal nu (symbolic):", sp.simplify(kB/kA))
# numeric table of the ratio
for nuv in (0.3,0.35,0.4,0.5):
    for (aa,EE) in ((1,1),(1,10),(0.3,10)):
        r=(kB/kA).subs({nu:nuv,a1:aa,a2:1,E1:EE,E2:1})
        print(f"  nu={nuv} a1/a2={aa} E1/E2={EE}: kappa_cyl/kappa_beam={float(r):.4f}  (1+nu)={1+nuv}")
# ---- Case C: sphere, e_x=e_y=d+k z, equal curvature both directions, equal nu
sxT2=E1/(1-nu**2)*((d+k*z)*(1+nu)-(1+nu)*eps); 
sxB2=E2/(1-nu**2)*((d+k*z)*(1+nu))
solC=sp.solve([integ(sxT2,sxB2),integ(sxT2,sxB2,z)],[d,k],dict=True)[0]
print("C: sphere / beam curvature ratio, equal nu (symbolic):", sp.simplify(solC[k]/kA))
# ---- unequal nu in cylinder, example
nu1v,nu2v=0.35,0.49
sx1,sy1=stress(E1,eps,nu1); sx2,sy2=stress(E2,0,nu2)
sol=sp.solve([integ(sx1,sx2),integ(sy1,sy2),integ(sy1,sy2,z)],[c,d,k],dict=True)[0]
r=(sol[k]/kA).subs({a1:1,a2:1,E1:10,E2:1,nu1:nu1v,nu2:nu2v})
print("B': unequal nu (0.35 stiff top,0.49 soft bottom) a1/a2=1,E1/E2=10: kappa_cyl/kappa_beam=",float(r))
