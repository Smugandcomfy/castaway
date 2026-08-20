/// Phase 2 · The presiding planet's condition at the cast timestamp.
///
/// Derived, never stored. History gains annotations retroactively because
/// the reading's timestamp is enough to recompute the sky at that instant.
///
/// Geocentric, equinox of date. Uses astronomy-engine's GeoVector(true) for
/// light-time / aberration correction, then Ecliptic(vec) to project into
/// the ecliptic-of-date plane. Motion by signed central difference of
/// ecliptic longitude at t ± 12h.
///
/// Sun and Moon are never retrograde geocentrically — their retrograde flag
/// is force-false regardless of the central difference (which is always
/// positive for them anyway; the guard is defensive).

import { Body, Ecliptic, GeoVector } from "astronomy-engine";
import { norm360 } from "./project";
import { ZODIAC_NAMES } from "./orrery_core";

export type PlanetKey =
  | "saturn"
  | "jupiter"
  | "mars"
  | "sol"
  | "venus"
  | "mercury"
  | "luna";

const BODY: Record<PlanetKey, Body> = {
  saturn: Body.Saturn,
  jupiter: Body.Jupiter,
  mars: Body.Mars,
  sol: Body.Sun,
  venus: Body.Venus,
  mercury: Body.Mercury,
  luna: Body.Moon,
};

const LUMINARY: Record<PlanetKey, boolean> = {
  saturn: false,
  jupiter: false,
  mars: false,
  sol: true,
  venus: false,
  mercury: false,
  luna: true,
};

/// Election-planet name -> lower-cased key. Kamea.planet returns the Latin
/// title-case form (e.g. "Saturn"); this maps back to what BODY expects.
export function planetKeyOf(name: string): PlanetKey {
  const k = name.toLowerCase();
  if (
    k === "saturn" ||
    k === "jupiter" ||
    k === "mars" ||
    k === "sol" ||
    k === "venus" ||
    k === "mercury" ||
    k === "luna"
  ) {
    return k;
  }
  throw new Error(`planetKeyOf: unrecognised planet name "${name}"`);
}

export interface PresidingCondition {
  /// Geocentric ecliptic longitude at the cast instant, degrees [0, 360).
  elonDeg: number;
  /// Zodiac sign name (Aries..Pisces).
  sign: string;
  /// Ordinal degree inside the sign, 0-29.
  degInSign: number;
  /// True if geocentric longitude is decreasing at the cast instant.
  /// Force-false for Sol and Luna.
  retrograde: boolean;
  /// Signed daily rate — approximate degrees of ecliptic longitude per day
  /// computed as central difference at t ± 12h. Negative iff retrograde
  /// (for non-luminaries). Reported as-is for the display copy that wants
  /// to say "hastening" or "slow at station".
  motionDegPerDay: number;
}

/// Smallest signed angular difference b - a on the circle, in [-180, +180].
export function signedDelta(aDeg: number, bDeg: number): number {
  let d = norm360(bDeg) - norm360(aDeg);
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

/// Geocentric ecliptic longitude of the given body at the given instant.
/// Aberration correction on; equinox of date (via Ecliptic()).
function elonAt(body: Body, when: Date): number {
  const vec = GeoVector(body, when, true);
  const ecl = Ecliptic(vec);
  return norm360(ecl.elon);
}

const HALF_DAY_MS = 12 * 3600 * 1000;

export function presidingCondition(
  key: PlanetKey,
  castTimestamp: Date,
): PresidingCondition {
  const body = BODY[key];
  const elonDeg = elonAt(body, castTimestamp);
  const idx = Math.floor(elonDeg / 30);
  const degInSign = Math.floor(elonDeg - idx * 30);
  const sign = ZODIAC_NAMES[idx] as string; // idx is floor(elonDeg / 30), 0..11

  const before = elonAt(body, new Date(castTimestamp.getTime() - HALF_DAY_MS));
  const after = elonAt(body, new Date(castTimestamp.getTime() + HALF_DAY_MS));
  const delta = signedDelta(before, after);

  const retrograde = LUMINARY[key] ? false : delta < 0;

  return {
    elonDeg,
    sign,
    degInSign,
    retrograde,
    // Motion sign is truthful (Sun/Moon are always positive here); the
    // retrograde *flag* is what we force for luminaries.
    motionDegPerDay: delta,
  };
}

/// One-line copy for the reading view. Kept in the app's engraved register:
///   "in Pisces"
///   "retrograde in Pisces"
export function conditionLine(condition: PresidingCondition): string {
  return condition.retrograde
    ? `retrograde in ${condition.sign}`
    : `in ${condition.sign}`;
}
