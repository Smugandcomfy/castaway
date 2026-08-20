# Cast Away

> Cast your intentions with verifiable magic.

An oracle app. Ask a question; three coins are thrown six times, a hexagram is
built, named by the King Wen sequence, and answered in one of the twenty
registers of the Magic 8-Ball. Three cards then read the intention you cast,
and a kamea sigil closes the reading — traced from the question and finished
by the cards, on a square the sky and the cast elect together. A live
heliocentric orrery greets you at the door.

Everything is math and it is all public. The [FAQ](#faq) walks through the
whole pipeline with worked examples and console-verifiable snippets.

- **Backend** — Motoko, `backend/oracle/`
- **Frontend** — React 19 + esbuild + sass, `src/`
- **Runtime** — Neutron / Internet Computer canister; local dev via PocketIC
- **State** — managed memory, single-owner. Nothing is kept in the browser: an
  app tile is a credentialless, opaque-origin iframe with no storage, so
  readings, seals, draws, sigils, notes and the deck all live on-chain.

---

## Features

- **Oracle** — real three-coin distribution (1:3:3:1), King Wen hexagram
  naming, moving-line transform, symmetric 36/28/36 verdict distribution.
  Every reading is annotated with the sky it was cast under.
- **The sealed cast** — question, then three cards, then the sigil. Drawing
  the sigil seals the pull and writes the whole thing to your journal as one
  artifact.
- **Sigil** — Golden Dawn / Agrippa kamea tracing. The question draws the
  figure and the three sealed cards set its last cells; a reversed card takes
  the mirrored square. Seven kameas, all generated and verified magic, and
  the square is elected by the sign the Moon stood in together with the
  cast's moving lines — 13.4%–15.6% across all seven.
- **Tarot page** — a deck you own: 78 cards shuffled once, walked three at a
  time, 26 draws to empty it, then reshuffle. Orientations baked at shuffle.
- **Sky** — geocentric wheel with the Ascendant on the left, any moment back
  to 1800, 232 places, angles, aspects, and the lunar nodes.
- **Journal** — full archive, on-chain, with notes.
- **FAQ** — dry, technical documentation of every number in the pipeline,
  with paste-able verification snippets against `window.__castAway`.

---

## Verifiability

Two independent formulations must agree on every claim:

- The **King Wen table** is verified as a bijection over 1..64 satisfying
  the inversion/complement pairing rule for all 32 pairs.
- The **verdict distribution** is 36% / 28% / 36% over 400 000 simulated
  casts (symmetric — the toy 8-Ball is 50/25/25 and tilts optimistic).
- **All five kameas** are verified as permutations of 1..n² with correct
  row, column, and diagonal sums.
- The **tarot deck** is 78 cards with unique labels; 20 000 spreads never
  repeat a card within a spread; reversals land 47–53%; every card is
  reachable.
- The **orrery** cross-validates against an independent Kepler solver
  using JPL/Standish 1800–2050 mean elements — all nine planets agree
  to under one degree, and heliocentric Earth is 180° from
  `astronomy-engine`'s own geocentric Sun to within 0.6°.
- The **Ascendant and Midheaven** are closed forms, checked by pushing every
  answer back through `astronomy-engine`'s own ecliptic → equator → horizon
  rotations: the Ascendant must land on the horizon on the eastern side, the
  Midheaven on the meridian above it. Seven places from 64°N to 34°S, six
  instants from 1801 to 2026.
- The **epoch deck** is a verified permutation with domain-separated order and
  orientation streams; 26 draws see all 78 exactly once and the 27th refuses.

See `src/*.test.ts` (bun) and `test/oracle.test.mo` (mops) for the actual
assertions.

---

## Local development

### Prerequisites

- Node 22+ (`nvm install 22`)
- Bun 1.3+ (`npm install -g bun` if you don't already have it)
- `moc` (from `dfx` cache or via `mops toolchain`) on `PATH`

### The dev tile

```bash
npm install                # from the neutron workspace root
npm run dev --workspace neutron-cast-away
open http://localhost:8000
```

`build.dev.ts` swaps `neutron-tools/app` for `dev/mock.ts`, which mirrors
the Motoko cast in TypeScript closely enough that the hexagram reveal,
verdict, sigil, and tarot all behave exactly as they will on Neutron. No
replica, no packaging, no PocketIC needed.

### Tests

```bash
npm run test --workspace neutron-cast-away    # bun: 86 pass
cd apps/cast_away && mops test                # motoko: oracle assertions
```

### Verify claims in the browser console

The FAQ page exposes the oracle's math on `window.__castAway`. Open
DevTools and paste:

```js
const { KING_WEN, hexagramNumberOf, transform, DECK, draw } = __castAway

new Set(KING_WEN).size === 64                     // true
hexagramNumberOf([7,7,7,8,8,8]) === 11            // Tai, "Peace"
hexagramNumberOf([8,8,8,7,7,7]) === 12            // Pi,  "Standstill"
transform(6) === 7 && transform(9) === 8          // moving-line rule
DECK.length === 78                                 // full deck
```

More snippets in `Faq.tsx` (or the running page's FAQ tab).

---

## Design principles

- **The verdict is honest.** The distribution is symmetric; the app does
  not tilt toward optimism. Getting "no" happens as often as "yes".
- **The tarot is commentary, not a second oracle.** The oracle's position
  labels deliberately avoid past/present/future so the cards can't seem to
  contradict the hexagram's verdict. The Tarot page's own deck, having no
  verdict to contradict, is free to name time directly.
- **The sky was always there.** Planet positions are a pure function of time,
  and the time is already in the seed — so mixing them in again would add
  exactly nothing. Instead the sky is made visible and given real work: it
  helps elect the square the sigil is traced on.
- **The sky is instrument, not astrology.** Heliocentric, log-radii,
  never fed into the verdict. Earth is always 180° from where an
  astrologer puts the Sun; retrograde does not exist heliocentrically.
- **Design-system rules kept.** No remote fonts, no gradients, no
  viewport-scaled type, letter-spacing 0, radius ≤ 5 px, no framing
  borders. The oracle's character comes from the drawing, the colour,
  and the copy — not from a serif display face.

---

## Packaging & deploy

See [`HANDOFF.md`](HANDOFF.md) for the Neutron packaging pipeline
(`npm run package` → `.neutron` archive → PocketIC install via the
Neutron provisioner). The frontend runs standalone in dev without any
of this.

---

## License

`LicenseRef-Neutron-Sovereign-Application-License-1.0`. See the Neutron
repo for terms.

---

## FAQ

The in-app FAQ is the technical spec. It documents every constant,
threshold, and formula with worked examples. Open the app and click
**FAQ**, or read [`src/Faq.tsx`](src/Faq.tsx) directly.
