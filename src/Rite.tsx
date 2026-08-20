/// The spine of a cast: question, cards, sigil.
///
/// The oracle page is a sequence, and until this existed it never said so.
/// Each stage was an ordinary section with an ordinary heading, so the only
/// way to learn that a second and third stage existed was to scroll and find
/// them. This marks how many steps there are and which one you are on.
///
/// Purely a signpost — it reads state, never sets it.

export type Stage = "question" | "cards" | "sigil";

const STEPS: readonly { key: Stage; label: string }[] = [
  { key: "question", label: "Question" },
  { key: "cards", label: "Cards" },
  { key: "sigil", label: "Sigil" },
];

export function Rite({ at, done }: { at: Stage; done: readonly Stage[] }) {
  return (
    <ol className="ca-rite" aria-label="The cast">
      {STEPS.map((s, i) => {
        const complete = done.includes(s.key);
        const here = s.key === at;
        return (
          <li
            key={s.key}
            className={`ca-rite__step${here ? " is-here" : ""}${
              complete ? " is-done" : ""
            }`}
            aria-current={here ? "step" : undefined}
          >
            <span className="ca-rite__mark" aria-hidden="true">
              {complete ? "✓" : i + 1}
            </span>
            <span className="ca-rite__label">{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
