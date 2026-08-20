/// The whole cast, in plain paragraphs.
///
/// The math panel documents every constant; this one just tells you what
/// happens, in order, from pressing the button to the thing you keep. Same
/// facts, no formulas.

export function Summary() {
  return (
    <div className="ca-faq ca-summary">
      <section className="ca-faq-item">
        <p className="nt-text">
          <strong>The entropy.</strong> When you press consult, the canister
          asks the Internet Computer for 32 bytes of randomness through
          Neutron's <code>randomness</code> capability, which brokers the
          management canister's <code>raw_rand</code>. The network's nodes
          agree on those bytes together, so no single machine chose them and
          nobody can predict them in advance. Those bytes, your question's
          text, and the clock down to the nanosecond are folded into one
          64-bit number by FNV-1a. That number is the seed, and everything
          after it is arithmetic. This is why your question genuinely shapes
          the reading — change one letter and you get a different cast — but
          you can't steer it, because the text is scrambled past recognition
          before it's mixed in. It's also why the same question asked twice
          never gives the same answer: the clock and the bytes have both
          moved.
        </p>

        <p className="nt-text">
          <strong>The throw.</strong> The seed drives a splitmix64 stream, and
          the oracle throws three coins six times. Each coin is worth 2 or 3,
          so each line sums to 6, 7, 8, or 9 — with the real odds you'd get
          from actual coins: 6 and 9 turn up one time in eight each, 7 and 8
          three times in eight. Six lines stack bottom to top. Nothing here is
          weighted or nudged; it's the genuine three-coin distribution, which
          is a different and less tidy thing than the yarrow-stalk method the
          older tradition used.
        </p>

        <p className="nt-text">
          <strong>The name.</strong> Each line is yang or yin, so six lines is
          a six-bit pattern — 64 possibilities. That pattern indexes the King
          Wen sequence, the traditional ordering attributed to King Wen of
          Zhou around 1100 BCE. It has no generating rule; it's a table, three
          thousand years old, carried verbatim. Out comes a number from 1 to
          64 and its name — <em>Peace</em>, <em>Standstill</em>,{" "}
          <em>The Well</em>.
        </p>

        <p className="nt-text">
          <strong>Moving lines.</strong> Each line falls as 6, 7, 8, or 9.
          Seven and eight are ordinary settled lines, but 6 and 9 are the
          extremes — all three coins tails, or all three heads — and those
          lines are <em>moving</em>: so far out they're already turning into
          their opposite. Flip every moving line and you get a second
          hexagram. The primary is where you are; the relating is where it's
          going. If nothing moved there's no second hexagram and no button,
          because the situation is settled and has nowhere to go. The page
          flips it for you at 2.4 seconds — you watched it become, and the
          button just looks back at where it started. Only the moving lines
          change, which is why the two glyphs are usually close relatives.
        </p>

        <p className="nt-text">
          <strong>The verdict.</strong> There's no hidden table saying
          "hexagram 11 means yes." The answer falls out of two things the cast
          already produced: how many lines are moving, and how many are yang.
          Three or more moving and it withholds — too much in flux to pin
          down. Otherwise, four or more yang leans yes, two or fewer leans no.
          At exactly 3 yang, dead even, the oracle stops asking what{" "}
          <em>is</em> and defers to the relating hexagram's balance instead.
          That's the only place the second hexagram touches the answer. The
          hexagram's number then picks which exact sentence you get from that
          register — ten affirmative, five non-committal, five negative, the
          twenty answers of the Magic 8-Ball. Because the rule is symmetric
          over honest coin odds, it lands at roughly 36% yes, 28% withholding,
          36% no. The toy 8-Ball is rigged cheerful at 50/25/25; this one
          isn't.
        </p>

        <p className="nt-text">
          <strong>The cards.</strong> Three cards are dealt from the 78 by a
          partial Fisher–Yates over the deck, seeded from the reading's
          identity — its id, its hexagram, your question, and a fresh nonce.
          The nonce is why re-rolling gives you different cards; everything
          else is why the same reading and nonce always give the same three.
          They're commentary, never a second verdict: the position labels
          deliberately avoid past/present/future so the cards can't appear to
          contradict the coins.
        </p>

        <p className="nt-text">
          <strong>The sigil.</strong> This is the part that gathers
          everything. A square is elected first — the sign the Moon stood in
          when you cast has a traditional ruling planet, and your moving-line
          count steps that many places along the Chaldean order, which happens
          to be exactly the order of the seven magic squares from Saturn's 3×3
          to Luna's 9×9. Then your question is reduced the way Austin Osman
          Spare reduced a statement of intent: uppercase it, strike every
          repeated letter, keep the first occurrences in order. Each surviving
          letter becomes a number, each number a cell on that square, and the
          cells are joined in sequence — circle where it begins, bar where it
          ends. Finally the three cards append one cell each, in the order you
          laid them, with a reversed card taking the mirrored cell so the
          figure turns back on itself. Nobody else's cast draws that line.
        </p>

        <p className="nt-text">
          <strong>Sealing.</strong> Drawing the sigil seals the cast: the pull
          stops being re-rollable and the whole thing becomes one journal
          entry. The sigil is also stamped with the Mansion of the Moon it was
          made under — one of 28 divisions of the zodiac from Agrippa, each
          exactly 90/7 degrees wide, which is why seven of them fit precisely
          into each quarter of the circle. The stamp reads the moment of{" "}
          <em>making</em>, not the moment of casting, because in the tradition
          mansions elect the time of the operation. Cast Monday and seal
          Wednesday and the two will differ; that's information about your
          timing, not a mistake.
        </p>

        <p className="nt-text">
          <strong>What's kept.</strong> Very little, deliberately. The
          canister stores your readings, which three cards a seal kept, which
          square it used, and a timestamp. It doesn't store the sigil, because
          the sigil is a function of the question, the square and the cards.
          It doesn't store the sky, because the sky is a function of the
          timestamp — which is why a reading from a year ago can still tell
          you the Moon was in Scorpio and Mercury was retrograde when you
          asked. Persist the cause, recompute the consequence.
        </p>
      </section>
    </div>
  );
}
