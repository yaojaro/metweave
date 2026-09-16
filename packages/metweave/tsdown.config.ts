import { defineConfig } from "tsdown";

export default defineConfig({
  // 双入口：主入口 + sources 取数子路径（exports "./sources" 的发布面来源）
  entry: ["src/index.ts", "src/sources.ts"],
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
