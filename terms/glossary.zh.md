# metweave 术语清单（中文）

> 本文件由 `pnpm gen:terms` 从 `terms/terms.zh.json` 机械再生，请勿手改；
> 术语的唯一人工编辑入口是 `terms/terms.zh.json`。除标记 `zhOnly` / `enOnly` 的条目外，
> 中文册与英文册的 key 一一对应，元数据须一致。

## 规范登记表

- **WMO306** — WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI
- **WMO4678** — WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1)
- **ICAOANNEX3** — ICAO Annex 3 — Meteorological Service for International Air Navigation (21st ed., Amd 82)
- **FMH1** — 美国《地面观测手册》FMH-1（Surface Weather Observations and Reports，FCM-H1-1995 第 5 版，NOAA/NWS）——美制形态与 RMK 国家附加组
- **AP117** — 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航）
- **CCAR117** — 中国民用航空气象工作规则 CCAR-117R1
- **MAVIS** — UK Met Office MAVIS — How to decode a METAR（权威机构转述）
- **PRODUCT** — 产品显示文案（无标准对应条款，措辞经维护者终审）

## card.label（11 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| card.label.wind | 风 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.5（风向风速组 dddff）；CCAR117 · 中国民用航空气象工作规则 CCAR-117R1 · 第四十七条（地面风观测） |
| card.label.visibility | 能见度 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.6（VVVV 主导能见度组）；CCAR117 · 中国民用航空气象工作规则 CCAR-117R1 · 第二章观测项目（主导能见度） |
| card.label.weather | 天气 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.8（现在天气 w'w' 组）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 第八十八条（现在天气组） |
| card.label.clouds | 云 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.9（云组 NsNsNshshshs）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 第五编 云和垂直能见度 |
| card.label.temperature | 气温 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.11（气温组 T'T'）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 第一百四十一条（气温观测） |
| card.label.dewpoint | 露点 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.11（露点温度 T'dT'd）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 第一百四十二条（湿度观测，含露点温度） |
| card.label.altimeter | 修正海压 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.12（QNH 组）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 第一百五十一条（气压观测：修正海平面气压）；CCAR117 · 中国民用航空气象工作规则 CCAR-117R1 · 第七十三条（气压 QNH） |
| card.label.rvr | 跑道视程 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.7（RVR 组 RDRDR/VRVRVRVRi）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 第七十条（跑道视程定义） |
| card.label.trend | 趋势 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.14（Trend forecast）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录六（趋势预报 TREND） |
| card.label.runwayState | 跑道状态 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.13.6（State of the runway） |
| card.label.windShear | 风切变 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.13.3（Wind shear in the lower layers）；CCAR117 · 中国民用航空气象工作规则 CCAR-117R1 · 第九章第四节（风切变警报） |

## card.badge（5 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| card.badge.speci | 特殊天气报告 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.1 模板注 (1)（aerodrome special meteorological report）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录六 说明 1（机场特殊天气报告） |
| card.badge.metar | 例行报告 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.1 模板注 (1)（aerodrome routine meteorological report）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录六 说明 1（机场例行天气报告） |
| card.badge.corrected | 更正报 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.1 模板注 (2)（COR for corrected reports）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录六（METAR COR 更正报） |
| card.badge.auto | 自动观测 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.4（Code word AUTO）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录六（自动或缺省报告标志） |
| card.badge.cavokShort | 能见度佳、低云与天气无碍 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## card.missingGroup（4 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| card.missingGroup.wind | 风组缺测 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| card.missingGroup.visibility | 能见度组缺测 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| card.missingGroup.weather | 天气组缺测 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| card.missingGroup.rvr | 跑道视程缺测（RVRNO） | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## card.cavokHint（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| card.cavokHint | CAVOK：能见度 ≥10km、5000ft 以下无云无天气，且任意高度无积雨云/浓积云（≠晴空） | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.10（Code word CAVOK）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 第一百四十条（CAVOK 编报条件） |

## card.windShearNote（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| card.windShearNote | 低空风切变——起降阶段重大危害（WS，WMO 306 FM15 §15.13.3） | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.13.3（起飞/进近航径、跑道面至 500 m/1600 ft） |

## card.wind（13 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| card.wind.gust | 阵风 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.5.5（Gust）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 第三十九条（阵风） |
| card.wind.variable | 风向不定 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.5.2（VRB 条件）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 第三十九条（风向不定） |
| card.wind.missing | 风向缺测 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| card.wind.calm | 静风 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.5.4（Calm 编报 00000）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 第三十九条（静风） |
| card.wind.vrbNote | VRB = 风向不定（全向） | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.5.2（VRB 条件）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 第三十九条（风向不定） |
| card.wind.calmNote | 静风 = 风速为零 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.5.4（Calm 编报 00000） |
| card.wind.variationNote | 风向变化范围 = 风向在两个边界值之间变动（10 分钟观测时段内、顺时针方向编报） | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.5.3（two extreme directions, clockwise order）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 第三十九条、第四十五条（风向变化范围、顺时针记录） |
| card.wind.hintSep | ； | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| card.wind.unit.kt | kt = 节（海里/小时） | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.5（风速单位 KT） |
| card.wind.unit.mps | mps = 米/秒 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.5（风速单位 MPS）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十一（风速单位米/秒） |
| card.wind.unit.kmh | kmh = 千米/小时 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案 · FM15 风速仅 KT/MPS；KMH 为容错解析口径（WMO 电码族 FM50 等使用） |
| card.wind.gustOf | (value) => `（阵风 ${value}）` | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| card.wind.variationOf | (min, max) => `（风向在 ${deg3(min)}° 与 ${deg3(max)}° 间变动）` | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## card.cloud（26 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| card.cloud.amount.FEW | 少云：约 1–2 个量（1/8–2/8） | official | packages/render/src/card.ts#LOCALE | ICAOANNEX3 · ICAO Annex 3 — Meteorological Service for International Air Navigation (21st ed., Amd 82) · 附录 3 METAR/SPECI 模板（FEW = 1–2 oktas 缩写体系）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 第一百三十一条（少云 1/8-2/8） |
| card.cloud.amount.SCT | 疏云：约 3–4 个量（3/8–4/8） | official | packages/render/src/card.ts#LOCALE | ICAOANNEX3 · ICAO Annex 3 — Meteorological Service for International Air Navigation (21st ed., Amd 82) · 附录 3 METAR/SPECI 模板（SCT = 3–4 oktas）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 第一百三十一条（疏云 3/8-4/8） |
| card.cloud.amount.BKN | 多云：约 5–7 个量（5/8–7/8） | official | packages/render/src/card.ts#LOCALE | ICAOANNEX3 · ICAO Annex 3 — Meteorological Service for International Air Navigation (21st ed., Amd 82) · 附录 3 METAR/SPECI 模板（BKN = 5–7 oktas）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 第一百三十一条（多云 5/8-7/8） |
| card.cloud.amount.OVC | 阴：8 个量（8/8，天空全遮蔽） | official | packages/render/src/card.ts#LOCALE | ICAOANNEX3 · ICAO Annex 3 — Meteorological Service for International Air Navigation (21st ed., Amd 82) · 附录 3 METAR/SPECI 模板（OVC = 8 oktas）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 第一百三十一条（阴天 8/8） |
| card.cloud.shortAmount.FEW | 少云 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| card.cloud.shortAmount.SCT | 疏云 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| card.cloud.shortAmount.BKN | 多云 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| card.cloud.shortAmount.OVC | 阴 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| card.cloud.baseShortMeters | (meters) => `，云底约 ${meters} 米` | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| card.cloud.metersShort | (meters) => ` 约 ${meters} 米` | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| card.cloud.baseShortFeet | (feet) => `，云底 ${feet} 英尺` | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| card.cloud.feetShort | (feet) => ` ${feet} 英尺` | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| card.cloud.metersDerivedNote | （米为本库按 1 英尺 = 0.3048 米换算；报文只编英尺且以百英尺为台阶，故米值为约值） | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| card.cloud.amountUnknown | 云量缺测 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| card.cloud.vvMissing | 垂直能见度缺测 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| card.cloud.heightUnknown | 云底缺测 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| card.cloud.vvShort | 垂直能见度 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| card.cloud.baseFtMeters | (feet, meters) => `，云底 ${feet} 英尺 ≈ ${meters} 米` | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| card.cloud.minimumOf | (meters, direction) => `最低能见度 ${meters} 米（${direction} 方向）` | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| card.cloud.skyClear.SKC | 无云（人工观测） | official | packages/render/src/card.ts#LOCALE | ICAOANNEX3 · ICAO Annex 3 — Meteorological Service for International Air Navigation (21st ed., Amd 82) · 附录 3 METAR/SPECI 模板（NSC = no significant cloud；NCD = nil cloud detected；SKC/CLR 为北美惯例电码） |
| card.cloud.skyClear.NSC | 无显著云 | official | packages/render/src/card.ts#LOCALE | ICAOANNEX3 · ICAO Annex 3 — Meteorological Service for International Air Navigation (21st ed., Amd 82) · 附录 3 METAR/SPECI 模板（NSC = no significant cloud；NCD = nil cloud detected；SKC/CLR 为北美惯例电码） |
| card.cloud.skyClear.NCD | 无云（自动站未探测） | official | packages/render/src/card.ts#LOCALE | ICAOANNEX3 · ICAO Annex 3 — Meteorological Service for International Air Navigation (21st ed., Amd 82) · 附录 3 METAR/SPECI 模板（NSC = no significant cloud；NCD = nil cloud detected；SKC/CLR 为北美惯例电码） |
| card.cloud.skyClear.CLR | 无云（自动观测） | official | packages/render/src/card.ts#LOCALE | ICAOANNEX3 · ICAO Annex 3 — Meteorological Service for International Air Navigation (21st ed., Amd 82) · 附录 3 METAR/SPECI 模板（NSC = no significant cloud；NCD = nil cloud detected；SKC/CLR 为北美惯例电码） |
| card.cloud.cbNote | （CB 积雨云：雷暴、冰雹、强颠簸风险） | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.9.1.3（CB 缩写与编报要求）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十六（积雨云 Cb） |
| card.cloud.tcuNote | （TCU 浓积云：强颠簸与积冰风险） | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.9.1.3（TCU 缩写注）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十六（垂直发展旺盛的浓积云/塔状积云 Tcu） |
| card.cloud.vv | VV = 垂直能见度：天空全遮蔽时能见的垂直高度 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.9.2 注 1（vertical visibility）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 第一百三十九条（垂直能见度） |

## card.wx（42 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| card.wx.phenomena.DZ | 毛毛雨 | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 4678 表（现在天气现象简语）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十五 4678 电码表（降水/视程障碍/其它栏 简语表） |
| card.wx.phenomena.RA | 雨 | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 4678 表（现在天气现象简语）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十五 4678 电码表（降水/视程障碍/其它栏 简语表） |
| card.wx.phenomena.SN | 雪 | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 4678 表（现在天气现象简语）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十五 4678 电码表（降水/视程障碍/其它栏 简语表） |
| card.wx.phenomena.SG | 米雪 | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 4678 表（现在天气现象简语）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十五 4678 电码表（降水/视程障碍/其它栏 简语表） |
| card.wx.phenomena.IC | 冰晶 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案 · 无 WMO TAC 4678/AP-117 表项（美制惯例，NWS decode key、FAA JO 7340.2：ice crystals） |
| card.wx.phenomena.PL | 冰粒 | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 4678 表（现在天气现象简语）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十五 4678 电码表（降水/视程障碍/其它栏 简语表） |
| card.wx.phenomena.GR | 冰雹 | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 4678 表（现在天气现象简语）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十五 4678 电码表（降水/视程障碍/其它栏 简语表） |
| card.wx.phenomena.GS | 小雹和/或霰 | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 4678 表（现在天气现象简语）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十五 4678 电码表（降水/视程障碍/其它栏 简语表） |
| card.wx.phenomena.UP | 未知降水 | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 4678 表（现在天气现象简语）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十五 4678 电码表（降水/视程障碍/其它栏 简语表） |
| card.wx.phenomena.BR | 轻雾 | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 4678 表（现在天气现象简语）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十五 4678 电码表（降水/视程障碍/其它栏 简语表） |
| card.wx.phenomena.FG | 雾 | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 4678 表（现在天气现象简语）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十五 4678 电码表（降水/视程障碍/其它栏 简语表） |
| card.wx.phenomena.FU | 烟 | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 4678 表（现在天气现象简语）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十五 4678 电码表（降水/视程障碍/其它栏 简语表） |
| card.wx.phenomena.VA | 火山灰 | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 4678 表（现在天气现象简语）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十五 4678 电码表（降水/视程障碍/其它栏 简语表） |
| card.wx.phenomena.DU | 浮尘 | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 4678 表（现在天气现象简语）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十五 4678 电码表（降水/视程障碍/其它栏 简语表） |
| card.wx.phenomena.SA | 沙 | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 4678 表（现在天气现象简语）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十五 4678 电码表（降水/视程障碍/其它栏 简语表） |
| card.wx.phenomena.HZ | 霾 | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 4678 表（现在天气现象简语）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十五 4678 电码表（降水/视程障碍/其它栏 简语表） |
| card.wx.phenomena.PY | 浪花 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案 · 无 WMO TAC 4678/AP-117 表项（美制 FMH-1 用），浪花=spray 通用译名 |
| card.wx.phenomena.PO | 尘/沙旋风（尘卷风） | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 4678 表（现在天气现象简语）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十五 4678 电码表（降水/视程障碍/其它栏 简语表） |
| card.wx.phenomena.SQ | 飑 | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 4678 表（现在天气现象简语）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十五 4678 电码表（降水/视程障碍/其它栏 简语表） |
| card.wx.phenomena.FC | 漏斗云 | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 4678 表（现在天气现象简语）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十五 4678 电码表（降水/视程障碍/其它栏 简语表） |
| card.wx.phenomena.SS | 沙暴 | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 4678 表（现在天气现象简语）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十五 4678 电码表（降水/视程障碍/其它栏 简语表） |
| card.wx.phenomena.DS | 尘暴 | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 4678 表（现在天气现象简语）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十五 4678 电码表（降水/视程障碍/其它栏 简语表） |
| card.wx.descriptors.MI | 浅 | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 4678 表（描述词）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十五 4678 电码表（描述词栏：浅的/部分的/散片状的/低吹的/高吹的/阵性的/雷暴/冻的） |
| card.wx.descriptors.PR | 部分 | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 4678 表（描述词）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十五 4678 电码表（描述词栏：浅的/部分的/散片状的/低吹的/高吹的/阵性的/雷暴/冻的） |
| card.wx.descriptors.BC | 散片 | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 4678 表（描述词）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十五 4678 电码表（描述词栏：浅的/部分的/散片状的/低吹的/高吹的/阵性的/雷暴/冻的） |
| card.wx.descriptors.DR | 低吹 | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 4678 表（描述词）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十五 4678 电码表（描述词栏：浅的/部分的/散片状的/低吹的/高吹的/阵性的/雷暴/冻的） |
| card.wx.descriptors.BL | 高吹 | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 4678 表（描述词）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十五 4678 电码表（描述词栏：浅的/部分的/散片状的/低吹的/高吹的/阵性的/雷暴/冻的） |
| card.wx.descriptors.SH | 阵性 | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 4678 表（描述词）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十五 4678 电码表（描述词栏：浅的/部分的/散片状的/低吹的/高吹的/阵性的/雷暴/冻的） |
| card.wx.descriptors.TS | 雷暴 | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 4678 表（描述词）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十五 4678 电码表（描述词栏：浅的/部分的/散片状的/低吹的/高吹的/阵性的/雷暴/冻的） |
| card.wx.descriptors.FZ | 冻 | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 4678 表（描述词）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十五 4678 电码表（描述词栏：浅的/部分的/散片状的/低吹的/高吹的/阵性的/雷暴/冻的） |
| card.wx.heavy | 强 | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 4678 表（+ 强度指示码）；WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.8.1（intensity indicators per Code table 4678）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十五 4678 电码表（强度栏：+ 强，大） |
| card.wx.light | 轻 | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 4678 表（- 轻微强度指示码）；WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.8.1（intensity indicators per Code table 4678）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十五 4678 电码表（强度栏：- 轻微，小） |
| card.wx.heavyPlain | 大 | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 4678 表（+ 强度指示码）；WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.8.1（intensity indicators per Code table 4678）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十五 4678 电码表（强度栏：+ 强，大） |
| card.wx.lightPlain | 小 | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 4678 表（- 轻微强度指示码）；WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.8.1（intensity indicators per Code table 4678）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十五 4678 电码表（强度栏：- 轻微，小） |
| card.wx.proximityPrefix | 机场附近有 | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 4678 表（VC 邻近限定词）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十五（VC 在附近；第九十七条 8–16 km） |
| card.wx.proximitySuffix | null | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 4678 表（VC 邻近限定词）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十五（VC 在附近；第九十七条 8–16 km） |
| card.wx.thunderstorm | 雷暴 | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 4678 表（TS）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十五（TS 雷暴及组合规则） |
| card.wx.thunderstormWith | (phenom) => `雷暴伴${phenom}` | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 4678 表（TS 与降水组合）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十五 注 10（TS 与 RA/SN/GS/GR/UP 组合） |
| card.wx.descCompose | (descriptor, phenom) =>
      descriptor === "阵性"
        ? phenom === ""
          ? "阵性降水（类型不可辨）"
          : `阵${phenom}`
        : phenom === ""
          ? descriptor
          : `${descriptor}${phenom}` | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| card.wx.join | 、 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| card.wx.joinParts |  | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| card.wx.hazard | （飞行威胁大） | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## card.timeText（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| card.timeText | (t) =>
      `${String(t.day).padStart(2, "0")}日 ${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")} UTC` | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## card.ago（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| card.ago | (minutes) =>
      minutes < 60
        ? `（${minutes} 分钟前）`
        : minutes < 48 * 60
          ? `（${Math.floor(minutes / 60)} 小时前）`
          : `（${Math.floor(minutes / 1440)} 天前）` | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## card.rvrNote（3 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| card.rvrNote.varying | V = 观测时段内在两极值间波动 | official | packages/render/src/card.ts#LOCALE | ICAOANNEX3 · ICAO Annex 3 — Meteorological Service for International Air Navigation (21st ed., Amd 82) · 附录 3 METAR/SPECI 模板（RvvvVvvv 变化形态）；WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.7.4（十分钟观测时段语境）；MAVIS · UK Met Office MAVIS — How to decode a METAR（权威机构转述） · METAR decode — RVR V 组释义（varying between two values） |
| card.rvrNote.trend | U/D/N = 上升/下降/无变化 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.7.4.3（tendency U/D/N）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 第七十四条（三）（U/D/N 趋势码） |
| card.rvrNote.beyond | P/M 前缀 = 超出上限/低于下限 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.7.5（Extreme values: P/M indicators）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 第七十四条（一）（P2000 / M50） |

## card.rvr（9 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| card.rvr.runway | (runway) => `跑道 ${runway}` | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.7.1（跑道辨识器 RDRDR） |
| card.rvr.above | 高于  | official | packages/render/src/card.ts#LOCALE | FMH1 · 美国《地面观测手册》FMH-1（Surface Weather Observations and Reports，FCM-H1-1995 第 5 版，NOAA/NWS）——美制形态与 RMK 国家附加组 · ch.12（P 前缀＝高于最大可报值） |
| card.rvr.below | 低于  | official | packages/render/src/card.ts#LOCALE | FMH1 · 美国《地面观测手册》FMH-1（Surface Weather Observations and Reports，FCM-H1-1995 第 5 版，NOAA/NWS）——美制形态与 RMK 国家附加组 · ch.12（M 前缀＝低于最小可报值） |
| card.rvr.varying | (min, max, unit) => `在 ${min} 与 ${max} ${unit}间变动` | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.7.4（V 波动形态） |
| card.rvr.unit.m | 米 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.7.1–§15.7.3（RVR 以米编报） |
| card.rvr.unit.ft | 英尺 | official | packages/render/src/card.ts#LOCALE | FMH1 · 美国《地面观测手册》FMH-1（Surface Weather Observations and Reports，FCM-H1-1995 第 5 版，NOAA/NWS）——美制形态与 RMK 国家附加组 · ch.12（FT 后缀＝英尺） |
| card.rvr.trendUp | ，趋势上升 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.7.4.3（U＝趋势上升） |
| card.rvr.trendDown | ，趋势下降 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.7.4.3（D＝趋势下降） |
| card.rvr.trendNoChange | ，趋势无变化 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.7.4.3（N＝趋势无变化） |

## card.ws（2 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| card.ws.all | 全部跑道受影响 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.13.3（WS ALL RWY 全跑道形态） |
| card.ws.runways | (runways) => `跑道 ${runways} 受影响` | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.13.3（WS RDRDR 指定跑道形态） |

## card.decode（17 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| card.decode.title | 转换说明（原码 → 含义） | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| card.decode.code | 原码 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| card.decode.basisLabel | 依据： | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| card.decode.cite.cavok | WMO 306 卷 I.1（2019 年版）FM 15 §15.10——CAVOK 代替能见度/天气/云组：能见度 ≥10 km、无低云与 CB/TCU、无重要天气 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.10（CAVOK 代替能见度/天气/云三族） |
| card.decode.cite.wind | WMO 306 卷 I.1（2019 年版）FM 15 §15.5.1–15.5.6——dddff＝观测前 10 分钟平均风向与平均风速，单位后缀紧跟组后（§15.5.1）；VRB＝风向不定、00000＝静风、G＝阵风、P＝超上限（同节各条） | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.5.1–§15.5.6（dddff 风向风速组） |
| card.decode.cite.windVariation | WMO 306 卷 I.1（2019 年版）FM 15 §15.5.3——dndndnVdxdxdx＝10 分钟内风向变化 ≥60° 且 <180° 时的两个边界方位（顺时针） | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.5.3（风向变化组 dndndnVdxdxdx） |
| card.decode.cite.visibility | WMO 306 卷 I.1（2019 年版）FM 15 §15.6.1、§15.6.3——VVVV＝主导能见度 4 位米制；9999＝10 km 或以上（上限编码） | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.6.1、§15.6.3（VVVV 主导能见度；9999 上限编码） |
| card.decode.cite.visMinimum | WMO 306 卷 I.1（2019 年版）FM 15 §15.6.2——VNVNVNVNDv＝最低能见度及其八方位方向（与主导能见度差异显著时编报） | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.6.2（最低能见度方向组） |
| card.decode.cite.rvr | WMO 306 卷 I.1（2019 年版）FM 15 §15.7.1–15.7.5——跑道视程组：4 位米制值（至多 4 条跑道）、P/M 超界、V 波动、U/D/N 趋势；FT 后缀＝英尺（美制 FMH-1） | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.7.1–§15.7.5（RVR 组）；FMH1 · 美国《地面观测手册》FMH-1（Surface Weather Observations and Reports，FCM-H1-1995 第 5 版，NOAA/NWS）——美制形态与 RMK 国家附加组 · ch.12（RVR 编报：FT 后缀与 P/M 阈值） |
| card.decode.cite.weather | WMO 306 卷 I.1（2019 年版）FM 15 §15.8 及电码表 4678——现在天气至多三组，语序＝强度/邻近 → 描述符 → 现象；UP＝自动站无法辨识的降水（§15.8.6） | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.8（现在天气 w'w'）；WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · 现在天气现象简语表 |
| card.decode.cite.clouds | WMO 306 卷 I.1（2019 年版）FM 15 §15.9.1——云量 FEW/SCT/BKN/OVC（八分量）＋云底高（百英尺编报，台阶 30 m/100 ft）；CB/TCU 对流云附标（§15.9.1.7） | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.9.1、§15.9.1.7（云组；CB/TCU 附标） |
| card.decode.cite.skyClear | WMO 306 卷 I.1（2019 年版）FM 15 §15.9.1.1——NSC/NCD 无云电码（自动站未探测到云用 NCD）；CLR 为美制电码（美国 FMH-1，FCM-H1-1995） | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.9.1.1（NSC/NCD 无云电码）；FMH1 · 美国《地面观测手册》FMH-1（Surface Weather Observations and Reports，FCM-H1-1995 第 5 版，NOAA/NWS）——美制形态与 RMK 国家附加组 · ch.12（CLR 美制电码，FCM-H1-1995） |
| card.decode.cite.tempDew | WMO 306 卷 I.1（2019 年版）FM 15 §15.11——T'T'/T'dT'd＝整摄氏度气温/露点，负值加 M（M00＝−0.5℃）；美制同形见 FMH-1 §12.6.10 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.11（T'T'/T'dT'd 气温露点组）；FMH1 · 美国《地面观测手册》FMH-1（Surface Weather Observations and Reports，FCM-H1-1995 第 5 版，NOAA/NWS）——美制形态与 RMK 国家附加组 · §12.6.10（美制同形） |
| card.decode.cite.qnh | WMO 306 卷 I.1（2019 年版）FM 15 §15.12——Qxxxx＝QNH 整百帕（不足 1000 前补 0）；Axxxx＝美制高度表设定（隐含两位小数，inHg；FMH-1） | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.12（Qxxxx QNH 组）；FMH1 · 美国《地面观测手册》FMH-1（Surface Weather Observations and Reports，FCM-H1-1995 第 5 版，NOAA/NWS）——美制形态与 RMK 国家附加组 · ch.12（Axxxx 高度表设定） |
| card.decode.cite.runwayState | WMO 306 卷 I.1（2019 年版）FM 15 §15.13.6——跑道状态四段电码按电码表 0919/0519/1079/0366 解码；R/SNOCLO＝关闭，CLRD＝污染清除 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.13.6（跑道状态；电码表 0919/0519/1079/0366） |
| card.decode.cite.windShear | WMO 306 卷 I.1（2019 年版）FM 15 §15.13.3——WS RDRDR / WS ALL RWY＝起飞/进近路径低空风切变 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.13.3（低空风切变 WS） |
| card.decode.cite.trend | WMO 306 卷 I.1（2019 年版）FM 15 §15.14——BECMG＝渐变、TEMPO＝短时波动、NOSIG＝无显著变化（§15.14.15）；时段词 FM/TL/AT（§15.14.3） | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.14（趋势段；NOSIG §15.14.15、时段词 §15.14.3） |

## card.trendNote（8 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| card.trendNote.nosig | 无重要变化 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.14.15（NOSIG = no significant change） |
| card.trendNote.becmg | 渐变（逐步转变） | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.14.4（BECMG）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录六（渐变 BECMG） |
| card.trendNote.tempo | 短时波动（临时性变化） | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.14.5（TEMPO temporary fluctuations）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录六（短时 TEMPO） |
| card.trendNote.unspecified | 变化趋势段（指示组缺失，渐变/短时不可辨） | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| card.trendNote.periodAt | (text) => {
        const slash = /^(\d{2})(\d{2})\/(\d{2})(\d{2})$/.exec(text);
        if (slash !== null) {
          return `自 ${slash[1]} 日 ${slash[2]}:00 至 ${slash[3]} 日 ${slash[4]}:00`;
        }
        const m = /^(AT\|TL\|FM)(\d{2})(\d{2})$/.exec(text);
        if (m === null) return `预计时刻 ${text}`;
        const hm = `${m[2]}:${m[3]}`;
        return m[1] === "TL" ? `持续至 ${hm}` : m[1] === "FM" ? `自 ${hm} 起` : `预计时刻 ${hm}`;
      } | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.14.3（FM from / TL until / AT at）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录六（变化时段：从/至/在，FMnnnn 和/或 TLnnnn 或 ATnnnn） |
| card.trendNote.contentLead | 趋向： | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| card.trendNote.nsw | NSW = 趋势时段内无重要天气 | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · NSW = No significant weather（表 4678 注：仅用于趋势报）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录六（无重要天气 NSW） |
| card.trendNote.windShear | 趋势内含风切变（WS）——起降注意 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## card.warningText（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| card.warningText | (_code, message) => message | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## card.sep（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| card.sep | 　 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## card.rwy（32 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| card.rwy.closed | 跑道关闭 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · 电码表 1079（99 Runway non-operational due to snow, slush, ice, large drifts or runway clearance, but depth not reported） |
| card.rwy.closedAll | 全机场跑道关闭 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.13.6（R/SNOCLO：aerodrome closed due to extreme deposit of snow） |
| card.rwy.cleared | 已清除 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.13.6（CLRD//：contaminations ceased to exist） |
| card.rwy.deposit.0 | 清洁且干燥 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · 电码表 0919（0 Clear and dry） |
| card.rwy.deposit.1 | 潮湿 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · 电码表 0919（1 Damp） |
| card.rwy.deposit.2 | 湿或积水 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · 电码表 0919（2 Wet and water patches） |
| card.rwy.deposit.3 | 雾凇或霜覆盖 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · 电码表 0919（3 Rime and frost covered） |
| card.rwy.deposit.4 | 干雪 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · 电码表 0919（4 Dry snow） |
| card.rwy.deposit.5 | 湿雪 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · 电码表 0919（5 Wet snow） |
| card.rwy.deposit.6 | 雪浆 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · 电码表 0919（6 Slush） |
| card.rwy.deposit.7 | 冰 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · 电码表 0919（7 Ice） |
| card.rwy.deposit.8 | 压实或滚压雪 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · 电码表 0919（8 Compacted or rolled snow） |
| card.rwy.deposit.9 | 冻结轮辙或脊 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · 电码表 0919（9 Frozen ruts or ridges） |
| card.rwy.coverage.1 | <10% | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · 电码表 0519（1 <10%） |
| card.rwy.coverage.2 | 11–25% | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · 电码表 0519（2 11–25%） |
| card.rwy.coverage.5 | 26–50% | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · 电码表 0519（5 26–50%） |
| card.rwy.coverage.9 | 51–100% | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · 电码表 0519（9 51–100%） |
| card.rwy.coverageLabel | 覆盖  | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| card.rwy.depthLabel | 深度  | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| card.rwy.depthText | (mm) =>
        mm === 0 ? "<1 mm" : mm === 400 ? "40 cm 或以上" : mm >= 100 ? `${mm / 10} cm` : `${mm} mm` | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · 电码表 1079（00=less than 1 mm；01–90 毫米；92–98=10–40 cm；98=40 cm or more） |
| card.rwy.friction | (coeff) => `摩擦系数 ${coeff.toFixed(2)}` | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · 电码表 0366（00–90 friction coefficient 0.00–0.90） |
| card.rwy.brakingLabel | 制动作用  | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| card.rwy.braking.poor | 差 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · 电码表 0366（91 Braking action poor） |
| card.rwy.braking.medium-poor | 较差 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · 电码表 0366（92 Braking action medium/poor） |
| card.rwy.braking.medium | 中 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · 电码表 0366（93 Braking action medium） |
| card.rwy.braking.medium-good | 较好 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · 电码表 0366（94 Braking action medium/good） |
| card.rwy.braking.good | 好 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · 电码表 0366（95 Braking action good） |
| card.rwy.braking.unreliable | 不可靠（摩擦数值不可靠） | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · 电码表 0366（99 Unreliable） |
| card.rwy.closedNote | 跑道不可用（深度位 99＝因雪/雪浆/冰/大雪堆/清雪作业关闭，深度未报；SNOCLO＝机场因大量积雪关闭） | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · 电码表 1079 电码 99 与 §15.13.6（SNOCLO）语义分列 |
| card.rwy.clearedNote | CLRD：跑道污染已清除（后随摩擦两位或 //） | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.13.6（CLRD 后随摩擦两位数或 //） |
| card.rwy.wmoNote | WMO 306 FM15 §15.13.6 跑道状态电码（电码表 0919/0519/1079/0366；已按官方标准核对 2026-09-13，已按官方电码表核对） | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| card.rwy.itemSep | ， | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## card.colon（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| card.colon | ： | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## card.dash（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| card.dash | —— | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## card.rawTitle（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| card.rawTitle | 报文原文（专业人员核对用） | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## card.rawHint（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| card.rawHint | 悬停或 Tab 聚焦可与人话对照 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## card.rawTab（3 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| card.rawTab.iwxxm | IWXXM（XML） | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| card.rawTab.tac | TAC（字符电码） | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| card.rawTab.listLabel | 报文原文编码切换 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.tier（4 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.tier.unknown | 天气不明 | product | packages/leaflet/src/index.ts#TIER_WORDS | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| leaflet.tier.poor | 天气差 | product | packages/leaflet/src/index.ts#TIER_WORDS | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| leaflet.tier.caution | 天气注意 | product | packages/leaflet/src/index.ts#TIER_WORDS | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
| leaflet.tier.good | 天气好 | product | packages/leaflet/src/index.ts#TIER_WORDS | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg01（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg01 | 缺报（NIL） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg02（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg02 | 数据缺测 | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg03（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg03 | addMetarLayer 收到未知选项 "${key}"——卡片级选项（locale/raw/className…）需包在 card 里传，可用项见 AddMetarLayerOptions | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg04（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg04 | addMetarLayer 的 locale 选项值 "${bad}" 不受支持（可用："zh" \| "en"） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg05（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg05 | 无要素组 | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg06（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg06 | addTafLayer 收到未知选项 "${key}"（可用项见 AddTafLayerOptions） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg07（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg07 | addTafLayer 的 locale 选项值 "${bad}" 不受支持（可用："zh" \| "en"） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg08（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg08 | 缺报（NIL） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg09（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg09 | 预报取消（CNL） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg10（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg10 | 预报尚未生效（按发布时基况显示） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg11（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg11 | 预报已过期（按末段显示） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg12（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg12 | 未生效 | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg13（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg13 | 已过期 | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg14（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg14 | 预报${early ? "未生效" : "已过期"} | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg15（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg15 | ${name} · ${locale === "en" ? `Forecast ${early ? "not yet in effect" : "expired"}` : `预报${early ? "未生效" : "已过期"}`} | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg16（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg16 | 过渡带（变化时刻不确定） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg17（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg17 | 含 TEMPO 间歇变化——摘要为发作时刻状态 | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg18（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg18 | 有效期 ${v.raw} | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg19（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg19 | 预报 | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg20（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg20 | ${name} · ${locale === "en" ? "Forecast " : "预报"}${TIER_WORDS[locale][tier]} | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg21（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg21 | ${String(at.day).padStart(2, "0")}日 ${String(at.hour).padStart(2, "0")}:${String(at.minute).padStart(2, "0")}Z | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg22（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg22 | ${tag}${z.getUTCMonth() + 1}月${z.getUTCDate()}日${String(z.getUTCHours()).padStart(2, "0")}:${String(z.getUTCMinutes()).padStart(2, "0")} | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg23（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg23 | ${tag}${String(d).padStart(2, "0")}日${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg24（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg24 | 北京时 | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg25（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg25 | 预报时刻 | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg26（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg26 | 北京时${z.getUTCMonth() + 1}月${z.getUTCDate()}日 | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg27（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg27 | 北京时${String(z.getUTCHours()).padStart(2, "0")}:${String(z.getUTCMinutes()).padStart(2, "0")} | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg28（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg28 | 北京时${String(day).padStart(2, "0")}日 | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg29（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg29 | 北京时${String(z.hour).padStart(2, "0")}:${String(z.minute).padStart(2, "0")} | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg30（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg30 | ${String(at.day).padStart(2, "0")}日 | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg31（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg31 | addGridLayer 收到未知选项 "${key}"（可用项见 AddGridLayerOptions） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg32（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg32 | addGridLayer 需要 Canvas 2D 能力（当前宿主环境不可用——SSR/无头环境请改用 @metweave/grid 的 renderToImageData 自行出图） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg33（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg33 | addContourLayer 收到未知选项 "${key}"（可用项见 AddContourLayerOptions） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg34（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg34 | 要素 ${profile.shortName} 档案缺等值线口径（contours）——留位要素未接线，无法描线 | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg35（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg35 | 低压中心 | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg36（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg36 | 高压中心 | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg37（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg37 | windBarbPath 收到未知选项 "${key}"（可用项：unit）——拼错的选项不会生效 | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg38（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg38 | windArrowPath 收到未知选项 "${key}"（可用项：length、pointing）——拼错的选项不会生效 | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg39（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg39 | windArrowPath 的方向非法（${String(direction)}）——须为 0–360 的有限数（气象来向：北 0／东 90） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg40（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg40 | windArrowPath 的 length 非法（${String(length)}）——须为正有限数 | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg41（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg41 | windArrowPath 的 pointing 取值 "${String(pointing)}" 不受支持（可用："from" \| "to"） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg42（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg42 | addWindBarbGlyphs 收到未知选项 "${key}"（可用项：color、unit）——拼错的选项不会生效 | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg43（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg43 | addWindBarbLayer 收到未知选项 "${key}"（可用项：color、unit）——拼错的选项不会生效 | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg44（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg44 | 要素 ${profile.shortName} 档案缺风向杆口径（barbs）——renderForm 含 barbs 的要素须声明，无法出杆 | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg45（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg45 | addStreamlineLayer 收到未知选项 "${key}"（可用项：color、width、opacity）——拼错的选项不会生效 | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg46（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg46 | addStreamlineLayer 的 width 非法（${String(options.width)}，须 >0 的有限数〔像素〕） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg47（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg47 | addParticleLayer 收到未知选项 "${key}"（可用项：color、count、speedFactor、fade、width、calmThreshold、scale、respawnInViewport）——拼错的选项不会生效 | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg48（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg48 | addParticleLayer 的 count 非法（${String(options.count)}，须 ≥1 的整数） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg49（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg49 | addParticleLayer 的 speedFactor 非法（${String(options.speedFactor)}，须 >0 的有限数） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg50（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg50 | addParticleLayer 的 fade 非法（${String(options.fade)}，须 0–1 开区间） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg51（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg51 | addParticleLayer 的 width 非法（${String(options.width)}，须 >0 的有限数〔像素〕） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg52（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg52 | addParticleLayer 的 calmThreshold 非法（${String(options.calmThreshold)}，须 ≥0 的有限数） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg53（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg53 | 粒子层 pane 创建失败 | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg54（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg54 | 粒子层画布取不到 2d context（环境不支持 canvas） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg55（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg55 | addArrowFieldLayer 收到未知选项 "${key}"（可用项：color、length、width、pointing）——拼错的选项不会生效 | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg56（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg56 | addArrowFieldLayer 的 length 非法（${String(options.length)}，须 >0 的有限数〔像素〕） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg57（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg57 | addArrowFieldLayer 的 width 非法（${String(options.width)}，须 >0 的有限数〔像素〕） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg58（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg58 | 箭头场层 pane 创建失败 | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg59（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg59 | 箭头场层画布取不到 2d context（环境不支持 canvas） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg60（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg60 | ${speedKt} kt 风圈 | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg61（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg61 | addTyphoonWindCircleLayer 收到未知选项 "${key}"（可用项：locale、colors、fillOpacity、opacity、weight、label）——拼错的选项不会生效 | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg62（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg62 | addTyphoonWindCircleLayer 的 locale 选项值 "${bad}" 不受支持（可用："zh" \| "en"） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg63（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg63 | addTyphoonWindCircleLayer 的 fillOpacity 非法（${String(options.fillOpacity)}，须 0–1） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg64（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg64 | addTyphoonWindCircleLayer 的 opacity 非法（${String(options.opacity)}，须 0–1） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg65（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg65 | addTyphoonWindCircleLayer 的 colors 非法（须为非空的颜色字符串数组，弱→强逐级对齐） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg66（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg66 | addTyphoonWindCircleLayer 的 colors 含非法条目（${JSON.stringify(c)}，须非空颜色字符串） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg67（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg67 | addTyphoonWindCircleLayer 的 weight 非法（${String(options.weight)}，须 >0 的有限数〔像素〕） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg68（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg68 | 第 ${ci + 1} 个风圈 | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg69（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg69 | addTyphoonWindCircleLayer ${at}的中心纬度非法（${String(lat)}，须 [-90, 90] 的有限数） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg70（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg70 | addTyphoonWindCircleLayer ${at}的中心经度非法（${String(lon)}，须有限数） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg71（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg71 | addTyphoonWindCircleLayer ${at}的 ${level.speedKt} kt 级半径非法（${String(r)}，须 ≥0 的有限数或 null＝缺席） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg72（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg72 | addTyphoonWindCircleLayer ${at}的风速级非法（${String(level.speedKt)}，须 >0 的有限数〔kt〕） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg73（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg73 | addHazardPolygonLayer 收到未知选项 "${key}"（可用项：color、weight、opacity、fillOpacity、labelMode、locale）——拼错的选项不会生效 | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg74（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg74 | addHazardPolygonLayer 的 locale 选项值 "${bad}" 不受支持（可用："zh" \| "en"） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg75（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg75 | addHazardPolygonLayer 的 labelMode 选项值 "${badMode}" 不受支持（可用："persistent" \| "tooltip"） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg76（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg76 | addHazardPolygonLayer 的 ${key} 非法（${String(v)}，须 0–1） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg77（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg77 | addHazardPolygonLayer 的 weight 非法（${String(options.weight)}，须 >0 的有限数〔像素〕） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg78（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg78 | 第 ${pi + 1} 个多边形 | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg79（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg79 | addHazardPolygonLayer ${at}的边界顶点不足（${String(polygon.coords.length)} < 3）——多边形至少三点 | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg80（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg80 | addHazardPolygonLayer ${at}第 ${vi + 1} 顶点坐标非法（${String(point)}，须 [lat, lon] 有限数） | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## leaflet.msg81（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg81 | 类别：${polygon.kind} | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## sources.msg01（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| sources.msg01 | IEM 请求超时（>${options.timeoutMs ?? "?"}ms，network=${network}） | product | packages/metweave/src/sources.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## sources.msg02（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| sources.msg02 | 网络请求失败（源：IEM，network=${network}）：请检查网络连通性后重试（${reason}） | product | packages/metweave/src/sources.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## sources.msg03（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| sources.msg03 | IEM 响应不是合法 JSON（可能被代理/防火墙拦截，network=${network}）：${reason} | product | packages/metweave/src/sources.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## sources.msg04（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| sources.msg04 | IEM 响应异常：缺少 data 数组（network=${network}，schema 不符） | product | packages/metweave/src/sources.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## sources.msg05（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| sources.msg05 | IEM 响应异常：data 存在字段类型不符的记录（station/raw 须字符串、lat/lon 须数字或 null；network=${network}，schema 不符） | product | packages/metweave/src/sources.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## sources.msg06（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| sources.msg06 | IEM 返回空数据（network=${network}）——请核对 IEM 网络名（如 CN__ASOS/RU__ASOS，参考 https://mesonet.agron.iastate.edu/sites/networks.php） | product | packages/metweave/src/sources.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## sources.msg07（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| sources.msg07 | 报文解析失败 ${failures.length} 条（network=${network}）——${failures.slice(0, 3).join("；")}${failures.length > 3 ? "……" : ""} | product | packages/metweave/src/sources.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## sources.msg08（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| sources.msg08 | aviationweather TAF 请求超时（>${options.timeoutMs ?? "?"}ms） | product | packages/metweave/src/sources.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## sources.msg09（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| sources.msg09 | 网络请求失败（源：aviationweather TAF）：请检查网络连通性后重试（${reason}） | product | packages/metweave/src/sources.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## sources.msg10（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| sources.msg10 | aviationweather TAF 响应读取失败：${reason} | product | packages/metweave/src/sources.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## sources.msg11（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| sources.msg11 | aviationweather TAF 返回空数据——请核对 ids 站码（如 ZBAA,ZBAD；端点 format=raw） | product | packages/metweave/src/sources.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## sources.msg12（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| sources.msg12 | TAF 解析失败 ${failures.length} 条（aviationweather）——${failures.slice(0, 3).join("；")}${failures.length > 3 ? "……" : ""} | product | packages/metweave/src/sources.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## sources.msg13（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| sources.msg13 | ogimet TAF 请求超时（>${options.timeoutMs ?? "?"}ms，站=${station}） | product | packages/metweave/src/sources.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## sources.msg14（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| sources.msg14 | 网络请求失败（源：ogimet TAF，站=${station}）：${reason} | product | packages/metweave/src/sources.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## sources.msg15（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| sources.msg15 | ogimet TAF HTTP ${res.status}（站=${station}） | product | packages/metweave/src/sources.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## parser.msg001（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| parser.msg001 | parse 需要一个 METAR/SPECI 报文字符串，收到 ${raw === null ? "null" : typeof raw} | product | packages/parser/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## parser.msg002（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| parser.msg002 | METAR 侧 strict 模式尚未实现（TAF 侧 parseTaf 已支持 strict）——请省略 mode 或显式传 'tolerant' | product | packages/parser/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## parser.msg003（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| parser.msg003 | 输入 token 数超上限（${tokens.length} > ${TOKEN_COUNT_LIMIT}）——按异常输入标记，解析照常完整，原文经 raw 保真 | product | packages/parser/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## parser.msg004（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| parser.msg004 | 空输入 | product | packages/parser/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## parser.msg005（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| parser.msg005 | 无法识别站名组——输入不是 METAR/SPECI 报文（${stTok?.text ?? "空输入"}） | product | packages/parser/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## parser.msg006（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| parser.msg006 | 更正标记槽位漂移（${driftTok.text} 出现在站名后/时组前——已消费并置更正标志） | product | packages/parser/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## parser.msg007（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| parser.msg007 | 时组缺失 | product | packages/parser/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## parser.msg008（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| parser.msg008 | 无法识别时组——输入不是完整的 METAR/SPECI 报文（${tmTok?.text ?? "时组缺失"}） | product | packages/parser/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## parser.msg009（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| parser.msg009 | 时组数值越界（${tmTok.text}：须日 01–31 / 时 00–23 / 分 00–59）——输入不是完整的 METAR/SPECI 报文 | product | packages/parser/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## parser.msg010（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| parser.msg010 | NIL 报正文组位出现多余组（${tailTok.text}）——NIL 台站无观测，其后零期待，保留原文出声 | product | packages/parser/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## parser.msg011（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| parser.msg011 | 趋势指示组与时段词粘连（${text}——传输磨损丢空格，BECMG/TEMPO 与 AT/TL/FM 时段语义完整可恢复） | product | packages/parser/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## parser.msg012（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| parser.msg012 | 趋势时段词缺指示组（${text}——§15.14.3 时段词须随 BECMG/TEMPO 出现）——按指示组缺失的趋势段收下，指示组类型不可辨 | product | packages/parser/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## parser.msg013（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| parser.msg013 | 趋势时段词缺指示组（${text}——ICAO Annex 3 模板趋势时段须随 BECMG/TEMPO 出现）——按指示组缺失的趋势段收下，指示组类型不可辨 | product | packages/parser/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## parser.msg014（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| parser.msg014 | 前序 | product | packages/parser/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## parser.msg015（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| parser.msg015 | 风组 | product | packages/parser/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## parser.msg016（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| parser.msg016 | 风组缺测（/////KT，疑似自动站假报文形态） | product | packages/parser/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## parser.msg017（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| parser.msg017 | 风组缺测（${t.text}，风速位缺测） | product | packages/parser/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## parser.msg018（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| parser.msg018 | 天气组语序不合电码表（${text}：描述符须先于现象）——已按切解结果收下 | product | packages/parser/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## parser.msg019（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| parser.msg019 | 强度符与 VC 邻近指示并存（${text}——强度符不与 VC 同组）——已按切解结果收下 | product | packages/parser/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## parser.msg020（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| parser.msg020 | RE 近期天气组带强度符（${text}——15.13.2.1 RE 组无强度位）——已收下 | product | packages/parser/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## parser.msg021（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| parser.msg021 | 强度符超适用面（${text}——表 4678 注 4：-/+ 仅限降水族，非降水唯 +SS/+FC/+DS）——已收下 | product | packages/parser/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## parser.msg022（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| parser.msg022 | 天气组缺测（//，无法观测天气） | product | packages/parser/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## parser.msg023（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| parser.msg023 | 未识别的组（${text}）——已如实收下 | product | packages/parser/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## parser.msg024（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| parser.msg024 | 后续 | product | packages/parser/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## parser.msg025（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| parser.msg025 | VV 组与云层组并存（WMO 15.9.2：VV 顶替整个云组）——报文自洽性存疑 | product | packages/parser/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |

## parser.msg026（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| parser.msg026 | ${clearCode.code}（无云电码）与云层组并存——互斥形态，报文自洽性存疑 | product | packages/parser/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经维护者终审） · 显示自拟（无标准对应条款） |
