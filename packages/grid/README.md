# @metweave/grid

格点标量场包：viz-ready 容器读写（网格头 JSON + float32，`.mwgrid`）、GRIB2 解码（complex packing 5.2/5.3，含二阶空间差分）与裁域——渲染内核宿主无关，Leaflet 等地图适配器由 `@metweave/leaflet` 提供。

## 安装与依赖

```bash
pnpm add @metweave/grid
```

运行时外部依赖恰一个：**d3-contour**（等值线几何追踪，ISC）——等值线是 marching-squares 型成熟算法（环提取/平滑/洞归属），自研的几何正确性成本远超收益；引入于 2026-10-04 定案，其余能力全部标准库实现。上图画线见 `@metweave/leaflet` 的 `addContourLayer`。

## 快速开始（读一个 .mwgrid 文件）

```ts
import { parseGrid } from "@metweave/grid";

const res = await fetch("/data/grid/tmp_cn.mwgrid");
const { header, values } = parseGrid(await res.arrayBuffer());

header.grid.nx; // 列数（如 280）
header.grid.la0; // 首行纬度（北界，行序北→南）
header.stats.p50; // 预计算分位（分级设色直读，免全量排序）
header.meta.source; // 溯源行（GFS cycle 等，展示端直读）
```

## viz-ready 容器（v1）

| 段  | 内容                                                                            |
| --- | ------------------------------------------------------------------------------- |
| 7B  | magic `MWGRID1`                                                                 |
| 4B  | 头长（big-endian，偏移 7）                                                      |
| 1B  | 保留（偏移 11，恒 0——v1 布局固有间隙，读侧跳过）                                |
| nB  | 头 JSON（`GridHeader`：变量/层/单位/网格几何/stats 八分位/溯源元数据，偏移 12） |
| nB  | float32 payload（big-endian，行序北→南、行内西→东）                             |

缺测以 float32 NaN 显式建模；要素「哨兵值」（如模拟反射率 −20 无回波）保留打包原值，由应用层按需处理。

## GRIB2 转换（./convert 子路径）

```ts
import { decodeGrib2, fieldToGrid, cropGrid, serializeGrid } from "@metweave/grid/convert";

const fields = decodeGrib2(grib2Buffer); // 5.2/5.3 complex packing 全解码
const grid = fieldToGrid(fields[0]!, { variable: "TMP", level: "2m", unit: "K" });
const cn = cropGrid(grid, { la0: 55, la1: 3, lo0: 70, lo1: 140 }); // 半开窗（南界盖过曾母暗沙，南海九段线全境）
writeFileSync("tmp_cn.mwgrid", serializeGrid(cn.header, cn.values));
```

配套取数 CLI（仓库内）：`pnpm gen:grid`（GFS 最新 cycle → 全要素 `.mwgrid`，默认集 6 要素、`--all` 14 要素、`--element tmp` 单要素）。

解码支持面：DRT 5.2/5.3（complex packing，含一阶/二阶空间差分与 E/D 双缩放）；位图与缺测替代管理路径显式抛错（`GridError`，code 机读），不静默。

## 渲染内核（色斑图）

```ts
import {
  interpolateBilinear,
  equalStepBreaks,
  quantileBreaks,
  thresholdBreaks,
  binIndexAt,
  renderToImageData,
  buildColorScale,
  tmpProfile,
} from "@metweave/grid";

// 双线性插值：任意经纬度取值（读值探针/等值线/鼠标读值的地基；缺测邻域返回 NaN）
interpolateBilinear(grid, 39.9, 116.4); // → 289.2（K）

// 分级三模式（断点一律在显示单位空间）：
equalStepBreaks(-40, 40, 20); // 等距：[-40,40]°C 20 档 → 19 个断点（跨时次可比）
quantileBreaks(grid.header.stats, [0.1, 0.25, 0.5, 0.75, 0.9]); // 分位数：直读容器头
//   预计算八分位梯子（免全量排序；合法分位点 0/.1/.25/.5/.75/.9/.99/1，其余显式抛错）
//   返回值为存储单位（stats 原值）——显示空间断点须先经 profile.toDisplay 映射
//   （buildColorScale 已按档案链路复合换算；自行拼 ColorScale 时调用方换算）
thresholdBreaks([1000, 2500, 4000]); // 阈值档：显式业务阈值原样（校验严格递增）——
//   零值堆/重偏态场（分位数断点塌在零上）与气象惯例阈值要素的定档方式
binIndexAt(3.7, breaks); // 值 → 档序号（左闭右开；NaN → -1 透明档）

// 逐像素色斑渲染（纯函数、零 DOM、Node 可测）：逐像素对场值双线性取样后定档着色，
// 缺测 NaN → alpha 0 透明；分辨率与网格解耦（超采样出平滑档界）
const scale = buildColorScale(tmpProfile, grid.header.stats); // 档案缺省档位＋色带
const image = renderToImageData(grid, scale, {
  width: 560, // 缺省 = 网格列数（原生分辨率）
  convert: tmpProfile.toDisplay, // K→°C（量纲换算只在要素档案层）
  opacity: 0.85, // 乘进像素 alpha
}); // → { width, height, data }（与浏览器 ImageData 同构）

// 档级透明（ColorScale.transparentBins，可选）：命中档 alpha 0 不着色、底图透出——
// 如 CAPE 首档 [0,1000) 零值堆。缺省缺席＝无透明档；序号非法（非整数/越出档范围）显式抛错
const capeScale = {
  breaks: thresholdBreaks([1000, 2500, 4000]),
  colors: ["#ffffcc", "#fd8d3c", "#800026"],
  transparentBins: new Set([0]), // 首档透明（与 opacity 无关，整体不透明度不使其复活）
};

// log₁₀ 前置变换（ColorScale.logScale，可选）：定档前对值与断点统一取 log₁₀——断点
// 仍写在显示（线性）空间（人类可读阈值），对数变换由渲染入口一处复合；图例直读
// breaks 恒得线性原值。对数偏态场（降水率）的分级口径，与档位模式正交；零值
// log₁₀→−Inf 走非有限透明通道；断点须为正（log₁₀(≤0) 显式抛错）
const prateScale = {
  breaks: thresholdBreaks([0.1, 1, 5, 10]), // mm/h：小毛毛雨/中雨/大雨/暴雨量级
  colors: ["#fff7fb", "#74a9cf", "#023858"],
  transparentBins: new Set([0]), // [0, 0.1) mm/h 零值堆＋微量透明
  logScale: true,
};
```

## 等值线几何与 L/H 中心（气压切片起）

```ts
import { contoursOf, centersOf, prmslProfile } from "@metweave/grid";

// 格点场 → 等值线几何（纯函数、零 DOM、Node 可测）：值先经 convert 进显示单位空间
// （如 Pa→hPa ÷100），threshold 取场值域开区间 (min, max) 内的 interval 整数倍
// （及 minorInterval 整数倍）——环的描边即等值线，宿主以 polyline/SVG 描环即得线
const lines = contoursOf(grid, prmslProfile.contours, prmslProfile.toDisplay);
lines[0]; // → { value: 1002, kind: "minor" | "major" | "highlighted",
//            rings: [[[lat, lon], …]…] }（值升序；环闭合＝首尾点相同；
//            kind：interval 倍数＝major（常规线）、minorInterval 倍数且非 interval
//            倍数＝minor（加密细线）、档案 highlighted 点名＝特值线优先）
// 值域端点上的倍数不出线（贴边环无信息量）；场外特值静默跳过；缺测 NaN 按「低于
// 一切阈值」环绕缺测孔不穿越（与色斑渲染同一缺测纪律）；min/max 从场值现算
//（不读容器头 stats）。坐标换算与色斑栅格同一几何口径（格点中心、半格外延），
// 等值线与填色档界对齐。

// 格点场 → 低压「L」/高压「H」中心（滑窗极值＋深度贪心吸收，气象读图惯例的内容锚）
const centers = centersOf(grid, {
  convert: prmslProfile.toDisplay, // 检测与输出全程显示单位空间
  radius: 16, // 极值判定与吸收半径（格点数，缺省 16——0.25° 网格即 4°，天气系统尺度）
  minDepth: 2, // 显著深度护栏（显示单位，缺省 0）：平坦背景场的并列最值假阳性护栏
});
centers[0]; // → { kind: "low" | "high", lat, lon, value }（low 值升序在前、high 降序在后）
```

## 风场合成与风向杆（风切片起）

```ts
import { windSpeedGrid, windBarbsOf, windProfile } from "@metweave/grid";

// u/v 双场 → 风速合成场 √(u²+v²)（纯函数——**前端派生显示量，存储不动**：磁盘上的
// 分量容器保持原值，合成只发生在显示侧）。合成头 variable "WIND"、层/单位/几何/meta
// 沿 u 场头、stats 对合成值现算；任一分量 NaN → 该点 NaN（矢量未知）。两场网格
// 几何/量纲不匹配显式抛错（grid-mismatch）。产物直接喂 renderToImageData/
// addGridLayer（windProfile 的色标/档位即按合成场立档）。
const speed = windSpeedGrid(uGrid, vGrid);

// u/v 双场 × 档案杆口径 → 杆位序列（抽稀格点上的风向/风速；杆是点观测语义，方向
// 读格点原值不插值）。风向＝气象来向口径（0–360°，北 0／东 90）；静风阈以下与
// 任一分量缺测的格点不出杆；缩放无关固定步长（v1 无 LOD）。
const barbs = windBarbsOf(uGrid, vGrid, windProfile.barbs);
barbs[0]; // → { lat, lon, direction: 270, speed: 5 }（方向/速度数学锚见 wind.test）
```

## 要素档案（色标与档位的单一事实来源）

```ts
import { tmpProfile } from "@metweave/grid";

tmpProfile.shortName; // "tmp"（gen:grid 的要素键）
tmpProfile.toDisplay; // K→°C 换算（−273.15）
tmpProfile.colorStops; // 发散热带蓝-白-红（ColorBrewer RdBu 反向，白心钉 0°C）
tmpProfile.equal; // { min: -40, max: 40, bins: 20 }（等距 4°C ×20 档）
tmpProfile.quantile; // [0.1, 0.25, 0.5, 0.75, 0.9]（分位数 6 档）
tmpProfile.contours; // { interval: 4, highlighted: [0] }（等值线口径；filled 形态留位不消费）
```

每要素一文件（`elements/<short-name>.ts`），档案之间零 import——加要素＝加档案文件，内核零改动；组件（`@metweave/leaflet` 的 `addGridLayer`）与演示页共用同一份档案口径。等距/分位推荐参数在 `defaultMode` 为 threshold 的要素上可缺席（缺省模式缺对应推荐参数由 `buildColorScale` 显式抛错）。已入档：`tmpProfile`（2m 温度，上例）、`dptProfile`（2m 露点：绿系单色渐进浅→深＝干→湿、等距 [-40,30]°C×5°C×14 档、等值线 2°C 留位）、`rhProfile`（相对湿度：黄-绿-蓝单色渐进浅→深＝干→湿、有界场等距 0–100%×10%×10 档——0 与 100 恰为两端外延档界、断点 10…90 共 9 个，等值线 10% 留位）、`capeProfile`（对流有效位能：暖色渐进 ColorBrewer YlOrRd 浅→深＝弱→强、**阈值档 1000/2500/4000 J/kg×4 档**——无/中度/强/极强对流潜势，**首档透明**（零值堆不上色、底图透出，`transparentBins: [0]`）、等值线 500 J/kg 留位）、`prateProfile`（降水率：蓝紫系单色渐进 ColorBrewer PuBu 浅→深＝弱→强、**阈值档 0.1/1/5/10 mm/h×5 档＋log₁₀ 前置变换**（`logScale: true`——断点线性声明、定档前对值与断点统一取 log₁₀，对数偏态场的分级口径）、**首档透明**（[0,0.1) mm/h 零值堆＋微量不上色，零值走 log₁₀→−Inf 非有限透明通道）、kg m-2 s-1→mm/h ×3600、等值线 1 mm/h 留位）、`visProfile`（能见度：**逆向发散渐进** ColorBrewer RdYlBu 低→高＝差→好红→蓝（差能见度醒目）、**航空阈值档 0.4/0.8/1.5/3/5/10 km×7 档**（METAR 能见度 tier 同族）、**满量程哨兵不透明**——24130 m＝「≥24.1 km」打包真值落最高档 [10,∞) 正常着色（与 cape/prate 首档透明相反：「极好能见度」是强信号不透明）、图例**末档注记** `topBinNote: "≥24.1（满量程）"`、m→km ÷1000、等值线 1 km 留位）、`refcProfile`（模拟反射率：**NWS 标准反射率色标** 15 级 5–75 dBZ 各级一色（公开实现双源核证，档案头注出处）、**阈值档 5 dBZ 一档×16 档**、**首档透明**——−20 无回波哨兵（约 3/4 点打包真值）落 [−∞,5) 不画底图透出，dB=dBZ 恒等、等值线 5 dBZ 留位）、`prmslProfile`（海平面气压：**等值线主导形态** `renderForm: "filled+contours"`——Pa→hPa ÷100、浅填色 RdBu 内七段〔低蓝→白→高红，白心中位停靠钉 1014 hPa 档心〕、等距固定域 [984,1044]×4 hPa×15 档（域端点与全部断点均为 4 的整数倍，**填色档界与等值线天然对齐**）、**等值线 4 hPa 常规线标值＋2 hPa 加密细线**（`contours: { interval: 4, minorInterval: 2, highlighted: [] }`）＋低压「L」/高压「H」中心标注；上图画线见 `@metweave/leaflet` 的 `addContourLayer`）、`ghProfile`（500hPa 高度：**等值线主导形态**第二要素、**特值线高亮首个消费要素**——gpm 恒等直读（÷10 dam 候选弃用：5880 是 gpm 口径的中文气象圈最强认知锚，标注直读 5880）、浅渐进单色 ColorBrewer Blues 内七段〔低浅高深＝槽浅脊深〕、等距固定域 [5040,5940]×60 gpm×15 档（全部断点为 60 的整数倍、**末断点恰为 5880——填色档界与特值线对齐，副高体起最深档**）、**等值线 60 gpm 常规线标值＋5880 特值线红色加粗、标注同色**（`contours: { interval: 60, highlighted: [5880] }`，无加密线——500hPa 高度图惯例不加密）；上图画线见 `@metweave/leaflet` 的 `addContourLayer`，特值线色走其 `highlightColor` 选项）、`spProfile`（地面气压：**等值线主导形态**第三要素——**零改动路径第二证**〔复用三件套，内核/leaflet/面板零改动〕；短名 `pres` 对齐 gen:grid CLI 的 ELEMENTS 键〔「拉最新」链路直通——调研表 A/B 行名 sp＝surface pressure 气象惯用缩写，导出名沿用〕、Pa→hPa ÷100、**含地形效应的连续场**〔高原 500 hPa 级极低值非天气低压〕；浅渐进单色 ColorBrewer Purples 九级裁去最深四段得**五停靠**〔低浅高深——与 RdBu/Blues 三分；裁深动因：地形双峰分布下七停靠时平原簇整体压进最末深紫段，0.6 不透明度下视觉近黑〕、等距固定域 [488,1064]×8 hPa×72 档（**档宽 8 hPa 裁量**：值域跨 576 hPa，4 hPa 档宽 141 档相邻色差不可辨；断点全为 8 的整数倍，**填色档界与 16 hPa 等值线对齐每两色界一线**）、**等值线 16 hPa 常规线标值＋无加密线**（4→16 hPa 可读性裁量：真实场 4 hPa 间隔下高原坡面约每 2 像素一线不可读；地形噪声亦不宜加密——细密度分析由 prmsl 的 4/2 hPa 双密度承担，sp 定位「地形如实底衬＋稀参考线」）＋无特值线（气压无 0°C/5880 类认知锚）、L/H 中心检测照常开启〔高原极低值中心与天气尺度中心并存——地形如实原则〕）、`t850Profile`（850hPa 温度：**零新能力切片**——与 tmp 同族同色带口径的高空温度，色标/档位/等值线留位/渲染形态与 tmp 逐字段同构；短名 `t850` 对齐 gen:grid CLI 的 ELEMENTS 键〔「拉最新」链路直通〕、K→°C −273.15、发散热带 RdBu 反向 9 停靠**白心钉 0°C**、**等距与 tmp 同域 [-40,40]°C×4°C×20 档**（表 B「同 2t 带」字面继承：对称域使 0°C 恰为档界兼白心，同域另得跨要素可比——同一色＝同一温度，2m↔850hPa 垂直热结构切换可读；断点全 4 的整数倍与留位等值线对齐）＋分位 p10/p25/p50/p75/p90 双模式；**等温线接线 `renderForm: "filled+contours"`＋`contours: { interval: 4, highlighted: [0], centers: false }`**（2026-10-07 定案「只描等值线，不标注中心」——0°C 特值线红色加粗＝850hPa 零度层降水形态判据常识锚；`centers: false` 关闭气压习语的 L/H 中心标注〔冷中心≠低压，语义错位〕——`ContourSpec.centers` 可选字段缺省 true，气压场要素不受影响））、`tcdcProfile`（总云量：**零新能力切片**——与 rh 同为 0–100% 有界场的纯加档案，内核/leaflet/面板零改动；短名 `tcdc` 对齐 gen:grid CLI 的 ELEMENTS 键〔「拉最新」链路直通——调研表 A/B 行名 tcc（total cloud cover 惯用缩写），gen 键随变量名 TCDC 小写〕、TCDC/整层大气（atm）/% 恒等；**灰白渐进** ColorBrewer Greys 九级裁去最深两档〔近墨色〕得七停靠——晴→阴＝浅白→深灰；**等距有界场特例 [0,100]%×25%×4 档**＝云量业务 4 级制〔晴/少云/多云/阴——表 B「等距档 0/25/50/75/100」五个档界值的字面继承，断点 25/50/75 恰为留位等值线线位、图例五刻度原样可读；与 rh 的 10% 档差异是业务口径〕；**分位推荐不立**——饱和偏高的场分位失效〔中国域窗实测 p75=p90=100 贴顶退化，quantileBreaks 严格递增校验直接抛错；表 A 全球调研 p50 98.9 同族：GFS 云量偏差向 0/100 两端堆积，demo 一眼「满屏多云」即其直观形态——内容叙事点如实渲染〕；`renderForm: "filled"`〔表 B 主形态〕、等值线 25% **留位**〔表 B 等值线列「无」，若接线 25/50/75 三线恰与填色档界重合〕）、`windProfile`（10m 风：**双分量合成＋风向杆形态** `renderForm: "filled+barbs"`——格点线首个双分量要素〔一个要素位 ↔ windu/windv 两个数据文件，装载期 `windSpeedGrid` 合成、分量原值留作杆层原料〕；短名 `wind` 对齐 gen:grid CLI 的 ELEMENTS 键〔「拉最新」→ `--element wind` 单请求双 message 产双文件〕；UGRD/VGRD/10m/m s-1 有符号分量**不作独立色斑**（表 B 口径——风速合成 √(u²+v²) 才是渲染目标，**存储不动**）、m/s 恒等直读；暖色渐进 ColorBrewer YlOrBr 九级裁最深两档〔弱风浅黄→强风深橙棕——「风大＝警示色深」直觉带，与 cape 的 YlOrRd 同暖调不同族〕；**等距固定域 [0,32]×4 m/s×8 档**（0 恰为物理下界、断点全 4 倍数图例直读 0/4/…/32、蒲福 12 级界 32.7 落上外延档兜台风极端；分位不立——风速无业务分位口径，可比性锚是固定档界）；**杆口径 `barbs: { step: 10, calmThreshold: 1 }`**（2.5° 一根＝地面分析图惯例密度、静风 <1 m/s 不画杆；风羽 m/s 中国口径旗 20/长划 4/短划 2——见 `@metweave/leaflet` 的 `addWindBarbLayer`）、等值线 4 m/s 留位〔若接线恰与填色档界重合〕）

`topBinNote`（可选字段）：threshold 档图例的末缘文字注记——末档外延无界不标上缘，但源场可能在量程顶饱和（满量程哨兵＝打包真值非缺测），注记让「末档颜色实为满量程及以上」在图例可读；图例端（examples 面板）渲染在刻度序列之外，缺席＝不渲染。

`barbs`（可选字段，`BarbSpec { step, calmThreshold }`）：风向杆口径——`renderForm: "filled+barbs"` 形态要素声明，内核 `windBarbsOf` 按此出杆位序列、`@metweave/leaflet` 的 `addWindBarbLayer` 装配（色斑层吃 `windSpeedGrid` 合成场、杆层吃分量原场，两 API 正交组合）。缺席＝无杆。

## 许可

MIT
