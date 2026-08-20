/// The deck, and how three cards come out of it.
///
/// Nothing here touches the kernel. The pull is a bonus on top of a reading
/// that has already been decided by chain randomness, it is never stored, and
/// it is re-rollable -- so browser entropy is the honest source. A round trip
/// to the canister per re-roll would cost brokered randomness and about two
/// seconds, for cards that are commentary rather than verdict.

export type Suit = "wands" | "cups" | "swords" | "pentacles";

export interface Card {
  index: number; // 0-77, stable deck position
  kind: "major" | "minor";
  label: string;
  suit?: Suit;
  rank?: number; // 1-14 for minors: Ace..Ten, Page, Knight, Queen, King
  major?: number; // 0-21
}

export interface DrawnCard {
  card: Card;
  reversed: boolean;
  position: string;
}

/// Positions deliberately avoid past/present/future. The hexagram already
/// committed to an answer; three cards predicting an outcome would compete
/// with it. These describe the situation instead.
export const POSITIONS = [
  "What you brought",
  "What is in the way",
  "What it opens onto",
] as const;

const MAJORS = [
  "The Fool",
  "The Magician",
  "The High Priestess",
  "The Empress",
  "The Emperor",
  "The Hierophant",
  "The Lovers",
  "The Chariot",
  "Strength",
  "The Hermit",
  "Wheel of Fortune",
  "Justice",
  "The Hanged Man",
  "Death",
  "Temperance",
  "The Devil",
  "The Tower",
  "The Star",
  "The Moon",
  "The Sun",
  "Judgement",
  "The World",
];

const SUITS: Suit[] = ["wands", "cups", "swords", "pentacles"];

const RANKS = [
  "Ace",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Page",
  "Knight",
  "Queen",
  "King",
];

const SUIT_LABEL: Record<Suit, string> = {
  wands: "Wands",
  cups: "Cups",
  swords: "Swords",
  pentacles: "Pentacles",
};

export const SUIT_ELEMENT: Record<Suit, string> = {
  wands: "fire",
  cups: "water",
  swords: "air",
  pentacles: "earth",
};

/// Built once. Majors 0-21, then each suit Ace through King.
export const DECK: Card[] = (() => {
  const deck: Card[] = [];
  MAJORS.forEach((label, i) =>
    deck.push({ index: deck.length, kind: "major", label, major: i }),
  );
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 14; rank++) {
      deck.push({
        index: deck.length,
        kind: "minor",
        label: `${RANKS[rank - 1]} of ${SUIT_LABEL[suit]}`,
        suit,
        rank,
      });
    }
  }
  return deck;
})();

/// FNV-1a over the reading's identity plus a re-roll nonce.
function seedFrom(parts: (string | number)[]): number {
  const s = parts.join("|");
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/// A fresh nonce per pull. Re-rolling is meant to be free and instant.
export function newNonce(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0];
}

/// Partial Fisher-Yates: a real deal without replacement, so no card can
/// appear twice in one spread. Only three swaps are needed.
export function draw(
  readingId: string | bigint | number,
  kingWen: string | bigint | number,
  question: string,
  nonce: number,
): DrawnCard[] {
  const rng = mulberry32(
    seedFrom([String(readingId), String(kingWen), question, nonce]),
  );

  const order = DECK.map((_, i) => i);
  const picked: DrawnCard[] = [];

  for (let i = 0; i < 3; i++) {
    const j = i + Math.floor(rng() * (order.length - i));
    [order[i], order[j]] = [order[j], order[i]];
    picked.push({
      card: DECK[order[i]],
      reversed: rng() < 0.5,
      position: POSITIONS[i],
    });
  }

  return picked;
}
