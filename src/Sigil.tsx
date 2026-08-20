import { useId, useMemo } from "react";
import {
  kamea,
  trace,
  traceWithCards,
  presidingKamea,
  type TracedCard,
} from "./sigil_core";
import {
  conditionLine,
  planetKeyOf,
  presidingCondition,
} from "./presiding";
import { formatMansionAt } from "./mansions";

/// The kamea traced. The grid stays faint; the path is what you look at.
///
/// Displayed inside a circle — corners of the grid clip away for the
/// classic occult-sigil look, and a faint circular frame is drawn in the
/// same accent. The path itself is not clipped, so a sigil that reaches
/// into what were the grid's corners still shows fully.

const SIZE = 220;
const PAD = 18;

export function Sigil({
  phrase,
  movingLines,
  castTimestamp,
  cards,
  kameaOrder,
  stampAt,
  showGrid = true,
}: {
  phrase: string;
  /// The cast's moving-line count (0-6). Same value the verdict tier reads.
  /// Elects the presiding planet: 0 -> Saturn (3x3) ... 6 -> Luna (9x9).
  movingLines: number;
  /// If present, the presiding planet's geocentric condition at this instant
  /// is annotated beneath the sigil ("retrograde in Pisces"). Recomputed
  /// from the timestamp — never stored. Omit on the standalone Sigil page.
  castTimestamp?: Date;
  /// The sealed tarot pull, when there is one. Each card adds a final cell to
  /// the traced path, so a full cast's sigil holds the question *and* the
  /// cards. Omitted on the standalone Sigil page, where there is no pull and
  /// the figure is the phrase alone.
  cards?: readonly TracedCard[];
  /// The square to trace on, when one has already been elected and recorded.
  /// A sealed cast stores its own order, so the artifact can never be redrawn
  /// differently by a later change to the election rule. Without it the square
  /// falls back to the moving-line count alone, which is what the standalone
  /// Sigil page wants.
  kameaOrder?: number;
  /// The moment the artifact was *made* — a seal's `sealedAt`, a standalone
  /// sigil's `madeAt` — which is stamped with the Mansion of the Moon it was
  /// made under. In the tradition mansions elect the time of the operation,
  /// so this is the making, not the cast: a question asked on Monday and
  /// sealed on Wednesday carries Wednesday's mansion, and the square it is
  /// traced on still comes from Monday's Moon. Annotation only — it feeds
  /// nothing.
  stampAt?: Date;
  showGrid?: boolean;
}) {
  const k = kameaOrder ? kamea(kameaOrder) : presidingKamea(movingLines);
  const order = k.order;
  const { points } =
    cards && cards.length > 0
      ? traceWithCards(phrase, order, cards)
      : trace(phrase, order);
  const condition = useMemo(
    () =>
      castTimestamp
        ? presidingCondition(planetKeyOf(k.planet), castTimestamp)
        : null,
    [castTimestamp, k.planet],
  );
  const rawId = useId();
  const clipId = `sigil-clip-${rawId.replace(/[^a-zA-Z0-9-]/g, "")}`;

  const cell = (SIZE - PAD * 2) / order;
  const at = (c: number, r: number): [number, number] => [
    PAD + c * cell + cell / 2,
    PAD + r * cell + cell / 2,
  ];

  const path = points.map(([c, r]) => at(c, r));
  const d = path.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");

  const start = path[0];
  const end = path[path.length - 1];

  // The terminal bar sits square across the final leg, as it is drawn by hand.
  let bar = null;
  if (path.length > 1 && end) {
    const [px, py] = path[path.length - 2] as [number, number]; // guarded by length > 1
    const [ex, ey] = end;
    const dx = ex - px;
    const dy = ey - py;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * 7;
    const ny = (dx / len) * 7;
    bar = (
      <line
        x1={ex + nx}
        y1={ey + ny}
        x2={ex - nx}
        y2={ey - ny}
        stroke="var(--sf-accent)"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    );
  }

  // The circle inscribed in the grid area — cuts off the grid's corners.
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const circleR = (SIZE - PAD * 2) / 2;

  return (
    <figure className="sf-sigil">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="sf-sigil__art"
        role="img"
        aria-label={
          cards && cards.length > 0
            ? `Sigil of the question and its ${cards.length} cards, traced on the ${k.planet} square`
            : `Sigil of the question traced on the ${k.planet} square`
        }
      >
        <defs>
          <clipPath id={clipId}>
            <circle cx={cx} cy={cy} r={circleR} />
          </clipPath>
        </defs>

        {/* Faint circular frame — replaces the visual role of a square border */}
        <circle
          cx={cx}
          cy={cy}
          r={circleR}
          fill="none"
          stroke="var(--sf-accent)"
          strokeWidth={1.25}
          opacity={0.55}
        />

        {/* Grid, clipped to the circle so the corners fall away */}
        {showGrid && (
          <g clipPath={`url(#${clipId})`} stroke="var(--sf-grid)" strokeWidth={0.5}>
            {Array.from({ length: order + 1 }, (_, i) => (
              <line
                key={`h${i}`}
                x1={PAD}
                y1={PAD + i * cell}
                x2={PAD + order * cell}
                y2={PAD + i * cell}
              />
            ))}
            {Array.from({ length: order + 1 }, (_, i) => (
              <line
                key={`v${i}`}
                x1={PAD + i * cell}
                y1={PAD}
                x2={PAD + i * cell}
                y2={PAD + order * cell}
              />
            ))}
          </g>
        )}

        {/* The traced path itself — NOT clipped, so a sigil into a corner cell
            still reads fully. */}
        {path.length > 1 && (
          <path
            d={d}
            fill="none"
            stroke="var(--sf-accent)"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {start && (
          <circle
            cx={start[0]}
            cy={start[1]}
            r={5}
            fill="none"
            stroke="var(--sf-accent)"
            strokeWidth={2.5}
          />
        )}
        {bar}
      </svg>
      <figcaption className="sf-sigil__caption">
        <div className="ca-sigil-presiding">
          Under {k.planet}
          {condition && (
            <span className="ca-sigil-condition">
              {" · "}
              {conditionLine(condition)}
            </span>
          )}
        </div>
        <span className="nt-meta ca-sigil-detail">
          {order}×{order} · constant {k.constant}
        </span>
        {stampAt && (
          <span className="ca-sigil-mansion">{formatMansionAt(stampAt)}</span>
        )}
      </figcaption>
    </figure>
  );
}
