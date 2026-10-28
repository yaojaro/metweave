/**
 * @metweave/render — 风的垂直与时间序列输入类型（v0.6「垂直与时间」批次）。
 *
 * 本文件是五个图组件（windProfileChart / hodograph / windTimeHeight / gustBand /
 * windDirStrip）的**输入契约单一来源**：多层廓线、多层×多时刻二维序列、逐时观测序列
 * 三种形态的类型定义，加上两件小工具——风向/风速 → u/v 分量（高空风图的极坐标数学）
 * 与观测逐时行的缺测容忍归一适配器。
 *
 * **与 @metweave/grid 的结构配对**（同 color-scale-legend 的 ColorScaleLegendInput 纪律）：
 * grid 侧的 `windProfileOf` / `windTimeHeightOf` 适配器从 u/v 多层场派生出的序列
 * 结构上逐字段等于这里的类型——render 不依赖 grid（渲染组件不背格点场），grid 也不
 * 依赖 render，接缝处的类型一致性由消费方（examples 一类宿主）的 typecheck 兜住。
 *
 * 缺测口径（全批次统一）：值字段 `number | null`，null＝缺测（不含糊、不编造）；
 * 组件对非法值（负风速、越界风向）显式抛错——本文件只定义形状，合法性由各组件入口校验。
 */
import type { ColorScaleLegendInput } from "./color-scale-legend";

// ---------------------------------------------------------------- 多层廓线（W-10/W-11 输入）

/**
 * 一层高空风读数。层锚（pressure / height）至少其一在场——垂直坐标从哪来是数据的事，
 * 组件只认锚；风矢量的两个读数各自可缺测（speed null＝该层风速缺测，direction null＝
 * 该层风向缺测或静风无方向——**静风口径**：风速为 0 时方向无意义，供数方应置 null，
 * 组件对 speed 0 且 direction 在场的组合不猜不判、照画）。
 */
export interface WindProfileLevel {
  /** 层锚一：气压（hPa，正有限数）。与 height 至少其一 */
  readonly pressure?: number | null;
  /** 层锚二：位势高度（m，≥0 有限数；地面层可为 0） */
  readonly height?: number | null;
  /** 风速（量纲由组件的 unit 选项声明；≥0 有限数或 null＝缺测） */
  readonly speed?: number | null;
  /** 风向（气象口径**来向**，0–360°，北 0／东 90／南 180／西 270；null＝缺测） */
  readonly direction?: number | null;
}

/** 多层风廓线（W-10 风廓线图 / W-11 高空风图的输入）。层序任意——组件按层锚自排。 */
export type WindProfile = readonly WindProfileLevel[];

// ---------------------------------------------------------------- 多层×多时刻（W-12 输入）

/** 二维序列的一个单元格：某层某时刻的风读数（两值各自可缺测）。 */
export interface WindTimeHeightCell {
  /** 风速（量纲由组件的 unit 选项声明；≥0 有限数或 null＝缺测） */
  readonly speed?: number | null;
  /** 风向（来向 0–360°；null＝缺测） */
  readonly direction?: number | null;
}

/** 二维序列的一行：一个层锚 × 逐时刻单元列（cells 与 series.times 逐位对齐）。 */
export interface WindTimeHeightLevel {
  /** 层锚一：气压（hPa）。与 height 至少其一 */
  readonly pressure?: number | null;
  /** 层锚二：位势高度（m） */
  readonly height?: number | null;
  readonly cells: readonly WindTimeHeightCell[];
}

/**
 * 多层×多时刻二维序列（W-12 时间-高度剖面的输入）。times 为时刻标签串（ISO 或宿主
 * 自定标签——组件按序等距布列、不解析时刻算术）；组件对列标签按估宽自动抽稀（长
 * 标签稀疏示出、不重叠），但格阵过窄＋标签超长时首尾两枚仍可能紧挤——需要更密的
 * 标签时请传短标签（`@metweave/grid` 适配器 `windTimeHeightOf` 的 `timeLabel:
 * "short"` 直出「日T时Z」形态）。levels 每行 cells 长度必须等于 times 长度（组件
 * 入口校验）。
 */
export interface WindTimeHeightSeries {
  readonly times: readonly string[];
  readonly levels: readonly WindTimeHeightLevel[];
}

// ---------------------------------------------------------------- 逐时观测序列（W-13/W-14 输入）

/**
 * 一小时的风观测（W-13 风速时序＋阵风标记 / W-14 风向时序条的输入）。speed / gust /
 * direction 各自可缺测——观测世界的常态（IEM 一类逐时源里阵风只在有阵风时报、
 * 静风时方向无意义）。
 */
export interface WindHourlySample {
  /** 时刻标签串（ISO 或宿主自定——组件按序等距布列，不解析时刻算术） */
  readonly time: string;
  /** 平均风速（≥0 有限数或 null＝缺测） */
  readonly speed?: number | null;
  /** 阵风（≥0 有限数或 null＝该时次无阵风观测） */
  readonly gust?: number | null;
  /** 风向（来向 0–360°；null＝缺测；静风置 null） */
  readonly direction?: number | null;
}

/** 逐时观测序列。 */
export type WindHourlySeries = readonly WindHourlySample[];

// ---------------------------------------------------------------- 风羽刻度（W-12 barb 模式的入参契约）

/**
 * 一套风羽填图刻度（旗/长划/短划各代表的风速，同 unit 量纲）。**结构与
 * @metweave/grid 的 `WindBarbScale` 逐字段兼容、数字不在 render 复制第二份**——
 * 宿主一行直传 `WIND_BARB_SCALES`（kt：旗 50/长划 10/短划 5；m/s：旗 20/长划 4/
 * 短划 2，单一事实来源在 grid；同 ColorScaleLegendInput 的包间配对纪律）。
 */
export interface WindBarbScaleInput {
  /** 三角旗代表的风速（同所属刻度量纲） */
  readonly pennant: number;
  /** 长划代表的风速 */
  readonly long: number;
  /** 短划代表的风速 */
  readonly short: number;
}

// ---------------------------------------------------------------- 量纲声明（五组件单源）

/** 风速量纲声明（`"mps"` 是 `"m/s"` 的别名——IR 的 SpeedUnit 写法直传不查文档）。 */
export type WindDisplayUnitInput = "m/s" | "kt" | "mps";

/**
 * 量纲声明归一化＋校验（五个图组件的 unit 选项共用单源，v0.6 P2 修复——此前四处
 * 内联复制且报错文案微差）。只映射别名，不做数值换算：传 `"kt"` 意味着数值已是
 * kt（m/s → kt 折算走 `@metweave/grid` 的 `toKnots`）。非法值显式抛错，文案统一
 * 带 `caller`（调用方组件名）。
 */
export function normalizeWindDisplayUnit(
  unit: WindDisplayUnitInput | undefined,
  caller: string,
): "m/s" | "kt" {
  if (unit === undefined) return "m/s";
  if (unit === "mps") return "m/s";
  if (unit === "m/s" || unit === "kt") return unit;
  const bad: string = unit; // never 收窄后的宽化中转（同 card.ts）
  throw new Error(
    `${caller} 的 unit 选项值 "${bad}" 不受支持（可用："m/s" | "kt"；"mps" 为别名——量纲声明不换算数值，换算走 @metweave/grid 的 toKnots）`,
  );
}

// ---------------------------------------------------------------- 档色映射（「色斑长在符号上」的单源）

/**
 * 风速 → 分级色标的档色（纯函数）：`count(breaks ≤ v)` 即档序、值域外高档兜底取
 * 末色——与场图口径同式。W-10 风羽廓线（风羽按风速着色）与 W-12 色斑格共用的单源
 * （色卡本身由调用方传入，render 不存口径）。
 */
export function colorAt(speed: number, scale: ColorScaleLegendInput): string {
  let bin = 0;
  for (const b of scale.breaks) {
    if (speed >= b) bin += 1;
  }
  const maxBin = scale.colors.length - 1;
  return scale.colors[Math.min(bin, maxBin)] ?? "#e8ecf1";
}

// ---------------------------------------------------------------- 分量数学（高空风图的地基）

/**
 * 风向/风速 → u/v 分量（纯函数，零 DOM）——高空风图（hodograph）端点数学的单一来源。
 *
 * 气象口径：direction 为**来向**，u＝东向分量、v＝北向分量（去向的分量）：
 * `u = −speed·sin(dir·π/180)`、`v = −speed·cos(dir·π/180)`——西风 270° → u=+speed
 * （向东吹）、北风 0° → v=−speed（向南吹）。与 grid 的 `windDirectionOf`（u/v → 来向）
 * 互为逆运算；NaN 入 NaN 出（不校验——校验是组件入口的事，数学层保持透明）。
 */
export function windComponentsOf(
  direction: number,
  speed: number,
): {
  readonly u: number;
  readonly v: number;
} {
  const rad = (direction * Math.PI) / 180;
  return { u: -speed * Math.sin(rad), v: -speed * Math.cos(rad) };
}

// ---------------------------------------------------------------- 观测逐时适配器（缺测容忍）

/** 观测源的一行原始读数：值域 `number | string | null | undefined` 全收（IEM 的 "M"、空串一类缺测占位就在这里）。 */
export interface WindObservationRow {
  readonly time: string;
  readonly speed?: number | string | null;
  readonly gust?: number | string | null;
  readonly direction?: number | string | null;
}

/** 观测原始值 → 有限数或 null：数字直取、字符串尝试 Number()、空串/非数/非有限/负值一律 null（缺测容忍）。 */
function parseObsValue(value: number | string | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }
  return null;
}

/**
 * 观测逐时行 → 归一的逐时序列（缺测容忍适配器，纯函数零 DOM）。
 *
 * 观测源（如 IEM 的逐时表）的缺测形态五花八门：占位串（"M"、"NULL"）、空串、
 * undefined、有时是哨兵数（方向 999 一类）。本适配器把这一切归一成组件契约里的
 * `number | null`——**数值合法即收、其余一律 null**（不抛错：观测管道的缺测是常态
 * 不是错误；组件层另有严格校验管直接调用方的非法值，两层分工）。
 *
 * 越界方向（如 999）也归 null：逐时观测源把越界当缺测占位用是行业常态，逐条抛错
 * 会让一条脏行废掉整段序列。归一后的序列喂给 windDirStrip 一类组件不会再触发
 * 越界报错（null 是合法缺测）。
 *
 * @param rows - 观测原始行（time 必填；speed/gust/direction 可缺）
 */
export function windObservationSeries(rows: readonly WindObservationRow[]): WindHourlySeries {
  return rows.map((row) => {
    const direction = parseObsValue(row.direction);
    return {
      time: row.time,
      speed: parseObsValue(row.speed),
      gust: parseObsValue(row.gust),
      // 方向归一后还要过值域：0–360 之外（哨兵数）按缺测收
      direction: direction !== null && direction <= 360 ? direction : null,
    };
  });
}
