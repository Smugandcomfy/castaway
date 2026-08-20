import Char "mo:core/Char";
import Nat "mo:core/Nat";
import Nat32 "mo:core/Nat32";

module {

  /// King Wen numbers indexed by the 6-bit line pattern.
  ///
  /// Bit i is set when line i (0 = bottom) is yang. That means bits 0-2 are the
  /// lower trigram and bits 3-5 the upper trigram, so the index is exactly
  /// `upper * 8 + lower` under the trigram encoding
  /// Kun 0, Zhen 1, Kan 2, Dui 3, Gen 4, Li 5, Xun 6, Qian 7.
  ///
  /// This is a table rather than a formula on purpose: the King Wen ordering has
  /// no known generating rule beyond its pairing scheme.
  let KING_WEN : [Nat] = [
    // upper Kun
    2, 24, 7, 19, 15, 36, 46, 11,
    // upper Zhen
    16, 51, 40, 54, 62, 55, 32, 34,
    // upper Kan
    8, 3, 29, 60, 39, 63, 48, 5,
    // upper Dui
    45, 17, 47, 58, 31, 49, 28, 43,
    // upper Gen
    23, 27, 4, 41, 52, 22, 18, 26,
    // upper Li
    35, 21, 64, 38, 56, 30, 50, 14,
    // upper Xun
    20, 42, 59, 61, 53, 37, 57, 9,
    // upper Qian
    12, 25, 6, 10, 33, 13, 44, 1,
  ];

  /// Indexed by King Wen number - 1.
  let NAMES : [(Text, Text)] = [
    ("Qian", "The Creative"),
    ("Kun", "The Receptive"),
    ("Zhun", "Difficulty at the Beginning"),
    ("Meng", "Youthful Folly"),
    ("Xu", "Waiting"),
    ("Song", "Conflict"),
    ("Shi", "The Army"),
    ("Bi", "Holding Together"),
    ("Xiao Chu", "The Taming Power of the Small"),
    ("Lu", "Treading"),
    ("Tai", "Peace"),
    ("Pi", "Standstill"),
    ("Tong Ren", "Fellowship with Others"),
    ("Da You", "Great Possession"),
    ("Qian", "Modesty"),
    ("Yu", "Enthusiasm"),
    ("Sui", "Following"),
    ("Gu", "Work on What Has Decayed"),
    ("Lin", "Approach"),
    ("Guan", "Contemplation"),
    ("Shi Ke", "Biting Through"),
    ("Bi", "Grace"),
    ("Bo", "Splitting Apart"),
    ("Fu", "Return"),
    ("Wu Wang", "Innocence"),
    ("Da Chu", "The Taming Power of the Great"),
    ("Yi", "Nourishment"),
    ("Da Guo", "Preponderance of the Great"),
    ("Kan", "The Abysmal"),
    ("Li", "The Clinging"),
    ("Xian", "Influence"),
    ("Heng", "Duration"),
    ("Dun", "Retreat"),
    ("Da Zhuang", "The Power of the Great"),
    ("Jin", "Progress"),
    ("Ming Yi", "Darkening of the Light"),
    ("Jia Ren", "The Family"),
    ("Kui", "Opposition"),
    ("Jian", "Obstruction"),
    ("Xie", "Deliverance"),
    ("Sun", "Decrease"),
    ("Yi", "Increase"),
    ("Guai", "Breakthrough"),
    ("Gou", "Coming to Meet"),
    ("Cui", "Gathering Together"),
    ("Sheng", "Pushing Upward"),
    ("Kun", "Oppression"),
    ("Jing", "The Well"),
    ("Ge", "Revolution"),
    ("Ding", "The Cauldron"),
    ("Zhen", "The Arousing"),
    ("Gen", "Keeping Still"),
    ("Jian", "Development"),
    ("Gui Mei", "The Marrying Maiden"),
    ("Feng", "Abundance"),
    ("Lu", "The Wanderer"),
    ("Xun", "The Gentle"),
    ("Dui", "The Joyous"),
    ("Huan", "Dispersion"),
    ("Jie", "Limitation"),
    ("Zhong Fu", "Inner Truth"),
    ("Xiao Guo", "Preponderance of the Small"),
    ("Ji Ji", "After Completion"),
    ("Wei Ji", "Before Completion"),
  ];

  public func isYang(line : Nat) : Bool = line == 7 or line == 9;

  public func isChanging(line : Nat) : Bool = line == 6 or line == 9;

  /// Old yin becomes yang, old yang becomes yin; settled lines stay put.
  public func transform(line : Nat) : Nat {
    switch (line) {
      case (6) 7;
      case (9) 8;
      case (n) n;
    };
  };

  /// A hexagram is six lines. The table has sixty-four entries, so seven lines
  /// would index past the end and trap; both callers pass exactly six, but this
  /// is public and the next caller might not.
  public func kingWen(lines : [Nat]) : Nat {
    assert (lines.size() == 6);
    var index : Nat = 0;
    var bit : Nat = 1;
    for (line in lines.vals()) {
      if (isYang(line)) { index += bit };
      bit *= 2;
    };
    KING_WEN[index];
  };

  public func pinyin(number : Nat) : Text = NAMES[number - 1].0;

  public func english(number : Nat) : Text = NAMES[number - 1].1;

  /// Unicode allocates the 64 hexagrams at U+4DC0..U+4DFF in King Wen order.
  public func glyph(number : Nat) : Text {
    Char.toText(Nat32.toChar(0x4DC0 + Nat.toNat32(number - 1)));
  };
};
