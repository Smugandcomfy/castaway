/// Light and dark, as a real choice rather than a mood.
///
/// This used to be `.ca-paper`, a light palette applied by *what the app was
/// doing*: the splash was always light, the Oracle was light until you cast
/// and then flipped dark, and every other page was permanently dark. That is
/// not a theme, it is a state class, and it is why the app looked like it had
/// two minds.
///
/// Now the theme is chosen and remembered. The preference lives in managed
/// memory, because an app tile has no browser storage to keep it in — so
/// there is a beat on load before the canister answers. Until then the system
/// setting applies, which is also the first-run default, so the common case
/// is correct immediately and never flashes.

export type Theme = "light" | "dark";

/// Null means "follow the system" — the state a reader is in until they say
/// otherwise, and the state `clear()` never touches.
export type ThemeChoice = Theme | null;

const ATTR = "data-ca-theme";

export function systemTheme(): Theme {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

export function resolveTheme(choice: ThemeChoice): Theme {
  return choice ?? systemTheme();
}

/// Paint the resolved theme onto the document. The attribute goes on <html>
/// so it covers everything, including anything that escapes the app root.
export function applyTheme(choice: ThemeChoice): Theme {
  const resolved = resolveTheme(choice);
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute(ATTR, resolved);
  }
  return resolved;
}

/// Follow the system while the reader has expressed no preference. Returns an
/// unsubscribe. Does nothing once a choice is made — an explicit choice
/// outranks the machine.
export function watchSystemTheme(
  choice: ThemeChoice,
  onChange: (t: Theme) => void,
): () => void {
  if (typeof window === "undefined" || !window.matchMedia || choice !== null) {
    return () => {};
  }
  const mq = window.matchMedia("(prefers-color-scheme: light)");
  const handler = () => onChange(applyTheme(null));
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}

/// What the toggle does: light and dark alternate, and a reader following the
/// system moves to the opposite of whatever they are currently seeing — so the
/// button always visibly changes something.
export function nextTheme(choice: ThemeChoice): Theme {
  return resolveTheme(choice) === "light" ? "dark" : "light";
}
