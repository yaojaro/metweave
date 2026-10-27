/**
 * @metweave/grid — 双分量风场合成与风向杆位序列（风切片、第十三切片引入）。
 *
 * 两个能力均为纯函数、零 DOM（Node 可测）：
 * - `windSpeedGrid`：u/v 双场 → 风速合成场 √(u²+v²)——**前端派生显示量，存储不动**
 *  （.mwgrid 容器各自原值装载 u/v，合成只发生在渲染/显示侧——docs/10 十五节表 B
 *  「10u/10v 不作独立色斑、渲染目标=风速合成」口径）；
 * - `windBarbsOf`：u/v 双场 × 档案杆口径 → 杆位序列 [{lat, lon, direction, speed}]
 *  （抽稀步长×静风阈，风向 atan2 同源派生）——宿主（@metweave/leaflet 的
 *  addWindBarbLayer）只做矢量装配，几何与数学全在此层（Node 可测）。
 *
 * 缺测语义（与色斑/等值线同一纪律）：u/v 任一分量 NaN → 该点风速 NaN（矢量未知，
 * 透明/不画杆）——Math.hypot 的 NaN 传播天然给出该语义，无需显式分支。
 */
import { GridError } from "./errors";
import { computeStats } from "./format";
import type { Grid } from "./format";
import type { BarbSpec } from "./element";

/**
 * 双场一致性校验：网格几何（nx/ny/la0/lo0/di/dj）与量纲（unit）逐项相等——合成是
 * 逐点配对运算，两场不同网格/不同量纲即数学上不成立，显式抛错（不静默纪律）。
 */
function assertPairedFields(u: Grid, v: Grid): void {
  const gu = u.header.grid;
  const gv = v.header.grid;
  if (
    gu.nx !== gv.nx ||
    gu.ny !== gv.ny ||
    gu.la0 !== gv.la0 ||
    gu.lo0 !== gv.lo0 ||
    gu.di !== gv.di ||
    gu.dj !== gv.dj
  ) {
    throw new GridError(
      "grid-mismatch",
      `双分量场网格几何不匹配（u ${gu.nx}×${gu.ny} @(${gu.la0},${gu.lo0}) ±${gu.di}/${gu.dj}` +
        ` ≠ v ${gv.nx}×${gv.ny} @(${gv.la0},${gv.lo0}) ±${gv.di}/${gv.dj}）——无法逐点配对合成`,
    );
  }
  if (u.header.unit !== v.header.unit) {
    throw new GridError(
      "grid-mismatch",
      `双分量场量纲不匹配（u "${u.header.unit}" ≠ v "${v.header.unit}"）——√(u²+v²) 只在同量纲下成立`,
    );
  }
}

/**
 * u/v 双场 → 风速合成场（√(u²+v²)，逐点 Math.hypot——分量量级悬殊时不溢出）。
 *
 * **存储不动的红线**：u/v 各自的 .mwgrid 原值装载，本函数是显示侧的派生装配——
 * 产物头 variable "WIND"（gen:grid CLI wind 条目 label WIND/10m 同名；分量文件头为
 * UGRD/VGRD，层与单位沿 u 场头——m/s 标量场），stats 对合成值现算（直读产物的
 * 色斑/图例拿到的是风速分布，不是 u 分量分布），meta 沿 u 场头（两文件同 cycle
 * 同源产出）。任一分量 NaN → 该点 NaN（矢量未知；hypot 天然传播）。
 */
export function windSpeedGrid(u: Grid, v: Grid): Grid {
  assertPairedFields(u, v);
  const n = u.values.length;
  const speeds = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    speeds[i] = Math.hypot(u.values[i] ?? Number.NaN, v.values[i] ?? Number.NaN);
  }
  return {
    header: {
      version: 1,
      variable: "WIND",
      level: u.header.level,
      unit: u.header.unit,
      grid: u.header.grid,
      stats: computeStats(speeds),
      meta: u.header.meta,
    },
    values: speeds,
  };
}

/** 一根风向杆：位置（格点中心）＋风向（气象口径）＋合成风速。 */
export interface WindBarb {
  readonly lat: number;
  readonly lon: number;
  /** 风向（气象口径**来向**，0–360°，北 0／东 90／南 180／西 270；由 atan2(v,u) 派生：dir = (270° − atan2 角) mod 360） */
  readonly direction: number;
  /** 合成风速 √(u²+v²)（m/s，与 windSpeedGrid 同源同值——宿主无需二次合成） */
  readonly speed: number;
}

/**
 * 杆口径校验（与 assertBreaks/assertContourSpec 同一道关口纪律）。
 */
function assertBarbSpec(spec: BarbSpec): void {
  if (!Number.isInteger(spec.step) || spec.step < 1) {
    throw new GridError(
      "invalid-scale",
      `风向杆抽稀步长非法（step=${String(spec.step)}，须 ≥1 的整数）`,
    );
  }
  if (!Number.isFinite(spec.calmThreshold) || spec.calmThreshold < 0) {
    throw new GridError(
      "invalid-scale",
      `风向杆静风阈值非法（calmThreshold=${String(spec.calmThreshold)}，须 ≥0 的有限数）`,
    );
  }
  const lod = spec.lod;
  if (lod === undefined) return;
  if (lod.length === 0) {
    throw new GridError("invalid-scale", "风向杆 LOD 阶梯为空数组（要么给 ≥1 级，要么整字段缺席）");
  }
  // 不校验「首级 step ≤ spec.step」：本仓 wind 档案刻意让首级（zoom 0）比缺省 step 更疏
  // （全国视角 5° 一根），而缺省 step 必须保持 v0.3.1 的 10（不传 zoom 的既有行为）。
  // 两条缺省各自成立，语义差异见 windBarbStepAt 文档——不当作错误拦。
  let prevZoom = Number.NEGATIVE_INFINITY;
  let prevStep = Number.POSITIVE_INFINITY;
  for (const [index, entry] of lod.entries()) {
    if (!Number.isFinite(entry.zoom)) {
      throw new GridError(
        "invalid-scale",
        `风向杆 LOD 第 ${index + 1} 级 zoom 非法（${String(entry.zoom)}，须为有限数）`,
      );
    }
    if (!Number.isInteger(entry.step) || entry.step < 1) {
      throw new GridError(
        "invalid-scale",
        `风向杆 LOD 第 ${index + 1} 级 step 非法（${String(entry.step)}，须 ≥1 的整数）`,
      );
    }
    if (entry.zoom <= prevZoom) {
      throw new GridError(
        "invalid-scale",
        `风向杆 LOD 阶梯 zoom 须严格递增（第 ${index + 1} 级 ${entry.zoom} ≤ 前一级 ${prevZoom}）——` +
          "乱序阶梯会让命中规则不可预测",
      );
    }
    if (entry.step >= prevStep) {
      throw new GridError(
        "invalid-scale",
        `风向杆 LOD 阶梯 step 须严格递减（第 ${index + 1} 级 ${entry.step} ≥ 前一级 ${prevStep}）——` +
          "放大更密是 LOD 的定义，反着写等于放大更疏",
      );
    }
    prevZoom = entry.zoom;
    prevStep = entry.step;
  }
}

/**
 * 当前放大档 → 抽稀步长：取「zoom ≤ 当前档」的最后一级（放大越深步长越小）；
 * 当前档低于首级时用首级（阶梯即全档定义——首级之下没有更疏的档）。
 * **无 lod 或不传 zoom 一律回落 spec.step**——不传当前档时不推断密度（推断＝静默改图，
 * 且宿主与内核两处各算一遍必分歧）。
 *
 * 导出给宿主用（v0.3.2）：`@metweave/leaflet` 的杆层靠它判断「这一档的密度变没变」，
 * 档位没变就不重建整层 marker（560 枚全删全建的代价不该花在 zoom 4→5 这种同档跳动上）。
 */
export function windBarbStepAt(spec: BarbSpec, zoom: number | undefined): number {
  const lod = spec.lod;
  if (lod === undefined || zoom === undefined) return spec.step;
  let step = lod[0]?.step ?? spec.step;
  for (const entry of lod) {
    if (zoom >= entry.zoom) step = entry.step;
    else break;
  }
  return step;
}

/** 杆位序列的附加输入（v0.3.2 加 LOD）：当前放大档，仅 `lod` 阶梯存在时生效。 */
export interface WindBarbsOptions {
  /** 当前地图放大级（leaflet zoom 语义）；缺省＝不用 LOD、按档案 step 出杆 */
  readonly zoom?: number;
}

/**
 * u/v 双场 × 杆口径 → 杆位序列（抽稀格点上的风向/风速，纯函数）。
 *
 * 抽稀＝两向同 step 的格点子采样，起点对网格中心对齐（`floor(((n−1) % step) / 2)`——
 * 中国域 280×208、step 10 时列首 4／行首 3，约 560 个格位）；密度由「步长」决定——
 * 不传 zoom 时用档案 `step`（**缩放无关的固定密度，v0.3.1 行为**），传 zoom 且档案声明
 * `lod` 时按阶梯命中当级步长（v0.3.2 起；放大更密）。方向读格点原值（不插值——
 * 杆是点观测语义，格点值即代表值）。静风阈（calmThreshold）以下与任一分量 NaN 的
 * 格点不出杆（静风无方向可读、缺测无值可画）。风向＝气象来向口径：
 * `dir = (270° − atan2(v, u)·180/π) mod 360`（u>0,v=0 西风 270、v>0,u=0 南风 180）。
 *
 * v0.3.2 起支持 LOD（`options.zoom` + 档案 `barbs.lod`）：命中阶梯当级 step，其余
 * 抽稀/静风/方向语义逐字不变；不传 options 或档案无 lod 时与 v0.3.1 逐字节同结果。
 */
export function windBarbsOf(
  u: Grid,
  v: Grid,
  spec: BarbSpec,
  options: WindBarbsOptions = {},
): WindBarb[] {
  assertPairedFields(u, v);
  assertBarbSpec(spec);
  for (const key of Object.keys(options)) {
    if (key !== "zoom") {
      throw new GridError(
        "invalid-scale",
        `windBarbsOf 收到未知选项 "${key}"（可用项：zoom）——拼错的选项不会生效`,
      );
    }
  }
  if (options.zoom !== undefined && !Number.isFinite(options.zoom)) {
    throw new GridError(
      "invalid-scale",
      `windBarbsOf 的 zoom 非有限数（${String(options.zoom)}）——须为地图放大级`,
    );
  }
  const step = windBarbStepAt(spec, options.zoom);
  const { nx, ny, la0, lo0, di, dj } = u.header.grid;
  const x0 = Math.floor(((nx - 1) % step) / 2);
  const y0 = Math.floor(((ny - 1) % step) / 2);
  const barbs: WindBarb[] = [];
  for (let y = y0; y < ny; y += step) {
    for (let x = x0; x < nx; x += step) {
      const uu = u.values[y * nx + x] ?? Number.NaN;
      const vv = v.values[y * nx + x] ?? Number.NaN;
      if (Number.isNaN(uu) || Number.isNaN(vv)) continue; // 缺测：矢量未知不画杆
      const speed = Math.hypot(uu, vv);
      if (speed < spec.calmThreshold) continue; // 静风：无方向可读不画杆
      const direction = (((270 - (Math.atan2(vv, uu) * 180) / Math.PI) % 360) + 360) % 360;
      barbs.push({ lat: la0 - y * dj, lon: lo0 + x * di, direction, speed });
    }
  }
  return barbs;
}

/**
 * 风羽填图单位口径（两套业务惯例）：`m/s`＝中国气象业务地面图（旗 20／长划 4／短划 2），
 * `kt`＝国际航空惯例（旗 50／长划 10／短划 5）。两套的**刻度比同构**（旗＝10 个短划、
 * 长划＝2 个短划），但阈值数值不同——编码只认单位，几何只认计数。
 *
 * 规范名只有两个；`"mps"`（IR 的 `SpeedUnit` 写法）作为 `"m/s"` 的**别名**收下并在入口
 * 归一化——用户手里最自然的是 `report.wind.speed.unit`，那串就是 `"mps"`，不能让他为了
 * 一个斜杠去查文档（产品审查 2.3）。
 */
export type WindSpeedUnit = "m/s" | "kt";

/** 入参可接受的单位写法（`"mps"` 是 `"m/s"` 的别名；`"kmh"` 不收——先 ÷3.6 换算）。 */
export type WindSpeedUnitInput = WindSpeedUnit | "mps";

/**
 * 单位入参归一化 + 校验：只映射别名，不猜量纲（数值必须**已经是**该单位下的数值——
 * 库里不做 m/s↔kt 的数值判断，那属于调用方的数据责任）。
 */
function normalizeUnit(unit: WindSpeedUnitInput | undefined): WindSpeedUnit {
  if (unit === undefined) return "m/s"; // 缺省 m/s＝中国气象业务惯例（v0.3.1 行为）
  if (unit === "mps") return "m/s";
  if (unit === "m/s" || unit === "kt") return unit;
  // 运行时兜底（JS 调用方）：给出可用项与 kmh 的处置办法，不只说「不支持」
  throw new GridError(
    "invalid-scale",
    `风速口径 ${String(unit)} 不受支持（可用："m/s"（别名 "mps"）| "kt"；` +
      `"kmh" 请先 ÷3.6 换算成 "m/s"）`,
  );
}

/** 一套填图口径的三级刻度：三角旗/长划/短划各代表的风速（单位同所属口径）。 */
export interface WindBarbScale {
  readonly pennant: number;
  readonly long: number;
  readonly short: number;
}

/**
 * 口径常量表——**单一事实来源**：内核编码（`windBarbOf`）、填图几何
 * （`@metweave/leaflet` 的 `windBarbPath`）、图例刻度（`@metweave/render` 的
 * `renderWindLegend`，经宿主导入）全部取这一份。任何一处另写数字＝两套口径从此分裂
 * （第三次加单位时必错，这是本批刻意收成单源的原因）。
 */
export const WIND_BARB_SCALES: Readonly<Record<WindSpeedUnit, WindBarbScale>> = Object.freeze({
  "m/s": Object.freeze({ pennant: 20, long: 4, short: 2 }),
  kt: Object.freeze({ pennant: 50, long: 10, short: 5 }),
});

/**
 * 图例组件（`@metweave/render` 的 `renderWindLegend`）的 `units` 入参就绪版：
 * 结构与 `WindLegendUnit` 相同（id/label/刻度），数字仍从 `WIND_BARB_SCALES` 派生。
 *
 * 存在的理由：图例口径数字必须单源，而 render 不依赖 grid——于是「搬数字」这件事
 * 不能让每个用户自己写一遍（产品审查 1.5：那要手搓 6 行）。宿主一行即可：
 * `renderWindLegend({ units: WIND_LEGEND_UNITS })`。
 */
export const WIND_LEGEND_UNITS: readonly {
  readonly id: string;
  readonly label: string;
  readonly pennant: number;
  readonly long: number;
  readonly short: number;
}[] = Object.freeze(
  (["m/s", "kt"] as const).map((id) =>
    Object.freeze({
      id,
      label: id,
      pennant: WIND_BARB_SCALES[id].pennant,
      long: WIND_BARB_SCALES[id].long,
      short: WIND_BARB_SCALES[id].short,
    }),
  ),
);

/**
 * 风速换算常数：1 kt = 0.514444 m/s（NIST SP 811 定义值，与 WMO 编报换算口径一致）。
 * 放在 grid（口径的单一事实来源所在处）而不是地图适配层——一个纯单位常数不该逼用户
 * `import` 整个 leaflet（产品审查 6.2）。
 */
export const MPS_PER_KT = 0.514444;

/** m/s → kt（供填图口径切换与内容示例复用；只做显示侧换算，不改存储语义）。 */
export const toKnots = (mps: number): number => mps / MPS_PER_KT;

/** kt → m/s。 */
export const toMps = (kt: number): number => kt * MPS_PER_KT;

/**
 * 一根杆的**速度编码**：三角旗/长划/短划各几根（不含几何——几何是渲染层的事，
 * 编码是「这根杆表示多少风」的领域结论，两件事分开才测得住）。
 */
export interface WindBarbEncoding {
  readonly unit: WindSpeedUnit;
  readonly pennants: number;
  readonly longs: number;
  readonly shorts: number;
  /** 编码取整后的风速（＝各级计数 × 该级刻度之和）；与入参 speed 之差 < 最小刻度 */
  readonly encodedSpeed: number;
}

/** 单点风羽原语的可选项。 */
export interface WindBarbOfOptions {
  /**
   * 填图口径（缺省 m/s＝中国气象业务惯例，与既有 `windBarbPath` 默认一致）。
   * 接受 `"mps"` 别名（IR 的写法）；`"kmh"` 不收（先 ÷3.6）。
   *
   * **它是量纲声明，不是换算开关**：传 `"kt"` 意味「speed 这个数字的单位是 kt」，
   * 库不会把 m/s 数值自动折成 kt。手上有 m/s、要出 kt 填图时，先用 `toKnots()` 换算
   * 再传——把 20（m/s）配 `{ unit: "kt" }` 会画成 20 kt（≈10.3 m/s）的一半风，而画面
   * 完全合法、不会有任何告警（产品审查 2.2 记档的误用陷阱）。
   */
  readonly unit?: WindSpeedUnitInput;
  /**
   * 静风阈值（**同 unit 量纲**）：speed 低于此值判静风、返回 null（不出杆——静风无
   * 方向可读）。**缺省 1**＝中国气象业务惯例（与档案 `barbs.calmThreshold: 1` 对齐，
   * 免得自绘层与地图层一个画一个不画）；要「0 风速也出光杆」显式传 0。
   *
   * 注意量纲：本阈值与 `unit` 一致。档案 `barbs.calmThreshold` 恒为 m/s 口径，
   * 出 kt 填图时 `addWindBarbLayer` 内部会折算（本函数不猜调用方的显示单位）。
   */
  readonly calmThreshold?: number;
}

/**
 * 单点风羽原语：风向 + 风速 → 这根杆的速度编码（纯函数，零 DOM）。
 *
 * 编码规则（两套口径同一算法，仅刻度不同）：先把风速**向下取整到最小刻度**，再按
 * 「旗 → 长划 → 短划」贪心分解。这与中国气象业务填图规范（m/s 旗 20/长划 4/短划 2）
 * 和航空惯例（kt 旗 50/长划 10/短划 5）逐条一致；两套口径同构的事实是「10/2/1 短划」
 * 位权，故几何层能复用同一套 path 生成器。
 *
 * 返回值：`WindBarbEncoding`；判静风时 `null`（调用方据此不画杆——`null` 而非零编码，
 * 是为了让「静风」与「0 风速但有杆」两件事在类型上不可混）。
 *
 * 校验（不静默纪律）：direction 须为 [0, 360] 的有限数（360＝正北，与 0 同义）；
 * speed 须为 ≥0 的有限数；未知选项键、非法 calmThreshold 显式抛 GridError。
 *
 * @param direction - 风向（气象口径**来向**，0–360°，北 0／东 90／南 180／西 270）
 * @param speed - 风速（单位由 options.unit 决定，缺省 m/s）
 */
export function windBarbOf(
  direction: number,
  speed: number,
  options: WindBarbOfOptions = {},
): WindBarbEncoding | null {
  for (const key of Object.keys(options)) {
    if (key !== "unit" && key !== "calmThreshold") {
      throw new GridError(
        "invalid-scale",
        `windBarbOf 收到未知选项 "${key}"（可用项：unit、calmThreshold）——拼错的选项不会生效`,
      );
    }
  }
  const unit = normalizeUnit(options.unit);
  const scale = WIND_BARB_SCALES[unit];
  if (!Number.isFinite(direction) || direction < 0 || direction > 360) {
    throw new GridError(
      "invalid-scale",
      `风向杆方向非法（${String(direction)}，须为 0–360 的有限数：北 0／东 90／南 180／西 270）`,
    );
  }
  if (!Number.isFinite(speed) || speed < 0) {
    throw new GridError(
      "invalid-scale",
      `风向杆风速非法（${String(speed)}，须为 ≥0 的有限数，单位 ${unit}）`,
    );
  }
  // 缺省 1（业务惯例）：与档案 barbs.calmThreshold 同值，避免自绘层与地图层不一致
  const calmThreshold = options.calmThreshold ?? 1;
  if (!Number.isFinite(calmThreshold) || calmThreshold < 0) {
    throw new GridError(
      "invalid-scale",
      `风向杆静风阈值非法（calmThreshold=${String(calmThreshold)}，须 ≥0 的有限数，单位 ${unit}）`,
    );
  }
  if (speed < calmThreshold) return null; // 静风：无方向可读，不出杆
  // 贪心分解（旗 → 长划 → 短划），**与 @metweave/leaflet 既有几何实现逐字同算法**：
  // 这是「默认 m/s 行为零变化」的落点——任何「先整体取整到最小刻度」的写法都会在
  // 19.999999 一类浮点边界上与 v0.3.1 分叉（一个出 1 旗、一个出 4 长划＋1 短划）。
  // 短划容差 1e-6 沿既有实现（float32 派生值舍入）。
  let rest = speed;
  const pennants = Math.floor(rest / scale.pennant);
  rest -= pennants * scale.pennant;
  const longs = Math.floor(rest / scale.long);
  rest -= longs * scale.long;
  const shorts = rest >= scale.short - 1e-6 ? 1 : 0;
  return {
    unit,
    pennants,
    longs,
    shorts,
    encodedSpeed: pennants * scale.pennant + longs * scale.long + shorts * scale.short,
  };
}

/**
 * 一条流线：种子点＋两向积分折线（经纬点列，**沿去向**行进——注意与杆/箭头的
 * 「来向」编码相反：流线画的是气流的路径本身，折线无方向语义，渲染只画线）。
 * `steps`＝前向＋后向累计积分步数（maxSteps 语义对账与测试用）。
 */
export interface Streamline {
  readonly points: ReadonlyArray<{ readonly lat: number; readonly lon: number }>;
  readonly steps: number;
}

/** 流线积分参数（全部可选、各有缺省；非法值显式抛 GridError，不静默修正）。 */
export interface StreamlinesOptions {
  /**
   * 种子间隔（格点数，两向同距，网格中心对齐——与 `windBarbsOf` 抽稀同一公式）。
   * **种子是人为的：流线密度不承载信息**（等值线密度＝梯度，流线密度＝你撒的种子），
   * 密度只是可读性选择。缺省 10（0.25° 网格上 2.5° 一线，与杆缺省密度同量级）。
   */
  readonly seedSpacing?: number;
  /** 单向最大积分步数（前向/后向各计一份；环绕场不收敛靠它截断）。缺省 100。 */
  readonly maxSteps?: number;
  /**
   * 积分步长（**度**，等效弧长口径：lon 位移按 1/cos(lat) 放大——保持物理轨迹
   * 形状，墨卡托等保角投影下渲染不变形）。缺省 0.25（0.25° 网格上一步约一格）。
   */
  readonly step?: number;
  /** 静风阈（场单位，低于此速即止——静风无路可追）。缺省 1，沿杆口径惯例。 */
  readonly calmThreshold?: number;
}

/**
 * 流线口径校验（与 assertBarbSpec 同一道关口纪律：未知选项键也拦——拼错的
 * 选项不会生效，更不该被静默忽略）。
 */
function assertStreamlinesOptions(options: StreamlinesOptions): void {
  for (const key of Object.keys(options)) {
    if (key !== "seedSpacing" && key !== "maxSteps" && key !== "step" && key !== "calmThreshold") {
      throw new GridError(
        "invalid-scale",
        `streamlinesOf 收到未知选项 "${key}"（可用项：seedSpacing、maxSteps、step、calmThreshold）——拼错的选项不会生效`,
      );
    }
  }
  const { seedSpacing, maxSteps, step, calmThreshold } = options;
  if (seedSpacing !== undefined && (!Number.isInteger(seedSpacing) || seedSpacing < 1)) {
    throw new GridError(
      "invalid-scale",
      `流线种子间隔非法（seedSpacing=${String(seedSpacing)}，须 ≥1 的整数〔格点数〕）`,
    );
  }
  if (maxSteps !== undefined && (!Number.isInteger(maxSteps) || maxSteps < 1)) {
    throw new GridError(
      "invalid-scale",
      `流线积分步数上限非法（maxSteps=${String(maxSteps)}，须 ≥1 的整数）`,
    );
  }
  if (step !== undefined && (!Number.isFinite(step) || step <= 0)) {
    throw new GridError(
      "invalid-scale",
      `流线积分步长非法（step=${String(step)}，须 >0 的有限数〔度〕）`,
    );
  }
  if (calmThreshold !== undefined && (!Number.isFinite(calmThreshold) || calmThreshold < 0)) {
    throw new GridError(
      "invalid-scale",
      `流线静风阈值非法（calmThreshold=${String(calmThreshold)}，须 ≥0 的有限数）`,
    );
  }
}

/**
 * u/v 双场 → 流线族（W-06 内核，纯函数零 DOM；v0.3.4 矢量批次首件）。
 *
 * 算法：种子按 `seedSpacing` 网格撒点（中心对齐同杆抽稀）→ 从每颗种子沿风矢量
 * **双向** RK2（中点法）积分：k1＝当前位置方向、半步处取 k2、按 k2 走整步——对
 * 曲率场的偏差 O(h²)，明显优于同步长欧拉。位移按等效弧长归一（dLat＝v·f、
 * dLon·cosφ＝u·f，f＝step/|V|）——每步弧长恒为 `step` 度，物理轨迹形状在保角
 * 投影下不变形。
 *
 * 终止四条件（任一即止，不出半步）：出网格边界／双线性采样遇缺测（任一分量
 * NaN）／风速低于 `calmThreshold`（静风无路可追）／`maxSteps` 截断。种子本身
 * 落在静风或缺测区则该种子不出线；两向都寸步难行的种子同样不出（单点线是噪音）。
 *
 * 口径提醒（图例与文档同源写明）：**流线密度＝种子撒法，不是风速信息**；
 * 流线沿去向行进，与杆/箭头的来向编码相反。
 */
export function streamlinesOf(u: Grid, v: Grid, options: StreamlinesOptions = {}): Streamline[] {
  assertPairedFields(u, v);
  assertStreamlinesOptions(options);
  const seedSpacing = options.seedSpacing ?? 10;
  const maxSteps = options.maxSteps ?? 100;
  const stepDeg = options.step ?? 0.25;
  const calmThreshold = options.calmThreshold ?? 1;
  const { nx, ny, la0, lo0, di, dj } = u.header.grid;
  const rad = Math.PI / 180;

  /** 双线性采样（格点坐标系，x 东向／y 南向；越界与缺测返回 NaN 由调用侧判 null）。 */
  const sample = (field: Grid, x: number, y: number): number => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xj = Math.min(xi + 1, nx - 1);
    const yj = Math.min(yi + 1, ny - 1);
    const fx = x - xi;
    const fy = y - yi;
    const v00 = field.values[yi * nx + xi] ?? Number.NaN;
    const v10 = field.values[yi * nx + xj] ?? Number.NaN;
    const v01 = field.values[yj * nx + xi] ?? Number.NaN;
    const v11 = field.values[yj * nx + xj] ?? Number.NaN;
    return v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy;
  };

  /**
   * 当前位置的单位步位移（格点坐标增量，沿风矢量去向）。返回 null＝此处不可积分
   * （越界／缺测／静风）——即终止信号。
   */
  const heading = (x: number, y: number): { readonly dx: number; readonly dy: number } | null => {
    if (x < 0 || x > nx - 1 || y < 0 || y > ny - 1) return null; // 出界即止
    const uu = sample(u, x, y);
    const vv = sample(v, x, y);
    if (Number.isNaN(uu) || Number.isNaN(vv)) return null; // 缺测：矢量未知
    const speed = Math.hypot(uu, vv);
    if (speed < calmThreshold) return null; // 静风：无路可追
    const cosLat = Math.max(Math.cos((la0 - y * dj) * rad), 1e-6); // 极地防护，不真出现
    const f = stepDeg / speed;
    return { dx: (uu * f) / (cosLat * di), dy: -(vv * f) / dj };
  };

  /** 从种子沿 sign 方向（+1 前向／−1 后向）积分，返回途经点（不含种子）。 */
  const trace = (sx: number, sy: number, sign: 1 | -1): Array<{ x: number; y: number }> => {
    const pts: Array<{ x: number; y: number }> = [];
    let x = sx;
    let y = sy;
    for (let i = 0; i < maxSteps; i++) {
      const k1 = heading(x, y);
      if (!k1) break;
      const k2 = heading(x + (sign * k1.dx) / 2, y + (sign * k1.dy) / 2); // RK2：半步处定向
      if (!k2) break;
      const nxp = x + sign * k2.dx;
      const nyp = y + sign * k2.dy;
      if (nxp < 0 || nxp > nx - 1 || nyp < 0 || nyp > ny - 1) break; // 出界即止（不出半步）
      x = nxp;
      y = nyp;
      pts.push({ x, y });
    }
    return pts;
  };

  const toLatLon = (p: { x: number; y: number }): { lat: number; lon: number } => ({
    lat: la0 - p.y * dj,
    lon: lo0 + p.x * di,
  });

  const x0 = Math.floor(((nx - 1) % seedSpacing) / 2);
  const y0 = Math.floor(((ny - 1) % seedSpacing) / 2);
  const lines: Streamline[] = [];
  for (let sy = y0; sy < ny; sy += seedSpacing) {
    for (let sx = x0; sx < nx; sx += seedSpacing) {
      if (!heading(sx, sy)) continue; // 种子在静风/缺测区：不出线
      const forward = trace(sx, sy, 1);
      const backward = trace(sx, sy, -1);
      if (forward.length + backward.length === 0) continue; // 两向寸步难行：单点线是噪音
      // 后向点序倒排拼在前（显式倒序循环：避开 reverse/toReversed 的 lint 与 lib 两头卡）
      const points: Array<{ lat: number; lon: number }> = [];
      for (let i = backward.length - 1; i >= 0; i--) {
        const p = backward[i];
        if (p) points.push(toLatLon(p));
      }
      points.push({ lat: la0 - sy * dj, lon: lo0 + sx * di });
      for (const p of forward) points.push(toLatLon(p));
      lines.push({ points, steps: forward.length + backward.length });
    }
  }
  return lines;
}

/**
 * 箭头场的一个箭头：位置＋气象口径**来向**（与 `WindBarb.direction` 同公式同口径）。
 * **内核不掺长度语义**——「等长」是渲染契约（W-08 只表方向不表大小），速度信息
 * 刻意不随箭头走：要读数值用风羽/色斑，箭头场的价值就是轻与疏。
 */
export interface WindArrow {
  readonly lat: number;
  readonly lon: number;
  /** 风向（气象口径**来向**，0–360°；与 windBarbsOf 同点同值——宿主可对拍） */
  readonly direction: number;
}

/** 箭头场口径（校验同族纪律：未知键与非法值显式抛 GridError）。 */
export interface ArrowFieldOptions {
  /**
   * 抽稀步长（格点数，两向同距，网格中心对齐——与 `windBarbsOf` 抽稀同一公式，同 step
   * 下两者格位逐一相同）。缺省 10（0.25° 网格上 2.5° 一支，大域形势密度）。
   */
  readonly step?: number;
  /** 静风阈（场单位，缺省 1——静风无方向可指；与杆/流线同惯例）。 */
  readonly calmThreshold?: number;
}

/**
 * u/v 双场 → 等长箭头阵（W-08 内核，纯函数零 DOM；v0.3.4 矢量批次）。
 *
 * 格点按 `step` 抽稀（中心对齐同 `windBarbsOf`——**同 step 同格位**，方向逐点同值，
 * 页面/测试可对拍），每点出气象来向度数；静风与缺测点不出箭。**等长＝只表方向不表
 * 大小**：什么时候它比风羽好——大域形势一眼看环流形态、符号轻、密度可压得很低；
 * 要读数值时回到风羽/色斑（两者正交组合，见 @metweave/leaflet 的装配层）。
 */
export function arrowFieldOf(u: Grid, v: Grid, options: ArrowFieldOptions = {}): WindArrow[] {
  assertPairedFields(u, v);
  for (const key of Object.keys(options)) {
    if (key !== "step" && key !== "calmThreshold") {
      throw new GridError(
        "invalid-scale",
        `arrowFieldOf 收到未知选项 "${key}"（可用项：step、calmThreshold）——拼错的选项不会生效`,
      );
    }
  }
  const step = options.step ?? 10;
  const calmThreshold = options.calmThreshold ?? 1;
  if (!Number.isInteger(step) || step < 1) {
    throw new GridError(
      "invalid-scale",
      `箭头场抽稀步长非法（step=${String(step)}，须 ≥1 的整数）`,
    );
  }
  if (!Number.isFinite(calmThreshold) || calmThreshold < 0) {
    throw new GridError(
      "invalid-scale",
      `箭头场静风阈值非法（calmThreshold=${String(calmThreshold)}，须 ≥0 的有限数）`,
    );
  }
  const { nx, ny, la0, lo0, di, dj } = u.header.grid;
  const x0 = Math.floor(((nx - 1) % step) / 2);
  const y0 = Math.floor(((ny - 1) % step) / 2);
  const arrows: WindArrow[] = [];
  for (let y = y0; y < ny; y += step) {
    for (let x = x0; x < nx; x += step) {
      const uu = u.values[y * nx + x] ?? Number.NaN;
      const vv = v.values[y * nx + x] ?? Number.NaN;
      if (Number.isNaN(uu) || Number.isNaN(vv)) continue; // 缺测：矢量未知不出箭
      if (Math.hypot(uu, vv) < calmThreshold) continue; // 静风：无方向可指不出箭
      const direction = (((270 - (Math.atan2(vv, uu) * 180) / Math.PI) % 360) + 360) % 360;
      arrows.push({ lat: la0 - y * dj, lon: lo0 + x * di, direction });
    }
  }
  return arrows;
}
