import { defineConfig } from "tsdown";

export default defineConfig({
  // 双入口：主入口（TAC）+ iwxxm 子路径（XML→IR，v0.3 起——exports 各子路径的发布面来源）
  entry: ["src/index.ts", "src/iwxxm.ts"],
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
