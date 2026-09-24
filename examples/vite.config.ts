import { defineConfig } from "vite";

// aviationweather.gov / ogimet.com 数据接口均不带 CORS 头（浏览器直 fetch 被拦）——开发期走 vite 服务端代理；
// 静态部署（GitHub Pages）时 TAF 演示需自带代理或镜像（sources 两线的 baseUrl 覆盖位即为此留），见 README
export default defineConfig({
  server: {
    proxy: {
      "/aw-taf": {
        target: "https://aviationweather.gov",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/aw-taf/, "/api/data/taf"),
      },
      "/ogimet-taf": {
        target: "https://www.ogimet.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ogimet-taf/, "/display_metars2.php"),
        headers: { referer: "https://www.ogimet.com/metars.phtml.en" }, // ogimet 端要求同源 referer
      },
    },
  },
});
