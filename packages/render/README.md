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

## 风序列图组件（v0.6「垂直与时间」批次）

```ts
import {
  windProfileChart,
  hodograph,
  windTimeHeight,
  gustBand,
  windDirStrip,
  windObservationSeries,
  windComponentsOf,
} from "@metweave/render";
```

五个风的垂直/时间序列图组件＋两件工具，输入契约集中在 `wind-profile.ts`（`WindProfile` 多层廓线、`WindTimeHeightSeries` 二维剖面、`WindHourlySeries` 逐时观测三种形态——值字段 `number | null`，null＝缺测）：

- `windProfileChart(levels, { unit })`——风廓线：气压对数轴（探空惯例；层数据只带高度时退线性高度轴）、逐层方向箭头；≥6 层起画，缺测层断线＋「缺测」短划；`glyph:"barb"` 切**垂直风羽模式**（风廓线面板形态：每层一枚居中的完整风羽、按风速着色——色标必传且随件内嵌图例；等行距布层图高自适应、静风＝着色圆圈；刻度选项与 windTimeHeight 的 barb 族同款）。
- `hodograph(samples)`——高空风图：每层风矢量画成 u/v 平面端点，端点连线＝层间切变矢量（线长＝切变大小）；低空段（缺省 0–1 km，`highlight` 自定）高亮分色；≥8 层起画。
- `windTimeHeight(series2d, { scale })`——时间-高度剖面：多层×多时刻热图，风速当色（`scale` 必传——与场图家族同一份档案色标，组件内嵌 `renderColorScaleLegend`）、风向当标记、缺测格不着色（浅灰斜纹）；列标签按估宽自动抽稀（长标签稀疏示出，格阵过窄＋超长标签时宿主可传短标签——grid 适配器 `timeLabel: "short"` 直出「日T时Z」）；`windGlyph: "barb"` 切**风羽标记**（时间-高度风羽剖面图：杆指来向、旗/划＝可数风速、静风＝圆圈、尺寸随 `cellWidth` 自适应降级——缺省 arrow 零变化；刻度经 `barbScale` 直传 `@metweave/grid` 的 `WIND_BARB_SCALES`，编码口径单源在 grid、render 只做几何）；`shaded: false` 切符号主导形态（格底透明、内嵌色标不画，符号层全保留——缺省 true 零变化）。
- `gustBand(series)`——风速时序＋阵风：平均风速折线＋包络带；**阵风按事件画独立标记**（时次间不连线不铺带——阵风是事件性观测，连线＝编造），缺测时次断线。
- `windDirStrip(series)`——风向时序条：HSL 色相环直接当风向环（色相角＝风向角，循环量天然无缝——350° 与 10° 相邻不断裂）；静风/缺测各有专属形态；方向越界（0–360 之外）显式抛错。
- `windComponentsOf(direction, speed)`——风向/风速 → u/v 分量（高空风图的极坐标数学单源，与 grid 的 `windDirectionOf` 互逆）。
- `windObservationSeries(rows)`——观测逐时行缺测容忍归一（占位串/空串/越界哨兵 → null），IEM 一类逐时源直喂。

单位口径与 `windBarbOf` 同纪律：`unit` 是**量纲声明不是换算开关**（传 `"kt"` 意味数值已是 kt；m/s → kt 折算走 `@metweave/grid` 的 `toKnots`）。多层场 → 廓线/剖面的数据管道在 `@metweave/grid` 的 `windProfileOf` / `windTimeHeightOf`（产出结构与本包输入类型逐字段兼容——包间零依赖，同 `ColorScaleLegendInput` 的配对纪律）。

## 许可

[MIT](https://github.com/yaojaro/metweave/blob/main/LICENSE) © 2026 YaoJaro——授权仅覆盖本仓库的代码与文档；随包分发的报文样本不在其列，详见主仓库 README 的「许可」说明。
