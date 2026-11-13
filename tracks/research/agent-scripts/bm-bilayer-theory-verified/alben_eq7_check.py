"""Minimise the cylindrical-bending energy density printed as eq.(7) of Alben, arXiv:1110.1007 (S. Alben, 'Bending of bilayers with general initial shapes'):
 eT = (sqrt3/8) Cs [3ex^2+3ey^2+2 ex ey + 3(ex-ea)^2 + 3(ey+h k-ea)^2 + 2(ex-ea)(ey+h k-ea)] + (sqrt3/2) Cb k^2
and compare with the paper's printed eq.(8): ex=ea/2, ey=0, k=ea/h.   Needs sympy."""
import sympy as sp
ex,ey,k,ea,h,Cs,Cb=sp.symbols('ex ey k ea h Cs Cb',positive=True)
e=(sp.sqrt(3)/8)*Cs*(3*ex**2+3*ey**2+2*ex*ey+3*(ex-ea)**2+3*(ey+h*k-ea)**2+2*(ex-ea)*(ey+h*k-ea))+sp.sqrt(3)/2*Cb*k**2
sol=sp.solve([sp.diff(e,v) for v in (ex,ey,k)],[ex,ey,k],dict=True)[0]
print({str(a):sp.simplify(b) for a,b in sol.items()})
# stretching-dominated limit Cb->0
lim={str(a):sp.simplify(sp.limit(b,Cb,0)) for a,b in sol.items()}
print('Cb->0:',lim)
vals={Cs:8e4,Cb:1,h:0.01,ea:0.1}
print('numbers for paper parameters (Cs=8e4,Cb=1,h=0.01,ea=0.1): ex,ey,kappa =',[float(sol[a].subs(vals)) for a in (ex,ey,k)])
# cross-check against (1+nu) x Timoshenko beam for equal layers (m=n=1, total thickness 2h, f=3/2) with nu=1/3 (the Poisson ratio Alben states for his lattice)
nu=sp.Rational(1,3)
kT=(1+nu)*sp.Rational(3,2)*ea/(2*h)
print('(1+nu)*Timoshenko beam, m=n=1, nu=1/3:', sp.simplify(kT), '  vs paper eq.(8) k = ea/h  -> equal:', sp.simplify(kT-ea/h)==0)
print('Alben general k at his parameters equals ea/h only because Cs*h^2 = 8*Cb (his lattice constants); thin-membrane limit Cb->0 gives (4/3) ea/h')
