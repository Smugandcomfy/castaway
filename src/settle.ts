/// Waiting, with a guarantee that it ends.
///
/// This exists because of a bug that shipped. The app gated its first paint on
/// `journal()`, and when that query never settled on a real install the whole
/// tile stayed blank forever — no error, no timeout, nothing for the error
/// boundary to catch, and no way to tell a slow canister from a dead one.
///
/// Holding the paint is still the right thing to do: the splash is a guess
/// until the journal says whether this reader has entered before, and a
/// wordmark that appears and vanishes on every mount reads as a glitch,
/// especially in a small tile. The deadline is what makes it safe. It is
/// separated out here rather than left inline in the component because "this
/// resolves even when nothing else does" is the whole property, and a property
/// worth stating is worth testing.

/// Resolves when `work` settles, or when `ms` elapses — whichever comes first.
///
/// Never rejects: a rejection is a settlement, and the caller's own handler is
/// where a failure gets interpreted. Never waits longer than `ms`.
export function settledWithin(work: Promise<unknown>, ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    // `void` rather than returning it: the caller waits on the race, not on
    // the work, and an unhandled rejection here would be a second bug.
    void work.then(finish, finish);
  });
}
