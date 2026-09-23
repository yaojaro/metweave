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
- **TAF 渲染三件**（owner「渲染层继续」指令）：`addTafLayer`（`@metweave/leaflet`，预报当观测渲——TAF 展开结果投影喂 METAR 同一档位管线，TEMPO 发作/过渡带入提示，NIL/CNL 灰点口径对齐）；`renderTafCard`（`@metweave/render`，含按分钟比例的有效期时间线条：BECMG 渐变 / TEMPO 斜纹 / PROB 浅叠 / FM 竖线 / TX-TN 标记）；`setTafLayerTime` + `createTafTimeControl`（同实例原地重建的全图换时刻 + 零框架时间滑杆）。
- **TAF 卡片分段天气明细**（owner 9/23 指令「按拆分时间段给具体天气、像 METAR 报一样具体、专业/小白双受众」）：`tafSegments`（`@metweave/parser`，主导段 / BECMG 过渡带 / TEMPO·PROB 挂载行按时间升序，行值＝段中点展开；与 `expandTaf` 共用切段规则单一来源）；`renderTafCard` 变化组电码清单升级为逐段「时间窗 + 类型徽 + 人话要素」，电码紧凑串走悬停/读屏（沿 METAR 卡主表人话、原码悬停口径）；`@metweave/render` 抽 `gloss.ts` 人话词表内核（wx / cloud / wind / CAVOK 短译与 METAR 卡共用单一真相，行为零变化）。
- **TAF 卡二轮（owner 9/23 二轮反馈）**：分段行头加扫视色点（好/注意/差，判据与 METAR 卡行色同族并迁 `gloss.ts` 共用），行体改带标签要素条目（风/能见度/天气/云）；**RAW 对照 + 行↔原文双向联动**——已知组（有效期/基况各要素/变化组/气温组）在报文原文里逐组包 span，悬停分段行或原文片段两侧同时点亮，原文片悬停即给该组人话；leaflet TAF 弹窗默认开 RAW。
- **TAF 卡三轮（owner 9/23 三轮反馈）**：RAW 对照独立盒区置底（METAR 卡同款）、气温极值行移其上；分段要素两列网格一行两条；联动细化到**组级**——悬停「风/能见度/天气/云」条目只点亮其来源组片（继承值沿变化链溯源、FM 硬界止），反向悬停组片点亮对应条目，行头悬停点亮该行全部片；变化组内要素在 RAW 里嵌套子片（装配栈逐字符保真）。
- **TAF 卡四轮（owner 四轮评审）**：移除比例时间线条带（分段明细与气温极值行已完整承载其信息量，无刻度图例的抽象条只余理解成本）；RAW 区去「原文｜」前缀直接展示报文。
- **TAF 卡五轮（owner 五轮指令）**：元信息按报文语序（发布在前、有效期在后）；有效期直说具体日期时间（`自 23日 06:00Z 至 24日 06:00Z（UTC，24 小时）`，止时 24 显示为次日 00:00）；气温极值上移至分段上方，多组分行（组标题 + 高温一行 + 低温一行）。
- **TAF 卡六轮（owner 六轮指令）**：展开时刻并入发布行——「发布 xx Z｜预报 xxZ 时刻」同行左右两列（`renderTafCard` 新增 `at` 选项，地图层传入；层顶独立摘要行移除）。

### 变更

- METAR 侧行为零变化：324 存量测试零改动全绿；803 万行冻结快照逐报文指纹全程零漂移（批 0→4 复核）。
- 依赖方向契约改约：core←parser←render←leaflet（render / leaflet 合法依赖 parser——TAF 分段明细需在渲染层消费展开器）；顺带修正 leaflet dist 外部化引用 `@metweave/parser` 却仅声明 devDependencies 的打包暗病（0.2.0 未发布，无人踩中）。

### 修复

- `setTafLayerTime` 连拨竞态叠点（`@metweave/leaflet`）：`clearLayers` 同步而 populate 隔一个 `await`，同步连发多次换时刻时各次清层都落在空层、多批标记叠加（demo 实测 38 站连拨三下变 114 点）——每层代际令牌，旧代重建作废，回归测试先证伪再锁绿。
- TAF 卡风组电码重建的阵风位序：真码 `04009G16MPS`（阵风在单位前），旧拼法产出 `MPSG16`（无阵风用例未覆盖的暗病）。

### 测试

- 398 例全绿（v0.1.2 为 324，TAF 侧 +74）；夹具 11 条三源溯源（ogimet / aviationweather / 教材）。

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
