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
- **三角色评测改进批（签派员/前端工程师/小白三 subagent 评测，评测报告与共识见工作区归档）**：
  - render 包：时间双制（zh 全卡关键时间括注北京时，`utcOffsetMinutes` 可覆盖；「预报 xx 时刻」改「查看时刻」、Z 写法统一）；`stationTitle` 站名行；徽章双标+概率显式（TEMPO·间歇（约40%）/PROB30·概率30%/BECMG·渐变中·转变后/FM·自此，基况→主要天气）；出界琥珀提示（查看时刻早于/超出有效期）；关键风险摘要行+分段行档位左边条+RAW 组片档位着色（图卡层级倒挂修复）；小白人话包（风向八方位+蒲福风级括注精确值、云底台阶化百米逐层分行、气温值去重复）；联动可达包（tabIndex+focusin 三通道、虚线 affordance、激活压暗非相关项、原文区标题+提示行、去 aria-label 覆盖保读屏人话、警示语重写+对比度达标）；`renderTafCard` 未知选项运行时抛错；CNL 卡提前返回。
  - leaflet 包：常显 ICAO 站码标签（zoom≥5 门控、白描边；悬停摘要保留）；`addTafLayer` card 透传（raw/className/stationTitle/utcOffsetMinutes）+ stationTitle 自动联表；TAF 弹窗焦点管理；弹窗惰性渲染（popupopen 建卡）；`setTafLayerTime` 瘦身为原地 setIcon/setTooltipContent（不清层、已开弹窗即时换内容、监听器零 churn，代际令牌随重建路径退役）；滑杆窗对齐数据（from=最早起点 to=最晚止点）+ locale 化 + 京时括注 + aria-valuetext + rAF 合帧。
  - examples：38 站列表视图（档色点+站码+站名+下一变化、按当前时刻档位排序、行点击飞行开卡、滑杆联动刷新、键盘可达）；fetch 健壮化（20s 超时/防重入/四态错误文案）。
  - 测试：G 阵风断言补样例覆盖（NIL/CNL/CAVOK/PROB 随评测批用例）；全量 404。
- **新问题修复批（复测遗留项收口）**：出窗灰态（超有效期＝灰点+「预报尚未生效/已过期」——与卡内出界提示同口径）；出界提示行附「所示为 xxZ 发布的报文」（时间倒错过渡说明）；滑杆端点标注（两端起止时刻带京时）；双高温/低温逐值分行；条目撤 Tab 序（行头代表段，单卡 Tab stop 减半）；地图角四档图例；站名 Bao'an 拼写修正。核查结案：三站同窗 BECMG 系华北同一天气系统真实同步（非解析串站）。
- **复测修复批（三角色二轮复测后）**：TEMPO 概率措辞改「≥40%」（ICAO 语义）；出界提示行大白话去「基况」；关键风险/气温行补京时、京时格式统一 HH:00、Z 写法统一；TEMPO 注明「叠加在主时段之内」；京时括注对比度达标；**N1 滑杆焦点劫持**（换时刻改走刷新函数、不再合成 popupopen——键盘拖动不抢焦）；**N2 弹窗置顶提示随时刻重算**；N5 缺省 at 保持层当前时刻；N6 去滑杆双朗读；面板「下一变化」人话化（dd日HH时+京时）+四档图例、「档」列改「状态」。
- **超高卡版式批（owner 9/24 指令：卡不占满屏/不压固定悬浮层/分段留间距）**：`renderTafCard` 卡宽 420→480、卡高上限 `min(65vh, 680px)` 且超高卡内上下滚动（占屏约 2/3，超长内容不再被视口裁顶）；分段行间距 7px；`addTafLayer`/`addMetarLayer` 新增 `popupOptions` 透传 bindPopup（宿主以 autoPanPadding 族为固定悬浮层留避让边；缺省 maxWidth——METAR 420 不变、TAF 随卡宽 480）；examples 两层接入避让边（顶让模式切换条、底让免责声明/图例/状态条）且站点列表行点击改「先飞到位再开卡」（飞行中开弹窗＝autoPan 按中间帧算避让、动画随后把地图带走）；卡内滚轮与地图缩放的隔离由 Leaflet 弹窗内建 `disableScrollPropagation` 提供（只截传播不拦默认滚动——叠加自带监听实测纯冗余），行为已入测试锁。
- **时区单制批（owner 9/24 指令：一个开关控全页时间，缺省 UTC；旧「UTC+京时双括注」退役）**：`renderTafCard`/`renderCard` 的 `utcOffsetMinutes` 语义升级为「展示时区」——缺省 null＝UTC 单制、480＝北京时单制（全卡只显一个时区：发布/查看/有效期/风险行/分段行头/气温时刻同维度；有效期行时区名随制「UTC/北京时」；`renderCard` 观测时刻行同接、龄期仍按 UTC 观测算）；RAW 原文与电码悬停保持 UTC（与报文原码对齐）；leaflet 弹窗刷新改读层的可变 card 覆盖（`setTafLayerTime` 带 card 即合并——切时区不清层、已开弹窗原地换内容、滑杆换时刻不回退）、滑杆标签/两端标注随制单显并新增 `initialAt` 重建保位选项、`TafExpandAt` 类型随包再导出；examples 模式条新增 UTC/北京时切换按钮（缺省 UTC）——卡片/滑杆/站点面板「下一变化」/状态条时钟全页联动，实况层换区按需重建、预报层原地切换。
- **底部时间轴批（owner 9/24 指令：时间轴移出顶部操作栏、独立于提示栏上方；现在起 24h、10 分钟一格、默认锚「现在」）**：`createTafTimeControl` 修复 `to` 选项有文档无接线的静默忽略（违不静默纪律的存量暗病）、新增 `tickEveryMinutes` 轴内刻度（自窗内首个对齐整点起等距、展示时区的 00 时标 dd日、终点右锚恒标注、标签随时区单制换算）；examples 顶部模式条回归一行纯按钮（滑杆移出），提示栏上方新增独立时间轴通栏——左端「现在」锚，零点＝当前时刻向下取整 10 分钟刻度、跨度 24 小时（144 格）、3 小时整点刻度，拖动全图按该时刻重渲各站级别；状态条/错误面板/图例/弹窗避让边随底部通栏抬高。
- **时间轴窄条化（owner 9/24 二轮：只要一条窄轴＋刻度可点＋播放）**：examples 时间轴改为 demo 级窄条（一条 ~35px 通栏：播放键 + 现在 + 带刻度滑道 + 右端当前时刻），不再使用库控件盒——播放键自动按 10 分钟步进扫过 24 小时（~3 格/秒、到尾循环、手动拖/点即停播），刻度线叠滑道（整点小刻度/3h 主刻度/展示时区日界高刻度，点击落点由原生滑杆接手跳格），时区切换只重画刻度与标签、格位不动。
- **发作窗升档与图例常驻右侧（owner 9/24 实测批）**：修复「TEMPO 发作窗内圆点不升档」——档位与 tooltip 摘要原只算主导段，雷雨等短时发作窗（如 ZGGG TEMPO TSRA+CB）期间图上永远看不到红点；现发作窗内按「主导段＋TEMPO 叠加」合成态定档（合并式与提示语同一份，单一来源），窗前窗后回主导档，aria-label 档位词随升；examples 圆点四档图例改两模式常驻（METAR 此前无图例）并挪至右侧（左侧陆地上不显眼，右侧海面衬托色点），与错误面板右侧竖向堆叠。
- **在效报补位（owner 9/24 方案B：现在永远有在效报，消除首屏整片灰「未生效」）**：上游 `api/data/taf` 不支持 hours（实测 400），改用 `date` 参数（语义＝该时刻已发布的最新报）并行拉 `date=now-4h` 的上一发布周期，与最新周期合并成按站报池；examples 按查看时刻选在效报文（生效起点 ≤ T 的最新一份、最新为 NIL/CNL 时权威无预报、全未生效时诚实降级灰态），报文经原位换 `item.report` 与图层共享数据面——跨生效边界（如 06Z）拖动即自动换报；leaflet 弹窗刷新闭包改现读 `item.report`（原捕获建层报文会停在旧报，契约锁：原位换报后圆点与已开弹窗即时跟随新报），`TafReport` 类型随包再导出。
- **时区词表意化（owner 9/24：单字「京」小白易误解）**：北京时制的时间前缀全链由「京」改「北京时」（卡片发布/查看/有效期/分段行头/气温、滑杆标签与刻度、面板下一变化、状态条时钟——render 两卡经 localTag 单点、leaflet/examples 各自字面量），UTC 制不受影响；受影响断言全量同步。
- **分段映射交互（owner 9/24：读人话时整段电码浮层抢先弹出，对应词反而不可见）**：整段的电码 title 从段体移到**行头**（悬停时间窗/类型徽章才出整段电码串——专业通道保留、读屏读人话正文不变）；行体条目改**就地电码**——联动条目携带 `data-code`（其值来源的原文片段），悬停/聚焦时行尾经 CSS `::after` 显出等宽小码片（如「云 无显著云」悬停显 `NSC`），对应关系行内即可见、不再依赖常在滚动视区外的卡底 RAW 高亮；data-code 与样式契约入回归锁（突变必红）。
- **联动压暗修订（owner 9/24 二轮：压暗后报头反而全场最亮）**：原文区压暗由逐片 `opacity` 改**整盒颜色压淡**——旧法只压 span 片，报头等未包片文本不吃效果、压暗后独亮喧宾夺主；改 `color` 继承后报头与未点亮电码统一淡灰、被引用电码深字黄底为唯一焦点（计算样式实证），分段列表侧注记行补入压暗；压暗契约入回归锁（退回 opacity 即红）。

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
