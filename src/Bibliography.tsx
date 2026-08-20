/// The primary sources, verbatim from BIBLIOGRAPHY.md.
///
/// Kept in the same register as the rest of the FAQ: what a thing grounds,
/// the primary source, an accessible edition — and where a construction is
/// traditional or attributed with no surviving primary text, it says so.

export function Bibliography() {
  return (
    <div className="ca-faq ca-bib">
      <section className="ca-faq-item">
        <h2 className="nt-section-heading">
          I · The Cast — hexagrams, lines, coins (FAQ §2–§5)
        </h2>

        <p className="nt-text">
          <strong>The 64 hexagrams and their received text.</strong>
          <br />
          <em>Zhouyi</em> (周易), Western Zhou, c. 1000–750 BCE; expanded with
          the "Ten Wings" commentaries by the early imperial period.
          <br />
          Access: James Legge (trans.), <em>The Yî King</em>, Sacred Books of
          the East XVI (Oxford, 1882) — public domain, sacred-texts.com;
          Richard Wilhelm (trans.), <em>I Ging</em> (1924), English by Cary F.
          Baynes, <em>The I Ching or Book of Changes</em>, Bollingen XIX
          (Princeton, 1950).
        </p>

        <p className="nt-text">
          <strong>The King Wen sequence and its pairing invariant.</strong>
          <br />
          The received ordering, traditionally attributed to King Wen of Zhou
          (c. 1100 BCE); no generating rule is known — it is data, not a
          formula. The pairing rule the tests verify (每 consecutive pair is
          inversion or complement, 非覆即變, "if not overturned, then changed")
          is the classical formulation in Kong Yingda,{" "}
          <em>Zhouyi zhengyi</em> 周易正義 (Tang, 653 CE).
        </p>

        <p className="nt-text">
          <strong>The three-coin method and the moving-line transform.</strong>
          <br />
          The coin oracle belongs to the <em>Wen Wang Gua</em> / Six Lines (Liu
          Yao) tradition: founding text <em>Huo Zhu Lin</em> 火珠林 ("Fire
          Pearl Forest"), Song era, attributed to the Hemp-Robed Daoist (Mayi
          Daozhe); systematized in Wang Weide, <em>Bushi Zhengzong</em> 卜筮正宗
          ("Orthodox Divination", 1709). Ritsema &amp; Karcher (
          <em>I Ching: The Classic Chinese Oracle of Change</em>, Element,
          1994) date the method's rise to favor to the Southern Song
          (1127–1279). Grounds: the 1:3:3:1 line distribution (6/7/8/9),
          primary (<em>ben gua</em>) and relating (<em>zhi gua</em>) hexagrams,
          transform(6)=7, transform(9)=8.
        </p>

        <p className="nt-text">
          <strong>The distribution the app deliberately does not use.</strong>
          <br />
          The yarrow-stalk procedure — old yin 1/16, young yang 5/16, young yin
          7/16, old yang 3/16 — is given in the "Great Treatise" (
          <em>Xici zhuan</em> I.9, in the Ten Wings); procedure described in
          the Wilhelm–Baynes appendix. Cited so the FAQ's claim that the app
          uses the <em>genuine coin</em> distribution has its counterpoint on
          record.
        </p>
      </section>

      <section className="ca-faq-item">
        <h2 className="nt-section-heading">
          II · The Twenty Registers (FAQ §6–§7)
        </h2>

        <p className="nt-text">
          <strong>The device.</strong>
          <br />
          Albert C. Carter, "Liquid Filled Dice Agitator," U.S. Patent
          2,452,730 (filed 23 Sep 1944; granted 2 Nov 1948) — the founding
          document. Abe Bookman, U.S. Patent 3,119,621 (1964) — the agitator in
          its 8-ball form with the 20-sided die. Alabe Crafts, Inc. (1946);
          black-and-white 8-ball form commissioned by Brunswick Billiards
          (1950); now Mattel.
        </p>

        <p className="nt-text">
          <strong>The twenty answers.</strong>
          <br />
          The standard die: 10 affirmative, 5 non-committal, 5 negative — the
          split the app's registers preserve, and the 50/25/25 optimism the
          app's 36/28/36 verdict deliberately corrects.
        </p>
      </section>

      <section className="ca-faq-item">
        <h2 className="nt-section-heading">
          III · The Squares — kameas and their constructions (FAQ §8–§9)
        </h2>

        <p className="nt-text">
          <strong>The planetary kameas.</strong>
          <br />
          Heinrich Cornelius Agrippa, <em>De occulta philosophia libri tres</em>{" "}
          (Cologne, 1533), Book II, ch. 22 — the seven squares with their
          virtues, names, and seals. English: "J.F." translation (London,
          1651). Access: Joseph H. Peterson's digital edition,
          esotericarchives.com; Donald Tyson (ed.), Llewellyn, 1993. Grounds:
          Saturn 3×3 and Jupiter 4×4, taken verbatim in-app.
        </p>

        <p className="nt-text">
          <strong>The 3×3 lineage.</strong>
          <br />
          The Lo Shu / Nine Halls diagram (九宮), Chinese, attested by the Han
          era; legendary attribution to the turtle of the river Luo. Scholarly
          access: Joseph Needham, <em>Science and Civilisation in China</em>,
          vol. III (Cambridge, 1959). (Legend accessed through scholarship — no
          primary text exists.)
        </p>

        <p className="nt-text">
          <strong>
            Odd squares (Mars 5×5, Venus 7×7, Luna 9×9): the Siamese method.
          </strong>
          <br />
          Simon de la Loubère, <em>Du Royaume de Siam</em> (Paris, 1691);
          English, <em>A New Historical Relation of the Kingdom of Siam</em>{" "}
          (London, 1693) — where the method he learned in Siam is described.
          Public domain, archive.org.
        </p>

        <p className="nt-text">
          <strong>
            Doubly-even squares (Mercury 8×8): block complementation.
          </strong>
          <br />
          Classical construction; canonical exposition in W.S. Andrews,{" "}
          <em>Magic Squares and Cubes</em>, 2nd ed. (Open Court, 1917) — public
          domain, archive.org.
        </p>

        <p className="nt-text">
          <strong>Singly-even squares (Sol 6×6): the LUX method.</strong>
          <br />
          Attributed to John H. Conway. No primary paper exists; standard
          expositions: Eric Weisstein, <em>MathWorld</em>, "Magic Square";
          C.A. Pickover, <em>The Zen of Magic Squares, Circles, and Stars</em>{" "}
          (Princeton, 2002). Stated plainly: this is an attributed
          construction, verified in-app by the magic-property tests rather than
          by provenance.
        </p>
      </section>

      <section className="ca-faq-item">
        <h2 className="nt-section-heading">IV · The Sigil (FAQ §9)</h2>

        <p className="nt-text">
          <strong>Letter reduction.</strong>
          <br />
          Austin Osman Spare,{" "}
          <em>
            The Book of Pleasure (Self-Love): The Psychology of Ecstasy
          </em>{" "}
          (London, self-published, 1913) — sigilization by striking repeated
          letters from the phrase of intent.
        </p>

        <p className="nt-text">
          <strong>Kamea tracing.</strong>
          <br />
          The cell-joining trace with start-circle and end-bar, as practiced on
          the planetary squares: Israel Regardie (ed.), <em>The Golden Dawn</em>{" "}
          (Aries Press, 1937–1940), Second Order papers on planetary talismans
          and sigils — itself downstream of Agrippa II.22's seals and
          characters.
        </p>
      </section>

      <section className="ca-faq-item">
        <h2 className="nt-section-heading">V · The Election (FAQ §8)</h2>

        <p className="nt-text">
          <strong>The Chaldean order.</strong>
          <br />
          Ptolemy, <em>Almagest</em> IX.1 — the planets ordered by period,
          Saturn to the Moon. Access: G.J. Toomer (trans.),{" "}
          <em>Ptolemy's Almagest</em> (Duckworth, 1984). Grounds:{" "}
          <code>CHALDEAN</code>, and the observation that square order equals
          speed order.
        </p>

        <p className="nt-text">
          <strong>Traditional sign rulerships.</strong>
          <br />
          Ptolemy, <em>Tetrabiblos</em> I.17 (domiciles). Access: F.E. Robbins
          (trans.), Loeb Classical Library (Harvard, 1940). Grounds:{" "}
          <code>SIGN_RULER</code> — the Moon-sign start of the election.
        </p>

        <p className="nt-text">
          <strong>The hour ladder and the weekdays.</strong>
          <br />
          Cassius Dio, <em>Roman History</em> XXXVII.18–19 — the classical
          explanation of the weekday names from the planetary-hour cycle
          (24 ≡ 3 mod 7 down the Chaldean order). Access: E. Cary (trans.),
          Loeb; online at LacusCurtius. Grounds: the FAQ's ladder arithmetic;
          the primary for any future day/hour annotation.
        </p>
      </section>

      <section className="ca-faq-item">
        <h2 className="nt-section-heading">
          VI · The Mansions (mansion-stamp SPEC)
        </h2>

        <p className="nt-text">
          <strong>The 28 mansions, their names and virtues.</strong>
          <br />
          Agrippa, <em>De occulta philosophia</em>, Book II, ch. 33; their
          talismanic images, ch. 46. Freake translation (1651); Peterson
          digital edition.
        </p>

        <p className="nt-text">
          <strong>The mansion system itself.</strong>
          <br />
          al-Bīrūnī, <em>Kitāb al-Tafhīm</em> (
          <em>
            The Book of Instruction in the Elements of the Art of Astrology
          </em>
          , Ghazna, 1029), §164 — the 28-fold lunar division. Access: R. Ramsay
          Wright (trans.), Luzac, 1934. Grounds: the tropical-vs-sidereal
          honesty note (al-Bīrūnī's mansions are star-anchored; Agrippa's, and
          the app's, are tropical).
        </p>

        <p className="nt-text">
          <strong>Mansions as talisman timing.</strong>
          <br />
          <em>Picatrix</em> (<em>Ghāyat al-Ḥakīm</em>, Arabic, 10th–11th c.;
          Latin translation at the court of Alfonso X, c. 1256), Books I and
          IV. Access: J.M. Greer &amp; C. Warnock (trans.), <em>The Picatrix</em>{" "}
          (Adocentyn, 2010). Grounds: why the stamp belongs on a <em>seal</em> —
          mansions elect the moment of making.
        </p>
      </section>

      <section className="ca-faq-item">
        <h2 className="nt-section-heading">VII · The Cards (FAQ §11–§12)</h2>

        <p className="nt-text">
          <strong>The 78-card structure and the majors' names.</strong>
          <br />
          A.E. Waite, <em>The Pictorial Key to the Tarot</em> (London: Rider,
          1911), illustrated by Pamela Colman Smith — public domain,
          sacred-texts.com. The app's card faces are original procedural SVG
          drawn <em>in this structure</em>: 22 majors, four suits of fourteen.
          Structural precedent: the Tarot de Marseille pattern (17th–18th c.),
          the 78-card canon RWS inherited.
        </p>
      </section>

      <section className="ca-faq-item">
        <h2 className="nt-section-heading">
          VIII · The Sky (FAQ §10, §13)
        </h2>

        <p className="nt-text">
          <strong>The aspects.</strong> Ptolemy, <em>Tetrabiblos</em> I.13 —
          conjunction, sextile, square, trine, opposition.
        </p>

        <p className="nt-text">
          <strong>Orbs, applying and separating.</strong> William Lilly,{" "}
          <em>Christian Astrology</em> (London, 1647) — the orb/moiety
          conventions and the applying-vs-separating distinction the Sky page
          implements. Public domain.
        </p>

        <p className="nt-text">
          <strong>The planetary theory.</strong> P. Bretagnon &amp; G. Francou,
          "Planetary theories in rectangular and spherical variables: VSOP 87
          solutions," <em>Astronomy &amp; Astrophysics</em> 202 (1988) 309–315
          — the series astronomy-engine truncates.
        </p>

        <p className="nt-text">
          <strong>The cross-validation elements.</strong> E.M. Standish,
          "Keplerian Elements for Approximate Positions of the Major Planets"
          (JPL Solar System Dynamics memorandum; the 1800–2050 table) — the
          independent formulation the orrery is tested against.
        </p>

        <p className="nt-text">
          <strong>The spherical astronomy.</strong> Jean Meeus,{" "}
          <em>Astronomical Algorithms</em>, 2nd ed. (Willmann-Bell, 1998) —
          sidereal time, obliquity, and the closed-form Ascendant/Midheaven
          trigonometry of §13.
        </p>

        <p className="nt-text">
          <strong>The implementation.</strong> Don Cross,{" "}
          <em>Astronomy Engine</em> (github.com/cosinekitty/astronomy, MIT) —
          truncated VSOP87 + custom Pluto model, ±1′ over 1700–2200;{" "}
          <code>SunPosition</code>, <code>GeoVector</code>/<code>Ecliptic</code>
          , node and eclipse searches. The engine is itself a citable source,
          and the app's two-formulations rule treats it as one voice among two,
          never the referee.
        </p>
      </section>

      <section className="ca-faq-item">
        <h2 className="nt-section-heading">
          IX · The Profane Machinery (FAQ §1–§2, §11–§12)
        </h2>

        <p className="nt-text">
          The math that is not magic, cited with the same care:
        </p>

        <ul className="ca-faq-list">
          <li>
            <strong>Fisher–Yates shuffle.</strong> R.A. Fisher &amp; F. Yates,{" "}
            <em>
              Statistical Tables for Biological, Agricultural and Medical
              Research
            </em>{" "}
            (Oliver &amp; Boyd, 1938); in-place algorithm: R. Durstenfeld,
            "Algorithm 235: Random Permutation," <em>CACM</em> 7(7) (1964) 420;
            D.E. Knuth, <em>TAOCP</em> vol. 2, §3.4.2, Algorithm P. Grounds:
            both tarot shuffles.
          </li>
          <li>
            <strong>FNV-1a.</strong> G. Fowler, L.C. Noll, K.-P. Vo (1991);
            specified in D. Eastlake et al., "The FNV Non-Cryptographic Hash
            Algorithm" (IETF Internet-Draft). Grounds: the seed mixer and its
            constants (0xCBF29CE484222325, 0x100000001B3).
          </li>
          <li>
            <strong>splitmix64.</strong> G.L. Steele Jr., D. Lea, C.H. Flood,
            "Fast Splittable Pseudorandom Number Generators," OOPSLA 2014;
            reference implementation S. Vigna (prng.di.unimi.it, public
            domain). Grounds: the coin stream.
          </li>
          <li>
            <strong>mulberry32.</strong> T. Ettinger (public domain, 2017).
            Grounds: the oracle-pull PRNG.
          </li>
          <li>
            <strong>sfc32.</strong> C. Doty-Humphrey, from the PractRand test
            suite (public domain). Grounds: the epoch deck's domain-separated
            streams.
          </li>
          <li>
            <strong>raw_rand.</strong> DFINITY,{" "}
            <em>The Internet Computer Interface Specification</em>, management
            canister <code>raw_rand</code> — the brokered 32 bytes behind
            Neutron's <code>randomness</code> capability. Grounds: the only
            entropy in a reading.
          </li>
        </ul>
      </section>
    </div>
  );
}
