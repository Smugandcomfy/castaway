import Array "mo:core/Array";
import Blob "mo:core/Blob";
import Debug "mo:core/Debug";
import Nat "mo:core/Nat";
import Runtime "mo:core/Runtime";
import VarArray "mo:core/VarArray";

import Answers "../backend/oracle/Answers";
import Cast "../backend/oracle/Cast";
import Hexagrams "../backend/oracle/Hexagrams";

/// Run with `mops test`. None of this needs Neutron: Cast.reading takes a Blob
/// and an Int, so the whole oracle is exercisable with a fixed entropy blob.

func check(name : Text, condition : Bool) {
  if (not condition) { Runtime.trap("FAILED: " # name) };
  Debug.print("ok  " # name);
};

// ---------------------------------------------------------- the King Wen table

// Every one of the 64 line patterns must map to a distinct number in 1..64.
do {
  let seen = VarArray.repeat<Bool>(false, 65);
  for (pattern in Nat.range(0, 64)) {
    let lines = Array.tabulate<Nat>(
      6,
      func(i) { if ((pattern / (2 ** i)) % 2 == 1) 7 else 8 },
    );
    let n = Hexagrams.kingWen(lines);
    check("king wen " # debug_show (pattern) # " in range", n >= 1 and n <= 64);
    check("king wen " # debug_show (n) # " not repeated", not seen[n]);
    seen[n] := true;
  };
  Debug.print("ok  king wen table is a bijection over 1..64");
};

// The eight doubled trigrams are the ones everyone knows by heart.
do {
  let allYang = Array.repeat<Nat>(7, 6);
  let allYin = Array.repeat<Nat>(8, 6);
  check("hexagram 1 is six yang", Hexagrams.kingWen(allYang) == 1);
  check("hexagram 2 is six yin", Hexagrams.kingWen(allYin) == 2);
  // 63 Ji Ji: fire below, water above -> yang yin yang yin yang yin
  check("hexagram 63", Hexagrams.kingWen([7, 8, 7, 8, 7, 8]) == 63);
  // 64 Wei Ji is its complement
  check("hexagram 64", Hexagrams.kingWen([8, 7, 8, 7, 8, 7]) == 64);
};

// Names and glyphs must exist for all 64 without trapping.
do {
  for (n in Nat.range(1, 65)) {
    check("name " # debug_show (n), Hexagrams.pinyin(n) != "");
    check("english " # debug_show (n), Hexagrams.english(n) != "");
    check("glyph " # debug_show (n), Hexagrams.glyph(n) != "");
  };
  Debug.print("ok  all 64 hexagrams have a name and a glyph");
};

// ------------------------------------------------------------------- lines

do {
  check("6 is yin and changing", not Hexagrams.isYang(6) and Hexagrams.isChanging(6));
  check("7 is yang and settled", Hexagrams.isYang(7) and not Hexagrams.isChanging(7));
  check("8 is yin and settled", not Hexagrams.isYang(8) and not Hexagrams.isChanging(8));
  check("9 is yang and changing", Hexagrams.isYang(9) and Hexagrams.isChanging(9));
  check("old yin becomes yang", Hexagrams.transform(6) == 7);
  check("old yang becomes yin", Hexagrams.transform(9) == 8);
  check("settled lines do not move", Hexagrams.transform(7) == 7 and Hexagrams.transform(8) == 8);
};

// -------------------------------------------------------------- the verdict

do {
  check("three movers is non-committal", Cast.verdict([6, 6, 6, 7, 7, 7], null, 3) == #noncommittal);
  check("mostly yang is affirmative", Cast.verdict([7, 7, 7, 7, 8, 8], null, 0) == #affirmative);
  check("mostly yin is negative", Cast.verdict([8, 8, 8, 8, 7, 7], null, 0) == #negative);
  check(
    "balanced with no movers withholds",
    Cast.verdict([7, 7, 7, 8, 8, 8], null, 0) == #noncommittal,
  );
  check(
    "balanced defers to where it is going",
    Cast.verdict([9, 7, 7, 8, 8, 8], ?[8, 7, 7, 8, 8, 8], 1) == #negative,
  );
};

// ------------------------------------------------------ the whole pipeline

// Deterministic for fixed entropy, and internally consistent for many seeds.
do {
  var affirmative = 0;
  var noncommittal = 0;
  var negative = 0;

  for (seed in Nat.range(0, 1000)) {
    let bytes = Blob.fromArray(
      Array.tabulate<Nat8>(32, func(i) { Nat.toNat8((seed * 31 + i * 7) % 256) }),
    );
    let r = Cast.reading(1, "will it rain", bytes, seed);

    check("six lines", r.primary.lines.size() == 6);
    check("number in range", r.primary.number >= 1 and r.primary.number <= 64);
    check("answer is not empty", r.answer != "");

    // changingLines must agree with the lines themselves
    let actual = Array.filterMap<Nat, Nat>(
      Array.tabulate<Nat>(6, func(i) { i }),
      func(i) { if (Hexagrams.isChanging(r.primary.lines[i])) ?(i + 1) else null },
    );
    check("changing lines agree", Array.equal<Nat>(actual, r.changingLines, func(a, b) { a == b }));

    // relating is present exactly when something is moving
    switch (r.relating) {
      case (?_) check("relating implies movers", r.changingLines.size() > 0);
      case null check("no movers implies no relating", r.changingLines.size() == 0);
    };

    switch (r.tier) {
      case (#affirmative) affirmative += 1;
      case (#noncommittal) noncommittal += 1;
      case (#negative) negative += 1;
    };
  };

  Debug.print(
    "    tiers over 1000 casts: " # debug_show (affirmative) # " / "
    # debug_show (noncommittal) # " / " # debug_show (negative)
  );
  check("all three registers occur", affirmative > 0 and noncommittal > 0 and negative > 0);
};

// Same entropy and clock must give the same reading.
do {
  let bytes = Blob.fromArray(Array.tabulate<Nat8>(32, func(i) { Nat.toNat8(i) }));
  let a = Cast.reading(1, "identical", bytes, 12345);
  let b = Cast.reading(1, "identical", bytes, 12345);
  check("reading is deterministic", a.primary.number == b.primary.number and a.answer == b.answer);

  let c = Cast.reading(1, "different question", bytes, 12345);
  check("the question changes the cast", c.primary.lines != a.primary.lines or c.primary.number != a.primary.number);
};

// --------------------------------------------------------------- answers

do {
  for (n in Nat.range(1, 65)) {
    check("affirmative " # debug_show (n), Answers.pick(#affirmative, n) != "");
    check("noncommittal " # debug_show (n), Answers.pick(#noncommittal, n) != "");
    check("negative " # debug_show (n), Answers.pick(#negative, n) != "");
  };
  Debug.print("ok  every hexagram has an answer in every register");
};

Debug.print("");
Debug.print("all oracle tests passed");
