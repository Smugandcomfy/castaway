/// Everything the frontend persists, and the one place it talks to the
/// canister about it.
///
/// This used to be three localStorage modules. It cannot be: an app tile is a
/// credentialless, opaque-origin iframe with no storage and no resident
/// persistence, so those writes were silently discarded on a real install and
/// only appeared to work in a plain browser tab during development.
///
/// Candid gives us `Nat`/`Int` as bigint and `?T` as `[]`/`[value]`. All of
/// that is normalised here, at the boundary, so the rest of the app keeps
/// working in plain numbers and nulls.

import { createCanisterClient, loadNeutronCanisterId } from "neutron-tools/app";
import type { DeckState } from "./epochdeck";

// ------------------------------------------------------------------- types

export interface SavedCard {
  cardIndex: number;
  reversed: boolean;
  position: string;
}

export interface Seal {
  readingId: number;
  sealedAt: number; // ms since epoch
  movingLines: number;
  cards: SavedCard[];
  /// The magic square the sigil was traced on, 3-9, which is also its
  /// presiding planet. Recorded rather than re-derived so a sealed cast is
  /// never redrawn differently by a later change to the election rule.
  kameaOrder: number;
}

export interface Draw {
  id: string;
  drawnAt: number; // ms since epoch
  movingLines: number;
  cards: SavedCard[];
}

export interface SigilEntry {
  id: string;
  madeAt: number; // ms since epoch
  phrase: string;
  movingLines: number;
  overridden: boolean;
}

export interface Note {
  entryId: string;
  body: string;
  updatedAt: number; // ms since epoch
}

export interface Flags {
  entered: boolean;
  hasCast: boolean;
}

export interface Journal {
  seals: Seal[];
  draws: Draw[];
  sigils: SigilEntry[];
  notes: Note[];
  deck: DeckState | null;
  flags: Flags;
  /// The Sky page's chosen place, by name. Null until one is picked.
  place: string | null;
  /// "light" | "dark", or null while the reader follows their system.
  theme: string | null;
}

// ------------------------------------------------------------------ client

/// The kernel client, created once and shared. Its exact shape differs
/// between the real SDK and dev/mock.ts, so it is held loosely here and the
/// typing that matters is applied to each call's result instead.
type Caller = { call(method: string, args: unknown[]): Promise<unknown> };

let clientPromise: Promise<Caller> | null = null;

function client(): Promise<Caller> {
  if (clientPromise === null) {
    clientPromise = (async () =>
      createCanisterClient(await loadNeutronCanisterId()) as unknown as Caller)();
  }
  return clientPromise;
}

async function call<T>(method: string, args: unknown[] = []): Promise<T> {
  const c = await client();
  return (await c.call(method, args)) as T;
}

// -------------------------------------------------------------- normalising

const num = (v: bigint | number): number => Number(v);

/// Canister timestamps are nanoseconds; the browser works in milliseconds.
const msOf = (v: bigint | number): number =>
  typeof v === "bigint" ? Number(v / 1_000_000n) : Math.floor(v / 1_000_000);

/// Candid `Nat` for a card index arrives as bigint.
const cardOf = (c: {
  cardIndex: bigint | number;
  reversed: boolean;
  position: string;
}): SavedCard => ({
  cardIndex: num(c.cardIndex),
  reversed: c.reversed,
  position: c.position,
});

/// Candid `?T` is `[]` or `[value]`.
const optOf = <A, B>(o: A[] | undefined, f: (a: A) => B): B | null =>
  o && o.length > 0 ? f(o[0]) : null;

// --------------------------------------------------------------- the journal
//
// One query returns the whole journal, so a mount costs one round trip rather
// than six. The result is cached; every mutation folds its own result back in
// rather than re-fetching, so a write costs one call too.

let cache: Journal | null = null;
let inflight: Promise<Journal> | null = null;

async function fetchJournal(): Promise<Journal> {
  const raw = await call<{
    seals: {
      readingId: bigint | number;
      sealedAt: bigint | number;
      movingLines: bigint | number;
      kameaOrder: bigint | number;
      cards: { cardIndex: bigint | number; reversed: boolean; position: string }[];
    }[];
    draws: {
      id: string;
      drawnAt: bigint | number;
      movingLines: bigint | number;
      cards: { cardIndex: bigint | number; reversed: boolean; position: string }[];
    }[];
    sigils: {
      id: string;
      madeAt: bigint | number;
      phrase: string;
      movingLines: bigint | number;
      overridden: boolean;
    }[];
    notes: { entryId: string; body: string; updatedAt: bigint | number }[];
    deck:
      | {
          seed: string;
          cursor: bigint | number;
          epoch: bigint | number;
          shuffledAt: bigint | number;
        }[]
      | undefined;
    flags: { entered: boolean; hasCast: boolean };
    place: string[] | undefined;
    theme: string[] | undefined;
  }>("journal");

  const journal: Journal = {
    seals: raw.seals.map((s) => ({
      readingId: num(s.readingId),
      sealedAt: msOf(s.sealedAt),
      movingLines: num(s.movingLines),
      kameaOrder: num(s.kameaOrder),
      cards: s.cards.map(cardOf),
    })),
    draws: raw.draws.map((d) => ({
      id: d.id,
      drawnAt: msOf(d.drawnAt),
      movingLines: num(d.movingLines),
      cards: d.cards.map(cardOf),
    })),
    sigils: raw.sigils.map((s) => ({
      id: s.id,
      madeAt: msOf(s.madeAt),
      phrase: s.phrase,
      movingLines: num(s.movingLines),
      overridden: s.overridden,
    })),
    notes: raw.notes.map((n) => ({
      entryId: n.entryId,
      body: n.body,
      updatedAt: msOf(n.updatedAt),
    })),
    deck: optOf(raw.deck, (d) => ({
      seed: d.seed,
      cursor: num(d.cursor),
      epoch: num(d.epoch),
      shuffledAt: msOf(d.shuffledAt),
    })),
    flags: raw.flags,
    place: optOf(raw.place, (p) => p),
    theme: optOf(raw.theme, (t) => t),
  };

  cache = journal;
  return journal;
}

/// The journal, fetched once and then served from memory. `force` re-reads.
export function loadJournal(force = false): Promise<Journal> {
  if (cache !== null && !force) return Promise.resolve(cache);
  if (inflight === null) {
    inflight = fetchJournal().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/// What we already know, without waiting. Null before the first load.
export function journalCache(): Journal | null {
  return cache;
}

function patch(f: (j: Journal) => Journal): void {
  if (cache !== null) cache = f(cache);
}

// ------------------------------------------------------------------ writing

export async function seal(input: {
  readingId: number;
  movingLines: number;
  kameaOrder: number;
  cards: SavedCard[];
}): Promise<Seal> {
  const raw = await call<{
    readingId: bigint | number;
    sealedAt: bigint | number;
    movingLines: bigint | number;
    kameaOrder: bigint | number;
    cards: { cardIndex: bigint | number; reversed: boolean; position: string }[];
  }>("seal", [
    BigInt(input.readingId),
    BigInt(input.movingLines),
    BigInt(input.kameaOrder),
    input.cards.map((c) => ({
      cardIndex: BigInt(c.cardIndex),
      reversed: c.reversed,
      position: c.position,
    })),
  ]);

  const entry: Seal = {
    readingId: num(raw.readingId),
    sealedAt: msOf(raw.sealedAt),
    movingLines: num(raw.movingLines),
    kameaOrder: num(raw.kameaOrder),
    cards: raw.cards.map(cardOf),
  };
  patch((j) => ({
    ...j,
    seals: [
      ...j.seals.filter((s) => s.readingId !== entry.readingId),
      entry,
    ],
  }));
  return entry;
}

export async function saveDraw(input: {
  movingLines: number;
  cards: SavedCard[];
}): Promise<Draw> {
  const raw = await call<{
    id: string;
    drawnAt: bigint | number;
    movingLines: bigint | number;
    cards: { cardIndex: bigint | number; reversed: boolean; position: string }[];
  }>("save_draw", [
    BigInt(input.movingLines),
    input.cards.map((c) => ({
      cardIndex: BigInt(c.cardIndex),
      reversed: c.reversed,
      position: c.position,
    })),
  ]);
  const entry: Draw = {
    id: raw.id,
    drawnAt: msOf(raw.drawnAt),
    movingLines: num(raw.movingLines),
    cards: raw.cards.map(cardOf),
  };
  patch((j) => ({ ...j, draws: [...j.draws, entry] }));
  return entry;
}

export async function saveSigil(input: {
  phrase: string;
  movingLines: number;
  overridden: boolean;
}): Promise<SigilEntry> {
  const raw = await call<{
    id: string;
    madeAt: bigint | number;
    phrase: string;
    movingLines: bigint | number;
    overridden: boolean;
  }>("save_sigil", [
    input.phrase,
    BigInt(input.movingLines),
    input.overridden,
  ]);
  const entry: SigilEntry = {
    id: raw.id,
    madeAt: msOf(raw.madeAt),
    phrase: raw.phrase,
    movingLines: num(raw.movingLines),
    overridden: raw.overridden,
  };
  patch((j) => ({ ...j, sigils: [...j.sigils, entry] }));
  return entry;
}

/// An empty body removes the note.
export async function setNote(entryId: string, body: string): Promise<void> {
  await call("set_note", [entryId, body]);
  const trimmed = body.trim();
  patch((j) => ({
    ...j,
    notes:
      trimmed.length === 0
        ? j.notes.filter((n) => n.entryId !== entryId)
        : [
            ...j.notes.filter((n) => n.entryId !== entryId),
            { entryId, body: trimmed, updatedAt: Date.now() },
          ],
  }));
}

export async function deleteEntry(id: string): Promise<void> {
  await call("delete_entry", [id]);
  patch((j) => ({
    ...j,
    draws: j.draws.filter((d) => d.id !== id),
    sigils: j.sigils.filter((s) => s.id !== id),
    notes: j.notes.filter((n) => n.entryId !== id),
  }));
}

// --------------------------------------------------------------------- deck

export async function shuffleDeck(seed: string): Promise<DeckState> {
  const raw = await call<{
    seed: string;
    cursor: bigint | number;
    epoch: bigint | number;
    shuffledAt: bigint | number;
  }>("shuffle_deck", [seed]);
  const deck: DeckState = {
    seed: raw.seed,
    cursor: num(raw.cursor),
    epoch: num(raw.epoch),
    shuffledAt: msOf(raw.shuffledAt),
  };
  patch((j) => ({ ...j, deck }));
  return deck;
}

/// Returns false when the canister refused the cursor — it only accepts a
/// legal resting place for a deck walked three at a time, and never backwards.
export async function advanceDeck(cursor: number): Promise<boolean> {
  const ok = await call<boolean>("advance_deck", [BigInt(cursor)]);
  if (ok) {
    patch((j) => ({ ...j, deck: j.deck ? { ...j.deck, cursor } : null }));
  }
  return ok;
}

// -------------------------------------------------------------------- flags

export async function setEntered(): Promise<void> {
  await call("set_entered");
  patch((j) => ({ ...j, flags: { ...j.flags, entered: true } }));
}

/// Remember the Sky page's place. An empty name forgets it.
export async function setPlace(name: string): Promise<void> {
  await call("set_place", [name]);
  patch((j) => ({ ...j, place: name.length === 0 ? null : name }));
}

/// Remember the colour theme. Anything other than "light" or "dark" returns
/// the reader to following their system setting.
export async function setTheme(name: string): Promise<void> {
  await call("set_theme", [name]);
  patch((j) => ({
    ...j,
    theme: name === "light" || name === "dark" ? name : null,
  }));
}

/// `hasCast` is set by the canister inside `consult`, so the frontend never
/// writes it — it just needs to know after a cast.
export function markCastLocally(): void {
  patch((j) => ({ ...j, flags: { ...j.flags, hasCast: true } }));
}

// -------------------------------------------------------------------- clear

/// Wipes readings, seals, draws, sigils, notes and the deck. The chosen place
/// survives: it is a preference, not history, and clearing the journal should
/// not make the Sky page forget where the reader lives.
export async function clearAll(): Promise<void> {
  await call("clear");
  cache = null;
  await loadJournal(true);
}
