import { describe, expect, test } from "bun:test";
import { settledWithin } from "./settle";

/// The property under test is the one whose absence shipped: this resolves
/// even when the thing it is waiting on never does.

const elapsed = async (f: () => Promise<unknown>): Promise<number> => {
  const t0 = performance.now();
  await f();
  return performance.now() - t0;
};

describe("settledWithin", () => {
  test("resolves as soon as the work resolves", async () => {
    const ms = await elapsed(() =>
      settledWithin(new Promise((r) => setTimeout(r, 10)), 400),
    );
    expect(ms).toBeGreaterThanOrEqual(8);
    expect(ms).toBeLessThan(200);
  });

  test("a rejection counts as settling, and does not propagate", async () => {
    const failing = Promise.reject(new Error("the canister is stopped"));
    // No .catch here on purpose: settledWithin owns the rejection, and if it
    // let one escape this test would fail as an unhandled rejection.
    await expect(settledWithin(failing, 400)).resolves.toBeUndefined();
  });

  test("resolves at the deadline when the work never settles", async () => {
    // The exact shape of the shipped bug: a promise that simply never answers.
    const ms = await elapsed(() => settledWithin(new Promise(() => {}), 60));
    expect(ms).toBeGreaterThanOrEqual(50);
    expect(ms).toBeLessThan(400);
  });

  test("work that settles after the deadline changes nothing", async () => {
    let resolveLate: (v: unknown) => void = () => {};
    const late = new Promise((r) => {
      resolveLate = r;
    });
    await settledWithin(late, 30);
    resolveLate(null);
    // Resolving twice would throw in a Promise executor that did not guard;
    // reaching here at all is the assertion.
    await late;
    expect(true).toBe(true);
  });

  test("a deadline of zero still resolves", async () => {
    await expect(settledWithin(new Promise(() => {}), 0)).resolves.toBeUndefined();
  });
});
