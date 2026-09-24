# metweave

把公开气象数据编织成可嵌入产品的图：机场报文（METAR / SPECI 观测与 TAF 预报）经「解析 → 标准化 → 渲染」一条管道，变成报文卡片与地图图层。数据直连公开源（IEM 实况端点 CORS 全开，浏览器可直连；TAF 上游无 CORS 头，需代理或镜像——见下）；解析与渲染全部在浏览器端完成——报文不经过你自己的服务器，无需自建后端。

### 安装

```bash
npm install metweave @metweave/leaflet leaflet
# TypeScript 用户另装类型：npm install -D @types/leaflet
```

### 快速开始

底图请在 [天地图](https://console.tianditu.gov.cn/)申请自己的**浏览器端 key**（服务条款要求按应用申请）。示例把 key 放环境变量，不写进代码：

```ts
import * as L from "leaflet";
import "leaflet/dist/leaflet.css"; // 别漏：不引入 CSS 地图不渲染
import { CN_STATIONS } from "metweave/stations-cn";
import { getMetarReports } from "metweave/sources"; // 取数 → 解析 → 定位
import { addMetarLayer } from "@metweave/leaflet";

const TDT_KEY = import.meta.env.VITE_TIANDITU_KEY; // 你自己的天地图 key
const map = L.map("map", { center: [35.5, 105], zoom: 4 });
L.tileLayer(
  `https://t{s}.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TDT_KEY}`,
  { subdomains: ["0", "1", "2", "3", "4", "5", "6", "7"], attribution: "底图 © 天地图" },
).addTo(map);
await addMetarLayer(map, await getMetarReports(), { conditionColors: true });
```

### TAF 预报侧（同样三步）

```ts
import { getTafReports } from "metweave/sources";
import { addTafLayer } from "@metweave/leaflet";

// TAF 端点不提供坐标——stations 联表是定位的唯一来源（中国 39 站元数据随包自带）
const tafItems = await getTafReports(["ZBAA", "ZBAD"], {
  baseUrl: "/aw-taf", // 上游无 CORS 头：浏览器直连走自建代理/镜像（根因与三条出路见主仓库 README「TAF 取数与 CORS」）
  stations: CN_STATIONS,
});
const tafLayer = await addTafLayer(map, tafItems); // 圆点四档色/悬停摘要/TAF 卡弹窗，与实况层同款
```

本包再导出 `@metweave/core` / `parser` / `render`（整条管道一个入口，含 `toValues` 与机读错误类）：预报侧 `parseTaf`（tolerant 与 `mode: "strict"` 严判）、`expandTaf` 时间线展开、`tafSegments` 分段明细、`validateTaf` 条文判据校验、`renderTafCard` TAF 卡片。`metweave/sources` 提供双线取数 helper（`getMetars` / `getMetarReports` 与 `getTafs` / `getTafReports`，各带 `baseUrl` 换源位）；`metweave/stations-cn` 提供中国 39 站元数据。文档与完整示例见[主仓库](https://github.com/yaojaro/metweave)。

## 许可

[MIT](https://github.com/yaojaro/metweave/blob/main/LICENSE) © 2026 YaoJaro——授权仅覆盖本仓库的代码与文档；随包分发的报文样本不在其列，详见主仓库 README 的「许可」说明。
