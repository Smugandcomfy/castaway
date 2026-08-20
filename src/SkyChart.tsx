import { ZODIAC_ABBR } from "./orrery_core";

/// The sky as a wheel, drawn from where you are standing.
///
/// The splash orrery is the instrument: heliocentric, log-radii, seen from
/// above the solar system. This is its opposite and its sibling — geocentric,
/// the Earth at the centre because that is where the observer is, the zodiac
/// as a ring of twelve, the horizon drawn across it.
///
/// Orientation is the classical one: the Ascendant on the left, degrees
/// increasing counter-clockwise, which puts the Midheaven near the top and
/// everything below the horizon line genuinely below the horizon.
///
/// The frame is drawn inside the SVG as artwork rather than applied as a CSS
/// border, which is what keeps it inside the design system's rules.

const SIZE = 460;
const CX = SIZE / 2;
const CY = SIZE / 2;

const R_OUTER = 214; // zodiac ring, outer edge
const R_INNER = 182; // zodiac ring, inner edge
const R_BODY = 150; // where the bodies sit
const R_HUB = 34; // the Earth's disc

export interface ChartBody {
  key: string;
  /// Two or three letters. Glyphs are avoided deliberately: astrological
  /// symbols are missing from plenty of system fonts and the design system
  /// forbids loading one.
  abbr: string;
  label: string;
  lonDeg: number;
  retrograde: boolean;
  /// The luminaries are drawn a little larger, as they are on the dial.
  luminary?: boolean;
}

export interface SkyChartProps {
  bodies: readonly ChartBody[];
  ascDeg: number;
  mcDeg: number;
  /// Omitted when no place is chosen, in which case the horizon and meridian
  /// are not drawn and the wheel simply starts at 0° Aries on the left.
  placed: boolean;
  size?: number;
}

const RAD = Math.PI / 180;

/// Ecliptic longitude to a point on the wheel.
///
/// The Ascendant sits at 180° (screen left) and longitude increases
/// counter-clockwise from there, so the degree rising is on the horizon and
/// the degrees just past it are below it — which is what actually happens.
function at(lonDeg: number, ascDeg: number, radius: number): [number, number] {
  const theta = (180 + (lonDeg - ascDeg)) * RAD;
  return [CX + radius * Math.cos(theta), CY - radius * Math.sin(theta)];
}

/// Push apart bodies that would otherwise be drawn on top of each other.
/// Sorted by longitude, each body that lands within `minGap` of the previous
/// one is stepped inward a ring. Cheap, stable, and good enough for seven.
function withRings(
  bodies: readonly ChartBody[],
  minGap = 11,
): (ChartBody & { radius: number })[] {
  const sorted = [...bodies].sort((a, b) => a.lonDeg - b.lonDeg);
  const out: (ChartBody & { radius: number })[] = [];
  let ring = 0;
  for (let i = 0; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    if (prev) {
      const gap = sorted[i].lonDeg - prev.lonDeg;
      ring = gap < minGap ? ring + 1 : 0;
    }
    out.push({ ...sorted[i], radius: R_BODY - ring * 24 });
  }
  return out;
}

export function SkyChart({
  bodies,
  ascDeg,
  mcDeg,
  placed,
  size = SIZE,
}: SkyChartProps) {
  const placedBodies = withRings(bodies);

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="ca-skychart"
      style={{ width: size, maxWidth: "100%" }}
      role="img"
      aria-label="The sky as a wheel, seen from the chosen place"
    >
      {/* --- the zodiac ring ------------------------------------------ */}
      <circle
        cx={CX}
        cy={CY}
        r={R_OUTER}
        fill="none"
        stroke="var(--sf-accent)"
        strokeWidth={1.25}
        opacity={0.55}
      />
      <circle
        cx={CX}
        cy={CY}
        r={R_INNER}
        fill="none"
        stroke="var(--sf-accent)"
        strokeWidth={1}
        opacity={0.4}
      />

      {/* Twelve sectors, their cusps, and their names. */}
      {ZODIAC_ABBR.map((abbr, i) => {
        const start = i * 30;
        const [x1, y1] = at(start, ascDeg, R_INNER);
        const [x2, y2] = at(start, ascDeg, R_OUTER);
        const [tx, ty] = at(start + 15, ascDeg, (R_INNER + R_OUTER) / 2);
        return (
          <g key={abbr}>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="var(--sf-accent)"
              strokeWidth={0.75}
              opacity={0.45}
            />
            <text
              x={tx}
              y={ty}
              className="ca-skychart__sign"
              textAnchor="middle"
              dominantBaseline="central"
            >
              {abbr}
            </text>
          </g>
        );
      })}

      {/* Five-degree ticks inside the ring. */}
      {Array.from({ length: 72 }, (_, i) => {
        const lon = i * 5;
        const long = i % 6 === 0;
        const [x1, y1] = at(lon, ascDeg, R_INNER);
        const [x2, y2] = at(lon, ascDeg, R_INNER - (long ? 9 : 5));
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="var(--sf-grid)"
            strokeWidth={long ? 1 : 0.5}
          />
        );
      })}

      {/* --- the angles ----------------------------------------------- */}
      {placed && (
        <g>
          {/* Horizon: Ascendant on the left, Descendant opposite. Heavier
              than the meridian because it is the line the chart is built on. */}
          <line
            x1={CX - R_INNER}
            y1={CY}
            x2={CX + R_INNER}
            y2={CY}
            stroke="var(--sf-accent)"
            strokeWidth={1.75}
            opacity={0.8}
          />
          {(() => {
            const [mx, my] = at(mcDeg, ascDeg, R_INNER);
            const [ix, iy] = at(mcDeg + 180, ascDeg, R_INNER);
            return (
              <line
                x1={mx}
                y1={my}
                x2={ix}
                y2={iy}
                stroke="var(--sf-accent)"
                strokeWidth={1}
                opacity={0.55}
              />
            );
          })()}
          <text
            x={CX - R_INNER + 6}
            y={CY - 8}
            className="ca-skychart__angle"
            textAnchor="start"
          >
            ASC
          </text>
          {(() => {
            const [mx, my] = at(mcDeg, ascDeg, R_INNER - 14);
            return (
              <text
                x={mx}
                y={my}
                className="ca-skychart__angle"
                textAnchor="middle"
                dominantBaseline="central"
              >
                MC
              </text>
            );
          })()}
        </g>
      )}

      {/* --- the bodies ----------------------------------------------- */}
      {placedBodies.map((b) => {
        const [x, y] = at(b.lonDeg, ascDeg, b.radius);
        const [tickOuter] = [at(b.lonDeg, ascDeg, R_INNER)];
        return (
          <g key={b.key} className="ca-skychart__body">
            {/* A hair from the body out to the ring, so its degree is
                readable against the zodiac rather than floating. */}
            <line
              x1={x}
              y1={y}
              x2={tickOuter[0]}
              y2={tickOuter[1]}
              stroke="var(--sf-grid)"
              strokeWidth={0.5}
            />
            <circle
              cx={x}
              cy={y}
              r={b.luminary ? 13 : 11}
              className="ca-skychart__disc"
            />
            <text
              x={x}
              y={y}
              className="ca-skychart__abbr"
              textAnchor="middle"
              dominantBaseline="central"
            >
              {b.abbr}
            </text>
            {b.retrograde && (
              <text
                x={x + (b.luminary ? 14 : 12)}
                y={y - (b.luminary ? 10 : 8)}
                className="ca-skychart__retro"
                textAnchor="middle"
                dominantBaseline="central"
              >
                ℞
              </text>
            )}
          </g>
        );
      })}

      {/* --- the Earth ------------------------------------------------ */}
      <circle
        cx={CX}
        cy={CY}
        r={R_HUB}
        fill="none"
        stroke="var(--sf-accent)"
        strokeWidth={1}
        opacity={0.5}
      />
      <text
        x={CX}
        y={CY}
        className="ca-skychart__hub"
        textAnchor="middle"
        dominantBaseline="central"
      >
        EARTH
      </text>
    </svg>
  );
}
