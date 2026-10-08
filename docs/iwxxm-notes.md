# IWXXM 施工笔记（v0.3 alpha，2026-10-05）

> 本文件是 v0.3「IWXXM 渲染支持」施工底档：首期（D0–D4）——D0 schema 复核结论表（8 点）、
> 转换语义难点的落位决策（对调研报告 §五 14 条的逐条裁决）、真实流探测记录与遗留项清单；
> 第二期（同日）——AWC 实时流源发现、2025-2 版本支持与接入（见 §五）；
> 第三期（同日）——解析×渲染联动正解：IWXXM 侧 IR 携带源 span 与对照区联动闭环（见 §六）；
> 生成侧（2026-10-08，与 §九 TAF 解析同日）——IR→IWXXM 序列化出口与合规验证（见 §十）。
> 复核方法：2023-1/2025-2RC1 官方 XSD 原文（schemas.wmo.int 直取）+ wmo-im/iwxxm-translation
> Amd79-80-2023 官方等价对（34 站 .tac+.xml）+ NOAA AWC 2025-2 实时流（41 站）+ ECCC 真实流样本
> 多方互证——结论一律标注证据来源，未核实项显式声明，不把推测写成结论。

## 一、D0 schema 复核结论表（调研报告 §六.5 清单收敛）

| #   | 复核点                       | 结论                                                                                                                                                                                                                                                                                                                                                                          | 证据来源                                                                   |
| --- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| ①   | NIL 报的 nilReason 选词      | 2.1 时代官方 NIL 样例用 `om:result nilReason="missing"`（裸词）；nilReason 全 URI 形态（`http://codes.wmo.int/common/nil/*`）为 2023-1 样例主流。2023-1 结构下 NIL ＝ `observation` 元素 xsi:nil——**2023-1 版官方 NIL 等价对未取得**（translation 仓 Amd79-80-2023 目录无 NIL 样例），选词按「词未识别即 info 出声、语义按无观测收」处理，两侧语义均落 IR `nil:true` 最小形态 | Amd77-2016/metar-NIL.xml 原文；2023-1 各样例 nilReason 统计                |
| ②   | RVR 趋势位 N/U/D             | **有编码**：`AerodromeRunwayVisualRange@pastTendency`（UPWARD/DOWNWARD/NO_CHANGE/MISSING_VALUE）。ZSPD 官方对四条 RVR 全带该属性（P2000 组=MISSING_VALUE、0600N=NO_CHANGE、1600U/0900U=UPWARD）——调研报告「疑似恒省略」结论**证伪**。映射：UPWARD→up、DOWNWARD→down、NO_CHANGE→no-change、MISSING_VALUE/缺省→无趋势位                                                         | metarSpeci.xsd L521-531；ZSPD-290000Z.xml 原文                             |
| ③   | VRB 风向不定                 | 观测风布尔属性 `variableWindDirection`。**带变化扇区（TAC 080V140）的官方译文也置 true 且保留 meanWindDirection 与两侧极值**（LTCN 样例）；VRB 本体＝true 且无 meanWindDirection（FALE 样例）。IR 落位：`variable` 只承载 VRB（无均值方向），扇区走 `variation`（extremeCounterClockwise→min、extremeClockwise→max）——与 TAC 侧 IR 完全同构                                   | metarSpeci.xsd L762-766；LTCN/FALE 官方对                                  |
| ④   | SKC/NSC/NCD/CLR 四码         | 无云家族以 `cloud` 元素 nilReason 承载：NSC/SKC→`nothingOfOperationalSignificance`、NCD/CLR→`notDetectedByAutoSystem`——四码收敛为二词（SKC/NSC 不可辨、CLR/NCD 不可辨，与调研报告难点 4 判断一致）。XML→IR 取代表电码 NSC/NCD + info 告警声明细辨不可还原                                                                                                                     | metarSpeci.xsd L303-316 注释；EFHK（NSC）官方对                            |
| ⑤   | 云高量纲                     | `base` 元素 uom="m" 或 "[ft_i]"，**ZSPD 官方对 BKN002→base=200 uom="[ft_i]"——调研报告的量纲巧合疑点解除**（官方译文直用英尺原值，非米）。米制输入按 ×3.28084 折英尺入 IR（IR 云高以英尺计）                                                                                                                                                                                   | ZSPD-290000Z.xml 原文；common.xsd CloudLayerType                           |
| ⑥   | ZSPD 样例孤立时间值 10:00:00 | **原文不存在该值**——趋势段 phenomenonTime 是 `gml:TimePeriod`（beginPosition indeterminatePosition="after" 00:00:00 → endPosition 01:30:00，即 TL0130）。调研报告该疑点系骨架误读                                                                                                                                                                                             | ZSPD-290000Z.xml 原文全文核对（WebFetch 官方 blob 页 + API base64 双通道） |
| ⑦   | 风速/气压 uom 精确串         | 风：`m/s` / `[kn_i]`（/km/h 保留）；QNH：**仅 hPa**（XSD 明文 "shall be given in hectoPascals"）——美制 A 组（inHg）官方译文折算 hPa（CYEK A2962→1003.0、BGTL A3033→1027.1、VTUO A2987→1011），是两通道固有数值分歧点；方向 `deg`、温度 `Cel`、能见度/RVR `m`、云底/VV `m` 或 `[ft_i]`、跑道沉积深度 `mm`                                                                      | 各官方对实文 + XSD 文档段                                                  |
| ⑧   | CAVOK 布尔元素名与位置       | **属性**（非子元素）：观测上必填 `cloudAndVisibilityOK`（趋势上可选）。true 时 vis/weather/cloud 元素不出现（让位语义与 IR 同构）；与三组并存即矛盾——出声 cross-check-conflict 后照旧让位                                                                                                                                                                                     | metarSpeci.xsd L368-378；EKCH 官方对                                       |

复核过程中的额外发现（超出原清单）：

- **跑道状态组在 IWXXM 2023-1 有专门建模**（`AerodromeRunwayState`：depositType/contamination/depthOfDeposit/estimatedSurfaceFrictionOrBrakingAction + allRunways/cleared/fromPreviousReport 属性，电码表走 bufr4 0-20-086/087/089 URI）——调研报告难点 2「IWXXM 无对应元素」结论**证伪**，v0.3 已实现该组双向同构。
- **天气强度编码在 4678 URI 路径内**（`codes.wmo.int/306/4678/+TSRA`、`-SN`）——URI 尾段与 TAC w'w' token 同构，XML→IR 直接复用 TAC 侧天气切解器（groups.ts parseWeatherBody）。
- **NOSIG**＝`trendForecast xsi:nil` + `noSignificantChange`；**趋势内 NSW**＝趋势 `weather` nil `nothingOfOperationalSignificance`（LTCN 官方对实证）。
- **observationTime 通常是 xlink:href 文档内引用**（多指向 issueTime 的同一 TimeInstant 定义）——解析器需先建 gml:id 索引再解引用；URMT 的 runwayState 同样以 xlink 复用 RVR 段定义的 RunwayDirection。
- **趋势时窗**：`timeIndicator` AT/UNTIL/FROM ↔ TAC AT/TL/FM（XSD 明文等价关系）；时刻值在 phenomenonTime 的 TimeInstant（AT）或 TimePeriod 端点（TL 取 end、FM 取 begin）。

## 二、难点映射决策（调研报告 §五 14 条的落位）

| 难点                  | v0.3 落位                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 RVR 趋势丢失        | 证伪——pastTendency 在位（见 D0 ②），双向无损                                                                                                     |
| 2 跑道状态组黑洞      | 证伪——有专门建模，已实现（EKCH/EETN/UAAA/UBBB/EKRK/ESMS/URMT/USRR/USTR 官方对全绿）                                                              |
| 3 RMK 国家惯例组      | 维持：IWXXM 国际模型无 RMK 位；XML 侧 remarks 恒空，extension 块按未知元素跳过出声                                                               |
| 4 SKC 四码收敛        | 按 nilReason 二词映射代表电码 + info 告警（见 D0 ④）                                                                                             |
| 5 风 VRB/静风         | variable 语义对齐（见 D0 ③）；静风＝方向 0+速度 0，与 TAC 同构                                                                                   |
| 6 CAVOK 布尔          | cloudAndVisibilityOK（见 D0 ⑧）                                                                                                                  |
| 7 天气压缩词          | URI 尾段复用 TAC 切解器（见额外发现）；多对一形态（SHRASN）按 TAC 同一判式切解                                                                   |
| 8 9999 边界           | XML「10000+ABOVE」向 IR/TAC 上限电码 9999 收敛、「50+BELOW」向下限 0000（值 0）收敛——两通道等价的根基；非标准阈值保留原值 + beyond 标注          |
| 9 NIL 报              | observation xsi:nil/缺席 → IR nil:true 最小形态（见 D0 ①）                                                                                       |
| 10 nilReason 词汇对齐 | 全 URI 词尾提取；已识别词静默落位，未识别词 info 出声不静默（选词即语义，语义不明须可观测）                                                      |
| 11 站点元数据         | XML→IR 方向无需注入（ARP/标高等不入 IR，快照原样在 raw）；IR→XML 二期需外部目录（维持调研结论）                                                  |
| 12 日历上下文         | XML 绝对时刻折 UTC ddHHMM 填 IR（年月丢弃——与 TAC 对称的损失，跨月语境归消费方）                                                                 |
| 13 版本容错           | 命名空间探测（前缀任意，含缺省）；支持版本 2023-1/2025-2（§五.2）无告警，其余 invalid-format(info) + 尽力解析；ECCC 3.0 + collect 包裹实测可探测 |
| 14 趋势时窗           | timeIndicator ↔ AT/TL/FM 等价（见额外发现）；trend.raw 为结构化重建串（非 TAC 原文，文件头已声明口径）                                           |

**R88/R99 特殊跑道号**：XML 以 allRunways / fromPreviousReport 布尔承载——按 IR 自身的电码词汇回填 88/99（ESMS/EKRK 官方对实证），保持两通道同构。

**两通道固有分歧站**（官方对的 TAC 与 XML 本身数值不同，非解析器缺陷，快照锁定）：
CYEK（M1/4SM↔400m、A2962↔1003hPa）、BGTL / VTUO（A 组 inHg↔hPa）、CWFD（译文补充 rvr nil(missing) 元素，TAC 原文无 RVR 组——组省略与显式缺测之别）。

## 三、ECCC 真实流探测记录（D3）

- 服务可用性：`dd.weather.gc.ca` 匿名可直连（curl 即取，无鉴权）。
- 目录结构：`/today/aviation/iwxxm/` 下仅 `taf/`、`schema/`、`code-ca/`、`doc/` 四目录——**无 METAR IWXXM**（ECCC 现只把 TAF 转 IWXXM 发布，v2.8 文档佐证）。`gen:iwxxm` 脚本每次运行都重新探测并记录结果，ECCC 上线 METAR IWXXM 后可接真实流。
- schema 目录：ECCC 国家扩展 XSD（metar-speci-ca/taf-ca/airmet-ca/common-ca/iwxxm-ca，扩展自 iwxxm 3.0）——**D0 复核的关键入口**（正是它的 import 头给出官方 schema 服务路径）。
- 真实流样本形态：根元素 `collect:MeteorologicalBulletin`（WMO collect 2014 包裹），内含多个 `iwxxm:TAF`（iwxxm 3.0 命名空间 + iwxxm-ca 3.0.0 扩展）；文件名 `A_LTCNxxCWAO{DDHHMM}[_AAA]_C_CWAO_{YYYYMMDDHHMMSS}.xml`，按小时分目录（`taf/cwao/{HH}/`）。样本 2 份入库 `corpus/iwxxm/eccc/`（版本容错 + 范围外明确拒绝的回归锁）。
- 替代源探测结论：WIS2 体系（DWD GDC / 美国·韩国·比利时 wis2box）以 MQTT 为主，HTTP 缓存（oapi messages）均未含 IWXXM METAR；aviationweather.gov 无 IWXXM 端点（404，当时探测的是 dataserver 路径——**同日后继实测更正：其数据 API `api/data/metar?format=iwxxm` 提供 IWXXM，见 §五**）。首期结论「当前无免鉴权 HTTP 直连的公开 IWXXM METAR 流」已被 §五推翻，demo 数据面随之改走 AWC 实时流。

## 四、遗留项清单

（TAF 施工后状态——遗留项 1 已完结就地更新，见 §九。）

1. ~~**TAF IWXXM**~~ **已解决（2026-10-08 提前施工，原排二期——见 §九）**：parseIwxxm/tryParseIwxxm
   支持 TAF 根（直根与 collect 包裹）→ 与 TAC 侧 parseTaf 同一份 TafReport IR（core 契约零改动）；
   官方等价对 6 站 7 对双通道验收 + ECCC 真实流 6 公报全量过筛。剩余口子（PROB40 样本、午夜止窗
   样本、消费方接线）见 §九.5。
2. **iwxxm 2.1 / 2016-2018 OM 架构族**：站点与观测导航结构不同（om:OM_Observation 包裹、featureOfInterest/sams 采样特征），当前明确失败（missing-station + 版本提示）；若需支持，按版本分派导航器（observation 容器层的 om:result 下钻防御路径已预置，见 §五.3——但该族站名导航不同，实际仍会在 missing-station 层失败，未支持）。
3. **2023-1 官方 NIL 等价对未取得**（translation 仓无此类样例）——NIL 三态落位以 2.1 官方样例（选词实证）+ XSD 契约（observation nillable）为依据；取得后补双通道断言。**2025-2 侧 NIL 同样无样本**（AWC 实时流不含 NIL 报，41 站语料未覆盖——NIL 在 2025-2 下的形态未验证，解析逻辑按两版共用的 observation 缺席/xsi:nil 判据处理，XSD 两版均保留 nillable 契约）。**TAF 侧 NIL 官方对已取得**（Amd79-80-2023/taf DAOY：空载 baseForecast + nilReason missing，双通道全等验收，§九.4）。
4. **跑道状态 99 深度位语义**：TAC 表 1079 深度位 99＝跑道不可用（IR closed:true），XML 侧 depthOfDeposit 是毫米真值、runwayState nil(inapplicable) 才承载全关闭——99mm 真值与 99 电码的边界无官方样例，未硬判（SNOCLO 同构形态已按 nil(inapplicable) 落 closed）。**2025-2 注意：schema 已整体删除 runwayState/AerodromeRunwayState 建模（§五.2），该组仅 2023-1 侧存在；解析器对两版本统一按元素在位与否处理（2025-2 文档不出现该元素即无跑道状态组），2025-2 下跑道状态无样本可验。**（TAF XSD 从未载 runwayState，本条与 TAF 无涉——§九.1。）
5. ~~**IR→IWXXM 生成侧**~~ **已解决（2026-10-08 施工，见 §十）**：serializeIwxxm（iwxxm-emit.ts）
   接受 IwxxmReport（kind 判别）产出 IWXXM XML——METAR/SPECI 与 TAF 双侧、CNL/NIL 形态都能往返；
   「映射表即正向字典」兑现。合规达标层级如实：往返 + 结构断言 + Schematron 核心子集入 CI，
   XSD（xmllint + 官方全依赖树）施工时点双版本出口全绿（记档不入 CI），Schematron 全量
   （xslt2/需 Saxon）如实留官方工具链。
6. ~~真实流源~~ **已解决（2026-10-05 第二期）**：AWC 实时流接入（§五.1），gen:iwxxm 首选通道改为 awc-live；ECCC 仍仅 TAF（结论维持，探测照旧记录于产物 ecccProbe 字段）；WIS2 MQTT 未接（需引入 mqtt 依赖，无新增动作）。
7. **浏览器手工验收**：施工环境无浏览器，以 vite 双页构建（模块图零错）+ happy-dom 最小 DOM 断言（iwxxm-demo.test.ts）替代；owner 复验入口：`pnpm --filter metweave-examples dev` 后访问 `/iwxxm.html`。
8. **2025-2 侧样本未覆盖面**（AWC 转换器不输出，非时点问题）：RVR（TAC 在场也不转，KBOI 实证——2023-1 侧解析逻辑存在且经官方对验收，2025-2 侧未验证）、趋势组/NOSIG（EFHK/VIDP/RJAA 的 TAC 在场也不转，trendForecast 在 41 站中零出现）、跑道状态（§五.2 schema 删除）、风切变、海况、CAVOK 布尔（恒 false）、风向扇区（TAC 080V140 族不转，variableWindDirection 恒 false）、 NIL（见 3）。RVR 的 rvr 元素上限从 4 放开为 unbounded（§五.2）——2025-2 侧同样无样本验证。

## 五、AWC 实时流接入与 2025-2 版本支持（第二期施工，2026-10-05）

### 1. 真实流源发现记录

- **端点**：`https://aviationweather.gov/api/data/metar?ids=<逗号分隔站单>&format=iwxxm`——NOAA AWC（美国航空气象中心）官方数据 API，免鉴权、本机 curl 直连；含中国站（ZSPD/ZBAA/ZGGG/ZUUU 均取到）。
- **限制**：`ids=all` 不支持 `format=iwxxm`（返回空，HTTP 204）；单字母前缀（`ids=K`）不支持（400）；bbox 查询可用（raw 探测通道）。**无 CORS 头——浏览器不可直连，取数在 Node 侧**（与 TAF 线同一纪律）。
- **响应形态**：多站＝WMO collect 2014 `MeteorologicalBulletin` 包裹内多份 `iwxxm:METAR`/`iwxxm:SPECI`；单站＝裸根文档。每份报文头部内嵌源 TAC 注释（`<!--TAC: …-->`）——同报文 TAC 可直接对齐（语料 .tac 即取自此处）。
- **版本**：命名空间 `http://icao.int/iwxxm/2025-2`，schemaLocation 指 `schemas.wmo.int/iwxxm/2025-2RC1/iwxxm.xsd`（版本属性 3.2.0RC1）；转换中心 KKCI（NWS/AWC），报头带 `translationCentre*`/`automatedStation`/`permissibleUsage="NON-OPERATIONAL"`。
- **站坐标口径**：ARP `gml:pos` 输出**经度在前**（KSEA `-122.31442 47.44467`、ZSPD `121.8 31.146`，30 站普查一致；axisLabels 仍标 "Lat Long"，以值为准）——与 2023-1 官方等价对的纬度在前相反；gen 脚本 AWC 通道换序并做范围校验。

### 2. 2025-2 与 2023-1 结构差异结论（XSD 原文 diff + 双方样本实证）

对比基准：schemas.wmo.int 的 `2023-1/metarSpeci.xsd`（版本 3.1.0）vs `2025-2RC1/metarSpeci.xsd`（版本 3.2.0RC1），common.xsd 同比；样本＝官方等价对（2023-1）与 AWC 实时流（2025-2）。

- **观测容器：两版同构——`iwxxm:observation` 直达 `iwxxm:MeteorologicalAerodromeObservation`**（两版 XSD 均定义 observation 为 MeteorologicalAerodromeObservationPropertyType；官方对与 AWC 流双方样本一致；issueTime/aerodrome/observationTime/trendForecast 挂根的骨架两版全同）。施工前一度以为「2023-1 有 om:OM_Observation 包装、2025-2 才砍掉」——**证伪**：om 包装属 2.1/2016-2018 旧架构族（该族站名导航也不同，见遗留项 2），2023-1 起就已直达。
- **真差异 ①（删除）**：2025-2 **整体删除跑道状态建模**——`runwayState` 元素与 `AerodromeRunwayState`/`RunwayDeposits`/`RunwayContamination`/`RunwayFrictionCoefficient` 类型族全数从 metarSpeci.xsd 与 common.xsd 移除（2023-1 侧保留）。
- **真差异 ②（放宽）**：`rvr` maxOccurs 4 → unbounded。
- **真差异 ③（文档性）**：气温/露点文档增「应按摄氏度给到十分位」的建议（AWC 流美制站实测带十分位——取 RMK T 组精度）。
- 其余（CloudLayer/visibility/天气 4678 URI/RVR 结构/趋势建模）两版逐元素相同。

### 3. 版本分派实现说明（packages/parser/src/iwxxm.ts）

- **支持版本集合** `SUPPORTED_VERSIONS = {2023-1, 2025-2}`：按文档内 xmlns 声明提取 IWXXM 家族 URI 尾段识别；**识别版本零告警**，未知版本（含 2.1/3.0/ECCC 3.0 扩展）维持 invalid-format(info) + 尽力解析。版本语义只影响告警面与错误提示文案，字段解析零分叉。
- **observation 容器抽象层** `observationBodyOf()`：版本间结构差异的唯一分叉点——直达子元素（两版共用主路径）＋ `om:OM_Observation→om:result` 下钻防御路径（旧架构族结构演化预留，无真实样本，单测以合成样锁行为）。其余字段解析（风/能见度/RVR/天气/云/温露/气压/趋势/跑道状态/风切变）两版本共用同一套，**无整文件复制分叉**。
- **2025-2 特有落位**（AWC 样本实证，详见 corpus/iwxxm/awc/README.md）：OVX 云量层＝VV 形态→IR vertical-visibility（与 2023-1 官方译文用 verticalVisibility 元素的落位一致）；空 AerodromeCloud 容器（AWC 的 CLR/NSC/CAVOK 输出形态）→细辨不可还原按组省略+info 出声；runwayState 在 2025-2 文档按元素缺席自然不出现（解析器无版本硬编码）。

### 4. AWC 转换口径（与 TAC 原文的固有分歧——非解析器缺陷，快照锁定）

- **能见度统一经英里（SM）折算再回米**：9999→9994、5000→5005、4000→4007、P6SM→9994、10SM→16093、1/2SM→805——因此 **AWC 通道对任何 TAC 不可能双通道数值全等**，语料与 demo 对照区均按此口径处理（语料单通道快照；demo 对照区改用 2023-1 官方等价对静态样例）。
- 气压恒 hPa（A 组 inHg 折算，A3008→1018.7）；风速恒 `[kn_i]`（MPS 组折 kt，26004MPS→8kt）；美制站气温取 RMK T 组十分位（16/12→15.6/12.2）；RMK 国家惯例入 `iwxxm-us` 扩展块（解析器按已知键静默跳过，与 2023-1 侧 extension 同纪律）。
- 转换器有损不转：趋势组/NOSIG、RVR、风向扇区（080V140）、VRB（VRB02KT→direction 0+variable false）、CAVOK 布尔（转成 vis 9994+空云容器）、CLR/NSC（转成空云容器）、VV（转成 OVX 层——本解析器已同构落位）。

### 5. ECCC 结论维持（仅 TAF）

第二期施工后重探：`dd.weather.gc.ca/today/aviation/iwxxm/` 目录仍仅 `taf/`（schema/code-ca/doc 为辅助目录）——ECCC 现只把 TAF 转 IWXXM 发布，结论维持。gen 脚本每次运行照旧探测并记录于产物 `ecccProbe` 字段；实时流首选已让位 AWC（免鉴权、含中国站、METAR 全量）。

## 六、解析×渲染联动正解（第三期施工，2026-10-05）

owner 使用 demo 后裁决「直接处理正解」：IWXXM 卡片旁的 XML 报文太长，解析与报文的联动看不出来。
TAC 侧本有联动（IR 每值带 span＝TAC 词位，renderCard 以 data-hint 同串为联动键做卡片字段↔原文
高亮双向点亮）——本期把同一套联动延伸到 IWXXM 源。

### 1. span 定位方案选型（①元素位置信息直取，查证后定）

- **查证**：fast-xml-parser 5.11.2（仓内锁定版）提供 `X2jOptions.captureMetaData`——开启后每个
  元素节点经 `XMLParser.getMetaDataSymbol()` 符号键携带 `XMLMetaData{startIndex,endIndex}`，
  即元素全体（开标签至闭合标签，自闭合含 `/>`）在输入流中的字符区间。实测（合成样 + 三方语料）：
  区间索引相对输入原文逐位成立、数组化元素（isArray）各自携带、含 `<?xml?>` 序言/注释/collect
  包裹的文档同样成立。故走**方案①**：元素节点直取元数据，无检索歧义。
- **方案②（检索定位）仅作兜底**：无属性纯文本子元素（`<iwxxm:timeIndicator>UNTIL</…>` 这类）
  被解析器折叠成 string，元数据随之丢失——对该形态在**宿主元素区间内**按「标签名（命名空间
  前缀任意）+ 文本内容（最小实体解码后比对）」检索。消歧规则：同名同文本在宿主内多处出现按
  出现序数（缺省首个）；同名异文本不构成歧义（文本比对即锚定）；检索越出宿主区间即止（其他
  父级下的同名元素不误取）。对抗单测覆盖：同值文本跨父级（两层同 `<base>200</base>`）、同父级
  重复键（fast-xml-parser 自动数组化→值不可辨按缺测收、层区间照填）、属性同名跨元素
  （观测/趋势各带 `cloudAndVisibilityOK`）。
- **兜底实际命中面**：`timeIndicator`（趋势时段词）一处——IWXXM 值元素带 uom/xlink/nilReason
  属性时恒为对象（元数据在），实测命中面极小但机制必须在（对抗样例锁行为）。

### 2. span 语义注释处理（注释级澄清，零类型改动）

core `ir.ts` 的 Span 注释原文是「half-open UTF-16 code-unit range into `raw`」——**本就未限定
TAC 词位**（raw 是通道中性的「原文」概念），故填充 XML 区间不属契约语义变更，不需要停工。为杜绝
后来者误读，按预案在 Span 注释追加一句澄清：raw 随解析通道而异（TAC＝字符电码词位 /
IWXXM＝XML 元素或属性区间），类型结构、字段名、字段集合零改动。`MetarReport.raw` 注释
（「原文保真」）本就通道中性，不动。`iwxxm.ts` 文件头原「XML 无词位概念，IR 全部 span 省略」
一段照实施改写为 span 口径说明；`iwxxm-corpus.test.ts` 头注的排除理由同步改写
（span 仍排除——两通道 span 各索引本通道 raw，数值面不同源；理由不再是「XML 无词位」）。

### 3. span 填充面与填不到清单

填充位（值字段的源载体区间）：三态组 Observed（组级＝组元素，数组组＝外包络+逐元素）、风
speed/gust/variation（扇区＝两端 extreme 元素外包络）、能见度值与 minimum（＝两元素外包络）、
RVR 逐条、天气/近期天气逐条、云层逐层（CloudLayer 元素）与 heightFt（base 元素）、无云族 clear
（nil cloud 元素）、温/露/气压、跑道状态逐条、风切变、趋势段（trendForecast 元素；NOSIG＝nil
元素）与时段词（timeIndicator 至 phenomenonTime 包络）、趋势内要素同观测侧同款、cavokSpan＝
`cloudAndVisibilityOK="true"` 属性出现区间、缺测组（Observed missing）＝nil 元素区间；warnings
中 nilReason 未识别类告警带源区间（RAW bad 高亮用）。

**填不到/无位字段（如实清单）**：`station`/`time`/`flags`（IR 无对应 span 字段——站名/日时组/
AUTO/COR 位是纯值或布尔，无 span 位可填）；`wind.direction`/`variable`（纯数值/布尔，无位）；
RVR 的 runway 设计器（组内字符串，无位）；云 amount/convective（无位，靠层区间覆盖）；
跑道状态 deposit/coverage/depth/friction（无位，靠条区间覆盖）；天气 intensity/descriptor/
phenomena（无位，靠组区间覆盖）；`trend.raw`（重建串非原文——span 才是源锚点，已在 IR 注释
声明口径）。布尔值类中 cavok 有位已填（属性区间）。

### 4. render/linkage 扩展点（原状→改后）

- **联动机制原状**：renderCard 以「同一提示串」为联动键——主表字段 span 与 RAW 高亮段都挂
  `data-hint`（attachHint），mouseover/focusin 委托把同键节点一起点亮（mw-link）+ 浮签显示
  RAW 侧电码（textContent）。RAW 视图按 IR span 切 raw 渲染高亮段——**本就 span 驱动、格式
  不敏感**，IWXXM 填 span 后自动工作。`linkage.ts` 原职责是卡内浮签/气泡几何与 aria 生命周期，
  与源联动无关。
- **改后（三处，公共 API 签名零改动，新增可选导出一枚）**：
  ① RAW 渲染器支持**嵌套区间**——XML 元素区间天然嵌套（风组元素含扇区两端元素），旧扁平渲染
  会静默丢弃内层；改为区间树递归发射（外层 span 内嵌内层 span、各挂各的提示），对非嵌套输入
  与旧实现逐节点等价（TAC 行为锁 137 项既有测试全绿实证）。
  ② **原码显示面短码守卫**（`codeOf`）——悬停提示前缀/解码气泡行/告警行遇 XML 片段（切片以
  `<` 开头，TAC token 永不含）改用 IR 重建短码（weatherCodeOf/cloudCodeOf/rvrTextOf 等）；
  「显示短码、高亮原文」两不相误；浮签超 80 字符截断。
  ③ `linkage.ts` 新增 `revealWithin(limit, target)`（可选导出）——悬停任一侧把**对侧**同组
  节点滚进卡内视野（只动卡内滚动容器，不碰页面滚动；happy-dom 无布局自然 no-op；TAC 原文短、
  已可见时零动作）。setLinked 挂接：悬停主表字段→XML 区间滚入视野，悬停 XML 段→卡片字段行滚入。

### 5. 对照区三样本核验清单（ZSPD/EKCH/EETN 官方等价对，逐份过）

机器断言（iwxxm-demo.test.ts 锁入测试面）+ 切片人工核对（临时脚本输出逐位比对）：

| 样本 | 核验点                                                                                                                                                                                                                                                                                                                                                                   | 结果         |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| ZSPD | 温 13/露 13/压 Q1018 各指本元素；风组 surfaceWind 元素与风速 meanWindSpeed 元素；能见度组+值；四条 RVR（17L P2000/16R 0600N/17R 1600U/16L 0900U）逐条各指本 rvr 元素、趋势位在元素属性内；天气 FG 指 presentWeather 元素（4678 URI 全体）；云层 BKN002 指 CloudLayer；趋势 BECMG 指 trendForecast 元素、时段 TL0130 指 phenomenonTime…UNTIL 包络；主表 11 键 ↔ RAW 11 段 | 全对，缺环 0 |
| EKCH | 温 1/露 M03/压 Q1005；风组+风速+**阵风 28**（windGustSpeed 元素）；CAVOK＝`cloudAndVisibilityOK="true"` 属性区间（非元素）；三条跑道状态（04L/04R/12，depthOfDeposit/friction 电码表 URI 在条区间内）逐条各指本 runwayState 元素；NOSIG＝nil trendForecast 元素；主表 7 键 ↔ RAW 8 段（多出的 1 段是 CAVOK 属性段，徽章在卡头非 dd 行）                                  | 全对，缺环 0 |
| EETN | 温 M05/露 M07/压 Q1015；风组+风速；能见度 10000+ABOVE→9999 的组与值区间；云层 FEW019；跑道状态 08（depthOfDeposit nil + friction 95 在条区间内）；NOSIG nil 元素；主表 7 键 ↔ RAW 7 段                                                                                                                                                                                   | 全对，缺环 0 |

### 6. 基线漂移与测试面

- **AWC 9 站内联快照重刷**（iwxxm-awc-corpus.test.ts）：快照含 span 字段后逐站补入区间值
  （冻结语料的确定性整数）——**预期漂移非破坏**，快照从此兼作 span 基线（定位逻辑漂移即红）。
  逐站注释保留。
- **双通道断言排除集（raw/span/warnings）维持不变**——排除理由文案更新（span 仍排除：两通道
  各索引本通道 raw），排除集合本身零改动；30 站 deep-equal 照旧全绿。
- 新增测试面：iwxxm.test.ts「span 源定位」组（主路径切片逐位断言 + 三组对抗样例 + collect 包裹
  - 紧凑模式）；iwxxm-corpus.test.ts「span 不变量」（34 站全量：区间有效、组级切片元素形态）；
    card.test.ts「IWXXM 通道」组（嵌套 RAW 渲染/短码守卫/浮签截断/联动点亮）；iwxxm-demo.test.ts
    三样本联动闭环核验。全仓 551 测全绿。
- 附带修正（施工中发现）：cloudsOf 层存在性判据由「对象子元素在位」改为「键在位」——无属性
  纯文本 base（坍缩 string）与重复键（数组化）形态不再导致整层蒸发，按缺测位收（与「元素在位」
  注释语义对齐，对抗样例锁行为）。

### 7. 第三期遗留

- **警告面 span 部分填充**：仅 nilReason 未识别类（warnUnknownNil 调用点）带区间；其余告警
  （空云容器/未知元素/OVX 缺底等）暂无 span——主表联动不依赖它们，按需后补。
- **trend.raw 仍是重建串**：趋势段解码气泡显示重建 TAC 形态而非 XML 切片（trendDecodeRows
  以 tr.raw 为原码）——联动高亮已指 XML 源（tr.span），气泡口径维持首期声明。
- **无属性纯文本值元素的兜底检索未覆盖注释诱饵**：宿主区间内若嵌有含假同名元素的 XML 注释
  （AWC 的 `<!--TAC: …-->` 注释不含 XML 标签，实测语料无此形态），检索可能误中——序数消歧可
  指定非零序数绕开，暂不为此加注释剥离（无真实样本，不预做）。

## 七、报文卡片内 TAC⇄IWXXM 双编码原文切换（第四期施工，2026-10-05）

owner 需求原话归纳：报文卡片里，若该观测有 IWXXM 数据，原文区可在 TAC 报文与 IWXXM 报文之间
做展示切换——地图弹窗卡（AWC IWXXM 流数据）的 RAW 区做成双编码视图切换，不必像对照区那样两卡
并排；**对照区维持并排现状不动**（同屏比对是它的价值）。

### 1. render 包：`altRaws` 选项（公共 API 零破坏，新增可选选项/导出）

- **选项形态**：`RenderCardOptions` 新增可选 `altRaws`——数组（`RenderCardAltRaw` 表项的
  只读列表）或函数（按本卡 IR 现取同前述列表），表项 `{ label, report }`（label 由调用方给——
  它描述的是调用方的数据来源语义，不入本库 locale 表）；函数形态按卡现取（调用方可在函数内从
  本卡 `report.raw` 抽另一编码再解析）。仅在 `raw: true` 时生效；空数组/缺席＝单视图现状
  （innerHTML 逐字节一致，测试锁）。
- **主 tab 标签按编码形态自动**：raw 以 `<` 开头→「IWXXM（XML）」、其余→「TAC（字符电码）」，
  随 locale（en 同款英文文案，入 LOCALE 表与术语册——tab 文案是库的显示面）。
- **RAW 渲染抽为卡内内部函数 `renderRawBox(target)`**：原 `options.raw` 段的区间收集/排序/嵌套
  发射整体按报告入参化（提示语构建函数本就按组入参不闭包主表 report；温/露与 QNH 提示语抽出
  `tempDewHintOf/qnhHintOf` 按值视图入参，主表与 RAW 两侧同构单一函数）；本卡视图与各 altRaw
  视图走同一实现，零复制粘贴。
- **tab 交互卡内自包含**：tablist（role/aria-label）+ tab 按钮（aria-selected/roving
  tabindex/aria-controls↔panel id↔aria-labelledby，模块级发号保多卡不撞）；click 与按钮原生
  Enter/Space 切换、ArrowLeft/Right/Home/End 移动激活；切走面板 `hidden` 隐藏但保留 DOM。
  监听挂 tablist 局部；切换时收气泡清联动（气泡/浮签定位在旧面板上会悬空）。
- **联动守卫（setLinked 一处）**：命中节点在隐藏 tab 面板（`.mw-raw-panel[hidden]`）内时不进
  电码浮签与对侧滚动揭示——显示面恒为当前可见编码（浮签不拼接两套编码文本、揭示不滚向不可见
  面板）；`data-hint` 同串点亮天然跨视图（同观测两通道提示串一致），当前可见 tab 内联动如常。
  宿主收起整个原文区（面板外层 hidden）不受此守卫影响——悬停主表字段浮签照旧出电码。
- **零回归面**：无 altRaws 时 DOM 与既有完全一致；render 包 141 测（含新增 8 例 altRaws 组）。

### 2. demo 层：AWC 内嵌源 TAC 抽取（复用 gen 的抽取知识）

- `examples/src/iwxxm-alt-raw.ts`：`tacOfIwxxmRaw`（判式与 `scripts/gen-iwxxm.mjs` 的
  `grab(doc, /<!--TAC: ([^>]*?)\s*-->/)` 同式同源——corpus/iwxxm/awc 的 .tac 语料即按此抽取，
  测试逐站断言两者相等）＋ `altRawsOfIwxxm`（抽 TAC→`parse` 得 TAC IR→单表项
  `{ label: "TAC（源电码）", report }`）。
- **降级路径**：无内嵌注释（2023-1 官方等对语料/非 AWC 源）或抽出后 TAC 解析失败（畸形源）
  →返回空数组＝无 tab，原文区维持单 XML 视图——「有 IWXXM 数据的才可切」的反向同样成立。
- 接线：`iwxxm-main.ts` 的 `addMetarLayer` card 选项传函数形态（leaflet 透传链路核实：
  `AddMetarLayerOptions.card: Parameters<typeof renderCard>[1]`，`{...options.card}` 整体
  spread 进弹窗内 `renderCard`——零 leaflet 改动）；对照区两卡并排维持不动。
- **与宿主收起/展开共存**（两层操作正交）：收起的是整个原文区、tab 切的是区内编码视图。
  tab 组包裹为 `.mw-raw-group`（tablist+全部面板），宿主点击 `.mw-raw-title` 的委托按
  nextElementSibling 二择收起（`.mw-raw` 单视图 / `.mw-raw-group` tab 组）。

### 3. 测试面与遗留

- card.test.ts 新增「RAW 双编码视图」组 8 例：tab 组渲染与 aria 结构、alt 面板按其 report 的
  span 渲染（词组可点读非纯文本）、函数形态收到本卡 IR、click/键盘切换与面板 DOM 保留、联动
  可见面板单侧生效（浮签不混隐藏面板）、空数组 innerHTML 逐字节零回归、多卡 id 不撞＋en 文案、
  `raw:false` 不生效。iwxxm-demo.test.ts 新增数据流组 3 例（corpus/iwxxm/awc 冻结语料，不依赖
  网络）：全站抽取与冻结 .tac 逐站相等、官方对降级无 tab、AWC 样本完整链（抽 TAC→双 tab→切换
  后 TAC 原文逐字保真）。
- 遗留：altRaws 表项的 label 语言由调用方自理（本库不代翻）；tab 面板内气泡（解码说明）查键
  是全卡共享注册表——备选编码的组若与主表提示串不一致则气泡回退纯提示文案（当前 AWC 源 TAC
  与 XML 值面一致，不触发；异构来源接入时按需为 alt 视图单独注册解码表）。

## 八、主示例页弹窗接 AWC IWXXM 备选视图（第五期施工，2026-10-05）

owner 需求：「在主示例页（index.html）点开报文卡片后能看到 TAC 和 IWXXM 两种格式的 tab 切换展示」。
该页数据管道是 IEM TAC 流（getMetarReports），弹窗卡主视图即 TAC 电码——与第四期（/iwxxm.html，
主视图 IWXXM、备选 TAC）方向相反，同一 altRaws 选项的另一侧消费。

### 1. vite 代理与预取时序

- **`/aw-metar` 代理**（examples/vite.config.ts）：AWC `api/data/metar?format=iwxxm` 端点无 CORS 头
  （第五节实证），浏览器不可直连——dev 环境走 vite server.proxy（`/aw-metar` →
  `https://aviationweather.gov/api/data/metar`，changeOrigin），与既有 `/aw-taf`、`/ogimet-taf` 同式
  同纪律。静态部署（GitHub Pages）无代理：预取自然失败、弹窗无 IWXXM tab（静默降级不弹错误），
  其余功能不受影响。
- **预取而非现拉**：renderCard 产静态 DOM、altRaws 函数形态在建卡时同步求值——按站异步 fetch 不能
  在弹窗渲染时现拉，须先落内存 Map 后闭包同步查（`examples/src/iwxxm-prefetch.ts`）。
- **点火时序的一处修正**：施工案原写「IEM 实况解析完成、实况层上图后预取」，但弹窗内容在
  addMetarLayer 建层时一次性渲染，后到的备选数据进不了已建弹窗（只能等时区切换/模式回切重建层）。
  故预取与 IEM 整网拉取**并行点火**（同为后台静默、不阻塞主流程）——AWC 批量单请求秒级返回、
  IEM 整网通常 10–40 秒，正常时序备选视图先于实况层就位；极端时序（AWC 慢于 IEM）下首批弹窗无
  tab，属自然降级口径。Map 用活引用原地填充（clear+set）：重建实况层时 altRaws 闭包现查即得。

### 2. 管线实现（iwxxm-prefetch.ts）

- **单请求批量**：39 站一单 `ids=<逗号站单>&format=iwxxm&hours=3`（无并发问题；`ids=all` 不支持
  iwxxm 格式——第二节实证）。重试 ×3（顺序退避 500ms/1s）、单次超时 60s，与 gen-iwxxm 取数纪律
  同款；穷尽后 throw（模块不吞错），静默降级（console 一条 info、不弹 UI 错误）由 main.ts 接线层定。
- **拆分**：多站响应为 WMO collect 2014 包裹——判式与 gen-iwxxm 的 splitReports 同源
  （`<iwxxm:(METAR|SPECI)…></iwxxm:\1>` 非贪婪配对，无视包裹层级），逐份 parseIwxxm 入
  `Map<station, MetarReport>`。
- **窗内择新**：`hours=3` 同站返回多时次拼接（实测中国站 0700Z–0900Z 半点序列都在），按文档内
  首个 `gml:timePosition`（ISO-8601 UTC，字典序即时间序）取各站最新——不用 IR 的 ddHHMM（无年月
  位，跨月窗会错序），不依赖响应顺序。
- **SPECI 不入表**：SPECI 是两次定时观测之间的特殊观测，与卡片主视图（例行 METAR）非同一观测，
  时次再新也不入 Map（否则制造错位）。
- **逐份容错**：站码缺失（locationIndicatorICAO 剥不出）或单份解析失败（非目标产品族/畸形文档）
  跳过，不拖垮整批——该站无备选视图＝自然降级；失败的新时次不顶掉已入表的旧时次。

### 3. 弹窗接线与 L99 预览卡的处置

- main.ts 两处 `addMetarLayer`（初建 + ensureMetarLayer 重建）的 card 选项均传
  `altRaws: altRawsAwc`——查 Map 有本站则单表项 `{ label: "IWXXM（AWC）", report }`，无则空数组＝
  无 tab（预取未到/失败/该站缺数）。TAF 预报层不接（TAF 侧 IWXXM 解析不在 v0.3 范围）。
- **L99 站点列表直调 renderCard 处不接**：该处是无底图 key 时的预览卡（mountPreviewCards），数据源
  是两份**本地静态样例**（时次冻结的旧报文，页面明确标注「本地静态演示，非实况」「本地解析、零请求」）。
  预取管线只覆盖 IEM 实况站单；给静态预览卡挂实时 AWC 数据既破坏其零请求定位、又造出新旧时次
  硬错位（样例 120330Z vs AWC 当日），不接。
- **时次错位口径**（实测）：AWC 与 IEM 是两条独立管道，同站最新时次可能差半点到一小时（中国站
  半点加发，两管道收录节奏不同步）。处理：altRaws 的 label 已标「AWC」来源，卡片时间行以主视图
  （IEM TAC）为准，不做事强行对齐——tab 内容按「AWC 侧该站最新一份 IWXXM」如实展示。

### 4. 测试与验收

- `examples/src/iwxxm-prefetch.test.ts` 12 例（零网络，fetch 全 mock；响应语料取 corpus/iwxxm/awc
  冻结副本拼 collect 包裹、与实测响应同构）：URL 模板（与 vite 代理键对齐——漂移即红）×2、批量拆分
  与 Map 产出（单请求/raw 逐字保真/time）、同站多时次取最新（非 last-wins）、SPECI 不入表、坏行
  跳过不拖垮整批、网络失败/HTTP 非 ok/超时中止均重试 ×3 后抛，altRaws 查表两态（有站单表项+引用
  同一/无站空数组）+活引用契约（后填充后现查得 tab）。
- 浏览器手工验收（owner 刷新 dev 页）：点开实况弹窗→原文区 tab 组（默认 TAC 电码 tab +「IWXXM
  （AWC）」tab）；无代理/预取失败场景＝无 tab 单视图，console 各一条 info。

## 九、TAF IWXXM 解析（v0.3 遗留项 1 提前施工，2026-10-08）

owner 裁决二期提前施工：parseIwxxm/tryParseIwxxm 支持 TAF 根（直根与 collect 包裹）→
与 TAC 侧 parseTaf **同一份 TafReport IR**（core 契约零改动——TafReport/TafChangeGroup/
TafValidityGroup/TafTemperatureGroup 既有类型原样复用，未加一字段）。parseIwxxm 返回类型放宽为
`IwxxmReport = MetarReport | TafReport`（kind 位即判别器）；既有消费方（examples 实况层/对照区、
render 测试）以 kind 收窄机械适配，AWC 数据面行为零变化。

### 1. 版本与 XSD diff 结论（schemas.wmo.int 直取实证，施工当日抓取）

- **taf.xsd 三版逐行同构**：`3.0.0` 与 `2023-1`（版本串 3.0.1）与 `2025-2RC1` 304 行全同
  （忽略 CRLF 行尾差异）——2025-2 与 2023-1 仅差目标命名空间与版本串；3.0.0 另有一处
  `cloudAndVisibilityOK` 属性 `use="required"` → optional（2023-1 起放开，解析零影响——属性
  在位与否照读）。TAF XSD 从未载 runwayState（METAR 侧 2025-2 删跑道状态建模之事与 TAF 无涉）。
- **ECCC 现网主通道（iwxxm 3.0 + iwxxm-ca 国家扩展）与 2023-1 结构全同**（XSD diff 实证），
  字段解析零分叉；版本语义维持统一口径——不为 TAF 单开版本清单，3.0 照走「非支持版本 →
  invalid-format(info) 尽力解析」（与 METAR 侧同一条 SUPPORTED_VERSIONS）。
- **等价语料翻身**：wmo-im/iwxxm-translation Amd79-80-2023/taf **有官方等价对**（6 站 7 对 +
  TAFTestCases.txt 用例集说明——首期施工只盘了 metar/ 目录，本期补盘）——TAF 侧直接走了与
  METAR 侧同款的双通道验收，不必退单通道快照纪律。

### 2. 映射决策（对调研报告 §五 14 条的 TAF 延伸落位）

| 对象                     | 落位                                                                                                                                                                                                                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 有效期 validPeriod       | gml:TimePeriod begin/end → ddHH/ddHH **直投影**（止时恒 00–23；TAC 止时 24 午夜特例不重编——两态等价，dd 字段是 UTC 时刻的忠实投影，跨月回绕归展开层）                                                                                                                                               |
| CNL                      | `@isCancelReport="true"`；有效期从 validPeriod 退而取 `cancelledReportValidPeriod`（被取消报的覆盖窗）。**译文把该窗起点归一化为发报时刻**（官方对 EHLW：TAC 1309/1321 vs XML 14:00–21:00 起；ECCC 实流 LTCN23AAA 同式）——两通道固有分歧，快照锁定。取消报与 baseForecast 并存 → 矛盾出声、按取消收 |
| NIL                      | baseForecast 缺席或**空载属性元素**（官方对 DAOY 实证：`nilReason="…/missing"` 无 xsi:nil、无内层、无 validPeriod）→ IR nil:true 最小形态；issueTime XSD 必填（TAC「无时组 NIL」形态在 XML 侧无载体）                                                                                               |
| changeIndicator ↔ 变化组 | BECOMING→BECMG、TEMPORARY_FLUCTUATIONS→TEMPO、FROM→FM、PROBABILITY_30/40→PROB30/40、PROBABILITY_30/40_TEMPORARY_FLUCTUATIONS→PROB TEMPO（withTempo 位）——XSD 枚举七值全覆盖；未识别词 info 出声按渐变收（与 METAR 趋势同纪律）                                                                      |
| 时窗                     | phenomenonTime 承载（XSD 明文：TAC FM/TL/AT 由它表达）：TimePeriod begin＝FM 硬时刻或窗起点、end＝窗终点；TimeInstant＝AT 硬时刻（TAF 变化组语汇无 AT——按零长窗收下出声）。span＝phenomenonTime property wrapper 区间                                                                               |
| 气温预告                 | baseForecast 的 AerodromeAirTemperatureForecast（XSD 明文仅基况段承载）：一元素并载 maximum/minimumAirTemperature + 达到时刻——按出现序展开为 IR temperatures（maximum 在前，与 TAC「TX…TN…」token 序天然一致）；单位非 Cel/越界/时刻缺失的读数跳过出声（IR at 必填，不捏造时刻）                    |
| 基况段要素               | 风/能见度/天气/云复用观测侧同一套件（surfaceWindOf/visibilityOf/cloudsOf/4678 切解）；CAVOK 让位与矛盾出声同款。基况段 nil 天气（nothingOfOperationalSignificance＝NSW 语义）→ 组省略 + info（TAC 基况语汇无 NSW 位——NSW 属变化组，变化组内走 TrendElements.nsw 与 METAR 趋势同构）                 |
| raw 重建串               | TafReport 各重建位（有效期、时窗、硬时刻、气温组、变化组）的 raw ＝结构化重建 TAC 形态串（如 "0501/0513"、"FM0800 18012G22KT"、"TX26/0520Z"、"PROB30 TEMPO 1318/1320 FEW023TCU"）——与 trend.raw 同口径声明（非 TAC 原文），span 才是源锚点                                                          |

调研报告 14 条无 TAF 专属项；难点 14（趋势时窗）在 TAF 侧的对应物即 phenomenonTime 时窗（上表
落位），CAVOK/VRB/阈值收敛/单位跟组/nilReason 各条沿用观测侧判据——官方对与 ECCC 样本全绿。

### 3. 施工中发现与修正（三处，均有回归锁）

- **instantOf 内联 TimeInstant 包裹修复**（真 bug）：原实现只解 xlink 引用与直接 timePosition——
  TAF issueTime 是 property 包裹内联 gml:TimeInstant（ECCC 全式、官方 TAF 对同式），观测侧时组
  恒 href 直指故从未暴露。修后三种载体同收（TimeInstant 本体/包裹元素/直带 timePosition）；
  METAR 34 站官方对回归零漂移（href 路径不变）。
- **nil 属性元素判别扩展 `isNilProp`**：TAF 官方对的 nil 云（SARP/OIZC）与 NIL 报 baseForecast
  （DAOY）只带 nilReason 无 xsi:nil——原 isNil 判不出、会误走云容器解析。观测侧 nil 云判据同扩
  （34 站官方对零漂移——该族语料全带 xsi:nil），趋势内天气/云判据同步（LTCN 的 NSW 形态不受影响）。
- **cloudsOf SKC/NSC 云量位层形态**（ECCC 真实流 2026-10-08 LTCN32 实证）：无云电码以「云量位
  SKC/NSC + 云底 nil(inapplicable)」的层形态编码——按 clear 电码收下（49-2 电码表本词、显式 URI
  无信息损失，静默落位），与 nilReason 承载（官方对）/AWC 空容器（2025-2）构成无云族三轨。
- 附带：collect 拆分扩 TAF（按文档序找首个 METAR/SPECI/TAF——混裹形态观测侧优先序不变）。

### 4. 语料与测试

- **官方等价对入库** `corpus/iwxxm/taf-pairs/`（6 站 7 对 + TAFTestCases.txt）：双通道验收
  （排除 raw/span/warnings，口径同 METAR 侧 34 站纪律）——
  - **IR 全等三对**：SARP（CAVOK+温组+PROB30 NSC）×2（含 AMD 位）与 DAOY（NIL）；
  - **固有分歧四对**（单通道逐点锁定，理由入册）：DAAV/MGGT/OIZC——**译文给变化组内 TAC 未列
    能见度处补写 prevailingVisibility 10000m+ABOVE 显式位**（TAC 未列＝沿承不重报，IR 结构真相层
    「组内所列」口径下 XML 侧多出一组；MGGT 的 COR 位/TX-TN 温组、OIZC 的 NSC/m-s 风等其余字段
    两通道逐位全等）；EHLW——CNL 被取消窗起点归一化（见 §九.2）。
- **ECCC 真实流扩样**：corpus/iwxxm/eccc/ 2 份 → 6 份（2026-10-08 实取 LTCN23AAA〔AMENDMENT+CNL〕/
  LTCN24〔PROB30+阵风+VRB〕/LTCN32〔SKC 层形态〕/LTCN33AAB〔-SHRASN 复合天气〕）；公报内全部
  TAF（30+ 份）逐份过筛：站名/有效期/变化组 kind 值域（FM/BECMG/TEMPO/PROB 四型全现）/span
  不变量；版本容错锁（3.0 → info 出声尽力解析）改写为正向断言。
- 合成边界测试（iwxxm.test.ts「TAF 解析」组 18 例）：报头三件、变化组四型、withTempo、未识别
  indicator、温组负值重建、CNL/NIL、版本出声、collect 包裹、missing-validity/missing-time 错误面、
  CAVOK 让位、SKC 形态、基况段 NSW 省略、紧凑模式、span 切片、raw 重建。
- **全仓 889 测全绿（基线 851 → +38）**；core IR 契约零改动。

### 5. 遗留（TAF 侧口子，就地登记）

- PROBABILITY_40（含连 TEMPO 形态）无官方对样本（ECCC 实流只见 30 档）——解析与 30 档同一路径
  （枚举映射），无独立验证；样本出现即补。
- 午夜止窗样本缺：止点为午夜的 ddHH 投影恒 00（非 TAC 惯用止时 24）——两态等价、expander 语义
  相同，实现按直投影落位；语料暂无该形态，出现时行为已定。
- 消费方接线（expandTaf/tafSegments/卡片/地图层吃 IWXXM TAF IR）与 demo 页 TAF 数据面不在本期
  范围——同 IR 契约的意义即天然可用；TAF 卡片 RAW 视图对重建串的阅读体验未调。
- 变化组/基况段内未知元素告警不带 span（Object.keys 扫描位——与观测侧未知元素告警同款，按需后补）。

## 十、IR→IWXXM 生成侧（v0.3 遗留项 5 施工，2026-10-08）

owner 裁决遗留项 5 提前施工：serializeIwxxm（新文件 packages/parser/src/iwxxm-emit.ts）接受
IwxxmReport（kind 位判别）产出 IWXXM XML 文本——解析层（§一–§九）的逆过程，「映射表即正向字典」
兑现。供给面与 parseIwxxm 同构：主入口 index.ts 与 ./iwxxm 子路径**单入口双出口**（体积敏感消费方
一个子路径拿全双向），core 契约零改动（新错误零 code——整体失败复用既有 invalid-input 稳定码）。

### 1. API 形态与版本出口结论

```ts
serializeIwxxm(report: IwxxmReport, options?: {
  version?: "2023-1" | "2025-2";            // 缺省 2023-1（运营版）
  calendar?: { year: number; month: number }; // 日历上下文——见下
  permissibleUsage?: "OPERATIONAL" | "NON-OPERATIONAL"; // XSD 必填属性的占位，缺省 OPERATIONAL
}): string;
```

- **版本出口自裁：2025-2 同供**。理由：两版观测容器同构（§五.2）、taf.xsd 三版逐行同构（§九.1），
  序列化侧无解析侧那样的版本分叉需求；实证面＝2025-2RC1 官方 XSD 全依赖树下 AWC 41 站生成件
  xmllint 全绿（§十.4）。真差异的处置：2025-2 已删跑道状态建模——该出口下 runwayState 如实不落
  （IR 数据不受影响，忠实出口）；rvr unbounded 只放宽上限、不影响生成面。
- **日历上下文必须注入**（调研报告难点 12 的生成侧落位）：IR 时组只有 ddHHMM 无年月位，
  gml:timePosition 是 xsd:dateTime 绝对时刻——calendar 缺失/非法即 invalid-input 整体失败，
  **不猜不默认**；跨月报文的归属由调用方按发报语境裁定。内部以 Date.UTC 归一化承担月末回绕
  （TAF 止时 24＝次日 00:00，与解析侧「止时直投影恒 00–23、24 午夜特例两态等价」同口径）。
- **站点快照最小合法形**（难点 11 落位）：aerodrome 只落 timeSlice SNAPSHOT + ICAO 四字码；
  名称/IATA/ARP/标高不在 IR，不捏造（translationCentre/permissibleUsageReason 等来源侧元数据同理，
  后者经选项占位——XSD BasicReportType 明文 use="required"，调用方按发布性质显式传 NON-OPERATIONAL
  可标测试/演习报文）。
- 结构形态全部官方语料实证：nil 载体（Measure 空载带 uom="N/A"——gml:MeasureType 的 uom 属性
  use="required"；组缺测 notObservable、RVR missing、SKC 云底 inapplicable）、TL 时窗 begin＝发报
  时刻 indeterminatePosition="after"（ZSPD 形）、FM 时窗 end＝同时刻 indeterminate after（WSSS/VTUO 形）、
  无时窗趋势 phenomenonTime nilReason missing（EDDP 形）、SPECI 根元素、CNL＝isCancelReport +
  cancelledReportValidPeriod（EHLW 形）、TAF NIL＝空载 baseForecast + nilReason missing（DAOY 形）。

### 2. 空载形两轨与映射要点（XSD 逐元素声明的实证差异）

- **cloud 空载形按元素声明分两轨**：观测/趋势侧 cloud 声明 nillable（metarSpeci.xsd）——合法空载形＝
  nilReason + xsi:nil="true"（EFHK 官方形）；TAF 预报体 cloud 未声明 nillable（taf.xsd）——合法空载形＝
  裸 nilReason（SARP 官方形）。首轮 xmllint 实证抓出该差异（三份 TAF 生成件报「not nillable」），
  官方语料的裸形/xsi 形分布正是两轨（裸形全在 AWC/ECCC 的 TAF 侧、xsi 形在 2023-1 官方 METAR 对）。
- 趋势风载体 AerodromeSurfaceWindTrendForecast **无 variableWindDirection 属性**（仅观测/预报风载体
  可带——EDDP 官方形无该属性，同轮 xmllint 实证）。
- 趋势时段词 AT/TL/FM 是 **HHMM（时+分，无日位）**——与 TAF 的 ddHH 不同构：日位锚发报日、时刻早于
  发报时刻按次日回绕（IR 往返只比较 HHMM，日位仅服务 xsd:dateTime 合法性）。
- 能见度阈值编码向官方形态收敛（两通道等价的根基逆向）：TAC 9999（≥10km）→ XML 10000m+ABOVE、
  0000（<50m）→ 50m+BELOW——往返解析侧同判式收敛回 9999/0。
- 无云三轨的逆向：NSC/NCD → nilReason 承载；SKC → 云量位层形态（ECCC 实证，49-2 电码表本词无损）；
  电码与层并存的矛盾 IR → 层照落 + 电码走层形态（信息全保真，与解析侧矛盾出声对偶）。
- CAVOK 让位对称：cavok=true 时 vis/rvr/weather/cloud 三族不落 XML（与解析侧让位行为对称；
  Schematron Observation-1/TrendForecast-1/Forecast-1 三条规则的生成面兑现）。

### 3. 有损面（TAC 源 IR 的单向损失，逐条如实）

| #   | 对象                              | 落位                                                                                                                                                                                                                                 |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | 能见度 sm / QNH inHg / RVR ft     | IWXXM 量纲固定 m/hPa/m（Schematron RVR-1 明文 meanRVR 以米报）——按固定系数折算（×1609.344 / ×33.8639 / ×0.3048）；系数是本实现常量，非任一转换中心的官方折算表（CYEK 官方 0.25SM→400m 与 AWC 1/2SM→805m 即两套表——换算本身中心相关） |
| 2   | 无云 CLR                          | 49-2 云量电码表无此词（codes.wmo.int 直查 404）——收敛 nilReason notDetectedByAutoSystem，回读 NCD（D0 ④ CLR/NCD 细辨不可还原同一纪律）；SKC/NSC/NCD 全保真                                                                           |
| 3   | 趋势 DDHH/DDHH 窗（中国主流编法） | IWXXM 趋势时窗只有 AT/UNTIL/FM——双端点完整落位为 TimePeriod，timeIndicator 按 UNTIL 判读，回读 TL+窗止（窗起不保真）；kind 'unspecified' 趋势无对应 changeIndicator → BECOMING（解析侧「未识别按渐变收」的逆向）                     |
| 4   | RVR V 波动形态                    | 2023-1 XSD 只有 meanRVR 单值位——以 min 值落位（V 端不保真）                                                                                                                                                                          |
| 5   | TAF 温组单端                      | XSD 一元素必载 TX/TN 双端（max/min+两时刻全必填）——单端读数组整体不落（不捏造另一端）；达时刻缺日（ogimet 方言短形态）同此；多组温度取首个 TX+首个 TN（承载面上限：温度元素 maxOccurs=2 且每元素必载双端）                           |
| 6   | TAF FM 硬时刻日位                 | TafChangeAt 只有 GGgg 无日位——日位取有效期起日直投影（锚定语义归展开层，与 TAC 侧 FM 无日位对称）                                                                                                                                    |
| 7   | 逐道 SNOCLO / 深度位 99           | XML 侧关闭只有 runwayState nil(inapplicable) 一形（无逐道载体）——跑道位不保真（回读为全机场形态）                                                                                                                                    |
| 8   | TAF.TAF-8 偏差                    | Schematron 明文基况段（cavok 非 true）prevailingVisibility/cloud 必填——上游转换中心以补写 10000m+ABOVE 满足，**本实现不捏造**，IR 组省略即不落（偏差如实记档，见 §十.6）                                                             |
| 9   | 趋势/预报体最低能见度             | XSD 只在观测侧 AerodromeHorizontalVisibility 有该组——观测位照落，趋势/TAF 位不落（XML 源 IR 在这两处本就无此组）                                                                                                                     |
| 10  | RMK 附加段                        | IWXXM 国际模型无位（难点 3 维持）——remarks 不落                                                                                                                                                                                      |

### 4. 合规策略与实际达标层级（如实，遗留项 5「XSD + Schematron 双合规」的落位）

四级验证面，前两级入 CI、后两级如实记档：

| 层级                                        | 面貌                                                                                                                                                                                                                                                                                                                                                                          | 达标状态                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ① 往返测试（CI）                            | 官方等价对 .xml → parse → serialize → re-parse → IR deep-equal（排除 raw/span/warnings，同 34+7 对既有纪律）+ AWC 41 站（2025-2 出口）+ 合成边界 21 形态（NIL/CNL/SKC/CLR/CLRD62/SNOCLO/V 形 RVR/英尺 RVR/风切变/CAVOK+NOSIG/VRB 扇区/AT/FM 趋势/PROB40 TEMPO/NSW/止时 24/缺 vis 云基况/COR SPECI/逐道关闭等）                                                                | 全绿——34+7+41+21 四套往返全等（iwxxm-emit.test.ts，30 测）                                                                                                                                                                                                                                                                                                    |
| ② 结构断言 + Schematron 核心子集（CI）      | ZSPD 生成件逐位对照官方样本（温露压量纲/RVR 四条/云层英尺直传/趋势时窗）+ 全文快照锁（确定性 gml:id `mw.gen.N` 发号，结构回归即红）；Schematron 核心规则固化（规则 id 与官方 iwxxm.sch 一一对应）：CAVOK 让位三处（Observation-1/TrendForecast-1/Forecast-1）、RVR-1（meanRVR 恒 m）、RunwayState-2/-3（cleared 与沉积位互斥、allRunways 与 runway 互斥）、SPECI 非 AMENDMENT | 全绿                                                                                                                                                                                                                                                                                                                                                          |
| ③ XSD 全量（施工时点实证，不入 CI）         | xmllint --schema + 官方 XSD **全依赖树**（GML 3.2.1/AIXM 5.1.1/OM/ISO 19139，90–92 文件；schemas.wmo.int/opengis/aixm/w3.org 直取，归一化相对引用后本地验证）                                                                                                                                                                                                                 | **2023-1 出口 41/41 全绿 + 2025-2 出口 41/41 全绿 + 合成 21/21 全绿**（2026-10-08 施工时点）；不入 CI 因依赖网络抓取与大体积 schema 树（约 90 文件），复现口径：递归抓取 iwxxm.xsd 的 include/import 闭包→scheme 前缀归一→xmllint --nonet --schema 逐件验证。施工中发现并修正两处结构偏差（§十.2 空载形两轨与趋势风属性）——XSD 验证对生成面是一等验收，非摆设 |
| ④ Schematron 全量（不做，如实留官方工具链） | 官方规则面 iwxxm.sch 单文件 174 assert、queryBinding="xslt2"——需 Saxon/Java（xmllint 的 --schematron 仅支持 XSLT1 子集，实测装载即失败）                                                                                                                                                                                                                                      | 按调研报告 §六.6 职责边界不做全量转译；核心规则固化入层级 ②，全量校验留给官方工具链——依赖红线（不引入 Java/Saxon）优先                                                                                                                                                                                                                                        |

### 5. 测试面与门禁

- iwxxm-emit.test.ts 30 测（三套语料往返 8、结构断言+快照 3、Schematron 子集 6、错误面 3、
  TAC 源有损面与 NIL/CNL 往返 7、紧凑模式/跨入口契约 3）。
- 快照文件 iwxxm-emit.test.ts.snap 入库（ZSPD 全文锁）。
- **全仓 919 测全绿（基线 889 → +30）**；core 契约零改动（零新增 WarningCode/错误码——生成面
  错误复用 invalid-input 稳定码）。

### 6. 遗留（生成侧口子，就地登记）

- **TAF.TAF-8 偏差维持**：基况段 prevailingVisibility/cloud 必填条在 IR 组省略时不满足（不捏造）。
  发布方若需过官方 Schematron 全量，需调用方 IR 自带该两组（组省略语义上本就缺数据）或后处理补写；
  上游转换中心的「补写 10000m+ABOVE」口径经裁决不采纳（不捏造数据优先于合规完备）。
- CLRWX 收敛：49-2 电码表若将来增设 CLR 词，层形态可平移（实现集中在 emitClearLayer 一处）。
- collect 公报包裹不生成（单报出口；公报拼装归管道层——与解析侧「collect 能拆」不对称，
  现实需求倒挂：消费 IWXXM 公报的是下游，生成单报是上游）。
- Schematron 子集之外的规则面（如 permissibleUsageReason 与报文性质的一致性、coordinates 语义等）
  未固化——出现真实发布需求时按需增补断言。
- 生成面中文错误文案未过术语册（术语册 v1 抽取面未含 iwxxm 模块——与解析侧 iwxxm.ts 同现状；
  抽取面扩展时一并入册）。
