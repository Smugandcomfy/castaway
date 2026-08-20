/// Sigil math, the Golden Dawn / Agrippa way.
///
/// Each planet owns a magic square -- a kamea. A phrase is reduced to numbers,
/// each number is located on the grid, and the cells are joined by a line.
/// Circle marks where the path begins, a bar marks where it ends. The path is
/// the sigil.
///
/// Two notes on provenance, since this gets muddled constantly. Striking
/// repeated letters from a statement of intent and recombining them into a
/// glyph is Austin Osman Spare's method, from The Book of Pleasure (1913), not
/// Crowley's. The kamea tracing here is the older Golden Dawn practice
/// descending from Agrippa. Traditionally the letters are Hebrew and the values
/// are gematria; what follows is a modern Latin adaptation, which is what every
/// contemporary implementation does, but it is an adaptation rather than the
/// historical procedure.
///
/// The squares are generated rather than transcribed. That means they are
/// verifiably magic -- every row, column and both diagonals sum to the constant
/// -- though their orientation will not always match the specific historical
/// engravings, which differ by rotation and reflection anyway.

export interface Kamea {
  order: number;
  planet: string;
  grid: number[][];
  constant: number;
}

export const PLANETS: Record<number, string> = {
  3: "Saturn",
  4: "Jupiter",
  5: "Mars",
  6: "Sol",
  7: "Venus",
  8: "Mercury",
  9: "Luna",
};

/// Grid access, with the invariant stated once.
///
/// Every square in this file is built `n × n` and every index into it comes
/// from a loop bounded by the same `n`, so the cell always exists.
/// `noUncheckedIndexedAccess` cannot see that, and scattering `!` through the
/// arithmetic would bury the one place it might genuinely matter. These two say
/// it deliberately instead.
const row = (g: number[][], r: number): number[] => g[r] as number[];
const cell = (g: number[][], r: number, c: number): number =>
  (g[r] as number[])[c] as number;

/// De la Loubère's Siamese method.
function oddSquare(n: number): number[][] {
  const g = Array.from({ length: n }, () => new Array(n).fill(0));
  let r = 0;
  let c = (n - 1) / 2;
  for (let k = 1; k <= n * n; k++) {
    row(g, r)[c] = k;
    const nr = (r - 1 + n) % n;
    const nc = (c + 1) % n;
    if (cell(g, nr, nc)) r = (r + 1) % n;
    else {
      r = nr;
      c = nc;
    }
  }
  return g;
}

/// Doubly even: fill in order, then complement the cells on the diagonal
/// pattern of each 4x4 block.
function doublyEvenSquare(n: number): number[][] {
  const g = Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => r * n + c + 1),
  );
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const rEdge = r % 4 === 0 || r % 4 === 3;
      const cEdge = c % 4 === 0 || c % 4 === 3;
      if (rEdge === cEdge) row(g, r)[c] = n * n + 1 - cell(g, r, c);
    }
  }
  return g;
}

/// Singly even (only 6 here): LUX method over an odd sub-square.
function singlyEvenSquare(n: number): number[][] {
  const h = n / 2;
  const sub = oddSquare(h);
  const g = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let r = 0; r < h; r++) {
    for (let c = 0; c < h; c++) {
      const v = cell(sub, r, c);
      row(g, r)[c] = 4 * v - 3;
      row(g, r)[c + h] = 4 * v - 1;
      row(g, r + h)[c] = 4 * v;
      row(g, r + h)[c + h] = 4 * v - 2;
    }
  }

  const k = (n - 2) / 4;
  for (let r = 0; r < h; r++) {
    const cols: number[] = [];
    const start = r === Math.floor(h / 2) ? 1 : 0;
    for (let c = start; c < start + k; c++) cols.push(c);
    for (let c = n - k + 1; c < n; c++) cols.push(c);
    for (const c of cols) {
      const t = cell(g, r, c);
      row(g, r)[c] = cell(g, r + h, c);
      row(g, r + h)[c] = t;
    }
  }
  return g;
}

/// Saturn (3x3) and Jupiter (4x4) — taken verbatim from Agrippa's Three
/// Books of Occult Philosophy (Book II). Not generated: the generators would
/// produce a symmetry variant, and for these two squares we prefer the
/// canonical historical orientation (they have no in-app history yet).
const SATURN_GRID: readonly (readonly number[])[] = [
  [4, 9, 2],
  [3, 5, 7],
  [8, 1, 6],
];

const JUPITER_GRID: readonly (readonly number[])[] = [
  [4, 14, 15, 1],
  [9, 7, 6, 12],
  [5, 11, 10, 8],
  [16, 2, 3, 13],
];

const cache = new Map<number, Kamea>();

export function kamea(order: number): Kamea {
  const hit = cache.get(order);
  if (hit) return hit;

  // Saturn and Jupiter come from Agrippa verbatim; larger squares are
  // generated with methods that are algorithmically magic but may sit at
  // a symmetry of the historical figure.
  const grid =
    order === 3
      ? SATURN_GRID.map((row) => [...row])
      : order === 4
        ? JUPITER_GRID.map((row) => [...row])
        : order % 2 === 1
          ? oddSquare(order)
          : order % 4 === 0
            ? doublyEvenSquare(order)
            : singlyEvenSquare(order);

  const built: Kamea = {
    order,
    planet: PLANETS[order] ?? `Order ${order}`,
    grid,
    constant: (order * (order * order + 1)) / 2,
  };
  cache.set(order, built);
  return built;
}

/// The election: the cast's moving-line count picks a presiding planet in
/// Chaldean order (slowest to fastest = 3x3 Saturn to 9x9 Luna). Grid size
/// n = movingLines + 3. Total over 0-6; throws outside it.
///
/// Both scales measure the same thing: rate of change. A cast with no moving
/// lines is settled and gets Saturn's stark 3x3; a cast entirely in motion
/// gets Luna's 9x9 with the most room for the path to wander.
///
/// This function is the ONLY selector wired into rendering. The King Wen
/// number does not participate — the coins alone elect.
export function presidingKamea(movingLines: number): Kamea {
  if (
    !Number.isInteger(movingLines) ||
    movingLines < 0 ||
    movingLines > 6
  ) {
    throw new Error(
      `presidingKamea: movingLines must be an integer 0-6, got ${movingLines}`,
    );
  }
  return kamea(movingLines + 3);
}

/// The Chaldean order: the seven planets by decreasing orbital period, which
/// is *also*, exactly, the order of their magic squares — Saturn's is 3×3 and
/// Luna's is 9×9. So `kamea(chaldeanIndex + 3)` is the entire mapping, and
/// `presidingKamea` has always quietly been "start at Saturn and step by the
/// moving-line count."
export const CHALDEAN = [
  "Saturn",
  "Jupiter",
  "Mars",
  "Sol",
  "Venus",
  "Mercury",
  "Luna",
] as const;

/// Traditional rulerships — the seven-planet scheme, from before the outer
/// planets were discovered and given signs of their own. Indexed by sign
/// (0 = Aries … 11 = Pisces), valued as a position in the Chaldean order.
export const SIGN_RULER: readonly number[] = [
  2, // Aries — Mars
  4, // Taurus — Venus
  5, // Gemini — Mercury
  6, // Cancer — Luna
  3, // Leo — Sol
  5, // Virgo — Mercury
  4, // Libra — Venus
  2, // Scorpio — Mars
  1, // Sagittarius — Jupiter
  0, // Capricorn — Saturn
  0, // Aquarius — Saturn
  1, // Pisces — Jupiter
];

/// The square a *cast* is traced on: the sky chooses where to start, the cast
/// chooses how far to walk.
///
/// The sign the Moon stood in at the moment of the cast has a traditional
/// ruling planet; the cast's moving-line count steps that many places along
/// the Chaldean order. Both causes survive — which is the point. The sky is
/// not decoration on the sigil, it is half of why the sigil looks as it does.
///
/// This replaces starting from Saturn every time. That rule was correct but
/// brutally lopsided: because moving lines are rare, `ELECTION_COUNTS_8POW6`
/// puts Luna at one cast in four thousand and Mercury at one in two hundred,
/// so five of the seven squares were effectively unreachable. Starting from a
/// ruler that itself moves spreads the election across all seven. The measured
/// distribution is in `sigil_core.test.ts`.
export function electedOrder(
  movingLines: number,
  moonSignIndex: number,
): number {
  if (!Number.isInteger(movingLines) || movingLines < 0 || movingLines > 6) {
    throw new Error(
      `electedOrder: movingLines must be an integer 0-6, got ${movingLines}`,
    );
  }
  if (
    !Number.isInteger(moonSignIndex) ||
    moonSignIndex < 0 ||
    moonSignIndex > 11
  ) {
    throw new Error(
      `electedOrder: moonSignIndex must be an integer 0-11, got ${moonSignIndex}`,
    );
  }
  // Validated as an integer 0-11 immediately above, and SIGN_RULER has twelve.
  return (((SIGN_RULER[moonSignIndex] as number) + movingLines) % 7) + 3;
}

export function castKamea(movingLines: number, moonSignIndex: number): Kamea {
  return kamea(electedOrder(movingLines, moonSignIndex));
}

/// Exact presiding-planet distribution over the 262,144-sequence enumeration
/// (equivalently C(6,k)·2^k·6^(6-k)). Verified by the T2 test; exposed here
/// so any curious consumer can inspect the ground truth without recomputing.
export const ELECTION_COUNTS_8POW6 = [
  46656, 93312, 77760, 34560, 8640, 1152, 64,
] as const;

export interface SigilPath {
  kamea: Kamea;
  /// Grid coordinates in visiting order, [col, row].
  points: [number, number][];
  values: number[];
}

/// Letters to numbers, then numbers to cells.
///
/// Two traditions, each doing what it is good at. First Spare's reduction:
/// strike every repeated letter, keeping first occurrences in order. Then the
/// Golden Dawn tracing: A=1..Z=26 folded onto 1..n², located on the kamea,
/// joined in sequence.
///
/// The reduction is not decoration. Tracing a whole sentence revisits cells
/// constantly and the path degenerates into scribble; striking repeats leaves
/// at most twenty-six unique letters, which on these squares means one cell
/// each and a clean, sparse glyph -- much closer to how a real sigil looks.
/// Non-letters are dropped, since the procedure sigilises names, not
/// punctuation.
export function trace(phrase: string, order: number): SigilPath {
  const k = kamea(order);
  const max = order * order;

  const seen = new Set<string>();
  const values: number[] = [];
  for (const ch of phrase.toUpperCase()) {
    const code = ch.charCodeAt(0);
    if (code < 65 || code > 90) continue;
    if (seen.has(ch)) continue; // Spare: repeated letters are struck
    seen.add(ch);
    const value = ((code - 64 - 1) % max) + 1;
    if (values.length === 0 || values[values.length - 1] !== value) {
      values.push(value);
    }
  }

  // Where each number sits on the grid.
  const at = new Map<number, [number, number]>();
  for (let r = 0; r < order; r++) {
    for (let c = 0; c < order; c++) at.set(cell(k.grid, r, c), [c, r]);
  }

  const points = values.map((v) => at.get(v)!).filter(Boolean);
  return { kamea: k, points, values };
}

/// One card as the sigil needs it: where it sits in the deck, and which way
/// up it landed. Structural on purpose — this module knows nothing of the
/// tarot, and the tarot knows nothing of sigils.
export interface TracedCard {
  /// 0-77, the card's stable deck position.
  index: number;
  reversed: boolean;
}

/// The full cast's sigil: the question's figure, then the three cards.
///
/// The question traces exactly as `trace` does. Each drawn card then appends
/// one further cell, in the order the cards were laid: the card's deck index
/// folded onto 1..n² the same way a letter's ordinal is. A reversed card
/// contributes the complement of that cell, n² + 1 - v, so a card lying
/// backwards lands on the mirrored square and the figure turns back on
/// itself.
///
/// Cells rather than letters, and the reason is measured. Spare's reduction
/// strikes repeated letters across the whole phrase, so a long question has
/// already spent the alphabet: appending the cards' *names* changes nothing
/// at all for roughly two thirds of questions past about 130 characters, and
/// the effect shrinks steadily before that. A rule that quietly stops
/// applying to the most considered questions is not a rule. Cells are always
/// free to be visited, so three cards always draw three more cells.
///
/// Consecutive repeats collapse, exactly as they do for letters — a card that
/// lands where the path already stands adds no visible leg.
export function traceWithCards(
  phrase: string,
  order: number,
  cards: readonly TracedCard[],
): SigilPath {
  const base = trace(phrase, order);
  const max = order * order;

  const values = [...base.values];
  for (const card of cards) {
    const v = (card.index % max) + 1;
    const value = card.reversed ? max + 1 - v : v;
    if (values.length === 0 || values[values.length - 1] !== value) {
      values.push(value);
    }
  }

  const at = new Map<number, [number, number]>();
  for (let r = 0; r < order; r++) {
    for (let c = 0; c < order; c++) at.set(cell(base.kamea.grid, r, c), [c, r]);
  }

  const points = values.map((v) => at.get(v)!).filter(Boolean);
  return { kamea: base.kamea, points, values };
}
