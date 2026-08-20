/// Turning a rendered SVG into a file that still looks like itself.
///
/// The sigil's art is painted with design tokens — `stroke="var(--sf-accent)"`,
/// `stroke="var(--sf-grid)"` — which resolve against the app root. Serialize
/// the node as-is and those custom properties have nothing to resolve
/// against: `stroke` becomes invalid at computed-value time and falls back to
/// its initial value, `none`. The file opens structurally perfect and
/// completely blank, which is exactly what it did before this module existed.
///
/// So the export resolves the tokens off the live element and carries their
/// values with it. A sigil saved in the light theme keeps its bronze; one
/// saved in the dark theme keeps its gold.

/// Every custom property the exported art can reference. Keep in step with
/// Sigil.tsx — a token used there and missing here draws as nothing.
const TOKENS = ["--sf-accent", "--sf-grid"] as const;

const SVG_NS = "http://www.w3.org/2000/svg";

/// A standalone SVG document string for a node rendered inside the app.
export function serializeStandaloneSvg(node: SVGElement): string {
  const computed = getComputedStyle(node);
  const clone = node.cloneNode(true) as SVGElement;

  clone.setAttribute("xmlns", SVG_NS);

  // Without intrinsic dimensions some viewers render the art at a few pixels.
  // The viewBox already carries the proportions; this just gives it a size.
  const box = node.getAttribute("viewBox");
  if (box && !clone.getAttribute("width")) {
    const [, , w, h] = box.split(/[\s,]+/).map(Number);
    if (Number.isFinite(w) && Number.isFinite(h)) {
      clone.setAttribute("width", String(w));
      clone.setAttribute("height", String(h));
    }
  }

  const decls = TOKENS.map((t) => {
    const value = computed.getPropertyValue(t).trim();
    return value ? `${t}: ${value};` : "";
  })
    .filter(Boolean)
    .join(" ");

  if (decls) {
    const style = document.createElementNS(SVG_NS, "style");
    style.textContent = `svg { ${decls} }`;
    clone.insertBefore(style, clone.firstChild);
  }

  return new XMLSerializer().serializeToString(clone);
}

/// Serialize and hand the file to the browser.
export function downloadSvg(node: SVGElement, filename: string): void {
  const blob = new Blob([serializeStandaloneSvg(node)], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
