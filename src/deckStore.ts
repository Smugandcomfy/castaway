/// Where the deck lives.
///
/// localStorage is gone. An app tile is a credentialless, opaque-origin iframe
/// with no storage and no resident persistence, so a deck kept there would
/// reset on every mount — precisely the one thing a deck you own must never
/// do. The canister is its home.
///
/// The interface survives the move because it was always the point: the deck
/// spec designed `DeckStore` as the seam a second backend plugs into. The app
/// uses the canister; the tests use memory.
///
/// There is no owner key any more either. A Neutron canister has exactly one
/// owner, so there is exactly one deck.

import {
  freshDeck,
  validateState,
  type DeckState,
} from "./epochdeck";
import { advanceDeck, loadJournal, shuffleDeck } from "./backend";

export interface DeckStore {
  /// The deck as it stands, or null if one has never been shuffled.
  load(): Promise<DeckState | null>;
  /// Mint a new epoch from this seed. The store owns the epoch number and the
  /// timestamp, so a caller cannot rewrite either.
  shuffle(seed: string): Promise<DeckState>;
  /// Move the cursor after a draw. Null if the move was refused — a stale
  /// epoch, a skipped draw, a cursor that is not a resting place. On success
  /// the deck as the store now holds it, which is the authority.
  advance(epoch: number, cursor: number): Promise<DeckState | null>;
}

export function canisterDeckStore(): DeckStore {
  return {
    async load() {
      const journal = await loadJournal();
      // A deck that fails validation is treated as no deck, so the page
      // offers a fresh shuffle rather than trying to walk a broken one.
      return journal.deck && validateState(journal.deck) ? journal.deck : null;
    },
    shuffle: (seed) => shuffleDeck(seed),
    advance: (epoch, cursor) => advanceDeck(epoch, cursor),
  };
}

/// In-memory store with the canister's exact acceptance rules, so the deck's
/// behaviour is testable without a replica.
export function memoryDeckStore(initial: DeckState | null = null): DeckStore {
  let deck = initial;
  return {
    async load() {
      return deck && validateState(deck) ? deck : null;
    },
    async shuffle(seed) {
      const next: DeckState = {
        ...freshDeck(deck ? deck.epoch : 0),
        seed,
      };
      deck = next;
      return next;
    },
    async advance(epoch, cursor) {
      if (cursor > 78 || cursor % 3 !== 0) return null;
      if (deck === null) return null;
      if (epoch !== deck.epoch) return null; // a caller holding an older deck
      // One draw at a time, or standing still so a retry succeeds.
      if (cursor !== deck.cursor && cursor !== deck.cursor + 3) return null;
      deck = { ...deck, cursor };
      return deck;
    },
  };
}
