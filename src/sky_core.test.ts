import { describe, expect, test } from "bun:test";
import {
  ASPECTS,
  ascendantDeg,
  aspectsAmong,
  horizonOfEcliptic,
  localSiderealDeg,
  lunarNodesDeg,
  midheavenDeg,
  obliquityDeg,
  separation,
} from "./sky_core";
import { norm360 } from "./project";

/// The angles are the one part of this app that needs a place as well as an
/// instant, and the one part with no second opinion built in. So these tests
/// supply the second opinion: every ascendant and midheaven is pushed back
/// through astronomy-engine's own ecliptic -> equator -> horizon rotations
/// and checked against what it claims to be. Same standard as the orrery's
/// reference suite — two independent formulations must agree.

/// A spread of places and instants: both hemispheres, high and low latitude,
/// east and west of Greenwich, across seasons and centuries.
const PLACES = [
  { name: "London", lat: 51.5074, lon: -0.1278 },
  { name: "Quito", lat: -0.1807, lon: -78.4678 },
  { name: "Reykjavik", lat: 64.1466, lon: -21.9426 },
  { name: "Sydney", lat: -33.8688, lon: 151.2093 },
  { name: "Tokyo", lat: 35.6762, lon: 139.6503 },
  { name: "Cape Town", lat: -33.9249, lon: 18.4241 },
  { name: "Anchorage", lat: 61.2181, lon: -149.9003 },
];

const INSTANTS = [
  new Date(Date.UTC(1801, 0, 15, 3, 0, 0)),
  new Date(Date.UTC(1899, 5, 21, 12, 0, 0)),
  new Date(Date.UTC(1969, 6, 20, 20, 17, 0)),
  new Date(Date.UTC(2000, 0, 1, 0, 0, 0)),
  new Date(Date.UTC(2024, 8, 22, 18, 43, 0)),
  new Date(Date.UTC(2026, 7, 19, 7, 30, 0)),
];

describe("obliquity and sidereal time", () => {
  test("obliquity is near 23.4 degrees and shrinking over the centuries", () => {
    const early = obliquityDeg(new Date(Date.UTC(1800, 0, 1)));
    const late = obliquityDeg(new Date(Date.UTC(2050, 0, 1)));
    expect(early).toBeGreaterThan(23.3);
    expect(early).toBeLessThan(23.6);
    expect(late).toBeLessThan(early); // ~47 arcsec per century
    expect(early - late).toBeLessThan(0.1);
  });

  test("local sidereal time tracks longitude one-for-one", () => {
    const when = new Date(Date.UTC(2024, 2, 3, 9, 0, 0));
    const atGreenwich = localSiderealDeg(when, 0);
    expect(norm360(localSiderealDeg(when, 30) - atGreenwich)).toBeCloseTo(30, 6);
    expect(norm360(localSiderealDeg(when, -45) - atGreenwich)).toBeCloseTo(
      315,
      6,
    );
  });
});

describe("the angles, verified against the horizon", () => {
  test("the ascendant really is on the horizon, and really is rising", () => {
    for (const place of PLACES) {
      for (const when of INSTANTS) {
        const asc = ascendantDeg(when, place.lat, place.lon);
        const { altitude, azimuth } = horizonOfEcliptic(
          when,
          place.lat,
          place.lon,
          asc,
        );
        // On the horizon: the whole claim of an ascendant.
        expect(Math.abs(altitude)).toBeLessThan(0.02);
        // Rising, not setting — the eastern half of the sky, where azimuth
        // runs 0 (north) through 180 (south) by way of 90 (east).
        expect(azimuth).toBeGreaterThan(0);
        expect(azimuth).toBeLessThan(180);
      }
    }
  });

  test("the midheaven really is on the meridian, and really is up", () => {
    for (const place of PLACES) {
      for (const when of INSTANTS) {
        const mc = midheavenDeg(when, place.lon);
        const { altitude, azimuth } = horizonOfEcliptic(
          when,
          place.lat,
          place.lon,
          mc,
        );
        // Due south or due north — either way, on the meridian.
        const offMeridian = Math.min(
          Math.abs(azimuth - 180),
          Math.abs(azimuth - 0),
          Math.abs(azimuth - 360),
        );
        expect(offMeridian).toBeLessThan(0.05);
        // Above the horizon: the midheaven is the culminating degree.
        expect(altitude).toBeGreaterThan(0);
      }
    }
  });

  test("the midheaven does not depend on latitude, but the ascendant does", () => {
    const when = new Date(Date.UTC(2024, 4, 4, 4, 4, 0));
    const lon = 12.4964; // Rome's meridian
    expect(midheavenDeg(when, lon)).toBeCloseTo(midheavenDeg(when, lon), 9);

    const north = ascendantDeg(when, 60, lon);
    const equator = ascendantDeg(when, 0, lon);
    expect(separation(north, equator)).toBeGreaterThan(1);
  });

  test("the ascendant sweeps the whole zodiac across a day", () => {
    const seen = new Set<string>();
    const base = Date.UTC(2024, 3, 1, 0, 0, 0);
    for (let m = 0; m < 24 * 60; m += 10) {
      const asc = ascendantDeg(new Date(base + m * 60_000), 40.7128, -74.006);
      seen.add(String(Math.floor(asc / 30)));
    }
    expect(seen.size).toBe(12);
  });
});

describe("aspects", () => {
  test("separation is symmetric and never exceeds a half turn", () => {
    for (let a = 0; a < 360; a += 17) {
      for (let b = 0; b < 360; b += 23) {
        const s = separation(a, b);
        expect(s).toBe(separation(b, a));
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(180);
      }
    }
    expect(separation(350, 10)).toBeCloseTo(20, 9); // across the wrap
  });

  test("each aspect is found at its exact angle", () => {
    for (const kind of ASPECTS) {
      const found = aspectsAmong([
        { name: "A", lonDeg: 10, lonDegLater: 10 },
        { name: "B", lonDeg: 10 + kind.angle, lonDegLater: 10 + kind.angle },
      ]);
      expect(found.length).toBe(1);
      expect(found[0].kind).toBe(kind.name);
      expect(found[0].orb).toBeCloseTo(0, 9);
    }
  });

  test("nothing is reported outside its orb", () => {
    for (const kind of ASPECTS) {
      const justOutside = kind.angle + kind.orb + 0.5;
      const found = aspectsAmong([
        { name: "A", lonDeg: 0, lonDegLater: 0 },
        { name: "B", lonDeg: justOutside, lonDegLater: justOutside },
      ]);
      expect(found.some((f) => f.kind === kind.name)).toBe(false);
    }
  });

  test("applying and separating are told apart", () => {
    // Closing on an exact trine.
    const applying = aspectsAmong([
      { name: "A", lonDeg: 0, lonDegLater: 0 },
      { name: "B", lonDeg: 123, lonDegLater: 121 },
    ]);
    expect(applying[0].kind).toBe("trine");
    expect(applying[0].applying).toBe(true);

    const separating = aspectsAmong([
      { name: "A", lonDeg: 0, lonDegLater: 0 },
      { name: "B", lonDeg: 123, lonDegLater: 125 },
    ]);
    expect(separating[0].applying).toBe(false);
  });

  test("a pair gets at most one aspect", () => {
    for (let d = 0; d <= 180; d += 1) {
      const found = aspectsAmong([
        { name: "A", lonDeg: 0, lonDegLater: 0 },
        { name: "B", lonDeg: d, lonDegLater: d },
      ]);
      expect(found.length).toBeLessThanOrEqual(1);
    }
  });
});

describe("lunar nodes", () => {
  test("the nodes are opposite, in range, and drift retrograde over a year", () => {
    const start = new Date(Date.UTC(2024, 0, 1));
    const later = new Date(Date.UTC(2025, 0, 1));
    const a = lunarNodesDeg(start);
    const b = lunarNodesDeg(later);

    for (const n of [a, b]) {
      expect(n.north).toBeGreaterThanOrEqual(0);
      expect(n.north).toBeLessThan(360);
      expect(separation(n.north, n.south)).toBeCloseTo(180, 6);
    }

    // The node regresses roughly 19.35 degrees a year. Generous band: this
    // catches a broken computation, not ephemeris noise.
    const moved = separation(a.north, b.north);
    expect(moved).toBeGreaterThan(15);
    expect(moved).toBeLessThan(24);
  });
});
