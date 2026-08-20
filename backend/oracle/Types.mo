import Memory "../memory/cast_away/v1";

module {

  /// Persisted types come from the locked schema. Aliasing here keeps the rest
  /// of the app's imports unchanged and centralizes the schema dependency: any
  /// change to a persisted shape has to go through a new schema version and a
  /// forward migration edge, never a silent edit here.
  public type Tier = Memory.Tier;
  public type Hexagram = Memory.Hexagram;
  public type Reading = Memory.Reading;
  public type Card = Memory.Card;
  public type Seal = Memory.Seal;
  public type Draw = Memory.Draw;
  public type SigilEntry = Memory.SigilEntry;
  public type Note = Memory.Note;
  public type Deck = Memory.Deck;
  public type Flags = Memory.Flags;
  public type PlaceName = Memory.PlaceName;

  /// Everything the journal, the Tarot page, and the splash need, in one
  /// query. A tile has no browser storage, so this runs on essentially every
  /// mount -- one round trip is worth more than a tidy set of endpoints.
  public type Journal = {
    seals : [Seal];
    draws : [Draw];
    sigils : [SigilEntry];
    notes : [Note];
    deck : ?Deck;
    flags : Flags;
    place : ?PlaceName;
  };

  /// Not persisted -- computed on the fly by stats().
  public type Stats = {
    totalReadings : Nat;
    affirmative : Nat;
    noncommittal : Nat;
    negative : Nat;
  };

  /// The result of a consult. Named rather than inline because `mogen` renders
  /// a method's return type by name into the NEUTRON GENERATED block, and emits
  /// an empty `= ;` for an anonymous variant. Every `async*` method in
  /// apps/kitchensink returns a named type for the same reason.
  public type ConsultResult = {
    #ok : Reading;
    #err : Text;
  };
};
