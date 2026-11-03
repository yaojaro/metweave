/**
 * @metweave/render — 风玫瑰（W-15）：逐时风向×风速观测 → 极坐标堆叠玫瑰图。
 *
 * 形态：扇区＝风向（扇区 0＝正北、顺时针增），瓣内**自内向外按风速档低→高堆叠**，
 * 半径＝该扇区累计频数占**入扇区样本**的百分比（环线＝占比刻度）。半径轴读占比、
 * 不读风速——速度作半径会让所有扇区等长（堆叠占比的唯一直观半径读数）；
 * `radiusMax` 锁的就是这个满圈占比值（十二宫格一类共尺场合全靠它）。
 *
 * **统计口径权威参照**：扇区归桶与堆叠口径逐行对齐观测玫瑰的通行实现——扇区中心
 * 对齐（360/sectors 一格、＋半格取整、边界值归最近扇区：`floor(((d+半格) % 360) /
 * 格宽)`）；风速档取「首个 speed < 上界」的档、全部越顶归末档（∞ 档正常堆叠）。
 *
 * **账目四桶（披露行的分桶次序，每样本恰落一桶）**：缺速（speed 缺测）→ 静风
 * （speed 在场且 < 静风阈——方向有无不影响，静风无方向可读）→ 缺向（方向缺测而
 * 风速可读——不定风向 VRB 一类）→ 入扇区。四桶之和恒等于样本总数 n。
 *
 * **缺省口径是 kt**（本组件特例，与其余五个风图组件的缺省 m/s 不同）：风玫瑰的
 * 传统数据源是逐时地面观测（METAR 的 sknt 列、IEM 一类逐时表），kt 是该族数据的
 * 母语——kt 内置档界 [2,4,6,8,10,∞]（整 2 kt 档）、静风阈 1 kt；unit 仍只是
 * **量纲声明不是换算开关**（与 windBarbOf 同纪律）。m/s 缺省档界 [3,5,10,15,20,30]
 * ＋∞ 对齐 @metweave/grid 的 10m 风要素档案 thresholds（场图色标家族既有口径），
 * 静风阈 0.5 m/s（≈1 kt 同一物理档）。
 *
 * **色带与场图家族的关系（render→grid 零依赖）**：缺省色带取自 10m 风档案同一家族
 * （2026-10-27 逐色克隆 windy 图例条的七停靠）——m/s 七档逐色即档案 colorStops 原表；
 * kt 六档系同族压缩（抽去中间的青绿停靠、保两端——弱风灰蓝起步、极端品红兜底）；
 * kt 自动档档数超六时家族色循环取用（与 binEdges 自定档界同口径——任一档取色恒有定义）。
 * 色值在此为**注释锚定的内置副本**（数字单源在 grid 档案）——本组件需要「不传
 * scale 也能开箱即用」的缺省色带，故无法像 windTimeHeight 那样把色标设为必传；
 * 宿主要与场图严格同源时传 `scale`（结构与 ColorScaleLegendInput 相同，包间配对
 * 纪律同旧例），scale 在位时档界与色带整体以它为准。
 *
 * 静风圈：`calmCircle:"auto"`（缺省）＝有静风样本才画中心圆＋图例披露占比；
 * true/false 强制开关。边界行为：静风/缺向整样本不入扇区；空输入与全静风出空玫瑰
 * ＋披露行（不出 NaN）；样本量不足不设门槛（披露行承载）；direction 越界显式抛错
 * （照 windDirStrip 的方向值域先例）；speed 负值/非有限数显式抛错。
 */
import type { ColorScaleLegendInput } from "./color-scale-legend";
import type { WindDisplayUnitInput } from "./wind-profile";
import { normalizeWindDisplayUnit } from "./wind-profile";
import type { WindRoseSample } from "./wind-rose-sample";
import { windRoseAccount } from "./wind-rose-account";

/** 风玫瑰的单样本输入（字段与 windObservationSeries 产物逐字段兼容——多带 time/gust
 *  等字段的结构照收，组件只读 speed/direction 两位；形状单源在 wind-rose-sample.ts）。 */
export type { WindRoseSample };

/** m/s 缺省档界（对齐 @metweave/grid 的 10m 风要素档案 thresholds——场图家族口径）。 */
const MPS_DEFAULT_EDGES: readonly number[] = [3, 5, 10, 15, 20, 30];

/**
 * 10m 风档案家族色卡（windy 逐色克隆版的内置注释副本，出处见文件头）：
 * m/s 七档＝档案 colorStops 原序；kt 六档＝同族压缩（抽去第 4 位青绿 #4c9964）。
 */
const FAMILY_COLORS_MPS: readonly string[] = [
  "#6271b8", // 0–3 灰蓝
  "#3d6ea3", // 3–5 钴蓝
  "#4a939f", // 5–10 青
  "#4c9964", // 10–15 青绿
  "#84963b", // 15–20 黄绿
  "#98565c", // 20–30 红棕
  "#974b91", // 30+ 品红（台风极端兜底档）
];
const FAMILY_COLORS_KT: readonly string[] = [
  "#6271b8", // 0–2 灰蓝
  "#3d6ea3", // 2–4 钴蓝
  "#4a939f", // 4–6 青
  "#84963b", // 6–8 黄绿
  "#98565c", // 8–10 红棕
  "#974b91", // 10+ 品红（极端兜底档）
];

/** windRose 的选项。 */
export interface WindRoseOptions {
  /** 扇区数（缺省 16；正整数，与方位格宽 360/sectors 对应） */
  readonly sectors?: number;
  /**
   * kt 自动档的档数（缺省 6 → 档界 [2,4,…,2·(bins−1),∞] 整 2 kt 档；色带按档数
   * 循环取家族色——档数超六自首色复用）。仅在 kt 缺省档界生效：`binEdges` 显式
   * 传入时忽略；m/s 缺省档固定对齐 10m 风要素档案口径（7 档——档案档界是跨时次
   * 可比锚，不随本选项漂移，m/s 下传非缺省值显式报错）。
   */
  readonly bins?: number;
  /** 风速量纲声明（缺省 `"kt"`——逐时观测玫瑰惯例；数值必须已是该单位，本组件不换算） */
  readonly unit?: WindDisplayUnitInput;
  /** 风速档界显式覆盖（严格递增的正数，末位可写 Infinity 表末档无界；档数＝长度＋1） */
  readonly binEdges?: readonly number[];
  /**
   * 分级色标整体覆盖（档界＋色带都取它——结构与 ColorScaleLegendInput 相同，宿主
   * 直传 @metweave/grid 的 buildColorScale 产物即与场图严格同源）。与 binEdges
   * 互斥（两者同传显式抛错——档界不许有两份真相）；colors 数须＝breaks＋1。
   */
  readonly scale?: ColorScaleLegendInput;
  /** 静风圈（缺省 "auto"＝有静风样本才画中心圆＋图例披露；true/false 强制开关） */
  readonly calmCircle?: boolean | "auto";
  /** 静风阈（同 unit 量纲，缺省 kt 1／m/s 0.5——低于此速算静风，不入扇区） */
  readonly calmThreshold?: number;
  /**
   * 满圈锁尺（0–100 的百分比数）：值＝最外档半径在「占入扇区样本百分比」的满圈
   * 占比尺上的刻度——传入即锁定最外环对应的累计占比值，超出的瓣钳到满圈画平。
   * 缺省按数据自适应取整（最长瓣占比向上取整到整洁档）。月度玫瑰阵等多实例
   * 共用标尺靠它：宿主算好同一值逐图传入。
   */
  readonly radiusMax?: number;
  /** 文案语言（缺省 zh） */
  readonly locale?: "zh" | "en";
  /** 标题行（缺席不画） */
  readonly title?: string;
  /** 叠加到根元素的类名（宿主样式钩子） */
  readonly className?: string;
}

/** 账目与统计单源：形状与实现见 wind-rose-account.ts（内部模块——windRose 与
 *  windDirFrequency 共用，不入公共 API 面）。 */
const STYLE_ID = "metweave-wind-rose-style";
const SVG_NS = "http://www.w3.org/2000/svg";

const WR_CSS = `
.mw-wr { display: inline-block; padding: 8px 10px; border: 1px solid #d8dee6; border-radius: 8px; background: #fbfcfd; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2a37; }
.mw-wr-title { font-size: 13px; font-weight: 600; color: #33506b; margin: 0 0 4px; }
.mw-wr svg { display: block; }
.mw-wr .mw-wr-ring { stroke: #e3e8ee; stroke-width: 1; fill: none; }
.mw-wr .mw-wr-ringtext { font: 9.5px system-ui, sans-serif; fill: #8a94a3; }
.mw-wr .mw-wr-sectorlabel { font: 10px system-ui, sans-serif; fill: #6b7785; }
.mw-wr .mw-wr-petal { stroke: #fff; stroke-width: 0.6; }
.mw-wr .mw-wr-calm { fill: #f2f5f8; stroke: #8a94a3; stroke-width: 1; }
.mw-wr .mw-wr-calm-dot { fill: #8a94a3; }
.mw-wr-legend { margin: 6px 0 0; font-size: 11px; color: #6b7785; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.mw-wr-chip { display: inline-block; width: 14px; height: 12px; border-radius: 3px; vertical-align: middle; }
.mw-wr-chip.mw-wr-chip-calm { background: #f2f5f8; border: 1px solid #8a94a3; }
.mw-wr-note { margin: 4px 0 0; font-size: 10.5px; color: #8a94a3; }
`;

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID) !== null) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = WR_CSS;
  document.head.append(style);
}

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Readonly<Record<string, string>>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
}

/** 档界数字的图例排版：整数原样、非整数一位小数。 */
const fmtEdge = (v: number): string =>
  Number.isInteger(v) ? `${v}` : `${Math.round(v * 10) / 10}`;

/** 罗盘方位名（扇区数为 4/8/16 时扇区中心即罗盘点；其余扇区数不标扇区名，只标四正向）。 */
const COMPASS_16: readonly string[] = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
];

/** 风玫瑰的文案表（zh / en；同本包纪律）。 */
interface WindRoseLocale {
  readonly ariaLabel: string;
  readonly legendTitle: (unit: string) => string;
  readonly calm: string;
  /** 披露行（四桶账目＋满圈口径一句） */
  readonly disclosure: (a: {
    samples: number;
    inSector: number;
    calm: number;
    calmPct: string;
    missingDirection: number;
    missingSpeed: number;
    rim: number;
  }) => string;
}

const LOCALE: Record<"zh" | "en", WindRoseLocale> = {
  zh: {
    ariaLabel: "风玫瑰",
    legendTitle: (unit) => `风速档（${unit}）`,
    calm: "静风",
    disclosure: (a) =>
      `样本 ${a.samples} · 入扇区 ${a.inSector} · 静风 ${a.calm}（${a.calmPct}%）· 缺向 ${a.missingDirection} · 缺速 ${a.missingSpeed} ｜ 瓣半径＝占入扇区样本百分比，满圈 ${fmtEdge(a.rim)}%`,
  },
  en: {
    ariaLabel: "Wind rose",
    legendTitle: (unit) => `Speed bins (${unit})`,
    calm: "Calm",
    disclosure: (a) =>
      `Samples ${a.samples} · In sectors ${a.inSector} · Calm ${a.calm} (${a.calmPct}%) · Dir missing ${a.missingDirection} · Speed missing ${a.missingSpeed} | Radius = share of in-sector samples, full circle ${fmtEdge(a.rim)}%`,
  },
};

/** 满圈自适应：最长瓣占比向上取整到整洁档（环线 [满圈/2, 满圈] 两道——整数或 0.5 尾数）。 */
function niceRim(maxShare: number): number {
  if (!(maxShare > 0)) return 50; // 无入扇区数据的空态锁尺（真相由披露行承载）
  const step = maxShare <= 8 ? 2 : maxShare <= 20 ? 5 : maxShare <= 40 ? 10 : 25;
  return Math.ceil(maxShare / step) * step;
}

/** 档界解析：binEdges/scale 显式覆盖 > unit 内置缺省；返回有限档上界串（末档无界隐含）。 */
function resolveEdges(
  options: Pick<WindRoseOptions, "binEdges" | "scale" | "unit" | "bins">,
  unit: "m/s" | "kt",
  caller: string,
): { readonly edges: readonly number[]; readonly colors: readonly string[] } {
  if (options.scale !== undefined) {
    if (options.binEdges !== undefined) {
      throw new Error(
        `${caller} 的 scale 与 binEdges 同时在场（档界不许有两份真相——档界＋色带整体覆盖请只传 scale；自定档界配缺省色带请只传 binEdges）`,
      );
    }
    const breaks = options.scale.breaks;
    if (breaks.length === 0) {
      throw new Error(`${caller} 的 scale.breaks 为空——至少一档界`);
    }
    let prev = 0;
    for (const [i, b] of breaks.entries()) {
      if (!Number.isFinite(b) || b <= 0) {
        throw new Error(`${caller} 的 scale.breaks[${i}] 非法（${String(b)}，须为 >0 的有限数）`);
      }
      if (b <= prev) {
        throw new Error(
          `${caller} 的 scale.breaks 须严格递增（${String(b)} ≤ 前位 ${String(prev)}）`,
        );
      }
      prev = b;
    }
    const colors = options.scale.colors;
    if (colors.length !== breaks.length + 1) {
      throw new Error(
        `${caller} 的 scale.colors 数 ${String(colors.length)} ≠ breaks＋1 ${String(breaks.length + 1)}——每档一色`,
      );
    }
    return { edges: [...breaks], colors: [...colors] };
  }
  if (options.binEdges !== undefined) {
    const raw = options.binEdges;
    if (raw.length === 0) {
      throw new Error(
        `${caller} 的 binEdges 为空——至少一档界（末档无界可省略，或写 Infinity 收尾）`,
      );
    }
    const finite = [...raw];
    const last = finite[finite.length - 1];
    if (last === Infinity) finite.pop(); // 收尾 ∞ 显式收下（rose.mjs 的 BANDS 写法）
    if (finite.length === 0) {
      throw new Error(`${caller} 的 binEdges 只有 Infinity——至少一个有限档界`);
    }
    let prev = 0;
    for (const [i, b] of finite.entries()) {
      if (!Number.isFinite(b) || b <= 0) {
        throw new Error(
          `${caller} 的 binEdges[${i}] 非法（${String(b)}，须为 >0 的有限数；Infinity 只可作末位收尾）`,
        );
      }
      if (b <= prev) {
        throw new Error(`${caller} 的 binEdges 须严格递增（${String(b)} ≤ 前位 ${String(prev)}）`);
      }
      prev = b;
    }
    const binCount = finite.length + 1;
    if (unit === "m/s" && binCount === MPS_DEFAULT_EDGES.length + 1) {
      // 恰好对齐档案口径的显式档界照收——色带随档数回退内置家族表（档数不符才自拼）
      return { edges: finite, colors: FAMILY_COLORS_MPS.slice(0, binCount) };
    }
    // 自定档界：色带按档数循环取家族色（视觉仍是同族；严格同源请改传 scale）
    const colors = Array.from(
      { length: binCount },
      (_, i) => FAMILY_COLORS_MPS[i % FAMILY_COLORS_MPS.length] ?? "#6271b8",
    );
    return { edges: finite, colors };
  }
  if (unit === "m/s") {
    const bins = options.bins;
    if (bins !== undefined && bins !== 6) {
      throw new Error(
        `${caller} 的 bins 选项只作用于 kt 缺省档（m/s 缺省档固定对齐 10m 风要素档案口径 7 档，不随 bins 漂移——自定档界请传 binEdges）`,
      );
    }
    return { edges: MPS_DEFAULT_EDGES, colors: FAMILY_COLORS_MPS };
  }
  const bins = options.bins ?? 6;
  if (!Number.isInteger(bins) || bins < 1 || bins > 180) {
    throw new Error(
      `${caller} 的 bins 非法（${String(bins)}，须为 1–180 的整数——kt 缺省档每档 2 kt）`,
    );
  }
  const edges = Array.from({ length: bins - 1 }, (_, i) => (i + 1) * 2);
  // 色带按档数循环取家族色（与 binEdges 自定档界分支同口径——任一 bins 下取色恒有
  // 定义，极端档不回落最弱灰蓝兜底）
  const colors = Array.from(
    { length: bins },
    (_, i) => FAMILY_COLORS_KT[i % FAMILY_COLORS_KT.length] ?? "#6271b8",
  );
  return { edges, colors };
}

/**
 * 画一张风玫瑰（W-15）：逐时风向×风速观测 → 极坐标堆叠玫瑰＋图例（色档＋方位＋
 * 样本量披露行）。
 *
 * @param samples - 风观测样本（speed/direction 各自可缺测；与 windObservationSeries
 *                  产物逐字段兼容——多带 time/gust 的行照收）
 * @param options - 见 WindRoseOptions。
 */
export function windRose(
  samples: readonly WindRoseSample[],
  options: WindRoseOptions = {},
): HTMLElement {
  for (const key of Object.keys(options)) {
    if (
      key !== "sectors" &&
      key !== "bins" &&
      key !== "unit" &&
      key !== "binEdges" &&
      key !== "scale" &&
      key !== "calmCircle" &&
      key !== "calmThreshold" &&
      key !== "radiusMax" &&
      key !== "locale" &&
      key !== "title" &&
      key !== "className"
    ) {
      throw new Error(
        `windRose 收到未知选项 "${key}"（可用项：sectors、bins、unit、binEdges、scale、calmCircle、calmThreshold、radiusMax、locale、title、className）——拼错的选项不会生效`,
      );
    }
  }
  if (options.locale !== undefined && options.locale !== "zh" && options.locale !== "en") {
    const badLocale: string = options.locale; // never 收窄后的宽化中转（同 card.ts）
    throw new Error(`windRose 的 locale 选项值 "${badLocale}" 不受支持（可用："zh" | "en"）`);
  }
  // 缺省口径 kt（逐时观测玫瑰惯例——文件头有专段说明）；其余走包内 unit 归一单源
  const unit =
    options.unit === undefined ? "kt" : normalizeWindDisplayUnit(options.unit, "windRose");
  const sectors = options.sectors ?? 16;
  if (!Number.isInteger(sectors) || sectors < 4 || sectors > 360) {
    throw new Error(
      `windRose 的 sectors 非法（${String(sectors)}，须为 4–360 的整数——每扇区至少占 1°，四正向以下无从成图）`,
    );
  }
  const { edges, colors } = resolveEdges(options, unit, "windRose");
  const calmThreshold = options.calmThreshold ?? (unit === "kt" ? 1 : 0.5);
  if (!Number.isFinite(calmThreshold) || calmThreshold < 0) {
    throw new Error(
      `windRose 的 calmThreshold 非法（${String(options.calmThreshold)}，须 ≥0 的有限数，同 unit 量纲）`,
    );
  }
  if (
    options.radiusMax !== undefined &&
    (!Number.isFinite(options.radiusMax) || options.radiusMax <= 0)
  ) {
    throw new Error(
      `windRose 的 radiusMax 非法（${String(options.radiusMax)}，须 >0 的有限数〔最外档半径占满圈的百分比 0–100〕）`,
    );
  }
  const calmCircle = options.calmCircle ?? "auto";
  if (calmCircle !== "auto" && typeof calmCircle !== "boolean") {
    throw new Error(
      'windRose 的 calmCircle 选项值须为 "auto" 或布尔（auto＝有静风样本才画中心圆＋图例披露）',
    );
  }

  // 统计单源（windDirFrequency 同用此账——披露行逐字相等）
  const account = windRoseAccount(samples, {
    sectors,
    edges,
    calmThreshold,
    caller: "windRose",
  });
  const maxShare =
    account.inSector > 0
      ? (Math.max(...account.matrix.map((row) => row.reduce((a, b) => a + b, 0))) /
          account.inSector) *
        100
      : 0;
  const rim = options.radiusMax ?? niceRim(maxShare);
  const showCalm = calmCircle === true || (calmCircle === "auto" && account.calm > 0);

  ensureStyle();
  const T = LOCALE[options.locale ?? "zh"];
  const root = document.createElement("div");
  root.className = "mw-wr";
  if (options.className !== undefined) root.classList.add(options.className);
  // 机读账目（验收台与测试的判定面——不解析图形，读披露数字）
  root.dataset.samples = String(account.samples);
  root.dataset.inSector = String(account.inSector);
  root.dataset.calm = String(account.calm);
  root.dataset.missingDirection = String(account.missingDirection);
  root.dataset.missingSpeed = String(account.missingSpeed);
  root.dataset.unit = unit;
  root.dataset.sectors = String(sectors);
  root.dataset.bins = String(edges.length + 1);
  root.dataset.rim = fmtEdge(rim);
  if (options.title !== undefined) {
    const title = document.createElement("p");
    title.className = "mw-wr-title";
    title.textContent = options.title;
    root.append(title);
  }

  // 画布：正方形极坐标面，圆心居中；R＝最外环半径
  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 32;
  const svg = svgEl("svg", {
    viewBox: `0 0 ${size} ${size}`,
    width: `${size}`,
    height: `${size}`,
    role: "img",
    "aria-label": T.ariaLabel,
  });
  // 罗盘角 → 屏幕坐标（北＝上、东＝右：x＋r·sin β、y−r·cos β）
  const xOf = (bearing: number, r: number): number => cx + r * Math.sin((bearing * Math.PI) / 180);
  const yOf = (bearing: number, r: number): number => cy - r * Math.cos((bearing * Math.PI) / 180);
  const rOf = (share: number): number => R * (Math.min(share, rim) / rim);

  // 环线（占比刻度两道：满圈与半圈）＋沿北轴的刻度数
  for (const ring of [rim / 2, rim]) {
    svg.append(
      svgEl("circle", { cx: `${cx}`, cy: `${cy}`, r: rOf(ring).toFixed(1), class: "mw-wr-ring" }),
    );
    const label = svgEl("text", {
      x: `${cx + 3}`,
      y: (cy - rOf(ring) - 2).toFixed(1),
      class: "mw-wr-ringtext",
    });
    label.textContent = `${fmtEdge(ring)}%`;
    svg.append(label);
  }

  // 瓣：扇区 0＝正北顺时针；每扇区自内向外按档低→高堆叠（占比超满圈钳平——共尺口径）
  const half = 180 / sectors; // 半格宽（度）
  account.matrix.forEach((row, si) => {
    const center = si * (360 / sectors);
    const a0 = center - half;
    const a1 = center + half;
    let cum = 0;
    row.forEach((count, bi) => {
      cum += count;
      if (count === 0 || account.inSector === 0) return;
      const r0 = rOf(((cum - count) / account.inSector) * 100);
      const r1 = rOf((cum / account.inSector) * 100);
      if (r1 - r0 < 0.05) return; // 亚像素档不画（画了糊边；账目不受影响）
      const rad0 = ((a0 - 90) * Math.PI) / 180;
      const rad1 = ((a1 - 90) * Math.PI) / 180;
      const x0 = cx + r1 * Math.cos(rad0);
      const y0 = cy + r1 * Math.sin(rad0);
      const x1 = cx + r1 * Math.cos(rad1);
      const y1 = cy + r1 * Math.sin(rad1);
      const large = a1 - a0 > 180 ? 1 : 0;
      const segs = [
        `M${x0.toFixed(2)} ${y0.toFixed(2)}`,
        `A${r1.toFixed(2)} ${r1.toFixed(2)} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`,
      ];
      if (r0 < 0.05) {
        segs.push(`L${cx} ${cy}`);
      } else {
        const xi = cx + r0 * Math.cos(rad1);
        const yi = cy + r0 * Math.sin(rad1);
        const x2 = cx + r0 * Math.cos(rad0);
        const y2 = cy + r0 * Math.sin(rad0);
        segs.push(`L${xi.toFixed(2)} ${yi.toFixed(2)}`);
        segs.push(
          `A${r0.toFixed(2)} ${r0.toFixed(2)} 0 ${large} 0 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
        );
      }
      segs.push("Z");
      svg.append(
        svgEl("path", {
          d: segs.join(" "),
          fill: colors[bi] ?? "#6271b8",
          class: "mw-wr-petal",
        }),
      );
    });
  });

  // 静风圈（auto＝有静风样本才画）：中心灰底圆＋点——「有观测、无方向」的形态
  if (showCalm) {
    svg.append(
      svgEl("circle", { cx: `${cx}`, cy: `${cy}`, r: "6.5", class: "mw-wr-calm" }),
      svgEl("circle", { cx: `${cx}`, cy: `${cy}`, r: "1.6", class: "mw-wr-calm-dot" }),
    );
  }

  // 四正向标注（绝对方位锚——扇区数多寡不影响）
  const compassPoints: readonly (readonly [number, string])[] = [
    [0, "N"],
    [90, "E"],
    [180, "S"],
    [270, "W"],
  ];
  for (const [bearing, word] of compassPoints) {
    const label = svgEl("text", {
      x: xOf(bearing, R + 12).toFixed(1),
      y: (yOf(bearing, R + 12) + 3.5).toFixed(1),
      "text-anchor": "middle",
      class: "mw-wr-sectorlabel",
    });
    label.textContent = word;
    svg.append(label);
  }
  // 扇区数恰为罗盘点数时补全扇区名（16 → 全罗盘、8 → 八方位、4 → 已覆盖）
  if (sectors === 8 || sectors === 16) {
    const step = 360 / sectors;
    for (let si = 0; si < sectors; si++) {
      const bearing = si * step;
      if (bearing % 90 === 0) continue; // 四正向已标
      const label = svgEl("text", {
        x: xOf(bearing, R + 12).toFixed(1),
        y: (yOf(bearing, R + 12) + 3).toFixed(1),
        "text-anchor": "middle",
        class: "mw-wr-sectorlabel",
      });
      label.textContent = COMPASS_16[Math.round(bearing / (360 / 16))] ?? "";
      svg.append(label);
    }
  }
  root.append(svg);

  // 图例：色档刻度＋单位（＋静风圈样）＋方位说明＋样本量披露行
  const legend = document.createElement("p");
  legend.className = "mw-wr-legend";
  const legendTitle = document.createElement("span");
  legendTitle.textContent = T.legendTitle(unit);
  legend.append(legendTitle);
  const binLabels: string[] = [];
  for (let bi = 0; bi < edges.length; bi++) {
    const lower = bi === 0 ? "0" : fmtEdge(edges[bi - 1] ?? 0);
    binLabels.push(`${lower}–${fmtEdge(edges[bi] ?? 0)}`);
  }
  binLabels.push(`≥${fmtEdge(edges[edges.length - 1] ?? 0)}`);
  binLabels.forEach((text, bi) => {
    const chip = document.createElement("i");
    chip.className = "mw-wr-chip";
    chip.style.background = colors[bi] ?? "#6271b8";
    const span = document.createElement("span");
    span.append(chip, ` ${text}`);
    legend.append(span);
  });
  if (showCalm) {
    const chip = document.createElement("i");
    chip.className = "mw-wr-chip mw-wr-chip-calm";
    const span = document.createElement("span");
    span.append(chip, ` ${T.calm}`);
    legend.append(span);
  }
  root.append(legend);

  const calmPct =
    account.samples > 0
      ? (Math.round((account.calm / account.samples) * 1000) / 10).toFixed(1)
      : "0.0";
  const note = document.createElement("p");
  note.className = "mw-wr-note";
  note.textContent = T.disclosure({
    samples: account.samples,
    inSector: account.inSector,
    calm: account.calm,
    calmPct,
    missingDirection: account.missingDirection,
    missingSpeed: account.missingSpeed,
    rim,
  });
  root.append(note);
  return root;
}
