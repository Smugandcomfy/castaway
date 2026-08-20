/// Unsealed tarot pulls, for the length of a session and no longer.
///
/// These are deliberately not persisted anywhere. A pull is re-rollable right
/// up until the sigil is drawn, and drawing the sigil *seals* it — at which
/// point the cast is written to the canister as a `Seal` and becomes the
/// record of what the reading finally was. Before that moment the pull has
/// not yet happened in any sense worth keeping, so a page reload losing it is
/// correct rather than a bug.
///
/// This module used to write to localStorage. That never worked in an app
/// tile — opaque origin, no storage — and it should not have been persistent
/// in the first place.

import type { DrawnCard } from "./tarot";

/// The minimum shape needed to re-render a pull without recomputing entropy.
export interface SavedCard {
  cardIndex: number;
  reversed: boolean;
  position: string;
}

const pulls = new Map<string, SavedCard[][]>();

const key = (readingId: bigint | number) => String(readingId);

export function saveTarotPull(
  readingId: bigint | number,
  pull: DrawnCard[],
): void {
  const existing = pulls.get(key(readingId)) ?? [];
  existing.push(
    pull.map((d) => ({
      cardIndex: d.card.index,
      reversed: d.reversed,
      position: d.position,
    })),
  );
  pulls.set(key(readingId), existing);
}

/// All pulls made for this reading this session, oldest first.
export function loadTarotPulls(readingId: bigint | number): SavedCard[][] {
  return pulls.get(key(readingId)) ?? [];
}
