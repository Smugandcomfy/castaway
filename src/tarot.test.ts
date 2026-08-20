import { describe, expect, test } from "bun:test";
import { DECK, POSITIONS, draw } from "./tarot";

/// These run with `bun test` and need nothing from Neutron.

describe("deck", () => {
  test("has 78 cards", () => {
    expect(DECK.length).toBe(78);
  });

  test("22 majors, 56 minors, 14 per suit", () => {
    expect(DECK.filter((c) => c.kind === "major").length).toBe(22);
    for (const suit of ["wands", "cups", "swords", "pentacles"] as const) {
      expect(DECK.filter((c) => c.suit === suit).length).toBe(14);
    }
  });

  test("labels are unique", () => {
    expect(new Set(DECK.map((c) => c.label)).size).toBe(78);
  });

  test("indices match array position", () => {
    DECK.forEach((c, i) => expect(c.index).toBe(i));
  });
});

describe("draw", () => {
  const spreads = Array.from({ length: 5000 }, (_, i) =>
    draw(1n, 17n, "will it rain", i),
  );

  test("returns three cards in the declared positions", () => {
    for (const s of spreads.slice(0, 200)) {
      expect(s.length).toBe(3);
      expect(s.map((d) => d.position)).toEqual([...POSITIONS]);
    }
  });

  test("never repeats a card within a spread", () => {
    for (const s of spreads) {
      expect(new Set(s.map((d) => d.card.index)).size).toBe(3);
    }
  });

  test("is deterministic for a fixed nonce", () => {
    const a = draw(9n, 42n, "same question", 12345);
    const b = draw(9n, 42n, "same question", 12345);
    expect(a.map((d) => [d.card.index, d.reversed])).toEqual(
      b.map((d) => [d.card.index, d.reversed]),
    );
  });

  test("a different nonce re-rolls", () => {
    const a = draw(9n, 42n, "same question", 1);
    const b = draw(9n, 42n, "same question", 2);
    expect(a.map((d) => d.card.index)).not.toEqual(b.map((d) => d.card.index));
  });

  test("the question participates in the draw", () => {
    const a = draw(9n, 42n, "should I go", 7);
    const b = draw(9n, 42n, "should I stay", 7);
    expect(a.map((d) => d.card.index)).not.toEqual(b.map((d) => d.card.index));
  });

  test("every card in the deck is reachable", () => {
    const seen = new Set(spreads.flatMap((s) => s.map((d) => d.card.index)));
    expect(seen.size).toBe(78);
  });

  test("reversals land near half", () => {
    const flat = spreads.flat();
    const rate = flat.filter((d) => d.reversed).length / flat.length;
    expect(rate).toBeGreaterThan(0.45);
    expect(rate).toBeLessThan(0.55);
  });

  test("no card is wildly over-drawn", () => {
    const counts = new Array(78).fill(0);
    for (const s of spreads) for (const d of s) counts[d.card.index]++;
    const expected = (spreads.length * 3) / 78;
    // Generous band: this catches a broken shuffle, not statistical noise.
    for (const c of counts) {
      expect(c).toBeGreaterThan(expected * 0.6);
      expect(c).toBeLessThan(expected * 1.4);
    }
  });
});
