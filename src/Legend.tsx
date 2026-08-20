import { HEXAGRAMS, KING_WEN } from "./kingwen";

/// All 64 hexagrams, in King Wen order.
///
/// Rendered from the same table the oracle names its answers from, which is
/// itself checked against `backend/oracle/Hexagrams.mo` — so the Legend can
/// never disagree with a reading.
///
/// The glyphs are Unicode U+4DC0–U+4DFF, allocated contiguously and in King
/// Wen order, so they are drawn as arithmetic rather than as an image or a
/// loaded font.

/// The eight trigrams, indexed by their 3-bit pattern: bit i is set when
/// line i (0 = bottom) is yang. So 0 is all yin and 7 is all yang.
const TRIGRAMS = [
  "Kun ☷",
  "Zhen ☳",
  "Kan ☵",
  "Dui ☱",
  "Gen ☶",
  "Li ☲",
  "Xun ☴",
  "Qian ☰",
] as const;

/// KING_WEN is indexed by the 6-bit line pattern, so walking it inverts it.
/// Bits 0–2 are the lower trigram and 3–5 the upper, which means the index is
/// exactly `upper * 8 + lower` — the trigram pair is arithmetic, not a second
/// table to keep in step.
const PATTERN_OF = new Map<number, number>(
  KING_WEN.map((n, pattern) => [n, pattern]),
);

function trigramsOf(n: number): { lower: string; upper: string } {
  const pattern = PATTERN_OF.get(n) ?? 0;
  return {
    lower: TRIGRAMS[pattern & 7],
    upper: TRIGRAMS[(pattern >> 3) & 7],
  };
}

export function Legend() {
  return (
    <div className="ca-faq ca-legend">
      <ol className="ca-legend-list">
        {HEXAGRAMS.map((h) => {
          const { lower, upper } = trigramsOf(h.n);
          return (
            <li key={h.n} className="ca-legend-row">
              <span className="ca-legend-glyph" aria-hidden="true">
                {h.glyph}
              </span>
              <span className="ca-legend-n">{h.n}</span>
              <span className="ca-legend-names">
                <span className="ca-legend-english">{h.english}</span>
                <span className="ca-legend-pinyin">{h.pinyin}</span>
              </span>
              <span className="ca-legend-trigrams">
                {upper} over {lower}
              </span>
            </li>
          );
        })}
      </ol>

      <section className="ca-faq-item">
        <p className="nt-muted">
          Six names appear twice — Qian, Kun, Bi, Lu, Yi and Jian — as they do
          in the tradition. The English readings are distinct for all
          sixty-four.
        </p>
      </section>
    </div>
  );
}
