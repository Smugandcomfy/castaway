import Types "Types";

module {

  let AFFIRMATIVE : [Text] = [
    "It is certain",
    "It is decidedly so",
    "Without a doubt",
    "Yes definitely",
    "You may rely on it",
    "As I see it, yes",
    "Most likely",
    "Outlook good",
    "Yes",
    "Signs point to yes",
  ];

  let NONCOMMITTAL : [Text] = [
    "Reply hazy, try again",
    "Ask again later",
    "Better not tell you now",
    "Cannot predict now",
    "Concentrate and ask again",
  ];

  let NEGATIVE : [Text] = [
    "Don't count on it",
    "My reply is no",
    "My sources say no",
    "Outlook not so good",
    "Very doubtful",
  ];

  /// Deterministic within a tier: a given hexagram always speaks the same way.
  /// The variety comes from the cast, not from a second roll of the dice.
  public func pick(tier : Types.Tier, kingWen : Nat) : Text {
    let pool = switch (tier) {
      case (#affirmative) AFFIRMATIVE;
      case (#noncommittal) NONCOMMITTAL;
      case (#negative) NEGATIVE;
    };
    pool[(kingWen - 1) % pool.size()];
  };
};
