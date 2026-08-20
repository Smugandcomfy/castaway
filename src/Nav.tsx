/// Generic top button bar. Each page decides which buttons it needs and
/// which handlers they run — the router (App.tsx) keeps view state, this
/// just renders. All buttons use the design system's own button classes.

export interface NavButton {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "ghost";
}

export function Nav({ buttons }: { buttons: NavButton[] }) {
  return (
    <nav className="ca-nav-bar" aria-label="Site navigation">
      {buttons.map((b, i) => (
        <button
          key={i}
          type="button"
          className={`nt-button nt-button--${b.variant ?? "secondary"} ca-nav-btn`}
          onClick={b.onClick}
        >
          {b.label}
        </button>
      ))}
    </nav>
  );
}
