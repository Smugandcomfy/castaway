import { useEffect, useState } from "react";
import Home from "./Home";
import { loadJournal, setEntered } from "./backend";
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

  useEffect(() => {
    if (view !== null) return;
    let live = true;
    void loadJournal().then((j) => {
      if (live) setView(j.flags.entered ? "oracle" : "home");
    });
    return () => {
      live = false;
    };
    // Runs once, on the first render where no hash decided the view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  if (view === "home") return <Home onEnter={enter} />;
  if (view === "faq") return <Faq goTo={setView} />;
  if (view === "history") return <History goTo={setView} />;
  if (view === "tarot") return <TarotPage goTo={setView} />;
  if (view === "sigil") return <SigilPage goTo={setView} />;
  if (view === "sky") return <SkyPage goTo={setView} />;
  return <AppTile goTo={setView} />;
}
