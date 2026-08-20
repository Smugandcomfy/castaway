/// Why a failure message carries its cause.
///
/// Three separate bugs in this app were TypeErrors raised while decoding a
/// reply the canister had already returned successfully — an absent optional
/// read as an array, a Nat read as a bigint, a method that did not exist. Every
/// one of them surfaced to the reader as "the canister did not answer", which
/// was false, and which sent the search to the wrong side of the wire.
///
/// A caught error is now quoted rather than swallowed. The sentence still leads
/// with what the reader should do; the cause follows it in parentheses for
/// whoever is reading over their shoulder.

export function reason(e: unknown): string {
  const message =
    e instanceof Error ? e.message : typeof e === "string" ? e : "";
  const trimmed = message.trim();
  if (trimmed === "") return "";
  // Long canister rejections carry a stack-like tail that helps nobody.
  const head = trimmed.split("\n")[0];
  return ` (${head.length > 160 ? `${head.slice(0, 157)}…` : head})`;
}
