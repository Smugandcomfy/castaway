/// The parts of the sky that need more than a body's position: the angles
/// (Ascendant and Midheaven), the aspects between planets, and the Moon's
/// nodes.
///
/// Everything here is a pure function of (instant, place). Nothing is stored;
/// the Sky page recomputes on demand, the same way the sigil's presiding
/// condition does. The timestamp is the sky.
///
/// Angles are the one place this app needs a *location*. A body's ecliptic
/// longitude is the same for every observer on Earth, but the degree rising
/// on the eastern horizon is not: noon in Reykjavik and noon in Quito have
/// entirely different ascendants.

import {
  CombineRotation,
  Ecliptic,
  GeoVector,
  MakeTime,
  Observer,
  RotateVector,
  Rotation_ECT_EQD,
  Rotation_EQD_HOR,
  SearchMoonNode,
  Spherical,
  VectorFromSphere,
  HorizonFromVector,
  e_tilt,
  SiderealTime,
  Body,
} from "astronomy-engine";
import { norm360 } from "./project";
import { presidingCondition, type PlanetKey } from "./presiding";

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/// Local apparent sidereal time, in degrees. `SiderealTime` returns Greenwich
/// apparent sidereal time in hours; east longitude adds to it.
export function localSiderealDeg(when: Date, longitudeDeg: number): number {
  return norm360(SiderealTime(when) * 15 + longitudeDeg);
}

/// True obliquity of the ecliptic at the instant, in degrees.
export function obliquityDeg(when: Date): number {
  return e_tilt(MakeTime(when)).tobl;
}

/// The Midheaven: the ecliptic degree crossing the meridian, due south of the
/// observer. Independent of latitude — only the meridian matters.
export function midheavenDeg(when: Date, longitudeDeg: number): number {
  const theta = localSiderealDeg(when, longitudeDeg) * RAD;
  const eps = obliquityDeg(when) * RAD;
  return norm360(
    Math.atan2(Math.sin(theta), Math.cos(theta) * Math.cos(eps)) * DEG,
  );
}

/// The Ascendant: the ecliptic degree rising on the eastern horizon.
///
/// The classical closed form. `sky_core.test.ts` checks it the hard way —
/// by pushing the answer back through astronomy-engine's own ecliptic ->
/// equator -> horizon rotations and asserting the result sits on the horizon,
/// on the eastern side. Two independent formulations must agree, which is the
/// same standard the orrery is held to.
export function ascendantDeg(
  when: Date,
  latitudeDeg: number,
  longitudeDeg: number,
): number {
  const theta = localSiderealDeg(when, longitudeDeg) * RAD;
  const eps = obliquityDeg(when) * RAD;
  const phi = latitudeDeg * RAD;
  const y = Math.cos(theta);
  const x = -(Math.sin(theta) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps));
  return norm360(Math.atan2(y, x) * DEG);
}

/// Where an ecliptic longitude (on the ecliptic itself, latitude 0) sits in
/// the observer's sky at that instant. Used by the tests to verify the
/// angles, and honest enough to be worth exporting.
export function horizonOfEcliptic(
  when: Date,
  latitudeDeg: number,
  longitudeDeg: number,
  eclipticLonDeg: number,
): { altitude: number; azimuth: number } {
  const observer = new Observer(latitudeDeg, longitudeDeg, 0);
  const rot = CombineRotation(
    Rotation_ECT_EQD(when),
    Rotation_EQD_HOR(when, observer),
  );
  const vec = VectorFromSphere(
    new Spherical(0, norm360(eclipticLonDeg), 1),
    when,
  );
  // No refraction. The angles are a geometric construction on the true
  // horizon; refraction lifts a body near the horizon by about half a degree,
  // which would make an exact ascendant look half a degree wrong.
  // The empty string is astronomy-engine's "no refraction" — it tests the
  // option for falsiness and throws on any other value, "none" included.
  const horizontal = HorizonFromVector(RotateVector(rot, vec), "");
  return { altitude: horizontal.lat, azimuth: horizontal.lon };
}

// ------------------------------------------------------------------ aspects

export interface AspectKind {
  name: string;
  /// Exact separation in degrees.
  angle: number;
  /// How far from exact still counts.
  orb: number;
}

/// The five Ptolemaic aspects, with conventional orbs. Deliberately not
/// configurable: an aspect list you can widen until everything aspects
/// everything says nothing at all.
export const ASPECTS: readonly AspectKind[] = [
  { name: "conjunction", angle: 0, orb: 8 },
  { name: "sextile", angle: 60, orb: 4 },
  { name: "square", angle: 90, orb: 6 },
  { name: "trine", angle: 120, orb: 6 },
  { name: "opposition", angle: 180, orb: 8 },
];

export interface Aspect {
  a: string;
  b: string;
  kind: string;
  /// Degrees away from exact; 0 is partile.
  orb: number;
  /// True when the two are closing on exactness rather than separating.
  applying: boolean;
}

/// Shortest separation between two ecliptic longitudes, 0..180.
export function separation(aDeg: number, bDeg: number): number {
  const d = Math.abs(norm360(aDeg) - norm360(bDeg)) % 360;
  return d > 180 ? 360 - d : d;
}

/// Every aspect currently in orb among the given bodies.
///
/// `applying` compares the separation now with the separation an hour on: if
/// the pair is closing toward exact, the aspect is applying, otherwise it is
/// separating. That is the ordinary astrological sense and it needs no extra
/// theory — just the same computation twice.
export function aspectsAmong(
  bodies: readonly { name: string; lonDeg: number; lonDegLater: number }[],
): Aspect[] {
  const found: Aspect[] = [];
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      const now = separation(a.lonDeg, b.lonDeg);
      const later = separation(a.lonDegLater, b.lonDegLater);
      for (const kind of ASPECTS) {
        const orb = Math.abs(now - kind.angle);
        if (orb <= kind.orb) {
          found.push({
            a: a.name,
            b: b.name,
            kind: kind.name,
            orb,
            applying: Math.abs(later - kind.angle) < orb,
          });
          break; // orbs never overlap, so the first match is the only one
        }
      }
    }
  }
  return found.sort((x, y) => x.orb - y.orb);
}

// ------------------------------------------------------- the sky of a cast

/// The sky a reading was cast under, in the terms a reader would say it.
///
/// Derived from the instant alone — no location, because none of this needs
/// one: a body's sign is the same for every observer on Earth. That is why a
/// reading made a year ago can still be annotated with the sky it happened
/// under, from its stored timestamp and nothing else.
export interface CastSky {
  sunSign: string;
  moonSign: string;
  /// Labels of whichever of the five wandering planets were retrograde. The
  /// Sun and Moon are never retrograde geocentrically, so they cannot appear.
  retrograde: string[];
}

const WANDERERS: readonly { key: PlanetKey; label: string }[] = [
  { key: "mercury", label: "Mercury" },
  { key: "venus", label: "Venus" },
  { key: "mars", label: "Mars" },
  { key: "jupiter", label: "Jupiter" },
  { key: "saturn", label: "Saturn" },
];

/// Which sign the Moon stood in, 0 = Aries … 11 = Pisces.
///
/// This is what elects the sigil's square together with the cast's moving
/// lines — see `electedOrder` in sigil_core. The Moon changes sign roughly
/// every two and a half days, which is fast enough that the sky is a real
/// participant rather than a constant.
export function moonSignIndex(when: Date): number {
  return Math.floor(norm360(presidingCondition("luna", when).elonDeg) / 30);
}

export function castSky(when: Date): CastSky {
  return {
    sunSign: presidingCondition("sol", when).sign,
    moonSign: presidingCondition("luna", when).sign,
    retrograde: WANDERERS.filter(
      (w) => presidingCondition(w.key, when).retrograde,
    ).map((w) => w.label),
  };
}

/// One line, in the app's engraved register:
///   "Sun in Leo · Moon in Scorpio"
///   "Sun in Leo · Moon in Scorpio · Mercury and Saturn retrograde"
export function castSkyLine(sky: CastSky): string {
  const base = `Sun in ${sky.sunSign} · Moon in ${sky.moonSign}`;
  if (sky.retrograde.length === 0) return base;
  const names =
    sky.retrograde.length === 1
      ? sky.retrograde[0]
      : `${sky.retrograde.slice(0, -1).join(", ")} and ${
          sky.retrograde[sky.retrograde.length - 1]
        }`;
  return `${base} · ${names} retrograde`;
}

// -------------------------------------------------------------------- nodes

/// The Moon's nodes — where its orbit crosses the ecliptic. The north node is
/// the ascending crossing; the south node is exactly opposite.
///
/// Taken from the next crossing rather than solved directly: the nodes move
/// about 19 degrees a year, so the node's longitude at the next crossing is
/// within a fraction of a degree of its longitude now.
export function lunarNodesDeg(when: Date): { north: number; south: number } {
  let event = SearchMoonNode(when);
  // SearchMoonNode returns whichever crossing comes first; step once more if
  // it is the descending one, so we always measure the ascending node.
  if (event.kind !== 1) {
    const next = SearchMoonNode(
      new Date(event.time.date.getTime() + 24 * 3600 * 1000),
    );
    event = next.kind === 1 ? next : event;
  }
  const moon = Ecliptic(GeoVector(Body.Moon, event.time, true));
  const north = norm360(moon.elon);
  return { north, south: norm360(north + 180) };
}
