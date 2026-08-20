/// Phase 2 tests for the presiding-condition annotation.
///
/// T7 — Sol condition longitude equals astronomy-engine's SunPosition
///      elon within 0.01°. Independent-implementation cross-check that
///      catches frame/rotation/aberration mistakes.
/// T8 — 2026 daily sweep: Mercury geocentric motion changes direction
///      exactly 6 times (three retrograde periods, two stations each);
///      Sun and Moon are direct on every sample.

import { describe, expect, test } from "bun:test";
import { SunPosition } from "astronomy-engine";
import {
  presidingCondition,
  signedDelta,
  conditionLine,
} from "./presiding";
import { norm360 } from "./project";

// ============================================================ T7 · Sol cross-check

describe("T7 · Sol condition ≡ SunPosition", () => {
  test("Sol elonDeg matches SunPosition(t).elon within 0.01°", () => {
    // Sample across the year to catch any seasonal frame bug.
    for (const iso of [
      "2026-01-15T00:00:00Z",
      "2026-03-21T00:00:00Z",
      "2026-06-21T12:00:00Z",
      "2026-08-19T00:00:00Z",
      "2026-09-23T18:00:00Z",
      "2026-12-31T23:00:00Z",
    ]) {
      const t = new Date(iso);
      const ours = presidingCondition("sol", t).elonDeg;
      const theirs = norm360(SunPosition(t).elon);
      // Wrap-safe comparison via smallest signed delta.
      const gap = Math.abs(signedDelta(ours, theirs));
      expect(gap).toBeLessThan(0.01);
    }
  });

  test("Sol is never marked retrograde", () => {
    for (const iso of ["2026-01-01T00:00:00Z", "2026-07-04T12:00:00Z"]) {
      expect(presidingCondition("sol", new Date(iso)).retrograde).toBe(false);
    }
  });

  test("Luna is never marked retrograde either", () => {
    for (const iso of ["2026-02-14T00:00:00Z", "2026-11-11T09:00:00Z"]) {
      expect(presidingCondition("luna", new Date(iso)).retrograde).toBe(false);
    }
  });
});

// ============================================================ T8 · 2026 sweep

describe("T8 · 2026 daily sweep", () => {
  const YEAR_START = new Date("2026-01-01T00:00:00Z").getTime();
  const DAY_MS = 86_400_000;

  // Pre-computed daily samples for the whole year, once. Used by every
  // test in this describe.
  const days: Date[] = Array.from(
    { length: 365 },
    (_, i) => new Date(YEAR_START + i * DAY_MS),
  );

  test("Mercury's geocentric motion changes direction exactly 6 times", () => {
    // Direction = sign of daily motion (positive = direct, negative = retro).
    // A "change" is a sign flip between adjacent daily samples. 3 retrograde
    // periods × 2 stations each = 6 changes across a calendar year.
    let last: number = 0;
    let changes = 0;
    for (const t of days) {
      const m = presidingCondition("mercury", t).motionDegPerDay;
      const sign = m > 0 ? 1 : m < 0 ? -1 : 0;
      if (sign === 0) continue; // near a station, ambiguous — skip
      if (last !== 0 && sign !== last) changes += 1;
      last = sign;
    }
    expect(changes).toBe(6);
  });

  test("Sun and Moon are direct on every 2026 sample", () => {
    for (const t of days) {
      expect(presidingCondition("sol", t).retrograde).toBe(false);
      expect(presidingCondition("luna", t).retrograde).toBe(false);
    }
  });
});

// ============================================================ conditionLine copy

describe("conditionLine · copy", () => {
  test("direct: 'in <Sign>'", () => {
    // Pick a moment when Sol is directly measurable in Leo (mid-August).
    const line = conditionLine(
      presidingCondition("sol", new Date("2026-08-15T00:00:00Z")),
    );
    expect(line).toMatch(/^in [A-Z]/);
    expect(line).not.toContain("retrograde");
  });

  test("retrograde: 'retrograde in <Sign>' during a known Mercury retro", () => {
    // Mercury has a retrograde period spanning early March 2026; sample
    // inside it and check the copy branch fires. If astronomy-engine's
    // ephemeris shifts the window slightly this test would need updating,
    // but the branch under test is a copy detail, not the ephemeris.
    let sawRetro = false;
    for (let d = 1; d <= 90; d++) {
      const t = new Date(2026, 0, d); // Jan 1 + d days, local time is fine
      const c = presidingCondition("mercury", t);
      if (c.retrograde) {
        expect(conditionLine(c)).toMatch(/^retrograde in /);
        sawRetro = true;
        break;
      }
    }
    expect(sawRetro).toBe(true);
  });
});
