import type { CSSProperties } from "react";

const isYang = (line: number) => line === 7 || line === 9;

export interface HexagramProps {
  lines: bigint[] | number[];
  changing?: (bigint | number)[];
  revealed?: number;
  transformed?: boolean;
  small?: boolean;
}

/**
 * Six bars, drawn bottom to top the way a cast is actually built.
 * `revealed` counts how many lines have landed so far.
 */
export function Hexagram({
  lines,
  changing = [],
  revealed = 6,
  transformed = false,
  small = false,
}: HexagramProps) {
  const changingSet = new Set(changing.map(Number));
  const rows = [...lines].map(Number).reverse();

  return (
    <div
      className={small ? "sf-hexagram sf-hexagram--small" : "sf-hexagram"}
      aria-hidden="true"
    >
      {rows.map((line, i) => {
        const position = 6 - i;
        const moving = changingSet.has(position);
        const shown = small || position <= revealed;
        const yang = transformed && moving ? !isYang(line) : isYang(line);

        const classes = ["sf-line"];
        if (moving) classes.push("sf-line--moving");
        if (shown) classes.push("sf-line--in");

        return (
          <div
            key={position}
            className={classes.join(" ")}
            style={
              { "--sf-delay": `${(position - 1) * 140}ms` } as CSSProperties
            }
          >
            <span className="sf-bar" />
            {!yang && <span className="sf-bar" />}
          </div>
        );
      })}
    </div>
  );
}
