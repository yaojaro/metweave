# @metweave/parser

tolerant 的 METAR/SPECI 与 TAF 解析器，把原始报文解析为 `@metweave/core` IR。纪律是**不静默**：认不出的组带着原文 span 进 `warnings[]`，缺测电码（`//`、`////`、`/////KT`、`BKN///`）映射为显式状态——绝不丢弃、绝不捏造。

### 安装

```bash
npm install @metweave/parser
```

### 最小示例

```ts
import { parse } from "@metweave/parser";
```

以真实公开报文语料验收（每类反常形态至少一条真实样本）。整报失败抛 `MetarParseError`，携带稳定的机读 `code`——只增不改的契约；请按 `code` 分流，不要依赖 `message` 措辞（全量错误码在 `@metweave/core`，英文文案见 `EN_MESSAGES`）。

### TAF（FM 51）预报侧

```ts
import { expandTaf, parseTaf, tafSegments, validateTaf } from "@metweave/parser";

const taf = parseTaf("TAF ZBAA 240000Z 2400/2506 32004MPS 9999 FEW030 TN14/2403Z=");
const segs = tafSegments(taf); // 分段明细（主导段/过渡带/TEMPO·PROB 挂载行，按时间升序）
const violations = validateTaf(taf); // 条文判据：C2 VRB 两源阈值 / C3 阵风 / C5 天气白名单双层 / C7 三层选取
const strict = parseTaf(raw, { mode: "strict" }); // 严判：违例聚合抛 strict-violation（validateStandard 可选 "wmo"|"caac"）
```

TAF 侧 strict 严判与 `validateTaf` 判据校验已落地（B7 间歇判据机器不可判，明示空集）；METAR 侧 strict 仍在路线图。文档见[主仓库](https://github.com/yaojaro/metweave)。

### IWXXM（2023-1）XML 侧（v0.3 alpha）

```ts
import { parseIwxxm } from "@metweave/parser"; // 或子路径 "@metweave/parser/iwxxm"（体积敏感时按需引入）

const report = parseIwxxm(xml); // IWXXM 2023-1 METAR/SPECI XML → 与 parse(tac) 同一份 IR
```

解析 WMO/ICAO IWXXM（目标版本 2023-1/2025-2）的 METAR/SPECI **与 TAF** XML 电报，产出与字符电码（TAC）侧**完全同一份 IR**（`parseIwxxm` 按 kind 位分派 `MetarReport | TafReport`）——官方等价对双通道验收：METAR 34 站（30 站 IR 全等；4 站美制单位/译文补充位固有分歧快照）＋ TAF 6 站 7 对（CAVOK/NIL 3 对全等；译文补写位等 4 对固有分歧快照）。要点：CAVOK＝`cloudAndVisibilityOK` 属性、RVR 趋势＝`pastTendency`、无云族＝nilReason 二词（NSC/NCD 代表电码 + info 告警）、NOSIG＝trendForecast nil、TAF 变化组＝changeIndicator（FROM/BECMG/TEMPO/PROB）×phenomenonTime 时窗、单位跟组走（uom 逐元素判读）、版本探测容错（支持版本零告警；3.0 等其余版本出声尽力解析，2.1 旧架构族明确整体失败）。`report.raw` 为输入 XML 原文、`trend.raw`/`changes[].raw`/`validity.raw` 为结构化重建串（非 TAC 原文）；值字段 span＝源元素/属性在 XML 原文中的区间（`spans: false` 紧凑模式剥除）。映射底档与复核结论见主仓库 [docs/iwxxm-notes.md](https://github.com/yaojaro/metweave/blob/main/docs/iwxxm-notes.md)。

### IWXXM 序列化（IR → XML，v0.3 alpha）

```ts
import { parseIwxxm, serializeIwxxm } from "@metweave/parser"; // 子路径同供（单入口双出口）

const report = parseIwxxm(xml);
const xml2 = serializeIwxxm(report, {
  calendar: { year: 2023, month: 5 }, // 必传：IR 时组只有 ddHHMM，绝对时刻的年月由调用方注入（缺失即抛错，不猜）
  version: "2023-1", // 缺省；"2025-2" 同供（该出口下跑道状态组如实不落——schema 已删该建模）
});
```

`parseIwxxm` 的逆过程：接受任一侧 IR（`kind` 位判别 `MetarReport | TafReport`）写回 IWXXM XML 文本——METAR/SPECI 与 TAF 双侧，CNL（`isCancelReport` + `cancelledReportValidPeriod`）与 NIL（observation xsi:nil / 空载 baseForecast）都能往返。忠实原则：**IR 有什么出什么**——站点快照只落 ICAO 四字码的最小合法形（名称/坐标不在 IR，不捏造），`translationCentre` 等来源侧元数据不生成；`permissibleUsage` 是 XSD 必填属性的占位（缺省 OPERATIONAL，测试/演习报文显式传 NON-OPERATIONAL）。有损面如实记档（sm/inHg/RVR-ft 折算、CLR→NCD 收敛、RVR V 形态单值化、趋势 DDHH//DDHH 窗止不保真、TAF 温组单端不落等，全表见 notes §十.3）。验收：官方等价对 34+7 对与 AWC 41 站的 serialize→re-parse IR 全等往返 + 生成件 xmllint 过官方 XSD 全依赖树（2023-1 与 2025-2 双出口全绿）；Schematron 官方规则面需 Saxon（xslt2），核心规则子集固化为测试、全量校验留官方工具链。

## 许可

[MIT](https://github.com/yaojaro/metweave/blob/main/LICENSE) © 2026 YaoJaro——授权仅覆盖本仓库的代码与文档；随包分发的报文样本不在其列，详见主仓库 README 的「许可」说明。
