// The 28 Mansions of the Moon, tropical reckoning, per Agrippa, Three Books
// of Occult Philosophy, Book II, Chapter 33 (Freake translation, 1651).
//
// PROVENANCE. Names, variant spellings, boundaries, and virtues were
// transcribed from two independent renderings of II.33 and cross-checked
// against each other:
//   - renaissanceastrology.com/mansionslunar.html (Warnock's boundary list)
//   - occult-world.com/mansions-of-the-moon (Webster-derived virtues list)
// The `purpose` field is a deliberately terse ABRIDGMENT of Agrippa's
// "vertues", kept faithful — the malefic purposes are reproduced alongside
// the benefic ones, because the stamp reports the tradition, it does not
// endorse an outcome. Full text: II.33 (and the talismanic images: II.46).
//
// FRAME. Tropical, measured from 0 degrees Aries of date — Agrippa's own
// reckoning, and the same frame as the app's Moon-sign election. This module
// MUST be fed the identical Moon longitude the election uses (one source of
// truth). The older star-anchored (sidereal) mansions are a different system;
// the FAQ should say so in one honest line.
//
// GEOMETRY. Width = 360/28 = 90/7 degrees = 12 deg 51' 25.71" exactly.
// Because 7 mansions span exactly 90 degrees, mansions 1, 8, 15, 22 begin
// precisely at the cardinal points (0 Aries, 0 Cancer, 0 Libra, 0 Capricorn)
// — which is exactly where Agrippa's printed table puts them. Mansion
// boundaries meet the zodiac ONLY at those four points.

import { norm360 } from "./project";
import { moonLongitudeAt } from "./sky_core";

export const MANSION_WIDTH_DEG = 360 / 28; // = 90/7

export interface Mansion {
  n: number;        // 1..28
  name: string;     // Agrippa's primary spelling
  alt: string;      // variant spelling(s), '' if none given
  gloss: string;    // Agrippa's meaning gloss, e.g. "horns of Aries"
  purpose: string;  // terse abridgment of the vertues, faithful incl. malefic
  startDeg: number; // exact (n-1) * 90/7, tropical longitude of date
}

const M = (n: number, name: string, alt: string, gloss: string, purpose: string): Mansion =>
  ({ n, name, alt, gloss, purpose, startDeg: ((n - 1) * 90) / 7 });

export const MANSIONS: readonly Mansion[] = [
  M(1,  'Alnath',      '',                'horns of Aries',          'journeys; discord'),
  M(2,  'Allothaim',   'Albochan',        'belly of Aries',          'finding treasure; retaining captives'),
  M(3,  'Achaomazon',  'Athoray',         'showering; the Pleiades', 'favors sailors, huntsmen, alchemists'),
  M(4,  'Aldebaram',   'Aldelamen',       'eye of Taurus',           'hinders buildings, wells, mines; discord'),
  M(5,  'Alchatay',    'Albachay',        '',                        'return from journeys; scholars; health'),
  M(6,  'Alhanna',     'Alchaya',         'little star of great light', 'hunting and sieges; harms harvests and physic'),
  M(7,  'Aldimiach',   'Alarzach',        'arm of Gemini',           'gain and friendship; favors lovers'),
  M(8,  'Alnaza',      'Anatrachya',      'misty; cloudy',           'love and fellowship of travelers; binds captives'),
  M(9,  'Archaam',     'Arcaph',          'eye of the Lion',         'hinders harvests and travelers; discord'),
  M(10, 'Algelioche',  'Albgebh',         'neck of Leo',             'strengthens buildings; love; help against enemies'),
  M(11, 'Azobra',      'Arduf',           'hair of the Lion',        'voyages; gain by trade; freeing captives'),
  M(12, 'Alzarpha',    'Azarpha',         'tail of Leo',             'prospers harvests and plantings; hinders seamen'),
  M(13, 'Alhaire',     '',                'wings of Virgo',          'benevolence, gain, voyages; frees captives'),
  M(14, 'Achureth',    'Arimet',          'spike of Virgo',          'love of the married; cures the sick; hinders land travel'),
  M(15, 'Agrapha',     'Algarpha',        'covered flying',          'extracting treasure; digging; divorce and discord'),
  M(16, 'Azubene',     'Ahubene',         'horns of Scorpio',        'hinders journeys and wedlock; frees captives'),
  M(17, 'Alchil',      '',                'crown of Scorpio',        'betters bad fortune; durable love; strong buildings'),
  M(18, 'Alchas',      'Altob',           'heart of Scorpio',        'discord and conspiracy; revenge; frees captives'),
  M(19, 'Allatha',     'Achala',          'tail of Scorpio',         'sieges and expulsion; peril to seamen'),
  M(20, 'Abnahaya',    '',                'a beam',                  'taming beasts; strengthens prisons; compels arrival'),
  M(21, 'Abeda',       'Albeldach',       'a defeat',                'harvests, gain, buildings, travelers; divorce'),
  M(22, 'Sadahacha',   'Zodeboluch',      'a pastor',                'escape of servants and captives; curing disease'),
  M(23, 'Zabadola',    'Zobrach',         'swallowing',              'divorce; liberty of captives; health of the sick'),
  M(24, 'Sadabath',    'Chadezoad',       'star of fortune',         'goodwill of the married; victory of soldiers'),
  M(25, 'Sadalabra',   'Sadalachia',      'a spreading forth',       'sieges and revenge; binding; hastens messengers'),
  M(26, 'Alpharg',     'Phragol Mocaden', 'the first drawing',       'union and love; health of captives; breaks prisons'),
  M(27, 'Alcharya',    'Alhalgalmoad',    'the second drawing',      'increases harvests and gain; heals; endangers seamen'),
  M(28, 'Albotham',    'Alchalcy',        'Pisces',                  'harvests and trade; safe passage; joy of the married'),
] as const;

/**
 * Tropical ecliptic longitude (degrees, equinox of date) -> mansion 1..28.
 * Multiply BEFORE dividing so the boundaries stay crisp: floor(e * 7 / 90).
 * Feed this the SAME Moon longitude the kamea election reads.
 */
export function mansionOf(elonDeg: number): number {
  const e = norm360(elonDeg);
  return Math.min(27, Math.floor((e * 7) / 90)) + 1;
}

/** The mansion record for a longitude. */
export function mansionAt(elonDeg: number): Mansion {
  return MANSIONS[mansionOf(elonDeg) - 1];
}

const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV',
  'XV','XVI','XVII','XVIII','XIX','XX','XXI','XXII','XXIII','XXIV','XXV','XXVI','XXVII','XXVIII'];

/** e.g. "Mansion IV \u00b7 Aldebaram \u2014 hinders buildings, wells, mines; discord" */
export function formatMansion(elonDeg: number): string {
  const m = mansionAt(elonDeg);
  return `Mansion ${ROMAN[m.n - 1]} \u00b7 ${m.name} \u2014 ${m.purpose}`;
}

/**
 * The mansion an instant falls under.
 *
 * Reads `moonLongitudeAt` — the same function the kamea election reads for
 * the Moon's sign — so the sign and the mansion are two facts derived from
 * one longitude and can never disagree. The dependency runs this way round on
 * purpose: mansions may read the sky, but nothing in the election, the
 * verdict, the trace or the cards may read mansions. This is ink, not input.
 */
export function mansionForTimestamp(when: Date): Mansion {
  return mansionAt(moonLongitudeAt(when));
}

/** The engraved line for an instant. */
export function formatMansionAt(when: Date): string {
  return formatMansion(moonLongitudeAt(when));
}
