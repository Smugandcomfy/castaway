/// Ambient declarations for things the bundler resolves and the compiler
/// otherwise cannot see.
///
/// Until now `npx tsc --noEmit` in this directory compiled *nothing* — the app
/// had no tsconfig.json and the workspace root does not reference it — so it
/// exited 0 on any source at all. These declarations are what it takes for a
/// real check to run.

/// esbuild turns a side-effect stylesheet import into a CSS bundle entry; the
/// compiler only needs to know the specifier resolves.
declare module "*.scss" {}
declare module "*.css" {}
