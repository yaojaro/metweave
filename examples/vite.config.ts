import { defineConfig, type Plugin } from "vite";
import { fileURLToPath } from "node:url";
import { createGenGridMiddleware, spawnGenGrid, gridDistReady } from "./src/gen-grid-api";

// aviationweather.gov / ogimet.com 数据接口均不带 CORS 头（浏览器直 fetch 被拦）——开发期走 vite 服务端代理；
// 静态部署（GitHub Pages）时 TAF 演示需自带代理或镜像（sources 两线的 baseUrl 覆盖位即为此留），见 README。
// /aw-metar 供主示例页的 AWC IWXXM 备选视图预取（v0.3 第五期）：静态部署无代理时预取自然失败、
// 弹窗原文区不出现 IWXXM tab（静默降级不弹错误），其余功能不受影响——见 src/iwxxm-prefetch.ts

// 仓库根（examples 的上一级）：gen-grid CLI 与 grid 包 dist 都以根为锚
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

/**
 * 「拉最新」dev 中间件（仅 dev server、build 产物不含——configureServer 不进打包）：
 * 浏览器按钮 → GET /api/gen-grid?element=<name> → 服务端 spawn `node scripts/gen-grid.mjs
 * --element <name>`（NOMADS 取数＋GRIB2 解码全在 Node，「GRIB 不进浏览器」红线）→ 落盘
 * examples/data/grid/ 后前端带缓存戳重取。并发防抖/超时/dist 检查见 src/gen-grid-api.ts；
 * 静态部署无此中间件（探测 404）→ 前端按钮自隐藏。
 */
const genGridDevPlugin = (): Plugin => ({
  name: "metweave-gen-grid",
  configureServer(server) {
    server.middlewares.use(
      "/api/gen-grid",
      createGenGridMiddleware({
        runner: spawnGenGrid(`${repoRoot}scripts/gen-grid.mjs`, repoRoot),
        distReady: gridDistReady(repoRoot),
      }),
    );
  },
});

export default defineConfig({
  // 静态资源根＝examples/data（gen:grid 产物目录）：dev 下 /grid/tmp_cn.mwgrid 直出磁盘
  // 最新产物；build 时目录内容随构建拷贝（本机有 gen 产物则静态站吃到最近一次拉取，没有
  // 则页面走仓内冻结基线兜底——examples/data 已 gitignore，不进仓）
  publicDir: "data",
  // 多页应用、无客户端路由：关掉 SPA 回退——不存在的页面（如已移除的 /grid.html）
  // 返回真实 404，而不是被静默改写成首页（与静态部署的 404 行为一致）
  appType: "mpa",
  server: {
    proxy: {
      "/aw-taf": {
        target: "https://aviationweather.gov",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/aw-taf/, "/api/data/taf"),
      },
      "/aw-metar": {
        target: "https://aviationweather.gov",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/aw-metar/, "/api/data/metar"),
      },
      "/ogimet-taf": {
        target: "https://www.ogimet.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ogimet-taf/, "/display_metars2.php"),
        headers: { referer: "https://www.ogimet.com/metars.phtml.en" }, // ogimet 端要求同源 referer
      },
    },
  },
  plugins: [genGridDevPlugin()],
  // 两页面：主 demo（index.html，TAC 实况/TAF＋格点图层面板）+ IWXXM 演示（iwxxm.html，v0.3 alpha）。
  // 格点填色不再单设页面——图层控制并入主示例页（src/grid-panel.ts），`/api/gen-grid`
  // 中间件与 publicDir=data 照旧（首页「拉最新」与 /grid/<file> 直出仍依赖）
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        iwxxm: fileURLToPath(new URL("./iwxxm.html", import.meta.url)),
      },
    },
  },
});
