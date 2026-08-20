import { createContext, useContext } from "react";
import type { View } from "./App";
import type { Theme } from "./theme";

/// The resolved theme and the toggle, supplied once by App rather than
/// threaded through six page components that do not otherwise care.
export interface ThemeControl {
  theme: Theme;
  toggle: () => void;
}

export const ThemeContext = createContext<ThemeControl>({
  theme: "dark",
  toggle: () => {},
});

export const useThemeControl = () => useContext(ThemeContext);

/// Wordmark, tabs, and the theme toggle, in one bar.
///
/// Replaces the old per-page `Nav`, where every page listed a different set
/// of siblings, two of six had a Back button, all six offered "Home" — which
/// went to the splash, a first-run door nobody wants to return to — and
/// nothing anywhere marked the page you were on.
///
/// Oracle is the trunk, so it is simply the first tab and Back is implicit.
/// The splash is deliberately absent: it is the way in, not a destination.
///
/// The frame is an inset hairline rather than a border. The design system
/// ships `--nt-shadow-hairline` for exactly this, which is how the bar can be
/// visibly embossed without breaking the no-framing-borders rule.

const TABS: readonly { view: View; label: string }[] = [
  { view: "oracle", label: "Oracle" },
  { view: "sigil", label: "Sigil" },
  { view: "tarot", label: "Tarot" },
  { view: "sky", label: "Sky" },
  { view: "history", label: "Journal" },
  { view: "faq", label: "FAQ" },
];

export function Masthead({
  current,
  goTo,
}: {
  current: View;
  goTo: (v: View) => void;
}) {
  const { theme, toggle } = useThemeControl();
  return (
    <header className="ca-masthead">
      <button
        type="button"
        className="ca-masthead__mark"
        onClick={() => goTo("oracle")}
        aria-label="Cast Away — back to the Oracle"
      >
        CAST AWAY
      </button>

      <nav className="ca-masthead__tabs" aria-label="Sections">
        {TABS.map((t) => {
          const active = t.view === current;
          return (
            <button
              key={t.view}
              type="button"
              className={`ca-tab${active ? " is-active" : ""}`}
              onClick={() => goTo(t.view)}
              aria-current={active ? "page" : undefined}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      <button
        type="button"
        className="ca-masthead__theme"
        onClick={toggle}
        aria-label={
          theme === "light" ? "Switch to dark theme" : "Switch to light theme"
        }
        title={theme === "light" ? "Dark theme" : "Light theme"}
      >
        {/* Drawn rather than typed: the crescent and sun glyphs are missing
            from plenty of system fonts, and the design system forbids
            loading one. */}
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          {theme === "light" ? (
            <path
              d="M15.2 12.6A6.2 6.2 0 0 1 7.4 4.8a6.2 6.2 0 1 0 7.8 7.8Z"
              fill="currentColor"
            />
          ) : (
            <g fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="10" cy="10" r="3.6" fill="currentColor" />
              {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
                const r = (a * Math.PI) / 180;
                return (
                  <line
                    key={a}
                    x1={10 + Math.cos(r) * 6}
                    y1={10 + Math.sin(r) * 6}
                    x2={10 + Math.cos(r) * 8}
                    y2={10 + Math.sin(r) * 8}
                    strokeLinecap="round"
                  />
                );
              })}
            </g>
          )}
        </svg>
      </button>
    </header>
  );
}
