/// Three coins tumbling. Shown in place of the "Roll the I Ching" button
/// while the backend is producing entropy — fills the ~900 ms wait with a
/// gesture that matches what's happening (the coins are actually being cast).
///
/// SVG because the design system caps CSS border-radius at 5 px; a round dot
/// cannot be made with border-radius: 50%.

export function CoinToss() {
  return (
    <div
      className="ca-coin-toss"
      role="status"
      aria-label="Throwing the coins"
    >
      <svg
        className="ca-coin-toss__svg"
        viewBox="0 0 90 30"
        width={110}
        height={36}
        aria-hidden="true"
      >
        <circle cx={15} cy={15} r={9} className="ca-coin ca-coin--1" />
        <circle cx={45} cy={15} r={9} className="ca-coin ca-coin--2" />
        <circle cx={75} cy={15} r={9} className="ca-coin ca-coin--3" />
      </svg>
      <span className="ca-coin-label">Casting</span>
    </div>
  );
}
