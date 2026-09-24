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

## 许可

[MIT](https://github.com/yaojaro/metweave/blob/main/LICENSE) © 2026 YaoJaro——授权仅覆盖本仓库的代码与文档；随包分发的报文样本不在其列，详见主仓库 README 的「许可」说明。
