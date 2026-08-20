import Memory "../memory/cast_away/v1";

module {

  /// Persisted types come from the locked schema. Aliasing here keeps the rest
  /// of the app's imports unchanged and centralizes the schema dependency: any
  /// change to a persisted shape has to go through a new schema version and a
  /// forward migration edge, never a silent edit here.
  public type Tier = Memory.Tier;
  public type Hexagram = Memory.Hexagram;
  public type Reading = Memory.Reading;
  /// Not persisted -- computed on the fly by stats().
  public type Stats = {
    totalReadings : Nat;
    affirmative : Nat;
    noncommittal : Nat;
    negative : Nat;
  };
};
