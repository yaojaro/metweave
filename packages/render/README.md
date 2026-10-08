# @metweave/render

解析后的 METAR/SPECI 与 TAF 报文卡片：自包含、零框架的 DOM 组件。默认样式随组件注入（运行时注入，宿主零配置），悬停提示用平实语言解释每个值，RAW 对照视图在原始报文上高亮缺测/告警组；同一观测若有两种编码（如 IWXXM XML 与其源 TAC 电码），传 `altRaws` 可在原文区内 tab 切换（不传时行为与单编码完全一致）。

### 安装

```bash
npm install @metweave/render
```

### 最小示例

```ts
import { renderCard } from "@metweave/render";
```

卡片默认中文渲染；传 `{ locale: "en" }` 切换为全英文输出（行标签、悬停术语表、告警、跑道状态）。宿主可通过 `className` 叠加自己的样式，也可以跳过组件直接基于 IR 构建 UI。

卡片行色（danger/caution 组级标注）判据与四档站点档位同源 `@metweave/core` 判据单源（**自拟扫视启发式，不得用作运行判据**，口径表见主仓库 README「显示档位判据」节）；按自身标准重分档可传 `{ tierOf }` 自定判据函数——注入 verdict 写入卡根 `data-tier` 属性（宿主 CSS/面板按注入判据映射行色的挂点），未传时不产出档位标识、行为与既有版本一致；注入函数抛错＝renderCard 同步抛出，不静默回退。判据语义变化走 minor 版本 + CHANGELOG 迁移说明，不在 patch 位漂移。

### TAF 卡片（renderTafCard）

```ts
import { renderTafCard } from "@metweave/render";
```

TAF 卡与 METAR 卡同契约：分段明细（主导段 / BECMG 过渡带 / TEMPO·PROB 挂载行）、气温极值、RAW 对照与组级双向联动、悬停＝点亮＋电码浮签、点击＝解码气泡＋ FM 51 依据行；`utcOffsetMinutes` 切换 UTC/北京时单制展示、`monthAnchor` 支撑跨月有效期。配套导出：`summarizeTafConditions`（TAF 展开条件的人话摘要——tooltip/图例/面板一句话用）、`DECODE_CITES`（解码气泡的规范依据表，zh/en 双语）。两卡浮层几何与 aria 生命周期同源一个内核（联动语言＝点亮＋浮签、点击＝详解＋依据）。

文档见[主仓库](https://github.com/yaojaro/metweave)。

## 许可

[MIT](https://github.com/yaojaro/metweave/blob/main/LICENSE) © 2026 YaoJaro——授权仅覆盖本仓库的代码与文档；随包分发的报文样本不在其列，详见主仓库 README 的「许可」说明。
