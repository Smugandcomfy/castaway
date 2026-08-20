// Cast Away — projection tests (pure geometry, no dependencies).
// Runs under `bun test src/`, same runner as tarot.test.ts.

import { describe, expect, test } from "bun:test";
import {
  norm360,
  angSep,
  makeLogScale,
  polarToScreen,
  pointsToPath,
  labelAnchor,
} from "./project";

describe("norm360", () => {
  test("wraps negatives and multiples", () => {
    expect(norm360(0)).toBe(0);
    expect(norm360(360)).toBe(0);
    expect(norm360(-90)).toBe(270);
    expect(norm360(725)).toBe(5);
    expect(Math.abs(norm360(-0.25) - 359.75)).toBeLessThan(1e-12);
  });
});

describe("angSep", () => {
  test("takes the short way around", () => {
    expect(angSep(10, 350)).toBe(20);
    expect(angSep(0, 180)).toBe(180);
    // Neptune-wrap case near 0° / 360°.
    expect(Math.abs(angSep(2.379, 359.5) - 2.879)).toBeLessThan(1e-9);
  });
});

describe("log scale", () => {
  test("hits endpoints, clamps, and is monotonic", () => {
    const s = makeLogScale(0.3, 49.5, 46, 288);
    expect(Math.abs(s(0.3) - 46)).toBeLessThan(1e-9);
    expect(Math.abs(s(49.5) - 288)).toBeLessThan(1e-9);
    expect(Math.abs(s(0.01) - 46)).toBeLessThan(1e-9); // clamps below
    expect(Math.abs(s(500) - 288)).toBeLessThan(1e-9); // clamps above
    let prev = -Infinity;
    for (const r of [0.31, 0.39, 0.72, 1, 1.52, 5.2, 9.5, 19.2, 30, 49]) {
      const v = s(r);
      expect(v).toBeGreaterThan(prev);
      prev = v;
    }
    // Eccentricity stays visible: Mercury's perihelion/aphelion swing maps
    // to a real on-screen wobble, not sub-pixel noise.
    expect(s(0.467) - s(0.307)).toBeGreaterThan(15);
  });

  test("rejects bad domains", () => {
    expect(() => makeLogScale(0, 10, 10, 100)).toThrow();
    expect(() => makeLogScale(5, 5, 10, 100)).toThrow();
    expect(() => makeLogScale(1, 10, 100, 100)).toThrow();
  });
});

describe("polarToScreen", () => {
  test("0 deg right, CCW motion, SVG y-down handled", () => {
    const cx = 320, cy = 320, r = 100;
    const e = polarToScreen(0, r, cx, cy);
    expect(Math.abs(e.x - 420)).toBeLessThan(1e-9);
    expect(Math.abs(e.y - 320)).toBeLessThan(1e-9);
    const n = polarToScreen(90, r, cx, cy);
    expect(Math.abs(n.x - 320)).toBeLessThan(1e-9);
    expect(Math.abs(n.y - 220)).toBeLessThan(1e-9);
    const w = polarToScreen(180, r, cx, cy);
    expect(Math.abs(w.x - 220)).toBeLessThan(1e-9);
    const s = polarToScreen(270, r, cx, cy);
    expect(Math.abs(s.y - 420)).toBeLessThan(1e-9);
  });
});

describe("pointsToPath", () => {
  test("emits a closed loop", () => {
    const d = pointsToPath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    expect(d).toBe("M0.00 0.00L10.00 0.00L10.00 10.00Z");
    expect(pointsToPath([], true)).toBe("");
    expect(pointsToPath([{ x: 1, y: 2 }], false).endsWith("Z")).toBe(false);
  });
});

describe("labelAnchor", () => {
  test("keeps text running away from the Sun", () => {
    expect(labelAnchor(0)).toBe("start");
    expect(labelAnchor(45)).toBe("start");
    expect(labelAnchor(90)).toBe("middle");
    expect(labelAnchor(135)).toBe("end");
    expect(labelAnchor(180)).toBe("end");
    expect(labelAnchor(270)).toBe("middle");
    expect(labelAnchor(315)).toBe("start");
  });
});
