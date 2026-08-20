#!/usr/bin/env python3
"""Independent reference: heliocentric ecliptic longitudes via JPL/Standish
approximate mean elements (1800-2050 table). Used to embed cross-check
expectations in the astronomy-engine test file. Accuracy ~0.1-0.3deg for
most planets (Jupiter/Saturn worst at ~0.2deg) -- tolerance in tests is 1.0deg."""
import math
from datetime import datetime, timezone

# a(AU), e, I(deg), L(deg), varpi(deg), Omega(deg)  + rates per Julian century
EL = {
 "mercury": ((0.38709927,0.20563593,7.00497902,252.25032350,77.45779628,48.33076593),
             (0.00000037,0.00001906,-0.00594749,149472.67411175,0.16047689,-0.12534081)),
 "venus":   ((0.72333566,0.00677672,3.39467605,181.97909950,131.60246718,76.67984255),
             (0.00000390,-0.00004107,-0.00078890,58517.81538729,0.00268329,-0.27769418)),
 "earth":   ((1.00000261,0.01671123,-0.00001531,100.46457166,102.93768193,0.0),
             (0.00000562,-0.00004392,-0.01294668,35999.37244981,0.32327364,0.0)),
 "mars":    ((1.52371034,0.09339410,1.84969142,-4.55343205,-23.94362959,49.55953891),
             (0.00001847,0.00007882,-0.00813131,19140.30268499,0.44441088,-0.29257343)),
 "jupiter": ((5.20288700,0.04838624,1.30439695,34.39644051,14.72847983,100.47390909),
             (-0.00011607,-0.00013253,-0.00183714,3034.74612775,0.21252668,0.20469106)),
 "saturn":  ((9.53667594,0.05386179,2.48599187,49.95424423,92.59887831,113.66242448),
             (-0.00125060,-0.00050991,0.00193609,1222.49362201,-0.41897216,-0.28867794)),
 "uranus":  ((19.18916464,0.04725744,0.77263783,313.23810451,170.95427630,74.01692503),
             (-0.00196176,-0.00004397,-0.00242939,428.48202785,0.40805281,0.04240589)),
 "neptune": ((30.06992276,0.00859048,1.77004347,-55.12002969,44.96476227,131.78422574),
             (0.00026291,0.00005105,0.00035372,218.45945325,-0.32241464,-0.00508664)),
 "pluto":   ((39.48211675,0.24882730,17.14001206,238.92903833,224.06891629,110.30393684),
             (-0.00031596,0.00005170,0.00004818,145.20780515,-0.04062942,-0.01183482)),
}

def jd_utc(dt):
    # dt must be timezone-aware UTC
    y, m = dt.year, dt.month
    d = dt.day + (dt.hour + dt.minute/60 + dt.second/3600)/24
    if m <= 2: y -= 1; m += 12
    A = y//100; B = 2 - A + A//4
    return int(365.25*(y+4716)) + int(30.6001*(m+1)) + d + B - 1524.5

def kepler(M, e):
    # M in radians -> eccentric anomaly E (radians)
    E = M + e*math.sin(M)
    for _ in range(12):
        dE = (E - e*math.sin(E) - M) / (1 - e*math.cos(E))
        E -= dE
        if abs(dE) < 1e-12: break
    return E

def helio(planet, T):
    (a0,e0,I0,L0,w0,O0),(ar,er,Ir,Lr,wr,Or) = EL[planet]
    a = a0 + ar*T; e = e0 + er*T
    I = math.radians(I0 + Ir*T)
    L = L0 + Lr*T
    varpi = w0 + wr*T
    Om = math.radians(O0 + Or*T)
    w = math.radians(varpi) - Om                 # argument of perihelion
    M = math.radians((L - varpi) % 360.0)
    E = kepler(M, e)
    xp = a*(math.cos(E) - e)                     # in orbital plane
    yp = a*math.sqrt(1-e*e)*math.sin(E)
    r  = math.hypot(xp, yp)
    nu = math.atan2(yp, xp)                      # true anomaly
    u  = w + nu                                  # argument of latitude
    x = r*(math.cos(Om)*math.cos(u) - math.sin(Om)*math.sin(u)*math.cos(I))
    y = r*(math.sin(Om)*math.cos(u) + math.cos(Om)*math.sin(u)*math.cos(I))
    z = r*math.sin(u)*math.sin(I)
    elon = math.degrees(math.atan2(y, x)) % 360.0
    return elon, r

if __name__ == "__main__":
    D = datetime(2026, 8, 19, 0, 0, 0, tzinfo=timezone.utc)
    T = (jd_utc(D) - 2451545.0) / 36525.0
    print(f"date  : {D.isoformat()}   JD {jd_utc(D):.2f}   T {T:.8f}\n")
    print(f"{'planet':9} {'helio elon':>10} {'r (AU)':>8}")
    rows = {}
    for p in EL:
        elon, r = helio(p, T)
        rows[p] = (elon, r)
        print(f"{p:9} {elon:9.3f}\u00b0 {r:8.4f}")
    # Emit a TS-ready expectations block
    print("\n// --- paste into tests (expected @ 2026-08-19T00:00:00Z, Standish 1800-2050) ---")
    print("const EXPECT: Record<string, { elon: number; rAU: number }> = {")
    for p,(elon,r) in rows.items():
        print(f"  {p}: {{ elon: {elon:.3f}, rAU: {r:.4f} }},")
    print("};")
