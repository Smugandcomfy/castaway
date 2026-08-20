/// Exposes the oracle's math on window.__castAway so the FAQ's "verify it
/// yourself" section is literally paste-able in the browser's developer
/// console. Everything here is already in the bundle — we're just giving
/// the reader a handle to it.
///
/// This is not a stable API. It exists to make claims falsifiable.

import {
  KING_WEN,
  isYang,
  isYin,
  isChanging,
  transform,
  hexagramNumberOf,
} from "./kingwen";
import { DECK, draw, newNonce } from "./tarot";
import {
  kamea,
  presidingKamea,
  trace,
  traceWithCards,
  electedOrder,
  castKamea,
  CHALDEAN,
  SIGN_RULER,
  ELECTION_COUNTS_8POW6,
} from "./sigil_core";
import {
  moonLongitudeAt,
  ascendantDeg,
  midheavenDeg,
  moonSignIndex,
  castSky,
  castSkyLine,
  aspectsAmong,
  separation,
  lunarNodesDeg,
} from "./sky_core";
import {
  MANSIONS,
  mansionOf,
  mansionAt,
  mansionForTimestamp,
  formatMansion,
  formatMansionAt,
  MANSION_WIDTH_DEG,
} from "./mansions";
import {
  deckOrder,
  deckFlips,
  drawThree,
  freshDeck,
  mintSeed,
} from "./epochdeck";
import {
  presidingCondition,
  conditionLine,
  planetKeyOf,
} from "./presiding";
import { formatZodiac } from "./orrery_core";

const debugApi = {
  KING_WEN,
  isYang,
  isYin,
  isChanging,
  transform,
  hexagramNumberOf,
  DECK,
  draw,
  newNonce,
  kamea,
  presidingKamea,
  trace,
  traceWithCards,
  electedOrder,
  castKamea,
  CHALDEAN,
  SIGN_RULER,
  ELECTION_COUNTS_8POW6,
  ascendantDeg,
  midheavenDeg,
  moonSignIndex,
  castSky,
  castSkyLine,
  aspectsAmong,
  separation,
  lunarNodesDeg,
  deckOrder,
  deckFlips,
  drawThree,
  freshDeck,
  mintSeed,
  MANSIONS,
  mansionOf,
  mansionAt,
  mansionForTimestamp,
  formatMansion,
  formatMansionAt,
  MANSION_WIDTH_DEG,
  moonLongitudeAt,
  presidingCondition,
  conditionLine,
  planetKeyOf,
  formatZodiac,
};

if (typeof window !== "undefined") {
  (window as unknown as { __castAway: typeof debugApi }).__castAway = debugApi;
}
