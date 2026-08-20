/// The Tarot page's deck: a possession, not an event.
///
/// Doctrine split (normative, see the epoch-deck SPEC): the ORACLE pull is
/// sortilege bound to a moment — its seed is readingId | kingWen | question |
/// nonce and it stays exactly as shipped in `tarot.ts`. THIS module is the
/// other system: the user's own deck. It is shuffled once into a fixed order
/// with fixed orientations, draws walk that order three at a time, 26 draws
/// empty it (78 = 26 x 3), and then it must be reshuffled. The question never
/// touches this deck — a physical deck does not care what you asked.
///
/// Design invariants:
///  - Shuffle is the ONLY entropy event. 128 bits, minted at shuffle time.
///  - Order and orientation are DOMAIN-SEPARATED streams derived from the
///    seed, so they are independent channels: changing how one is computed
///    can never silently change the other.
///  - State is {seed, cursor, epoch, shuffledAt}. The permutation is never
///    stored — derive, don't persist (same philosophy as "the timestamp is
///    the sky").
///  - Draw is a pure transition: (state) -> {drawn, next}. No mutation.
///
/// No imports, and nothing here reads `tarot.ts`. The two systems share the
/// DECK data and the card renderer at the page level only.

export type SeedHex = string; // 32 lowercase hex chars = 128 bits

export interface DeckState {
  seed: SeedHex;
  cursor: number; // 0..78, always a multiple of 3
  epoch: number; // 1 on first shuffle, +1 per reshuffle
  shuffledAt: number; // ms epoch; display flavor + future sky annotation
}

export interface DrawnFromDeck {
  index: number; // 0..77 into the shared DECK (the page maps DECK[index])
  reversed: boolean; // baked at shuffle time — the card was always lying this way
  position: string;
}

export const DECK_SIZE = 78;
export const DRAW_SIZE = 3;
export const DRAWS_PER_EPOCH = DECK_SIZE / DRAW_SIZE; // 26, exactly

/// The Tarot page's labels. Deliberately different from the oracle's
/// "What you brought / What is in the way / What it opens onto": the oracle
/// avoids past/present/future so three cards can never appear to contradict
/// the hexagram's verdict. This deck has no verdict to contradict, so it is
/// free to name time directly — and the difference is how the two
/// instruments read as different.
export const TAROT_PAGE_POSITIONS = ["Past", "Present", "Future"] as const;

// --- entropy & derivation ---------------------------------------------------

/// Mint 128 bits of fresh entropy. The only random act in this module.
export function mintSeed(): SeedHex {
  const w = new Uint32Array(4);
  crypto.getRandomValues(w);
  return Array.from(w, (x) => x.toString(16).padStart(8, "0")).join("");
}

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/// sfc32: small fast counter PRNG, 128-bit state, good statistical quality.
function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    const t = ((a + b) | 0) + d | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

/// A per-domain stream: 4 words derived from (seed, domain, wordIndex),
/// feeding sfc32, warmed up. 'order' and 'flip' can never bleed into each
/// other because their derivations differ at the tag.
function domainRng(seed: SeedHex, domain: "order" | "flip"): () => number {
  const w = [0, 1, 2, 3].map((i) => fnv1a(`${seed}|${domain}|${i}`));
  // `w` is mapped from a four-element literal directly above.
  const [w0, w1, w2, w3] = w as [number, number, number, number];
  const rng = sfc32(w0, w1, w2, w3);
  for (let i = 0; i < 12; i++) rng(); // standard sfc32 warm-up
  return rng;
}

// --- the shuffle (derivable, never stored) ----------------------------------

/// The epoch's full order: an unbiased Fisher-Yates permutation of 0..77.
/// order[0] is the top of the deck.
export function deckOrder(seed: SeedHex): number[] {
  const rng = domainRng(seed, "order");
  const order = Array.from({ length: DECK_SIZE }, (_, i) => i);
  for (let i = DECK_SIZE - 1; i >= 1; i--) {
    const j = Math.floor(rng() * (i + 1)); // uniform in [0, i]
    [order[i], order[j]] = [order[j] as number, order[i] as number];
  }
  return order;
}

/// The epoch's orientations, one per deck slot, baked at shuffle time:
/// flips[k] is the orientation of the k-th card DRAWN this epoch, fixed
/// whether you reach it on draw 1 or draw 26.
export function deckFlips(seed: SeedHex): boolean[] {
  const rng = domainRng(seed, "flip");
  return Array.from({ length: DECK_SIZE }, () => rng() < 0.5);
}

// --- state lifecycle --------------------------------------------------------

export function freshDeck(prevEpoch = 0, now: number = Date.now()): DeckState {
  return { seed: mintSeed(), cursor: 0, epoch: prevEpoch + 1, shuffledAt: now };
}

/// Reshuffle: allowed at any time; mandatory at empty. New seed, epoch + 1.
export function reshuffle(
  state: DeckState,
  now: number = Date.now(),
): DeckState {
  return freshDeck(state.epoch, now);
}

export function remaining(state: DeckState): number {
  return DECK_SIZE - state.cursor;
}

export function canDraw(state: DeckState): boolean {
  return remaining(state) >= DRAW_SIZE;
}

/// Pure draw transition. Reads the precomputed order at the cursor; nothing
/// is decided at draw time. Throws when the deck cannot cover a spread —
/// the UI must have already swapped the button to "reshuffle".
export function drawThree(
  state: DeckState,
  positions: readonly string[] = TAROT_PAGE_POSITIONS,
): { drawn: DrawnFromDeck[]; next: DeckState } {
  if (positions.length !== DRAW_SIZE) {
    throw new Error(`drawThree: need exactly ${DRAW_SIZE} positions`);
  }
  if (!canDraw(state)) {
    throw new Error(
      `drawThree: ${remaining(state)} card(s) left; reshuffle required`,
    );
  }
  const order = deckOrder(state.seed);
  const flips = deckFlips(state.seed);
  const drawn: DrawnFromDeck[] = [];
  for (let k = 0; k < DRAW_SIZE; k++) {
    const slot = state.cursor + k;
    drawn.push({
      // `canDraw` guarantees the cursor leaves DRAW_SIZE cards in the deck.
      index: order[slot] as number,
      reversed: flips[slot] as boolean,
      position: positions[k] as string,
    });
  }
  return { drawn, next: { ...state, cursor: state.cursor + DRAW_SIZE } };
}

// --- validation (corrupt storage must degrade to "fresh shuffle", never crash)

export function validateState(s: unknown): s is DeckState {
  if (typeof s !== "object" || s === null) return false;
  const o = s as Record<string, unknown>;
  return (
    typeof o.seed === "string" &&
    /^[0-9a-f]{32}$/.test(o.seed) &&
    typeof o.cursor === "number" &&
    Number.isInteger(o.cursor) &&
    o.cursor >= 0 &&
    o.cursor <= DECK_SIZE &&
    o.cursor % DRAW_SIZE === 0 &&
    typeof o.epoch === "number" &&
    Number.isInteger(o.epoch) &&
    o.epoch >= 1 &&
    typeof o.shuffledAt === "number" &&
    Number.isFinite(o.shuffledAt)
  );
}
