import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  DECK_SIZE,
  DRAWS_PER_EPOCH,
  TAROT_PAGE_POSITIONS,
  mintSeed,
  deckOrder,
  deckFlips,
  freshDeck,
  reshuffle,
  remaining,
  canDraw,
  drawThree,
  validateState,
  type DeckState,
} from "./epochdeck";
import { memoryDeckStore } from "./deckStore";

/// The twelve tests from the epoch-deck design drop, ported to bun, plus the
/// T1 integration checks that prove the oracle pull was not disturbed.
///
/// Statistical bands are generous by construction: they catch broken code,
/// not noise. Do not widen them.

/// Deterministic seed material for statistical tests (mintSeed is for prod).
const testSeed = (n: number): string => n.toString(16).padStart(32, "0");

describe("entropy", () => {
  test("mintSeed: 32 lowercase hex chars, no repeats across 200 mints", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const s = mintSeed();
      expect(s).toMatch(/^[0-9a-f]{32}$/);
      seen.add(s);
    }
    expect(seen.size).toBe(200);
  });
});

describe("the shuffle", () => {
  test("deckOrder: a valid permutation of 0..77 for 500 seeds", () => {
    const identity = Array.from({ length: DECK_SIZE }, (_, i) => i);
    for (let n = 0; n < 500; n++) {
      const order = deckOrder(testSeed(n));
      expect(order.length).toBe(DECK_SIZE);
      expect([...order].sort((a, b) => a - b)).toEqual(identity);
    }
  });

  test("determinism: same seed, same order and flips; different seeds differ", () => {
    const s = testSeed(424242);
    expect(deckOrder(s)).toEqual(deckOrder(s));
    expect(deckFlips(s)).toEqual(deckFlips(s));
    const orders = new Set<string>();
    for (let n = 0; n < 100; n++) orders.add(deckOrder(testSeed(n)).join(","));
    expect(orders.size).toBe(100);
  });

  test("flip rate ~50% across 300 epochs (n = 23,400)", () => {
    let flips = 0;
    for (let n = 0; n < 300; n++) {
      flips += deckFlips(testSeed(n)).filter(Boolean).length;
    }
    const rate = flips / (300 * DECK_SIZE);
    expect(rate).toBeGreaterThan(0.48);
    expect(rate).toBeLessThan(0.52);
  });

  test("top card uniform across 7,800 epochs (expected 100/card, band 55-145)", () => {
    const counts = new Array(DECK_SIZE).fill(0);
    for (let n = 0; n < 7800; n++) counts[deckOrder(testSeed(n))[0] as number]++;
    for (let c = 0; c < DECK_SIZE; c++) {
      expect(counts[c]).toBeGreaterThanOrEqual(55);
      expect(counts[c]).toBeLessThanOrEqual(145);
    }
  });

  test("order and flip streams are independent: top-card kind does not bias its orientation", () => {
    let majTop = 0,
      majTopRev = 0,
      minTop = 0,
      minTopRev = 0;
    for (let n = 0; n < 2000; n++) {
      const seed = testSeed(n);
      const top = deckOrder(seed)[0];
      const rev = deckFlips(seed)[0];
      if ((top as number) < 22) {
        majTop++;
        if (rev) majTopRev++;
      } else {
        minTop++;
        if (rev) minTopRev++;
      }
    }
    const majRate = majTopRev / majTop;
    const minRate = minTopRev / minTop;
    expect(majRate).toBeGreaterThan(0.42);
    expect(majRate).toBeLessThan(0.58);
    expect(minRate).toBeGreaterThan(0.45);
    expect(minRate).toBeLessThan(0.55);
  });
});

describe("the walk", () => {
  test("26 draws see all 78 exactly once, then the deck refuses", () => {
    let state: DeckState = {
      seed: testSeed(7),
      cursor: 0,
      epoch: 1,
      shuffledAt: 0,
    };
    const seen: number[] = [];
    for (let d = 0; d < DRAWS_PER_EPOCH; d++) {
      expect(remaining(state)).toBe(DECK_SIZE - d * 3);
      expect(canDraw(state)).toBe(true);
      const { drawn, next } = drawThree(state);
      expect(drawn.length).toBe(3);
      expect(drawn.map((c) => c.position)).toEqual([...TAROT_PAGE_POSITIONS]);
      seen.push(...drawn.map((c) => c.index));
      state = next;
    }
    expect(remaining(state)).toBe(0);
    expect(canDraw(state)).toBe(false);
    expect([...seen].sort((a, b) => a - b)).toEqual(
      Array.from({ length: DECK_SIZE }, (_, i) => i),
    );
    expect(() => drawThree(state)).toThrow(/reshuffle required/);
  });

  test("orientations are baked: the k-th card of an epoch is fixed regardless of when drawn", () => {
    const seed = testSeed(99);
    const flips = deckFlips(seed);
    let state: DeckState = { seed, cursor: 0, epoch: 1, shuffledAt: 0 };
    for (let d = 0; d < DRAWS_PER_EPOCH; d++) {
      const { drawn, next } = drawThree(state);
      drawn.forEach((c, k) =>
        expect(c.reversed).toBe(flips[state.cursor + k] as boolean),
      );
      state = next;
    }
  });

  test("drawThree is pure: input state untouched, position list length enforced", () => {
    const state: DeckState = {
      seed: testSeed(1),
      cursor: 6,
      epoch: 2,
      shuffledAt: 5,
    };
    const frozen = JSON.stringify(state);
    drawThree(state);
    expect(JSON.stringify(state)).toBe(frozen);
    expect(() => drawThree(state, ["only", "two"])).toThrow();
  });
});

describe("lifecycle", () => {
  test("fresh deck is epoch 1; reshuffle bumps epoch, resets cursor, changes seed", () => {
    const a = freshDeck();
    expect(a.epoch).toBe(1);
    expect(a.cursor).toBe(0);
    const mid = { ...a, cursor: 39 };
    const b = reshuffle(mid);
    expect(b.epoch).toBe(2);
    expect(b.cursor).toBe(0);
    expect(b.seed).not.toBe(a.seed);
    expect(validateState(a)).toBe(true);
    expect(validateState(b)).toBe(true);
  });

  test("validateState rejects every corruption mode", () => {
    const good: DeckState = {
      seed: testSeed(3),
      cursor: 3,
      epoch: 1,
      shuffledAt: 0,
    };
    expect(validateState(good)).toBe(true);
    expect(validateState(null)).toBe(false);
    expect(validateState({ ...good, seed: "XYZ" })).toBe(false);
    expect(validateState({ ...good, seed: good.seed.slice(1) })).toBe(false);
    expect(validateState({ ...good, cursor: 4 })).toBe(false); // not a multiple of 3
    expect(validateState({ ...good, cursor: 81 })).toBe(false); // past the deck
    expect(validateState({ ...good, cursor: -3 })).toBe(false);
    expect(validateState({ ...good, epoch: 0 })).toBe(false);
    expect(validateState({ ...good, shuffledAt: Infinity })).toBe(false);
  });
});

describe("storage", () => {
  test("a fresh store has no deck until one is shuffled", async () => {
    const store = memoryDeckStore();
    expect(await store.load()).toBe(null);
    const deck = await store.shuffle(testSeed(11));
    expect(deck.epoch).toBe(1);
    expect(deck.cursor).toBe(0);
    expect(await store.load()).toEqual(deck);
  });

  test("reshuffling keeps the epoch climbing", async () => {
    const store = memoryDeckStore();
    await store.shuffle(testSeed(1));
    const second = await store.shuffle(testSeed(2));
    expect(second.epoch).toBe(2);
    expect(second.cursor).toBe(0);
    expect(second.seed).toBe(testSeed(2));
  });

  test("the cursor only lands where a deck walked by threes can rest", async () => {
    const store = memoryDeckStore();
    await store.shuffle(testSeed(5));
    expect(await store.advance(3)).toBe(true);
    expect(await store.advance(4)).toBe(false); // not a multiple of three
    expect(await store.advance(81)).toBe(false); // past the deck
    expect(await store.advance(0)).toBe(false); // never backwards
    expect((await store.load())?.cursor).toBe(3);
  });

  test("a deck that fails validation reads as no deck at all", async () => {
    // Rather than throwing at the page, an unusable deck simply offers a
    // fresh shuffle — reshuffling costs nothing, so nothing of value is lost.
    const store = memoryDeckStore({
      seed: "not-hex",
      cursor: 0,
      epoch: 1,
      shuffledAt: 0,
    });
    expect(await store.load()).toBe(null);
  });
});

// --------------------------------------------------- T1: the oracle is untouched

describe("T1 — the oracle pull is undisturbed", () => {
  /// Captured from `tarot.ts` before the epoch deck existed. If the oracle's
  /// seed recipe, RNG, or deck construction drifts by so much as a bit, this
  /// spread changes and the test fails. That is the whole point of it.
  test("a golden oracle spread reproduces exactly", async () => {
    const { draw } = await import("./tarot");
    const spread = draw(7n, 23n, "will the harvest hold", 4242);
    expect(
      spread.map((d) => [d.card.index, d.card.label, d.reversed, d.position]),
    ).toEqual([
      [67, "Four of Pentacles", true, "What you brought"],
      [55, "Six of Swords", false, "What is in the way"],
      [26, "Five of Wands", false, "What it opens onto"],
    ]);
  });

  /// Structural guarantee, not a behavioral one: the two systems must not be
  /// able to reach each other at all. They share the DECK data and the card
  /// renderer at the page level only.
  test("no imports cross between the oracle draw module and the epoch deck", () => {
    const oracle = readFileSync(new URL("./tarot.ts", import.meta.url), "utf8");
    const deck = readFileSync(
      new URL("./epochdeck.ts", import.meta.url),
      "utf8",
    );
    expect(oracle).not.toMatch(/from\s+["']\.\/epochdeck["']/);
    expect(oracle).not.toMatch(/from\s+["']\.\/deckStore["']/);
    expect(deck).not.toMatch(/from\s+["']\.\/tarot["']/);
    // The epoch deck imports nothing at all; keep it that way.
    expect(deck).not.toMatch(/^\s*import\s/m);
  });
});
