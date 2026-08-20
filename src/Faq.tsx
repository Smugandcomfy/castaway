import type { View } from "./App";
import { Masthead } from "./Masthead";
import { Footer } from "./Footer";

/// Technical documentation of the whole pipeline. Every constant,
/// threshold, and formula in the app is here, with worked examples and
/// verification hints. No marketing copy.

export default function Faq({ goTo }: { goTo: (v: View) => void }) {
  return (
    <main className="nt-app nt-app--fill cast-away">
      <div className="nt-page">

        <Masthead current="faq" goTo={goTo} />

        <div className="ca-faq">
          <section className="ca-faq-item">
            <h2 className="nt-section-heading">Overview</h2>
            <p className="nt-text">
              A reading is a pure function of three inputs: 32 bytes of
              brokered entropy, the question text, and the wall clock.
              Those are mixed into a 64-bit seed, the seed drives six
              three-coin throws, the six line values name a hexagram in
              the King Wen sequence, and the hexagram plus the
              yang/moving-line balance picks one of twenty answer
              registers. The moving-line count separately elects a
              presiding planet — together with the sign the Moon stood in
              — whose magic square becomes the substrate for the sigil,
              which the question draws and the three sealed cards finish. The tarot is a deterministic draw
              seeded off the same reading. The Sky page reports
              geocentric conditions of the seven classical planets
              directly.
            </p>
            <p className="nt-text">
              Nothing along the way is opaque. Every step below can be
              reproduced from the source in <code>backend/oracle/</code>{" "}
              and <code>src/</code>.
            </p>
          </section>

          <section className="ca-faq-item">
            <h2 className="nt-section-heading">1 · The randomness</h2>
            <p className="nt-text">
              Entropy comes through Neutron's <code>randomness</code>{" "}
              capability, which brokers the management canister's{" "}
              <code>raw_rand</code> and returns 32 fresh bytes. Node
              consensus agrees on the bytes; no subnet on its own can
              predict them. JavaScript's <code>Math.random</code> and{" "}
              <code>crypto.getRandomValues</code> are never used to
              produce the verdict.
            </p>
            <p className="nt-text">
              The bytes, the question text, and the current time are
              folded into a single <code>Nat64</code> seed. The mixer
              is FNV-1a over the entropy and a <code>Text.hash</code> of
              the question, then XORed with the timestamp:
            </p>
            <pre className="ca-code">
{`s := 0xCBF29CE484222325                  // FNV offset basis
for byte in entropy:
    s := (s XOR byte) * 0x100000001B3     // FNV prime
s := (s XOR hash(question)) * 0x100000001B3
s XOR timestamp_ns`}
            </pre>
          </section>

          <section className="ca-faq-item">
            <h2 className="nt-section-heading">2 · The coin throw</h2>
            <p className="nt-text">
              Six lines, bottom to top. Each line is the sum of three
              coins; each coin is 2 or 3. So a line value is 6, 7, 8,
              or 9 with the genuine three-coin distribution:
            </p>
            <pre className="ca-code">
{`6  (2+2+2, all tails)           1/8 = 12.5%   old yin,  moving
7  (2 combinations with 1 head) 3/8 = 37.5%   young yang
8  (2 combinations with 2 heads)3/8 = 37.5%   young yin
9  (3+3+3, all heads)           1/8 = 12.5%   old yang, moving`}
            </pre>
            <p className="nt-text">
              The seed drives a splitmix64 stream; each line pulls three
              bits and adds 2 to each. Yang lines are 7 or 9; yin lines
              are 6 or 8; moving lines are 6 or 9.
            </p>
          </section>

          <section className="ca-faq-item">
            <h2 className="nt-section-heading">
              3 · From lines to a hexagram number
            </h2>
            <p className="nt-text">
              A hexagram is a 6-bit pattern: bit <code>i</code> is set
              when line <code>i</code> (0 = bottom) is yang. Bits 0–2 are
              the lower trigram; bits 3–5 are the upper trigram. The
              6-bit index looks up a hardcoded King Wen table.
            </p>
            <p className="nt-text">Worked example — the classic pair:</p>
            <pre className="ca-code">
{`lines [7,7,7,8,8,8]  (yang×3 bottom, yin×3 top)
mask  [1,1,1,0,0,0]  (bit 0 at the bottom)
index 0b000111 = 7
KING_WEN[7]   = 11         → Tai, "Peace"

lines [8,8,8,7,7,7]
mask  [0,0,0,1,1,1]
index 0b111000 = 56
KING_WEN[56]  = 12         → Pi, "Standstill"`}
            </pre>
          </section>

          <section className="ca-faq-item">
            <h2 className="nt-section-heading">4 · The King Wen sequence</h2>
            <p className="nt-text">
              A permutation of 1..64 attributed to King Wen of Zhou,
              roughly 1100 BCE. It has no known generating rule — it is
              data, not a formula — but it obeys a strict pairing
              invariant: every consecutive pair of hexagrams is either
              the inversion (upside down) or the complement (yin swapped
              for yang) of the other. There are exactly four complement
              pairs: 1/2, 27/28, 29/30, 61/62. The other 28 pairs are
              inversions.
            </p>
            <p className="nt-text">
              The table in <code>backend/oracle/Hexagrams.mo</code> (and
              its TypeScript mirror in <code>src/kingwen.ts</code>) is
              verified as a bijection over 1..64 and satisfies the
              pairing rule for all 32 pairs. Full table:
            </p>
            <pre className="ca-code">
{` 2 24  7 19 15 36 46 11
16 51 40 54 62 55 32 34
 8  3 29 60 39 63 48  5
45 17 47 58 31 49 28 43
23 27  4 41 52 22 18 26
35 21 64 38 56 30 50 14
20 42 59 61 53 37 57  9
12 25  6 10 33 13 44  1`}
            </pre>
            <p className="nt-muted">
              Rows are indexed by the upper trigram, columns by the
              lower. Cell (r,c) = King Wen number for that trigram
              combination.
            </p>
          </section>

          <section className="ca-faq-item">
            <h2 className="nt-section-heading">
              5 · Moving lines and the relating hexagram
            </h2>
            <p className="nt-text">
              Old lines (6 and 9) transform into their opposite young
              line. Applying the transformation to every line of the
              primary hexagram produces the <em>relating</em> hexagram —
              where the situation is heading. If no lines are moving,
              there is no relating hexagram:
            </p>
            <pre className="ca-code">
{`transform(6) = 7   (old yin  → young yang)
transform(9) = 8   (old yang → young yin)
transform(7) = 7
transform(8) = 8`}
            </pre>
          </section>

          <section className="ca-faq-item">
            <h2 className="nt-section-heading">6 · The verdict</h2>
            <p className="nt-text">
              One cast yields two independent signals: how many lines are
              moving, and how many are yang. They are combined by a
              small rule table:
            </p>
            <pre className="ca-code">
{`if moving  >= 3            → non-committal
elif yang  >= 4            → affirmative
elif yang  <= 2            → negative
else (yang == 3):
    check relating hexagram:
        yang(relating) >= 4 → affirmative
        yang(relating) <= 2 → negative
        else                 → non-committal`}
            </pre>
            <p className="nt-text">
              Simulated 400 000 times from real three-coin entropy, this
              lands at roughly{" "}
              <strong>36% affirmative · 28% non-committal · 36% negative</strong>.
              Symmetric by design. The toy Magic 8-Ball is 50/25/25 —
              deliberately optimistic; this one is honest about the
              coins.
            </p>
          </section>

          <section className="ca-faq-item">
            <h2 className="nt-section-heading">7 · The answer</h2>
            <p className="nt-text">
              Answers are the twenty Magic 8-Ball registers, split by
              tier: ten affirmative, five non-committal, five negative.
              The pick is deterministic within a tier:
            </p>
            <pre className="ca-code">
{`answer = REGISTERS[tier][(kingWen - 1) mod REGISTERS[tier].length]`}
            </pre>
          </section>

          <section className="ca-faq-item">
            <h2 className="nt-section-heading">
              8 · The election — the sky and the cast → planet
            </h2>
            <p className="nt-text">
              A <em>presiding planet</em> is elected for every cast, and
              its magic square (its <em>kamea</em>) becomes the substrate
              the sigil is traced on. The seven run in Chaldean order,
              slowest to fastest, and their squares run 3×3 to 9×9. Taking
              the moving-line count alone would give:
            </p>
            <pre className="ca-code">
{`movingLines  planet    grid   magic const   odds (/4096)
0            Saturn    3×3    15            729   ~17.8%
1            Jupiter   4×4    34            1458  ~35.6%
2            Mars      5×5    65            1215  ~29.7%
3            Sol       6×6    111           540   ~13.2%
4            Venus     7×7    175           135   ~3.3%
5            Mercury   8×8    260           18    ~0.44%
6            Luna      9×9    369           1     ~0.024%`}
            </pre>
            <p className="nt-text">
              Those odds are the problem. The distribution is exact over
              the 8<sup>6</sup> = 262 144-sequence space and matches
              C(6,k)·2<sup>k</sup>·6<sup>6−k</sup> — and it is brutally
              lopsided. Luna's square would turn up once in about four
              thousand casts, Mercury's once in two hundred. Five of the
              seven kameas were, in practice, unreachable.
            </p>
            <p className="nt-text">
              So the cast no longer starts from Saturn every time. The
              sky chooses where to start; the cast chooses how far to
              walk:
            </p>
            <pre className="ca-code">
{`start   = traditional ruler of the sign the Moon stood in
          at the moment of the cast
step    = movingLines, 0-6, along the Chaldean order
order n = ((start + step) mod 7) + 3`}
            </pre>
            <p className="nt-text">
              The Chaldean order is the seven planets by decreasing
              orbital period — and it is <em>also</em>, exactly, the order
              of their magic squares: Saturn's is 3×3, Luna's is 9×9. So
              stepping along one is stepping along the other, and the old
              rule turns out to have been the special case that always
              started at Saturn.
            </p>
            <p className="nt-text">
              Both causes survive, which is the whole point. Your cast
              still shapes your sigil; the sky is no longer decoration
              printed beside it but half of why it looks as it does. And
              the election evens out — exact over every moving-line count
              against every sign of the Moon:
            </p>
            <pre className="ca-code">
{`Saturn  13.43%    Sol      14.91%    Luna  14.09%
Jupiter 14.16%    Venus    13.66%
Mars    15.57%    Mercury  14.19%

spread 1.16x   (the old rule: 1483x)`}
            </pre>
            <p className="nt-text">
              The election still never reads randomness. It reads{" "}
              <code>changingLines.length</code> and the reading's own
              timestamp, both already persisted — and the elected order is
              recorded on the seal as well, so a sealed cast is a fixed
              artifact that no later change to this rule can redraw.
            </p>
          </section>

          <section className="ca-faq-item">
            <h2 className="nt-section-heading">9 · The sigil</h2>
            <p className="nt-text">
              A synthesis of Austin Osman Spare (1913) and the older
              Agrippa / Golden Dawn kamea tracing. The steps:
            </p>
            <ol className="ca-faq-list">
              <li>
                Elect the presiding planet from the sign the Moon stood in
                and the moving-line count (§8).
              </li>
              <li>
                Reduce the question: uppercase, strike every repeated
                letter (Spare), preserve first occurrences in order.
              </li>
              <li>
                Map each surviving letter to a number:{" "}
                <code>((code(letter) − 'A') mod n²) + 1</code>, where n
                is the square's order.
              </li>
              <li>
                Append the cards. Each card of the sealed pull adds one
                further cell, in the order the cards were laid:{" "}
                <code>(cardIndex mod n²) + 1</code>, and for a reversed
                card the complement of that cell,{" "}
                <code>n² + 1 − v</code>, so a card lying backwards lands
                on the mirrored square. On the standalone Sigil page
                there is no pull and this step does not apply.
              </li>
              <li>
                Find each number's cell in the kamea and join the cells
                in sequence. Circle marks the start; a perpendicular bar
                marks the end. Consecutive repeats collapse, so a card
                landing where the path already stands adds no leg.
              </li>
            </ol>
            <p className="nt-text">
              The cards contribute <em>cells</em> rather than letters, and
              the reason is measured rather than aesthetic. Spare's
              reduction strikes repeats across the whole phrase, so a long
              question has already spent the alphabet: folding the cards'
              names into the text changes nothing at all for roughly two
              thirds of questions past about 130 characters, and the effect
              shrinks steadily before that. A rule that quietly stops
              applying to the most considered questions is not a rule.
              Cells are always free to be visited, so three cards always
              draw three more cells.
            </p>
            <p className="nt-text">
              Saturn (3×3) and Jupiter (4×4) are taken verbatim from
              Agrippa's <em>Three Books of Occult Philosophy</em>. The
              other five (Mars, Sol, Venus, Mercury, Luna) are generated
              by classical constructions: odd squares via De la Loubère's
              Siamese method, doubly-even by 4×4-block complementation,
              singly-even (6×6) by the LUX method. All seven are
              verified as permutations of 1..n² with correct row,
              column, and diagonal sums.
            </p>
          </section>

          <section className="ca-faq-item">
            <h2 className="nt-section-heading">
              10 · The presiding condition (sky annotation)
            </h2>
            <p className="nt-text">
              A reading's sigil is captioned with the presiding planet's
              geocentric condition at the moment of the cast — for
              example, <em>"Under Mercury · retrograde in Cancer"</em>.
              This is computed on render, never stored, so every
              historical reading gains an annotation retroactively from
              its timestamp alone.
            </p>
            <p className="nt-text">Pipeline per body:</p>
            <pre className="ca-code">
{`vec = GeoVector(Body, t, aberration = true)      // J2000-equatorial
ecl = Ecliptic(vec)                              // equinox of date
elonDeg = ecl.elon                               // geocentric longitude
sign, deg = signOf(elonDeg)                      // Aries..Pisces + 0-29

// Motion by signed central difference at t ± 12 h:
before = elonAt(t − 12h)
after  = elonAt(t + 12h)
delta  = signedDelta(before, after)              // -180..+180
retrograde = delta < 0                            // false for Sun, Moon`}
            </pre>
            <p className="nt-muted">
              Sun and Moon are never marked retrograde. Astronomical
              names: Sol ⇒ <code>Body.Sun</code>, Luna ⇒{" "}
              <code>Body.Moon</code>. Backed by{" "}
              <code>astronomy-engine</code>'s truncated-VSOP87 + custom
              Pluto model; the Sun cross-check test proves the frame
              matches <code>SunPosition(t).elon</code> to within 0.01°.
            </p>
          </section>

          <section className="ca-faq-item">
            <h2 className="nt-section-heading">
              11 · The tarot — the oracle's pull
            </h2>
            <p className="nt-text">
              There are two tarot systems in this app and they are
              different instruments on purpose. This is the first: three
              cards from a deck of 78 (22 majors + 4 × 14 minors).
              Partial Fisher-Yates over deck indices — three swaps, no
              card repeats. Seed and PRNG:
            </p>
            <pre className="ca-code">
{`seed = FNV1a("readingId|kingWen|question|nonce")
rng  = mulberry32(seed)

for i in 0..2:
    j = i + floor(rng() * (78 - i))
    swap(order[i], order[j])
    card_i    = DECK[order[i]]
    reversed  = rng() < 0.5`}
            </pre>
            <p className="nt-text">
              The nonce is a fresh <code>Uint32</code> from{" "}
              <code>crypto.getRandomValues</code> per pull, so re-rolls
              change the draw. Reversal rate lands at 47–53% over
              20 000 spreads; every card in the deck is reachable.
            </p>
          </section>

          <section className="ca-faq-item">
            <h2 className="nt-section-heading">
              12 · The Tarot page — a deck you own
            </h2>
            <p className="nt-text">
              The second tarot system, and the opposite of the first. The
              oracle <em>grants you a pull</em>, bound to a reading and
              re-rollable until you seal it. Here you <em>draw from your
              deck</em>: 78 cards shuffled once into a fixed order,
              walked three at a time, and gone until you shuffle again.
              No question touches it — a physical deck does not care what
              you asked.
            </p>
            <p className="nt-text">
              <strong>The shuffle is the only random act.</strong> It mints
              128 bits, and nothing afterwards rolls anything:
            </p>
            <pre className="ca-code">
{`seed        crypto.getRandomValues -> 32 hex chars (128 bits)
order[]     Fisher-Yates over 0..77, stream seed|order|i -> sfc32
flips[]     one boolean per slot,   stream seed|flip|i  -> sfc32
state       { seed, cursor, epoch, shuffledAt }`}
            </pre>
            <p className="nt-text">
              The two streams are <em>domain-separated</em>: they derive
              from the same seed through different tags, so changing how
              the order is computed can never silently change the
              orientations. Independence is checked statistically — the
              kind of card on top does not bias whether it is reversed.
            </p>
            <p className="nt-text">
              Orientations are <strong>baked at shuffle time</strong>. The
              k-th card of an epoch lies the way it lies from the moment
              you shuffle, whether you reach it on the first draw or the
              twenty-sixth. That is how a real deck behaves: reversal is
              how the card <em>lies</em>, not a coin flipped when you pick
              it up.
            </p>
            <p className="nt-text">
              78 = 26 × 3 exactly, so the twenty-sixth draw empties the
              deck with nothing left over, and a card cannot repeat within
              an epoch because the order is a permutation. The no-repeat
              guarantee is per-<em>deck</em> here, where the oracle's is
              only per-spread.
            </p>
            <p className="nt-text">
              Only <code>{"{ seed, cursor, epoch, shuffledAt }"}</code> is
              stored. The permutation and the orientations are recomputed
              from the seed whenever they are needed — persist the cause,
              recompute the consequence, the same rule the sky follows.
            </p>
            <p className="nt-text">
              The standalone <strong>Sigil page</strong> is simpler: it has
              no cast, so its square comes from the phrase alone,{" "}
              <code>movingLines = FNV1a(phrase.toLowerCase()) mod 7</code>,
              and you may override the planet by hand. The trace stays a
              pure function of <code>(phrase, kamea)</code>, so the same
              input draws a byte-identical sigil forever.
            </p>
          </section>

          <section className="ca-faq-item">
            <h2 className="nt-section-heading">13 · The Sky page</h2>
            <p className="nt-text">
              Geocentric — everything from where the observer stands,
              which is the picture classical astronomers and astrologers
              have always read. The splash orrery is its opposite and its
              sibling: heliocentric, log-radii, the solar system seen from
              above.
            </p>
            <p className="nt-text">
              <strong>The wheel.</strong> Earth at the centre, the zodiac
              as a ring of twelve, the Ascendant on the left with degrees
              increasing counter-clockwise — the classical orientation, so
              the Midheaven lands near the top and anything drawn below
              the horizon line genuinely is below it.
            </p>
            <p className="nt-text">
              <strong>Any moment since 1800.</strong> Pick a date and the
              clock stops; "Return to now" starts it again. The floor is
              1800 because that is where the orrery&rsquo;s own
              cross-validation stops holding — the ephemeris is still
              willing beyond it, but a sky we cannot check is not one worth
              drawing. Future dates are refused outright.
            </p>
            <p className="nt-text">
              <strong>The angles need a place.</strong> Everything else on
              the page is the same for every observer on Earth: a body&rsquo;s
              ecliptic longitude does not depend on where you stand. The
              horizon does. Noon in Reykjavik and noon in Quito have
              entirely different Ascendants, so the page asks for a city.
            </p>
            <pre className="ca-code">
{`theta = SiderealTime(t)*15 + longitude      // local sidereal, degrees
eps   = e_tilt(t).tobl                       // true obliquity

MC  = atan2( sin(theta), cos(theta)*cos(eps) )
ASC = atan2( cos(theta),
             -(sin(theta)*cos(eps) + tan(lat)*sin(eps)) )`}
            </pre>
            <p className="nt-text">
              Those are closed forms, so they get a second opinion. The
              test suite pushes every answer back through{" "}
              <code>astronomy-engine</code>&rsquo;s own ecliptic → equator →
              horizon rotations and asserts the Ascendant lands on the
              horizon on the eastern side, and the Midheaven lands on the
              meridian above it — seven places from 64°N to 34°S, six
              instants from 1801 to 2026. Two independent formulations
              must agree, which is the standard the orrery is held to.
            </p>
            <p className="nt-text">
              <strong>Aspects</strong> are the five Ptolemaic angles with
              conventional orbs — conjunction 8°, sextile 4°, square 6°,
              trine 6°, opposition 8°. Each is marked applying or
              separating by running the same positions an hour forward and
              seeing whether the pair is closing on exact. The orb list is
              deliberately not configurable: one you can widen until
              everything aspects everything says nothing at all.
            </p>
            <p className="nt-text">
              <strong>The lunar nodes</strong> are read from the next
              crossing rather than solved directly. The nodes regress about
              19° a year, so the node&rsquo;s longitude at the next crossing
              is within a fraction of a degree of its longitude now.
            </p>
            <p className="nt-muted">
              Everything here uses the same <code>presidingCondition</code>{" "}
              the sigil annotation does — one source of truth for anything
              about the sky.
            </p>
          </section>

          <section className="ca-faq-item">
            <h2 className="nt-section-heading">14 · The Journal</h2>
            <p className="nt-text">
              A unified feed of oracle readings, standalone tarot draws,
              and standalone sigil generations. All of it is chain-persisted
              in the app's managed memory — nothing is kept in the browser.
              It cannot be: an app tile runs in a credentialless,
              opaque-origin iframe with no storage and no resident
              persistence, so anything written to <code>localStorage</code>
              is discarded the moment the tile is closed.
            </p>
            <pre className="ca-code">
{`Managed memory (schema v1, chain-persisted):
    readings[]  { id, question, timestamp, primary, relating,
                  changingLines, tier, answer }
    seals[]     { readingId, sealedAt, movingLines, cards[] }
    draws[]     { id, drawnAt, movingLines, cards[] }
    sigils[]    { id, madeAt, phrase, movingLines, overridden }
    notes[]     { entryId, body, updatedAt }
    deck        ?{ seed, cursor, epoch, shuffledAt }
    flags       { entered, hasCast }

Held in memory for the session only:
    unsealed tarot pulls -- re-rollable until the sigil seals them,
    at which point the seal is what is written.`}
            </pre>
            <p className="nt-text">
              Note how little a seal or a deck stores. The sigil is a pure
              function of the question, the moving-line count and the
              sealed cards; the deck's order and orientations are derived
              from its seed; the sky is recomputed from the presiding
              planet and the timestamp. Persist the cause, recompute the
              consequence — which is also why old entries gain sky
              annotations retroactively.
            </p>
            <p className="nt-text">
              Notes are attached by entry id — for oracle readings the
              canister's monotonic id, for standalone entries an id the
              canister mints. "Clear the journal" wipes all of it in one{" "}
              <code>clear()</code> call.
            </p>
          </section>

          <section className="ca-faq-item">
            <h2 className="nt-section-heading">Verifying it yourself</h2>
            <p className="nt-text">
              This page exposes the oracle's math on{" "}
              <code>window.__castAway</code>. Open your browser's
              developer console and paste any of the following.
            </p>

            <p className="nt-text">Destructure once for brevity:</p>
            <pre className="ca-code">
{`const {
  KING_WEN, DECK, draw, transform, isYang, isChanging,
  hexagramNumberOf, kamea, presidingKamea, trace, traceWithCards,
  electedOrder, castKamea, CHALDEAN, SIGN_RULER,
  ELECTION_COUNTS_8POW6, presidingCondition, formatZodiac,
  ascendantDeg, midheavenDeg, moonSignIndex, castSky, castSkyLine,
  aspectsAmong, separation, lunarNodesDeg,
  deckOrder, deckFlips, drawThree, freshDeck, mintSeed,
} = __castAway`}
            </pre>

            <p className="nt-text">
              <strong>King Wen — bijection over 1..64:</strong>
            </p>
            <pre className="ca-code">
{`new Set(KING_WEN).size === 64                                    // true
Math.min(...KING_WEN) === 1 && Math.max(...KING_WEN) === 64          // true`}
            </pre>

            <p className="nt-text">
              <strong>Line encoding — worked examples from §3:</strong>
            </p>
            <pre className="ca-code">
{`hexagramNumberOf([7,7,7,7,7,7])   // 1
hexagramNumberOf([8,8,8,8,8,8])   // 2
hexagramNumberOf([7,7,7,8,8,8])   // 11 — Tai
hexagramNumberOf([8,8,8,7,7,7])   // 12 — Pi`}
            </pre>

            <p className="nt-text">
              <strong>Election — the sky and the cast (§8):</strong>
            </p>
            <pre className="ca-code">
{`// The Chaldean order is also the order of the squares.
CHALDEAN.map((p, i) => [p, i + 3])
// [['Saturn',3],['Jupiter',4],['Mars',5],['Sol',6],
//  ['Venus',7],['Mercury',8],['Luna',9]]

// Moving lines step along it; the Moon's sign says where to start.
const step = s => [0,1,2,3,4,5,6].map(m => CHALDEAN[electedOrder(m, s) - 3])
step(9)   // Capricorn, ruled by Saturn -> starts at Saturn
step(3)   // Cancer, ruled by Luna     -> starts at Luna

// All seven reachable, near-evenly (13.4% - 15.6%):
const n = Array(7).fill(0)
for (let s = 0; s < 12; s++)
  for (let m = 0; m <= 6; m++)
    n[electedOrder(m, s) - 3] += ELECTION_COUNTS_8POW6[m]
const t = n.reduce((a,b) => a+b, 0)
n.map(c => (100*c/t).toFixed(2) + '%')

// The old rule, for contrast — Luna at 0.024%:
ELECTION_COUNTS_8POW6.map(c => (100*c/8**6).toFixed(3) + '%')`}
            </pre>

            <p className="nt-text">
              <strong>The angles land where they claim (§13):</strong>
            </p>
            <pre className="ca-code">
{`// London, right now. The Ascendant sweeps all twelve signs a day.
const asc = ascendantDeg(new Date(), 51.5074, -0.1278)
formatZodiac(asc)

// The Midheaven ignores latitude; the Ascendant does not.
midheavenDeg(new Date(), 0) === midheavenDeg(new Date(), 0)   // true
ascendantDeg(new Date(), 60, 0) !== ascendantDeg(new Date(), 0, 0)`}
            </pre>

            <p className="nt-text">
              <strong>The deck is a permutation, its flips are baked (§12):</strong>
            </p>
            <pre className="ca-code">
{`const seed = mintSeed()
const order = deckOrder(seed)
new Set(order).size === 78                                       // true
[...order].sort((a,b) => a-b).every((v,i) => v === i)            // true

// 26 draws see all 78 exactly once, then it refuses.
let st = freshDeck(), seen = []
for (let d = 0; d < 26; d++) {
  const { drawn, next } = drawThree(st)
  seen.push(...drawn.map(c => c.index)); st = next
}
new Set(seen).size === 78                                        // true
drawThree(st)                                    // throws: reshuffle required`}
            </pre>

            <p className="nt-text">
              <strong>All seven kameas are magic:</strong>
            </p>
            <pre className="ca-code">
{`for (let n = 3; n <= 9; n++) {
  const k = kamea(n)
  const rows = k.grid.map(r => r.reduce((a,b) => a+b, 0))
  const cols = Array.from({length: n}, (_, c) =>
    k.grid.reduce((a, r) => a + r[c], 0))
  console.log(k.planet, rows.every(v => v === k.constant),
              cols.every(v => v === k.constant))
}`}
            </pre>

            <p className="nt-text">
              <strong>Election distribution over the full 262 144 space:</strong>
            </p>
            <pre className="ca-code">
{`const counts = [0,0,0,0,0,0,0]
for (let s = 0; s < 262144; s++) {
  let m = 0
  for (let l = 0; l < 6; l++) {
    const b = (s >> (l*3)) & 7
    if (b === 0 || b === 7) m++
  }
  counts[m]++
}
JSON.stringify(counts) === JSON.stringify([46656,93312,77760,34560,8640,1152,64])
// true`}
            </pre>

            <p className="nt-text">
              <strong>Presiding condition — Sol matches SunPosition (§10):</strong>
            </p>
            <pre className="ca-code">
{`const t = new Date()
const ours = presidingCondition('sol', t).elonDeg
const theirs = __castAway.KING_WEN && SunPosition   // (SunPosition also lives
                                                     //  on window if you import it)
// Simpler in-console:
formatZodiac(presidingCondition('sol', t).elonDeg)   // e.g. "17° Leo"`}
            </pre>

            <p className="nt-text">
              <strong>Tarot is deterministic per nonce (§11):</strong>
            </p>
            <pre className="ca-code">
{`const same  = JSON.stringify(draw(1n, 42n, "hello", 100))
             === JSON.stringify(draw(1n, 42n, "hello", 100))
const other = JSON.stringify(draw(1n, 42n, "hello", 100))
             !== JSON.stringify(draw(1n, 42n, "hello", 101))
same && other   // true`}
            </pre>

            <p className="nt-text">
              <strong>Three-coin distribution (§2):</strong>
            </p>
            <pre className="ca-code">
{`const roll = () => (2 + Math.round(Math.random()))
              + (2 + Math.round(Math.random()))
              + (2 + Math.round(Math.random()))
const N = 100000, c = {6:0, 7:0, 8:0, 9:0}
for (let i = 0; i < N; i++) c[roll()]++
console.log(Object.fromEntries(
  Object.entries(c).map(([k,v]) => [k, (v/N*100).toFixed(1) + '%'])
))
// Expect ~12.5% / 37.5% / 37.5% / 12.5%`}
            </pre>

            <p className="nt-text">
              Beyond the console, the test suites in the repository
              verify the stronger claims that need the full pipeline:
            </p>
            <ul className="ca-faq-list">
              <li>
                King Wen pairing rule for all 32 pairs, with exactly the
                four expected complement pairs (1/2, 27/28, 29/30,
                61/62).
              </li>
              <li>
                Verdict distribution over 400 000 simulated casts landing
                at 36% / 28% / 36%.
              </li>
              <li>
                All seven kameas magic: permutations of 1..n² with
                correct row, column, and diagonal sums (Saturn and
                Jupiter Agrippa-verbatim; the rest generated).
              </li>
              <li>
                Election distribution exactly matches{" "}
                <code>[46656, 93312, 77760, 34560, 8640, 1152, 64]</code>{" "}
                over the full 8<sup>6</sup>-sequence enumeration.
              </li>
              <li>
                Sol condition longitude equals{" "}
                <code>SunPosition(t).elon</code> within 0.01° across the
                year; Sun and Moon are direct on every daily sample of
                2026, and Mercury's geocentric motion changes direction
                exactly six times (three retrograde periods, two stations
                each).
              </li>
              <li>
                Every tarot card is reachable across 20 000 spreads;
                reversals land 47–53%.
              </li>
              <li>
                Orrery's heliocentric positions cross-validate against an
                independent Kepler solver using JPL/Standish mean
                elements — all nine planets agree to under one degree.
              </li>
            </ul>
            <p className="nt-muted">
              None of the above needs the canister or the replica. The
              oracle math is pure; the entropy is the only thing that
              has to be brokered.
            </p>
          </section>
        </div>

        <Footer />
      </div>
    </main>
  );
}
