import { defineConfig } from "tsdown";

export default defineConfig({
  // 双入口：主入口（内核：容器读写+类型，E01 起生长插值/分级/渲染）+ convert 子路径
  // （GRIB2→viz-ready，Node 侧管道用；解码器本身同构，但「GRIB 不进浏览器」是路线红线——见 docs/10 十四节）
  entry: ["src/index.ts", "src/convert.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  external: [/^@metweave\//],
  outExtensions: ({ format }) => ({
    js: format === "cjs" ? ".cjs" : ".js",
    dts: format === "cjs" ? ".d.cts" : ".d.ts",
  }),
});
