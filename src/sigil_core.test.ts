import { describe, expect, test } from "bun:test";
import {
  kamea,
  presidingKamea,
  trace,
  traceWithCards,
  castKamea,
  electedOrder,
  SIGN_RULER,
  ELECTION_COUNTS_8POW6,
} from "./sigil_core";

/// Tests for the presiding-planet election feature.
///
/// T1 (verdict neutrality) lives on the Motoko backend, where the verdict
/// is actually computed. Frontend-side, the guarantee is structural: the
/// verdict never comes near sigil_core. This suite intentionally imports
/// only sigil_core, and neither sigil_core nor Sigil.tsx imports anything
/// verdict-related — the verdict arrives whole from the canister via
/// `reading.tier` and is displayed by AppTile without transformation.

// ============================================================ T3 · seven magic squares

describe("T3 · magic squares", () => {
  test("all seven kameas are permutations of 1..n² and magic", () => {
    for (let n = 3; n <= 9; n++) {
      const k = kamea(n);
      const cells = k.grid.flat();

      // Bijection over 1..n²
      expect(cells.length).toBe(n * n);
      expect(new Set(cells).size).toBe(n * n);
      expect(Math.min(...cells)).toBe(1);
      expect(Math.max(...cells)).toBe(n * n);

      // The magic constant is n(n²+1)/2 by definition.
      const expected = (n * (n * n + 1)) / 2;
      expect(k.constant).toBe(expected);

      // Every row, every column, both diagonals sum to the constant.
      for (let r = 0; r < n; r++) {
        const rowSum = (k.grid[r] as number[]).reduce((a, b) => a + b, 0);
        expect(rowSum).toBe(expected);
      }
      for (let c = 0; c < n; c++) {
        let colSum = 0;
        for (let r = 0; r < n; r++) colSum += (k.grid[r] as number[])[c] as number;
        expect(colSum).toBe(expected);
      }
      let d1 = 0;
      let d2 = 0;
      for (let i = 0; i < n; i++) {
        d1 += (k.grid[i] as number[])[i] as number;
        d2 += (k.grid[i] as number[])[n - 1 - i] as number;
      }
      expect(d1).toBe(expected);
      expect(d2).toBe(expected);
    }
  });

  test("Saturn matches Agrippa verbatim (the Lo Shu orientation)", () => {
    expect(kamea(3).grid).toEqual([
      [4, 9, 2],
      [3, 5, 7],
      [8, 1, 6],
    ]);
  });

  test("Jupiter matches Agrippa verbatim", () => {
    expect(kamea(4).grid).toEqual([
      [4, 14, 15, 1],
      [9, 7, 6, 12],
      [5, 11, 10, 8],
      [16, 2, 3, 13],
    ]);
  });
});

// ============================================================ T4 · election totality

describe("T4 · election totality", () => {
  test("presidingKamea returns kamea with n = movingLines + 3 for 0..6", () => {
    for (let m = 0; m <= 6; m++) {
      const k = presidingKamea(m);
      expect(k.order).toBe(m + 3);
    }
  });

  test("planet names follow the Chaldean order", () => {
    expect(presidingKamea(0).planet).toBe("Saturn");
    expect(presidingKamea(1).planet).toBe("Jupiter");
    expect(presidingKamea(2).planet).toBe("Mars");
    expect(presidingKamea(3).planet).toBe("Sol");
    expect(presidingKamea(4).planet).toBe("Venus");
    expect(presidingKamea(5).planet).toBe("Mercury");
    expect(presidingKamea(6).planet).toBe("Luna");
  });

  test("out-of-range and non-integer inputs throw", () => {
    expect(() => presidingKamea(-1)).toThrow();
    expect(() => presidingKamea(7)).toThrow();
    expect(() => presidingKamea(3.5)).toThrow();
    expect(() => presidingKamea(Number.NaN)).toThrow();
  });
});

// ============================================================ T2 · election distribution

describe("T2 · election distribution", () => {
  test("full 262,144-sequence enumeration matches the exact counts", () => {
    // A cast is 6 lines. A line is 3 coins, each 2 states, so 8 outcomes per
    // line; 8^6 = 262,144 sequences total. A line is moving iff all three
    // coins agree (all heads or all tails): 2 out of 8 line outcomes.
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (let seq = 0; seq < 262144; seq++) {
      let moving = 0;
      for (let line = 0; line < 6; line++) {
        const bits = (seq >> (line * 3)) & 0b111;
        if (bits === 0b000 || bits === 0b111) moving += 1;
      }
      counts[moving] = (counts[moving] ?? 0) + 1;
    }
    expect(counts).toEqual([...ELECTION_COUNTS_8POW6]);
    // And the closed form: C(6,k) * 2^k * 6^(6-k)
    const choose = [1, 6, 15, 20, 15, 6, 1];
    for (let k = 0; k <= 6; k++) {
      const closed = (choose[k] as number) * 2 ** k * 6 ** (6 - k);
      expect(counts[k]).toBe(closed);
    }
    // Sums to 8^6.
    expect(counts.reduce((a, b) => a + b, 0)).toBe(262144);
  });
});

// ============================================================ T5 · tracer sweep

describe("T5 · tracer validity sweep", () => {
  const corpus = [
    "",
    "a",
    "z",
    "Should I take the offer?",
    "hello world",
    "aaaaaaaaaaaaaaa",
    "!@#$%^&*()",
    "こんにちは", // non-Latin: no letters that map, path should be empty
    "The quick brown fox jumps over the lazy dog",
    "AEIOU",
  ];

  test("every corpus phrase traces to in-grid points on every kamea", () => {
    for (let n = 3; n <= 9; n++) {
      for (const phrase of corpus) {
        const { kamea: k, points, values } = trace(phrase, n);
        expect(k.order).toBe(n);
        // Points are within [0, n-1] on both axes.
        for (const [c, r] of points) {
          expect(c).toBeGreaterThanOrEqual(0);
          expect(c).toBeLessThan(n);
          expect(r).toBeGreaterThanOrEqual(0);
          expect(r).toBeLessThan(n);
        }
        // Values are within [1, n²].
        for (const v of values) {
          expect(v).toBeGreaterThanOrEqual(1);
          expect(v).toBeLessThanOrEqual(n * n);
        }
      }
    }
  });

  test("determinism: same phrase + same kamea = byte-identical path", () => {
    for (let n = 3; n <= 9; n++) {
      const a = trace("hello world", n);
      const b = trace("hello world", n);
      expect(a.points).toEqual(b.points);
      expect(a.values).toEqual(b.values);
    }
  });

  test("n=3 collapses hardest: J-Z fold onto cells 1-9", () => {
    // A..I map to 1..9 directly. J..R fold to 1..9 (via mod 9). S..Z fold
    // to 1..8. So an alphabet-plus-repeated phrase should produce cells all
    // in [1, 9].
    const { values } = trace("abcdefghijklmnopqrstuvwxyz", 3);
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(9);
    }
  });

  test("n=9 uses the widest range: no letter folds", () => {
    // 9² = 81 > 26, so every letter A..Z gets its raw index (1..26).
    const { values } = trace("abcdefghij", 9);
    expect(values).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});

// ============================================================ T6 · end-to-end determinism

describe("T6 · end-to-end determinism", () => {
  test("same movingLines + same question = byte-identical path, twice cold", () => {
    // Presiding is elected from movingLines; tracing is a pure function of
    // (phrase, kamea). Together the sigil must be reproducible from just
    // (movingLines, question).
    for (const [movingLines, question] of [
      [0, "will it rain"],
      [3, "should I take the offer"],
      [6, "am I ready"],
    ] as const) {
      const k1 = presidingKamea(movingLines);
      const k2 = presidingKamea(movingLines);
      expect(k1.order).toBe(k2.order);
      expect(k1.grid).toEqual(k2.grid);

      const a = trace(question, k1.order);
      const b = trace(question, k2.order);
      expect(a.points).toEqual(b.points);
      expect(a.values).toEqual(b.values);
    }
  });
});

// ============================================================ T7 · the cards in the sigil

describe("T7 · cards contribute cells", () => {
  const CARDS = [
    { index: 67, reversed: true },
    { index: 55, reversed: false },
    { index: 26, reversed: false },
  ] as const;

  test("the question's figure is preserved as a prefix", () => {
    for (const order of [3, 5, 7, 9]) {
      const base = trace("will the harvest hold", order);
      const full = traceWithCards("will the harvest hold", order, CARDS);
      expect(full.values.slice(0, base.values.length)).toEqual(base.values);
      expect(full.kamea.grid).toEqual(base.kamea.grid);
    }
  });

  test("three cards add at most three cells, and every cell is on the square", () => {
    for (const order of [3, 5, 7, 9]) {
      const max = order * order;
      const base = trace("am I ready", order);
      const full = traceWithCards("am I ready", order, CARDS);
      const added = full.values.length - base.values.length;
      expect(added).toBeGreaterThanOrEqual(0);
      expect(added).toBeLessThanOrEqual(3);
      for (const v of full.values) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(max);
      }
      expect(full.points.length).toBe(full.values.length);
    }
  });

  test("a reversed card takes the complement cell", () => {
    for (const order of [3, 5, 7, 9]) {
      const max = order * order;
      const one = [{ index: 40, reversed: false }] as const;
      const other = [{ index: 40, reversed: true }] as const;
      const up = traceWithCards("", order, one).values;
      const down = traceWithCards("", order, other).values;
      expect(up.length).toBe(1);
      expect(down.length).toBe(1);
      expect(down[0]).toBe(max + 1 - (up[0] as number));
    }
  });

  test("different pulls draw different figures — the whole point of B1", () => {
    // The long question that defeats name-concatenation: its alphabet is
    // already spent, so only a cell-based rule can still register the cards.
    const q =
      "should I move across the country to be closer to the people I love " +
      "even though it means leaving the work that has defined me for a decade";
    const order = presidingKamea(3).order;
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const pull = [
        { index: i, reversed: i % 2 === 0 },
        { index: (i * 7 + 11) % 78, reversed: i % 3 === 0 },
        { index: (i * 13 + 5) % 78, reversed: i % 5 === 0 },
      ];
      seen.add(traceWithCards(q, order, pull).values.join(","));
    }
    // Name-concatenation would collapse these to a single figure.
    expect(seen.size).toBeGreaterThan(50);
  });

  test("no cards means no change at all", () => {
    for (const order of [3, 6, 9]) {
      const base = trace("will it rain", order);
      const empty = traceWithCards("will it rain", order, []);
      expect(empty.values).toEqual(base.values);
      expect(empty.points).toEqual(base.points);
    }
  });

  test("is deterministic and pure", () => {
    const cards = [...CARDS];
    const frozen = JSON.stringify(cards);
    const a = traceWithCards("am I ready", 7, cards);
    const b = traceWithCards("am I ready", 7, cards);
    expect(a.values).toEqual(b.values);
    expect(a.points).toEqual(b.points);
    expect(JSON.stringify(cards)).toBe(frozen);
  });
});

// ============================================================ T8 · the sky-started election

describe("T8 · the sky and the cast elect the square together", () => {
  test("every result is one of the seven squares", () => {
    for (let sign = 0; sign < 12; sign++) {
      for (let k = 0; k <= 6; k++) {
        const order = electedOrder(k, sign);
        expect(order).toBeGreaterThanOrEqual(3);
        expect(order).toBeLessThanOrEqual(9);
        expect(castKamea(k, sign).order).toBe(order);
      }
    }
  });

  test("both causes are real: each alone can change the outcome", () => {
    // Same sky, different cast.
    const bySky = new Set(
      Array.from({ length: 7 }, (_, k) => electedOrder(k, 0)),
    );
    expect(bySky.size).toBe(7);
    // Same cast, different sky.
    const byCast = new Set(
      Array.from({ length: 12 }, (_, s) => electedOrder(0, s)),
    );
    expect(byCast.size).toBeGreaterThan(1);
  });

  test("stepping the moving lines walks the Chaldean order", () => {
    for (let sign = 0; sign < 12; sign++) {
      for (let k = 0; k < 6; k++) {
        const here = electedOrder(k, sign) - 3;
        const next = electedOrder(k + 1, sign) - 3;
        expect(next).toBe((here + 1) % 7);
      }
    }
    // And it starts on the ruler of the Moon's sign.
    for (let sign = 0; sign < 12; sign++) {
      expect(electedOrder(0, sign) - 3).toBe(SIGN_RULER[sign] as number);
    }
  });

  test("all seven squares are reachable, and near-evenly", () => {
    // Exact enumeration: every moving-line count weighted by how often the
    // coins produce it, against every sign the Moon could stand in. Signs are
    // taken as equally likely, which the Moon's near-steady motion makes true
    // to well within the band below.
    const counts = new Array(7).fill(0);
    for (let sign = 0; sign < 12; sign++) {
      for (let k = 0; k <= 6; k++) {
        counts[electedOrder(k, sign) - 3] += ELECTION_COUNTS_8POW6[k];
      }
    }
    const total = counts.reduce((a, b) => a + b, 0);
    const shares = counts.map((c) => c / total);

    // The old rule put Luna at 0.024% and Mercury at 0.44% — five of the seven
    // squares were effectively unreachable. Nothing may fall below 12% again.
    for (const share of shares) {
      expect(share).toBeGreaterThan(0.12);
      expect(share).toBeLessThan(0.17);
    }
    expect(Math.max(...shares) / Math.min(...shares)).toBeLessThan(1.25);
  });

  test("the moving-line count alone is far from even — which is why this exists", () => {
    const total = ELECTION_COUNTS_8POW6.reduce((a, b) => a + b, 0);
    expect(total).toBe(8 ** 6);
    const worst = Math.min(...ELECTION_COUNTS_8POW6) / total;
    expect(worst).toBeLessThan(0.001); // Luna, once in ~4000 casts
  });

  test("rejects a sign or a count it cannot use", () => {
    expect(() => electedOrder(-1, 0)).toThrow();
    expect(() => electedOrder(7, 0)).toThrow();
    expect(() => electedOrder(0, -1)).toThrow();
    expect(() => electedOrder(0, 12)).toThrow();
    expect(() => electedOrder(1.5, 0)).toThrow();
  });
});
