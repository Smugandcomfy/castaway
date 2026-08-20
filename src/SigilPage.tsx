import { useEffect, useMemo, useRef, useState } from "react";
import { Sigil } from "./Sigil";
import { Masthead } from "./Masthead";
import { Footer } from "./Footer";
import { saveSigil as saveSigilEntry } from "./backend";
import { saveSvg } from "./svg_export";
import type { View } from "./App";
import "./style.scss";

/// Standalone sigil generator: no coins, no reading, no persistence.
/// The user types an intent, the sigil renders live beneath. In Auto mode
/// the presiding planet is derived from a hash of the phrase (deterministic:
/// same intent -> same sigil, forever), but the user can pin any of the
/// seven planets if they want to work under a specific one.

const PLANETS: readonly { movingLines: number; name: string }[] = [
  { movingLines: 0, name: "Saturn" },
  { movingLines: 1, name: "Jupiter" },
  { movingLines: 2, name: "Mars" },
  { movingLines: 3, name: "Sol" },
  { movingLines: 4, name: "Venus" },
  { movingLines: 5, name: "Mercury" },
  { movingLines: 6, name: "Luna" },
];

/// FNV-1a over the (case-folded) phrase, reduced to a 0-6 planet index.
function autoElection(phrase: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < phrase.length; i++) {
    h ^= phrase.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 7;
}

async function saveSigilSVG(phrase: string): Promise<boolean> {
  const svg = document.querySelector<SVGElement>(".sf-sigil__art");
  if (!svg) return false;
  const slug = phrase
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "sigil";
  const { copied } = await saveSvg(svg, `cast-away-${slug}.svg`);
  return copied;
}

export default function SigilPage({ goTo }: { goTo: (v: View) => void }) {
  const [phrase, setPhrase] = useState("");
  const [override, setOverride] = useState<number | null>(null);
  /// idle | saved | failed. It used to be a bare boolean set the instant the
  /// button was pressed, before the canister had answered and regardless of
  /// what it answered — so a failed write still told the reader "saved".
  const [saveState, setSaveState] = useState<"idle" | "saved" | "failed">(
    "idle",
  );

  /// The live preview has no `madeAt` yet, so it is stamped with the moment
  /// the page was opened — the auspice you would be making under. Saving to
  /// the journal records its own `madeAt`, and that is what the entry shows.
  const [saving, setSaving] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
  }, []);

  const openedAt = useMemo(() => new Date(), []);

  const trimmed = phrase.trim();
  const auto = useMemo(() => autoElection(trimmed.toLowerCase()), [trimmed]);
  const movingLines = override ?? auto;

  async function toJournal() {
    // Without a guard, two clicks write two sigils: `save_sigil` mints a fresh
    // id on every call, so the canister has no way to recognise the repeat.
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      // The canister stamps the time, so there is nothing to pass and nothing
      // a caller could backdate.
      await saveSigilEntry({
        phrase: trimmed,
        movingLines,
        overridden: override !== null,
      });
      setSaveState("saved");
    } catch {
      setSaveState("failed");
    } finally {
      setSaving(false);
    }
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setSaveState("idle"), 2200);
  }

  return (
    <main className="nt-app nt-app--fill cast-away">
      <div className="nt-page">

        <Masthead current="sigil" goTo={goTo} />

        <section className="nt-section sf-sigil-standalone">
          <p className="nt-muted sf-tarot__intro">
            Type an intention or a name. Repeated letters are struck; the rest
            traces a path through the presiding planet's magic square.
          </p>

          <div className="nt-field ca-ask-field ca-sigil-field">
            <textarea
              id="sigil-phrase"
              className="nt-textarea ca-ask-textarea"
              rows={2}
              maxLength={200}
              placeholder="type your intent..."
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              aria-label="Your intent"
              autoFocus
            />
          </div>

          {trimmed && (
            <>
              <div className="ca-sigil-standalone-art">
                <Sigil
                  phrase={trimmed}
                  movingLines={movingLines}
                  stampAt={openedAt}
                />
              </div>

              <div className="ca-planet-picker" role="radiogroup" aria-label="Presiding planet">
                <button
                  type="button"
                  className={`nt-button nt-button--ghost ca-planet-btn${
                    override === null ? " is-active" : ""
                  }`}
                  onClick={() => setOverride(null)}
                  role="radio"
                  aria-checked={override === null}
                >
                  Auto
                </button>
                {PLANETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    className={`nt-button nt-button--ghost ca-planet-btn${
                      override === p.movingLines ? " is-active" : ""
                    }`}
                    onClick={() => setOverride(p.movingLines)}
                    role="radio"
                    aria-checked={override === p.movingLines}
                  >
                    {p.name}
                  </button>
                ))}
              </div>

              <div className="ca-reading-actions" data-shown="true">
                <button
                  type="button"
                  className="nt-button nt-button--ghost"
                  onClick={() => void toJournal()}
                >
                  Save to journal
                </button>
                <button
                  type="button"
                  className="nt-button nt-button--ghost"
                  onClick={() => void saveSigilSVG(trimmed)}
                >
                  Download SVG
                </button>
              </div>
            </>
          )}
        </section>

        <Footer />
      </div>

      {saveState !== "idle" && (
        <div
          className="ca-toast"
          role="status"
          aria-live="polite"
          data-tone={saveState === "failed" ? "bad" : undefined}
        >
          {saveState === "saved"
            ? "Sigil saved to your journal"
            : "Could not save. Try again."}
        </div>
      )}
    </main>
  );
}
