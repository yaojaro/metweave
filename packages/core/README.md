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

### 显示档位判据（tier 模块）

四档站点档位判据随包单源发布：`metarTierOf(report)` 直收 METAR 报、`conditionTierOf(input)` 收结构子集（TAF 展开结果投影后同喂），配套 `ConditionTier` 档位类型与要素级行色判据（`weatherGroupTone` / `visibilityGroupTone` / `cloudLayerTone`）——`@metweave/leaflet` 的圆点档位与 `@metweave/render` 的卡片行色都消费这一份。判据是**本库自拟的扫视启发式，不得用作运行判据**（完整口径见主仓库 README「显示档位判据」节与 tier 模块 JSDoc）；按自身标准重分档走渲染层的 `tierOf` 注入选项，本包恒为内置缺省。判据语义变化走 minor 版本 + CHANGELOG 迁移说明，不在 patch 位漂移。

文档与完整示例见[主仓库](https://github.com/yaojaro/metweave)。

## 许可

[MIT](https://github.com/yaojaro/metweave/blob/main/LICENSE) © 2026 YaoJaro——授权仅覆盖本仓库的代码与文档；随包分发的报文样本不在其列，详见主仓库 README 的「许可」说明。
