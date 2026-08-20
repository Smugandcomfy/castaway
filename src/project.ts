// Cast Away — project.ts
// Pure presentation geometry for the orrery. No astronomy, no React, no deps.
// Astronomy truth lives in orrery.ts; this file only decides where truth goes
// on screen. Keeping it dependency-free means it is testable without
// astronomy-engine installed (see tests/projection.test.ts).

export interface Pt {
  x: number;
  y: number;
}

/** Normalize any angle in degrees to [0, 360). */
export function norm360(deg: number): number {
  const d = deg % 360;
  return d < 0 ? d + 360 : d;
}

/** Smallest absolute separation between two angles, in degrees [0, 180]. */
export function angSep(aDeg: number, bDeg: number): number {
  const d = Math.abs(norm360(aDeg) - norm360(bDeg));
  return d > 180 ? 360 - d : d;
}

/**
 * Logarithmic radial scale: AU -> screen px.
 *
 * Real solar-system distances span two orders of magnitude (Mercury 0.31 AU,
 * Pluto up to 49 AU). Linear scale makes the inner system an invisible smudge;
 * fixed rings throw away the distance story entirely. Log preserves both the
 * inner/outer gap structure *and* each orbit's eccentricity as a visible
 * radial wobble (Mercury's and Pluto's are ~40% swings in ln-space).
 * Values outside [minAU, maxAU] are clamped.
 */
export function makeLogScale(
  minAU: number,
  maxAU: number,
  innerPx: number,
  outerPx: number,
): (rAU: number) => number {
  if (!(minAU > 0) || !(maxAU > minAU) || !(outerPx > innerPx)) {
    throw new Error('makeLogScale: need 0 < minAU < maxAU and innerPx < outerPx');
  }
  const span = Math.log(maxAU / minAU);
  const k = (outerPx - innerPx) / span;
  return (rAU: number) => {
    const r = Math.min(Math.max(rAU, minAU), maxAU);
    return innerPx + k * Math.log(r / minAU);
  };
}

/**
 * Heliocentric ecliptic polar -> screen coordinates.
 *
 * Convention: 0° ecliptic longitude (First Point of Aries) points right (+x);
 * longitude increases counterclockwise, which is the true sense of planetary
 * motion viewed from the north ecliptic pole. SVG's y axis points down, so we
 * subtract the sine term.
 */
export function polarToScreen(elonDeg: number, rPx: number, cx: number, cy: number): Pt {
  const t = (elonDeg * Math.PI) / 180;
  return { x: cx + rPx * Math.cos(t), y: cy - rPx * Math.sin(t) };
}

/** SVG path string from a point loop (orbit outline). */
export function pointsToPath(pts: Pt[], close = true): string {
  if (pts.length === 0) return '';
  const seg = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join('');
  return close ? seg + 'Z' : seg;
}

/**
 * Which side of a planet dot its label should sit on, so text runs away from
 * the Sun instead of across it. Right half of the dial -> anchor 'start'
 * (text extends rightward); left half -> 'end'. The dead-vertical zone gets
 * 'middle' so top/bottom labels center over their dots.
 */
export function labelAnchor(elonDeg: number): 'start' | 'middle' | 'end' {
  const c = Math.cos((elonDeg * Math.PI) / 180);
  if (c > 0.20) return 'start';
  if (c < -0.20) return 'end';
  return 'middle';
}
