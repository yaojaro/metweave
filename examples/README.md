# examples

metweave 示例与 demo。每个示例自包含、可独立运行。

## demo：中国 39 站实况地图

公开 METAR 报文 → 地图渲染的端到端示例（Vite + Leaflet）。

运行（仓库根目录）：

```bash
pnpm install
pnpm --filter metweave-examples dev
```

- **数据通路**：浏览器直连 Iowa Environmental Mesonet `currents.json?network=CN__ASOS`（CORS 全开），一次拉取全部 39 个中国站实况报文。
- **加载体验**：打开页面**立即渲染全部站点**（stations.json 元数据，灰色呼吸「待更新」态）；实况到达后原地升级为条件色圆点。等待期间点击站点会看到「实况获取中」进度弹窗，数据到达后该弹窗原地升级为实况卡片；左下角状态条全程反馈拉取进度。
- **转换说明与规范依据**：点击卡片主表任一值或 RAW 视图任一原码组，弹出「转换说明（原码 → 含义）」逐段拆解，底部标注该组转换所依据的规范名称、版本与条款号（如风组 → WMO 306 卷 I.1（2019 年版）FM 15 §15.5.1–15.5.6），可直接按图索骥核查官方原文；告警与未知组在 RAW 中红标，悬停/点击显示告警文案（不静默丢弃纪律的 UI 面）。
- **站点定位**：来自 `examples/stations.json`（静态元数据，由 `pnpm gen:stations` 生成）——精确机场坐标为权威源，IEM 自带坐标仅兜底。
- **底图**：天地图（官方 WMTS 端点），按 key 门控——**示例不自带 key**。到 console.tianditu.gov.cn 申请**浏览器端** key，写入 `examples/.env.local` 的 `VITE_TIANDITU_KEY=你的key`，重启 dev server 即可。未配置时页面就地提示配置方式，且不上任何底图（不静默替换成其他底图源）。key 只经环境变量注入，不走 URL 参数。
- **免责声明**：页面常驻页脚，声明演示用途、不得用于运行决策、与 IEM / NOAA / 天地图无隶属关系。
- **构建**：`pnpm build:examples`（等价于 `pnpm --filter metweave-examples build`）。注意构建会把 `VITE_TIANDITU_KEY` **内联进 `examples/dist`**——该目录已被 gitignore，但打包或对外分发前请先删掉它，或轮换其中内联的 key（`pnpm check:leaks` 会对构建产物里的活密钥报错）。
