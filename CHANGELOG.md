# 更新日志

本项目的显著变更记录于此。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本语义遵循 [SemVer](https://semver.org/lang/zh-CN/)——v0.x 期间 minor 即可能引入破坏性变更，六个包锁步同版本发布。

## [0.3.1] - 2026-10-19

**IWXXM 转换规则补全**：转换语义难点 12 条存活项「测试位+文档位」双落位、生成面有损告警通道、官方 NIL 样本补扫入库、一处跨年回绕真 bug 修复。六包锁步 patch，公共 API 只增不改删（唯一例外：移除全仓无消费方的公共导出 `TEMP_DEW_PATTERN`——见「工程」节，v0.x 口径如实记档）。同日追加红队对抗审查实弹修复轮（四 P0 / 四 P1 / 顺手包四项，全部为「拒收/告警」向收口，既有合法输入行为零变化——见「修复」与「安全与发布卫生」节，逐项记档于 docs/iwxxm-notes.md §十二）。

### 新增

- **生成面有损告警通道**：`serializeIwxxm` 新增可选 `onWarning` 回调——单向有损面逐处回调 `lossy-conversion`(info) 告警（`@metweave/core` `WarningCode` 新增该枚举成员）：RMK 附加段不落、CLR 收敛 NCD、RVR V 形以 min 落位、逐道 SNOCLO 以全机场形态落位、美制单位固定系数折算、趋势 DDHH//DDHH 窗起不保真、趋势指示组丢失按 BECOMING、VV 高度缺测、TAF 气温单端/多组超承载面、TAF 基况段组省略（TAF.TAF-8 偏差）等。缺省不回调，回调与否不影响产物文本。
- **IWXXM 解析与生成规则面补测试**：CAVOK 反向等价双向判定（「vis≥10km+无天气+无低云」数值形态不构成 CAVOK——9999≠CAVOK 双锁）；天气压缩词拆解逐电码断言（SHRASN/-SHRASN/VCTS/VCSH/+TSRA，4678 URI 尾段复用 TAC 切解器 + 拆解结果重组原 token）；阈值开闭区间往返（9999→10000m+ABOVE、0000→50m+BELOW、P2000/M0050 RVR 算子——绝不把 ≥10km 生成成精确 10000m）；NIL 三来源选词对齐（整报 NIL/RVRNO/`//` 各回各位，权威对齐表入 `iwxxm.ts` 注释）；VRB/静风/变风扇区双向往返。
- **官方 METAR NIL 样本入库**（`corpus/iwxxm/extras/metar-NIL-collect.{tac,xml}`，wmo-im/iwxxm 官方仓 2025-2 形态）：解析 → nil:true 零告警、TAC 官方原文同报对齐、2025-2 出口往返保真——METAR 侧 NIL 首份官方双通道实证（2023-1 等价对官方仍未发布，豁免记档）。

### 修复

- **IWXXM 趋势时窗跨年回绕（真 bug）**：趋势 AT/TL/FM 时刻的日位锚定旧实现 `(day%31)+1` 在 31 日发报、次日电码为 01 时误落同月 1 日（差 30 天）——改按 `Date.UTC` 绝对时刻比较回绕，月末/年末自然正确；TAF 有效期止点同步改 `isoAfterOf` 跨月投影（ddHH 无月位，止点早于起点即次月）。跨年除夕用例（12/31 2350 观测 + TL0010 → 次年 1/1 00:10）与止时 24 午夜特例（3121/3124 → 次年 1/1 00:00）断言锁入。
- **IWXXM 跨月回绕同族残留三分支（独立审查复审收口）**：TAF 变化组 DDHH/DDHH 窗、TAF 变化组 FM 硬时刻、METAR 趋势 DDHH/DDHH 窗起点原均为当年当月直投影——31 日发报、电码日指向次月时静默落错月（3121/0121 有效期内 BECMG 0103/0109 跑出 12 月 1 日；FM0106 落出早于发报的时刻）。统一收口：带日位电码以锚（有效期起点/发报时刻）投影、早于锚即次月，无日位 HHMM 按次日；31 日发报跨月（趋势窗/变化组窗/FM）与同月中段不误回绕用例锁入。
- **IWXXM 生成面收尾四项（两轮审查遗留全清，0.3.1 内收口）**：
  - **TAF 温组达时刻跨月（同族第四处）**：TX26/0520Z 形的 DD 位原为当年当月直投影——有效期跨月且达时刻日码指向次月时静默落错月；改按同族判式（`momentOnOrAfter`，锚＝TAF 有效期起点，早于锚即次月/借位进位）。跨月边界与同月中段不误回绕断言锁入。
  - **有损告警清单逐行收口**：CAVOK=true 与能见度/RVR/天气/云并存的矛盾 IR 让位（三组不落 XML）、趋势/预报体最低能见度不落两形态原静默——各补一条 `lossy-conversion`(info) 告警（复用既有机读码，零新增），文件头「逐行回调」措辞至此成立。
  - **CAVOK 让位前提感知**：cavok=true 时能见度/RVR 两组实际不落 XML，美制单位告警却误称「已折算落位」——统计加让位前提跳过（QNH 不参与让位照常出声），矛盾 IR 手拼断言锁入。
  - **ECCC 扇区形 `variableWindDirection` 反推**：带变化扇区（TAC 080V140 族）的官方译文置 `true` 且保留均值方向（LTCN 判据），此前生成侧直投影 IR `variable` 位致往返后属性位 true→false 单向漂移——生成侧按扇区值在场反推 `true`（解析侧行为零改动，既有 LTCN 明锁测试原样通过），官方对往返保真断言锁入。
- **红队对抗审查实弹修复轮（2026-10-19，owner 裁决「修」，逐项记档于 docs/iwxxm-notes.md §十二）**：
  - **P0-1 TAF 变化组窗无数值域门**：`TEMPO 9999/9999` 的窗 {99,99,99,99} 此前静默留 IR 零告警、经序列化放大成跨月荒谬时刻——补数值域门与同文件有效期组同构（越界 throw invalid-validity，止时 24 午夜特例放行，PROB 组同路径同门）。
  - **P0-2 TAF TX/TN 温组无数值域门 + emit 越界最后闸门**：`TXM99/9907Z TNM99/9999Z` 的 celsius=-99、day=99 此前静默留 IR 并放大成 2027-01 荒谬绝对时刻——解析侧补门（温度 −90–60 与 METAR/IWXXM 两侧同判据、日 01–31 / 时 00–23，越界整组不收 + value-out-of-range）；emit 侧新增 dayHourInGate 最后闸门（day 1–31 / hour 0–24）罩住 validPeriod / 变化组窗 / FM 硬时刻 / 气温达时刻 / 发报时刻——越界不投影、lossy 出声、跳过该绝对时刻，手拼矛盾 IR 一并兜住。
  - **P0-3 六位 FMddhhmm 整组蒸发**：WMO FM 51 标准形态（`FM060300`，北美主供）此前与其后要素静默并入前序变化组/以 last-wins 覆盖基况段（SKC 与 OVC015 并存实弹）——本期口径＝明确拒收＋全程出声：六位 FM 设为组界，本体注明「WMO FM 51 六位 FM 形态本库未支持」，其后要素逐 token 出声、不入任何变化组、不覆盖基况段；四位 FM 照常认组。完整认组（at 增日/时/分）列 0.4 候选。
  - **P0-4 短窗借日位 emit 双重回绕（第五处回绕）**：`3112/0106 + TEMPO 0102`（8/31 发报）被「同日次月」判式抬 9/31→溢出落 10/1（下下月），与 expandTaf 跨层矛盾——emit 侧新增 tafMomentOf（expandTaf 同判式：日位 < 有效期起日才落次月），短窗借日语义直投影；TX/TN 达时刻同判式（TX12/3106Z@8/31 不再溢出 10 月）。
  - **P1-5 METAR NIL 尾部静默蒸发**：`… NIL 3000 BR OVC008 RMK AO2` 尾部整段消失——对齐 TAF 侧 collectTailAsUnknown 先例，NIL 后 token 逐个 unknown-token 出声（纯 NIL 保持零告警）。
  - **P1-6 变化组负窗零告警且 emit 放大**：`TEMPO 1914/1912` 此前零告警、end 被抬次月成 31 天窗——解析侧补 cross-check-conflict(warning)（IR 如实保留）；emit 侧 end<begin 出声且不放大（变化组 phenomenonTime 落 nil 空载形，validPeriod 同判式整体不落，跨月窗不误伤）。
  - **P1-7 IWXXM 非法日期静默滚动**：`timePosition=2026-02-30T10:00:00Z` 此前归一落 3/2 零告警（与 TAC 侧 991000Z throw invalid-time 不同构）——timePosition 单一出口补往返自检（字面分量重算墙钟回比，带时差跨日合法形态不误伤），漂移即 throw invalid-time；2/30、13 月、平年 2/29 全拦，闰年 2/29 照常收。
  - **P1-8 XML 侧 CAVOK 矛盾 severity 对齐**：趋势/变化组位 cloudAndVisibilityOK=true 与能见度/天气/云并存此前只落 unknown-token(info) 或零告警——trendElementsOf 补 cross-check-conflict(warning)（与 TAC 观测侧同判据），IR 如实并存零改动。
  - **P2/P3 顺手包**：RVR 多组累积 O(n²) → 增量构建（行为等价，span 外包络钉子原样通过）；`serializeIwxxm` 的 `onWarning` 非函数由裸 TypeError 收进 MetarParseError(invalid-input) 参数契约；RVR 值域门（R07/9999 判缺测不收 + value-out-of-range，上限米 5000/英尺 6000 兼顾既有合法形态）与 V 形双前缀 `R07/P1500VM2000` max 端 M 前缀出声（此前静默蒸发）；METAR 趋势 `AT9999`/`9999/9999` 由 emit 越界闸门统一兜住（不投影 + lossy 出声）。

### 安全与发布卫生

- **dev 链 source-map-js 1.2.1 → 1.2.2**（安全红队 P1）：postcss 精确钉版、`pnpm update` 不可达——经 pnpm-workspace.yaml `overrides` 覆盖至 `>=1.2.2`，锁文件随 0.3.1 更新。
- **六包新增 prepublishOnly 守卫**（`scripts/check-publish-manifest.mjs`，防误用 npm publish 发出坏包）：①发布通道闸——非 pnpm 通道一律非零退出（npm publish 不施加 publishConfig 覆盖、不改写 workspace: 协议）；②发布面 main 闸——publishConfig 覆盖后的 main 必须以 `./dist` 开头；③发布面依赖闸——publishConfig.dependencies 不得残留 workspace: 前缀。
- **README「许可」节与「数据源与风险披露」补 WMO（wmo-im 官方仓等价对样例）与 ECCC（Open Government Licence – Canada 署名要求）两个数据源披露，中英同步**；SECURITY.md 支持版本表 0.1.x → 0.3.x（中英两处）。

### 工程

- 全仓测试 1038 例（基线 956 → +82：规则补全 +44、复审收口跨月回绕 +4、收尾四项 +7、红队对抗修复回归 +27。勘误：本条初版记「基线 919 → 1000（+81）」不实——919 系 0.3.0 施工中途计数，v0.3.0 tag、f6845e1、8e80ea0、0e57da3 四锚点静态 it() 实测均为 956）；IWXXM 施工底档新增 §十一（十二条存活项对账总表、有损声明表、天气压缩词拆解表、趋势时窗算子表、官方样本补扫记录、站点元数据裁决）；遗留项 2（2.1 旧架构族）/4（跑道深度位 99）/8（2025-2 未覆盖面）三选一裁决写回（条件触发/豁免+样本出现即补）。
- **移除未使用公共导出 `TEMP_DEW_PATTERN`**（`@metweave/parser` 主入口，v0.x 口径）：温露组形态正则的实体仍在内部模块（`groups.ts`）照常使用，全仓唯一外部消费方是其自身回归测试——退出公共导出面、测试改内部模块直引，运行时行为零变化。

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
