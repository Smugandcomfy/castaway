/// Dev-only stand-in for `neutron-tools/app`.
///
/// Aliased in by build.dev.ts, never bundled into the package. It mirrors the
/// Motoko cast closely enough that the hexagram, the reveal animation, the tier
/// colours and the tarot pull all behave exactly as they will on Neutron -- so
/// you can iterate on the frontend without a build, a package, or a replica.
///
/// If you change Cast.mo, change this too, or the preview drifts from reality.

import { KING_WEN, isYang, isChanging, transform } from "../src/kingwen";

/// Motoko `Nat`/`Int` cross the self-call wire as decimal strings —
/// `SelfCallValue` has no bigint member. This mock used to hand back BigInt,
/// so every number in the app was the wrong type in development and nobody
/// found out until it ran on a real kernel. Mirror the wire, not convenience.
const nat = (n: number | bigint): string => String(n);
const nowNat = (): string => String(Date.now() * 1_000_000);

const NAMES: [string, string][] = [
  ["Qian", "The Creative"], ["Kun", "The Receptive"], ["Zhun", "Difficulty at the Beginning"],
  ["Meng", "Youthful Folly"], ["Xu", "Waiting"], ["Song", "Conflict"], ["Shi", "The Army"],
  ["Bi", "Holding Together"], ["Xiao Chu", "The Taming Power of the Small"], ["Lu", "Treading"],
  ["Tai", "Peace"], ["Pi", "Standstill"], ["Tong Ren", "Fellowship with Others"],
  ["Da You", "Great Possession"], ["Qian", "Modesty"], ["Yu", "Enthusiasm"], ["Sui", "Following"],
  ["Gu", "Work on What Has Decayed"], ["Lin", "Approach"], ["Guan", "Contemplation"],
  ["Shi Ke", "Biting Through"], ["Bi", "Grace"], ["Bo", "Splitting Apart"], ["Fu", "Return"],
  ["Wu Wang", "Innocence"], ["Da Chu", "The Taming Power of the Great"], ["Yi", "Nourishment"],
  ["Da Guo", "Preponderance of the Great"], ["Kan", "The Abysmal"], ["Li", "The Clinging"],
  ["Xian", "Influence"], ["Heng", "Duration"], ["Dun", "Retreat"], ["Da Zhuang", "The Power of the Great"],
  ["Jin", "Progress"], ["Ming Yi", "Darkening of the Light"], ["Jia Ren", "The Family"],
  ["Kui", "Opposition"], ["Jian", "Obstruction"], ["Xie", "Deliverance"], ["Sun", "Decrease"],
  ["Yi", "Increase"], ["Guai", "Breakthrough"], ["Gou", "Coming to Meet"],
  ["Cui", "Gathering Together"], ["Sheng", "Pushing Upward"], ["Kun", "Oppression"],
  ["Jing", "The Well"], ["Ge", "Revolution"], ["Ding", "The Cauldron"], ["Zhen", "The Arousing"],
  ["Gen", "Keeping Still"], ["Jian", "Development"], ["Gui Mei", "The Marrying Maiden"],
  ["Feng", "Abundance"], ["Lu", "The Wanderer"], ["Xun", "The Gentle"], ["Dui", "The Joyous"],
  ["Huan", "Dispersion"], ["Jie", "Limitation"], ["Zhong Fu", "Inner Truth"],
  ["Xiao Guo", "Preponderance of the Small"], ["Ji Ji", "After Completion"],
  ["Wei Ji", "Before Completion"],
];

const AFFIRMATIVE = [
  "It is certain", "It is decidedly so", "Without a doubt", "Yes definitely",
  "You may rely on it", "As I see it, yes", "Most likely", "Outlook good",
  "Yes", "Signs point to yes",
];
const NONCOMMITTAL = [
  "Reply hazy, try again", "Ask again later", "Better not tell you now",
  "Cannot predict now", "Concentrate and ask again",
];
const NEGATIVE = [
  "Don't count on it", "My reply is no", "My sources say no",
  "Outlook not so good", "Very doubtful",
];

function describe(lines: number[]) {
  let index = 0;
  lines.forEach((l, i) => {
    if (isYang(l)) index += 2 ** i;
  });
  const number = KING_WEN[index];
  return {
    lines: lines.map(nat),
    number: nat(number),
    pinyin: NAMES[number - 1][0],
    english: NAMES[number - 1][1],
    glyph: String.fromCodePoint(0x4dc0 + number - 1),
  };
}

const countYang = (l: number[]) => l.filter(isYang).length;

function verdict(primary: number[], relating: number[] | null, changing: number) {
  if (changing >= 3) return "noncommittal";
  const y = countYang(primary);
  if (y >= 4) return "affirmative";
  if (y <= 2) return "negative";
  if (!relating) return "noncommittal";
  const r = countYang(relating);
  return r >= 4 ? "affirmative" : r <= 2 ? "negative" : "noncommittal";
}

let nextId = 1;
const history: any[] = [];

// Managed-memory stand-ins. These mirror backend/main.mo, including the caps
// and the replace-by-reading rule for seals — if you change that file, change
// this, or the preview drifts from the canister.
const MAX = { seals: 200, draws: 200, sigils: 200, notes: 400 };
let nextEntryId = 1;
let seals: any[] = [];
let draws: any[] = [];
let sigils: any[] = [];
let notes: any[] = [];
let deck: any = null;
let flags = { entered: false, hasCast: false };
let place: string | null = null;
let theme: string | null = null;

const nowNs = (): string => nowNat();

/// Append with a hard cap, dropping oldest first — Memory.append.
function capped<T>(list: T[], entry: T, cap: number): T[] {
  const grown = [...list, entry];
  return grown.length <= cap ? grown : grown.slice(grown.length - cap);
}

function cast(question: string) {
  // Real coins: three per line, each 2 or 3.
  const lines = Array.from({ length: 6 }, () =>
    Array.from({ length: 3 }, () => 2 + Math.round(Math.random())).reduce((a, b) => a + b, 0),
  );
  const changingLines = lines
    .map((l, i) => (isChanging(l) ? i + 1 : 0))
    .filter((n) => n > 0);
  const relatingLines = changingLines.length ? lines.map(transform) : null;
  const tier = verdict(lines, relatingLines, changingLines.length);
  const primary = describe(lines);
  const pool =
    tier === "affirmative" ? AFFIRMATIVE : tier === "negative" ? NEGATIVE : NONCOMMITTAL;

  return {
    id: nat(nextId++),
    question,
    timestamp: nowNat(),
    primary,
    // Candid `?T` is null-or-value on this wire, not the agent's [] / [v].
    relating: relatingLines ? describe(relatingLines) : null,
    changingLines: changingLines.map(nat),
    tier: { [tier]: null },
    answer: pool[(Number(primary.number) - 1) % pool.length],
  };
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function loadNeutronCanisterId() {
  return "aaaaa-aa";
}

/// The kernel's preapproved self-call routes. This file previously exported a
/// `createCanisterClient(...).call(method, args)` that the real SDK does not
/// have — the app was written against the mock's invention and therefore
/// could not work on a real kernel at all. `querySelf` and `updateSelf` are
/// the actual API; both are free functions.
export function querySelf(method: string, args: any[] = [], _timeout?: number) {
  return dispatch(method, args);
}

export function updateSelf(method: string, args: any[] = [], _timeout?: number) {
  return dispatch(method, args);
}

export function callCanisterDialog(
  req: { method: string; args: any[] },
  _timeout?: number,
) {
  return dispatch(req.method, req.args);
}

function dispatch(method: string, args: any[]) {
  // The wire hands over exactly ONE argument, and the kernel's schema is the
  // authority: every method's input has a single top-level element. Motoko
  // arity is what misleads — `(a, b)` is one tuple, `(a)` is just `a`, and
  // `()` is null. Unpack it the way the kernel does, or this mock goes back to
  // agreeing with a frontend that the real canister rejects.
  const arg = args[0] ?? null;
  const tuple: any[] = Array.isArray(arg) ? arg : [arg];
  return (async () => {
      // Roughly the latency of a real update call, so the UI is honest about waiting.
      await delay(method === "consult" ? 900 : 120);
      switch (method) {
        case "consult": {
          // A two-arm ok/err variant is unwrapped by the kernel: the `ok`
          // payload comes back bare and the `err` payload is *thrown*
          // (apps/kernel/src/self_calls.ts:1609-1621). Mirroring that here is
          // the whole point of this file -- returning `{ok: r}` is what let
          // the real bug hide behind a green suite.
          const q = String(tuple[0] ?? "").trim();
          if (!q) throw "Ask a question first.";
          if (q.length > 500) throw "Keep the question under 500 characters.";
          const r = cast(q);
          history.push(r);
          flags = { ...flags, hasCast: true };
          return r;
        }
        case "history":
          return [...history].reverse();
        case "stats": {
          const count = (t: string) => history.filter((r) => t in r.tier).length;
          return {
            totalReadings: nat(history.length),
            affirmative: nat(count("affirmative")),
            noncommittal: nat(count("noncommittal")),
            negative: nat(count("negative")),
          };
        }
        case "journal":
          return {
            seals,
            draws,
            sigils,
            notes,
            deck: deck ?? null,
            flags,
            place: place ?? null,
            theme: theme ?? null,
          };
        case "seal": {
          const [readingId, movingLines, kameaOrder, cards] = tuple;
          const order = Number(kameaOrder) < 3 || Number(kameaOrder) > 9 ? 3 : Number(kameaOrder);
          const entry = {
            readingId: nat(readingId),
            sealedAt: nowNs(),
            movingLines: nat(movingLines),
            cards,
            kameaOrder: nat(order),
          };
          seals = capped(
            seals.filter((s) => s.readingId !== nat(readingId)),
            entry,
            MAX.seals,
          );
          return entry;
        }
        case "save_draw": {
          const [movingLines, cards] = tuple;
          const entry = {
            id: `draw-${nextEntryId++}`,
            drawnAt: nowNs(),
            movingLines: nat(movingLines),
            cards,
          };
          draws = capped(draws, entry, MAX.draws);
          return entry;
        }
        case "save_sigil": {
          const [phrase, movingLines, overridden] = tuple;
          const entry = {
            id: `sigil-${nextEntryId++}`,
            madeAt: nowNs(),
            phrase: String(phrase).slice(0, 500),
            movingLines: nat(movingLines),
            overridden,
          };
          sigils = capped(sigils, entry, MAX.sigils);
          return entry;
        }
        case "set_note": {
          const [entryId, body] = tuple;
          const others = notes.filter((n) => n.entryId !== entryId);
          notes =
            String(body).trim().length === 0
              ? others
              : capped(
                  others,
                  {
                    entryId,
                    body: String(body).slice(0, 2000),
                    updatedAt: nowNs(),
                  },
                  MAX.notes,
                );
          return null;
        }
        case "delete_entry": {
          const [id] = tuple;
          draws = draws.filter((d) => d.id !== id);
          sigils = sigils.filter((s) => s.id !== id);
          notes = notes.filter((n) => n.entryId !== id);
          return null;
        }
        case "shuffle_deck": {
          const [seed] = tuple;
          const prevEpoch = deck ? Number(Number(deck.epoch)) : 0;
          deck = {
            seed,
            cursor: nat(0),
            epoch: nat(prevEpoch + 1),
            shuffledAt: nowNs(),
          };
          return deck;
        }
        case "advance_deck": {
          const cursor = Number(tuple[0]);
          if (cursor > 78 || cursor % 3 !== 0) return false;
          if (!deck) return false;
          if (cursor < Number(deck.cursor)) return false;
          deck = { ...deck, cursor: nat(cursor) };
          return true;
        }
        case "set_entered":
          flags = { ...flags, entered: true };
          return null;
        case "set_theme":
          theme = tuple[0] === "light" || tuple[0] === "dark" ? String(tuple[0]) : null;
          return null;
        case "set_place":
          place = String(tuple[0] ?? "").slice(0, 120) || null;
          return null;
        case "clear":
          history.length = 0;
          seals = [];
          draws = [];
          sigils = [];
          notes = [];
          deck = null;
          flags = { entered: flags.entered, hasCast: false };
          return null;
        default:
          throw new Error(`mock: no method ${method}`);
      }
  })();
}

export function copyToClipboard(text: string) {
  return navigator.clipboard?.writeText(text);
}
