import type { DrawnCard, Suit } from "./tarot";
import { SUIT_ELEMENT } from "./tarot";

/// The deck draws itself.
///
/// No image assets: the design system forbids remote resources, and 78 raster
/// cards would be tens of megabytes in the package. Instead a card's identity
/// selects its geometry -- suit picks the glyph and colour, rank picks how many
/// glyphs and where, majors get a composed sigil. Deterministic, so everyone
/// installing this app sees the same deck. That is what makes it a deck rather
/// than noise.
///
/// Colours reference the app's token overrides, so the cards restyle with the
/// rest of the tile.

const W = 160;
const H = 250;
const CX = W / 2;

const SUIT_COLOR: Record<Suit, string> = {
  wands: "var(--sf-accent)",
  cups: "var(--sf-jade)",
  swords: "var(--sf-steel)",
  pentacles: "var(--sf-bone)",
};

// ---------------------------------------------------------------- suit marks

function SuitGlyph({ suit, x, y, s = 1 }: { suit: Suit; x: number; y: number; s?: number }) {
  const fill = SUIT_COLOR[suit];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={fill}>
      {suit === "wands" && (
        <>
          <rect x={-1.6} y={-11} width={3.2} height={22} rx={1.4} />
          <circle cx={0} cy={-13} r={3.2} />
        </>
      )}
      {suit === "cups" && (
        <>
          <path d="M-8 -9 L8 -9 Q8 1 0 3 Q-8 1 -8 -9 Z" />
          <rect x={-1.4} y={3} width={2.8} height={6} />
          <rect x={-6} y={9} width={12} height={2.2} rx={1} />
        </>
      )}
      {suit === "swords" && (
        <>
          <path d="M0 -13 L3 -8 L3 7 L-3 7 L-3 -8 Z" />
          <rect x={-7} y={7} width={14} height={2.4} rx={1.2} />
          <rect x={-1.3} y={9.4} width={2.6} height={5} />
        </>
      )}
      {suit === "pentacles" && (
        <>
          <circle cx={0} cy={0} r={10} fill="none" stroke={fill} strokeWidth={1.6} />
          <path
            d="M0 -7 L1.6 -2.2 L6.7 -2.2 L2.6 0.8 L4.1 5.7 L0 2.6 L-4.1 5.7 L-2.6 0.8 L-6.7 -2.2 L-1.6 -2.2 Z"
            fill={fill}
          />
        </>
      )}
    </g>
  );
}

/// Pip layouts, hand-placed for every rank that exists.
///
/// Earlier this only covered one through six and fell back to paired rows for
/// seven upward, which put the odd card *below* the shape instead of inside it
/// -- it read as a mistake rather than a composition. Traditional decks nest the
/// odd card in the centre column, so that is what these do. The programmatic
/// branch now only runs if someone invents an eleventh pip rank.
function pipLayout(n: number): [number, number][] {
  const L = 54;
  const R = 106;
  const fixed: Record<number, [number, number][]> = {
    1: [[CX, 125]],
    2: [[CX, 95], [CX, 155]],
    3: [[CX, 82], [CX, 125], [CX, 168]],
    4: [[L, 98], [R, 98], [L, 152], [R, 152]],
    5: [[L, 92], [R, 92], [CX, 125], [L, 158], [R, 158]],
    6: [[L, 85], [R, 85], [L, 125], [R, 125], [L, 165], [R, 165]],
    7: [[L, 80], [R, 80], [CX, 102], [L, 125], [R, 125], [L, 170], [R, 170]],
    8: [[L, 80], [R, 80], [L, 110], [R, 110], [L, 140], [R, 140], [L, 170], [R, 170]],
    9: [[L, 78], [R, 78], [L, 112], [R, 112], [CX, 129], [L, 146], [R, 146], [L, 180], [R, 180]],
    10: [[L, 78], [R, 78], [CX, 94], [L, 110], [R, 110], [L, 142], [R, 142], [CX, 158], [L, 174], [R, 174]],
  };
  if (fixed[n]) return fixed[n];

  const pairs = Math.floor(n / 2);
  const odd = n % 2 === 1;
  const top = 78;
  const span = odd ? 88 : 100;
  const step = span / Math.max(pairs - 1, 1);
  const out: [number, number][] = [];
  for (let i = 0; i < pairs; i++) {
    const y = top + i * step;
    out.push([L, y], [R, y]);
  }
  if (odd) out.push([CX, top + span + 22]);
  return out;
}

// ------------------------------------------------------------- major sigils

type Form = "star" | "disc" | "column" | "arc" | "cross" | "wheel" | "vessel" | "gate" | "blade";

/// Each major gets a form and a count. Hand-assigned so the association means
/// something -- the Wheel turns, the Tower is a broken column, the Star is a
/// star -- but drawn from a shared vocabulary so all 22 look like one deck.
const SIGIL: [Form, number][] = [
  ["arc", 1], ["column", 2], ["gate", 2], ["vessel", 3], ["cross", 4],
  ["column", 3], ["arc", 2], ["wheel", 6], ["disc", 3], ["star", 1],
  ["wheel", 8], ["cross", 2], ["gate", 1], ["blade", 1], ["vessel", 2],
  ["cross", 5], ["column", 1], ["star", 8], ["disc", 2], ["star", 12],
  ["arc", 3], ["wheel", 4],
];

function Sigil({ major }: { major: number }) {
  const [form, n] = SIGIL[major] ?? ["disc", 3];
  const c = "var(--sf-accent)";
  const y = 122;

  switch (form) {
    case "star": {
      const pts: string[] = [];
      const spikes = Math.max(n, 4);
      for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? 44 : 16;
        const a = (Math.PI * i) / spikes - Math.PI / 2;
        pts.push(`${(CX + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`);
      }
      return <polygon points={pts.join(" ")} fill={c} />;
    }
    case "disc":
      return (
        <g>
          <circle cx={CX} cy={y} r={40} fill={c} />
          {Array.from({ length: n }, (_, i) => (
            <circle key={i} cx={CX} cy={y} r={40 - (i + 1) * 9} fill="var(--sf-bg)" />
          ))}
          <circle cx={CX} cy={y} r={5} fill={c} />
        </g>
      );
    case "column":
      return (
        <g fill={c}>
          {Array.from({ length: n }, (_, i) => (
            <rect key={i} x={CX - 26 + i * (52 / n)} y={y - 44} width={10} height={88} rx={2} />
          ))}
          <rect x={CX - 34} y={y + 44} width={68} height={5} rx={2} />
        </g>
      );
    case "arc":
      return (
        <g fill="none" stroke={c} strokeWidth={4} strokeLinecap="round">
          {Array.from({ length: n }, (_, i) => (
            <path key={i} d={`M${CX - 40} ${y + 20 - i * 16} A 40 40 0 0 1 ${CX + 40} ${y + 20 - i * 16}`} />
          ))}
        </g>
      );
    case "cross":
      return (
        <g fill={c}>
          <rect x={CX - 4} y={y - 46} width={8} height={92} rx={2} />
          <rect x={CX - 32} y={y - 12} width={64} height={8} rx={2} />
          {Array.from({ length: Math.max(n - 2, 0) }, (_, i) => (
            <circle key={i} cx={CX - 24 + i * 12} cy={y + 34} r={3} fill="var(--sf-jade)" />
          ))}
        </g>
      );
    case "wheel":
      return (
        <g>
          <circle cx={CX} cy={y} r={42} fill="none" stroke={c} strokeWidth={4} />
          {Array.from({ length: n }, (_, i) => {
            const a = (Math.PI * 2 * i) / n;
            return (
              <line
                key={i}
                x1={CX}
                y1={y}
                x2={CX + 42 * Math.cos(a)}
                y2={y + 42 * Math.sin(a)}
                stroke={c}
                strokeWidth={2}
              />
            );
          })}
          <circle cx={CX} cy={y} r={6} fill={c} />
        </g>
      );
    case "vessel":
      return (
        <g fill={c}>
          <path d={`M${CX - 30} ${y - 34} L${CX + 30} ${y - 34} Q${CX + 30} ${y + 12} ${CX} ${y + 18} Q${CX - 30} ${y + 12} ${CX - 30} ${y - 34} Z`} />
          <rect x={CX - 4} y={y + 18} width={8} height={20} />
          <rect x={CX - 22} y={y + 38} width={44} height={6} rx={2} />
          {Array.from({ length: n }, (_, i) => (
            <circle key={i} cx={CX - 12 + i * 12} cy={y - 48} r={3} fill="var(--sf-jade)" />
          ))}
        </g>
      );
    case "gate":
      return (
        <g fill="none" stroke={c} strokeWidth={5}>
          <path d={`M${CX - 32} ${y + 46} L${CX - 32} ${y - 14} A 32 32 0 0 1 ${CX + 32} ${y - 14} L${CX + 32} ${y + 46}`} />
          {n > 1 && <line x1={CX} y1={y - 44} x2={CX} y2={y + 46} strokeWidth={3} />}
        </g>
      );
    case "blade":
      return (
        <g fill={c}>
          <path d={`M${CX} ${y - 50} L${CX + 7} ${y - 32} L${CX + 7} ${y + 30} L${CX - 7} ${y + 30} L${CX - 7} ${y - 32} Z`} />
          <rect x={CX - 24} y={y + 30} width={48} height={6} rx={2} />
          <rect x={CX - 4} y={y + 36} width={8} height={16} />
        </g>
      );
    default:
      // Unreachable for the 22 authored majors; here so adding a form to the
      // union without a case degrades to a mark rather than rendering nothing.
      return <circle cx={CX} cy={y} r={30} fill="none" stroke={c} strokeWidth={4} />;
  }
}

// -------------------------------------------------------------------- card

export function TarotCard({ drawn }: { drawn: DrawnCard }) {
  const { card, reversed, position } = drawn;
  const corner =
    card.kind === "major"
      ? toRoman(card.major!)
      : card.rank! <= 10
        ? String(card.rank)
        : ["Pg", "Kt", "Qn", "Kg"][card.rank! - 11];

  const courtRank = card.kind === "minor" && card.rank! > 10 ? card.rank! - 10 : 0;

  return (
    <figure className="sf-card">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="sf-card__art"
        role="img"
        aria-label={`${card.label}${reversed ? ", reversed" : ""}`}
      >
        <rect
          x={1}
          y={1}
          width={W - 2}
          height={H - 2}
          rx={4}
          fill="var(--sf-bg-card)"
          stroke="var(--sf-accent)"
          strokeWidth={1}
        />
        <text x={12} y={22} className="sf-card__corner">
          {corner}
        </text>

        {/* Reversal is a real rotation of the art, which is what the word means. */}
        <g transform={reversed ? `rotate(180 ${CX} 125)` : undefined}>
          {card.kind === "major" ? (
            <Sigil major={card.major!} />
          ) : courtRank > 0 ? (
            <g>
              <SuitGlyph suit={card.suit!} x={CX} y={132} s={2.1} />
              {Array.from({ length: courtRank }, (_, i) => (
                <path
                  key={i}
                  d={`M${CX - 15} ${74 + i * 9} L${CX} ${66 + i * 9} L${CX + 15} ${74 + i * 9}`}
                  fill="none"
                  stroke="var(--sf-accent)"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                />
              ))}
            </g>
          ) : (
            <g>
              {pipLayout(card.rank!).map(([x, y], i) => (
                <SuitGlyph key={i} suit={card.suit!} x={x} y={y} s={0.82} />
              ))}
            </g>
          )}
        </g>
      </svg>

      <figcaption className="sf-card__caption">
        <span className="sf-card__position">{position}</span>
        <strong className="sf-card__name">{card.label}</strong>
        <span className="sf-card__meta">
          {card.kind === "major" ? "major arcana" : SUIT_ELEMENT[card.suit!]}
          {reversed ? " · reversed" : ""}
        </span>
      </figcaption>
    </figure>
  );
}

function toRoman(n: number): string {
  if (n === 0) return "0";
  const table: [number, string][] = [
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "";
  let v = n;
  for (const [value, sym] of table) {
    while (v >= value) {
      out += sym;
      v -= value;
    }
  }
  return out;
}
