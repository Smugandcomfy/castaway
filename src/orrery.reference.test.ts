// Cast Away — orrery reference tests. REQUIRES astronomy-engine installed.
// Runs under `bun test src/`, same runner as tarot.test.ts.
//
// Cross-validation strategy: the EXPECT table below was computed by an
// INDEPENDENT method — JPL/Standish approximate mean elements (1800–2050
// table), Kepler-solved in Python (docs/ref_standish.py, kept alongside this
// suite). astronomy-engine uses truncated VSOP87 + a custom Pluto model.
// Two unrelated formulations agreeing to <1° means neither is wired wrong:
// frames match, angle conventions match, no radians/degrees slips, no
// equatorial/ecliptic confusion. This is the same spirit as the King Wen
// bijection check and the kamea magic-square verification.

import { describe, expect, test } from "bun:test";
import { SunPosition } from "astronomy-engine";
import { PLANETS, allPlanetStates, planetState, orbitPathAU } from "./orrery_core";
import { angSep, norm360 } from "./project";

const D = new Date("2026-08-19T00:00:00Z");

// Standish 1800–2050 elements @ D (see docs/ref_standish.py). Stated accuracy
// for this table is a few hundred arcsec at worst (Jupiter/Saturn); 1.0° is a
// generous envelope that still catches any real wiring mistake, which would
// show up as tens of degrees. Pluto gets extra slack: roughest fit, and the
// two Pluto models differ most.
const EXPECT: Record<string, { elon: number; rAU: number; tolE: number; tolR: number }> = {
  mercury: { elon: 106.174, rAU: 0.3142,  tolE: 1.0, tolR: 0.02 },
  venus:   { elon: 285.402, rAU: 0.7277,  tolE: 1.0, tolR: 0.02 },
  earth:   { elon: 325.683, rAU: 1.0122,  tolE: 1.0, tolR: 0.02 },
  mars:    { elon: 63.079,  rAU: 1.5029,  tolE: 1.0, tolR: 0.02 },
  jupiter: { elon: 127.708, rAU: 5.2903,  tolE: 1.0, tolR: 0.05 },
  saturn:  { elon: 9.409,   rAU: 9.4475,  tolE: 1.0, tolR: 0.08 },
  uranus:  { elon: 62.163,  rAU: 19.4434, tolE: 1.0, tolR: 0.10 },
  neptune: { elon: 2.379,   rAU: 29.8782, tolE: 1.0, tolR: 0.10 },
  pluto:   { elon: 304.004, rAU: 35.5844, tolE: 1.5, tolR: 0.30 },
};

// Perihelion/aphelion bands (AU) with slack — catches unit errors instantly.
const BANDS: Record<string, [number, number]> = {
  mercury: [0.30, 0.48], venus: [0.71, 0.74], earth: [0.97, 1.03],
  mars: [1.36, 1.69], jupiter: [4.90, 5.51], saturn: [8.99, 10.18],
  uranus: [18.20, 20.15], neptune: [29.70, 30.45], pluto: [29.5, 49.5],
};

describe("Standish cross-validation @ 2026-08-19", () => {
  test("all nine longitudes match the independent reference", () => {
    for (const s of allPlanetStates(D)) {
      const e = EXPECT[s.key] as (typeof EXPECT)[keyof typeof EXPECT];
      const dE = angSep(s.elonDeg, e.elon);
      expect(dE).toBeLessThanOrEqual(e.tolE);
    }
  });

  test("all nine Sun distances match the reference", () => {
    for (const s of allPlanetStates(D)) {
      const e = EXPECT[s.key] as (typeof EXPECT)[keyof typeof EXPECT];
      const dR = Math.abs(s.rAU - e.rAU);
      expect(dR).toBeLessThanOrEqual(e.tolR);
    }
  });
});

describe("frame invariants", () => {
  test("helio Earth is 180 deg from the geocentric Sun", () => {
    // SunPosition() is astronomy-engine's own geocentric ecliptic-of-date Sun.
    // Our Earth longitude is heliocentric J2000-ecliptic; the 180° relation
    // must hold to within precession since J2000 (~0.37° in 2026) + epsilon.
    // A frame/rotation mistake anywhere in orrery.ts breaks this loudly.
    const earth = allPlanetStates(D).find((s) => s.key === "earth")!;
    const sunGeo = SunPosition(D).elon;
    const sep = angSep(norm360(earth.elonDeg + 180), sunGeo);
    expect(sep).toBeLessThan(0.6);
  });
});

describe("physical bands", () => {
  test("distances stay inside perihelion/aphelion bands across dates", () => {
    for (const date of [
      new Date("2024-01-01T00:00:00Z"),
      D,
      new Date("2028-12-31T00:00:00Z"),
    ]) {
      for (const s of allPlanetStates(date)) {
        const [lo, hi] = BANDS[s.key] as [number, number];
        expect(s.rAU).toBeGreaterThanOrEqual(lo);
        expect(s.rAU).toBeLessThanOrEqual(hi);
      }
    }
  });
});

describe("orbit sampling", () => {
  test("closes: one Mercury period returns to the same point", () => {
    const spec = PLANETS.find((p) => p.key === "mercury")!;
    const half = (spec.periodDays * 86_400_000) / 2;
    const a = planetState(spec, new Date(D.getTime() - half));
    const b = planetState(spec, new Date(D.getTime() + half));
    const gap = Math.hypot(a.xAU - b.xAU, a.yAU - b.yAU);
    expect(gap).toBeLessThan(0.02);
  });

  test("paths stay near each planet's mean distance (no frame mixups)", () => {
    for (const spec of PLANETS) {
      const pts = orbitPathAU(spec, D, 32);
      expect(pts.length).toBe(32);
      const [lo, hi] = BANDS[spec.key] as [number, number];
      for (const p of pts) {
        const r = Math.hypot(p.x, p.y);
        // hypot(x,y) <= true r (z dropped), so allow the low side a little.
        expect(r).toBeGreaterThanOrEqual(lo * 0.95);
        expect(r).toBeLessThanOrEqual(hi);
      }
    }
  });

  test("Pluto window stays inside the 1700-2200 validity range", () => {
    const pluto = PLANETS.find((p) => p.key === "pluto")!;
    const halfYears = pluto.periodDays / 365.25 / 2;
    const nowYear = 2026;
    expect(nowYear - halfYears).toBeGreaterThan(1700);
    expect(nowYear + halfYears).toBeLessThan(2200);
    // And it actually computes without throwing:
    expect(orbitPathAU(pluto, D, 16).length).toBe(16);
  });
});
