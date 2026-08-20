// Persistent schema: keep this file immutable after release. Package imports
// are allowed; relative imports are forbidden so app-local types cannot drift.
import Array "mo:core/Array";

module {

  /// The three answer registers of the toy, reused as the oracle's verdict axis.
  public type Tier = {
    #affirmative;
    #noncommittal;
    #negative;
  };

  /// A cast hexagram. `lines` runs bottom -> top and holds the raw coin sums:
  /// 6 = old yin (changing), 7 = young yang, 8 = young yin, 9 = old yang (changing).
  public type Hexagram = {
    lines : [Nat];
    number : Nat; // King Wen number, 1-64
    pinyin : Text;
    english : Text;
    glyph : Text; // U+4DC0 + (number - 1)
  };

  public type Reading = {
    id : Nat;
    question : Text;
    timestamp : Int; // nanoseconds since epoch
    primary : Hexagram;
    relating : ?Hexagram; // present only when at least one line is changing
    changingLines : [Nat]; // 1-indexed positions, bottom -> top
    tier : Tier;
    answer : Text;
  };

  /// One card as it was laid: which card, which way up, in which position.
  /// `cardIndex` is the stable 0-77 deck position; the deck itself is frontend
  /// data and deliberately not persisted, so a card is a number here.
  public type Card = {
    cardIndex : Nat;
    reversed : Bool;
    position : Text;
  };

  /// A cast taken the whole way: question asked, three cards pulled, sigil
  /// drawn. Sealing fixes the pull, so this is the record of what the cast
  /// finally was.
  ///
  /// Note how little is kept. The question, answer, and hexagram are already
  /// on the `Reading` this points at. The sigil is a pure function of the
  /// question, the moving-line count, and these cards. The sky is recomputed
  /// from the presiding planet and the reading's timestamp -- the timestamp
  /// *is* the sky, which is why old entries gain annotations retroactively.
  /// What cannot be recomputed is which cards came up, so that is what we
  /// store.
  public type Seal = {
    readingId : Nat;
    sealedAt : Int; // nanoseconds since epoch, stamped by the canister
    movingLines : Nat; // 0-6; half of the square's election
    cards : [Card];
    /// The order of the magic square the sigil was traced on, 3-9, which is
    /// also the presiding planet (3 = Saturn ... 9 = Luna).
    ///
    /// Elected from the moving-line count *and* the sign the Moon stood in at
    /// the moment of the cast, so it is derivable — but it is recorded anyway.
    /// A sealed cast is meant to be a fixed artifact, and a rule that lives in
    /// frontend code can be improved later; storing the outcome means no past
    /// sigil is ever redrawn differently by a change nobody remembers making.
    kameaOrder : Nat;
  };

  /// A tarot draw made on the Tarot page, with no question behind it.
  public type Draw = {
    id : Text;
    drawnAt : Int; // nanoseconds since epoch
    movingLines : Nat;
    cards : [Card];
  };

  /// A sigil generated on the standalone Sigil page from a typed phrase.
  public type SigilEntry = {
    id : Text;
    madeAt : Int; // nanoseconds since epoch
    phrase : Text;
    movingLines : Nat;
    overridden : Bool; // true when the reader pinned a planet by hand
  };

  /// A free-text note attached to any journal entry, by that entry's id.
  /// Readings use the decimal form of their `Nat` id.
  public type Note = {
    entryId : Text;
    body : Text;
    updatedAt : Int; // nanoseconds since epoch
  };

  /// The Tarot page's deck. One owner, one deck, so this is a single value
  /// rather than a keyed collection.
  ///
  /// The shuffled order and the orientations are NOT stored: both are derived
  /// from `seed` on demand. Same reasoning as the sky -- persist the cause,
  /// recompute the consequence.
  public type Deck = {
    seed : Text; // 32 lowercase hex chars = 128 bits
    cursor : Nat; // 0..78, always a multiple of 3
    epoch : Nat; // 1 on first shuffle, +1 per reshuffle
    shuffledAt : Int; // nanoseconds since epoch
  };

  /// Small interface state that has to survive a reload. Deliberately a
  /// record rather than loose fields so a later flag is an additive change
  /// to one shape.
  public type Flags = {
    entered : Bool; // the splash has been passed at least once
    hasCast : Bool; // at least one question has been asked, ever
  };

  /// The chosen colour theme: "light" or "dark". Absent means "follow the
  /// system", which is the first-run default — the frontend reads
  /// prefers-color-scheme until the reader states a preference.
  public type Theme = Text;

  /// The Sky page's chosen place, by name.
  ///
  /// The name rather than the coordinates, so the place list stays the single
  /// source of truth for where anywhere actually is: correcting a coordinate
  /// later fixes every stored preference at once. A name the list no longer
  /// knows simply falls back to the default.
  public type PlaceName = Text;

  /// Managed memory root.
  ///
  /// Note what is NOT here: no principal keys, no per-user partition. A
  /// Neutron canister has exactly one owner, so every list is a single list.
  ///
  /// Everything below used to live in browser `localStorage`. It cannot stay
  /// there: an app tile is a credentialless, opaque-origin iframe with no
  /// storage and no resident persistence, so every one of those writes was
  /// silently discarded on a real install and only appeared to work in a
  /// plain browser tab during development.
  public type Mem = {
    var readings : [Reading];
    var nextId : Nat;
    var seals : [Seal];
    var draws : [Draw];
    var sigils : [SigilEntry];
    var notes : [Note];
    var deck : ?Deck;
    var flags : Flags;
    var place : ?PlaceName;
    var theme : ?Theme;
    /// Supplies ids for draws and sigils. Monotonic, never reused, so a note
    /// can never attach itself to a recycled entry.
    var nextEntryId : Nat;
  };

  public func init() : Mem {
    {
      var readings = [];
      var nextId = 1;
      var seals = [];
      var draws = [];
      var sigils = [];
      var notes = [];
      var deck = null;
      var flags = { entered = false; hasCast = false };
      var place = null;
      var theme = null;
      var nextEntryId = 1;
    };
  };

  /// Append with a hard cap, dropping oldest first, so the owner's canister
  /// cannot grow without bound from a stuck finger on the throw button.
  public func append<T>(existing : [T], entry : T, cap : Nat) : [T] {
    let grown = Array.concat<T>(existing, [entry]);
    if (grown.size() <= cap) return grown;
    Array.sliceToArray<T>(grown, grown.size() - cap, grown.size());
  };

  public func newestFirst(readings : [Reading]) : [Reading] {
    Array.reverse(readings);
  };
};
