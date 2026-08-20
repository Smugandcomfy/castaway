# HANDOFF — read this first

You are picking up a Neutron app called **Cast Away**, built in a prior session
that had no network access, no `moc`, no `mops`, and no npm packages. That
matters: some of this code is verified by execution and some of it is inferred
from documentation. This file tells you which is which so you don't waste time
re-checking what's solid or trust what isn't.

The repo you are in is `infu/neutron`. This app lives at `apps/cast_away`.

---

## What the app is

Ask a question. The backend throws three coins six times, builds an I Ching
hexagram, names it via the King Wen sequence, and answers in one of the twenty
registers of the Magic 8-Ball. Then it draws a kamea sigil from the question,
and offers an optional three-card tarot pull as commentary.

The design idea that holds it together: a cast produces two independent numeric
signals — how many lines are *moving*, and the yang/yin balance — and those map
onto the 8-ball's three answer registers without any hand-authored table.

---

## Verified by actually running it

Do not spend time re-deriving these. They were executed, not reasoned about.

- **King Wen table** is a bijection over 1–64, satisfies the inversion pairing
  rule for all 32 pairs, with exactly the four expected complement pairs
  (1/2, 27/28, 29/30, 61/62). Landmark hexagrams check out.
- **Verdict distribution** over 400k simulated casts: 36% affirmative,
  28% non-committal, 36% negative.
- **Tarot**: 26 tests against compiled source. 78 cards, 20k spreads with no
  intra-spread repeats, deterministic per nonce, re-rolls on nonce change,
  question-sensitive, all 78 reachable, reversals 47–53%.
- **All five kameas** verified magic: permutation of 1..n², every row, every
  column, both diagonals.
- **Render pass**: all 78 cards upright and reversed, all 64 sigils, hexagram at
  every reveal step, plus degenerate inputs (empty, punctuation-only, 500 chars,
  non-Latin). No NaN, no undefined, no unbalanced tags.
- **Strict typecheck** clean on `src/tarot.ts` and `src/sigil.ts`.
- **Pip layouts** 1–10: correct glyph counts, no overlaps, inside card bounds.

## NOT verified — this is your job

- **No Motoko has ever been compiled.** Not `main.mo`, not `Cast.mo`, not
  `test/oracle.test.mo`. The logic is proven as algorithms, not as code that
  typechecks.
- **`src/AppTile.tsx` and `src/index.tsx`** got only a stubbed typecheck.
  Real `@types/react` may surface errors.
- **SCSS never compiled.** The `neutron-design-system` import is unproven.
- **The two seams below.**

---

## Task 1 — the randomness leaf (blocking)

`backend/main.mo`, the `RandomnessLeaf` type near the top.

Neutron blocks `Random.blob()` and the other Base/Core randomness facades by
name, because they hide a management call. Entropy must come through the
declared `randomness` capability, which brokers `raw_rand` and returns 32 bytes.
The docs page describing the *injected leaf* truncates at a malformed table on
ntron.net in both extraction modes, so the field name and signature in this repo
are **inferred**.

Read `apps/kitchensink` and correct the type.

This is deliberately isolated. `Cast.reading()` takes a `Blob` and an `Int` and
has no idea Neutron exists, so fixing the leaf should not require touching any
other file.

Also settle: `consult` is currently typed `async*`. Plain `async` may be what the
compiler wants for an update method that awaits a broker. Check kitchensink.

## Task 2 — the memory schema (blocking, and irreversible)

`backend/memory/cast_away/v1.mo`, the `Mem` record.

**Stop and show the user this shape before running `npm run package`.**

A managed-memory schema is immutable once `neutron.lock.json` is written. You can
supersede it with a new version plus a forward migration edge, but you cannot
edit a locked one. Getting it wrong on the first package is the single most
expensive mistake available here.

Read `apps/hello` and correct the shape. Then ask the user to confirm.

## Task 3 — packaging scripts

`package.json` here has only `build`, `dev`, `test`, `test:motoko`. The real
pipeline (validate → build → mopack → schema → pack) invokes repo workspace
tooling whose wiring was not readable from the published docs. **Copy those
scripts verbatim from `apps/hello/package.json`.** Do not invent them.

---

## Order of work

1. `npm install`
2. `npm run dev` — serves on :8000 with the kernel mocked. Fastest feedback and
   touches no Motoko. If the tile renders, the whole frontend is real.
3. Fix Task 1 and Task 2 against `apps/hello` and `apps/kitchensink`.
4. `npm run test:motoko` — first time `moc` sees any of this. Expect a
   deprecation warning on `Text.hash` in `Cast.mo`.
5. Task 3, then `npm run package`.
6. Install locally via the provisioner (`local.ndeploy.json` at repo root).
   Local dev uses PocketIC, not dfx. There is no dfx anywhere in this project.

---

## Things not to undo

- **`preapproved_self_calls` must exactly match the methods the frontend calls.**
  Currently `consult`, `history`, `clear`. `stats` is implemented but not called,
  and was deliberately removed from the grant — pre-approval bypasses the kernel
  dialog, so granting it to unused methods is free attack surface. If you wire up
  `stats` in the UI, add it back; if you remove a call site, drop it.
  Without `consult` pre-approved, every coin throw raises a kernel dialog and the
  app is unusable.

- **Design system constraints.** The tile must not use remote fonts, gradients,
  viewport-scaled type, non-zero letter-spacing, or framing borders, and radius
  caps at 5px. An earlier version of this app was built on Google Fonts over a
  gradient and had to be rebuilt. The card and sigil frames are drawn *inside*
  the SVG as artwork, not as CSS borders — that is what keeps them legal. Don't
  "clean that up" into CSS borders.

- **`dev/` is dev-only** and must never be referenced by `build.ts`, which copies
  only `public/` into `dist/web`. `dev/mock.ts` mirrors the Motoko cast in
  TypeScript; if you change `Cast.mo`, change the mock or the preview drifts.

- **The verify-me comments** in `main.mo` and `v1.mo` are the only record of what
  is unverified. Don't delete them until the seams are actually fixed.

---

## Known rough edges, if there's time

- No test file for `src/sigil.ts` in-repo. The magic-square property is trivially
  testable and a broken square renders a plausible-looking *wrong* glyph rather
  than failing loudly. Worth adding.
- `Text.hash` in `Cast.mo` is deprecated in recent base.
- Question text persists in canister memory. `clear()` is the only removal path
  and it has a confirmation step — keep it.
- Tarot pulls are infinitely re-rollable by design. Handled by framing rather
  than restriction; a soft cap of three per reading is a two-line change if it
  feels weightless in use.

---

## Open design questions the user may want to revisit

- Tarot position labels live in `POSITIONS` at the top of `src/tarot.ts`. They
  deliberately avoid past/present/future so the cards can't appear to contradict
  the hexagram's verdict.
- The verdict is symmetric (36/36) where the toy is optimistic (50/25). To
  restore the toy's cheerfulness, send 3-yang casts affirmative instead of
  deferring to the relating hexagram, in `Cast.verdict`.
- Saturn (3×3) and Jupiter (4×4) kameas are excluded — too few cells, the sigil
  path degenerates into scribble. See the comment on `planetFor`.
