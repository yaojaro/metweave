import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  external: [/^@metweave\//, /^leaflet$/],
  // 固定产物扩展名：ESM → .js/.d.ts，CJS → .cjs/.d.cts（与 package.json exports 对齐）
  outExtensions: ({ format }) => ({
    js: format === "cjs" ? ".cjs" : ".js",
    dts: format === "cjs" ? ".d.cts" : ".d.ts",
  }),
});
