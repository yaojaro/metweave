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

### TAF 图层（预报侧）

```ts
import { addTafLayer, setTafLayerTime } from "@metweave/leaflet";
```

`addTafLayer(map, items, options)` 与实况层同款（圆点四档色、悬停摘要、点击弹 TAF 卡）；`setTafLayerTime` 原地换查看时刻（不清层、已开弹窗即时换内容）、`createTafTimeControl` 提供零框架时间滑杆、`calendarAnchor`/`TafLayerItem.monthAnchor` 支撑跨月报池；`tafTierOf`/`TIER_COLORS` 随包导出（判据与配色单一来源已下沉 `@metweave/core`，TEMPO 发作窗按叠加态定档）。

### 档位判据与 tierOf 注入

`conditionColors: true` 的四档圆点判据（灰 unknown / 红 poor / 琥珀 caution / 绿 good）是本库自拟的扫视启发式，**不得用作运行判据**——判据本体在 `@metweave/core` 单源（本包随包再导出 `metarTierOf` / `ConditionTier` 供宿主面板直读），四档口径表见主仓库 README「显示档位判据」节。按自身运行标准重分档：`addMetarLayer(map, items, { tierOf })` 传 `(report) => ConditionTier` 自定判据函数，一处注入三层生效（圆点色 / 读屏 aria 档位词 / 弹窗卡片档位标识），缺省走内置判据；注入函数抛错＝整次调用失败（不静默回退）。判据语义变化走 minor 版本 + CHANGELOG 迁移说明，不在 patch 位漂移。

### 格点填色图层（色斑图，v0.3 起）

```ts
import { addGridLayer } from "@metweave/leaflet";
import { parseGrid, tmpProfile } from "@metweave/grid";

const res = await fetch("/grid/tmp_cn.mwgrid");
const overlay = await addGridLayer(map, parseGrid(await res.arrayBuffer()), tmpProfile);
// 换要素/换时次：map.removeLayer(overlay) 后再 addGridLayer（原地 setData 留后续版本）
```

`addGridLayer(map, grid, profile, options?)` 把一个 viz-ready 场按**要素档案**（`@metweave/grid`，色标/档位/量纲换算的单一事实来源）渲成色斑图：档案缺省档位分级（等距/分位数/阈值三模式）→ 逐像素双线性取样着色（缺测透明；档案声明透明档时命中档同样透明、底图透出）→ canvas PNG → `L.imageOverlay` 贴网格几何边界（格点中心外延半格的像元边界，像素与地理对齐）。选项有 `width`（渲染宽，缺省 2× 网格列数，超采样出平滑档界）、`opacity`（色斑不透明度，缺省 0.6——色斑可辨且底图地名/省界仍可见；经 `L.imageOverlay` 原生图层不透明度生效，宿主可对返回的叠加层 `setOpacity(v)` 原地调节不必重建层，传入值收敛到 [0,1]）与 `scale`（自定义分级色标，见下节）。图层挂独立 pane（`mw-grid`，z 350）——色斑恒在瓦片底图之上、宿主的矢量/标记/弹窗层之下，与装载次序无关。渲染本体是零 DOM 的 `renderToImageData`（Node 可测），本函数只做位图封装与上图——无 Canvas 2D 的环境显式报错。依赖方向：`@metweave/leaflet` → `@metweave/grid`（渲染内核宿主无关）。

### 等值线叠层（v0.3 气压切片：等值线主导形态）

```ts
import { addGridLayer, addContourLayer } from "@metweave/leaflet";
import { parseGrid, prmslProfile } from "@metweave/grid";

const res = await fetch("/grid/prmsl_cn.mwgrid");
const grid = parseGrid(await res.arrayBuffer());
await addGridLayer(map, grid, prmslProfile); // 色斑浅填色打底（pane mw-grid，z 350）
await addContourLayer(map, grid, prmslProfile); // 等值线＋标注压顶（pane mw-grid-contour，z 360）
```

`addContourLayer(map, grid, profile, options?)` 把一个 viz-ready 场的**等值线形态**贴上地图：内核 `contoursOf` 出等值线几何（d3-contour 闭合环，显示单位空间）→ SVG polyline 逐环描线（`contours.interval` 常规线 1.4px 标值、`minorInterval` 加密细线 0.7px 不标值、`highlighted` 特值线 2.2px **红色加粗**〔缺省副高红，气象惯例——如 500hPa 高度的 5880 gpm 副高线〕——档案口径驱动）＋常规线沿程数值标注（白底挖空描边、恒定像素字号——缩放不失真；特值线标注**必标**且随线着色加粗——认知锚线与值不可分）＋`centersOf` 低压「L」（红）/高压「H」（蓝）中心标注含中心值（气象读图惯例的内容锚）。与 `addGridLayer` 正交组合：色斑在下、等值线与标注在上、宿主矢量/标记/弹窗层再上——返回可整层移除的 `LayerGroup`。选项有 `color`（等值线基色，缺省深灰蓝）、`highlightColor`（特值线基色，缺省副高红）、`labels`/`minor`/`centers`（数值标注/加密细线/L·H 标注开关）。档案缺 `contours` 口径显式抛错（留位要素未接线，不静默空层）。

### 风向杆叠层（v0.3 风切片：双分量形态）

```ts
import { addGridLayer, addWindBarbLayer } from "@metweave/leaflet";
import { parseGrid, windSpeedGrid, windProfile } from "@metweave/grid";

const [uRes, vRes] = await Promise.all([
  fetch("/grid/windu_cn.mwgrid"),
  fetch("/grid/windv_cn.mwgrid"),
]);
const [uGrid, vGrid] = [parseGrid(await uRes.arrayBuffer()), parseGrid(await vRes.arrayBuffer())];
await addGridLayer(map, windSpeedGrid(uGrid, vGrid), windProfile); // 风速合成色斑（pane mw-grid，z 350）
await addWindBarbLayer(map, uGrid, vGrid, windProfile); // 风羽杆压顶（pane mw-grid-barb，z 365）
```

`addWindBarbLayer(map, u, v, profile, options?)` 把一对 u/v 分量场的**风向杆**贴上地图：内核 `windBarbsOf` 按档案 `barbs` 口径（`step` 抽稀步长〔格点数，缩放无关固定步长——v1 无 LOD〕／`calmThreshold` 静风阈，低于阈值的格点不画杆）出杆位序列 → 每杆一枚恒定像素 divIcon 风羽——**m/s 中国口径**（三角旗 20 m/s＋长划 4 m/s＋短划 2 m/s，中文气象圈地面图填图规范；简化箭头弃用：只表方向不表速度、零信息增量），杆恒向上＝风向 0° 北、按 `direction`（气象**来向**口径，atan2 同源派生）施加 SVG rotate，羽在杆左侧（北半球惯例）；缩放下 marker 原地重定位、glyph 尺寸不变。与 `addGridLayer` 正交组合：**色斑吃 `windSpeedGrid` 合成场、杆层吃分量原场**（两层零交涉，宿主可独立取舍）；色斑（350）/等值线（360）之下、宿主矢量（≥400）之下——杆层 z 365。选项有 `color`（风羽基色，缺省深灰蓝）。档案缺 `barbs` 口径显式抛错（filled 要素不背杆，不静默空层）；`windBarbPath(speed)`（导出的纯函数）产出单杆的 SVG path 数据，供宿主自定义渲染复用。

### 自定义色卡（业务定制位）

档案的色标与档位是内置推荐口径；对接方按自身业务定制有两条路：

```ts
// ① 完整自定义档位＋色带：断点写在显示单位空间（档案换算后的值，tmp 即 °C）
import { equalStepBreaks } from "@metweave/grid";

const overlay = await addGridLayer(map, grid, tmpProfile, {
  scale: { breaks: equalStepBreaks(0, 40, 8), colors: ["#eff3ff", "#6baed6", "#08519c"] },
});

// ② 部分定制（改色带/改档域/改分位点）——从档案派生一份再传入：
const myTmp = {
  ...tmpProfile,
  colorStops: ["#f7fbff", "#deebf7", "#c6dbef", "#9ecae1"],
  equal: { min: -20, max: 40, bins: 12 },
};
await addGridLayer(map, grid, myTmp);
```

自定义断点须严格递增、色带为合法十六进制（`#rgb`/`#rgba`/`#rrggbb`/`#rrggbbaa`——alpha < 255 即半透明档），非法即抛错不静默；分位数断点可用 `quantileBreaks` 直读容器头预计算分位，阈值档断点用 `thresholdBreaks`（显式业务阈值原样）。`options.scale` 传入即完整覆盖档案缺省，量纲换算（`profile.toDisplay`）不受影响——断点与场值同在显示单位空间比对；**透明档随 scale 一体取位**：档案缺省的 `transparentBins` 不被继承，自定义 scale 需要透明档（如零值堆首档）时自带 `transparentBins: new Set([0])`——不带即全档着色（显式意图，不静默继承）。

```ts
// 透明档随自定义 scale 自带（不继承档案缺省）——如自定 CAPE 档位时保留零值首档透明：
import { capeProfile, thresholdBreaks } from "@metweave/grid";

const overlay = await addGridLayer(map, grid, capeProfile, {
  scale: {
    breaks: thresholdBreaks([500, 1000, 2500, 4000]),
    colors: ["#ffffcc", "#fed976", "#fd8d3c", "#e31a1c", "#800026"],
    transparentBins: new Set([0]),
  },
});
```

## 许可

[MIT](https://github.com/yaojaro/metweave/blob/main/LICENSE) © 2026 YaoJaro——授权仅覆盖本仓库的代码与文档；随包分发的报文样本不在其列，详见主仓库 README 的「许可」说明。
