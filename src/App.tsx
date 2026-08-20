import { useEffect, useMemo, useState } from "react";
import Home from "./Home";
import { loadJournal, setEntered, setTheme } from "./backend";
import { ThemeContext } from "./Masthead";
import {
  applyTheme,
  nextTheme,
  resolveTheme,
  systemTheme,
  watchSystemTheme,
  type Theme,
  type ThemeChoice,
} from "./theme";
import { AppTile } from "./AppTile";
import Faq from "./Faq";
import History from "./History";
import TarotPage from "./TarotPage";
import SigilPage from "./SigilPage";
import SkyPage from "./SkyPage";

export type View =
  | "home"
  | "oracle"
  | "faq"
  | "history"
  | "tarot"
  | "sigil"
  | "sky";

const TITLE: Record<View, string> = {
  home: "Cast Away",
  oracle: "Cast Away — Oracle",
  faq: "Cast Away — FAQ",
  history: "Cast Away — Journal",
  tarot: "Cast Away — Tarot",
  sigil: "Cast Away — Sigil",
  sky: "Cast Away — Sky",
};

/// Every non-home view gets a URL hash so pages are bookmarkable and the
/// browser back button works. Home is the default landing so it keeps a
/// clean root URL. #/reading/<id> deep-links into History and highlights
/// the specified reading (History reads the hash itself).
const HASH_TO_VIEW: Record<string, View> = {
  "": "home",
  "#/": "home",
  "#/home": "home",
  "#/oracle": "oracle",
  "#/faq": "faq",
  "#/history": "history",
  "#/journal": "history",
  "#/tarot": "tarot",
  "#/sigil": "sigil",
  "#/sky": "sky",
};

const VIEW_TO_HASH: Record<View, string> = {
  home: "",
  oracle: "#/oracle",
  faq: "#/faq",
  history: "#/journal",
  tarot: "#/tarot",
  sigil: "#/sigil",
  sky: "#/sky",
};

function parseHash(hash: string): View | null {
  if (hash.startsWith("#/reading/")) return "history";
  return HASH_TO_VIEW[hash] ?? null;
}

/// A shared URL wins outright — someone sent /#/faq, respect it.
function viewFromHash(): View | null {
  if (typeof window === "undefined") return null;
  return window.location.hash ? parseHash(window.location.hash) : null;
}

export default function App() {
  /// Null while we ask the canister whether this owner has been here before.
  /// The splash shows on the first visit ever and never again, and that flag
  /// lives in managed memory — a tile has no browser storage to keep it in.
  const [view, setView] = useState<View | null>(viewFromHash);

  /// Null means "follow the system". The preference lives on the canister,
  /// so it cannot be known synchronously — the system setting applies until
  /// the journal answers, which is also the first-run default, so the common
  /// case is right immediately and never flashes.
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>(null);
  const [theme, setResolvedTheme] = useState<Theme>(() => {
    const t = systemTheme();
    applyTheme(null);
    return t;
  });

  useEffect(() => {
    if (view !== null) return;
    let live = true;
    void loadJournal().then((j) => {
      if (!live) return;
      setView(j.flags.entered ? "oracle" : "home");
    });
    return () => {
      live = false;
    };
    // Runs once, on the first render where no hash decided the view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let live = true;
    void loadJournal().then((j) => {
      if (!live) return;
      const stored: ThemeChoice =
        j.theme === "light" || j.theme === "dark" ? j.theme : null;
      setThemeChoice(stored);
      setResolvedTheme(applyTheme(stored));
    });
    return () => {
      live = false;
    };
  }, []);

  // Track the machine only while no explicit choice has been made.
  useEffect(
    () => watchSystemTheme(themeChoice, setResolvedTheme),
    [themeChoice],
  );

  const themeControl = useMemo(
    () => ({
      theme,
      toggle: () => {
        const next = nextTheme(themeChoice);
        setThemeChoice(next);
        setResolvedTheme(applyTheme(next));
        void setTheme(next);
      },
    }),
    [theme, themeChoice],
  );

  // Reflect view in the URL so pages are shareable and the back button works.
  useEffect(() => {
    if (view === null) return;
    document.title = TITLE[view];
    const desired = VIEW_TO_HASH[view];
    // Preserve #/reading/... deep links on history — don't rewrite them.
    if (view === "history" && window.location.hash.startsWith("#/reading/")) {
      return;
    }
    if (window.location.hash !== desired) {
      const url = desired || window.location.pathname + window.location.search;
      window.history.replaceState(null, "", url);
    }
  }, [view]);

  // Browser back / forward — re-sync from hash.
  useEffect(() => {
    const onHash = () => {
      const v = parseHash(window.location.hash);
      if (v) setView(v);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function enter() {
    void setEntered();
    setView("oracle");
  }

  // Nothing to show until the splash question is answered. A blank beat is
  // better than flashing the splash at someone who passed it months ago.
  if (view === null) return null;

  const page =
    view === "home" ? (
      <Home onEnter={enter} />
    ) : view === "faq" ? (
      <Faq goTo={setView} />
    ) : view === "history" ? (
      <History goTo={setView} />
    ) : view === "tarot" ? (
      <TarotPage goTo={setView} />
    ) : view === "sigil" ? (
      <SigilPage goTo={setView} />
    ) : view === "sky" ? (
      <SkyPage goTo={setView} />
    ) : (
      <AppTile goTo={setView} />
    );

  return (
    <ThemeContext.Provider value={themeControl}>{page}</ThemeContext.Provider>
  );
}
