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
- **PRODUCT** — 产品显示文案（无标准对应条款，措辞经 owner 术语终审）

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
| card.badge.cavokShort | 能见度佳、低云与天气无碍 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |

## card.missingGroup（4 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| card.missingGroup.wind | 风组缺测 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
| card.missingGroup.visibility | 能见度组缺测 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
| card.missingGroup.weather | 天气组缺测 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
| card.missingGroup.rvr | 跑道视程缺测（RVRNO） | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |

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
| card.wind.missing | 风向缺测 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
| card.wind.calm | 静风 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.5.4（Calm 编报 00000）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 第三十九条（静风） |
| card.wind.vrbNote | VRB = 风向不定（全向） | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.5.2（VRB 条件）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 第三十九条（风向不定） |
| card.wind.calmNote | 静风 = 风速为零 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.5.4（Calm 编报 00000） |
| card.wind.variationNote | 风向变化范围 = 风向在两个边界值之间变动（10 分钟观测时段内、顺时针方向编报） | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.5.3（two extreme directions, clockwise order）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 第三十九条、第四十五条（风向变化范围、顺时针记录） |
| card.wind.hintSep | ； | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
| card.wind.unit.kt | kt = 节（海里/小时） | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.5（风速单位 KT） |
| card.wind.unit.mps | mps = 米/秒 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.5（风速单位 MPS）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录十一（风速单位米/秒） |
| card.wind.unit.kmh | kmh = 千米/小时 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案 · FM15 风速仅 KT/MPS；KMH 为容错解析口径（WMO 电码族 FM50 等使用） |
| card.wind.gustOf | (value) => `（阵风 ${value}）` | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
| card.wind.variationOf | (min, max) => `（风向在 ${deg3(min)}° 与 ${deg3(max)}° 间变动）` | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |

## card.cloud（26 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| card.cloud.amount.FEW | 少云：约 1–2 个量（1/8–2/8） | official | packages/render/src/card.ts#LOCALE | ICAOANNEX3 · ICAO Annex 3 — Meteorological Service for International Air Navigation (21st ed., Amd 82) · 附录 3 METAR/SPECI 模板（FEW = 1–2 oktas 缩写体系）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 第一百三十一条（少云 1/8-2/8） |
| card.cloud.amount.SCT | 疏云：约 3–4 个量（3/8–4/8） | official | packages/render/src/card.ts#LOCALE | ICAOANNEX3 · ICAO Annex 3 — Meteorological Service for International Air Navigation (21st ed., Amd 82) · 附录 3 METAR/SPECI 模板（SCT = 3–4 oktas）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 第一百三十一条（疏云 3/8-4/8） |
| card.cloud.amount.BKN | 多云：约 5–7 个量（5/8–7/8） | official | packages/render/src/card.ts#LOCALE | ICAOANNEX3 · ICAO Annex 3 — Meteorological Service for International Air Navigation (21st ed., Amd 82) · 附录 3 METAR/SPECI 模板（BKN = 5–7 oktas）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 第一百三十一条（多云 5/8-7/8） |
| card.cloud.amount.OVC | 阴：8 个量（8/8，天空全遮蔽） | official | packages/render/src/card.ts#LOCALE | ICAOANNEX3 · ICAO Annex 3 — Meteorological Service for International Air Navigation (21st ed., Amd 82) · 附录 3 METAR/SPECI 模板（OVC = 8 oktas）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 第一百三十一条（阴天 8/8） |
| card.cloud.shortAmount.FEW | 少云 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
| card.cloud.shortAmount.SCT | 疏云 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
| card.cloud.shortAmount.BKN | 多云 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
| card.cloud.shortAmount.OVC | 阴 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
| card.cloud.baseShortMeters | (meters) => `，云底约 ${meters} 米` | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
| card.cloud.metersShort | (meters) => ` 约 ${meters} 米` | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
| card.cloud.baseShortFeet | (feet) => `，云底 ${feet} 英尺` | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
| card.cloud.feetShort | (feet) => ` ${feet} 英尺` | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
| card.cloud.metersDerivedNote | （米为本库按 1 英尺 = 0.3048 米换算；报文只编英尺且以百英尺为台阶，故米值为约值） | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
| card.cloud.amountUnknown | 云量缺测 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
| card.cloud.vvMissing | 垂直能见度缺测 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
| card.cloud.heightUnknown | 云底缺测 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
| card.cloud.vvShort | 垂直能见度 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
| card.cloud.baseFtMeters | (feet, meters) => `，云底 ${feet} 英尺 ≈ ${meters} 米` | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
| card.cloud.minimumOf | (meters, direction) => `最低能见度 ${meters} 米（${direction} 方向）` | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
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
            : `${descriptor}${phenom}` | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
| card.wx.join | 、 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
| card.wx.joinParts |  | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
| card.wx.hazard | （飞行威胁大） | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |

## card.timeText（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| card.timeText | (t) =>
      `${String(t.day).padStart(2, "0")}日 ${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")} UTC` | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |

## card.ago（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| card.ago | (minutes) =>
      minutes < 60
        ? `（${minutes} 分钟前）`
        : minutes < 48 * 60
          ? `（${Math.floor(minutes / 60)} 小时前）`
          : `（${Math.floor(minutes / 1440)} 天前）` | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |

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
| card.decode.title | 转换说明（原码 → 含义） | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
| card.decode.code | 原码 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
| card.decode.basisLabel | 依据： | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
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
| card.trendNote.unspecified | 变化趋势段（指示组缺失，渐变/短时不可辨） | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
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
| card.trendNote.contentLead | 趋向： | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
| card.trendNote.nsw | NSW = 趋势时段内无重要天气 | official | packages/render/src/card.ts#LOCALE | WMO4678 · WMO Code table 4678 — Present and forecast weather (in WMO-No. 306 Vol I.1) · NSW = No significant weather（表 4678 注：仅用于趋势报）；AP117 · 民用航空气象地面观测规范 AP-117-TM-2021-01R2（中国民航） · 附录六（无重要天气 NSW） |
| card.trendNote.windShear | 趋势内含风切变（WS）——起降注意 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |

## card.warningText（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| card.warningText | (_code, message) => message | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |

## card.sep（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| card.sep | 　 | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |

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
| card.rwy.coverageLabel | 覆盖  | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
| card.rwy.depthLabel | 深度  | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
| card.rwy.depthText | (mm) =>
        mm === 0 ? "<1 mm" : mm === 400 ? "40 cm 或以上" : mm >= 100 ? `${mm / 10} cm` : `${mm} mm` | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · 电码表 1079（00=less than 1 mm；01–90 毫米；92–98=10–40 cm；98=40 cm or more） |
| card.rwy.friction | (coeff) => `摩擦系数 ${coeff.toFixed(2)}` | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · 电码表 0366（00–90 friction coefficient 0.00–0.90） |
| card.rwy.brakingLabel | 制动作用  | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
| card.rwy.braking.poor | 差 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · 电码表 0366（91 Braking action poor） |
| card.rwy.braking.medium-poor | 较差 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · 电码表 0366（92 Braking action medium/poor） |
| card.rwy.braking.medium | 中 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · 电码表 0366（93 Braking action medium） |
| card.rwy.braking.medium-good | 较好 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · 电码表 0366（94 Braking action medium/good） |
| card.rwy.braking.good | 好 | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · 电码表 0366（95 Braking action good） |
| card.rwy.braking.unreliable | 不可靠（摩擦数值不可靠） | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · 电码表 0366（99 Unreliable） |
| card.rwy.closedNote | 跑道不可用（深度位 99＝因雪/雪浆/冰/大雪堆/清雪作业关闭，深度未报；SNOCLO＝机场因大量积雪关闭） | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · 电码表 1079 电码 99 与 §15.13.6（SNOCLO）语义分列 |
| card.rwy.clearedNote | CLRD：跑道污染已清除（后随摩擦两位或 //） | official | packages/render/src/card.ts#LOCALE | WMO306 · WMO-No. 306 Manual on Codes, Volume I.1 (2019) — FM 15 METAR/SPECI · §15.13.6（CLRD 后随摩擦两位数或 //） |
| card.rwy.wmoNote | WMO 306 FM15 §15.13.6 跑道状态电码（电码表 0919/0519/1079/0366；已按官方标准核对 2026-09-13，待 owner 终审） | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
| card.rwy.itemSep | ， | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |

## card.colon（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| card.colon | ： | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |

## card.dash（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| card.dash | —— | product | packages/render/src/card.ts#LOCALE | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |

## leaflet.tier（4 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.tier.unknown | 天气不明 | product | packages/leaflet/src/index.ts#TIER_WORDS | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
| leaflet.tier.poor | 天气差 | product | packages/leaflet/src/index.ts#TIER_WORDS | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
| leaflet.tier.caution | 天气注意 | product | packages/leaflet/src/index.ts#TIER_WORDS | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
| leaflet.tier.good | 天气好 | product | packages/leaflet/src/index.ts#TIER_WORDS | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |

## leaflet.msg01（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg01 | :
        return "&quot;";
      default:
        return "&#39;";
    }
  });

/** 四档条件色（与卡片 mw-danger/mw-caution 同族色相：灰=不明、红=差、琥珀=注意、绿=好） */
const TIER_COLORS: Record<ConditionTier, string> = {
  unknown: "#8a94a0",
  poor: "#d05656",
  caution: "#e0a13c",
  good: "#3aa657",
};

type ConditionTier = "unknown" \| "poor" \| "caution" \| "good";

/** 档位可读名（aria-label 追加词——a11y 1.4.1：档位信息不只靠颜色传达） */
const TIER_WORDS: Record<"zh" \| "en", Record<ConditionTier, string>> = {
  zh: { unknown: "天气不明", poor: "天气差", caution: "天气注意", good: "天气好" },
  en: {
    unknown: "Weather unknown",
    poor: "Weather poor",
    caution: "Weather caution",
    good: "Weather good",
  },
};

/** 降水类现象（caution 判据用，与 WMO 4678 降水族对应——RA/SN/SG/PL/GS/IC/DZ/UP） */
const PRECIP_PHENOMENA: ReadonlySet<string> = new Set([
  "RA",
  "SN",
  "SG",
  "PL",
  "GS",
  "IC",
  "DZ",
  "UP",
]);

/** 风速折米/秒（阵风判据统一单位：kt ×0.514444、kmh ÷3.6、mps ×1） */
const toMps = (value: number, unit: "kt" \| "mps" \| "kmh"): number =>
  unit === "kt" ? value * 0.514444 : unit === "kmh" ? value / 3.6 : value;

/**
 * 四档气象条件分级（判据本库自拟、初稿待审——显示层扫视启发式）：
 * 阈值由本库拟定，**不对应也不代表任何官方飞行天气分类；本库不提供飞行规则判定**（本期无此功能）。
 * 仅供「一眼扫视哪些站值得注意」，不得作为任何运行判据：
 * - unknown（灰）= NIL（台站无观测）或关键组全缺测（能见度与云均缺测且天气缺测/无——按可得要素无从判读）
 * - poor（红）= 能见度 < 1500 m，或 BKN/OVC 云层（含垂直能见度）云底 < 1000 ft，或天气含 TS 族（任何雷暴，含 VC 邻近）
 *   或现象含 GR/VA，或冻降水（FZ 描述符族，冻雨/冻毛毛雨），或 + 强度显著降水，或阵风 ≥ 25 m/s，或云组含 CB/TCU，或跑道关闭
 * - caution（琥珀）= 能见度 1500–5000 m（能见度分档取国内通行 1500/5000 m 口径），或 BKN/OVC 云底 1000–3000 ft，或任何降水族（RA/SN 等），
 *   或 FZ 描述符以外的结冰现象，或阵风 15–25 m/s
 * - good（绿）= 其余（含 CAVOK）
 * 缺测要素不参与限制（按可得要素判，见 conditionOf 内 unknown 判据的例外）；阈值细则随口径审定后修订。
 */
/** 判据输入面（结构子集）：METAR 报与 TAF 展开结果皆可喂（渲染层①，2026-09-23）——
 *  MetarReport 结构性满足本接口；TAF 侧由展开结果投影构造（runwayStates 恒缺省） */
interface ConditionInput {
  readonly nil?: boolean;
  readonly cavok: boolean;
  readonly wind?: Observed<WindGroup>;
  readonly visibility?: Observed<VisibilityGroup>;
  readonly weather?: Observed<readonly WeatherGroup[]>;
  readonly clouds?: CloudCondition;
  readonly runwayStates?: readonly RunwayStateGroup[];
}

function conditionOf(report: ConditionInput): ConditionTier {
  if (report.nil === true) return "unknown";
  const v = {
    wind: unwrap(report.wind),
    visibility: unwrap(report.visibility),
    weather: unwrap(report.weather),
    clouds: report.clouds,
    runwayStates: report.runwayStates ?? [],
  };
  // 关键组全缺测：能见度与云均缺测（云组每个体均为全缺测形态）且天气缺测/无——判读无从下手，灰而非绿
  const visMissing = report.visibility?.kind === "missing";
  const elements = v.clouds?.elements ?? [];
  const cloudsAllMissing =
    !report.cavok &&
    elements.every(
      (e) => e.heightFt.value === null && (e.kind === "vertical-visibility" \|\| e.amount === null),
    );
  const weatherMissingOrNone =
    report.weather === undefined \|\|
    report.weather.kind === "missing" \|\|
    (report.weather.kind === "value" && report.weather.value.length === 0);
  if (visMissing && cloudsAllMissing && weatherMissingOrNone) return "unknown";

  // —— poor 判据（任一命中即红）
  const vis = v.visibility;
  if (vis !== undefined) {
    const visMeters = vis.unit === "m" ? vis.value : vis.value * 1609.344;
    if (visMeters < 1500) return "poor";
  }
  const ceilings = elements
    .filter((e): e is Extract<CloudElement, { kind: "layer" }> => e.kind === "layer")
    .filter((e) => e.amount === "BKN" \|\| e.amount === "OVC")
    .map((e) => e.heightFt.value ?? Number.POSITIVE_INFINITY);
  for (const e of elements) {
    if (e.kind === "vertical-visibility")
      ceilings.push(e.heightFt.value ?? Number.POSITIVE_INFINITY);
  }
  const ceiling = ceilings.length > 0 ? Math.min(...ceilings) : Number.POSITIVE_INFINITY;
  if (ceiling < 1000) return "poor";
  for (const g of v.weather ?? []) {
    const thunderstorm = g.descriptor === "TS"; // TS 族：任何雷暴（含 VCTS 邻近雷暴）
    const hailOrAsh = g.phenomena.includes("GR") \|\| g.phenomena.includes("VA");
    const freezing = g.descriptor === "FZ"; // 冻降水族（FZRA/FZDZ 等）——危害与雷暴同级，2026-09-22 运行视角评审升红
    const heavyPrecip =
      g.intensity === "+" &&
      (g.descriptor === "SH" \|\| g.phenomena.some((p) => PRECIP_PHENOMENA.has(p)));
    if (thunderstorm \|\| hailOrAsh \|\| freezing \|\| heavyPrecip) return "poor";
  }
  const gust = v.wind?.gust;
  if (gust !== undefined && toMps(gust.value, gust.unit) >= 25) return "poor";
  const convective = elements.some(
    (e): e is Extract<CloudElement, { kind: "layer" }> =>
      e.kind === "layer" && e.convective !== undefined,
  );
  if (convective) return "poor";
  if (v.runwayStates.some((st) => st.closed === true)) return "poor";

  // —— caution 判据（任一命中即琥珀）
  if (vis !== undefined) {
    const visMeters = vis.unit === "m" ? vis.value : vis.value * 1609.344;
    if (visMeters < 5000) return "caution";
  }
  if (ceiling < 3000) return "caution";
  for (const g of v.weather ?? []) {
    const precip = g.phenomena.some((p) => PRECIP_PHENOMENA.has(p));
    if (precip) return "caution";
  }
  if (gust !== undefined && toMps(gust.value, gust.unit) >= 15) return "caution";
  return "good";
}

/** 天气组显示码：span 在位取原码，缺席由 IR 重建（摘要行的要素原样口径） */
function weatherCode(report: MetarReport, g: WeatherGroup): string {
  return g.span === undefined
    ? `${g.proximity ? "VC" : ""}${g.intensity ?? ""}${g.descriptor ?? ""}${g.phenomena.join("")}`
    : report.raw.slice(g.span.start, g.span.end);
}

/** 云层显示码：span 在位取原码，缺席由 IR 重建（缺测位还原为 ///） */
function cloudCode(report: MetarReport, layer: CloudElement): string {
  if (layer.span === undefined) {
    if (layer.kind === "vertical-visibility") {
      return `VV${layer.heightFt.value === null ? "///" : String(Math.round(layer.heightFt.value / 100)).padStart(3, "0")}`;
    }
    const height =
      layer.heightFt.value === null
        ? "///"
        : String(Math.round(layer.heightFt.value / 100)).padStart(3, "0");
    return `${layer.amount ?? "///"}${height}${layer.convective ?? ""}`;
  }
  return report.raw.slice(layer.span.start, layer.span.end);
}

/**
 * tooltip 第二行要素摘要（扫视初筛）：`2500m +TSRA BKN030CB` 式——
 * 能见度 / 最显著天气（优先 TS/GR/+ 强度族）/ 最差云（对流云优先，否则最低 BKN/OVC，VV 兜底）。
 * NIL 站显示「缺报（NIL）」、关键组全缺测站显示「数据缺测」（与 conditionOf 的 unknown 判据同款口径）。
 */
function summarizeReport(report: MetarReport, locale: "zh" \| "en"): string {
  if (report.nil === true) return locale === "en" ? "No report (NIL)" : "缺报（NIL）";
  if (report.cavok) return "CAVOK";
  const v = toValues(report);
  // 关键组全缺测（能见度与云均缺测且天气缺测/无）：要素摘要无从拼起，显示缺测占位而非空行
  const elements = v.clouds?.elements ?? [];
  const visMissing = report.visibility?.kind === "missing";
  const cloudsAllMissing =
    !report.cavok &&
    elements.every(
      (e) => e.heightFt.value === null && (e.kind === "vertical-visibility" \|\| e.amount === null),
    );
  const weatherMissingOrNone =
    report.weather === undefined \|\|
    report.weather.kind === "missing" \|\|
    (report.weather.kind === "value" && report.weather.value.length === 0);
  if (visMissing && cloudsAllMissing && weatherMissingOrNone)
    return locale === "en" ? "Data missing" : "数据缺测";
  const parts: string[] = [];
  const vis = v.visibility;
  if (vis !== undefined) {
    parts.push(
      vis.unit === "m"
        ? vis.exact
          ? `${vis.value} m`
          : "≥10 km"
        : vis.beyond === "below"
          ? `<${vis.value} SM`
          : vis.beyond === "above"
            ? `>${vis.value} SM`
            : `${vis.value} SM`,
    );
  }
  const weather = v.weather ?? [];
  const significant =
    weather.find(
      (g) => g.descriptor === "TS" \|\| g.phenomena.includes("GR") \|\| g.intensity === "+",
    ) ?? weather[0];
  if (significant !== undefined) parts.push(weatherCode(report, significant));
  const layers = v.clouds?.elements ?? [];
  const convective = layers.find(
    (e): e is Extract<CloudElement, { kind: "layer" }> =>
      e.kind === "layer" && e.convective !== undefined,
  );
  const ceilingLayer = layers
    .filter((e): e is Extract<CloudElement, { kind: "layer" }> => e.kind === "layer")
    .filter((e) => e.amount === "BKN" \|\| e.amount === "OVC")
    .reduce<Extract<CloudElement, { kind: "layer" }> \| undefined>(
      (lowest, e) =>
        lowest === undefined \|\|
        (e.heightFt.value ?? Number.POSITIVE_INFINITY) <
          (lowest.heightFt.value ?? Number.POSITIVE_INFINITY)
          ? e
          : lowest,
      undefined,
    );
  const vertical = layers.find((e) => e.kind === "vertical-visibility");
  const worstCloud = convective ?? ceilingLayer ?? vertical;
  if (worstCloud !== undefined) parts.push(cloudCode(report, worstCloud));
  else if (v.clouds?.clear !== undefined) parts.push(v.clouds.clear.code);
  return parts.join(" ");
}

/** tooltip 内容节点：标题行 + 要素摘要行（两行皆纯文本装载；locale 决定摘要占位词语言） */
function tooltipContent(
  item: MetarLayerItem,
  withSummary: boolean,
  locale: "zh" \| "en",
): HTMLElement {
  const container = document.createElement("span");
  container.append(textCarrier(item.title ?? item.report.station));
  if (withSummary) {
    container.append(
      document.createElement("br"),
      textCarrier(summarizeReport(item.report, locale)),
    );
  }
  return container;
}

/** Escape 关闭已开弹窗的监听只挂一次/地图（多图层叠加不重复绑定） */
const escapeBoundMaps = new WeakSet<Leaflet.Map>();

/**
 * Put a set of report stations onto a Leaflet map: markers + tooltips + card popups. Returns a removable layer group.
 * 把一组报文站点挂上地图：标记 + tooltip + 卡片弹窗。返回可整体移除的图层组。
 * @param map - A Leaflet map instance. Leaflet 地图实例。
 * @param items - Stations to plot (report + position + title). 待上图的站点列表。
 * @param options - See AddMetarLayerOptions. 见 AddMetarLayerOptions。
 *
 * 异步（v0.2 起为 Promise）：leaflet 由首次调用时动态装载——本包可在任何模块图（含 Node/SSR
 * 预渲染流水线）中 import 而不触雷，代价是上图动作需 await。
 */

export async function addMetarLayer(
  map: Leaflet.Map,
  items: readonly MetarLayerItem[],
  options: AddMetarLayerOptions = {},
): Promise<Leaflet.LayerGroup> {
  // 未知选项运行时抛错：拼写错误的选项被静默忽略 = 显示语言/行为悄悄不符预期（2026-09-15
  // 五角色评测实测：顶层 locale 此前被静默忽略，popup 整卡仍中文）。中文提示 = v0.1 message 语言契约。
  for (const key of Object.keys(options)) {
    if (!ADD_METAR_LAYER_OPTION_KEYS.has(key)) {
      throw new Error(
        `addMetarLayer 收到未知选项 "${key}"——卡片级选项（locale/raw/className…）需包在 card 里传，可用项见 AddMetarLayerOptions`,
      );
    }
  }
  // 语言解析单一出口：card.locale 显式传入 > 顶层 locale 速记 > zh；非法值清晰报错不裸崩
  const locale = options.card?.locale ?? options.locale ?? "zh";
  if (locale !== "zh" && locale !== "en") {
    // never 收窄后的宽化中转：模板表达式不接受 never 字面量类型
    const bad: string = locale;
    throw new Error(`addMetarLayer 的 locale 选项值 "${bad}" 不受支持（可用："zh" \| "en"）`);
  }
  const L = await loadLeaflet();
  const group = L.layerGroup();
  for (const item of items) {
    const name = item.title ?? item.report.station;
    // alt 写入图标 img 的 alt 属性：marker 在读屏下 role=button，可访问名称 = 站名（WCAG 4.1.2）
    let marker: Leaflet.Marker;
    if (options.conditionColors === true) {
      // 圆点 divIcon 无 img——alt 失效，改以 role=img + aria-label 保住可访问名称（内容经 HTML 转义）；
      // aria-label 追加档位词（a11y 1.4.1：档位不只靠颜色传达；语言随 card.locale，缺省中文）
      const tier = conditionOf(item.report);
      const label = `${name} · ${TIER_WORDS[locale][tier]}`;
      marker = L.marker(item.position, {
        icon: L.divIcon({
          className: "mw-cond-icon",
          html: `<span role="img" aria-label="${escapeHtml(label)}" class="mw-dot mw-dot-${tier}" style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${TIER_COLORS[tier]};border:2px solid #fff;box-shadow:0 0 2px rgba(0,0,0,.4)"></span>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        }),
      });
    } else {
      marker = L.marker(item.position, { alt: name });
    }
    marker.bindTooltip(tooltipContent(item, options.conditionColors === true, locale));
    if (options.popup ?? true) {
      // 弹窗内容是 renderCard 的 DOM 元素（createElement/textContent 构建），本就走非 HTML 路径；
      // maxWidth 420 = 卡片设计宽（Leaflet 缺省 300 会压窄）
      // 元数据联表得到的站名随弹窗进卡片站名行（title = "ICAO 站名"，剥掉 ICAO 前缀）；调用方显式传入时以其为准
      const cardOpts: Parameters<typeof renderCard>[1] = { ...options.card };
      if (cardOpts.locale === undefined && options.locale !== undefined) {
        cardOpts.locale = options.locale;
      }
      const stationName =
        item.title !== undefined && item.title.startsWith(`${item.report.station} `)
          ? item.title.slice(item.report.station.length + 1)
          : undefined;
      if (cardOpts.stationTitle === undefined && stationName !== undefined) {
        cardOpts.stationTitle = stationName;
      }
      marker.bindPopup(renderCard(item.report, cardOpts), { maxWidth: 420 });
      marker.on("popupopen", () => {
        // 触屏双浮层消除：弹窗打开即收起 tooltip
        marker.closeTooltip();
        // 焦点移入弹窗首个可聚焦元素（Leaflet 关闭按钮）——键盘与读屏可直达
        const focusTarget = marker
          .getPopup()
          ?.getElement()
          ?.querySelector<HTMLElement>("a.leaflet-popup-close-button, button, [href]");
        focusTarget?.focus();
      });
    }
    marker.addTo(group);
  }
  if (!escapeBoundMaps.has(map)) {
    escapeBoundMaps.add(map);
    // 地图容器键盘路径：Escape 关闭已开弹窗（closePopup 对未开弹窗是空操作）
    map.getContainer().addEventListener("keydown", (event) => {
      if (event.key === "Escape") map.closePopup();
    });
  }
  group.addTo(map);
  return group;
}

// ---------------------------------------------------------------- TAF 图层（v0.2 渲染层①：预报当观测渲）

/** TAF 展开结果 → 判据输入面投影（runwayStates 恒缺省——TAF 无跑道状态语汇） */
function asConditionInput(c: TafResolvedConditions, nilLike: boolean): ConditionInput {
  return {
    nil: nilLike,
    cavok: c.cavok,
    ...(c.wind !== undefined ? { wind: { kind: "value" as const, value: c.wind } } : {}),
    ...(c.visibility !== undefined
      ? { visibility: { kind: "value" as const, value: c.visibility } }
      : {}),
    ...(c.weather.length > 0 ? { weather: { kind: "value" as const, value: c.weather } } : {}),
    ...(c.clouds !== undefined ? { clouds: c.clouds } : {}),
  };
}

/** 天气组紧凑码（TAF 摘要用）：-SHRA / TSRA / +SN */
const wxCompact = (g: WeatherGroup): string =>
  `${g.intensity ?? ""}${g.proximity ? "VC" : ""}${g.descriptor ?? ""}${g.phenomena.join("")}`;

/** TAF 展开摘要（一行）：CAVOK 或 能见度 · 天气 · 云（对齐 summarizeReport 的要素序） */
function summarizeTaf(c: TafResolvedConditions, locale: "zh" \| "en"): string {
  if (c.cavok) return "CAVOK";
  const parts: string[] = [];
  if (c.visibility !== undefined) {
    const vis = c.visibility;
    parts.push(
      vis.unit === "m"
        ? vis.exact
          ? `${vis.value} m`
          : "≥10 km"
        : `${vis.beyond === "below" ? "<" : vis.beyond === "above" ? ">" : ""}${vis.value} SM`,
    );
  }
  const significant =
    c.weather.find(
      (g) => g.descriptor === "TS" \|\| g.phenomena.includes("GR") \|\| g.intensity === "+",
    ) ?? c.weather[0];
  if (significant !== undefined) parts.push(wxCompact(significant));
  let lowest: { e: Extract<CloudElement, { kind: "layer" }>; ft: number } \| undefined;
  for (const e of c.clouds?.elements ?? []) {
    if (e.kind !== "layer") continue;
    const ft = e.heightFt.value ?? Number.POSITIVE_INFINITY;
    if (lowest === undefined \|\| ft < lowest.ft) lowest = { e, ft };
  }
  if (lowest !== undefined && lowest.e.amount !== null) {
    parts.push(
      `${lowest.e.amount}${String(Math.round(lowest.ft / 100)).padStart(3, "0")}${lowest.e.convective ?? ""}`,
    );
  }
  if (parts.length === 0) return locale === "en" ? "No elements" : "无要素组";
  return parts.join(" · ");
}

export interface TafLayerItem {
  /** 已解析的 TAF 报文 IR */
  report: TafReport;
  /** 站点坐标（WGS-84 [lat, lon]） */
  position: [number, number];
  /** 站点提示（tooltip 文案，缺省用 IR 站名） */
  title?: string;
}

/**
 * Options for addTafLayer: expansion instant, month anchor, locale, popup.
 * addTafLayer 的选项：展开时刻、月锚、语言、弹窗。
 */
export interface AddTafLayerOptions {
  /** 显示语言（缺省 zh） */
  locale?: "zh" \| "en";
  /** 展开时刻（UTC）；缺省 = 有效期起点 */
  at?: TafExpandAt;
  /** 月锚天数（B3 跨月回绕，有效期起日所在月）；缺省 31 */
  anchorDays?: number;
  /** 点击站点时以弹窗展示预报摘要（缺省开启；层② 的完整 TAF 卡片在后续版本） */
  popup?: boolean;
}

const ADD_TAF_LAYER_OPTION_KEYS: ReadonlySet<string> = new Set([
  "locale",
  "at",
  "anchorDays",
  "popup",
]);

/**
 * Put parsed TAF stations onto a Leaflet map as forecast markers at one instant — the four-tier
 * dot, tooltip and popup are driven by `expandTaf` (renderer layer ①: forecast-as-observation).
 * 把一组 TAF 站点按同一时刻的预报值挂上地图：四档圆点/tooltip/弹窗全部由 expandTaf 展开
 * 结果驱动（渲染层①「预报当观测渲」——判据/圆点/摘要与 METAR 侧同一条管线）。
 * 档位判据为本库自拟扫视启发式（同 conditionOf 注释）——**预报值套判据同样不得用作运行判据**，
 * tooltip/弹窗均显式标注「预报」，不与实况混淆。
 */
export async function addTafLayer(
  map: Leaflet.Map,
  items: readonly TafLayerItem[],
  options: AddTafLayerOptions = {},
): Promise<Leaflet.LayerGroup> {
  for (const key of Object.keys(options)) {
    if (!ADD_TAF_LAYER_OPTION_KEYS.has(key)) {
      throw new Error(`addTafLayer 收到未知选项 "${key}"（可用项见 AddTafLayerOptions）`);
    }
  }
  const locale = options.locale ?? "zh";
  if (locale !== "zh" && locale !== "en") {
    const bad: string = locale;
    throw new Error(`addTafLayer 的 locale 选项值 "${bad}" 不受支持（可用："zh" \| "en"）`);
  }
  const L = await loadLeaflet();
  const group = L.layerGroup();
  await populateTafLayer(map, group, items, options, L);
  group.addTo(map);
  return group;
}

/** TAF 标记构建核心：addTafLayer 与 setTafLayerTime 共用（原地重建＝清层后重灌同一图层实例） */
async function populateTafLayer(
  map: Leaflet.Map,
  group: Leaflet.LayerGroup,
  items: readonly TafLayerItem[],
  options: AddTafLayerOptions,
  L: typeof import("leaflet"),
): Promise<void> {
  const anchor: TafMonthAnchor = { daysIn: options.anchorDays ?? 31 };
  const locale = options.locale ?? "zh";
  for (const item of items) {
    const r = item.report;
    const name = item.title ?? r.station;

    // NIL/CNL 不展开：灰 unknown 圆点 + 缺报/取消提示（对齐 METAR 侧 NIL 口径）
    const noTimeline = r.nil === true \|\| r.cancelled === true;
    const v = r.validity;
    const at: TafExpandAt = noTimeline
      ? { day: v?.startDay ?? 0, hour: v?.startHour ?? 0, minute: 0 }
      : (options.at ?? { day: v?.startDay ?? 0, hour: v?.startHour ?? 0, minute: 0 });

    let tier: ConditionTier = "unknown";
    let summary = r.nil === true ? "缺报（NIL）" : r.cancelled === true ? "预报取消（CNL）" : "";
    let notes: string[] = [];
    if (!noTimeline && v !== undefined) {
      const expansion = expandTaf(r, at, anchor);
      tier = conditionOf(asConditionInput(expansion.conditions, false));
      summary = summarizeTaf(expansion.conditions, locale);
      const atText = `${String(at.day).padStart(2, "0")}日${String(at.hour).padStart(2, "0")}:${String(at.minute).padStart(2, "0")}Z`;
      notes.push(locale === "en" ? `Forecast for ${atText}` : `预报 ${atText} 时刻`);
      if (expansion.uncertain) {
        notes.push(
          locale === "en" ? "Transition band — timing uncertain" : "过渡带（变化时刻不确定）",
        );
      }
      if (expansion.tempo !== undefined) {
        const tempoSummary = summarizeTaf(
          {
            ...expansion.conditions,
            ...expansion.tempo.conditions,
            weather: expansion.tempo.conditions.weather ?? [],
            cavok: expansion.tempo.conditions.cavok,
          },
          locale,
        );
        notes.push((locale === "en" ? "TEMPO bursts: " : "TEMPO 发作可能：") + tempoSummary);
      }
    } else if (v !== undefined) {
      notes.push(`有效期 ${v.raw}`);
    }

    const label = `${name} · ${locale === "en" ? "Forecast " : "预报"}${TIER_WORDS[locale][tier]}`;
    const marker = L.marker(item.position, {
      icon: L.divIcon({
        className: "mw-cond-icon",
        html: `<span role="img" aria-label="${escapeHtml(label)}" class="mw-dot mw-dot-${tier}" style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${TIER_COLORS[tier]};border:2px solid #fff;box-shadow:0 0 2px rgba(0,0,0,.4)"></span>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      }),
    });
    const tip = document.createElement("span");
    tip.append(textCarrier(`${name} · ${locale === "en" ? "Forecast" : "预报"}`));
    if (summary !== "") tip.append(document.createElement("br"), textCarrier(summary));
    for (const n of notes) tip.append(document.createElement("br"), textCarrier(n));
    marker.bindTooltip(tip);

    if (options.popup ?? true) {
      // 层②起弹窗换 renderTafCard（时间线条 + 变化组清单 + 气温行；展开时刻摘要行置于卡前）
      const card = renderTafCard(r, { locale });
      if (notes.length > 0) {
        const lead = document.createElement("p");
        lead.style.margin = "0 0 4px";
        lead.className = "mw-taf-meta";
        for (const [i, n] of notes.entries()) {
          if (i > 0) lead.append(document.createElement("br"));
          lead.append(textCarrier(n));
        }
        card.prepend(lead);
      }
      marker.bindPopup(card, { maxWidth: 420 });
    }
    marker.addTo(group);
  }
  if (!escapeBoundMaps.has(map)) {
    escapeBoundMaps.add(map);
    map.getContainer().addEventListener("keydown", (event) => {
      if (event.key === "Escape") map.closePopup();
    });
  }
}

// ---------------------------------------------------------------- TAF 时间轴（v0.2 渲染层③：全图统一时刻）

/**
 * Re-expand every TAF marker in the layer at a new instant (in-place rebuild; pure-function
 * expansion, dozens of stations are sub-millisecond). The single-map time-scrub core.
 * 全图统一换时刻：整层按新时刻原地重建（展开是纯函数，几十站毫秒级）——地图级时间轴的功能核。
 * 层对象保持同一实例（图层引用不失效）；过渡带与 TEMPO 标注随新时刻更新。
 */
export async function setTafLayerTime(
  map: Leaflet.Map,
  layer: Leaflet.LayerGroup,
  items: readonly TafLayerItem[],
  options: AddTafLayerOptions = {},
): Promise<Leaflet.LayerGroup> {
  layer.clearLayers();
  await populateTafLayer(map, layer, items, options, await loadLeaflet());
  return layer;
}

/** 时刻展示串（控件与卡片共用口径） */
const fmtTafAt = (at: TafExpandAt): string =>
  `${String(at.day).padStart(2, "0")}日 ${String(at.hour).padStart(2, "0")}:${String(at.minute).padStart(2, "0")} Z`;

export interface TafTimeControlOptions {
  /** 受控图层与数据（每次拨动全量重展开） */
  layer: Leaflet.LayerGroup;
  items: readonly TafLayerItem[];
  /** addTafLayer 的其余选项（locale/anchorDays/popup） */
  layerOptions?: Omit<AddTafLayerOptions, "at">;
  /** 步进分钟数（滑杆一格），缺省 60 */
  stepMinutes?: number;
  /** 滑杆零点时刻；缺省自动取各站最早有效期起点 */
  from?: TafExpandAt;
  /** 时刻变更回调（拿到当前时刻，供宿主联动外部 UI） */
  onTime?: (at: TafExpandAt) => void;
}

/**
 * A framework-free time-scrub control element for a TAF layer: one range input drives every
 * station | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |

## leaflet.msg02（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| leaflet.msg02 | 预报时刻 | product | packages/leaflet/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |

## sources.msg01（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| sources.msg01 | IEM 请求超时（>${options.timeoutMs}ms，network=${network}） | product | packages/metweave/src/sources.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |

## sources.msg02（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| sources.msg02 | 网络请求失败（源：IEM，network=${network}）：请检查网络连通性后重试（${reason}） | product | packages/metweave/src/sources.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |

## sources.msg03（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| sources.msg03 | IEM 响应不是合法 JSON（可能被代理/防火墙拦截，network=${network}）：${reason} | product | packages/metweave/src/sources.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |

## sources.msg04（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| sources.msg04 | IEM 响应异常：缺少 data 数组（network=${network}，schema 不符） | product | packages/metweave/src/sources.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |

## sources.msg05（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| sources.msg05 | IEM 响应异常：data 存在 station/raw 非字符串的记录（network=${network}，schema 不符） | product | packages/metweave/src/sources.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |

## sources.msg06（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| sources.msg06 | IEM 返回空数据（network=${network}）——请核对 IEM 网络名（如 CN__ASOS/RU__ASOS，参考 https://mesonet.agron.iastate.edu/sites/networks.php） | product | packages/metweave/src/sources.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |

## sources.msg07（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| sources.msg07 | 报文解析失败 ${failures.length} 条（network=${network}）——${failures.slice(0, 3).join("；")}${failures.length > 3 ? "……" : ""} | product | packages/metweave/src/sources.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |

## parser.msg001（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| parser.msg001 | ",
    );
  }
  const warnings: ParseWarning[] = [];
  // 报尾 = 终结符剥离（GTS/AFTN 通路报文行以 = 定界，常粘连末组如 Q1006= / NOSIG=）——
  // 仅剥尾部空白与 =，正文 token 偏移不变，span 仍对应原 raw（raw 保真含 =）。
  // 末字符预判（E2 性能项）：语料大头无报尾，尾字符既非 = 也非空白时跳过整串正则——
  // 预判用单字符 \s 测试（与 [\s=] 字符类完全同域，行为等价），省一次全文回溯扫描
  const tail = raw.at(-1);
  const body =
    tail === undefined \|\| tail === "=" \|\| /\s/.test(tail) ? raw.replace(/[\s=]+$/, "") : raw;
  const tokens = tokenize(body);
  // 输入规模护栏（只告警不截断——截断破坏 raw 保真与「不丢弃」纪律）：语料单行最大 30 token，
  // 上限 128 = 4 倍余量；超限报文照常完整解析，仅以一条聚合告警标记异常输入
  //（span 缺省 = 报文级；整体失败路径不经过此处，失败契约不受影响）
  const TOKEN_COUNT_LIMIT = 128;
  if (tokens.length > TOKEN_COUNT_LIMIT) {
    warnings.push({
      code: "invalid-format",
      severity: "warning",
      message: `输入 token 数超上限（${tokens.length} > ${TOKEN_COUNT_LIMIT}）——按异常输入标记，解析照常完整，原文经 raw 保真`,
    });
  }
  let i = 0;
  const peek = (ahead = 0): Token \| undefined => tokens[i + ahead];

  const externalKind = options?.kind;
  let kind: ReportKind = externalKind ?? "metar";
  let corrected = false;
  let auto = false;

  // —— 头部：类型词 / COR（WMO 形态）/ 站名 / 时组 / AUTO / COR（美式时组后形态）
  const head = peek();
  if (head !== undefined && (head.text === "METAR" \|\| head.text === "SPECI")) {
    if (externalKind === undefined) kind = head.text === "SPECI" ? "speci" : "metar";
    i += 1; // 类型词 token 无论由谁决定 kind 都要消费
  }
  if (peek()?.text === "COR") {
    corrected = true;
    i += 1;
  }
  // AMD（修订发布标志，部分 CAA 用于 METAR 标题位，TAF 更常见）：标题元数据词，
  // 语义为「本报告取代此前发布」——消费之不进站名位；是否置 corrected 不越权代判
  //（修订 ≠ 更正），IR 无 amended 位故仅放行不标注
  if (peek()?.text === "AMD") {
    i += 1;
  }
  const stTok = peek();
  if (stTok === undefined \|\| !/^[A-Z0-9]{4}$/.test(stTok.text)) {
    // 契约：无站名组 = 整体解析失败（不是字段级三态）；code 是稳定契约，message 中文为权威
    // 文案——英文经 @metweave/core EN_MESSAGES[code] 查表或渲染层 locale:"en" 切换
    throw new MetarParseError(
      "missing-station",
      raw,
      `无法识别站名组——输入不是 METAR/SPECI 报文（${stTok?.text ?? "空输入"}）`,
    );
  }
  const station: string = stTok.text;
  i += 1;
  // CCA/CCB/CCC 与 COR 槽位磨损兜底（站名后/时组前——规范槽位：BBB 系列在时组后（见下方
  // BBB 消费位）、COR 在类型词位（见报头 COR 位））：部分 feed 的更正标记出现在此槽——此前
  // 直接 throw missing-time，「合法更正报整体失败」是最恶性失败模式。后随 token 为合法时组时
  // 消费放行并置 corrected + 出声（槽位漂移本身须可观测——不静默，2026-09-14 独立复评补
  // COR 对称缺口与出声）；后随非时组则照旧走 missing-time。已知留案：标记若出现在 AUTO
  // 之前的其他相对序（如 CCA AUTO），AUTO 会落正文 unknown——语料无实证，暂不设防
  const driftTok = peek();
  if (driftTok !== undefined && /^(CC[A-Z]\|COR)$/.test(driftTok.text)) {
    const afterDrift = peek(1);
    if (afterDrift !== undefined && /^\d{2}\d{2}\d{2}Z$/.test(afterDrift.text)) {
      corrected = true;
      i += 1;
      warnings.push({
        code: "invalid-format",
        severity: "info",
        message: `更正标记槽位漂移（${driftTok.text} 出现在站名后/时组前——已消费并置更正标志）`,
        span: spanOf(driftTok),
      });
    }
  }
  const tmTok = peek();
  const tm = tmTok !== undefined ? /^(\d{2})(\d{2})(\d{2})Z$/.exec(tmTok.text) : null;
  if (tmTok === undefined \|\| tm === null) {
    throw new MetarParseError(
      "missing-time",
      raw,
      `无法识别时组——输入不是完整的 METAR/SPECI 报文（${tmTok?.text ?? "时组缺失"}）`,
    );
  }
  const time: MetarReport["time"] = {
    day: Number.parseInt(tm[1] ?? "0", 10),
    hour: Number.parseInt(tm[2] ?? "0", 10),
    minute: Number.parseInt(tm[3] ?? "0", 10),
  };
  // 契约：时组为两态必填（无缺测形态，无 Observed）——数值越界即不可信时组，等同无效时组整体失败，
  // 绝不把假值（日 99、时 24、分 60）留在 IR（同 Q10054 脏 QNH 的「值不可信」纪律，时组无处判缺测故整体失败）
  if (time.day < 1 \|\| time.day > 31 \|\| time.hour > 23 \|\| time.minute > 59) {
    throw new MetarParseError(
      "invalid-time",
      raw,
      `时组数值越界（${tmTok.text}：须日 01–31 / 时 00–23 / 分 00–59）——输入不是完整的 METAR/SPECI 报文`,
    );
  }
  i += 1;
  if (peek()?.text === "AUTO") {
    auto = true;
    i += 1;
  }
  if (peek()?.text === "COR") {
    corrected = true;
    i += 1;
  }
  // RRA/RRB/RRC 迟到报标记（AP-117-TM-01R2 第 21 条：报头时间组后）——标题元数据，消费放行
  if (/^RR[ABC]$/.test(peek()?.text ?? "")) {
    i += 1;
  }
  // CCA/CCB/CCC 更正指示符（WMO FM15 §1.3.3 BBB 系列：第一次更正 CCA、第二次 CCB 顺延；
  // 规范槽位即本位——时组后。加拿大 NAV CANADA 明文采用，中国 AFTN 实务沿用；仓库声明的
  // 编码基准含 MANOPS-MET）。语义即更正报——与 COR 同义异位（COR 在类型词位、BBB 在时组后位），
  // 消费并置 corrected；此前落 unknown-token，更正语义丢失（2026-09-14 复评：基准内形态未实现）
  if (/^CC[A-Z]$/.test(peek()?.text ?? "")) {
    corrected = true;
    i += 1;
  }

  // —— NIL：台站无观测（FM15 代码形注 2 的 NIL 码词；§15.4 是 AUTO 条款）——最小形态：站名/时组凭据保留，正文组不解析（本就无正文），零告警
  if (peek()?.text === "NIL") {
    return compactIfEnabled({
      kind,
      raw,
      nil: true,
      station,
      time,
      flags: { auto, corrected },
      cavok: false,
      trends: [],
      runwayStates: [],
      remarks: [],
      warnings,
    });
  }

  // —— 正文状态
  let cavok = false;
  let cavokSpan: Span \| undefined;
  let wind: Observed<WindGroup> \| undefined;
  let visibility: Observed<VisibilityGroup> \| undefined;
  // 脱离主导能见度的方向组被按主导收下的局部标记（见正文循环方向组分支注释；非 IR 字段）
  let directionalAsPrimary = false;
  let rvr: Observed<readonly RunwayVisualRange[]> \| undefined;
  const rvrList: RunwayVisualRange[] = [];
  // 多组 RVR 的组级 span 首组至末组（与天气组同口径——单组 span 在各自元素上）
  let rvrSpan: Span \| undefined;
  let weather: Observed<readonly WeatherGroup[]> \| undefined;
  const weatherList: WeatherGroup[] = [];
  const recentList: WeatherGroup[] = [];
  let clouds: CloudCondition \| undefined;
  let cloudSeen = false;
  const cloudElements: CloudElement[] = [];
  let clearCode: CloudCondition["clear"];
  let temperature: TemperatureReading \| undefined;
  let dewpoint: TemperatureReading \| undefined;
  let altimeter: AltimeterReading \| undefined;
  // 双气压组口径（tolerant 惯例）：末组为准（保持既有 last-wins 行为），重复组追加 info 告警不静默
  let altimeterSeen = false;
  const trends: TrendGroup[] = [];
  const runwayStates: RunwayStateGroup[] = [];
  const remarks: RemarkGroup[] = [];
  // 重复组口径（与双气压组同款 tolerant 惯例）：末组为准（保持既有 last-wins 行为），
  // 重复组出声不静默——专用码 duplicate-group（2026-09-15 五角色评测定案：此前借用
  // cross-check-conflict+info，消费方无法按「重复」分流；severity 升 warning）。
  // 前值后值原文都进 message：last-wins 会覆盖 IR 里的前值 span，前值唯一可回溯通道就是这条告警
  // 风切变组累积器（同报多组 WS 合一：runways 连接、span 首组至末组）
  let windShear: WindShearGroup \| undefined;
  let wsRunways: string[] \| undefined;
  let wsAll = false;
  let wsSpan: Span \| undefined;

  // —— 正文循环（RMK 交段外处理）
  while (i < tokens.length) {
    const t = tokens[i];
    if (t === undefined) break;
    const text = t.text;

    if (text === "RMK") {
      i += 1;
      break;
    }
    // RMK 磨损粘连（RMKQFE749/0998 = RMK 与后组丢空格，fuzz 实弹 35/5 万例命中）：进 RMK 段
    // 但不跳过 token 本身——由 RMK 段按认组粒度收下（多为 unknown，raw 保真不蒸发）
    if (text.startsWith("RMK")) {
      break;
    }

    // 趋势指示组：NOSIG / BECMG / TEMPO（吞到下一个指示组、RMK 或结尾）
    if (TREND_KINDS.has(text)) {
      const kindText = text;
      const collected: Token[] = [t];
      i += 1;
      let period: TrendGroup["period"];
      const periodTok = peek();
      if (
        kindText !== "NOSIG" &&
        periodTok !== undefined &&
        // 时段词双形态：AT/TL/FM+DDHH（WMO 306 FM15 §15.14.3）与 DDHH/DDHH 斜杠时段
        //（ICAO Annex 3 模板 / 中国民航主流编法，2026-09-16 五方实测评测发现的缺失形态）
        (/^(?:AT\|FM\|TL)\d{4}$/.test(periodTok.text) \|\| /^\d{4}\/\d{4}$/.test(periodTok.text))
      ) {
        period = { text: periodTok.text, span: spanOf(periodTok) };
        collected.push(periodTok);
        i += 1;
      }
      // 收口语义见 isTrendCollectible：仅趋势合法要素族可收，其余收口交回正文（warnTrendClose 出声）
      i = collectTrendSegment(tokens, i, collected);
      warnTrendClose(tokens, i, warnings);
      trends.push(
        buildTrendGroup(
          kindText === "NOSIG" ? "nosig" : kindText === "BECMG" ? "becmg" : "tempo",
          period,
          collected,
          period !== undefined ? 2 : 1,
        ),
      );
      continue;
    }

    // 指示组缺失趋势段两形态——传输磨损所致（WMO 306 FM15 §15.14.3 时段词 AT/TL/FM 不得脱离指示组）：
    // ①粘连——指示组与时段词丢空格（BECMGTL0350，IEM 归档实弹 10 次）：宽容拆分，语义完整可恢复；
    // ②裸时段词——指示组整组丢失（Q1009 TL0730 …，IEM 归档实弹 128 次）：按 kind  | product | packages/parser/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |

## parser.msg002（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| parser.msg002 | 
    //   收段（要素组不再散落正文——尤其防趋势风组以 last-wins 覆盖正文真风组），告警标注指示组不可辨。
    //   NOSIG 粘连不拆（NOSIG 语义上不配时段词）；标准位置的时段词已在上方指示组分支内消费，此处不重复触达。
    if (
      (text.length === 6 &&
        (text.charCodeAt(0) === 65 \|\| text.charCodeAt(0) === 84 \|\| text.charCodeAt(0) === 70)) \|\|
      text.startsWith("BECMG") \|\|
      text.startsWith("TEMPO")
    ) {
      const fused = /^(BECMG\|TEMPO)((?:AT\|TL\|FM)\d{4}\|\d{4}\/\d{4})$/.exec(text);
      if (fused !== null) {
        const indicator = fused[1] ?? "";
        const collected: Token[] = [t];
        i += 1;
        i = collectTrendSegment(tokens, i, collected);
        warnTrendClose(tokens, i, warnings);
        trends.push(
          buildTrendGroup(
            indicator === "BECMG" ? "becmg" : "tempo",
            {
              text: text.slice(indicator.length),
              span: { start: t.start + indicator.length, end: t.end },
            },
            collected,
            1,
          ),
        );
        warnings.push({
          code: "invalid-format",
          severity: "info",
          message: `趋势指示组与时段词粘连（${text}——传输磨损丢空格，BECMG/TEMPO 与 AT/TL/FM 时段语义完整可恢复）`,
          span: spanOf(t),
        });
        continue;
      }
      if (/^(AT\|TL\|FM)\d{4}$/.test(text)) {
        const collected: Token[] = [t];
        i += 1;
        i = collectTrendSegment(tokens, i, collected);
        warnTrendClose(tokens, i, warnings);
        trends.push(buildTrendGroup("unspecified", { text, span: spanOf(t) }, collected, 1));
        warnings.push({
          code: "invalid-format",
          severity: "warning",
          message: `趋势时段词缺指示组（${text}——§15.14.3 时段词须随 BECMG/TEMPO 出现）——按指示组缺失的趋势段收下，指示组类型不可辨`,
          span: spanOf(t),
        });
        continue;
      }
    }
    // 裸斜杠时段词（1616/1618——ICAO Annex 3 模板 / 中国民航主流趋势时段编法，指示组缺失）：
    // 与 AT/TL/FM 裸词同纪律——kind  | product | packages/parser/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |

## parser.msg003（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| parser.msg003 |  收段出声，要素组不再散落正文
    //（2026-09-16 五方实测评测发现：此前该形态散落正文，趋势能见度以 last-wins 顶掉正文能见度）。
    // 前置守卫（长度 9 + 第 5 字符为斜杠）保正文热路径不为逐 token 正则付费
    if (text.length === 9 && text.charCodeAt(4) === 47 && /^\d{4}\/\d{4}$/.test(text)) {
      const collected: Token[] = [t];
      i += 1;
      i = collectTrendSegment(tokens, i, collected);
      warnTrendClose(tokens, i, warnings);
      trends.push(buildTrendGroup("unspecified", { text, span: spanOf(t) }, collected, 1));
      warnings.push({
        code: "invalid-format",
        severity: "warning",
        message: `趋势时段词缺指示组（${text}——ICAO Annex 3 模板趋势时段须随 BECMG/TEMPO 出现）——按指示组缺失的趋势段收下，指示组类型不可辨`,
        span: spanOf(t),
      });
      continue;
    }

    if (text === "CAVOK") {
      cavok = true;
      cavokSpan = spanOf(t);
      // 交叉校验（三面：能见度/天气/云，判据见 cavokCrossCheck 注）——CAVOK 语义要求能见度
      // ≥10km、无重要天气、5000ft 以下无云且无 CB/TCU；前序组确定矛盾即出声。
      // 下界语义的编码（9999 ≥10km、P6SM >9.6km）与 CAVOK 相容不告警；M 前缀（小于下界）必矛盾。
      // 让位契约照旧（vis/weather/cloud 三组让位），矛盾仅追加 cross-check-conflict 告警
      cavokCrossCheck(
        { cavokSpan, visibility, weatherList, rvr, cloudElements },
        "前序",
        raw,
        warnings,
      );
      // 契约（IR）：CAVOK = 能见度 ≥10km + 无低云 + 无天气，前序 vis/weather/cloud 三组让位为 undefined
      // （让位是契约行为不发告警；词位以 cavokSpan 标记，前序组原码仍可从 raw 回溯）
      visibility = undefined;
      directionalAsPrimary = false;
      weather = undefined;
      weatherList.length = 0;
      cloudSeen = false;
      cloudElements.length = 0;
      clearCode = undefined;
      i += 1;
      continue;
    }

    // E3 性能项——首字符位掩码分流：每轮按首字符一次 switch 得「可能匹配的分支」位集，
    // 各分支先做一次位测试再进正则——不可能匹配的分支零正则尝试。分支相对顺序与原
    // 全试链完全一致（行为等价由全量语料回放快照锁定）。可达首字符推导：
    // 风 V/数字//；能见度 数字//M/P；RVRNO 与 R 组 R；天气 = 现象/描述符首字母
    // （B D F G H I M P R S T U）+ -/+/V（VC）；裸 // 与云 /；云 F/S/B/O//；
    // VV 与 VIS 的 V；晴空词 S/N/C；温露 M/数字//；QNH 的 Q；A 组的 A；维护符 $。
    const mask = maskOf(text.charCodeAt(0));

    // 风（含 /////KT 缺测与 260V050 变化组）
    const windParsed = (mask & M_WIND) !== 0 ? parseWindToken(t, peek(1)) : null;
    if (windParsed !== null) {
      if (wind !== undefined) warnDuplicateGroup(raw, warnings, "风组", wind.span, spanOf(t));
      if (windParsed === "missing") {
        if (wind === undefined) {
          wind = { kind: "missing", span: spanOf(t) };
          warnings.push({
            code: "missing-expected",
            severity: "info",
            // 全缺测 /////KT（自动站假报文形态）与部分缺测（180//KT 风速位缺）同口径出声
            message: t.text.startsWith("/////")
              ? "风组缺测（/////KT，疑似自动站假报文形态）"
              : `风组缺测（${t.text}，风速位缺测）`,
            span: spanOf(t),
          });
        }
        // 已有风组时：缺测电码不顶替在场值（duplicate-group 已出声）——
        // 零信息量的缺测码按 last-wins 覆盖真实观测是纯信息损失（2026-09-15 五角色评测批）
        i += 1;
      } else {
        // 值域门（NaN 终结防线 / >199 上限 / 越界 findings / 阵风缺测 / VRB 变化组并存）
        // 迁至 validateWindGroup——判据与告警顺序见其注释
        const applied = validateWindGroup(t, windParsed, raw);
        wind = applied.wind;
        warnings.push(...applied.warnings);
        i += windParsed.consumed;
      }
      continue;
    }

    // 能见度（//// 显式缺测补 info 告警——对齐风/天气缺测口径；零分母判缺测补超界告警）
    const visParsed = (mask & M_VIS) !== 0 ? parseVisibilityToken(t, peek(1)) : null;
    if (visParsed !== null) {
      // 方向组挂靠/脱离主导、缺测不顶替在场值、零分母判缺测等落位规则迁至 applyVisibilityToken
      const applied = applyVisibilityToken(
        t,
        visParsed,
        { visibility, directionalAsPrimary },
        raw,
        warnings,
      );
      visibility = applied.visibility;
      directionalAsPrimary = applied.directionalAsPrimary;
      i += visParsed.consumed;
      continue;
    }

    // RVRNO：RVR 设备存在但明示不可用（显式缺测，区别于组省略）。
    // 正文位与 RMK 位行为统一（2026-09-15 方案一，专业判读定案）：一律进 remarks（kind
    //  | product | packages/parser/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |

## parser.msg004（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| parser.msg004 | ）——站级状态声明 typed 可见，原正文位不留痕的双标消除；RVRNO 单独出现
    //（此前无值组）仍 = rvr 显式缺测（既有 IR 契约不变）。
    // 值组与 RVRNO 并存 = 自相矛盾形态（规范未定义并存）：值组按跑道级明细保留——具体
    // 值组是逐道运行信息、可信度高于无道号的站级状态码（预报员/塔台标准判读；NWS 官方
    // 解码器即「值组 + RVRNO 旗标并存不复算」），矛盾出声、文案描述矛盾本身不预言终态。
    if ((mask & M_R) !== 0 && text === "RVRNO") {
      rvr = applyRvrNoBodyToken(t, rvr, raw, warnings, remarks);
      i += 1;
      continue;
    }

    // RVR 与跑道状态（同为 R 前缀组，先按 RVR 语法试解、再按跑道状态电码试解）
    if ((mask & M_R) !== 0 && text.startsWith("R") && text.includes("/")) {
      const rvrParsed = parseRvrToken(t);
      if (rvrParsed !== null) {
        // 反向次序对称口径：RVRNO 在前、值组在后同样出声（方案一：可解读为传感器恢复，
        // 值组按明细保留——与正序矛盾并存同一文案口径，见 RVRNO 位注释）
        if (rvr?.kind === "missing") {
          warnRvrNoThenValues(t, rvr.span, raw, warnings);
        }
        rvrList.push(rvrParsed);
        const s = spanOf(t);
        rvrSpan = rvrSpan === undefined ? s : { start: rvrSpan.start, end: s.end };
        rvr = { kind: "value", value: [...rvrList], span: rvrSpan };
        i += 1;
        continue;
      }
      const runwayState = parseRunwayStateToken(t);
      if (runwayState !== null) {
        runwayStates.push(runwayState.group);
        for (const finding of runwayState.findings) {
          warnings.push({
            code: "invalid-format",
            severity: "warning",
            message: finding.message,
            span: finding.span,
          });
        }
        i += 1;
        continue;
      }
      // RVR 全斜杠缺测：R## + / + ////（分离符 + 四位值位斜杠 = 5 斜杠，标准缺测形态）。
      // 4 斜杠（R10////）为磨损短一段——按缺测收下，另附 invalid-format info（tgftp/IEM 实弹均见）
      const rvrMissing = applyRvrSlashToken(t, warnings);
      if (rvrMissing !== null) {
        rvr = rvrMissing;
        i += 1;
        continue;
      }
    }

    // 风切变组（WMO 306 FM15 §15.13.3 / ICAO Annex 3 模板）：标准形态 WS ALL RWY（全部跑道）
    // 与 WS R##[RLC]（WS RDRDR，如 WS R24——IEM 归档实弹 544 次、中国区多发且为近月主流形态）。
    // 中国区实务变体 WS RWY##[RLC]（RWY 前缀 + 设计器，教材常用）与 WS RWY ALL（词序倒置）
    // 同样语义无损一等收下——四形态正文组（跑道状态之后、趋势之前）。
    // 低空风切变对起降阶段是重大危害，IR 一等字段不蒸发。
    if ((mask & M_WS_RWY) !== 0 && text === "WS") {
      const wsMatch = parseWindShearSequence(t, peek(1), peek(2));
      if (wsMatch !== null) {
        wsRunways ??= [];
        if (wsMatch.runway !== null) wsRunways.push(wsMatch.runway);
        if (wsMatch.all) wsAll = true;
        wsSpan =
          wsSpan === undefined ? wsMatch.span : { start: wsSpan.start, end: wsMatch.span.end };
        windShear = { runways: wsRunways, allRunways: wsAll, span: wsSpan };
        i += wsMatch.consumed;
        continue;
      }
    }

    // 温度预告组（TAF TX/TN 混入 METAR 通路，IEM 归档实弹 26 次——中国区 TAF 行混入 METAR 流）：
    // TX25/0907Z = 最高 25°C、09 日 07Z 到达（ICAO Annex 3 附录五温度预告组，M 前缀 = 负值）。
    // 认组收下进 remarks（kind  | product | packages/parser/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |

## parser.msg005（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| parser.msg005 | ，raw 保真）——TAF 语义不属于 METAR 趋势段，
    // 与既有 temp-extrema-6h/24h 同款认组粒度，不解码数值（RemarkGroup 无值槽，数值化留待后续 additive 扩展）
    const txTnMatch = (mask & M_WEATHER) !== 0 && TX_TN_PATTERN.test(text);
    if (txTnMatch) {
      remarks.push({ kind: "temperature-forecast", raw: text, span: spanOf(t) });
      i += 1;
      continue;
    }

    // 天气组（RE 近期天气一并识别——不参与当前天气三态判定）
    const weatherParsed =
      (mask & M_WEATHER) !== 0 ? tryWeatherToken(t, weatherList, recentList) : false;
    if (weatherParsed !== false) {
      if (weatherParsed.outOfOrder) {
        // 能完整切解但语序反常（描述符在现象之后，如 RATS）：按切解结果收下 + invalid-format 告警，
        // 不静默也不拒收；完全无法切解的仍走下方 unknown-token
        warnings.push({
          code: "invalid-format",
          severity: "warning",
          message: `天气组语序不合电码表（${text}：描述符须先于现象）——已按切解结果收下`,
          span: spanOf(t),
        });
      }
      if (weatherParsed.signWithVc) {
        // 强度符与 VC 并存（-VCTSRA 家族，NWS 自动站实弹）：互斥是明文条款（4678 限定槽
        // 四选一、FAA AIM「Intensity and  | product | packages/parser/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |

## parser.msg006（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| parser.msg006 |  will not appear together」），语义可无损恢复
        //（强度+邻近+现象俱全）故容忍切解收下并出声——此前整体落 unknown-token 语义全丢
        warnings.push({
          code: "invalid-format",
          severity: "info",
          message: `强度符与 VC 邻近指示并存（${text}——强度符不与 VC 同组）——已按切解结果收下`,
          span: spanOf(t),
        });
      }
      if (weatherParsed.intensityMisuse === true) {
        warnings.push({
          code: "invalid-format",
          severity: "info",
          message:
            weatherParsed.kind === "recent"
              ? `RE 近期天气组带强度符（${text}——15.13.2.1 RE 组无强度位）——已收下`
              : `强度符超适用面（${text}——表 4678 注 4：-/+ 仅限降水族，非降水唯 +SS/+FC/+DS）——已收下`,
          span: spanOf(t),
        });
      }
      i += 1;
      continue;
    }

    // 裸 // 天气缺测组（自动站无法观测天气；IR 口径 = weather missing，绝不捏造也不吞进温度组）
    if ((mask & M_WEATHER) !== 0 && text === "//") {
      weather = { kind: "missing", span: spanOf(t) };
      warnings.push({
        code: "missing-expected",
        severity: "info",
        message: "天气组缺测（//，无法观测天气）",
        span: spanOf(t),
      });
      i += 1;
      continue;
    }

    // 云：云量位 /// 与云高 /// 双缺测形态（绝不捏造）——缺测位告警随构造直出（cloudLayerElementOf）
    const cloudElem = (mask & M_CLOUD) !== 0 ? cloudLayerElementOf(t, warnings) : null;
    if (cloudElem !== null) {
      cloudSeen = true;
      cloudElements.push(cloudElem);
      i += 1;
      continue;
    }
    const vvElem = (mask & M_VV) !== 0 ? verticalVisibilityElementOf(t, warnings) : null;
    if (vvElem !== null) {
      cloudSeen = true;
      cloudElements.push(vvElem);
      i += 1;
      continue;
    }
    if ((mask & M_SKY_CLEAR) !== 0 && isSkyClear(text)) {
      cloudSeen = true;
      clearCode = { code: text, span: spanOf(t) };
      i += 1;
      continue;
    }

    // 温度/露点
    const tempParsed = (mask & M_TEMP) !== 0 ? parseTempDewToken(t) : null;
    if (tempParsed !== null) {
      // 重复组/物理极值门/缺测出声/温露倒挂等落位规则迁至 applyTempDewToken
      const applied = applyTempDewToken(t, tempParsed, { temperature, dewpoint }, raw, warnings);
      temperature = applied.temperature;
      dewpoint = applied.dewpoint;
      i += 1;
      continue;
    }

    // 气压：Q（hPa）/ A（inHg，隐含小数点）；5 位数 QNH 与物理范围外值 = 脏值（Q10054 家族）
    const qnhParsed = (mask & M_QNH) !== 0 ? parseQnhToken(t) : null;
    if (qnhParsed !== null) {
      if (qnhParsed.kind === "out-of-range") {
        altimeter = undefined;
        warnings.push({
          code: "value-out-of-range",
          severity: "warning",
          message: qnhParsed.message,
          span: qnhParsed.span,
        });
      } else {
        ({ altimeter, altimeterSeen } = applyAltimeterReading(
          altimeter,
          altimeterSeen,
          qnhParsed.reading,
          raw,
          warnings,
        ));
      }
      i += 1;
      continue;
    }
    const altAParsed = (mask & M_ALTIMETER_A) !== 0 ? parseAltimeterAToken(t) : null;
    if (altAParsed !== null) {
      if (altAParsed.kind === "out-of-range") {
        altimeter = undefined;
        warnings.push({
          code: "value-out-of-range",
          severity: "warning",
          message: altAParsed.message,
          span: altAParsed.span,
        });
      } else {
        ({ altimeter, altimeterSeen } = applyAltimeterReading(
          altimeter,
          altimeterSeen,
          altAParsed.reading,
          raw,
          warnings,
        ));
      }
      i += 1;
      continue;
    }

    // 变化能见度（FAA 正文位形态：主能见度组后跟「VIS 1/4V1/2」变化区间）——
    // IR 建模为 RemarkKind  | product | packages/parser/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |

## parser.msg007（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| parser.msg007 | 未识别的组（${text}）——已如实收下 | product | packages/parser/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |

## parser.msg008（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| parser.msg008 | 后续 | product | packages/parser/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |

## parser.msg009（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| parser.msg009 | VV 组与云层组并存（WMO 15.9.2：VV 顶替整个云组）——报文自洽性存疑 | product | packages/parser/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |

## parser.msg010（1 条）

| key | 文案 | kind | 出处 | 规范 · 文档 · 条款 |
|---|---|---|---|---|
| parser.msg010 | ${clearCode.code}（无云电码）与云层组并存——互斥形态，报文自洽性存疑 | product | packages/parser/src/index.ts | PRODUCT · 产品显示文案（无标准对应条款，措辞经 owner 术语终审） · 显示自拟（无标准对应条款） |
