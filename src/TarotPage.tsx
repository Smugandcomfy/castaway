import { useEffect, useMemo, useState } from "react";
import { TarotCard } from "./TarotCard";
import { Nav } from "./Nav";
import { Footer } from "./Footer";
import { DECK, type DrawnCard } from "./tarot";
import {
  DECK_SIZE,
  DRAW_SIZE,
  canDraw,
  drawThree,
  freshDeck,
  remaining,
  type DeckState,
} from "./epochdeck";
import { canisterDeckStore } from "./deckStore";
import { presidingKamea } from "./sigil_core";
import { conditionLine, planetKeyOf, presidingCondition } from "./presiding";
import { saveDraw } from "./backend";
import type { View } from "./App";
import "./style.scss";

/// Standalone tarot: no coins, no question, no reading — and, unlike the
/// oracle's pull, no re-rolling. This page draws from a deck you own.
///
/// The deck is shuffled once into a fixed order with fixed orientations and
/// then walked three cards at a time; twenty-six draws empty it and it must
/// be shuffled again. A card cannot come back within an epoch, because the
/// order is a permutation rather than a fresh deal. That is the whole
/// difference between this and the oracle: the oracle grants you a pull, you
/// draw from your deck.
///
/// The draw still elects a presiding planet, so the same annotation the
/// oracle sigil gets — "Drawn under Mercury · retrograde in Pisces" —
/// appears above the spread. The sky is read at the moment of the draw, so
/// the condition is truthful for exactly that instant.

interface Pull {
  cards: DrawnCard[];
  drawnAt: Date;
  movingLines: number; // 0-6 for the election
}

export default function Tarot({ goTo }: { goTo: (v: View) => void }) {
  const store = useMemo(() => canisterDeckStore(), []);

  const [deck, setDeck] = useState<DeckState | null>(null);
  const [loading, setLoading] = useState(true);
  const [pull, setPull] = useState<Pull | null>(null);
  const [confirmingReshuffle, setConfirmingReshuffle] = useState(false);
  const [busy, setBusy] = useState(false);

  // The deck outlives the visit, and lives on the canister. A deck that fails
  // validation loads as null, which simply offers a fresh shuffle.
  useEffect(() => {
    let live = true;
    void store.load().then((d) => {
      if (!live) return;
      setDeck(d);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [store]);

  async function drawCards() {
    if (!deck || !canDraw(deck) || busy) return;
    setBusy(true);
    try {
      const { drawn, next } = drawThree(deck);
      const drawnAt = new Date();

      // The presiding planet is elected from the draw's place in the epoch
      // rather than from fresh entropy: nothing after the shuffle is random.
      const movingLines = (deck.cursor / DRAW_SIZE) % 7;

      const cards: DrawnCard[] = drawn.map((d) => ({
        card: DECK[d.index],
        reversed: d.reversed,
        position: d.position,
      }));

      // Advance first. If the canister refuses the cursor the draw never
      // happened, so the reader is not shown cards the deck did not spend.
      const moved = await store.advance(next.cursor);
      if (!moved) return;

      setDeck(next);
      setPull({ cards, drawnAt, movingLines });

      await saveDraw({
        movingLines,
        cards: cards.map((d) => ({
          cardIndex: d.card.index,
          reversed: d.reversed,
          position: d.position,
        })),
      });
    } finally {
      setBusy(false);
    }
  }

  async function doReshuffle() {
    if (busy) return;
    setBusy(true);
    try {
      const next = await store.shuffle(freshDeck().seed);
      setDeck(next);
      setPull(null);
      setConfirmingReshuffle(false);
    } finally {
      setBusy(false);
    }
  }

  /// Reshuffling with cards still in the deck throws away an epoch, so it
  /// asks first. At empty there is nothing to lose and nothing to confirm.
  function requestReshuffle() {
    if (deck && canDraw(deck)) setConfirmingReshuffle(true);
    else void doReshuffle();
  }

  const left = deck ? remaining(deck) : DECK_SIZE;
  const exhausted = deck !== null && !canDraw(deck);
  const kamea = pull ? presidingKamea(pull.movingLines) : null;
  const condition =
    pull && kamea
      ? presidingCondition(planetKeyOf(kamea.planet), pull.drawnAt)
      : null;

  return (
    <main className="nt-app nt-app--fill cast-away">
      <div className="nt-page">
        <header className="ca-header ca-header--centered">
          <h1 className="nt-title ca-page-title">CAST AWAY</h1>
        </header>

        <Nav
          buttons={[
            { label: "Oracle", onClick: () => goTo("oracle") },
            { label: "Sigil", onClick: () => goTo("sigil") },
            { label: "Sky", onClick: () => goTo("sky") },
            { label: "Journal", onClick: () => goTo("history") },
            { label: "FAQ", onClick: () => goTo("faq") },
            { label: "Home", onClick: () => goTo("home"), variant: "ghost" },
          ]}
        />

        <section className="nt-section sf-tarot">
          <header className="nt-section-header">
            <h2 className="nt-section-heading">Your deck</h2>
            {deck && (
              <span className="nt-section-count" aria-live="polite">
                {left} / {DECK_SIZE}
              </span>
            )}
          </header>

          <p className="nt-muted sf-tarot__intro">
            No question and no coins — three cards off the top of your own
            deck, shuffled once and walked three at a time. Cards do not come
            back until you shuffle again. Each draw is saved to your journal.
          </p>

          {loading ? (
            <p className="ca-deck-meta">Finding your deck…</p>
          ) : deck === null ? (
            <div className="ca-throw-row">
              <button
                type="button"
                className="nt-button nt-button--lg ca-throw-btn"
                onClick={() => void doReshuffle()}
                autoFocus
              >
                Shuffle a new deck
              </button>
            </div>
          ) : (
            <>
              <p className="ca-deck-meta">
                Epoch {deck.epoch} · shuffled{" "}
                {new Date(deck.shuffledAt).toLocaleDateString()} ·{" "}
                {exhausted
                  ? "the deck is spent"
                  : `${left} cards remain (${left / DRAW_SIZE} draws)`}
              </p>

              {confirmingReshuffle ? (
                <div className="ca-deck-confirm" role="alertdialog">
                  <p>
                    {left} cards remain. Shuffling now ends this deck and
                    starts a new one.
                  </p>
                  <div className="nt-cluster">
                    <button
                      type="button"
                      className="nt-button"
                      onClick={() => void doReshuffle()}
                      autoFocus
                    >
                      Shuffle anyway
                    </button>
                    <button
                      type="button"
                      className="nt-button nt-button--ghost"
                      onClick={() => setConfirmingReshuffle(false)}
                    >
                      Keep this deck
                    </button>
                  </div>
                </div>
              ) : (
                <div className="ca-throw-row">
                  {exhausted ? (
                    <button
                      type="button"
                      className="nt-button nt-button--lg ca-throw-btn"
                      onClick={() => void doReshuffle()}
                      autoFocus
                    >
                      Shuffle a new deck
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="nt-button nt-button--lg ca-throw-btn"
                      onClick={() => void drawCards()}
                      autoFocus
                    >
                      {pull ? "Draw three more" : "Draw three cards"}
                    </button>
                  )}
                </div>
              )}

              {pull && kamea && condition && (
                <div className="ca-tarot-presiding">
                  Drawn under {kamea.planet}
                  <span className="ca-sigil-condition">
                    {" · "}
                    {conditionLine(condition)}
                  </span>
                </div>
              )}

              {pull && (
                <div className="sf-spread">
                  {pull.cards.map((d) => (
                    <TarotCard key={d.position} drawn={d} />
                  ))}
                </div>
              )}

              {!confirmingReshuffle && !exhausted && (
                <div className="nt-cluster">
                  <button
                    type="button"
                    className="nt-button nt-button--ghost"
                    onClick={requestReshuffle}
                  >
                    Shuffle this deck
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        <Footer />
      </div>
    </main>
  );
}
