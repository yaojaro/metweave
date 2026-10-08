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
- **弹窗原文区双编码 tab（v0.3 第五期）**：实况弹窗的「报文原文」区在 AWC IWXXM 预取就绪后出现 tab 组——主 tab 为 IEM 侧 TAC 电码，另一 tab「IWXXM（AWC）」展示同站最新观测的 IWXXM XML（后台单请求批量预取，`/aw-metar` vite 代理转发——端点无 CORS 头；AWC 侧时次可能与 IEM 差半点到一小时，卡片时间行以主视图为准；预取失败或静态部署无代理时无 tab，其余功能不受影响，管线见 `src/iwxxm-prefetch.ts`）。
- **站点定位**：来自 `examples/stations.json`（静态元数据，由 `pnpm gen:stations` 生成）——精确机场坐标为权威源，IEM 自带坐标仅兜底。
- **底图**：天地图（官方 WMTS 端点），按 key 门控——**示例不自带 key**。到 console.tianditu.gov.cn 申请**浏览器端** key，写入 `examples/.env.local` 的 `VITE_TIANDITU_KEY=你的key`，重启 dev server 即可。未配置时页面就地提示配置方式，且不上任何底图（不静默替换成其他底图源）。key 只经环境变量注入，不走 URL 参数。
- **免责声明**：页面常驻页脚，声明演示用途、不得用于运行决策、与 IEM / NOAA/NCEP / 天地图无隶属关系。
- **构建**：`pnpm build:examples`（等价于 `pnpm --filter metweave-examples build`）。注意构建会把 `VITE_TIANDITU_KEY` **内联进 `examples/dist`**——该目录已被 gitignore，但打包或对外分发前请先删掉它，或轮换其中内联的 key（`pnpm check:leaks` 会对构建产物里的活密钥报错）。

## 格点图层（v0.3 起，按要素逐个进——主示例页同屏）

格点填色不单设页面（2026-10-07 产品形态调整：由独立演示页并入主示例页，同日再调整为抽屉面板）：主示例页**顶栏「格点图层」按钮**唤起右侧抽屉，把 GFS 格点场渲成色斑图（逐像素双线性取样＋档案化分级着色）叠在底图与站点标记之间，与实况/预报模式正交（两模式都保留背景场）；`?element=<短名>` 仍可直达指定要素（未知回落首项）。

- **抽屉结构**（自上而下）：「拉最新」＋不透明度滑杆（0.2–0.9、步进 0.05、缺省 0.6，经叠加层 `setOpacity` 原地调不重建层）置顶 → 头部状态行（只承载加载中/错误＋重试/未选择提示——成功态溯源随选中行展开体展示）→ 要素行列表（占抽屉余高、超出滚动）。每要素一行：行头点击选中，**再点选中行＝取消**（不选＝不展示，色斑/等值线/风杆整层摘除，再选走内存缓存零重取）；选中行展开体＝**整合色卡**（渐变条下对应位置标刻度值，首末锚定边缘、近值右让）＋数据源行（直读 `.mwgrid` 容器头 meta）＋要素描述文案。加要素＝`src/grid-data.ts` 的 `GRID_ELEMENTS` 加一行（面板结构按多要素设计；P0 基线 14 要素中 gust〔阵风〕2026-10-08 定案取消不落档案，档案面 13 要素收口，清单以 `GRID_ELEMENTS` 为准）。
- **预报时效（fhour）**：抽屉头部步进器（◀ 值钮 ▶，不走下拉）——值钮点击切换「自动」（缺省）⇄手动定档，◀▶ 逐小时调档（f00–f72 边界禁用）；自动＝初载 f000 后按容器头起报时次的时效龄探测最近档，档在则跳、不在则诚实留在 f000。缓存键 `element@fhour`——切时效零重复 fetch。
- **数据三层语义**：`/grid/<短名>[_fHHH]_cn.mwgrid`（`pnpm gen:grid --element <短名> --fhour <0-120|auto>` 产物，dev 由 vite publicDir 直出 `examples/data/`）＞仓内冻结基线（`corpus/grid` 的 tmp 中国域 f32，前端拼装成同构 Grid，静态部署恒可渲染；仅 f000——显式定档取不到不静默回落 f000）＞头部状态行报错＋重试；内存缓存按要素×时效记，切回/重开不重复拉取、不预取。
- **「拉最新」按钮**（仅 dev，取消选中期间禁用）：`GET /api/gen-grid?element=<短名>&fhour=<档|auto>`（vite dev 中间件，`src/gen-grid-api.ts`——仅 dev server、构建产物不含）服务端 spawn `pnpm gen:grid`（NOMADS 取数＋GRIB2 解码全在 Node）；grid dist 未构建时返回可行动提示、拉取 5 分钟兜底超时、进行中重复触发 409 防抖；成功后前端按应答回带的实际 fhour 构造产物名直载，强制重取遇 404 自动退避重试（dev 静态服务新文件有 ~2s 404 窗）；失败保留旧图。静态部署（gh-pages）无中间件——探测 404 即隐藏按钮（与 iwxxm 预取静默降级同纪律）。
- **渲染链**：`@metweave/grid` 的 `renderToImageData`（零 DOM 纯函数，Node 可测）×要素档案（色标/档位/量纲换算单一来源）→ `@metweave/leaflet` 的 `addGridLayer`（独立 pane `mw-grid`，色斑恒在底图之上、站点标记与弹窗之下）；等值线主导要素（renderForm `filled+contours`）在色斑之上叠等值线＋标注层，双分量要素（`filled+barbs`）叠风向杆层——显隐随选中/切换同进退，面板零要素名特判。既有要素的渲染像素由快照测试锁死（`src/grid-data.test.ts` 与包内核测试双处互证）。
- **无底图 key 的静态降级态**：色斑不依赖底图 key——降级态同样「格点背景＋静态站点样例」同屏叠加；控制件按顶栏按钮＋右侧抽屉收起，与站点列表互让不压叠。

## IWXXM 演示页（v0.3 alpha）

dev server 起后访问 `/iwxxm.html`（与主 demo 同一服务）：NOAA AWC 实时流（IWXXM 2025-2）全球站上图——XML 在浏览器本地 `parseIwxxm` 解析成与 TAC 同一份 IR，再渲染中文卡与条件色圆点；页面下方「同站双形态对照」区用官方等价对（2023-1 静态样例）把同一份观测的 TAC 卡与 IWXXM 卡并排，逐字段核对两种官方编码的一致性（AWC 实时流的转换有损——趋势/RVR 不转、能见度经英里折算——不适用逐字段对照，口径差异见 `corpus/iwxxm/awc/README.md`）。

- **数据面**：`examples/iwxxm-data.json`（入库产物，`pnpm gen:iwxxm` 可再生，站单可用 `--ids=` 或环境变量 `GEN_IWXXM_IDS` 覆盖，缺省全球代表 30 站）——首选 NOAA AWC 实时流（`aviationweather.gov/api/data/metar?ids=<站单>&format=iwxxm`，免鉴权、单请求批量、重试 ×3、超时 60s，成功逐站标注 `fetchSource=awc-live`；`ids=all` 不支持 iwxxm 格式，必须站单列表；端点无 CORS 头，Node 侧取数）；AWC 不可用时降级仓内官方等价对副本（`fetchSource=corpus-local`）；ECCC 真实流探测结果仍记录在产物 `ecccProbe` 字段（现仅 TAF 无 METAR）；页面侧三层兜底：gen 产物＞源码内嵌样例＞状态条报错。
- **验收**：`examples/src/iwxxm-demo.test.ts` 锁数据面（产物站数与 fetchSource 口径、逐站双通道可解析、对照区内嵌等价对两通道 IR deep-equal、卡片 DOM 渲染）。
