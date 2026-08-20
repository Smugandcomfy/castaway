import Orrery from "./Orrery";

/// The splash: instrument approached, not app opened. The real orrery
/// beneath, one door in. It follows the chosen theme like everything else —
/// it used to force the light palette regardless.
///
/// Shown on first visit ever, then remembered in managed memory; the
/// [Home] button brings it back.
export default function Home({ onEnter }: { onEnter: () => void }) {
  return (
    <main className="nt-app nt-app--fill cast-away ca-home">
      <div className="ca-home-inner">
        <h1 className="ca-home-title">CAST AWAY</h1>
        <p className="ca-home-subtitle">
          Cast your intentions with verifiable magic.
        </p>
        <div className="ca-home-orrery">
          <Orrery size={340} showZodiac showLabels={false} />
        </div>
        <button
          type="button"
          className="nt-button nt-button--lg ca-home-enter"
          onClick={onEnter}
          autoFocus
        >
          ENTER
        </button>
      </div>
    </main>
  );
}
