import { useEffect, useMemo, useState } from "react";
import {
  Body,
  Illumination,
  MoonPhase,
  SearchMoonPhase,
  SunPosition,
} from "astronomy-engine";
import { Masthead } from "./Masthead";
import { Footer } from "./Footer";
import { SkyChart, type ChartBody } from "./SkyChart";
import { presidingCondition, type PlanetKey } from "./presiding";
import { ZODIAC_NAMES } from "./orrery_core";
import { norm360 } from "./project";
import {
  ascendantDeg,
  aspectsAmong,
  lunarNodesDeg,
  midheavenDeg,
  type Aspect,
} from "./sky_core";
import { DEFAULT_PLACE, PLACES, REGIONS, findPlace } from "./places";
import { journalCache, loadJournal, setPlace } from "./backend";
import type { View } from "./App";
import "./style.scss";

/// The sky, geocentric, at an instant and from a place.
///
/// The splash orrery is the instrument — heliocentric, log-radii, the solar
/// system seen from above. This is the other view: everything from where the
/// observer is standing, which is the picture classical astronomers and
/// astrologers have always read.
///
/// It defaults to right now and keeps ticking. Choose a moment and it stops
/// and shows that sky instead; "Return to now" starts the clock again. The
/// floor is 1800 because that is where the orrery's own cross-validation
/// stops holding — see the reference suite — and drawing a sky we cannot
/// defend would be worse than not drawing it.

const SIGNS = ZODIAC_NAMES;

/// The seven classical planets, in the traditional order outward from the
/// Sun's own sphere. The same seven the kameas and the presiding election
/// use, so the app never has to explain two different lists.
const BODIES: readonly {
  key: PlanetKey;
  label: string;
  abbr: string;
  luminary?: boolean;
}[] = [
  { key: "sol", label: "Sun", abbr: "Su", luminary: true },
  { key: "luna", label: "Moon", abbr: "Mo", luminary: true },
  { key: "mercury", label: "Mercury", abbr: "Me" },
  { key: "venus", label: "Venus", abbr: "Ve" },
  { key: "mars", label: "Mars", abbr: "Ma" },
  { key: "jupiter", label: "Jupiter", abbr: "Ju" },
  { key: "saturn", label: "Saturn", abbr: "Sa" },
];

/// 1800-01-01. Before this the ephemeris is still willing but the orrery's
/// independent cross-check is not, so the app stops offering it.
const FLOOR = new Date(Date.UTC(1800, 0, 1, 0, 0, 0));

function signName(elonDeg: number): string {
  // norm360 keeps this in 0..359, so the index is 0..11 and SIGNS holds twelve.
  return SIGNS[Math.floor(norm360(elonDeg) / 30)] as string;
}

function degInSign(elonDeg: number): number {
  const e = norm360(elonDeg);
  return Math.floor(e - Math.floor(e / 30) * 30);
}

const placeInSign = (elonDeg: number) =>
  `${degInSign(elonDeg)}° ${signName(elonDeg)}`;

/// Moon-phase-angle -> readable name.
/// Angles per astronomy-engine's MoonPhase(): 0=new, 90=first-quarter,
/// 180=full, 270=last-quarter, wrapping.
function moonPhaseName(angle: number): string {
  const a = norm360(angle);
  if (a < 22.5) return "New Moon";
  if (a < 67.5) return "Waxing Crescent";
  if (a < 112.5) return "First Quarter";
  if (a < 157.5) return "Waxing Gibbous";
  if (a < 202.5) return "Full Moon";
  if (a < 247.5) return "Waning Gibbous";
  if (a < 292.5) return "Last Quarter";
  if (a < 337.5) return "Waning Crescent";
  return "New Moon";
}

function formatEventDate(d: Date): string {
  return d.toLocaleString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/// `datetime-local` speaks local wall-clock in this exact shape.
function toInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

const HOUR_MS = 3600 * 1000;

export default function SkyPage({ goTo }: { goTo: (v: View) => void }) {
  // Live clock. Only runs while no moment has been chosen — a fixed sky has
  // no reason to tick.
  const [now, setNow] = useState<Date>(() => new Date());
  const [chosen, setChosen] = useState<Date | null>(null);
  // The chosen place is remembered between visits, so this starts from
  // whatever the journal already told us and is corrected once it loads.
  const [placeName, setPlaceName] = useState<string>(
    () => journalCache()?.place ?? DEFAULT_PLACE.name,
  );

  useEffect(() => {
    let live = true;
    void loadJournal()
      .then((j) => {
        if (live && j.place) setPlaceName(j.place);
      })
      .catch(() => {
        // Greenwich is already selected and is a defensible default.
      });
    return () => {
      live = false;
    };
  }, []);

  function choosePlace(name: string) {
    setPlaceName(name);
    void setPlace(name).catch(() => undefined);
  }

  useEffect(() => {
    if (chosen !== null) return;
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [chosen]);

  const when = chosen ?? now;
  const place = findPlace(placeName) ?? DEFAULT_PLACE;
  const live = chosen === null;

  const sun = useMemo(() => {
    const s = SunPosition(when);
    return { elonDeg: norm360(s.elon) };
  }, [when]);

  const moon = useMemo(() => {
    const cond = presidingCondition("luna", when);
    const phase = MoonPhase(when);
    const illum = Illumination(Body.Moon, when);
    return {
      elonDeg: cond.elonDeg,
      phaseName: moonPhaseName(phase),
      illuminatedPct: Math.round(illum.phase_fraction * 100),
    };
  }, [when]);

  /// Every body's longitude now, and again an hour on. The second reading is
  /// what tells an applying aspect from a separating one, and it costs one
  /// more evaluation of the same function.
  const positions = useMemo(
    () =>
      BODIES.map((b) => {
        const c = presidingCondition(b.key, when);
        const later = presidingCondition(
          b.key,
          new Date(when.getTime() + HOUR_MS),
        );
        return {
          ...b,
          lonDeg: c.elonDeg,
          lonDegLater: later.elonDeg,
          sign: c.sign,
          degree: c.degInSign,
          retrograde: c.retrograde,
        };
      }),
    [when],
  );

  /// The four angles. The Descendant and Imum Coeli are simply the opposite
  /// points, so they cost nothing to show and complete the cross the wheel is
  /// already drawing.
  const angles = useMemo(() => {
    const asc = ascendantDeg(when, place.lat, place.lon);
    const mc = midheavenDeg(when, place.lon);
    return { asc, mc, dsc: norm360(asc + 180), ic: norm360(mc + 180) };
  }, [when, place.lat, place.lon]);

  const nodes = useMemo(() => lunarNodesDeg(when), [when]);

  const aspects: Aspect[] = useMemo(
    () =>
      aspectsAmong(
        positions.map((p) => ({
          name: p.label,
          lonDeg: p.lonDeg,
          lonDegLater: p.lonDegLater,
        })),
      ),
    [positions],
  );

  const events = useMemo(() => {
    // A 45-day window guarantees both a new and a full moon.
    const nextNew = SearchMoonPhase(0, when, 45);
    const nextFull = SearchMoonPhase(180, when, 45);
    return {
      nextNew: nextNew ? formatEventDate(nextNew.date) : null,
      nextFull: nextFull ? formatEventDate(nextFull.date) : null,
    };
  }, [when]);

  const chartBodies: ChartBody[] = positions.map((p) => ({
    key: p.key,
    abbr: p.abbr,
    label: p.label,
    lonDeg: p.lonDeg,
    retrograde: p.retrograde,
    // `exactOptionalPropertyTypes`: an optional field must be omitted, not set
    // to undefined.
    ...(p.luminary === undefined ? {} : { luminary: p.luminary }),
  }));

  function pickMoment(value: string) {
    if (!value) return;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return;
    if (parsed.getTime() < FLOOR.getTime()) return;
    // The sky ahead is not this page's business.
    setChosen(parsed.getTime() > Date.now() ? new Date() : parsed);
  }

  return (
    <main className="nt-app nt-app--fill cast-away">
      <div className="nt-page">

        <Masthead current="sky" goTo={goTo} />

        <section className="nt-section">
          <header className="nt-section-header">
            <h2 className="nt-section-heading">
              {live ? "The sky right now" : "The sky then"}
            </h2>
          </header>
          <p className="ca-sky-timestamp nt-muted">
            {when.toLocaleString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
              timeZoneName: "short",
            })}
            {" · "}
            {place.name}
          </p>

          <div className="ca-sky-controls">
            <label className="ca-sky-control">
              <span className="nt-label">Moment</span>
              <input
                type="datetime-local"
                className="nt-input"
                value={toInputValue(when)}
                min={toInputValue(FLOOR)}
                max={toInputValue(new Date())}
                onChange={(e) => pickMoment(e.target.value)}
              />
            </label>

            <label className="ca-sky-control">
              <span className="nt-label">Place</span>
              <select
                className="nt-select"
                value={placeName}
                onChange={(e) => choosePlace(e.target.value)}
              >
                <option value={DEFAULT_PLACE.name}>
                  {DEFAULT_PLACE.name}
                </option>
                {REGIONS.map((region) => (
                  <optgroup key={region} label={region}>
                    {PLACES.filter((p) => p.region === region).map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="nt-button nt-button--ghost ca-sky-reset"
              onClick={() => setChosen(null)}
              disabled={live}
            >
              Return to now
            </button>
          </div>

          {!live && (
            <p className="nt-muted ca-sky-frozen">
              Frozen at the moment above. The clock is stopped.
            </p>
          )}
        </section>

        {/* The wheel with its four angles at the corners — each set nearest
            the point it marks on the dial, so the labels read as part of the
            drawing rather than a table under it. */}
        <section className="nt-section ca-sky-chart-section">
          <div className="ca-sky-wheel">
            <div className="ca-sky-angle ca-sky-angle--tl">
              <div className="ca-sky-angle__label">Rising</div>
              <div className="ca-sky-angle__value">
                {placeInSign(angles.asc)}
              </div>
              <div className="ca-sky-angle__sub">eastern horizon</div>
            </div>

            <div className="ca-sky-angle ca-sky-angle--tr">
              <div className="ca-sky-angle__label">Midheaven</div>
              <div className="ca-sky-angle__value">
                {placeInSign(angles.mc)}
              </div>
              <div className="ca-sky-angle__sub">the meridian</div>
            </div>

            <div className="ca-sky-wheel__chart">
              <SkyChart
                bodies={chartBodies}
                ascDeg={angles.asc}
                mcDeg={angles.mc}
                placed
              />
            </div>

            <div className="ca-sky-angle ca-sky-angle--bl">
              <div className="ca-sky-angle__label">Imum Coeli</div>
              <div className="ca-sky-angle__value">
                {placeInSign(angles.ic)}
              </div>
              <div className="ca-sky-angle__sub">lowest point</div>
            </div>

            <div className="ca-sky-angle ca-sky-angle--br">
              <div className="ca-sky-angle__label">Setting</div>
              <div className="ca-sky-angle__value">
                {placeInSign(angles.dsc)}
              </div>
              <div className="ca-sky-angle__sub">western horizon</div>
            </div>
          </div>
        </section>

        <section className="nt-section ca-sky-luminaries">
          <div className="ca-sky-luminary">
            <div className="ca-sky-luminary-label">Sun</div>
            <div className="ca-sky-luminary-body">
              {placeInSign(sun.elonDeg)}
            </div>
          </div>
          <div className="ca-sky-luminary">
            <div className="ca-sky-luminary-label">Moon</div>
            <div className="ca-sky-luminary-body">
              {placeInSign(moon.elonDeg)}
            </div>
            <div className="ca-sky-luminary-sub">
              {moon.phaseName} · {moon.illuminatedPct}% illuminated
            </div>
          </div>
        </section>

        <section className="nt-section">
          <header className="nt-section-header">
            <h2 className="nt-section-heading">Planets</h2>
          </header>
          <ul className="ca-sky-planet-list">
            {positions
              .filter((p) => p.key !== "sol" && p.key !== "luna")
              .map((p) => (
                <li key={p.label} className="ca-sky-planet-row">
                  <span className="ca-sky-planet-name">{p.label}</span>
                  <span className="ca-sky-planet-place">
                    {p.degree}° {p.sign}
                  </span>
                  <span
                    className={`ca-sky-planet-motion${
                      p.retrograde ? " is-retro" : ""
                    }`}
                  >
                    {p.retrograde ? "retrograde" : "direct"}
                  </span>
                </li>
              ))}
            <li className="ca-sky-planet-row">
              <span className="ca-sky-planet-name">North Node</span>
              <span className="ca-sky-planet-place">
                {placeInSign(nodes.north)}
              </span>
              <span className="ca-sky-planet-motion is-retro">retrograde</span>
            </li>
            <li className="ca-sky-planet-row">
              <span className="ca-sky-planet-name">South Node</span>
              <span className="ca-sky-planet-place">
                {placeInSign(nodes.south)}
              </span>
              <span className="ca-sky-planet-motion is-retro">retrograde</span>
            </li>
          </ul>
        </section>

        <section className="nt-section">
          <header className="nt-section-header">
            <h2 className="nt-section-heading">Aspects</h2>
            {aspects.length > 0 && (
              <span className="nt-section-count">{aspects.length}</span>
            )}
          </header>
          {aspects.length === 0 ? (
            <p className="nt-muted">
              Nothing within orb. The seven are keeping to themselves.
            </p>
          ) : (
            <ul className="ca-sky-planet-list">
              {aspects.map((a) => (
                <li
                  key={`${a.a}-${a.b}-${a.kind}`}
                  className="ca-sky-planet-row"
                >
                  <span className="ca-sky-planet-name">
                    {a.a} · {a.b}
                  </span>
                  <span className="ca-sky-planet-place">{a.kind}</span>
                  <span className="ca-sky-planet-motion">
                    {a.orb.toFixed(1)}° {a.applying ? "applying" : "separating"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="nt-section">
          <header className="nt-section-header">
            <h2 className="nt-section-heading">
              {live ? "Upcoming" : "What came next"}
            </h2>
          </header>
          <ul className="ca-sky-events">
            {events.nextNew && (
              <li>
                <strong>New Moon:</strong> {events.nextNew}
              </li>
            )}
            {events.nextFull && (
              <li>
                <strong>Full Moon:</strong> {events.nextFull}
              </li>
            )}
          </ul>
        </section>

        <Footer />
      </div>
    </main>
  );
}
