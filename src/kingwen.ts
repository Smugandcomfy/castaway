/// King Wen table and single-line helpers, in TypeScript. Source of truth
/// for the frontend: dev/mock.ts imports from here, and src/debug.ts exposes
/// these on window.__castAway so users can paste-verify claims from the FAQ.
///
/// The Motoko backend has its own copy in backend/oracle/Hexagrams.mo. Both
/// are verified against each other and against the pairing rule.

/// A hexagram is a 6-bit pattern: bit i (0 = bottom) is set when line i is
/// yang. Bits 0-2 are the lower trigram, bits 3-5 the upper. Look up the
/// King Wen number by that 6-bit index.
export const KING_WEN: readonly number[] = [
  // upper Kun
  2, 24, 7, 19, 15, 36, 46, 11,
  // upper Zhen
  16, 51, 40, 54, 62, 55, 32, 34,
  // upper Kan
  8, 3, 29, 60, 39, 63, 48, 5,
  // upper Dui
  45, 17, 47, 58, 31, 49, 28, 43,
  // upper Gen
  23, 27, 4, 41, 52, 22, 18, 26,
  // upper Li
  35, 21, 64, 38, 56, 30, 50, 14,
  // upper Xun
  20, 42, 59, 61, 53, 37, 57, 9,
  // upper Qian
  12, 25, 6, 10, 33, 13, 44, 1,
];

export const isYang = (line: number): boolean => line === 7 || line === 9;
export const isYin = (line: number): boolean => line === 6 || line === 8;
export const isChanging = (line: number): boolean => line === 6 || line === 9;

/// 6 (old yin)  -> 7 (young yang)
/// 9 (old yang) -> 8 (young yin)
/// 7, 8 unchanged.
export const transform = (line: number): number =>
  line === 6 ? 7 : line === 9 ? 8 : line;

/// Given six coin-sum lines bottom-to-top, return the King Wen number.
export function hexagramNumberOf(lines: number[]): number {
  let index = 0;
  for (let i = 0; i < lines.length; i++) {
    if (isYang(lines[i] as number)) index += 1 << i;
  }
  // Six lines make a six-bit index, and the table has sixty-four entries.
  return KING_WEN[index] as number;
}

/// The 64 hexagram names, indexed by King Wen number - 1.
///
/// Transcribed from `backend/oracle/Hexagrams.mo`, which is the canonical
/// table — `kingwen.test.ts` parses that file and asserts these agree, so the
/// two copies cannot drift. The glyph is not stored: Unicode allocates the
/// hexagrams contiguously at U+4DC0 in King Wen order, so it is arithmetic.
const NAMES: readonly (readonly [pinyin: string, english: string])[] = [
  ["Qian", "The Creative"],
  ["Kun", "The Receptive"],
  ["Zhun", "Difficulty at the Beginning"],
  ["Meng", "Youthful Folly"],
  ["Xu", "Waiting"],
  ["Song", "Conflict"],
  ["Shi", "The Army"],
  ["Bi", "Holding Together"],
  ["Xiao Chu", "The Taming Power of the Small"],
  ["Lu", "Treading"],
  ["Tai", "Peace"],
  ["Pi", "Standstill"],
  ["Tong Ren", "Fellowship with Others"],
  ["Da You", "Great Possession"],
  ["Qian", "Modesty"],
  ["Yu", "Enthusiasm"],
  ["Sui", "Following"],
  ["Gu", "Work on What Has Decayed"],
  ["Lin", "Approach"],
  ["Guan", "Contemplation"],
  ["Shi Ke", "Biting Through"],
  ["Bi", "Grace"],
  ["Bo", "Splitting Apart"],
  ["Fu", "Return"],
  ["Wu Wang", "Innocence"],
  ["Da Chu", "The Taming Power of the Great"],
  ["Yi", "Nourishment"],
  ["Da Guo", "Preponderance of the Great"],
  ["Kan", "The Abysmal"],
  ["Li", "The Clinging"],
  ["Xian", "Influence"],
  ["Heng", "Duration"],
  ["Dun", "Retreat"],
  ["Da Zhuang", "The Power of the Great"],
  ["Jin", "Progress"],
  ["Ming Yi", "Darkening of the Light"],
  ["Jia Ren", "The Family"],
  ["Kui", "Opposition"],
  ["Jian", "Obstruction"],
  ["Xie", "Deliverance"],
  ["Sun", "Decrease"],
  ["Yi", "Increase"],
  ["Guai", "Breakthrough"],
  ["Gou", "Coming to Meet"],
  ["Cui", "Gathering Together"],
  ["Sheng", "Pushing Upward"],
  ["Kun", "Oppression"],
  ["Jing", "The Well"],
  ["Ge", "Revolution"],
  ["Ding", "The Cauldron"],
  ["Zhen", "The Arousing"],
  ["Gen", "Keeping Still"],
  ["Jian", "Development"],
  ["Gui Mei", "The Marrying Maiden"],
  ["Feng", "Abundance"],
  ["Lu", "The Wanderer"],
  ["Xun", "The Gentle"],
  ["Dui", "The Joyous"],
  ["Huan", "Dispersion"],
  ["Jie", "Limitation"],
  ["Zhong Fu", "Inner Truth"],
  ["Xiao Guo", "Preponderance of the Small"],
  ["Ji Ji", "After Completion"],
  ["Wei Ji", "Before Completion"],
];

export interface Hexagram {
  n: number;
  pinyin: string;
  english: string;
  glyph: string;
}

/// U+4DC0 + (number - 1) — the Unicode block is in King Wen order.
export const glyphOf = (n: number): string => String.fromCodePoint(0x4dc0 + n - 1);

export const HEXAGRAMS: readonly Hexagram[] = NAMES.map(([pinyin, english], i) => ({
  n: i + 1,
  pinyin,
  english,
  glyph: glyphOf(i + 1),
}));
