import { useEffect, useRef, useState } from "react";
import { createCanisterClient, loadNeutronCanisterId } from "neutron-tools/app";
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
import { electedOrder } from "./sigil_core";
import { journalCache, loadJournal, markCastLocally, seal as sealCast, type Seal } from "./backend";
import "./style.scss";

type Tier = "affirmative" | "noncommittal" | "negative";

interface HexagramData {
  lines: bigint[];
  number: bigint;
  pinyin: string;
  english: string;
  glyph: string;
}

interface Reading {
  id: bigint;
  question: string;
  timestamp: bigint;
  primary: HexagramData;
  relating: HexagramData[]; // Candid opt arrives as [] or [value]
  changingLines: bigint[];
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
  const [client, setClient] = useState<any>(null);
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
    const castAt = new Date(Number(reading.timestamp / 1_000_000n));
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
    setSealed(entry);
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
    setTimeout(() => document.getElementById("sf-question")?.focus(), 0);
  }

  /// Downloads the current sigil as an SVG. Vector, preserves the art, tiny
  /// file — a real artifact of the exact question.
  function saveSigil() {
    const svg = document.querySelector(".sf-sigil__art");
    if (!svg || !reading) return;
    const svgText = new XMLSerializer().serializeToString(svg);
    // Standalone SVG needs the xmlns; add it defensively in case the serializer
    // omitted it on a fragment context.
    const withNs = svgText.includes("xmlns=")
      ? svgText
      : svgText.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    const blob = new Blob([withNs], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cast-away-sigil-${String(reading.id)}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

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
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable in the environment; no-op */
    }
  }

  useEffect(() => {
    (async () => {
      const c = createCanisterClient(await loadNeutronCanisterId());
      setClient(c);
      const journal = await loadJournal();
      setHasCastBefore(journal.flags.hasCast);
    })();
    return () => timers.current.forEach(clearTimeout);
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
    if (result.relating.length > 0) {
      timers.current.push(setTimeout(() => setTransformed(true), 2400));
    }
  }

  async function consult() {
    if (!client || casting) return;
    setError(null);
    setCasting(true);
    setReading(null);
    try {
      // Declared in preapproved_self_calls, so this does not open a dialog.
      const result = await client.call("consult", [question]);
      if ("err" in result) {
        setError(result.err);
      } else {
        setReading(result.ok);
        animate(result.ok);
        markCastLocally();
        setHasCastBefore(true);
      }
    } catch {
      setError("The canister did not answer. Try throwing again.");
    } finally {
      setCasting(false);
    }
  }

  const tier = reading ? tierOf(reading) : null;
  const relating = reading?.relating?.[0] ?? null;
  const showing = transformed && relating ? relating : reading?.primary;
  const settled = revealed === 6;

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
            <Orrery size={180} showZodiac={false} showLabels={false} />
          </div>
        )}

        <section className="nt-section sf-ask">
          <div className="nt-field ca-ask-field">
            <textarea
              id="sf-question"
              className="nt-textarea ca-ask-textarea"
              rows={2}
              maxLength={500}
              placeholder="wanderer... ask your question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  consult();
                }
              }}
              aria-label="Your question"
            />
            <span className="nt-help ca-ask-count">
              {question.length} / 500
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
            <header className="nt-section-header">
              <h2 className="nt-section-heading">The reading</h2>
            </header>

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
                castSky(new Date(Number(reading.timestamp / 1_000_000n))),
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
            <header className="nt-section-header">
              <h2 className="nt-section-heading">Three cards</h2>
              {pulls > 1 && !sealed && (
                <span className="nt-section-count">{pulls}</span>
              )}
            </header>

            <p className="nt-muted sf-tarot__intro">
              The coins have answered. Now three cards read the intention you
              cast with your question — they say nothing about yes or no, they
              describe the ground you are standing on.
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
                  <div className="nt-cluster">
                    <button
                      type="button"
                      className="nt-button nt-button--ghost"
                      onClick={rollCards}
                    >
                      Pull again
                    </button>
                    <button
                      type="button"
                      className="nt-button"
                      onClick={() => void drawSigil()}
                    >
                      Draw your sigil
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
          <section className="nt-section sf-sigil-section">
            <header className="nt-section-header">
              <h2 className="nt-section-heading">The sigil</h2>
            </header>
            <div className="ca-sigil-block" data-shown={true}>
              <Sigil
                phrase={reading.question}
                movingLines={reading.changingLines.length}
                castTimestamp={
                  new Date(Number(reading.timestamp / 1_000_000n))
                }
                kameaOrder={sealed.kameaOrder}
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
                onClick={saveSigil}
              >
                Save the sigil
              </button>
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
