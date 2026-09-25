# 更新日志

本项目的显著变更记录于此。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本语义遵循 [SemVer](https://semver.org/lang/zh-CN/)——v0.x 期间 minor 即可能引入破坏性变更，五个包锁步同版本发布。

## [0.2.0] - 2026-09-23

TAF（FM 51）解析层全量落地：解析 → 时间线展开的预报侧工具链，与 METAR 观测侧同入口同纪律。施工图＝W39 补全清单 24 条（A 结构层 4 / B 时间层 9 / C 要素层 8 / D 出题判卷纪律 3），★ 考核失分点 12 条全实证锁。

### 新增

- **`parseTaf` / `tryParseTaf`**（`@metweave/parser`）：电头 token 序列不写死槽位（TAF 词可省 / AMD·COR 任意相对序 / COR 时组后位，A4）；传输层终止符 `=` 剥离（A1，双通道双形态等价）；NIL 双形态（占时组位 `TAF ZSAM NIL=` / 占有效期位）与 CNL 占风组位（A2，cancelled 置位且有效期保留）；AAA/CCA 族仅容错（A3，824 万条 0 出现结论沿用）。
- **基况段四要素 + CAVOK**：复用 METAR 组级共享层（groups.ts 机械迁出，零重写），组装语义沿 METAR（重复组 last-wins 出声、缺测不顶替在场值、三态 Observed、span 保真）。
- **变化组结构化**（B4/B5 token 层 + B8/B9）：FM 硬时刻 GGgg、BECMG/TEMPO 带窗、PROB 独立与 PROB TEMPO 连用（组合违例出声）；中方四位短窗日归属回有效期起日（仅前向时对判窗防误吞）；解析层只收「组内所列要素」，继承语义不越权代判。
- **`expandTaf` 时间线展开器**：五步算法（切段→挂载→绑段→合成→叠加）；FM 硬分页（此前一切作废）；BECMG 接棒 + 云例外（cloud-only BECMG 单层全重报）；过渡带显式 uncertain（B6，按前段值保守返回）；TEMPO 发作/间歇双态（B7，weather 整列替换、未列要素继承）；CAVOK 让位语义（回溯途中遇 CAVOK 其前未定要素作废）；B3 跨月回绕月锚。黄金基准＝taf-timeline §3 三例 13 时刻逐格断言。
- **`tafDurationHours`**：有效期时长差值判别（B1，禁用发布钟点——03/09/15/21Z 与版本解耦）；止时 24 午夜特例（B2）；ogimet 八年分层 2054 条分布对拍 24h/30h 两制吻合，新发现 48h/54h 加长报真实长尾。
- **气温组 TX/TN**（C6）：1–4 组交错、M 负值前缀、超 WMO 上限出声不丢弃；实码形态实证修正为 ddHHZ（另收编无日短形态 HHZ 方言）。
- **天气白名单双层**（C5）：国际白名单为基，中国扩展层（弱档 `-` / BR / HZ）容错收下 + info 出声，拒收语义归 /validate。
- **IR 类型族**（`@metweave/core`）：TafReport / TafValidityGroup / TafChangeGroup 族 / TafTemperatureGroup；错误码新增 `missing-validity` / `invalid-validity`（只增不改）；`ParseError` 报文中性别名。
- **方言收编**（ogimet 分层抽样 312 条实测）：有效期无斜杠形态 `dddddd`（ZWWW 160024）、TX/TN 无日短形态、BECMG 短窗（B9 机制覆盖）——皆 tolerant 收下 + 出声。
- **工程工具**：`replay:full` 全量回放对拍器（803 万行本地历史数据双版本逐报文指纹零漂移验证法沉淀）；fuzz 套件 TAF 池接线（5 万 + 5 万例零违例）；`corpus/taf` 语料回归仓（312/312 全解析成功、unknown-token 全语料仅 1 枚传输错拼）。
- **TAF 渲染三件**：`addTafLayer`（`@metweave/leaflet`，预报当观测渲——TAF 展开结果投影喂 METAR 同一档位管线，NIL/CNL 灰点口径对齐）；`renderTafCard`（`@metweave/render`）；`setTafLayerTime` + `createTafTimeControl`（同实例原地重建的全图换时刻 + 零框架时间滑杆）。
- **TAF 卡片分段明细与 RAW 对照**：`tafSegments`（`@metweave/parser`，主导段 / BECMG 过渡带 / TEMPO·PROB 挂载行按时间升序，与 `expandTaf` 共用切段规则）；卡片逐段「时间窗 + 类型徽 + 人话要素」+ 气温极值行 + 关键风险摘要行 + 出界提示；RAW 对照置底，行↔原文**组级双向联动**（悬停点亮来源组片，继承值沿变化链溯源）；`gloss.ts` 人话词表内核（两卡共用单一真相）。
- **徽章与时间显示**：类型徽双标 + 概率显式（TEMPO·间歇（≥40%）/ PROB30·概率30% / BECMG·渐变中·转变后 / FM·自此）；发布在前、有效期直说具体日期时间（止时 24 显示为次日 00:00）；「查看时刻」并入发布行（`at` 选项）。
- **三角色评测改进批**：时间双制括注与 `stationTitle` 站名行；小白人话包（风向八方位+蒲福风级、云底台阶化分行）；联动可达包（Tab 聚焦三通道、警示语对比度达标）；常显 ICAO 站码标签（zoom≥5 门控）；`setTafLayerTime` 瘦身为原地更新（已开弹窗即时换内容）；弹窗惰性渲染与焦点管理；demo 38 站列表视图（档色点+下一变化、行点击飞行开卡）。
- **复测修复批**：TEMPO 概率措辞改「≥40%」（ICAO 语义）；超有效期＝灰点「预报尚未生效/已过期」；滑杆焦点劫持修复（键盘拖动不抢焦）；弹窗置顶提示随时刻重算；卡高上限 `min(65vh, 680px)` 内滚、卡宽 480、`popupOptions` 透传（宿主为固定悬浮层留避让边）；demo 行点击改「先飞到位再开卡」。
- **时区单制**：`utcOffsetMinutes` 语义升级为「展示时区」（缺省 UTC、480＝北京时；全卡单一时区，RAW 原文保持 UTC）——examples 加 UTC/北京时切换按钮，卡片/滑杆/面板/状态时钟全页联动。
- **底部时间轴（demo 窄条）**：现在起 24 小时、10 分钟一格，播放键自动扫全程（手动介入即停）；`createTafTimeControl` 补 `to` 接线与 `tickEveryMinutes` 轴内刻度；「回到现在」按钮与「现在」锚漂移重锚。
- **发作窗升档与图例**：修复 TEMPO 发作窗内圆点不升档（按主导段+叠加合成态定档）；四档图例两模式常驻、挪右侧。
- **在效报补位**：并行拉上一发布周期与最新报合并成按站报池，按查看时刻选在效报——首屏不再整片灰「未生效」，跨生效边界拖动自动换报。
- **就地电码与浮签**：条目悬停/聚焦就地显出来源原文电码（卡内绝对定位浮签，零回流）；点击条目弹「电码→人话」解码气泡＋ FM 51 依据行——METAR 卡同步补齐，两卡交互同契约（点亮+浮签、不做压暗）。
- **月界收口**：时间轴/报池/面板全链改真实毫秒序（跨月不回绕）；`calendarAnchor` / `monthAnchor` 逐报月锚（`@metweave/leaflet`）；北京时经真实 Date 换算。
- **双日界引用**：北京时制下展示日期与 UTC 日期不同日时括注「（UTC M月D日）」（`utcDayRefText`，同日/段头不加）。
- **键盘通道**：两卡 Enter/Space 开合解码气泡、Esc 关闭、`aria-expanded`/`aria-describedby` 读屏接线。
- **左上导览错开**：导览卡与地图缩放控件同高并排（left 52），弹窗 autopan 左上避让按新几何重算。
- **站点面板双模式**：实况模式也有站点列表（`metarTierOf`/`summarizeMetarConditions` 随包导出）——实况＝档色点+站名+实况摘要、预报＝下一变化+「查看时刻 vs 现在」，面板随模式自动切换、宽度自适应内容全展（无内部横向滚动）。
- **TAF 取数收编 sources ＋ 双线换源**：`awTafUrl` / `getTafs`（续行归并+站码提取，失败面沿 getMetars 五路机读码契约）/ `getTafReports`（取数→解析→定位一步到位，契约沿 getMetarReports）；`getMetars` 与 `getTafs` 各留 `baseUrl` 覆盖位——内网镜像/自建网关只换根。
- **ogimet 补充线**：`ogimetTafUrl` / `parseOgimetTafs` / `getTafsOgimet`（display_metars2.php tipo=FT 配方，空窗返回空数组的正常降级口径）；demo 按「aviationweather 最新优先、ogimet 补最新/次新」合并（只补缺口站、并发受限、失败静默）。
- **`validateTaf` 判据校验 + strict 模式**：条文判据收口——C2 VRB 两源阈值（wmo 1.5 / caac 2 m/s，逃逸条款不可机器判已明示）、C3 阵风严格 ≥5 m/s、C5 天气白名单双层（国际基+中国扩展按 standard 取舍）、C7 三层选取（仅全重报语境）；`parseTaf({ mode: "strict" })` 违例聚合抛新错误码 `strict-violation`（info 级方言注记不拦），`validateStandard` 可切中国口径。
- **`metweave/stations-cn` 子路径**（伞包）：中国 39 站静态元数据（ICAO / 名称 / WGS-84 精确坐标 / 标高米，aviationweather.gov 采集、`pnpm gen:stations` 单源再生）——「精确站名与坐标联表」开箱即用，不再要求用户去仓库翻 `examples/stations.json`。
- **TAF 取数收编 sources ＋ 双线换源（owner 9/24 指令「收进 sources 统一维护、内网可切自有数据源」）**：`metweave/sources` 新增 TAF 取数线——`awTafUrl`（aviationweather 端点模板：ids 连接/format=raw/date 序列化）、`getTafs`（取数侧整理：raw 格式缩进续行归并＋best-effort 站码提取；失败面沿 getMetars 五路契约——timeout/network/http-error/empty-data 一律 MetarSourceError 机读码，200+空体显式判错）、`getTafReports`（取数→解析→定位一步到位，契约沿 getMetarReports：stations 联表定位、缺省聚合 batch-parse-failed/传 onUnparseable 逐行容错、spans 紧凑模式；解析先于联表——失败面先出声再谈定位）；**换源口径**：两条线各留 baseUrl 覆盖位（`getMetars`＝IEM 站点根、`getTafs`＝TAF 端点根）——内网镜像/自建网关只换根、路径与查询串由本层拼装；examples TAF 取数由手写 fetch+自行归并改走 `getTafs`（`baseUrl:"/aw-taf"` 走 vite 代理），报池/在效选择等数据管理逻辑留 demo（纪律：永不进开源包）；测试 452→463（续行归并/站码提取/date 入参/五路失败面/联表跳行/聚合抛错各锁，突变必红）。

### 变更

- METAR 侧行为零变化：324 存量测试零改动全绿；803 万行冻结快照逐报文指纹全程零漂移（批 0→4 复核）。
- 依赖方向契约改约：core←parser←render←leaflet（render / leaflet 合法依赖 parser——TAF 分段明细需在渲染层消费展开器）；顺带修正 leaflet dist 外部化引用 `@metweave/parser` 却仅声明 devDependencies 的打包暗病（0.2.0 未发布，无人踩中）。

### 修复

- `setTafLayerTime` 连拨竞态叠点（`@metweave/leaflet`）：`clearLayers` 同步而 populate 隔一个 `await`，同步连发多次换时刻时各次清层都落在空层、多批标记叠加（demo 实测 38 站连拨三下变 114 点）——每层代际令牌，旧代重建作废，回归测试先证伪再锁绿。
- TAF 卡风组电码重建的阵风位序：真码 `04009G16MPS`（阵风在单位前），旧拼法产出 `MPSG16`（无阵风用例未覆盖的暗病）。

### 测试

- 406 例全绿（v0.1.2 为 324，TAF 侧 +82）；夹具 11 条三源溯源（ogimet / aviationweather / 教材）。

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
