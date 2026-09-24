# @metweave/core

metweave 管道心脏处的 IR 数据模型——解析器（METAR/SPECI 与 TAF → IR）与渲染组件（IR → UI）之间的唯一契约。一切都是纯可序列化 JSON——零依赖、零类实例——且每个产物都携带指回原始报文的 `span`。

### 安装

```bash
npm install @metweave/core
```

### 最小示例

```ts
import { toValues } from "@metweave/core";
```

每组三个显式状态（省略 ≠ 缺测 ≠ 有值）、携带 span 的机读告警码，以及 `toValues()` 两态取值视图。预报侧 IR 同构：`TafReport`（电头/有效期/基况四要素/CAVOK/NIL·CNL/AMD·COR 旗标）、`TafChangeGroup` 族（FM/BECMG/TEMPO/PROB 变化组与窗口）、`TafTemperatureGroup`（TX/TN 气温组）——同样纯 JSON、同样 span 保真。整报失败抛 `MetarParseError`，`code` 字段稳定（METAR 五码 + TAF `missing-validity` / `invalid-validity` / `strict-violation` 三码，英文文案 `EN_MESSAGES` 查表）——`message` 措辞后续可本地化而不构成破坏性变更。

文档与完整示例见[主仓库](https://github.com/yaojaro/metweave)。

## 许可

[MIT](https://github.com/yaojaro/metweave/blob/main/LICENSE) © 2026 YaoJaro——授权仅覆盖本仓库的代码与文档；随包分发的报文样本不在其列，详见主仓库 README 的「许可」说明。
