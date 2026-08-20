// Cast Away — Orrery.tsx
// A brass orrery: the nine classical wanderers on their true orbits, Sun
// centered, viewed from the north ecliptic pole. Angles and orbit shapes are
// real (astronomy-engine, ±1′); radii are log-compressed so Mercury and Pluto
// share one dial; dot sizes are a symbolic hierarchy, not to scale.
//
// Display only — nothing here touches canister state or the reading flow.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PLANETS,
  allPlanetStates,
  orbitPathAU,
  formatZodiac,
  ZODIAC_ABBR,
  type PlanetKey,
  type PlanetState,
} from './orrery_core';
import {
  makeLogScale,
  polarToScreen,
  pointsToPath,
  labelAnchor,
  norm360,
} from './project';
import './orrery.css';

// --- dial geometry (viewBox units) -----------------------------------------
const VB = 640;
const CX = VB / 2;
const CY = VB / 2;
const MIN_AU = 0.3;
const MAX_AU = 49.5;
const INNER_PX = 46; // just outside the Sun's outer halo
const OUTER_PLAIN = 288;
const OUTER_ZODIAC = 262; // leave room for the engraved ring
const LABEL_GAP = 9;

export interface OrreryProps {
  /** Rendered width/height in CSS px. Default 480. */
  size?: number;
  /**
   * Freeze the sky at a fixed instant (deterministic renders, tests,
   * screenshots). When omitted the dial is live.
   */
  date?: Date;
  /** Live refresh cadence in ms. Default 60 000 — real motion is imperceptible faster than that. */
  refreshMs?: number;
  /** Planet name engravings. Default true. */
  showLabels?: boolean;
  /** Faint 12-sector zodiac ring with the 0° Aries index. Default false. */
  showZodiac?: boolean;
  /** 'panel' = interactive card; 'ambient' = dimmed, inert backdrop layer. */
  variant?: 'panel' | 'ambient';
  /**
   * Purely ornamental: no keyboard stops and no readout, but drawn exactly as
   * a panel is. Set this when the orrery sits inside an `aria-hidden` wrapper —
   * otherwise it hands a keyboard user nine tab-stops on elements screen
   * readers are told do not exist. `variant="ambient"` also removes them, but
   * dims the drawing to 45%, which is a visual decision rather than this one.
   */
  decorative?: boolean;
}

function utcStamp(d: Date): string {
  return d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
}

export default function Orrery({
  size = 480,
  date,
  refreshMs = 60_000,
  showLabels = true,
  showZodiac = false,
  variant = 'panel',
  decorative = false,
}: OrreryProps) {
  const live = date === undefined;
  const [now, setNow] = useState<Date>(() => date ?? new Date());
  const [orbitsReady, setOrbitsReady] = useState(false);
  const [active, setActive] = useState<PlanetKey | null>(null);
  const orbitAU = useRef<Map<PlanetKey, { x: number; y: number }[]> | null>(null);

  // Clock: tick every refreshMs, and re-sync immediately when the tab wakes,
  // so a backgrounded dial never shows a stale sky.
  useEffect(() => {
    if (!live) {
      setNow(date);
      return;
    }
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), Math.max(refreshMs, 1000));
    const wake = () => {
      if (document.visibilityState === 'visible') setNow(new Date());
    };
    document.addEventListener('visibilitychange', wake);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [live, date, refreshMs]);

  // Orbit shapes: ~860 ephemeris evaluations (Pluto's model is the heavy
  // one). Static at display precision, so: compute once, after first paint.
  useEffect(() => {
    const id = setTimeout(() => {
      const m = new Map<PlanetKey, { x: number; y: number }[]>();
      const center = date ?? new Date();
      for (const spec of PLANETS) m.set(spec.key, orbitPathAU(spec, center));
      orbitAU.current = m;
      setOrbitsReady(true);
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scale = useMemo(
    () => makeLogScale(MIN_AU, MAX_AU, INNER_PX, showZodiac ? OUTER_ZODIAC : OUTER_PLAIN),
    [showZodiac],
  );

  const states: PlanetState[] = useMemo(() => allPlanetStates(now), [now]);

  const orbitPaths = useMemo(() => {
    if (!orbitsReady || !orbitAU.current) return null;
    const out = new Map<PlanetKey, string>();
    for (const [key, pts] of orbitAU.current) {
      out.set(
        key,
        pointsToPath(
          pts.map((p) => {
            const elon = norm360((Math.atan2(p.y, p.x) * 180) / Math.PI);
            return polarToScreen(elon, scale(Math.hypot(p.x, p.y)), CX, CY);
          }),
        ),
      );
    }
    return out;
  }, [orbitsReady, scale]);

  const activeState = active ? states.find((s) => s.key === active) : undefined;
  const ambient = variant === 'ambient';
  // Both hide the orrery from assistive tech; only `ambient` changes how it looks.
  const inert = ambient || decorative;
  const ringR = OUTER_ZODIAC + 18;

  return (
    <div
      className={`orrery ${ambient ? 'orrery--ambient' : 'orrery--panel'}`}
      style={{ width: size }}
    >
      <svg
        className="orrery-svg"
        viewBox={`0 0 ${VB} ${VB}`}
        role="img"
        aria-label="Live heliocentric map of the solar system"
      >
        {showZodiac && (
          <g className="orrery-ring" aria-hidden="true">
            {ZODIAC_ABBR.map((abbr, i) => {
              const tick = polarToScreen(i * 30, ringR - 6, CX, CY);
              const tickOut = polarToScreen(i * 30, ringR + 2, CX, CY);
              const mid = polarToScreen(i * 30 + 15, ringR + 4, CX, CY);
              return (
                <g key={abbr}>
                  <line x1={tick.x} y1={tick.y} x2={tickOut.x} y2={tickOut.y} />
                  <text x={mid.x} y={mid.y} textAnchor="middle" dominantBaseline="middle">
                    {abbr}
                  </text>
                </g>
              );
            })}
            {/* First Point of Aries — the dial's fiducial index */}
            <text
              className="orrery-fiducial"
              x={polarToScreen(0, ringR - 22, CX, CY).x}
              y={polarToScreen(0, ringR - 22, CX, CY).y}
              textAnchor="end"
              dominantBaseline="middle"
            >
              0&#176;
            </text>
          </g>
        )}

        {orbitPaths && (
          <g className="orrery-orbits" aria-hidden="true">
            {PLANETS.map((p) => (
              <path key={p.key} d={orbitPaths.get(p.key) ?? ''} />
            ))}
          </g>
        )}

        <g className="orrery-sun">
          <circle cx={CX} cy={CY} r={40} className="orrery-sun-halo2" />
          <circle cx={CX} cy={CY} r={26} className="orrery-sun-halo1" />
          <circle cx={CX} cy={CY} r={15} className="orrery-sun-core">
            <title>Sun</title>
          </circle>
        </g>

        {states.map((s) => {
          const spec = PLANETS.find((p) => p.key === s.key)!;
          const rPx = scale(s.rAU);
          const pos = polarToScreen(s.elonDeg, rPx, CX, CY);
          const lab = polarToScreen(s.elonDeg, rPx + spec.dotR + LABEL_GAP, CX, CY);
          return (
            <g
              key={s.key}
              className={`orrery-planet orrery-planet--${s.key}${
                active === s.key ? ' is-active' : ''
              }`}
              tabIndex={inert ? -1 : 0}
              aria-label={`${s.label}, heliocentric longitude ${s.elonDeg.toFixed(1)} degrees, ${s.rAU.toFixed(2)} astronomical units from the Sun`}
              onMouseEnter={() => setActive(s.key)}
              onMouseLeave={() => setActive((k) => (k === s.key ? null : k))}
              onFocus={() => setActive(s.key)}
              onBlur={() => setActive((k) => (k === s.key ? null : k))}
            >
              <title>{`${s.label} · ${formatZodiac(s.elonDeg)} (helio)`}</title>
              {spec.kind === 'ringed' && (
                <ellipse
                  className="orrery-saturn-ring"
                  cx={pos.x}
                  cy={pos.y}
                  rx={spec.dotR * 2.1}
                  ry={spec.dotR * 0.8}
                  transform={`rotate(-20 ${pos.x} ${pos.y})`}
                />
              )}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={spec.dotR}
                className={spec.kind === 'hollow' ? 'orrery-dot--hollow' : 'orrery-dot'}
              />
              {showLabels && !ambient && (
                <text
                  className="orrery-label"
                  x={lab.x}
                  y={lab.y}
                  textAnchor={labelAnchor(s.elonDeg)}
                  dominantBaseline="middle"
                >
                  {s.label.toUpperCase()}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {!inert && (
        <div className="orrery-readout">
          <span className="orrery-readout-body">
            {activeState
              ? `${activeState.label.toUpperCase()} · helio ${activeState.elonDeg.toFixed(1)}° · ${formatZodiac(activeState.elonDeg)} · ${activeState.rAU.toFixed(3)} AU`
              : 'Select a wanderer'}
          </span>
          <span className="orrery-readout-time">
            {`${live ? 'LIVE' : 'FIXED'} · ${utcStamp(now)}`}
          </span>
        </div>
      )}
    </div>
  );
}
