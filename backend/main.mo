import Array "mo:core/Array";
import Char "mo:core/Char";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Time "mo:core/Time";
import NeutronCapabilities "mo:neutron-capabilities";

import Memory "./memory/cast_away/v1";
import Cast "./oracle/Cast";

module {

  // ------------------------------------------------------------ wire types
  //
  // Every type reachable from a method's output is declared here rather than
  // aliased from Types or Memory. The schema generator walks a method's
  // return type and cannot follow a qualified cross-module reference, which
  // is why apps/kitchensink declares all of its response records in main.mo
  // and never returns a memory-schema type at all.
  //
  // These cost nothing to keep: Motoko is structurally typed, so a record
  // declared identically here *is* the memory type, assignable without
  // conversion — and if the two ever drift, the compiler says so rather than
  // the wire quietly disagreeing with the store.

  public type Tier = { #affirmative; #noncommittal; #negative };

  public type Hexagram = {
    lines : [Nat];
    number : Nat;
    pinyin : Text;
    english : Text;
    glyph : Text;
  };

  public type Reading = {
    id : Nat;
    question : Text;
    timestamp : Int;
    primary : Hexagram;
    relating : ?Hexagram;
    changingLines : [Nat];
    tier : Tier;
    answer : Text;
  };

  public type Card = { cardIndex : Nat; reversed : Bool; position : Text };

  public type Seal = {
    readingId : Nat;
    sealedAt : Int;
    movingLines : Nat;
    cards : [Card];
    kameaOrder : Nat;
  };

  public type Draw = {
    id : Text;
    drawnAt : Int;
    movingLines : Nat;
    cards : [Card];
  };

  public type SigilEntry = {
    id : Text;
    madeAt : Int;
    phrase : Text;
    movingLines : Nat;
    overridden : Bool;
  };

  public type Note = { entryId : Text; body : Text; updatedAt : Int };

  public type Deck = {
    seed : Text;
    cursor : Nat;
    epoch : Nat;
    shuffledAt : Int;
  };

  public type Flags = { entered : Bool; hasCast : Bool };

  public type Journal = {
    seals : [Seal];
    draws : [Draw];
    sigils : [SigilEntry];
    notes : [Note];
    deck : ?Deck;
    flags : Flags;
    place : ?Text;
    theme : ?Text;
  };

  public type Stats = {
    totalReadings : Nat;
    affirmative : Nat;
    noncommittal : Nat;
    negative : Nat;
  };

  /// Declared structurally for the same reason as the rest.
  public type ConsultResult = { #ok : Reading; #err : Text };

  public type AppBackendEnvironment = {
    stable_memory : { cast_away : Memory.Mem };
    capabilities : { randomness : NeutronCapabilities.RandomnessV1 };
  };

  public class Init(env : AppBackendEnvironment) {

    let mem = env.stable_memory.cast_away;
    let entropy = env.capabilities.randomness;

    let MAX_QUESTION_CHARS = 500;
    let MAX_HISTORY = 200;

    // Every collection is capped and drops oldest-first. The canister is the
    // owner's own, but a stuck finger on a button should still not be able to
    // grow it without bound.
    let MAX_SEALS = 200;
    let MAX_DRAWS = 200;
    let MAX_SIGILS = 200;
    let MAX_NOTES = 400;
    let MAX_NOTE_CHARS = 2000;
    let MAX_PHRASE_CHARS = 500;
    let MAX_PLACE_CHARS = 120;
    let DECK_SIZE = 78;
    let DRAW_SIZE = 3;

    /// Asks the coins. Update, because brokered entropy is an await.
    ///
    /// Declared in `preapproved_self_calls` so a throw does not raise a kernel
    /// approval dialog every time -- without that, the app is unusable.
    public func /*update*/ consult(question : Text) : async* ConsultResult {
      let trimmed = Text.trim(question, #char ' ');
      if (Text.size(trimmed) == 0) {
        return #err("Ask a question first.");
      };
      if (Text.size(trimmed) > MAX_QUESTION_CHARS) {
        return #err("Keep the question under 500 characters.");
      };

      switch (await* entropy.fresh_bytes()) {
        case (#ok(bytes)) {
          let result = Cast.reading(mem.nextId, trimmed, bytes, Time.now());
          mem.nextId += 1;
          mem.readings := Memory.append<Reading>(mem.readings, result, MAX_HISTORY);
          mem.flags := { mem.flags with hasCast = true };
          #ok(result);
        };
        case (#err(#busy)) #err("The coins are busy. Try again in a moment.");
        case (#err(#low_cycles)) #err("The oracle is out of cycles.");
        case (#err(#management_failure)) #err("Consensus randomness request failed.");
        case (#err(#source_gone)) #err("The randomness capability is no longer available.");
      };
    };

    /// Newest first.
    public func /*query*/ history() : [Reading] {
      Memory.newestFirst(mem.readings);
    };

    public func /*query*/ stats() : Stats {
      var affirmative = 0;
      var noncommittal = 0;
      var negative = 0;
      for (r in mem.readings.vals()) {
        switch (r.tier) {
          case (#affirmative) affirmative += 1;
          case (#noncommittal) noncommittal += 1;
          case (#negative) negative += 1;
        };
      };
      {
        totalReadings = affirmative + noncommittal + negative;
        affirmative;
        noncommittal;
        negative;
      };
    };

    // ------------------------------------------------------------- journal
    //
    // All of this used to live in browser localStorage. A tile is a
    // credentialless, opaque-origin iframe with no storage and no resident
    // persistence, so those writes were silently discarded on a real install
    // and only appeared to work in a plain browser tab during development.

    /// Everything the journal, the Tarot page, and the splash need, in one
    /// query. Called on essentially every mount, so it is one round trip
    /// rather than six.
    public func /*query*/ journal() : Journal {
      {
        seals = mem.seals;
        draws = mem.draws;
        sigils = mem.sigils;
        notes = mem.notes;
        deck = mem.deck;
        flags = mem.flags;
        place = mem.place;
        theme = mem.theme;
      };
    };

    /// Seal a cast: the sigil has been drawn, so the pull is now fixed. One
    /// seal per reading -- sealing again replaces it rather than accumulating,
    /// which keeps "the cards this cast kept" a single answer.
    public func /*update*/ seal(readingId : Nat, movingLines : Nat, kameaOrder : Nat, cards : [Card]) : Seal {
      // 3..9 are the seven classical squares; anything else is a caller bug
      // and is clamped rather than stored, so no seal can name a square that
      // does not exist.
      let order = if (kameaOrder < 3 or kameaOrder > 9) 3 else kameaOrder;
      let entry : Seal = {
        readingId;
        sealedAt = Time.now();
        movingLines;
        cards;
        kameaOrder = order;
      };
      let others = Array.filter<Seal>(mem.seals, func(s) { s.readingId != readingId });
      mem.seals := Memory.append<Seal>(others, entry, MAX_SEALS);
      entry;
    };

    /// A draw made on the Tarot page, with no question behind it.
    public func /*update*/ save_draw(movingLines : Nat, cards : [Card]) : Draw {
      let entry : Draw = {
        id = "draw-" # Nat.toText(mem.nextEntryId);
        drawnAt = Time.now();
        movingLines;
        cards;
      };
      mem.nextEntryId += 1;
      mem.draws := Memory.append<Draw>(mem.draws, entry, MAX_DRAWS);
      entry;
    };

    /// A sigil generated on the standalone Sigil page from a typed phrase.
    public func /*update*/ save_sigil(phrase : Text, movingLines : Nat, overridden : Bool) : SigilEntry {
      let entry : SigilEntry = {
        id = "sigil-" # Nat.toText(mem.nextEntryId);
        madeAt = Time.now();
        phrase = truncate(phrase, MAX_PHRASE_CHARS);
        movingLines;
        overridden;
      };
      mem.nextEntryId += 1;
      mem.sigils := Memory.append<SigilEntry>(mem.sigils, entry, MAX_SIGILS);
      entry;
    };

    /// Attach, replace, or (with an empty body) remove a note.
    public func /*update*/ set_note(entryId : Text, body : Text) : () {
      let others = Array.filter<Note>(mem.notes, func(n) { n.entryId != entryId });
      if (Text.size(Text.trim(body, #char ' ')) == 0) {
        mem.notes := others;
        return;
      };
      let entry : Note = {
        entryId;
        body = truncate(body, MAX_NOTE_CHARS);
        updatedAt = Time.now();
      };
      mem.notes := Memory.append<Note>(others, entry, MAX_NOTES);
    };

    /// Remove one standalone entry and any note attached to it.
    public func /*update*/ delete_entry(id : Text) : () {
      mem.draws := Array.filter<Draw>(mem.draws, func(d) { d.id != id });
      mem.sigils := Array.filter<SigilEntry>(mem.sigils, func(s) { s.id != id });
      mem.notes := Array.filter<Note>(mem.notes, func(n) { n.entryId != id });
    };

    // ---------------------------------------------------------------- deck

    /// Shuffle: the only entropy event on the Tarot page, and the only place
    /// the epoch advances. The seed is minted in the browser and handed over;
    /// the canister owns the epoch and the timestamp so neither can be
    /// rewritten by a caller replaying an old state.
    public func /*update*/ shuffle_deck(seed : Text) : Deck {
      let prevEpoch = switch (mem.deck) { case (?d) d.epoch; case null 0 };
      let next : Deck = {
        seed;
        cursor = 0;
        epoch = prevEpoch + 1;
        shuffledAt = Time.now();
      };
      mem.deck := ?next;
      next;
    };

    /// Advance the cursor after a draw. Refuses anything that is not a legal
    /// resting place for a deck walked three at a time, so a malformed call
    /// cannot leave the deck in a state the page can never draw from again.
    public func /*update*/ advance_deck(cursor : Nat) : Bool {
      if (cursor > DECK_SIZE or cursor % DRAW_SIZE != 0) return false;
      switch (mem.deck) {
        case (?d) {
          if (cursor < d.cursor) return false; // the deck never walks backwards
          mem.deck := ?{ d with cursor };
          true;
        };
        case null false;
      };
    };

    // --------------------------------------------------------------- flags

    public func /*update*/ set_entered() : () {
      mem.flags := { mem.flags with entered = true };
    };

    /// Remember the colour theme. Only "light" and "dark" are accepted;
    /// anything else clears the preference and returns the reader to
    /// following their system setting.
    public func /*update*/ set_theme(name : Text) : () {
      mem.theme := if (name == "light" or name == "dark") ?name else null;
    };

    /// Remember which place the Sky page is reading from. Stored by name, so
    /// the frontend's place list remains the authority on coordinates.
    public func /*update*/ set_place(name : Text) : () {
      mem.place := if (Text.size(name) == 0) null else ?truncate(name, MAX_PLACE_CHARS);
    };

    // --------------------------------------------------------------- clear

    /// Wipes everything the owner has accumulated. The confirmation lives in
    /// the frontend; by the time this runs the decision is made.
    public func /*update*/ clear() : () {
      mem.readings := [];
      mem.seals := [];
      mem.draws := [];
      mem.sigils := [];
      mem.notes := [];
      mem.deck := null;
      mem.flags := { entered = mem.flags.entered; hasCast = false };
      // The chosen place and theme are preferences, not history: clearing the
      // journal should not reset how the app looks or forget where the reader
      // lives.
    };

    /// Text arrives from a single trusted owner, but bounded storage is a
    /// property of the schema rather than of good behaviour.
    func truncate(t : Text, cap : Nat) : Text {
      if (Text.size(t) <= cap) return t;
      var out = "";
      var n = 0;
      for (c in t.chars()) {
        if (n >= cap) return out;
        out #= Char.toText(c);
        n += 1;
      };
      out;
    };
  };

  /*---NEUTRON GENERATED BEGIN---*/

public type consult_Input = (question : Text);
public type consult_Output = ConsultResult;

public type history_Input = ();
public type history_Output = [Reading];

public type stats_Input = ();
public type stats_Output = Stats;

public type journal_Input = ();
public type journal_Output = Journal;

public type seal_Input = (readingId : Nat, movingLines : Nat, kameaOrder : Nat, cards : [Card]);
public type seal_Output = Seal;

public type save_draw_Input = (movingLines : Nat, cards : [Card]);
public type save_draw_Output = Draw;

public type save_sigil_Input = (phrase : Text, movingLines : Nat, overridden : Bool);
public type save_sigil_Output = SigilEntry;

public type set_note_Input = (entryId : Text, body : Text);
public type set_note_Output = ();

public type delete_entry_Input = (id : Text);
public type delete_entry_Output = ();

public type shuffle_deck_Input = (seed : Text);
public type shuffle_deck_Output = Deck;

public type advance_deck_Input = (cursor : Nat);
public type advance_deck_Output = Bool;

public type set_entered_Input = ();
public type set_entered_Output = ();

public type set_theme_Input = (name : Text);
public type set_theme_Output = ();

public type set_place_Input = (name : Text);
public type set_place_Output = ();

public type clear_Input = ();
public type clear_Output = ();

/*---NEUTRON GENERATED END---*/
};
