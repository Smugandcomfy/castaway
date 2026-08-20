import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { HEXAGRAMS, KING_WEN, glyphOf, hexagramNumberOf } from "./kingwen";

/// The hexagram names exist twice — canonically in
/// `backend/oracle/Hexagrams.mo`, and in TypeScript so the Legend can render
/// them. Two copies of anything drift, so this binds them: the Motoko file is
/// parsed and compared row by row. Change one without the other and this
/// fails rather than the app quietly disagreeing with the canister.

function motokoNames(): [string, string][] {
  const mo = readFileSync(
    new URL("../backend/oracle/Hexagrams.mo", import.meta.url),
    "utf8",
  );
  const start = mo.indexOf("let NAMES");
  const block = mo.slice(start, mo.indexOf("];", start));
  return [...block.matchAll(/\("([^"]+)",\s*"([^"]+)"\)/g)].map((m) => [
    m[1],
    m[2],
  ]);
}

describe("the hexagram table", () => {
  test("64 rows, numbered 1..64", () => {
    expect(HEXAGRAMS.length).toBe(64);
    HEXAGRAMS.forEach((h, i) => expect(h.n).toBe(i + 1));
  });

  test("matches backend/oracle/Hexagrams.mo exactly", () => {
    const mo = motokoNames();
    expect(mo.length).toBe(64);
    HEXAGRAMS.forEach((h, i) => {
      expect(h.pinyin).toBe(mo[i][0]);
      expect(h.english).toBe(mo[i][1]);
    });
  });

  test("glyphs are the contiguous Unicode block in King Wen order", () => {
    expect(glyphOf(1)).toBe("䷀");
    expect(glyphOf(64)).toBe("䷿");
    const seen = new Set(HEXAGRAMS.map((h) => h.glyph));
    expect(seen.size).toBe(64);
    HEXAGRAMS.forEach((h) => {
      expect(h.glyph.codePointAt(0)).toBe(0x4dc0 + h.n - 1);
    });
  });

  test("English readings are unique, pinyin may repeat as the tradition does", () => {
    // Qian, Kun, Bi, Lu, Yi and Jian each name two different hexagrams.
    expect(new Set(HEXAGRAMS.map((h) => h.english)).size).toBe(64);
    expect(new Set(HEXAGRAMS.map((h) => h.pinyin)).size).toBeLessThan(64);
  });

  test("every hexagram is reachable from a line pattern", () => {
    const reached = new Set<number>();
    for (let mask = 0; mask < 64; mask++) {
      const lines = Array.from({ length: 6 }, (_, i) =>
        (mask >> i) & 1 ? 7 : 8,
      );
      reached.add(hexagramNumberOf(lines));
    }
    expect(reached.size).toBe(64);
    expect(new Set(KING_WEN).size).toBe(64);
  });
});
