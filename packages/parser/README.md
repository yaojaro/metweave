# @metweave/parser

tolerant 的 METAR/SPECI 解析器，把原始报文解析为 `@metweave/core` IR。纪律是**不静默**：认不出的组带着原文 span 进 `warnings[]`，缺测电码（`//`、`////`、`/////KT`、`BKN///`）映射为显式状态——绝不丢弃、绝不捏造。

### 安装

```bash
npm install @metweave/parser
```

### 最小示例

```ts
import { parse } from "@metweave/parser";
```

以真实公开报文语料验收（每类反常形态至少一条真实样本）。整报失败抛 `MetarParseError`，携带稳定的机读 `code`——只增不改的契约；请按 `code` 分流，不要依赖 `message` 措辞（全量错误码在 `@metweave/core`，英文文案见 `EN_MESSAGES`）。

strict 校验模式在路线图上。文档见[主仓库](https://github.com/yaojaro/metweave)。

## 许可

[MIT](https://github.com/yaojaro/metweave/blob/main/LICENSE) © 2026 YaoJaro——授权仅覆盖本仓库的代码与文档；随包分发的报文样本不在其列，详见主仓库 README 的「许可」说明。
