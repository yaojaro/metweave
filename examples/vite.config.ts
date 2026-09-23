import { defineConfig } from "vite";

// aviationweather.gov 数据接口不带 CORS 头（浏览器直 fetch 被拦）——开发期走 vite 服务端代理；
// 静态部署（GitHub Pages）时 TAF 演示需自带快照或改走支持 CORS 的通路，见 README
export default defineConfig({
  server: {
    proxy: {
      "/aw-taf": {
        target: "https://aviationweather.gov",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/aw-taf/, "/api/data/taf"),
      },
    },
  },
});
