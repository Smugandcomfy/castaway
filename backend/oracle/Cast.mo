import Array "mo:core/Array";
import Char "mo:core/Char";
import Nat "mo:core/Nat";
import Nat8 "mo:core/Nat8";
import Nat32 "mo:core/Nat32";
import Nat64 "mo:core/Nat64";

import Answers "Answers";
import Hexagrams "Hexagrams";
import Types "Types";

/// Everything about producing a reading, with no dependency on the Neutron
/// environment. The only input from outside is 32 bytes of entropy, so this
/// module is unit-testable with a fixed blob and survives any change to how
/// the kernel hands us randomness.
module {

  type Tier = Types.Tier;
  type Hexagram = Types.Hexagram;

  /// splitmix64. Small, fast, and good enough to spread three coin bits per line.
  func splitmix64(state : Nat64) : (Nat64, Nat64) {
    let next = state +% 0x9E3779B97F4A7C15;
    var z = next;
    z := (z ^ (z >> 30)) *% 0xBF58476D1CE4E5B9;
    z := (z ^ (z >> 27)) *% 0x94D049BB133111EB;
    z := z ^ (z >> 31);
    (next, z);
  };

  /// djb2 over the question's code points.
  ///
  /// This is `base`'s deprecated `Text.hash` reproduced verbatim, not swapped
  /// for a `core` equivalent. It feeds `mixSeed`, so changing it silently
  /// re-rolls every reading a given question + entropy + clock would produce,
  /// and `dev/mock.ts` would drift from the canister. Keep it byte-identical.
  func questionHash(t : Text) : Nat32 {
    var x : Nat32 = 5381;
    for (c in t.chars()) {
      x := ((x << 5) +% x) +% Char.toNat32(c);
    };
    x;
  };

  /// The question is folded into the seed alongside kernel-brokered entropy and
  /// the clock. It genuinely shapes the cast, but nobody can steer it.
  public func mixSeed(entropy : Blob, question : Text, now : Int) : Nat64 {
    var s : Nat64 = 0xCBF29CE484222325;
    for (byte in entropy.vals()) {
      s := (s ^ Nat.toNat64(Nat8.toNat(byte))) *% 0x100000001B3;
    };
    s := (s ^ Nat.toNat64(Nat32.toNat(questionHash(question)))) *% 0x100000001B3;
    s ^ Nat64.fromIntWrap(now);
  };

  /// Three coins, six times, bottom to top. Each coin is 2 or 3, so a line sums
  /// to 6 (1/8), 7 (3/8), 8 (3/8) or 9 (1/8) -- the real distribution.
  public func castLines(seed : Nat64) : [Nat] {
    var state = seed;
    Array.tabulate<Nat>(
      6,
      func(_) {
        let (nextState, bits) = splitmix64(state);
        state := nextState;
        var sum : Nat = 0;
        var b = bits;
        for (_ in Nat.range(0, 3)) {
          sum += 2 + Nat64.toNat(b & 1);
          b >>= 1;
        };
        sum;
      },
    );
  };

  public func describe(lines : [Nat]) : Hexagram {
    let number = Hexagrams.kingWen(lines);
    {
      lines;
      number;
      pinyin = Hexagrams.pinyin(number);
      english = Hexagrams.english(number);
      glyph = Hexagrams.glyph(number);
    };
  };

  func countYang(lines : [Nat]) : Nat {
    Array.foldLeft<Nat, Nat>(lines, 0, func(acc, l) { if (Hexagrams.isYang(l)) acc + 1 else acc });
  };

  /// Two independent signals come out of one cast:
  ///
  ///   changing lines -> certainty. A situation in flux cannot be pinned down,
  ///                     which is exactly what the non-committal register says.
  ///   yang/yin balance -> valence, which is the I Ching's own logic.
  ///
  /// A perfectly balanced cast defers to the relating hexagram: if the present
  /// is ambiguous, the direction of travel decides.
  public func verdict(primary : [Nat], relating : ?[Nat], changing : Nat) : Tier {
    if (changing >= 3) return #noncommittal;
    let yang = countYang(primary);
    if (yang >= 4) return #affirmative;
    if (yang <= 2) return #negative;
    switch (relating) {
      case (?other) {
        let y = countYang(other);
        if (y >= 4) #affirmative else if (y <= 2) #negative else #noncommittal;
      };
      case null #noncommittal;
    };
  };

  /// The whole pipeline: entropy in, reading out.
  public func reading(id : Nat, question : Text, entropy : Blob, now : Int) : Types.Reading {
    let lines = castLines(mixSeed(entropy, question, now));

    let changingLines = Array.filterMap<Nat, Nat>(
      Array.tabulate<Nat>(6, func(i) { i }),
      func(i) { if (Hexagrams.isChanging(lines[i])) ?(i + 1) else null },
    );

    let relatingLines : ?[Nat] = if (changingLines.size() == 0) null else {
      ?Array.map<Nat, Nat>(lines, Hexagrams.transform);
    };

    let primary = describe(lines);
    let tier = verdict(lines, relatingLines, changingLines.size());

    {
      id;
      question;
      timestamp = now;
      primary;
      relating = switch (relatingLines) {
        case (?rl) ?describe(rl);
        case null null;
      };
      changingLines;
      tier;
      answer = Answers.pick(tier, primary.number);
    };
  };
};
