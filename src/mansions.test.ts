import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  MANSIONS,
  MANSION_WIDTH_DEG,
  mansionOf,
  mansionAt,
  mansionForTimestamp,
  formatMansion,
} from "./mansions";
import { moonLongitudeAt, moonSignIndex } from "./sky_core";
import { norm360 } from "./project";

/// T1-T7 are the design drop's suite, ported unchanged in substance.
/// T8-T10 are the integration checks only this repo can run.
///
/// Every expectation here is exact by construction — the mansion width is
/// 90/7 degrees and nothing about it is approximate. Do not widen a band to
/// make a failure go away.

describe("T1 · the table", () => {
  test("28 rows, numbered 1..28, names and purposes non-empty and unique", () => {
    expect(MANSIONS.length).toBe(28);
    MANSIONS.forEach((m, i) => {
      expect(m.n).toBe(i + 1);
      expect(m.name.length).toBeGreaterThan(0);
      expect(m.purpose.length).toBeGreaterThan(0);
    });
    expect(new Set(MANSIONS.map((m) => m.name)).size).toBe(28);
  });
});

describe("T2 · exact boundaries", () => {
  test("startDeg = (n-1) · 90/7, and the width is 90/7", () => {
    MANSIONS.forEach((m, i) => {
      expect(Math.abs(m.startDeg - (i * 90) / 7)).toBeLessThan(1e-12);
    });
    expect(Math.abs(MANSION_WIDTH_DEG - 90 / 7)).toBeLessThan(1e-15);
  });
});

describe("T3 · the cardinal invariant", () => {
  test("mansions 1, 8, 15, 22 begin at 0 Aries / Cancer / Libra / Capricorn", () => {
    expect(mansionOf(0)).toBe(1);
    expect(mansionOf(90)).toBe(8);
    expect(mansionOf(180)).toBe(15);
    expect(mansionOf(270)).toBe(22);
    // and immediately below each cardinal, the previous quadrant's seventh
    expect(mansionOf(90 - 1e-9)).toBe(7);
    expect(mansionOf(180 - 1e-9)).toBe(14);
    expect(mansionOf(270 - 1e-9)).toBe(21);
    expect(mansionOf(360 - 1e-9)).toBe(28);
  });
});

describe("T4 · agreement with Agrippa's printed table", () => {
  test("truncated minutes cycle [0,51,42,34,25,17,8] for all 28", () => {
    // Warnock's transcription of II.33 prints 12 Aries 51, 25 Aries 42,
    // 8 Taurus 34, 21 Taurus 25, 4 Gemini 17, 17 Gemini 8, 0 Cancer …
    // The exact 90/7 boundaries have to reproduce that seven-cycle.
    const cycle = [0, 51, 42, 34, 25, 17, 8];
    MANSIONS.forEach((m, i) => {
      expect(Math.floor(m.startDeg * 60) % 60).toBe(cycle[i % 7]);
    });
  });
});

describe("T5 · quadrant-sign consistency", () => {
  test("the mansion's quadrant always equals the sign's quadrant", () => {
    for (let k = 0; k < 3600; k++) {
      const e = k * 0.1 + 0.05;
      expect(Math.floor((mansionOf(e) - 1) / 7)).toBe(
        Math.floor(Math.floor(norm360(e) / 30) / 3),
      );
    }
  });
});

describe("T6 · coverage", () => {
  test("28 contiguous equal arcs, no gaps, no double steps, wraps correctly", () => {
    const step = 0.005;
    let prev = mansionOf(step);
    const counts = new Array(29).fill(0);
    for (let e = step; e < 360; e += step) {
      const m = mansionOf(e);
      counts[m]++;
      expect(m === prev || m === prev + 1 || (prev === 28 && m === 28)).toBe(
        true,
      );
      prev = m;
    }
    const expected = MANSION_WIDTH_DEG / step;
    for (let n = 1; n <= 28; n++) {
      expect(Math.abs(counts[n] - expected)).toBeLessThanOrEqual(2);
    }
  });
});

describe("T7 · normalization and formatting", () => {
  test("negative and >360 longitudes normalize", () => {
    expect(mansionOf(-1e-6)).toBe(28);
    expect(mansionOf(360)).toBe(1);
    expect(mansionOf(450)).toBe(mansionOf(90));
    expect(mansionOf(-270)).toBe(mansionOf(90));
  });

  test("the engraved line renders with a Roman numeral", () => {
    expect(mansionAt(40).n).toBe(4); // 40° = 10 Taurus -> Aldebaram
    const s = formatMansion(40);
    expect(s.startsWith("Mansion IV · Aldebaram")).toBe(true);
    expect(s).toContain("hinders buildings");
    expect(formatMansion(0).startsWith("Mansion I · Alnath")).toBe(true);
    expect(
      formatMansion(359.9).startsWith("Mansion XXVIII · Albotham"),
    ).toBe(true);
  });
});

// ------------------------------------------------- integration with the app

describe("T8 · one Moon", () => {
  test("the mansion and the election read the same longitude function", () => {
    // Behavioural: for a year of instants, the mansion derived through the
    // timestamp equals the mansion of the longitude the election also reads.
    const base = Date.UTC(2026, 0, 1);
    for (let d = 0; d < 365; d += 7) {
      const when = new Date(base + d * 86_400_000);
      const lon = moonLongitudeAt(when);
      expect(mansionForTimestamp(when).n).toBe(mansionOf(lon));
      expect(moonSignIndex(when)).toBe(Math.floor(lon / 30));
    }
  });

  test("structurally, mansions read the sky and nothing reads mansions back", () => {
    const here = (f: string) =>
      readFileSync(new URL(f, import.meta.url), "utf8");
    // The mansion module derives from the shared longitude…
    expect(here("./mansions.ts")).toMatch(/moonLongitudeAt/);
    // …and nothing on the verdict, election, trace or card paths imports it.
    for (const f of ["./sigil_core.ts", "./tarot.ts", "./epochdeck.ts", "./sky_core.ts"]) {
      expect(here(f)).not.toMatch(/from\s+["']\.\/mansions["']/);
    }
  });
});

describe("T9 · ingress agreement", () => {
  test("a sign ingress into a cardinal is the same instant as its mansion boundary", () => {
    // Bisect to the crossing rather than stepping minute by minute through a
    // month of ephemeris — same instant, a few hundred evaluations instead of
    // a hundred thousand.
    const HOUR = 3_600_000;
    const base = Date.UTC(2026, 0, 1);
    const cardinals = new Map([
      [0, 1], // 0° Aries    -> mansion 1
      [3, 8], // 0° Cancer   -> mansion 8
      [6, 15], // 0° Libra    -> mansion 15
      [9, 22], // 0° Capricorn-> mansion 22
    ]);

    let checked = 0;
    let prevT = base;
    let prevSign = moonSignIndex(new Date(base));

    for (let h = 1; h <= 24 * 40; h++) {
      const t = base + h * HOUR;
      const sign = moonSignIndex(new Date(t));
      if (sign !== prevSign && cardinals.has(sign)) {
        // Bisect [prevT, t] down to under a minute.
        let lo = prevT;
        let hi = t;
        while (hi - lo > 60_000) {
          const mid = Math.floor((lo + hi) / 2);
          if (moonSignIndex(new Date(mid)) === sign) hi = mid;
          else lo = mid;
        }
        const wanted = cardinals.get(sign)!;
        // After the ingress the mansion is the cardinal one; before it, the
        // last mansion of the previous quadrant.
        expect(mansionForTimestamp(new Date(hi)).n).toBe(wanted);
        expect(mansionForTimestamp(new Date(lo)).n).toBe(
          wanted === 1 ? 28 : wanted - 1,
        );
        checked++;
      }
      prevSign = sign;
      prevT = t;
    }

    expect(checked).toBeGreaterThan(0);
  });
});

describe("T10 · a year of the Moon", () => {
  test("daily steps stay in {0,1,2} and the year traverses 373-375 mansions", () => {
    const base = Date.UTC(2026, 0, 1);
    let traversed = 0;
    let prev = mansionForTimestamp(new Date(base)).n;
    for (let d = 1; d <= 365; d++) {
      const n = mansionForTimestamp(new Date(base + d * 86_400_000)).n;
      // The Moon moves 11.8°-15.4° a day against a 12.857° mansion, so a day
      // advances by one mansion, occasionally two, and just occasionally none.
      const step = (n - prev + 28) % 28;
      expect(step).toBeGreaterThanOrEqual(0);
      expect(step).toBeLessThanOrEqual(2);
      traversed += step;
      prev = n;
    }
    // 365 × 28 / 27.32 ≈ 374
    expect(traversed).toBeGreaterThanOrEqual(373);
    expect(traversed).toBeLessThanOrEqual(375);
  });
});
