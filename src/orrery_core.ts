// Cast Away — orrery.ts
// Astronomy truth layer. Everything here is real: positions come from
// astronomy-engine (truncated VSOP87 + custom Pluto model, ±1 arcminute,
// valid 1700–2200), converted from its native J2000-equatorial frame into
// the J2000 ecliptic so the dial is a top-down view of the solar system
// from the north ecliptic pole.
//
// No React, no DOM. The display layer (Orrery.tsx) decides how to draw it;
// the future fortune layer can import from here too — but see the
// heliocentric-vs-geocentric warning in README.md before wiring astrology.

import { Body, HelioVector, RotateVector, Rotation_EQJ_ECL } from 'astronomy-engine';
import { norm360 } from './project';

export type PlanetKey =
  | 'mercury'
  | 'venus'
  | 'earth'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune'
  | 'pluto';

export interface PlanetSpec {
  key: PlanetKey;
  label: string;
  body: Body;
  /** Sidereal orbital period in days — used only for orbit-path sampling. */
  periodDays: number;
  /** Dot radius in viewBox units. Symbolic hierarchy, not to scale. */
  dotR: number;
  /** Rendering flavor: Saturn gets a ring, Pluto renders hollow ("liminal"). */
  kind: 'solid' | 'ringed' | 'hollow';
}

export const PLANETS: readonly PlanetSpec[] = [
  { key: 'mercury', label: 'Mercury', body: Body.Mercury, periodDays: 87.9691,  dotR: 3.5,  kind: 'solid'  },
  { key: 'venus',   label: 'Venus',   body: Body.Venus,   periodDays: 224.701,  dotR: 5,    kind: 'solid'  },
  { key: 'earth',   label: 'Earth',   body: Body.Earth,   periodDays: 365.256,  dotR: 5,    kind: 'solid'  },
  { key: 'mars',    label: 'Mars',    body: Body.Mars,    periodDays: 686.980,  dotR: 4,    kind: 'solid'  },
  { key: 'jupiter', label: 'Jupiter', body: Body.Jupiter, periodDays: 4332.589, dotR: 9,    kind: 'solid'  },
  { key: 'saturn',  label: 'Saturn',  body: Body.Saturn,  periodDays: 10759.22, dotR: 7.5,  kind: 'ringed' },
  { key: 'uranus',  label: 'Uranus',  body: Body.Uranus,  periodDays: 30688.5,  dotR: 6,    kind: 'solid'  },
  { key: 'neptune', label: 'Neptune', body: Body.Neptune, periodDays: 60182,    dotR: 6,    kind: 'solid'  },
  { key: 'pluto',   label: 'Pluto',   body: Body.Pluto,   periodDays: 90560,    dotR: 3,    kind: 'hollow' },
] as const;

/** Fixed rotation J2000 equatorial -> J2000 ecliptic. Time-independent. */
const EQJ_TO_ECL = Rotation_EQJ_ECL();

export interface PlanetState {
  key: PlanetKey;
  label: string;
  /** Heliocentric position in the J2000 ecliptic frame, AU. */
  xAU: number;
  yAU: number;
  zAU: number;
  /** Distance from the Sun, AU. */
  rAU: number;
  /** Heliocentric ecliptic longitude, degrees [0, 360). 0° = First Point of Aries. */
  elonDeg: number;
}

/** True heliocentric state of one planet at `date`. */
export function planetState(spec: PlanetSpec, date: Date): PlanetState {
  const eqj = HelioVector(spec.body, date);
  const ecl = RotateVector(EQJ_TO_ECL, eqj);
  const rAU = Math.hypot(ecl.x, ecl.y, ecl.z);
  const elonDeg = norm360((Math.atan2(ecl.y, ecl.x) * 180) / Math.PI);
  return { key: spec.key, label: spec.label, xAU: ecl.x, yAU: ecl.y, zAU: ecl.z, rAU, elonDeg };
}

/** All nine, same instant. ~9 series evaluations; sub-millisecond in practice. */
export function allPlanetStates(date: Date = new Date()): PlanetState[] {
  return PLANETS.map((p) => planetState(p, date));
}

/**
 * One full real orbit, sampled as ecliptic-plane points (AU).
 *
 * Sampled in *time*, centered on `centerDate` (window = one sidereal period,
 * ±P/2), so the drawn path is the actual orbit shape — eccentricity,
 * perihelion direction and all — projected exactly like the planet dot.
 * Centering matters for the slow ones: astronomy-engine guarantees accuracy
 * for 1700–2200, and Pluto's 248-year period only fits that window when
 * straddled around the present (e.g. 2026 → samples span ~1902–2150).
 */
export function orbitPathAU(
  spec: PlanetSpec,
  centerDate: Date = new Date(),
  samples = 96,
): { x: number; y: number }[] {
  const periodMs = spec.periodDays * 86_400_000;
  const t0 = centerDate.getTime() - periodMs / 2;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < samples; i++) {
    const t = new Date(t0 + (periodMs * i) / samples);
    const ecl = RotateVector(EQJ_TO_ECL, HelioVector(spec.body, t));
    pts.push({ x: ecl.x, y: ecl.y }); // z (inclination) dropped: top-down view
  }
  return pts;
}

// ---------------------------------------------------------------------------
// Zodiac formatting — display flavor only. NOTE for the future fortune layer:
// these are HELIOCENTRIC longitudes against the J2000 equinox. Horoscope-style
// astrology uses GEOCENTRIC positions against the equinox of date; the two
// disagree by design (e.g. Earth here is always 180° from where an astrologer
// puts the Sun). When the oracle starts consuming the sky, compute geocentric
// via GeoVector + Ecliptic instead. Do not feed these numbers to that code.
// ---------------------------------------------------------------------------

export const ZODIAC_NAMES = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
] as const;

/** Three-letter engraving labels for the dial ring. */
export const ZODIAC_ABBR = [
  'ARI', 'TAU', 'GEM', 'CAN', 'LEO', 'VIR',
  'LIB', 'SCO', 'SAG', 'CAP', 'AQU', 'PIS',
] as const;

/** "17° Leo" from an ecliptic longitude in degrees. */
export function formatZodiac(elonDeg: number): string {
  const e = norm360(elonDeg);
  const sign = Math.floor(e / 30);
  const deg = Math.floor(e - sign * 30);
  return `${deg}° ${ZODIAC_NAMES[sign]}`;
}
