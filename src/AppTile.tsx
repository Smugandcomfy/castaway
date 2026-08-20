import { useEffect, useRef, useState } from "react";
import { Hexagram } from "./Hexagram";
import { TarotCard } from "./TarotCard";
import { Sigil } from "./Sigil";
import Orrery from "./Orrery";
import { CoinToss } from "./CoinToss";
import { Masthead } from "./Masthead";
import { Footer } from "./Footer";
import type { View } from "./App";
import { draw, newNonce, type DrawnCard } from "./tarot";
import { saveTarotPull } from "./tarot_store";
import { castSky, castSkyLine, moonSignIndex } from "./sky_core";
import { saveSvg } from "./svg_export";
import { Rite, type Stage } from "./Rite";
import { electedOrder } from "./sigil_core";
import { reason } from "./reason";
import {
  consultOracle,
  journalCache,
  loadJournal,
  markCastLocally,
  seal as sealCast,
  type Seal,
} from "./backend";
import "./style.scss";

type Tier = "affirmative" | "noncommittal" | "negative";

/// Motoko `Nat`/`Int` arrive as decimal strings on the self-call wire —
/// `SelfCallValue` has no bigint member. These were typed `bigint`, so every
/// `timestamp / 1_000_000n` threw "Cannot mix BigInt and other types" the
/// moment a real reading came back.
/// Canister timestamps are nanoseconds, delivered as a decimal string.
const nsToMs = (ns: string): number => Math.floor(Number(ns) / 1_000_000);

interface HexagramData {
  lines: string[];
  number: string;
  pinyin: string;
  english: string;
  glyph: string;
}

/// Does this reply actually look like a reading?
///
/// `consultOracle` returns `unknown` because the wire cannot promise a shape.
/// Casting it with `as` moved the failure to the first dereference -- inside
/// `consult`'s own try -- where a decode problem was reported as "The cast did
/// not complete", blaming the transport for a shape mismatch. Checking here
/// means a bad reply says so.
function isReading(v: unknown): v is Reading {
  if (v === null || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.question === "string" &&
    typeof r.answer === "string" &&
    typeof r.primary === "object" &&
    r.primary !== null &&
    Array.isArray(r.changingLines) &&
    typeof r.tier === "object" &&
    r.tier !== null
  );
}

/// The question's budget, in UTF-8 bytes, matching `MAX_QUESTION_BYTES` in
/// backend/main.mo. For anything written in Latin script this is exactly the
/// character count, which is why the counter still reads the way it always did.
const QUESTION_LIMIT = 500;
const textEncoder = new TextEncoder();
const sizeOf = (t: string): number => textEncoder.encode(t).length;

interface Reading {
  id: string;
  question: string;
  timestamp: string;
  primary: HexagramData;
  /// Candid `?Hexagram`: the bare value, or null when nothing is moving.
  relating: HexagramData | null;
  changingLines: string[];
  tier: Record<Tier, null>;
  answer: string;
}

const TIER_LABEL: Record<Tier, string> = {
  affirmative: "The answer inclines toward yes",
  noncommittal: "The answer withholds itself",
  negative: "The answer inclines toward no",
};

const tierOf = (r: Reading) => Object.keys(r.tier)[0] as Tier;


export function AppTile({ goTo }: { goTo: (v: View) => void }) {
  const [question, setQuestion] = useState("");
  const [reading, setReading] = useState<Reading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [casting, setCasting] = useState(false);

  const [revealed, setRevealed] = useState(0);
  const [transformed, setTransformed] = useState(false);
  const [pull, setPull] = useState<DrawnCard[]>([]);
  const [pulls, setPulls] = useState(0);
  /// Whether this owner has ever cast. The canister sets the flag inside
  /// `consult`, so the frontend only has to read it — and only to decide
  /// whether the first-cast hint is worth showing.
  const [hasCastBefore, setHasCastBefore] = useState<boolean>(
    () => journalCache()?.flags.hasCast ?? false,
  );
  /// The cast is a sequence, not a menu: the coins answer, then three cards
  /// read the intention the question cast, and only then can the sigil be
  /// drawn. Drawing it *seals* the cast — the pull stops being re-rollable
  /// and the whole thing becomes one journal entry. Null until sealed.
  const [sealed, setSealed] = useState<Seal | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const sigilRef = useRef<HTMLElement | null>(null);

  /// Brings a newly revealed stage into view. Used only when the reader has
  /// asked for the next thing — never to move them off something they are
  /// still reading. Honours reduced-motion, which the rest of the app already
  /// respects.
  function reveal(node: HTMLElement | null) {
    if (!node) return;
    const still = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    )?.matches;
    node.scrollIntoView({
      behavior: still ? "auto" : "smooth",
      block: "start",
    });
  }

  /// Chain-random on the reading; browser-random on the nonce. Kept in memory
  /// only — a pull is not a thing that happened until the sigil seals it, and
  /// the seal is what reaches the canister.
  function rollCards() {
    if (!reading || sealed) return;
    const pulled = draw(
      reading.id,
      reading.primary.number,
      reading.question,
      newNonce(),
    );
    setPull(pulled);
    setPulls((n) => n + 1);
    saveTarotPull(reading.id, pulled);
  }

  /// Draws the sigil and closes the cast. Re-rolls are free right up to this
  /// press and shut off immediately after it, so the reader chooses when to
  /// commit rather than being cut off by a counter. Everything the entry
  /// needs beyond the cards is derivable, so this stores very little.
  async function drawSigil() {
    if (!reading || pull.length === 0 || sealed) return;
    // The square is elected here, at the moment of sealing, from the cast's
    // moving lines and the sign the Moon stood in when the question was
    // asked. Recorded on the seal so the artifact is fixed for good.
    const castAt = new Date(nsToMs(reading.timestamp));
    try {
      const entry = await sealCast({
        readingId: Number(reading.id),
        movingLines: reading.changingLines.length,
        kameaOrder: electedOrder(
          reading.changingLines.length,
          moonSignIndex(castAt),
        ),
        cards: pull.map((d) => ({
          cardIndex: d.card.index,
          reversed: d.reversed,
          position: d.position,
        })),
      });
      if (entry === null) {
        // The canister has no such reading. In practice that means this cast
        // has rolled off the end of the history while the page sat open.
        setError(
          "This cast is no longer in your journal, so it cannot be sealed. Throw again.",
        );
        return;
      }
      setSealed(entry);
      // The sigil is created below the fold; go and look at it.
      timers.current.push(setTimeout(() => reveal(sigilRef.current), 60));
    } catch (e) {
      // Sealing is the one irreversible act on this page, so a failure has to
      // say so rather than leaving the button looking inert.
      setError(`The cast could not be sealed. Try again.${reason(e)}`);
    }
  }

  /// Explicit "clear and start over" so the reader doesn't have to scroll up.
  function askAnother() {
    setReading(null);
    setQuestion("");
    setSealed(null);
    setRevealed(0);
    setTransformed(false);
    setPull([]);
    setPulls(0);
    setError(null);
    timers.current.push(setTimeout(() => document.getElementById("sf-question")?.focus(), 0));
  }

  /// Downloads the current sigil as an SVG. Vector, tiny file, a real
  /// artifact of the exact question — and it carries its own colour tokens,
  /// without which it saves as a perfectly formed blank page.
  async function saveSigil() {
    const svg = document.querySelector<SVGElement>(".sf-sigil__art");
    if (!svg || !reading) return;
    const { downloaded, copied } = await saveSvg(
      svg,
      `cast-away-sigil-${String(reading.id)}.svg`,
    );
    // A tile cannot start a download, and cannot be told that it failed — so
    // say what is actually known rather than leaving the button looking inert.
    setSaveNote(
      copied
        ? downloaded
          ? "Saved. If your browser blocked the download, the SVG is on your clipboard."
          : "The SVG is on your clipboard."
        : "The sigil could not be saved here. Try the Sigil page in a browser tab.",
    );
    timers.current.push(setTimeout(() => setSaveNote(null), 6000));
  }

  const [saveNote, setSaveNote] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);

  /// Copies the reading as plain text — question, hexagram, verdict — so the
  /// reader can paste it into notes or a message.
  async function copyReading() {
    if (!reading) return;
    const showingH = transformed && relating ? relating : reading.primary;
    const text =
      `Question: ${reading.question}\n\n` +
      `Hexagram ${String(showingH.number)} · ${showingH.pinyin} — ${showingH.english}\n\n` +
      `${reading.answer}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      timers.current.push(setTimeout(() => setCopied(false), 1600));
    } catch {
      /* clipboard unavailable in the environment; no-op */
    }
  }

  useEffect(() => {
    void loadJournal()
      .then((journal) => setHasCastBefore(journal.flags.hasCast))
      .catch(() => {
        // Only decides whether the first-cast hint shows. Not worth a notice.
      });
    return () => {
      // Every timer on this page has to be in here. Three used to escape, so
      // leaving the Oracle within 1.6s of "Copy reading" set state on an
      // unmounted component and the reveal scrolled a page already left.
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, []);

  function animate(result: Reading) {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setRevealed(0);
    setTransformed(false);
    setPull([]);
    setPulls(0);
    setSealed(null);
    for (let i = 1; i <= 6; i++) {
      timers.current.push(setTimeout(() => setRevealed(i), i * 260));
    }
    // `relating` is null whenever nothing is moving. Reading `.length` off it
    // threw, and the throw landed in consult's catch — so a perfectly good
    // reading reported that the canister had not answered.
    if (result.relating) {
      timers.current.push(setTimeout(() => setTransformed(true), 2400));
    }
    // Deliberately no scroll here. The answer is the thing the reader came
    // for, and moving the page out from under it — even after a beat — reads
    // as the app hurrying them past it. The spine says the cards are below;
    // getting there is their decision. Sealing does move the page, because by
    // then the reader has asked for the next thing.
  }

  async function consult() {
    if (casting) return;
    setError(null);
    setCasting(true);
    setReading(null);
    try {
      // Declared in preapproved_self_calls, so this does not open a dialog.
      const result = await consultOracle(question);
      if ("err" in result) {
        setError(result.err);
      } else if (!isReading(result.ok)) {
        setError("The oracle answered, but not in a shape this app understands.");
      } else {
        setReading(result.ok);
        animate(result.ok);
        markCastLocally();
        setHasCastBefore(true);
      }
    } catch (e) {
      setError(`The cast did not complete. Try throwing again.${reason(e)}`);
    } finally {
      setCasting(false);
    }
  }

  const tier = reading ? tierOf(reading) : null;
  const relating = reading?.relating ?? null;
  const showing = transformed && relating ? relating : reading?.primary;
  const settled = revealed === 6;

  /// Where the rite stands, for the spine.
  const stage: Stage = sealed ? "sigil" : pull.length > 0 ? "cards" : "question";
  const doneStages: Stage[] = sealed
    ? ["question", "cards", "sigil"]
    : pull.length > 0
      ? ["question", "cards"]
      : settled
        ? ["question"]
        : [];

  return (
    <main
      className={`nt-app nt-app--fill cast-away${reading ? " ca-reading" : ""}`}
    >
      <div className="nt-page">

        <Masthead current="oracle" goTo={goTo} />

        {/* Pre-question showpiece: the live sky, sized to sit above the ask
            field. Vanishes as soon as a reading exists so it doesn't compete
            with the hexagram reveal. */}
        {!reading && (
          <div className="ca-oracle-orrery" aria-hidden="true">
            <Orrery size={260} decorative showZodiac={false} showLabels={false} />
          </div>
        )}

        <section className="nt-section sf-ask">
          <div className="nt-field ca-ask-field">
            <textarea
              id="sf-question"
              className="nt-textarea ca-ask-textarea"
              rows={2}
              placeholder="wanderer... ask your question"
              value={question}
              onChange={(e) => {
                // The canister measures the question in UTF-8 bytes, so the
                // input has to as well. `maxLength` counts UTF-16 units, which
                // let 200 emoji through a "500 character" field and straight
                // into a refusal from the other side.
                const next = e.target.value;
                if (sizeOf(next) <= QUESTION_LIMIT || next.length < question.length) {
                  setQuestion(next);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  consult();
                }
              }}
              aria-label="Your question"
            />
            <span className="nt-help ca-ask-count">
              {sizeOf(question)} / {QUESTION_LIMIT}
            </span>
          </div>

          <div className="ca-throw-row">
            {casting ? (
              <CoinToss />
            ) : (
              <button
                type="button"
                className="nt-button nt-button--lg ca-throw-btn"
                onClick={consult}
                disabled={question.trim().length === 0}
              >
                Consult the Oracle
              </button>
            )}
          </div>

          {error && (
            <div className="nt-alert nt-alert--danger ca-ask-error" role="alert">
              {error}
            </div>
          )}

          {!reading && !casting && !hasCastBefore && (
            <p className="ca-first-cast-hint">
              Press <kbd className="ca-kbd">↵</kbd> to consult. Your
              questions and answers are kept in your history.
            </p>
          )}
        </section>


        {reading && showing && (
          <section className="nt-section sf-reading">
            <Hexagram
              lines={reading.primary.lines}
              changing={reading.changingLines}
              revealed={revealed}
              transformed={transformed}
            />

            <div
              className={`nt-result sf-verdict sf-verdict--${tier}`}
              data-shown={settled}
              aria-live="polite"
            >
              <p className="sf-answer">{reading.answer}</p>
              <p className="nt-meta">{tier && TIER_LABEL[tier]}</p>
            </div>

            {/* Gated on the reveal for the same reason the verdict is: the
                hexagram's number, name, and moving lines are exactly what
                the six-line animation is in the middle of disclosing.
                Held in layout rather than unmounted, so nothing shifts
                under the reader when it arrives. */}
            {/* The sky this cast happened under. Not decoration: the
                timestamp is already in the seed, so the sky was present in
                the reading whether or not it was ever shown. Recomputed on
                render, never stored, which is why old readings pick this up
                retroactively. */}
            <p
              className="ca-cast-sky"
              data-shown={settled}
              aria-hidden={!settled}
            >
              {castSkyLine(
                castSky(new Date(nsToMs(reading.timestamp))),
              )}
            </p>

            <dl
              className="nt-detail-grid"
              data-shown={settled}
              aria-hidden={!settled}
            >
              <div className="nt-detail">
                <dt className="nt-detail-label">Hexagram</dt>
                <dd className="nt-detail-value">
                  <span className="sf-glyph">{showing.glyph}</span>{" "}
                  {String(showing.number)} · {showing.pinyin}
                </dd>
              </div>
              <div className="nt-detail">
                <dt className="nt-detail-label">Reads as</dt>
                <dd className="nt-detail-value">{showing.english}</dd>
              </div>
              <div className="nt-detail">
                <dt className="nt-detail-label">Moving lines</dt>
                <dd className="nt-detail-value">
                  {reading.changingLines.length === 0
                    ? "None — the situation is settled"
                    : reading.changingLines.map(String).join(", ")}
                </dd>
              </div>
            </dl>

            {settled && <Rite at={stage} done={doneStages} />}

            <div className="ca-reading-actions" data-shown={settled}>
              {relating && (
                <button
                  type="button"
                  className="nt-button nt-button--ghost ca-transform-btn"
                  onClick={() => setTransformed((t) => !t)}
                  aria-pressed={transformed}
                >
                  {transformed
                    ? "← Back to the cast"
                    : "Show what it becomes →"}
                </button>
              )}
              <button
                type="button"
                className="nt-button nt-button--ghost ca-copy-btn"
                onClick={copyReading}
              >
                Copy reading
              </button>
            </div>
          </section>
        )}

        {/* The cards come next, always — not as an alternative to the sigil.
            They read the intention the question cast; the sigil cannot be
            drawn until they are on the table. */}
        {reading && settled && (
          <section className="nt-section sf-tarot">
            <p className="nt-muted sf-tarot__intro">
              Now three cards read the intention you cast — they say nothing
              about yes or no, they describe the ground you are standing on.
            </p>

            {pull.length === 0 ? (
              <div className="ca-throw-row">
                <button
                  type="button"
                  className="nt-button nt-button--lg ca-throw-btn"
                  onClick={rollCards}
                >
                  Pull three cards
                </button>
              </div>
            ) : (
              <>
                <div className="sf-spread">
                  {pull.map((d) => (
                    <TarotCard key={d.position} drawn={d} />
                  ))}
                </div>
                {sealed ? (
                  <p className="ca-sealed-note">
                    The cast is sealed. These are the cards it keeps.
                  </p>
                ) : (
                  <div className="ca-close-rite">
                    <button
                      type="button"
                      className="nt-button nt-button--lg ca-throw-btn"
                      onClick={() => void drawSigil()}
                    >
                      Seal your intention
                    </button>
                    <button
                      type="button"
                      className="ca-reroll"
                      onClick={rollCards}
                    >
                      or pull again
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* The sigil closes the cast. Drawing it sealed the pull above and
            wrote the whole thing to the journal. */}
        {reading && sealed && (
          <section className="nt-section sf-sigil-section" ref={sigilRef}>
            <div className="ca-sigil-panel" data-shown={true}>
              <div className="ca-sigil-block" data-shown={true}>
              <Sigil
                phrase={reading.question}
                movingLines={reading.changingLines.length}
                castTimestamp={
                  new Date(nsToMs(reading.timestamp))
                }
                kameaOrder={sealed.kameaOrder}
                stampAt={new Date(sealed.sealedAt)}
                cards={sealed.cards.map((c) => ({
                  index: c.cardIndex,
                  reversed: c.reversed,
                }))}
              />
                {/* No prose here. The sigil carries the moment; how it is
                    constructed is documented in FAQ §9 for anyone who wants
                    the method. */}
              </div>
              <div className="ca-reading-actions">
                <button
                  type="button"
                  className="nt-button nt-button--ghost"
                  onClick={() => void saveSigil()}
                >
                  Save the sigil
                </button>
                {saveNote && (
                  <p className="ca-save-note" role="status">
                    {saveNote}
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {reading && settled && (
          <div className="ca-ask-another">
            <button
              type="button"
              className="nt-button nt-button--secondary ca-ask-another-btn"
              onClick={askAnother}
            >
              Ask another question
            </button>
          </div>
        )}

        {/* Earlier readings live on their own History page. */}
        <Footer />
      </div>

      {copied && (
        <div className="ca-toast" role="status" aria-live="polite">
          Reading copied to clipboard
        </div>
      )}
    </main>
  );
}
