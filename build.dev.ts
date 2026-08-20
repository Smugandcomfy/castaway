/// Standalone dev server. Serves the tile on http://localhost:8000 with the
/// kernel client swapped for dev/mock.ts, so nothing needs packaging, no
/// replica runs, and no PocketIC is involved. Design and animation work should
/// happen here, not against an installed app.
///
/// This file is dev-only and must never be referenced by build.ts.

import esbuild from "esbuild";
import { sassPlugin } from "esbuild-sass-plugin";

const ctx = await esbuild.context({
  entryPoints: ["./src/index.tsx"],
  outfile: "./dev/dist/main.js",
  bundle: true,
  sourcemap: true,
  platform: "browser",
  target: ["es2022"],
  jsx: "automatic",
  plugins: [sassPlugin()],
  alias: {
    "neutron-tools/app": "./dev/mock.ts",
  },
});

await ctx.watch();
const { host, port } = await ctx.serve({ servedir: "./dev", port: 8000 });
console.log(`Cast Away (mock kernel) -> http://${host}:${port}`);
