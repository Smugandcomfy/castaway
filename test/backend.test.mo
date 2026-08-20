import Array "mo:core/Array";
import Blob "mo:core/Blob";
import Debug "mo:core/Debug";
import Nat "mo:core/Nat";
import Runtime "mo:core/Runtime";
import Text "mo:core/Text";
import NeutronCapabilities "mo:neutron-capabilities";

import Main "../backend/main";
import Memory "../backend/memory/cast_away/v1";

/// The other test file exercises the oracle in isolation: King Wen, the coin
/// arithmetic, the answer tiers. This one exercises `main.mo`'s `Init` class --
/// the part that owns managed memory, and therefore the part where a bug is
/// permanent rather than merely wrong.
///
/// Every method here is synchronous. `consult` is the one exception: it is
/// `async*` because brokered entropy is an await, and `await*` has no legal
/// home in a wasi test program. Its interesting half is `Cast.reading`, which
/// oracle.test.mo covers against a fixed entropy blob; what is left uncovered
/// is the four-line bookkeeping around it.
///
/// Run with `mops test`.

func check(name : Text, condition : Bool) {
  if (not condition) { Runtime.trap("FAILED: " # name) };
  Debug.print("ok  " # name);
};

/// A fresh backend over fresh memory. Randomness is stubbed: nothing in this
/// file calls the one method that draws on it.
func fresh() : (Main.Init, Memory.Mem) {
  let mem = Memory.init();
  let env : Main.AppBackendEnvironment = {
    stable_memory = { cast_away = mem };
    capabilities = {
      randomness = {
        fresh_bytes = func() : async* NeutronCapabilities.RandomnessResultV1 {
          #ok(Blob.fromArray([0, 0, 0, 0]));
        };
      };
    };
  };
  (Main.Init(env), mem);
};

/// `Text.join` in mo:core takes the iterator first; a loop is plainer here.
func repeat(unit : Text, n : Nat) : Text {
  var out = "";
  for (_ in Nat.range(0, n)) { out #= unit };
  out;
};

/// Put a reading in the store.
///
/// `consult` is the only method that mints one, and it is `async*` because
/// brokered entropy is an await -- which has no legal home in a wasi test
/// program. Memory is structurally typed and the test holds it, so a reading
/// can be placed directly. Everything that *points* at a reading is testable
/// this way even though the thing that creates one is not.
func addReading(mem : Memory.Mem, id : Nat) {
  let hexagram : Memory.Hexagram = {
    lines = [7, 7, 7, 7, 7, 7];
    number = 1;
    pinyin = "qian";
    english = "The Creative";
    glyph = "\u{4DC0}";
  };
  let r : Memory.Reading = {
    id;
    question = "a question";
    timestamp = 0;
    primary = hexagram;
    relating = null;
    changingLines = [];
    tier = #affirmative;
    answer = "yes";
  };
  mem.readings := Array.concat<Memory.Reading>(mem.readings, [r]);
};

/// The seal, or a trap naming what was expected.
func sealed(s : ?Main.Seal, what : Text) : Main.Seal {
  switch (s) { case (?v) v; case null Runtime.trap("FAILED: " # what) };
};

func card(i : Nat) : Main.Card {
  { cardIndex = i; reversed = false; position = "past" };
};

// ------------------------------------------------------------- initial state

do {
  let (app, mem) = fresh();
  let j = app.journal();
  check("journal starts empty", j.seals.size() == 0 and j.draws.size() == 0 and j.sigils.size() == 0 and j.notes.size() == 0);
  check("no deck before the first shuffle", j.deck == null);
  check("no place or theme preference initially", j.place == null and j.theme == null);
  check("flags start false", not j.flags.entered and not j.flags.hasCast);
  check("history starts empty", app.history().size() == 0);
  check("id counters start at 1", mem.nextId == 1 and mem.nextEntryId == 1);
};

// -------------------------------------------------------------------- deck
//
// The deck is the one piece of state a bad cursor could wedge permanently:
// a deck that has walked past a position it can never draw from again is a
// deck the reader has to reshuffle to escape.

/// True when the deck was moved; the method returns the deck it now holds.
func advanced(d : ?Main.Deck) : Bool = d != null;

do {
  let (app, _) = fresh();

  check("advance is refused when no deck exists", not advanced(app.advance_deck(1, 3)));

  let d1 = app.shuffle_deck("seed-one");
  check("first shuffle is epoch 1", d1.epoch == 1);
  check("a fresh shuffle starts at the top", d1.cursor == 0);
  check("the seed is stored as handed over", d1.seed == "seed-one");

  let d2 = app.shuffle_deck("seed-two");
  check("the epoch advances on every shuffle", d2.epoch == 2);
  check("reshuffling returns the cursor to the top", d2.cursor == 0);

  // Legal walk: one draw at a time, and standing still is allowed so a retry
  // after a dropped reply succeeds rather than wedging the page.
  switch (app.advance_deck(2, 3)) {
    case (?d) check("advance one draw is accepted, and returns the deck", d.cursor == 3 and d.epoch == 2);
    case null Runtime.trap("FAILED: advance one draw was refused");
  };
  check("advance another draw is accepted", advanced(app.advance_deck(2, 6)));
  check("advancing to the same place is accepted", advanced(app.advance_deck(2, 6)));

  // Illegal walks. Each must leave the cursor where it was.
  check("a cursor that is not a multiple of three is refused", not advanced(app.advance_deck(2, 7)));
  check("a cursor past the end of the deck is refused", not advanced(app.advance_deck(2, 81)));
  check("the deck never walks backwards", not advanced(app.advance_deck(2, 3)));
  check("the deck never skips a draw", not advanced(app.advance_deck(2, 12)));

  // The epoch is what stops a stale tab spending a deck it has never seen.
  check("an older epoch is refused", not advanced(app.advance_deck(1, 9)));
  check("a newer epoch is refused", not advanced(app.advance_deck(3, 9)));

  switch (app.journal().deck) {
    case (?d) check("every refused advance left the cursor untouched", d.cursor == 6);
    case null Runtime.trap("FAILED: the deck vanished");
  };

  // Walk it out to the end one draw at a time.
  var at = 6;
  while (at < 78) {
    at += 3;
    check("the walk reaches " # Nat.toText(at), advanced(app.advance_deck(2, at)));
  };
  switch (app.journal().deck) {
    case (?d) check("an exhausted deck rests at 78", d.cursor == 78);
    case null Runtime.trap("FAILED: the deck vanished");
  };
  check("an exhausted deck cannot be advanced further", not advanced(app.advance_deck(2, 81)));

  // A shuffle after exhaustion is the way out, and it must reset the cursor.
  let d3 = app.shuffle_deck("seed-three");
  check("shuffling an exhausted deck frees it", d3.cursor == 0 and d3.epoch == 3);
  check("the pre-shuffle epoch is now refused", not advanced(app.advance_deck(2, 3)));
  check("the new epoch works", advanced(app.advance_deck(3, 3)));
};

// ------------------------------------------------------------------- draws

do {
  let (app, mem) = fresh();

  let a = app.save_draw(2, [card(0), card(1), card(2)]);
  check("a draw is given a prefixed id", a.id == "draw-1");
  check("a draw keeps its cards in order", a.cards.size() == 3 and a.cards[2].cardIndex == 2);
  check("a draw keeps its moving-line count", a.movingLines == 2);

  let b = app.save_draw(0, []);
  check("draw ids are monotonic", b.id == "draw-2");
  check("an empty pull is storable", b.cards.size() == 0);

  check("both draws are journalled", app.journal().draws.size() == 2);

  // A pull is three cards. An unbounded card array is the one input that can
  // blow the kernel's reply budget from a single call, so it is cut here.
  let wide = app.save_draw(1, Array.tabulate<Main.Card>(40, func(i) { card(i) }));
  check("a draw keeps at most a pull's worth of cards", wide.cards.size() == 3);
  check("the cards it keeps are the first three", wide.cards[0].cardIndex == 0 and wide.cards[2].cardIndex == 2);

  addReading(mem, 1);
  let wideSeal = sealed(app.seal(1, 0, 3, Array.tabulate<Main.Card>(40, func(i) { card(i) })), "seal");
  check("a seal is bounded the same way", wideSeal.cards.size() == 3);
};

// ------------------------------------------------------------------ sigils
//
// Draws and sigils share one counter precisely so that a note keyed by id can
// never attach itself to the wrong entry.

do {
  let (app, _) = fresh();

  let d = app.save_draw(1, [card(5)]);
  let s = app.save_sigil("a phrase", 3, false);
  check("a sigil is given a prefixed id", s.id == "sigil-2");
  check("a draw and a sigil never share a number", d.id != s.id);

  let s2 = app.save_sigil("another", 4, true);
  check("the counter is shared across kinds", s2.id == "sigil-3");
  check("the override flag is kept", s2.overridden);

  // A phrase longer than the cap is cut, not rejected.
  let long = repeat("x", 600);
  let s3 = app.save_sigil(long, 0, false);
  check("an over-long phrase is truncated to the cap", Text.encodeUtf8(s3.phrase).size() == 500);

  // The cap is bytes, because that is the unit the kernel's reply budget uses.
  // Counting characters would let a journal that looks well inside its limits
  // carry four times the bytes and stop loading for good.
  let wide = repeat("\u{1F314}", 600);
  let s4 = app.save_sigil(wide, 0, false);
  check("truncation counts bytes, not characters", Text.encodeUtf8(s4.phrase).size() == 500);
  check("a four-byte character costs four", Text.size(s4.phrase) == 125);
  check("no character is ever cut in half", Text.encodeUtf8(s4.phrase).size() % 4 == 0);

  // 0..6 moving lines. A Nat is arbitrary precision, so an unguarded one is a
  // multi-kilobyte bignum in every reply that carries it.
  check("an impossible moving-line count is dropped to zero", app.save_sigil("p", 7, false).movingLines == 0);
  check("six is still six", app.save_sigil("p", 6, false).movingLines == 6);
};

// ------------------------------------------------------------------- seals
//
// One seal per reading. Sealing twice must replace, not accumulate, or "the
// cards this cast kept" stops having a single answer.

do {
  let (app, mem) = fresh();
  for (id in [1, 2, 3, 4, 5, 7, 8].vals()) { addReading(mem, id) };

  let first = sealed(app.seal(7, 2, 5, [card(1)]), "reading 7 could not be sealed");
  check("a seal keeps its reading id", first.readingId == 7);
  check("a valid kamea order is kept", first.kameaOrder == 5);

  ignore app.seal(8, 1, 6, [card(2)]);
  check("seals for different readings accumulate", app.journal().seals.size() == 2);

  let again = sealed(app.seal(7, 3, 9, [card(3), card(4)]), "reading 7 could not be resealed");
  check("resealing a reading replaces its seal", app.journal().seals.size() == 2);
  check("the replacement is the one that survives", again.cards.size() == 2);

  let survivors = Array.filter<Main.Seal>(app.journal().seals, func(s) { s.readingId == 7 });
  check("exactly one seal per reading", survivors.size() == 1);
  check("the surviving seal is the newest", survivors[0].kameaOrder == 9);

  // A seal names a reading. Without one there is nothing for it to mean, and
  // storing it would put a row in the journal that renders against nothing.
  check("sealing a reading that does not exist is refused", app.seal(9999, 0, 3, []) == null);
  check("a refused seal stores nothing", app.journal().seals.size() == 2);

  // Only 3..9 name a classical square; anything else is clamped rather than
  // stored, so no seal can point at a square that does not exist.
  check("a kamea order below three is clamped", sealed(app.seal(1, 0, 2, []), "1").kameaOrder == 3);
  check("a kamea order above nine is clamped", sealed(app.seal(2, 0, 10, []), "2").kameaOrder == 3);
  check("zero is clamped", sealed(app.seal(3, 0, 0, []), "3").kameaOrder == 3);
  check(
    "the boundaries themselves are kept",
    sealed(app.seal(4, 0, 3, []), "4").kameaOrder == 3 and sealed(app.seal(5, 0, 9, []), "5").kameaOrder == 9,
  );
};

// ------------------------------------------------------------------- notes

do {
  let (app, _) = fresh();
  let d = app.save_draw(1, [card(0)]);

  app.set_note(d.id, "first thought");
  check("a note is attached", app.journal().notes.size() == 1);

  app.set_note(d.id, "second thought");
  check("re-noting replaces rather than accumulates", app.journal().notes.size() == 1);
  check("the replacement body is the one kept", app.journal().notes[0].body == "second thought");

  app.set_note(d.id, "");
  check("an empty body removes the note", app.journal().notes.size() == 0);

  app.set_note(d.id, "   ");
  check("a whitespace-only body removes the note", app.journal().notes.size() == 0);

  let long = repeat("y", 2500);
  app.set_note(d.id, long);
  check("an over-long note is truncated to the cap", Text.encodeUtf8(app.journal().notes[0].body).size() == 600);
};

// -------------------------------------------------------------- deleting

do {
  let (app, _) = fresh();
  let d = app.save_draw(1, [card(0)]);
  let s = app.save_sigil("keep me", 2, false);
  app.set_note(d.id, "note on the draw");
  app.set_note(s.id, "note on the sigil");

  app.delete_entry(d.id);
  check("the deleted draw is gone", app.journal().draws.size() == 0);
  check("the untouched sigil remains", app.journal().sigils.size() == 1);
  check("the deleted entry's note goes with it", app.journal().notes.size() == 1);
  check("the surviving note is the other one", app.journal().notes[0].entryId == s.id);

  // Deleting something that was never there must be a no-op, not a trap.
  app.delete_entry("draw-999");
  app.delete_entry("");
  check("deleting an unknown id is harmless", app.journal().sigils.size() == 1);
};

// -------------------------------------------------------------------- caps
//
// The canister is the owner's own, but a stuck finger on a button should not
// be able to grow it without bound. Every collection drops oldest-first.

do {
  let (app, _) = fresh();
  for (i in Nat.range(0, 45)) { ignore app.save_draw(i % 7, []) };
  let draws = app.journal().draws;
  check("draws are capped", draws.size() == 40);
  check("the cap drops the oldest", draws[0].id == "draw-6");
  check("the newest survives the cap", draws[39].id == "draw-45");
};

do {
  let (app, _) = fresh();
  for (i in Nat.range(0, 20)) { ignore app.save_sigil("s", 0, false) };
  check("sigils are capped", app.journal().sigils.size() == 15);
};

do {
  let (app, mem) = fresh();
  // Distinct reading ids, or the replace-by-reading rule caps it at one -- and
  // each needs a reading to point at, or the seal is refused outright.
  for (i in Nat.range(0, 50)) { addReading(mem, i) };
  for (i in Nat.range(0, 50)) { ignore app.seal(i, 0, 3, []) };
  check("seals are capped", app.journal().seals.size() == 40);
};

do {
  let (app, _) = fresh();
  for (i in Nat.range(0, 40)) { app.set_note("entry-" # Nat.toText(i), "body") };
  check("notes are capped", app.journal().notes.size() == 20);
};

// ------------------------------------------------------- unbounded inputs
//
// Every one of these is a `Text` or a `Nat` on the wire with no bound in the
// type. One oversized field is enough to push `journal()` past the kernel's
// 64 KiB reply budget, and `journal()` runs on every mount -- so the app would
// never load again, with no way back except wiping everything.

do {
  let (app, mem) = fresh();
  addReading(mem, 1);

  let fat = repeat("q", 10_000);

  let d = app.save_draw(1, [{ cardIndex = 0; reversed = false; position = fat }]);
  check("a card position is bounded", Text.encodeUtf8(d.cards[0].position).size() == 32);

  let outOfDeck = app.save_draw(1, [{ cardIndex = 999; reversed = false; position = "past" }]);
  check("a card index outside the deck is dropped to zero", outOfDeck.cards[0].cardIndex == 0);
  check("a card index inside the deck is kept", app.save_draw(1, [card(77)]).cards[0].cardIndex == 77);

  let deck = app.shuffle_deck(fat);
  check("a deck seed is bounded", Text.encodeUtf8(deck.seed).size() == 64);

  app.set_note(fat, "a body");
  check("a note's entry id is bounded", Text.encodeUtf8(app.journal().notes[0].entryId).size() == 64);

  check("an impossible moving-line count is dropped on a draw", app.save_draw(99, []).movingLines == 0);
  check("an impossible moving-line count is dropped on a seal", sealed(app.seal(1, 99, 3, []), "seal").movingLines == 0);
};

// --------------------------------------------------- whitespace is not text

do {
  let (app, _) = fresh();

  // Space is not the only whitespace: a body of newlines has a non-zero size
  // and used to be stored as a note with nothing in it.
  app.set_note("draw-1", "a real note");
  check("a note exists to remove", app.journal().notes.size() == 1);
  app.set_note("draw-1", "\n\t\r ");
  check("a whitespace-only body removes the note", app.journal().notes.size() == 0);

  // What is shown and what is stored have to be the same string.
  app.set_note("draw-1", "  padded  ");
  check("a note is stored trimmed, as the frontend shows it", app.journal().notes[0].body == "padded");
};

// ---------------------------------------------------------------- prefs

do {
  let (app, _) = fresh();

  app.set_theme("dark");
  check("dark is accepted", app.journal().theme == ?"dark");
  app.set_theme("light");
  check("light is accepted", app.journal().theme == ?"light");
  app.set_theme("chartreuse");
  check("an unknown theme clears the preference", app.journal().theme == null);
  app.set_theme("Dark");
  check("the theme name is case-sensitive", app.journal().theme == null);
  app.set_theme("");
  check("an empty theme clears the preference", app.journal().theme == null);

  app.set_place("Reykjavík");
  check("a place is remembered", app.journal().place == ?"Reykjavík");
  app.set_place("");
  check("an empty place clears it", app.journal().place == null);

  let long = repeat("z", 200);
  app.set_place(long);
  switch (app.journal().place) {
    case (?p) check("an over-long place name is truncated", Text.encodeUtf8(p).size() == 120);
    case null Runtime.trap("FAILED: the place was dropped rather than truncated");
  };

  check("entered starts false", not app.journal().flags.entered);
  app.set_entered();
  check("entered is sticky", app.journal().flags.entered);
  app.set_entered();
  check("entering twice is harmless", app.journal().flags.entered);
};

// --------------------------------------------------------------- clearing
//
// Clearing is the journal's wipe, not the app's. Preferences are not history:
// forgetting where the reader lives, or how they like the app to look, is not
// something "clear my journal" asked for.

do {
  let (app, mem) = fresh();

  ignore app.save_draw(1, [card(0)]);
  ignore app.save_sigil("phrase", 2, false);
  ignore app.seal(1, 1, 5, [card(1)]);
  app.set_note("draw-1", "a note");
  ignore app.shuffle_deck("seed");
  app.set_entered();
  app.set_theme("dark");
  app.set_place("Kyoto");
  let beforeEntryId = mem.nextEntryId;

  app.clear();
  let j = app.journal();

  check("clearing empties the draws", j.draws.size() == 0);
  check("clearing empties the sigils", j.sigils.size() == 0);
  check("clearing empties the seals", j.seals.size() == 0);
  check("clearing empties the notes", j.notes.size() == 0);
  check("clearing empties the history", app.history().size() == 0);
  check("clearing drops the deck", j.deck == null);
  check("clearing resets hasCast", not j.flags.hasCast);

  check("clearing does not send the reader back to the splash", j.flags.entered);
  check("clearing keeps the theme", j.theme == ?"dark");
  check("clearing keeps the place", j.place == ?"Kyoto");

  // Ids must never be reused, or a note written against a deleted entry can
  // resurface attached to a new one.
  check("clearing does not rewind the id counter", mem.nextEntryId == beforeEntryId);
  let after = app.save_draw(0, []);
  check("ids continue past the clear", after.id == "draw-" # Nat.toText(beforeEntryId));

  // And a cleared app must still work.
  let d = app.shuffle_deck("after");
  check("the deck can be shuffled after a clear", d.cursor == 0);
  check("the epoch restarts once the deck is gone", d.epoch == 1);
};

// ------------------------------------------------------- the reply budget
//
// The limit on this journal is not storage, it is the reply. Every self-call
// reply is scanned against two cumulative kernel budgets before the tile sees
// it: 4,096 container elements and 64 KiB of projected JSON
// (apps/kernel/src/self_calls.ts:22, :496-501, :1773). Blow either and
// `journal()` throws -- on every mount, for good, with no way back but `clear`.
//
// So the arithmetic in main.mo's comment is asserted here instead, against a
// journal saturated with worst-case four-byte text. If someone raises a cap,
// this is what stops them.

/// Counted the way the kernel counts: a record costs its field count, a vector
/// its length, a present option one, a variant one.
func journalElements(j : Main.Journal) : Nat {
  var n = 8; // the Journal record itself
  n += j.seals.size();
  for (s in j.seals.vals()) { n += 5 + 1 + s.cards.size() * 3 };
  n += j.draws.size();
  for (d in j.draws.vals()) { n += 4 + 1 + d.cards.size() * 3 };
  n += j.sigils.size() + j.sigils.size() * 5;
  n += j.notes.size() + j.notes.size() * 3;
  n += (switch (j.deck) { case (?_) 5; case null 1 });
  n += 2; // flags
  n += (switch (j.place) { case (?_) 1; case null 1 });
  n += (switch (j.theme) { case (?_) 1; case null 1 });
  n;
};

/// The projected JSON, modelled: every stored string at its real byte length
/// plus the keys, quotes, commas and braces around it.
func journalBytes(j : Main.Journal) : Nat {
  func cards(cs : [Main.Card]) : Nat {
    var n = 2;
    for (c in cs.vals()) { n += 48 + Text.encodeUtf8(c.position).size() };
    n;
  };
  var n = 64;
  for (s in j.seals.vals()) { n += 90 + cards(s.cards) };
  for (d in j.draws.vals()) { n += 70 + Text.encodeUtf8(d.id).size() + cards(d.cards) };
  for (g in j.sigils.vals()) { n += 90 + Text.encodeUtf8(g.id).size() + Text.encodeUtf8(g.phrase).size() };
  for (t in j.notes.vals()) { n += 50 + Text.encodeUtf8(t.entryId).size() + Text.encodeUtf8(t.body).size() };
  n += (switch (j.deck) { case (?d) 90 + Text.encodeUtf8(d.seed).size(); case null 6 });
  n += (switch (j.place) { case (?pl) 12 + Text.encodeUtf8(pl).size(); case null 6 });
  n += (switch (j.theme) { case (?t) 12 + Text.encodeUtf8(t).size(); case null 6 });
  n;
};

do {
  let (app, _) = fresh();

  // Four-byte characters throughout: the worst case the caps allow.
  let wide = repeat("\u{1F314}", 800);
  let wideCards = Array.tabulate<Main.Card>(3, func(i) { { cardIndex = i; reversed = false; position = wide } });

  for (i in Nat.range(0, 60)) { ignore app.seal(i, 6, 9, wideCards) };
  for (_ in Nat.range(0, 60)) { ignore app.save_draw(6, wideCards) };
  for (_ in Nat.range(0, 40)) { ignore app.save_sigil(wide, 6, true) };
  for (i in Nat.range(0, 40)) { app.set_note(repeat("i", 200) # Nat.toText(i), wide) };
  ignore app.shuffle_deck(wide);
  app.set_place(wide);
  app.set_theme("dark");

  let j = app.journal();
  let elements = journalElements(j);
  let bytes = journalBytes(j);
  Debug.print("    saturated journal: " # Nat.toText(elements) # " elements, " # Nat.toText(bytes) # " bytes");

  check("a saturated journal stays under the kernel's element budget", elements <= 4096);
  check("a saturated journal stays under the kernel's 64 KiB reply budget", bytes <= 65536);
  // Headroom, so a future cap bump trips this test rather than a real install.
  check("and does so with room to spare", elements <= 3000 and bytes <= 55000);
};

Debug.print("backend: all checks passed");
