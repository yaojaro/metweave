# @metweave/leaflet

metweave 的 Leaflet 适配器：报文卡片上图——marker、tooltip 与卡片弹窗一次调用全就位。

### 安装

```bash
npm install @metweave/leaflet leaflet
# TypeScript 用户另装类型：npm install -D @types/leaflet
```

### 最小示例

```ts
import { addMetarLayer } from "@metweave/leaflet";
```

`addMetarLayer` 是异步函数（返回 `Promise<LayerGroup>`）：leaflet 由首次调用时动态装载，import 本包不会在 Node/SSR 模块图里触发 `window` 求值错误，上图动作需 `await`。

底图瓦片仍是宿主侧一行 `L.tileLayer` 配置——本包不绑定任何底图。其他地图库（MapLibre 等）的适配器在路线图上。文档与端到端示例见[主仓库](https://github.com/yaojaro/metweave)。

## 许可

[MIT](https://github.com/yaojaro/metweave/blob/main/LICENSE) © 2026 YaoJaro——授权仅覆盖本仓库的代码与文档；随包分发的报文样本不在其列，详见主仓库 README 的「许可」说明。
