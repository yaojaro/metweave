# 更新日志

本项目的显著变更记录于此。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本语义遵循 [SemVer](https://semver.org/lang/zh-CN/)——v0.x 期间 minor 即可能引入破坏性变更，六个包锁步同版本发布。

## [未发布]

矢量三件套（流线／粒子动画／箭头场）与 10m 风色卡改版。六包锁步发布，**含一处视觉行为变更（色斑配色整体更换，见「更改」——调用代码无需改）**。

### 新增

- **矢量三件套：风场「去向」的三种表达**。
  - `@metweave/grid` 新增 `streamlinesOf(u, v, options)`——流线族内核：格点撒种、双向 RK2（中点法）积分，终止四条件（出界／缺测／静风／步数上限）；种子间隔与风向杆抽稀同式中心对齐，密度是使用方的可读性选择。
  - `@metweave/grid` 新增 `arrowFieldOf(u, v, options)`——等长箭头阵：与 `windBarbsOf` 同 step 同格位、来向口径逐点一致（可直接对拍），只表方向不表大小。
  - `@metweave/leaflet` 新增三个 canvas 图层：`addStreamlineLayer`（流线折线层，全层共享单渲染器）、`addParticleLayer`（示踪粒子动画：按当地风平流、渐隐尾迹、时间加速倍率可调；页面不可见自动暂停、地图拖动中清屏松手续跑）、`addArrowFieldLayer`（等长箭头静态层，指向可选「来向／去向」）。三者均为单画布口径（数百条线一张画布而非逐线 DOM 节点），挂独立 pane（z 355/358/356——压色斑、让等值线与风羽）。
  - 粒子层支持 `scale` 选项：传入色标即按当地风速定档着色（与色斑同一份档案色标，单一来源）。
- **新示例页「风怎么流动」（`windfield.html`）**：真实中国域 10m 风场整页可视——色斑／风羽／流线／箭头场／粒子五层独立开关，粒子速度可调，点击任意点查询当地风速／分量／来向，m/s ⇄ kt 单位切换（图例刻度、读数、风羽杆形三处联动；色斑档位不随口径切），帧率随行显示。
- **验收台（`verify.html`）扩两个可判定面板**：流线（V1，涡旋合成场＋种子间隔切换）与箭头场（V2，与风羽同格同向逐点对拍）——判定全部用库自身返回物。
- `@metweave/grid` 新增 `windDirectionOf(u, v)` 与 `windAt(u, v, lat, lon)`——单点风的读数数学（气象来向 0–360°）与任意经纬度点查询原语（u/v 双场双线性采样→分量/风速/来向；场外或缺测返回 `null`）。风向公式此前在杆位、箭头阵与示例页点查询各写一份，现单源；`windAt` 与粒子平流同一只采样手（含全球网格经度环绕）。
- `@metweave/render` 新增 `renderColorScaleLegend(scale, options)`——分级色标图例组件：`categorical` 分格形态（每格一档硬色、界值即标签，阈值档不等距不失真；可选物理下界首缘与外延「+」末缘注记）与 `linear` 渐变形态（停靠色连续渐变、刻度按值域线性定位、近值右让防重叠）；断点与停靠色按 `ColorScale` 结构收（数字与颜色的真源在档案色标，render 不依赖 grid）。
- `@metweave/leaflet` 粒子层新增 `respawnInViewport` 选项：开启后粒子重生落点限制在当前视口 ∩ 场域（缺省仍在全域随机重生）——大域小视口场景的粒子密度不再被场外重生稀释。
- `@metweave/core` 新增 `isConditionTier(value)`——档名字符串的类型守卫（`assertConditionTier` 的谓词版）：DOM/JSON 回读值收窄到 `ConditionTier` 用一份实现（此前示例页各抄一份四值判断）。
- `@metweave/metweave` 取数新增 `onSkipped` 回调（`getMetarReports`／`getTafReports`）：无坐标可回落（`no-position`）与站表未命中（`station-table-miss`）两类**非失败规则**的略过行逐条出声（站名/原文/机读 reason）——跳过不再是只能靠「少了谁」反推的静默行为；与 `onUnparseable`（解析失败）分工互补。

### 更改

- **10m 风色斑换用全域渐进色卡＋业务阈值档**（视觉行为变更）：七档灰蓝→钴蓝→青→青绿→黄绿→红棕→品红，断点 3/5/10/15/20/30 m/s，30 m/s 以上品红档兜底台风极端；替原 YlOrBr 等距 8 档。所有画风斑的地方（`addGridLayer` 与色卡图例）随档案自动换新，**调用代码无需改**；档界仍为固定阈值、不随数据分布浮动（跨时次可比口径不变）。

### 修复

- **示例页交互竞态三处收口（examples）**：格点面板的等值线开关就地重建此前无换代令牌——开关翻转与在途渲染交错会出现「开关已关、旧等值线层仍挂图」的错序终态，现 `buildOverlay` 逐段核对换代、过期半成品自摘，口径切换的杆层重建同补僵尸层摘除；「风怎么流动」页五层开关快速连点此前终态可能与复选框相反，现序列化排队＋过期请求不落地；「拉最新」dev 中间件的 HEAD 请求此前会照常触发拉取，现恒为探测应答零副作用。
- 示例页重复件收口（examples）：状态行（三份）与守卫取件（四份）合并为 `shared.ts` 单源；TAF 报池解析失败的行在状态行点名站码（此前只有条数）；低空页快照兜底只装载一次（此前同一 JSON 动态导入两遍）。
- **`interpolateBilinear` 支持全球网格经度环绕**：首尾相接的全球场（nx·di ≥ 360，如 GFS 0..359.75 的 0° 经线缝）此前查跨缝经度（如 lon=−0.1）恒 NaN，现在先归一到 [lo0, lo0+360) 再读值，环绕半格在末列与首列(+360)之间配对插值（粒子层与点查询读数的地基）；区域网格行为不变。另：`cropGrid` 跨 180° 经窗改显式报「暂不支持跨缝」，不再误报「与网格无交集」。
- **`contoursOf` 性能与护栏**：值场直喂 d3-contour（免 1M 点约 8MB 的全场装箱拷贝）；阈值数量上限 500（超限显式报错——d3 逐阈值全场扫描，误配极小 interval 此前会分钟级挂死且无拦截）；`renderToImageData`/`contoursOf`/`centersOf` 对场值长度与网格不符显式报错（此前越界读值静默出空图）。`computeStats` 把 ±Infinity 与 NaN 同通道滤除（Inf 混入不再以分位断点的间接报错形态炸出）。
- **GRIB2 解码的几何边界显式化（五项守卫＋一处符号修正）**：网格定义模板非 3.0、扫描模式非基线惯例（列西→东、行北→南）、basicAngle 非缺省、预报时效单位非小时、数据段（Sec3/4/5/7）重复——此前一律按基线偏移静默读解（整场翻转、经纬定标全错或后者静默覆盖前者），现显式抛 `unsupported-*` 机读错误（与既有 DRT/位图守卫同纪律）；层值（如地下深度层）改按有符号读，负层值不再静默变成 ~4.29e9。
- **TAF 卡京时制的跨月日号判读补全**：月锚在位时，跨月窗的**次月头日号**（9 月锚报 `3000/0106` 的止日 01）此前被读成锚月同号（10 月 1 日错显成 9 月 1 日）；止时 24 的「次日」折算改用连续日号经真月历进位（7 月锚报 `1600/3124` 的止刻 8 月 1 日 08:00 此前错显成 7 月 1 日）。同批：卡片时长改用 parser 的 `tafDurationHours`（删掉硬编码 31 天回绕的第二份实现）。
- 新增 `mountRawToggle()`（原文区收起/展开交互件）：`renderCard`/`renderTafCard` 原文区的配套交互随组件供给——挂一次 click 委托（幂等）即可，宿主不再各写一份 document 级委托。
- **流线层渲染器随层回收**：`addStreamlineLayer` 的共享 canvas 渲染器此前不随 `removeLayer` 回收——按推荐用法「remove+add 换密度」反复切换会在 pane 里累积空画布渲染器（每个约一整幅地图大小）。现渲染器首位放进返回的图层组、随组一并回收（与等值线层同款契约；**组的 `getLayers()` 首层是渲染器本体**，遍历折线时请跳过）。另：粒子层未知选项的报错文案补齐 `scale`。
- **TAF 分段视图的挂载行天气三态修正**：`tafSegments` 的 TEMPO/PROB 行此前把「组内未列天气」折成空数组（语义＝显式清空）而非省略键（＝继承主导段），发作行会把基况降水清空、风险档位被低估；组内未编 CAVOK 也恒置 `false` 而非省略。现分段视图与 `expandTaf` 同用一份挂载构造，三态契约（未列＝继承／NSW＝清空／列了＝整列替换）两视图一致。
- **TAF `//` 缺测组与真实天气组并存的合并序修正**：`//` 此前会静默压掉其后真实天气组（`TAF … // -RA SCT020` 里 -RA 丢失）；现与 METAR 侧同源收口为**值优先、缺测兜底**（`resolveObservedWeather`，两通道一份真相）。纯 `//` 无实组时缺测语义不变。
- **collect 公报一裹多报不再无声**：`parseIwxxm` 遇 collect 包裹含多份报文时仍只解析首份（既定口径），但补一条 info 告警点名公报内报文总数与其余被略过。
- RMK 细节两枚：`WSHFT`／`PK WND` 只吞「像数据」的后随组（`RMK WSHFT SLP992` 不再把海平面气压组并进风移组、SLP 认组不再静默丢失；磨损短时间组 `WSHFT 18` 照收）；IWXXM 序列化不可辨时段词的兜底路径不再产出重复的 phenomenonTime 兄弟元素（此前为「空元素对＋自闭合」两枚，违 XSD 单现约束）。
- 新增 `tafHeadWalk`（TAF 电头剥词的单一事实来源）：`@metweave/parser` 内部与 `@metweave/metweave` 取数侧的 TAF 报池预分流共用同一判式（此前预分流侧是复制件，电头规则一变即漂移）。
- 主 demo（examples 格点面板）：勾选含风向杆的要素（如 10m 风）时补挂**风羽图例**（`renderWindLegend`，刻度与编码同源 `WIND_LEGEND_UNITS`）并带 **m/s ⇄ kt 切换入口**——切换按当前口径整层重建杆层（图例刻度、杆形、读数三处同步）。色斑档位为档案固定域、不随口径切。
- **`renderToImageData` 档色取样契约明确（渲染行为变更）**：色标「停靠色数＝档数」时逐档精确取停靠原色（档 i ↔ 停靠 i，不再按档中心在色带上取样——该形态下档中心会采到相邻停靠的混合点，与图例分格、粒子定档着色两处不一致；10m 风七档七色即此形态）；停靠多于档的渐变色标维持档中心取样。同批健壮与性能：停靠色在热循环外预编译（大格点渲染耗时显著下降）、`di≠dj` 网格的输出纵横比改按地理跨度比（此前按格点数比会失真）、场值长度与网格不符时显式报错（此前越界读值会静默渲染成全透明）。

## [0.3.3] - 2026-10-24

修复风羽几何的一个半球错误并收紧划距；`code/` 收第二篇教程的配套脚本。六包同版本发布，**含一处几何行为变更（见「升级前必读」）**。

### 升级前必读

- **风羽杆形变了**：羽从杆左侧翻到右侧（北半球业务惯例——羽指向低压），划与划的排列间距 5→4 像素。所有画风羽的地方（`addWindBarbLayer`／`addWindBarbGlyphs`／自绘 `windBarbPath`）升级后杆形自动更新，**调用代码无需改**；只有当你把 `windBarbPath` 的输出坐标钉进了自己的快照或断言时，才需要同步镜像重钉。

### 修复

- **风羽羽侧半球反了（几何行为变更）**：`windBarbPath` 的羽此前画在杆左侧（顺来向看的左手边）＝南半球侧；北半球业务惯例是羽在**右手边**、指向低压——北半球低压在风的行进方向左侧，羽因此指向低压（matplotlib `barbs` 缺省行为、NWS 官方示例图同口径，南半球才翻侧）。本修正把三角旗／长划／短划全部翻到杆的 x＞16 侧，冻结测试表同步镜像重钉。（发现自《风不是一个数》系列第 2 篇的领域审读。）
- **划距收紧 5→4 像素**：编码 38（1 旗 4 长 1 短，约 38 m/s 的台风档）短划梢此前超出 32×32 图元盒 2 像素被裁，收紧后入盒；盒不扩——旋转安全边界与恒定像素占地契约不变。编码 50 以内（10m 风场现实全部档位）逐一核过入盒；≥52（16 级以上理论档，10m 格点场不存在）留档不处理。
- 档案注释：`windProfile` 杆口径的「2.5° 一根＝地面分析图惯例密度」为无依据的行业背书（地面天气图按测站填绘、不按格距抽稀），改「自选的默认抽稀档」。

### 新增

- `code/` 收录《风不是一个数》系列两篇教程的配套取数脚本：`fetch.mjs`（Open-Meteo 16 层廓线与 850 hPa 风场）、`rose.mjs`（IEM 年度观测算风玫瑰）、`barbs-batch.mjs`（系列第 2 篇：IEM 多站批量出杆位序列，静风／VRB／缺测三态拦截）。独立可跑，读者照文章取数节可直接下载复跑。

## [0.3.2] - 2026-10-23

补全风羽这一层：一根杆怎么读、两套口径怎么切、卡片里怎么给数、缩放下画多密。六包同版本发布，公共 API 只增不改删。

### 升级前必读

1. **`windProfile.renderForm` 变成 `"filled+barbs+contours"`。** 按整串相等判断装配图层的代码会静默少画风羽，改成按 `+` 分段判断（`renderForm.split("+").includes("barbs")`）。TypeScript 用户：联合类型多一个成员，穷尽 `switch` 会编译报错。
2. **`windBarbOf` 的静风阈缺省从 0 变成 1 m/s。** `windBarbOf(0, 0)` 现在返回 `null`（静风不出杆）；要旧行为显式传 `calmThreshold: 0`。

### 新增

- **风羽编码原语** `windBarbOf(direction, speed, { unit })`：方向＋风速 → 一面旗／一根长划／一根短划的编码，支持 m/s（中国地面图）与 kt（国际航空）两套口径。
- **风羽与箭头几何**：`windBarbPath` 支持 kt 口径（默认 m/s 输出与 0.3.1 逐字节相同）；新增 `windArrowPath`（纯方向箭头，可选指向来向或去向）。
- **单站上图** `addWindBarbGlyphs`：把算好的杆位序列直接贴到地图上，不必伪造格点场。
- **风数值牌** `renderWindChip`：有风 / 静风 / 缺测三态，单位跟随报文。
- **风羽图例** `renderWindLegend`：两套刻度可切，刻度数字由调用方传入。
- **口径与换算单源**：`WIND_BARB_SCALES`、`WIND_LEGEND_UNITS`、`MPS_PER_KT`、`toKnots` / `toMps` 都在 `@metweave/grid`；`WindSpeedUnit` 接受 `"mps"`，报文里的单位可直接传。
- **杆密度 LOD**：`windBarbsOf` 可按缩放抽稀（放大更密）；风羽层只画视口内，超量自动降密。
- **风等值线**：10m 风可叠等值线（8 m/s 间隔，缺省不叠）。

### 修改

- `ElementProfile.renderForm` 枚举扩为四态；`ContourSpec` 新增 `defaultOn`；`BarbSpec` 新增 `lod`。
- `windArrowPath` 缺省长度 20 → 11：32×32 图标盒斜向容不下 20，箭尖会被裁掉。
- `windProfile.contours` 新增 `centers` / `defaultOn` 两个字段：对档案做深度比较的测试会红。
- 示例新增两页：`wind.html`（一根杆怎么读）、`verify.html`（本批七项自检）。

## [0.3.1] - 2026-10-19

IWXXM 转换规则补全 + 一批解析健壮性修复。六包锁步 patch，公共 API 只增不改删。

### 新增

- `serializeIwxxm` 新增可选 `onWarning` 回调：单向有损转换处（RMK 附加段丢弃、CLR 收敛 NCD、美制单位折算等）逐条回调 `lossy-conversion` 告警；缺省不回调，行为不变。
- 官方 METAR NIL 样本入库，NIL 报文解析首次有官方双通道实证。

### 修复

- **跨月/跨年时刻投影**：31 日发报且电码日指向次月时，趋势组、变化组、FM 时刻、TAF 气温达时刻此前会静默落错月，个别形态甚至落到下下月——全部修正，与 `expandTaf` 展开层口径一致。
- **TAF 数值域校验**：变化组时间窗与 TX/TN 气温组此前不校验数值范围，越界值会静默进入结果并被序列化放大成错误时刻——现越界一律拒收；生成侧另加越界闸门兜底。
- **六位 `FMddhhmm`（WMO FM 51 标准形态，北美主供）**：此前会被静默吞掉并污染相邻组——现明确拒收并逐 token 告警，四位 FM 不受影响（完整支持计划在 0.4）。
- METAR NIL 报文的尾部残余 token 此前静默消失，现在逐个告警。
- TAF 负时间窗（止时早于起时）此前无提示且会被放大成超长窗，现在解析与生成两侧都告警。
- IWXXM 非法日期（如 2 月 30 日）此前被静默滚动到相邻月，现在直接报错。
- CAVOK 与能见度/天气并存的矛盾输入，XML 侧的告警级别与 TAC 侧对齐。
- **性能**：RVR 大量重复组的解析由平方复杂度改为线性（10 万组约 2.6s → 0.04s）。
- 其他小修：RVR 值域校验、`onWarning` 参数错误改为规范报错等。

## [0.3.0] - 2026-10-08

**三大主线：IWXXM 双向转换（解析 + 生成）、格点渲染新包 `@metweave/grid`、显示档位判据单源化 + `tierOf` 自定义通道。** 六包锁步发布：`@metweave/core` / `parser` / `grid` / `render` / `leaflet` / `metweave`。

### 升级前必读

- **【破坏性】`TafTempoOverlay.conditions.weather` 由恒 `[]` 改为三态**：`undefined` = 变化组未列天气（继承主导段）、`[]` = 显式 NSW、所列 = 整列替换。此前两种语义都坍缩为 `[]`，基况雷雨报遇「TEMPO 只改云」的发作窗天气会被误清空。下游若按 `[]` 判断「未列天气」，需改按 `undefined` 分流。
- **默认面板判据变化（显示行为，非 API 破坏）**：只报风切变（WS）、漏斗云/龙卷（FC/+FC）、沙暴/尘暴（SS/DS）而无雷暴的报文，圆点由绿变**红**；只报飑（SQ）的报文由绿变**琥珀**。这是判据修正的预期效果——要维持旧口径，用新增的 `tierOf` 注入自定判据。判据语义变化今后一律走 minor 版本并附迁移说明，不在 patch 位漂移。
- v0.x 期间 minor 版本可能包含破坏性变更（遵循 semver 前期惯例），升级前请过目本节。

### 新增

- **IWXXM 解析——与 TAC 同一份 IR**：`parseIwxxm` / `tryParseIwxxm`（`@metweave/parser` 主入口与 `./iwxxm` 子路径）直接解析 IWXXM XML：METAR/SPECI 与 TAF 双根（含 collect 包裹），产出与 TAC 解析完全相同的 `MetarReport` / `TafReport`（以 `kind` 判别），CNL / NIL 完整支持。版本面覆盖 IWXXM 3.0 / 2023-1 / 2025-2。
- **IWXXM 生成——`serializeIwxxm`**：IR 写回 IWXXM XML：METAR/SPECI 与 TAF 双侧，CNL / NIL 均可往返；2023-1（缺省）与 2025-2 双出口。经官方等价对语料 + XSD 全量验证，有损转换面（单位折算、电码收敛等）逐条记档于包文档。
- **新包 `@metweave/grid`——格点线**：自研 GRIB2 解码器（complex packing 5.2/5.3）+ 13 要素档案（温度/露点/湿度/CAPE/降水率/能见度/反射率/PRMSL/500hPa 高度/地面气压/850hPa 温度/总云量/风）+ 等值线与风羽数据面，运行时外部依赖仅 d3-contour（ISC）。`./convert` 子路径独立供 GRIB2 解码能力。
- **判据单源 + `tierOf` 注入**：四档条件判据（圆点色 / 读屏档位词 / 卡片行色）收口到 `@metweave/core` 单源（`metarTierOf` / `conditionTierOf` 及要素级色调函数）——deck.gl 等不用 Leaflet 的场景拿 core 即得，判据更新不再两包同改。`addMetarLayer` / `renderCard` 新增可选参数 `tierOf:(report) => ConditionTier`，一处注入三层生效；注入函数抛错或返回非法档位即整体失败，绝不静默回退。
- **Leaflet 格点三件套**：`addGridLayer`（色斑）/ `addContourLayer`（等值线 + L/H 中心标注）/ `addWindBarbLayer`（风羽），档案驱动的色标与线型，加要素零改适配层。

### 修复

- IWXXM：电码引用非法编码不再以 `URIError` 逃逸错误面契约；TAF 的 NIL/CNL 派生失败机读化（新错误码 `taf-not-expandable`）；`timePosition` 缺时区标记时按 UTC 折算并出告警（此前随宿主时区漂移）。
- 格点：GRIB2 负经纬度按 WMO 符号-幅值规范解码（此前按补码，负坐标网格静默错位）；损坏文件的死循环 / 误导性报错清理；尾部残渣容忍并告警。
- 渲染：等值线 SVG 容器随图层组回收（不再累积泄漏）；TAF 层英文文案补全（`locale: "en"`）；无障碍补强（悬停解释可被读屏识别为按钮）；宿主传入单位串的属性转义。
- 取数：IEM 响应坐标类型不符报 `bad-schema`；`getTafReports` 站表未命中的行不再拖垮整批。

### 工程

- CI 补全量语料回放；六包 LICENSE 实体化；新增 `pnpm bump` 六包锁步版本脚本。全仓测试 956 例。

## [0.2.1] - 2026-09-26

### 修复

- **fuzz 套件 TAF strict 不变量随 0.2.0 新契约更新**

## [0.2.0] - 2026-09-23

TAF（FM 51）预报侧工具链全量落地：解析 → 时间线展开 → 渲染上图，与 METAR 观测侧同入口、同「不静默」纪律。编码面按 WMO 306 FM 51 结构/时间/要素三层 21 条清单逐条施工，每条带真实报文实证回归锁。

### 新增

- **`parseTaf` / `tryParseTaf`**（`@metweave/parser`）：TAF 报文解析为 IR——电头（TAF/AMD/COR 任意相对序）、有效期组（止时 24 午夜特例）、NIL/CNL 缺报与取消、基况四要素 + CAVOK、变化组（FM/BECMG/TEMPO/PROB，含中方四位短窗）、气温组 TX/TN；中国方言形态 tolerant 收下并出声。
- **`expandTaf` 时间线展开器**（`@metweave/parser`）：任意时刻的预报状态——切段→挂载→绑段→合成→叠加五步算法，FM 硬分页、BECMG 接棒、TEMPO 发作/间歇双态、跨月回绕月锚。
- **`tafSegments`**（`@metweave/parser`）：按时间升序的分段明细（主导段/过渡带/挂载行），供渲染层逐段展示。
- **`validateTaf` 判据校验 + strict 模式**：条文判据（VRB 两源阈值、阵风 ≥5 m/s、天气白名单双层、云三层选取）；`parseTaf({ mode: "strict" })` 违例聚合抛 `strict-violation`（`validateStandard` 可切中国口径）。
- **IR 类型族**（`@metweave/core`）：TafReport / TafChangeGroup 族 / TafTemperatureGroup；错误码新增 `missing-validity` / `invalid-validity` / `strict-violation`；`ParseError` 报文中性别名。
- **TAF 渲染**（`@metweave/render`）：`renderTafCard`——分段明细、气温极值、关键风险摘要、RAW 对照与组级双向联动、电码浮签与解码气泡（附 FM 51 依据行）；`summarizeTafConditions` 人话摘要。
- **TAF 上图**（`@metweave/leaflet`）：`addTafLayer`（预报当观测渲，TEMPO 发作窗按叠加态定档）+ `setTafLayerTime`（原地换查看时刻）+ `createTafTimeControl`（时间滑杆）；`calendarAnchor`/`TIER_COLORS`/`tafTierOf` 判据与配色随包导出。
- **取数双线**（`metweave/sources`）：TAF 取数收编——`getTafs` / `getTafReports`（契约沿 METAR 线）；ogimet 补充线（`getTafsOgimet`，报池缺站补最新/次新）；两线与 IEM 各留 `baseUrl` 覆盖位——内网镜像/自建网关只换根。
- **两卡联动同契约**：METAR 卡与 TAF 卡统一交互语言——悬停点亮 + 电码浮签、点击解码气泡、Enter/Space/Esc 键盘通道与读屏接线。
- **`metweave/stations-cn` 子路径**（伞包）：中国 39 站静态元数据（ICAO / 名称 / WGS-84 精确坐标 / 标高米，`pnpm gen:stations` 可再生）。
- **质量基建**：`corpus/taf` 语料回归仓（ogimet 16 年分层抽样 312 条全解析成功）；fuzz 套件 TAF 池接线；`replay:full` 全量回放对拍器。

### 变更

- 依赖方向契约改约：core←parser←render←leaflet——render / leaflet 现可合法依赖 parser（TAF 分段明细需在渲染层消费展开器）；leaflet 打包声明同步修正。

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
[0.1.2]: https://github.com/yaojaro/metweave/releases/tag/v0.1.2
[0.2.0]: https://github.com/yaojaro/metweave/releases/tag/v0.2.0
[0.2.1]: https://github.com/yaojaro/metweave/releases/tag/v0.2.1
[0.3.0]: https://github.com/yaojaro/metweave/releases/tag/v0.3.0
[0.3.1]: https://github.com/yaojaro/metweave/releases/tag/v0.3.1
[0.3.3]: https://github.com/yaojaro/metweave/releases/tag/v0.3.3
[0.3.2]: https://github.com/yaojaro/metweave/releases/tag/v0.3.2
[未发布]: https://github.com/yaojaro/metweave/compare/v0.3.2...HEAD
