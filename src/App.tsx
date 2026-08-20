import { useEffect, useMemo, useRef, useState } from "react";
import Home from "./Home";
import { loadJournal, setEntered, setTheme } from "./backend";
import { ThemeContext } from "./Masthead";
import { settledWithin } from "./settle";
import {
  applyTheme,
  nextTheme,
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
  /// Never null. The app must render without waiting on the canister: gating
  /// first paint on a query meant that if `journal()` rejected — or simply
  /// never settled — the whole app stayed blank forever, with no error, no
  /// timeout and nothing for the error boundary to catch. A fresh owner has
  /// not entered, so the splash is the honest default, and the journal only
  /// ever *upgrades* it.
  const [view, setView] = useState<View>(() => viewFromHash() ?? "home");

  /// True once it is known whether this reader has entered before.
  ///
  /// The splash is the honest default, but it is not a *known* answer, and on a
  /// small tile the wordmark appearing and vanishing on every mount reads as a
  /// glitch. So first paint waits — but only for a moment, and only for one of
  /// three things: the journal answering, the journal failing, or a deadline.
  /// That last one is not decoration. Gating first paint on a query with no
  /// deadline is precisely what left this app blank forever on a real install,
  /// with no error and nothing for the error boundary to catch.
  ///
  /// A shared link has already decided the view, so there is nothing to wait
  /// for and it starts settled.
  const [settled, setSettled] = useState<boolean>(() => viewFromHash() !== null);

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
    // A shared link already decided the view; do not second-guess it.
    if (viewFromHash() !== null) return;
    let live = true;
    const journal = loadJournal();
    // The view upgrades whenever the journal answers, deadline or not.
    void journal
      .then((j) => {
        if (live && j.flags.entered) setView("oracle");
      })
      .catch(() => {
        // The splash is a reasonable place to be, and is what settling shows.
      });
    // Paint when the answer arrives or when time is up, whichever is first.
    void settledWithin(journal, 1200).then(() => {
      if (live) setSettled(true);
    });
    return () => {
      live = false;
    };
    // Runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let live = true;
    void loadJournal()
      .then((j) => {
        if (!live) return;
        const stored: ThemeChoice =
          j.theme === "light" || j.theme === "dark" ? j.theme : null;
        setThemeChoice(stored);
        setResolvedTheme(applyTheme(stored));
      })
      .catch(() => {
        // Stay on the system theme, which is already applied.
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
        void setTheme(next).catch(() => undefined);
      },
    }),
    [theme, themeChoice],
  );

  // Reflect view in the URL so pages are shareable and the back button works.
  //
  // `pushState`, not `replaceState`. Replacing never adds a history entry, so
  // home -> oracle -> tarot -> journal left the stack empty and Back walked
  // straight out of the app -- while two comments here claimed the opposite.
  // The very first run still replaces, because normalising the URL the reader
  // arrived on is not a navigation they should have to press Back through.
  const navigated = useRef(false);
  useEffect(() => {
    document.title = TITLE[view];
    const desired = VIEW_TO_HASH[view];
    // Preserve #/reading/... deep links on history — don't rewrite them.
    if (view === "history" && window.location.hash.startsWith("#/reading/")) {
      navigated.current = true;
      return;
    }
    if (window.location.hash !== desired) {
      const url = desired || window.location.pathname + window.location.search;
      if (navigated.current) window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    }
    navigated.current = true;
  }, [view]);

  // Browser back / forward — re-sync from hash. `popstate` as well as
  // `hashchange`, because a pushState that only changes the path fires the
  // former and not the latter.
  useEffect(() => {
    const resync = () => {
      // An unrecognised hash used to leave the reader on the previous page with
      // the bad URL still in the bar, and nothing to correct it.
      setView(parseHash(window.location.hash) ?? "home");
    };
    window.addEventListener("hashchange", resync);
    window.addEventListener("popstate", resync);
    return () => {
      window.removeEventListener("hashchange", resync);
      window.removeEventListener("popstate", resync);
    };
  }, []);

  function enter() {
    // Fire and forget: if the canister is unreachable the reader still gets
    // in, they are simply shown the splash again next time.
    void setEntered().catch(() => undefined);
    setView("oracle");
  }

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
    <ThemeContext.Provider value={themeControl}>
      {settled ? (
        page
      ) : (
        // The themed ground and nothing on it. Not `null`: an empty render
        // would leave the tile transparent, and the whole point is that the
        // reader sees one settled thing rather than a wordmark that flashes.
        <div className="nt-app nt-app--fill cast-away" aria-hidden="true" />
      )}
    </ThemeContext.Provider>
  );
}
