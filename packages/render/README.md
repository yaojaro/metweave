# @metweave/render

解析后的 METAR/SPECI 报文卡片：自包含、零框架的 DOM 组件。默认样式随组件注入（运行时注入，宿主零配置），悬停提示用平实语言解释每个值，RAW 对照视图在原始报文上高亮缺测/告警组。

### 安装

```bash
npm install @metweave/render
```

### 最小示例

```ts
import { renderCard } from "@metweave/render";
```

卡片默认中文渲染；传 `{ locale: "en" }` 切换为全英文输出（行标签、悬停术语表、告警、跑道状态）。宿主可通过 `className` 叠加自己的样式，也可以跳过组件直接基于 IR 构建 UI。

文档见[主仓库](https://github.com/yaojaro/metweave)。

## 许可

[MIT](https://github.com/yaojaro/metweave/blob/main/LICENSE) © 2026 YaoJaro——授权仅覆盖本仓库的代码与文档；随包分发的报文样本不在其列，详见主仓库 README 的「许可」说明。
