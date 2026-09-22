# 更新日志

本项目的显著变更记录于此。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本语义遵循 [SemVer](https://semver.org/lang/zh-CN/)——v0.x 期间 minor 即可能引入破坏性变更，五个包锁步同版本发布。

## [0.1.2] - 2026-09-22

着色判据的运行视角修订 + 文档补强。判据变更源自五角色试读评审（前端 / 签派员 / 大气科研 / 技术选型 / 气象爱好者）中签派员的专业复核意见。

### 变更

- **冻降水族升红**（`@metweave/leaflet` 站点档位 + `@metweave/render` 卡片行色）：FZ 描述符（FZRA 冻雨 / FZDZ 冻毛毛雨等）由琥珀档升至红档——对运行场景，冻降水危害与雷暴同级。
- **能见度琥珀档上限 4800 → 5000 m**（两包同改）：弃用美国 Marginal VFR 边界换算值，改取国内通行的 1500/5000 m 分档口径（红档 <1500 m 原即吻合）。
- 判据文档（JSDoc）明确云底判据的 **BKN/OVC 云层限定**（含垂直能见度）——行为未变，表述修正为与实现一致（FEW/SCT 不参与云底档位，示例报文 FEW002 标琥珀不再与文档矛盾）。

### 新增

- 测试锁 +2：FZRA 档位与卡片行色用例、4900 m 边界用例（全量 324 例）。

### 文档

- README 坐标系条目补 GCJ-02 偏移注记（高德/腾讯系底图与 WGS-84 站点叠加数百米偏移，是否校正由宿主决定）。
- README 首屏动图重录为 1400×900（全局调色板 + 四档品牌色注入保真合成），alt 描述同步。

## [0.1.1] - 2026-09-16

0.1.0 的修订版：五方实测评测（前端新手 / 资深前端 / 航空气象预报员 / 数据工程师 / 技术选型负责人，全部 npm 实装）发现问题的集中修复与增强。

### 修复

- **趋势时段斜杠形态（DDHH/DDHH）不再散落正文**（`@metweave/parser`）：`TEMPO 1616/1618` 是 ICAO Annex 3 模板 / 中国民航主流编法，此前不识别导致趋势内容倒灌正文——正文能见度被趋势值以 last-wins 顶掉、趋势天气/云污染正文、并可能触发假矛盾告警。现按趋势段收口（指示组在位 → kind 保持 tempo/becmg；缺指示组的裸斜杠按 unspecified 收段并出声），新增夹具 `synth-trend-slash-*`（实弹待补采）与合规矩阵第 72 行。

### 变更

- **【破坏性】`@metweave/leaflet` 的 `addMetarLayer` 改为异步**（返回 `Promise<LayerGroup>`）：leaflet 由首次调用时动态装载——此前顶层静态 import 使 Node/SSR 模块图求值即崩（`window is not defined`）。调用侧需 `await`（破坏性，见 README 示例）。
- 卡片译法校准：「磨损趋势段」→「变化趋势段（指示组缺失…）」；SPECI 徽标「特殊报告」→「特殊天气报告」（对齐 AP-117 口径）。

### 新增

- **`metweave/stations-cn` 子路径**（伞包）：中国 39 站静态元数据（ICAO / 名称 / WGS-84 精确坐标 / 标高米，aviationweather.gov 采集、`pnpm gen:stations` 单源再生）——「精确站名与坐标联表」开箱即用，不再要求用户去仓库翻 `examples/stations.json`。
- `getMetarReports` 新增 `spans: false` 透传（紧凑模式入库存储约 -32%，此前需自行拆 `getMetars` + `parse` 组装）。
- `@metweave/parser` 就近 re-export IR 类型（`MetarReport` / `Observed` / `TrendGroup` 等）——返回类型不再需要去 `@metweave/core` 找。
- 告警 `<li>` 新增严重度 class 钩子：`mw-info` / `mw-warning` / `mw-error`（下游 CSS 可按严重度定向着色）。
- README 增补：Vue3 `<Suspense>` 防呆、无天地图 key 时的实际表现说明、错误日志采集应取 `err.raw` 的提示。

## [0.1.0] - 2026-09-16

首版：机场报文（METAR / SPECI）的「解析 → 标准化 → 渲染」一条完整管道。

### 变更

- 文档语言政策反转为**中文单源**：根 README、CHANGELOG、CONTRIBUTING、`docs/`、`corpus/`、`examples/`、五包 README 与 `.github/` 模板统一为全中文（英文全文保存于 git 历史）。豁免两项保持原状——[SECURITY.md](SECURITY.md) 双语（安全报告是全球入站通道）、`terms/` 术语册一册一语言（产品多语言资产）。配套门禁 `check:docs` 由「双语强制」反转为「中文单源强制」：英文镜像章节与英文正文段落一律拦截（`scripts/check-docs-chinese.mjs`）。

### 新增

- **tolerant METAR/SPECI 解析器**（`@metweave/parser`）：以真实公开报文夹具验收——未知组进 `warnings[]` 不静默、缺测电码三态显式建模、单位跟组走、超界值判缺测并告警、跑道状态组、RMK 附加段、趋势段要素结构化、语义交叉校验（温露倒挂、CAVOK 矛盾等）。
- **IR 数据模型**（`@metweave/core`）：解析器与渲染组件之间的唯一契约——纯 JSON 可序列化、一切产物携带原文 span、组级三态缺测、`toValues()` 两态取值视图、机读告警与错误码（code 只增不改）。
- **报文卡片**（`@metweave/render`）：零框架 DOM 组件——RAW 对照视图（缺测/告警高亮 + 悬停解释）、分组「转换说明」弹窗（原码 → 含义，附规范依据）、zh / en 双语 locale、云底正面单位随语言（en 英尺 / zh 米，`heightUnit` 可覆盖）、站名行与跑道状态行。
- **Leaflet 适配器**（`@metweave/leaflet`）：报文卡片上图（marker + tooltip + 卡片弹窗）。
- **伞包与取数**（`metweave`）：再导出 core / parser / render；`metweave/sources` 取数 helper（IEM currents 端点、超时/取消语义、机读错误码）。
- **质量基建**：2,300+ 条全球真实报文语料回放、种子化模糊测试（十一项产物不变量）、290+ 单元测试、全量静态门禁；[docs/compliance.md](docs/compliance.md) 收录 METAR/SPECI 编码面 106 条符合性审计矩阵。
- **端到端示例**（`examples/`）：公开报文 → 解析 → 地图，含站点元数据联表、条件色图层、实况获取状态反馈与页面免责声明；底图用天地图官方 WMTS 端点，按 key 门控（key 自备，仅经环境变量注入）。

### 修复

- 同族组重复改用专用告警 `duplicate-group`（warning 级，被顶替值与保留值原文都在 message）；后位零信息量缺测形态（`////` 等）不再按 last-wins 顶替在场观测。
- `addMetarLayer` 顶层 `locale` 生效（等价 `card.locale` 速记）；`renderCard` / `addMetarLayer` 对未知选项键与非法取值运行时报清晰错误，不再静默忽略。

[0.1.0]: https://github.com/yaojaro/metweave/releases/tag/v0.1.0
[0.1.1]: https://github.com/yaojaro/metweave/releases/tag/v0.1.1
