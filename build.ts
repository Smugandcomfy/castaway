import esbuild from "esbuild";
import { sassPlugin } from "esbuild-sass-plugin";
import { cp, mkdir } from "node:fs/promises";

await mkdir("./dist/web", { recursive: true });

await esbuild.build({
  entryPoints: ["./src/index.tsx"],
  outfile: "./dist/web/main.js",
  bundle: true,
  minify: true,
  platform: "browser",
  target: ["es2022"],
  jsx: "automatic",
  plugins: [sassPlugin()],
});

await cp("./public", "./dist/web", { recursive: true });
