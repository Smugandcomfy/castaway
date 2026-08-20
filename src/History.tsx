import { useEffect, useMemo, useState } from "react";
import { Hexagram } from "./Hexagram";
import { Sigil } from "./Sigil";
import { TarotCard } from "./TarotCard";
import { Masthead } from "./Masthead";
import { Footer } from "./Footer";
import { NoteEditor } from "./NoteEditor";
import type { View } from "./App";
import { DECK, type DrawnCard } from "./tarot";
import { loadTarotPulls } from "./tarot_store";
import { castSky, castSkyLine } from "./sky_core";
import { reason } from "./reason";
import {
  clearAll,
  loadReadings,
  deleteEntry,
  journalCache,
  loadJournal,
  type Draw,
  type SavedCard,
  type Seal,
  type SigilEntry,
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

interface Reading {
  id: string;
  question: string;
  timestamp: string;
  primary: HexagramData;
  relating: HexagramData | null;
  changingLines: string[];
  tier: Record<Tier, null>;
  answer: string;
}

/// Discriminated union of everything the journal shows. All of it now comes
/// from the canister's managed memory: readings, standalone tarot draws, and
/// standalone sigil generations.
type JournalItem =
  | { kind: "reading"; id: string; timestamp: number; reading: Reading }
  | { kind: "tarot"; id: string; timestamp: number; entry: Draw }
  | { kind: "sigil"; id: string; timestamp: number; entry: SigilEntry };

const formatWhen = (ms: number) =>
  new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/// Rebuild a full DrawnCard from a SavedCard by looking up the deck.
function hydrate(saved: SavedCard[]): DrawnCard[] {
  return saved.map((s) => ({
    card: DECK[s.cardIndex],
    reversed: s.reversed,
    position: s.position,
  }));
}

/// Reads #/reading/<id> from the URL for deep-linking into a specific entry.
function readingIdFromHash(): string {
  if (typeof window === "undefined") return "";
  const m = window.location.hash.match(/^#\/reading\/(\d+)$/);
  return m ? m[1] : "";
}

export default function History({ goTo }: { goTo: (v: View) => void }) {
  const [past, setPast] = useState<Reading[]>([]);
  const [tarotEntries, setTarotEntries] = useState<Draw[]>([]);
  const [sigilEntries, setSigilEntries] = useState<SigilEntry[]>([]);
  const [seals, setSeals] = useState<Seal[]>([]);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTarot, setExpandedTarot] = useState<Set<string>>(new Set());
  const [highlightId] = useState<string>(readingIdFromHash);

  useEffect(() => {
    let live = true;
    void loadReadings()
      .then((rows) => {
        if (live) setPast(rows as Reading[]);
      })
      .catch(() => {
        // Otherwise the page reports "Nothing here yet", which is a very
        // different claim from "could not ask".
        if (live) setError("Could not load the journal. Try again.");
      });
    return () => {
      live = false;
    };
  }, []);

  // Standalone entries and seals come from managed memory in one query.
  useEffect(() => {
    let live = true;
    void loadJournal()
      .then((j) => {
        if (!live) return;
        setTarotEntries(j.draws);
        setSigilEntries(j.sigils);
        setSeals(j.seals);
      })
      .catch(() => {
        if (live) setError("Could not reach the journal. Reload to try again.");
      });
    return () => {
      live = false;
    };
  }, []);

  const items: JournalItem[] = useMemo(() => {
    const readings: JournalItem[] = past.map((r) => ({
      kind: "reading",
      id: String(r.id),
      timestamp: nsToMs(r.timestamp),
      reading: r,
    }));
    const tarot: JournalItem[] = tarotEntries.map((e) => ({
      kind: "tarot",
      id: e.id,
      timestamp: e.drawnAt,
      entry: e,
    }));
    const sigils: JournalItem[] = sigilEntries.map((e) => ({
      kind: "sigil",
      id: e.id,
      timestamp: e.madeAt,
      entry: e,
    }));
    return [...readings, ...tarot, ...sigils].sort(
      (a, b) => b.timestamp - a.timestamp,
    );
  }, [past, tarotEntries, sigilEntries]);

  // Scroll a deep-linked reading into view.
  useEffect(() => {
    if (!highlightId || items.length === 0) return;
    const el = document.getElementById(`reading-${highlightId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setExpandedTarot((s) => new Set([...s, highlightId]));
    }
  }, [highlightId, items]);

  function toggleTarot(id: string) {
    setExpandedTarot((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function clearEverything() {
    setConfirmingClear(false);
    try {
      // One call now wipes readings, seals, draws, sigils, notes and the
      // deck: it is all in the same managed memory.
      await clearAll();
      setPast([]);
      setTarotEntries([]);
      setSigilEntries([]);
      setSeals([]);
    } catch (e) {
      setError(`Could not clear the journal. Try again.${reason(e)}`);
    }
  }

  async function removeLocal(id: string) {
    try {
      await deleteEntry(id);
    } catch (e) {
      // The rows are only dropped after the canister confirms, so a failure
      // here left the entry on screen and the button looking inert.
      setError(`Could not delete that entry. Try again.${reason(e)}`);
      return;
    }
    setTarotEntries((s) => s.filter((e) => e.id !== id));
    setSigilEntries((s) => s.filter((e) => e.id !== id));
  }

  return (
    <main className="nt-app nt-app--fill cast-away">
      <div className="nt-page">

        <Masthead current="history" goTo={goTo} />

        <section className="nt-section">
          <header className="nt-section-header">
            <h2 className="nt-section-heading">Journal</h2>
            <span className="nt-section-count">{items.length}</span>
          </header>

          {error && (
            <div className="nt-alert nt-alert--danger" role="alert">
              {error}
            </div>
          )}

          {items.length === 0 ? (
            <div className="nt-state nt-state--empty ca-empty-history">
              <p className="nt-muted">Nothing here yet.</p>
              <button
                type="button"
                className="nt-button"
                onClick={() => goTo("oracle")}
              >
                Ask the coins something
              </button>
            </div>
          ) : (
            <>
              {confirmingClear ? (
                <div
                  className="nt-alert nt-alert--danger sf-confirm"
                  role="alert"
                >
                  <p className="nt-text">
                    This permanently deletes {items.length} journal{" "}
                    {items.length === 1 ? "entry" : "entries"}: readings on
                    the canister, tarot pulls, sigils, and every note.
                    It cannot be undone.
                  </p>
                  <div className="nt-cluster">
                    <button className="nt-button" onClick={clearEverything}>
                      Delete everything
                    </button>
                    <button
                      className="nt-button"
                      onClick={() => setConfirmingClear(false)}
                    >
                      Keep them
                    </button>
                  </div>
                </div>
              ) : (
                <div className="nt-cluster sf-history-actions">
                  <button
                    type="button"
                    className="nt-button"
                    onClick={() => setConfirmingClear(true)}
                  >
                    Clear the journal
                  </button>
                </div>
              )}

              <div className="ca-journal-list">
                {items.map((item) => {
                  const highlighted = highlightId === item.id;
                  const domId =
                    item.kind === "reading" ? `reading-${item.id}` : item.id;
                  return (
                    <article
                      key={item.id}
                      id={domId}
                      className={`ca-journal-item ca-journal-item--${item.kind}${
                        highlighted ? " is-highlighted" : ""
                      }`}
                    >
                      {item.kind === "reading" && (
                        <ReadingRow
                          reading={item.reading}
                          seal={
                            seals.find(
                              (s) => s.readingId === Number(item.reading.id),
                            ) ?? null
                          }
                          expandedTarot={expandedTarot.has(item.id)}
                          onToggleTarot={() => toggleTarot(item.id)}
                        />
                      )}
                      {item.kind === "tarot" && (
                        <TarotRow
                          entry={item.entry}
                          onDelete={() => void removeLocal(item.id)}
                        />
                      )}
                      {item.kind === "sigil" && (
                        <SigilRow
                          entry={item.entry}
                          onDelete={() => void removeLocal(item.id)}
                        />
                      )}
                      <NoteEditor entryId={item.id} />
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>

        <Footer />
      </div>
    </main>
  );
}

// -------------------------------------------------------------- subcomponents

function ReadingRow({
  reading,
  seal,
  expandedTarot,
  onToggleTarot,
}: {
  reading: Reading;
  /// A sealed cast went the whole way — question, cards, sigil — and the pull
  /// it kept is fixed. When present it is shown instead of the loose,
  /// session-only re-roll history.
  seal: Seal | null;
  expandedTarot: boolean;
  onToggleTarot: () => void;
}) {
  const pulls = loadTarotPulls(reading.id);
  return (
    <>
      <div className="ca-journal-head">
        <span className="ca-journal-tag">
          {seal ? "Sealed cast" : "Reading"}
        </span>
        <span className="ca-journal-time">
          {formatWhen(nsToMs(reading.timestamp))}
        </span>
      </div>
      <div className="nt-settings-row sf-past-row">
        <Hexagram
          lines={reading.primary.lines}
          changing={reading.changingLines}
          small
        />
        <span className="nt-settings-main sf-past-body">
          <strong className="nt-settings-title">{reading.answer}</strong>
          <span className="nt-settings-description">{reading.question}</span>
          <span className="ca-cast-sky ca-cast-sky--row">
            {castSkyLine(
              castSky(new Date(nsToMs(reading.timestamp))),
            )}
          </span>
        </span>
      </div>
      {(seal || pulls.length > 0) && (
        <div className="ca-history-tarot">
          <button
            type="button"
            className="nt-button nt-button--ghost ca-history-tarot-toggle"
            onClick={onToggleTarot}
            aria-expanded={expandedTarot}
          >
            {expandedTarot
              ? seal
                ? "Hide the cast"
                : "Hide tarot"
              : seal
                ? "Show the cast"
                : `Show tarot (${pulls.length} ${
                    pulls.length === 1 ? "pull" : "pulls"
                  })`}
          </button>
          {expandedTarot && (
            <>
              <div className="ca-history-tarot-spread sf-spread">
                {hydrate(seal ? seal.cards : pulls[pulls.length - 1]).map(
                  (d) => (
                    <TarotCard key={d.position} drawn={d} />
                  ),
                )}
              </div>
              {seal && (
                <div className="ca-history-sigil">
                  <Sigil
                    phrase={reading.question}
                    movingLines={seal.movingLines}
                    castTimestamp={
                      new Date(nsToMs(reading.timestamp))
                    }
                    kameaOrder={seal.kameaOrder}
                    stampAt={new Date(seal.sealedAt)}
                    cards={seal.cards.map((c) => ({
                      index: c.cardIndex,
                      reversed: c.reversed,
                    }))}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

function TarotRow({
  entry,
  onDelete,
}: {
  entry: Draw;
  onDelete: () => void;
}) {
  const cards = hydrate(entry.cards);
  return (
    <>
      <div className="ca-journal-head">
        <span className="ca-journal-tag">Tarot pull</span>
        <span className="ca-journal-time">{formatWhen(entry.drawnAt)}</span>
      </div>
      <div className="ca-history-tarot-spread sf-spread">
        {cards.map((d) => (
          <TarotCard key={d.position} drawn={d} />
        ))}
      </div>
      <div className="ca-journal-row-actions">
        <button
          type="button"
          className="nt-button nt-button--ghost"
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </>
  );
}

function SigilRow({
  entry,
  onDelete,
}: {
  entry: SigilEntry;
  onDelete: () => void;
}) {
  return (
    <>
      <div className="ca-journal-head">
        <span className="ca-journal-tag">Sigil</span>
        <span className="ca-journal-time">{formatWhen(entry.madeAt)}</span>
      </div>
      <div className="ca-journal-sigil-body">
        <Sigil
          phrase={entry.phrase}
          movingLines={entry.movingLines}
          castTimestamp={new Date(entry.madeAt)}
          stampAt={new Date(entry.madeAt)}
        />
        <blockquote className="ca-journal-phrase">"{entry.phrase}"</blockquote>
      </div>
      <div className="ca-journal-row-actions">
        <button
          type="button"
          className="nt-button nt-button--ghost"
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </>
  );
}
