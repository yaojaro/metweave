/**
 * @metweave/render — 风廓线图（W-10）：多层风读数 → 风速随高度/气压的变化曲线。
 *
 * 形态：y＝垂直轴（**气压对数轴**——探空业务的经典口径，1000 hPa 在下、100 hPa 在上，
 * 与 Skew-T 一族的读法一致；层数据只有位势高度时退**线性高度轴**），x＝风速；每层
 * 一个曲线点＋一枚方向箭头（箭杆指向风的**去向**，与杆/箭头家族的来向编码互补——
 * 廓线图上的箭头是行进方向直观件）。
 *
 * 轴选型规则（显式、可测）：全部层带 `pressure` → 对数气压轴；否则全部层带 `height`
 * → 线性高度轴；两种锚混装或某层两锚皆缺 → 显式抛错（不猜、不静默丢层）。
 *
 * 缺测口径：`speed` null 的层不进曲线（折线在此断开）、在该层高度画一枚「缺测」短划
 * （空缺可辨，不留白噪音）；`direction` null 的层有点无箭（风向缺测或静风无方向——
 * 与 windBarbOf 静风不出杆同一口径）。非法值（负风速、越界风向、非正气压）显式抛错。
 *
 * **`glyph:"barb"` 垂直风羽模式（v0.6，Windy 风廓线面板形态）**：折线/箭头让位给
 * 一列**水平居中**的完整风羽——每层一枚，杆指来向、旗/长划/短划＝可数风速，且
 * **风羽按风速着色**（墨色＝该层风速经 `scale` 色标映射——「色斑长在风羽上」，色卡
 * 由宿主传入同 W-12 纪律）；静风＝着色圆圈、缺测层沿用「缺测」短划（居中形态）；
 * 图高按风羽尺寸与最小层距自适应放大（划与旗保持可数，宁可图高一点）。纵轴/刻度/
 * 单位口径与折线模式同一套；几何内核/刻度入参与 W-12 的 barb 族共用
 * （wind-barb-glyph.ts＋WindBarbScaleInput，单源不复制）。
 *
 * 单位口径（与 windBarbOf 同纪律）：`unit` 是**量纲声明不是换算开关**——传 `"kt"`
 * 意味着 speed 数值已是 kt；m/s → kt 的折算走 `@metweave/grid` 的 `toKnots`（渲染
 * 组件不存换算常数）。≥6 层起画（再少的层画不成一条可读的廓线——验收口径）。
 */
import type {
  WindBarbScaleInput,
  WindProfile,
  WindProfileLevel,
  WindDisplayUnitInput,
} from "./wind-profile";
import { colorAt, normalizeWindDisplayUnit } from "./wind-profile";
import { barbGlyphEl, barbGlyphLevelOf, calmGlyphEl } from "./wind-barb-glyph";
import { renderColorScaleLegend } from "./color-scale-legend";
import type { ColorScaleLegendInput } from "./color-scale-legend";

/** windProfileChart 的选项。 */
export interface WindProfileChartOptions {
  /** 风速量纲声明（缺省 `"m/s"`；数值必须已是该单位——本组件不换算） */
  readonly unit?: WindDisplayUnitInput;
  /**
   * 图形态（缺省 `"line"`——折线＋方向箭头，**行为与既有版本零变化**）；`"barb"` ＝
   * 垂直风羽列（Windy 风廓线面板形态）：每层一枚居中的完整风羽、按风速着色。
   */
  readonly glyph?: "line" | "barb";
  /**
   * 分级色标（`glyph:"barb"` 时**必传**）：风羽墨色＝该层风速经此色标映射（与场图
   * 家族同一份——10m 风家族即 `@metweave/grid` 的 `windProfile` 档案；render 不存
   * 口径）。barb 模式下方随件内嵌 `renderColorScaleLegend`。折线模式不读此选项。
   */
  readonly scale?: ColorScaleLegendInput;
  /**
   * 风羽刻度（`glyph:"barb"` 时**必传**）：直传 `@metweave/grid` 的
   * `WIND_BARB_SCALES`（数字单源在 grid；组件按 `unit` 声明自动选档）。
   */
  readonly barbScale?: Readonly<Record<"m/s" | "kt", WindBarbScaleInput>>;
  /** 风羽静风阈（同 unit 量纲，缺省 1＝杆口径惯例）：低于此值画着色圆圈、不画杆。 */
  readonly barbCalmThreshold?: number;
  /**
   * 风羽尺寸（px，缺省 26）：图高按「最小层距 ≥ 尺寸×1.15」自适应放大（划与旗保持
   * 可数）；尺寸走降级阶梯（≥18 全要素、12–17 旗＋长划、10–11 只画杆）——但本组件
   * 宁可放大图高也不建议传小尺寸。
   */
  readonly barbSize?: number;
  /** 文案语言（缺省 zh） */
  readonly locale?: "zh" | "en";
  /** 标题行（缺席不画） */
  readonly title?: string;
  /** 叠加到根元素的类名（宿主样式钩子） */
  readonly className?: string;
}

/** 风廓线图的文案表（zh / en 两列，键集一致；同本包纪律：新增语言＝新增一列）。 */
interface WindProfileChartLocale {
  readonly speed: string;
  readonly missing: string;
  readonly pressure: string;
  readonly height: string;
  readonly profile: string;
  readonly levels: (n: number) => string;
  /** barb 模式内嵌色标图例标题（风羽着色的读法键） */
  readonly legendTitle: (unit: string) => string;
}

const LOCALE: Record<"zh" | "en", WindProfileChartLocale> = {
  zh: {
    speed: "风速",
    missing: "缺测",
    pressure: "气压",
    height: "高度",
    profile: "廓线",
    levels: (n) => `${n} 层`,
    legendTitle: (unit) => `风速（${unit}）——风羽着色`,
  },
  en: {
    speed: "Wind speed",
    missing: "missing",
    pressure: "pressure",
    height: "height",
    profile: "profile",
    levels: (n) => `${n} levels`,
    legendTitle: (unit) => `Wind speed (${unit}) — barb ink`,
  },
};

const STYLE_ID = "metweave-wind-profile-chart-style";
const SVG_NS = "http://www.w3.org/2000/svg";

const CHART_CSS = `
.mw-wpc { display: inline-block; padding: 8px 10px; border: 1px solid #d8dee6; border-radius: 8px; background: #fbfcfd; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2a37; }
.mw-wpc-title { font-size: 13px; font-weight: 600; color: #33506b; margin: 0 0 4px; }
.mw-wpc svg { display: block; }
.mw-wpc .mw-wpc-grid { stroke: #e3e8ee; stroke-width: 1; }
.mw-wpc .mw-wpc-axis { stroke: #b9c4cf; stroke-width: 1; }
.mw-wpc .mw-wpc-ticktext { font: 10px system-ui, sans-serif; fill: #6b7785; }
.mw-wpc .mw-wpc-unittext { font: 10.5px system-ui, sans-serif; fill: #6b7785; }
.mw-wpc .mw-wpc-curve { fill: none; stroke: #2c5f8a; stroke-width: 2; stroke-linejoin: round; }
.mw-wpc .mw-wpc-mark { fill: #2c5f8a; }
.mw-wpc .mw-wpc-arrow { stroke: #8a5a12; stroke-width: 1.4; stroke-linecap: round; fill: #8a5a12; }
.mw-wpc .mw-wpc-missing { stroke: #b6402e; stroke-width: 2; stroke-dasharray: 3 2; }
`;

/** 样式只注入一次（同 wind-chip.ts：本组件需要 DOM，不是 SSR 保护）。 */
function ensureStyle(): void {
  if (document.getElementById(STYLE_ID) !== null) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CHART_CSS;
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

/** 气压轴刻度候选（探空标准等压面＋平流层低层 70/50/30/20——v0.6 P2 修复：
 *  此前止于 100 hPa，100 以下的层画点不画标）。 */
const STANDARD_PRESSURES = [
  1000, 925, 850, 700, 600, 500, 400, 300, 250, 200, 150, 100, 70, 50, 30, 20,
];

/** 单层校验：值域非法显式抛错（带层序号定位）；锚缺失（两锚皆无）同样抛错。 */
function assertLevel(level: WindProfileLevel, index: number): void {
  const at = `第 ${index + 1} 层`;
  const { pressure, height, speed, direction } = level;
  if (pressure !== undefined && pressure !== null && !(Number.isFinite(pressure) && pressure > 0)) {
    throw new Error(
      `windProfileChart ${at}的 pressure 非法（${String(pressure)}，须为正有限数〔hPa〕或缺测 null）`,
    );
  }
  if (height !== undefined && height !== null && !(Number.isFinite(height) && height >= 0)) {
    throw new Error(
      `windProfileChart ${at}的 height 非法（${String(height)}，须为 ≥0 的有限数〔m〕或缺测 null）`,
    );
  }
  if (speed !== undefined && speed !== null && !(Number.isFinite(speed) && speed >= 0)) {
    throw new Error(
      `windProfileChart ${at}的 speed 非法（${String(speed)}，须为 ≥0 的有限数或缺测 null）`,
    );
  }
  if (
    direction !== undefined &&
    direction !== null &&
    !(Number.isFinite(direction) && direction >= 0 && direction <= 360)
  ) {
    throw new Error(
      `windProfileChart ${at}的 direction 非法（${String(direction)}，须为 0–360 的有限数：北 0／东 90／南 180／西 270）`,
    );
  }
  if ((pressure === undefined || pressure === null) && (height === undefined || height === null)) {
    throw new Error(
      `windProfileChart ${at}缺层锚（pressure 与 height 至少其一在场——垂直坐标无从谈起）`,
    );
  }
}

/** 「好刻度」步长：从候选梯子里取让 [0, max] 落在 ≤8 格的最小步。 */
function niceStep(max: number, candidates: readonly number[]): number {
  for (const step of candidates) {
    if (max / step <= 8) return step;
  }
  return candidates[candidates.length - 1] ?? max;
}

/** 数值文本：整数原样、非整数一位小数。 */
const fmt = (v: number): string => (Number.isInteger(v) ? `${v}` : `${Math.round(v * 10) / 10}`);

/**
 * 画一张风廓线图（W-10）：多层风读数 → 风速垂直变化曲线＋逐层方向箭头。
 *
 * @param levels - 多层风读数（≥6 层；层序任意，组件按层锚自排——气压降序＝自下而上）
 * @param options - 见 WindProfileChartOptions。
 */
export function windProfileChart(
  levels: WindProfile,
  options: WindProfileChartOptions = {},
): HTMLElement {
  for (const key of Object.keys(options)) {
    if (
      key !== "unit" &&
      key !== "glyph" &&
      key !== "scale" &&
      key !== "barbScale" &&
      key !== "barbCalmThreshold" &&
      key !== "barbSize" &&
      key !== "locale" &&
      key !== "title" &&
      key !== "className"
    ) {
      throw new Error(
        `windProfileChart 收到未知选项 "${key}"（可用项：unit、glyph、scale、barbScale、barbCalmThreshold、barbSize、locale、title、className）——拼错的选项不会生效`,
      );
    }
  }
  const glyph = options.glyph ?? "line";
  if (glyph !== "line" && glyph !== "barb") {
    const badGlyph: string = glyph; // never 收窄后的宽化中转（同 card.ts）
    throw new Error(
      `windProfileChart 的 glyph 选项值 "${badGlyph}" 不受支持（可用："line" | "barb"）`,
    );
  }
  // barb 模式的必传三件与结构校验（口径与 windTimeHeight 的 barb 族同款）
  const barbScales = options.barbScale;
  if (glyph === "barb") {
    if (options.scale === undefined) {
      throw new Error(
        'windProfileChart 的 glyph:"barb" 缺 scale 选项（风羽着色色标必传——与场图家族同一份，宿主传 @metweave/grid 要素档案）',
      );
    }
    if (options.scale.colors.length === 0) {
      throw new Error("windProfileChart 的 scale.colors 为空——色标至少一色");
    }
    if (barbScales === undefined) {
      throw new Error(
        'windProfileChart 的 glyph:"barb" 缺 barbScale 选项（风羽刻度必传——直传 @metweave/grid 的 WIND_BARB_SCALES，按 unit 声明自动选档）',
      );
    }
    for (const id of ["m/s", "kt"] as const) {
      const entry = barbScales[id];
      if (entry === undefined) continue; // 缺当前档由下方 activeBarbScale 守卫点名
      for (const field of ["pennant", "long", "short"] as const) {
        if (!Number.isFinite(entry[field]) || entry[field] <= 0) {
          throw new Error(
            `windProfileChart 的 barbScale.${id}.${field} 非法（${String(entry[field])}，须为正有限数）`,
          );
        }
      }
      if (!(entry.short < entry.long && entry.long < entry.pennant)) {
        throw new Error(
          `windProfileChart 的 barbScale.${id} 位权反了（short ${entry.short} / long ${entry.long} / pennant ${entry.pennant}）——须满足 短划 < 长划 < 旗`,
        );
      }
    }
  }
  const barbCalmThreshold = options.barbCalmThreshold ?? 1; // 缺省 1＝杆口径惯例（同 windBarbOf）
  if (!Number.isFinite(barbCalmThreshold) || barbCalmThreshold < 0) {
    throw new Error(
      `windProfileChart 的 barbCalmThreshold 非法（${String(options.barbCalmThreshold)}，须 ≥0 的有限数，同 unit 量纲）`,
    );
  }
  const barbSize = options.barbSize ?? 26;
  if (!Number.isFinite(barbSize) || barbSize < 10) {
    throw new Error(
      `windProfileChart 的 barbSize 非法（${String(options.barbSize)}，须 ≥10 的有限数〔px〕——降级阶梯之下划与旗不可数）`,
    );
  }
  if (options.locale !== undefined && options.locale !== "zh" && options.locale !== "en") {
    const badLocale: string = options.locale; // never 收窄后的宽化中转（同 card.ts）
    throw new Error(
      `windProfileChart 的 locale 选项值 "${badLocale}" 不受支持（可用："zh" | "en"）`,
    );
  }
  const unit = normalizeWindDisplayUnit(options.unit, "windProfileChart");
  const activeBarbScale = barbScales?.[unit];
  if (glyph === "barb" && activeBarbScale === undefined) {
    throw new Error(
      `windProfileChart 的 barbScale 缺 "${unit}" 档（须按量纲键给全旗/长划/短划刻度——直传 @metweave/grid 的 WIND_BARB_SCALES 即两档齐）`,
    );
  }
  if (levels.length < 6) {
    throw new Error(
      `windProfileChart 层数不足（${levels.length} < 6）——廓线至少 6 层起画，更少的层画不成可读的垂直变化`,
    );
  }
  for (const [index, level] of levels.entries()) assertLevel(level, index);
  // 轴选型：全 pressure → 对数气压轴；否则全 height → 线性高度轴；混装抛错
  const allPressure = levels.every((l) => l.pressure !== undefined && l.pressure !== null);
  const allHeight = levels.every((l) => l.height !== undefined && l.height !== null);
  if (!allPressure && !allHeight) {
    throw new Error(
      "windProfileChart 的层锚混装（部分层只带 pressure、部分只带 height）——对数气压轴与线性高度轴无法同图，请统一层锚",
    );
  }
  const axis: "pressure" | "height" = allPressure ? "pressure" : "height";
  // 坐标退化守卫（v0.6 P2 修复）：全部层同一气压（或全部高度 0）时对数比 0/0 → 折线
  // 坐标 NaN——不报错画出空图比报错更难查，显式拦
  if (
    (axis === "pressure" &&
      Math.min(...levels.map((l) => l.pressure ?? 0)) ===
        Math.max(...levels.map((l) => l.pressure ?? 0))) ||
    (axis === "height" && Math.max(...levels.map((l) => l.height ?? 0)) === 0)
  ) {
    throw new Error(
      `windProfileChart 的垂直坐标退化（${axis === "pressure" ? `全部层同气压 ${String(levels[0]?.pressure ?? null)} hPa` : "全部层高度 0 m"}）——` +
        "对数/线性轴无从分度，请检查层数据（同锚重复层应在上游适配器被拒）",
    );
  }
  // 自下而上排序：气压降序（1000→100）／高度升序（0→12000）
  const ordered = [...levels];
  ordered.sort((a, b) => {
    if (allPressure) return (b.pressure ?? 0) - (a.pressure ?? 0);
    return (a.height ?? 0) - (b.height ?? 0);
  });

  ensureStyle();
  const T = LOCALE[options.locale ?? "zh"];
  const axisWord = axis === "pressure" ? T.pressure : T.height;
  const root = document.createElement("div");
  root.className = "mw-wpc";
  if (options.className !== undefined) root.classList.add(options.className);
  root.dataset.axis = axis;
  root.dataset.levels = String(ordered.length);
  root.dataset.unit = unit;
  root.dataset.glyph = glyph;
  if (options.title !== undefined) {
    const title = document.createElement("p");
    title.className = "mw-wpc-title";
    title.textContent = options.title;
    root.append(title);
  }

  // 画布几何：折线模式固定高（16 层同高不挤）；barb 模式＝**等行距布层**（每层一行，
  // 行距 ≥ 风羽尺寸×1.15——划与旗保持可数，宁可图高一点）。等行距是 barb 模式的
  // 裁量：对数气压轴在标准层密集处（1000/925/850）层距不足 7px，风羽重叠不可数；
  // 业务剖面图（含 Windy 风廓线面板）在离散层上按等行距排布、行行有标签。
  const width = 340;
  const left = 48;
  const right = 14;
  const top = 14;
  const bottom = 32;
  const plotW = width - left - right;

  // —— 垂直轴映射：barb＝行位（层序自下而上）；line＝气压对数/线性高度（以 h 为纵幅）
  const pressures = ordered.map((l) => l.pressure ?? Number.NaN);
  const pMax = axis === "pressure" ? Math.max(...pressures) : 0;
  const pMin = axis === "pressure" ? Math.min(...pressures) : 0;
  const heights = ordered.map((l) => l.height ?? Number.NaN);
  const hMax = axis === "height" ? Math.max(...heights) : 0;
  const yAt = (level: WindProfileLevel, h: number): number => {
    if (axis === "pressure") {
      const p = level.pressure ?? 1;
      const frac = (Math.log(p) - Math.log(pMin)) / (Math.log(pMax) - Math.log(pMin));
      return top + frac * h; // 气压小（高空）frac→0 在上、气压大（地面）frac→1 在下
    }
    const frac = (level.height ?? 0) / (hMax > 0 ? hMax : 1);
    return top + (1 - frac) * h; // 高度大在上
  };
  const rowIndex = new Map(ordered.map((level, i) => [level, i] as const)); // 层对象 → 行序（自下而上）
  const pitch = Math.max(barbSize * 1.15, 26);
  const plotH = glyph === "barb" ? (ordered.length - 1) * pitch : 380 - top - bottom;
  const height = top + plotH + bottom;
  const yOf = (level: WindProfileLevel): number => {
    if (glyph === "barb") {
      const i = rowIndex.get(level) ?? 0;
      return top + (ordered.length - 1 - i) * pitch; // ordered[0]＝地面层在最下
    }
    return yAt(level, plotH);
  };

  const svg = svgEl("svg", {
    viewBox: `0 0 ${width} ${height}`,
    width: `${width}`,
    height: `${height}`,
    role: "img",
    "aria-label": `${T.speed}${axisWord}${T.profile}（${T.levels(ordered.length)}）`,
  });
  if (glyph === "barb") {
    // barb 模式：每层一行、行行有标签（等行距的轴形态——层锚值直接作行标签）
    for (const level of ordered) {
      const y = yOf(level);
      svg.append(
        svgEl("line", {
          x1: `${left}`,
          y1: y.toFixed(1),
          x2: `${left + plotW}`,
          y2: y.toFixed(1),
          class: "mw-wpc-grid",
        }),
      );
      const anchor = axis === "pressure" ? level.pressure : level.height;
      const label = svgEl("text", {
        x: `${left - 6}`,
        y: (y + 3.5).toFixed(1),
        "text-anchor": "end",
        class: "mw-wpc-ticktext",
      });
      label.textContent = anchor === undefined || anchor === null ? "—" : `${anchor}`;
      svg.append(label);
    }
  } else {
    const yTicks: number[] =
      axis === "pressure" ? STANDARD_PRESSURES.filter((p) => p >= pMin && p <= pMax) : [];
    if (axis === "height") {
      const step = niceStep(hMax, [100, 200, 250, 500, 1000, 2000]);
      for (let v = 0; v <= hMax; v += step) yTicks.push(v);
    } else if (yTicks.length < 2) {
      yTicks.push(pMin, pMax); // 数据范围过窄（如 925–850 hPa 两层族）时退数据端值
    }
    // 刻度不设上限稀疏：这是纵向轴（每枚一行，全谱 16 枚时行距约 20px、10px 字号
    // 不重叠）——横向拥挤的抽稀不适用，标准面全保（925/500/100/50 一枚不丢）。
    for (const value of yTicks) {
      const y = yOf(
        axis === "pressure" ? { pressure: value, height: null } : { pressure: null, height: value },
      );
      if (!Number.isFinite(y)) continue;
      svg.append(
        svgEl("line", {
          x1: `${left}`,
          y1: `${y}`,
          x2: `${left + plotW}`,
          y2: `${y}`,
          class: "mw-wpc-grid",
        }),
      );
      const label = svgEl("text", {
        x: `${left - 6}`,
        y: `${y + 3.5}`,
        "text-anchor": "end",
        class: "mw-wpc-ticktext",
      });
      label.textContent = axis === "pressure" ? `${value}` : fmt(value);
      svg.append(label);
    }
  } // line 模式：标准面刻度（barb 分支的逐行标签到此收口）
  // 垂直轴单位注记（顶端）
  const yUnit = svgEl("text", {
    x: `${left - 6}`,
    y: `${top - 3}`,
    "text-anchor": "end",
    class: "mw-wpc-ticktext",
  });
  yUnit.textContent = axis === "pressure" ? "hPa" : "m";
  svg.append(yUnit);

  // —— 水平轴：风速 0..niceMax
  const maxSpeed = Math.max(0, ...ordered.map((l) => l.speed ?? 0));
  const xStep = niceStep(maxSpeed, [1, 2, 5, 10, 20, 50]);
  const xMax = Math.max(xStep, Math.ceil(maxSpeed / xStep) * xStep);
  const xOf = (speed: number): number => left + (xMax > 0 ? speed / xMax : 0) * plotW;
  for (let v = 0; v <= xMax + 1e-9; v += xStep) {
    const x = xOf(v);
    svg.append(
      svgEl("line", {
        x1: `${x}`,
        y1: `${top}`,
        x2: `${x}`,
        y2: `${top + plotH}`,
        class: "mw-wpc-grid",
      }),
    );
    const label = svgEl("text", {
      x: `${x}`,
      y: `${top + plotH + 14}`,
      "text-anchor": "middle",
      class: "mw-wpc-ticktext",
    });
    label.textContent = fmt(v);
    svg.append(label);
  }
  const xUnit = svgEl("text", {
    x: `${left + plotW}`,
    y: `${top + plotH + 28}`,
    "text-anchor": "end",
    class: "mw-wpc-unittext",
  });
  xUnit.textContent = `${T.speed}（${unit}）`;
  svg.append(xUnit);
  svg.append(
    svgEl("line", {
      x1: `${left}`,
      y1: `${top + plotH}`,
      x2: `${left + plotW}`,
      y2: `${top + plotH}`,
      class: "mw-wpc-axis",
    }),
    svgEl("line", {
      x1: `${left}`,
      y1: `${top}`,
      x2: `${left}`,
      y2: `${top + plotH}`,
      class: "mw-wpc-axis",
    }),
  );

  // —— 曲线：按「speed 非 null」的连续段分段（缺测处折线断开，不跨缺测连线）
  const runs: string[] = [];
  let current: string[] = [];
  for (const level of ordered) {
    if (level.speed === undefined || level.speed === null) {
      if (current.length >= 2) runs.push(current.join(" "));
      current = [];
      continue;
    }
    current.push(`${xOf(level.speed).toFixed(1)},${yOf(level).toFixed(1)}`);
  }
  if (current.length >= 2) runs.push(current.join(" "));
  for (const points of runs) {
    if (glyph === "barb") break; // 风羽列替代折线（速度已编码在旗/划里）
    svg.append(svgEl("polyline", { points, class: "mw-wpc-curve" }));
  }

  // —— 逐层标记：barb 模式＝居中着色风羽列（每层一枚，色＝该层风速经色标映射）；
  // 折线模式＝曲线点＋方向箭头（箭杆指去向：来向 +180°；无方向不出箭）
  const barbCx = left + plotW / 2; // 风羽列水平居中（Windy 风廓线面板形态）
  for (const level of ordered) {
    const y = yOf(level);
    const speed = level.speed;
    if (glyph === "barb") {
      if (speed === undefined || speed === null) {
        // 缺测层：风羽列位上一枚居中的「缺测」短划（空缺可辨，与折线模式同语义）
        const dash = svgEl("line", {
          x1: (barbCx - 9).toFixed(1),
          y1: y.toFixed(1),
          x2: (barbCx + 9).toFixed(1),
          y2: y.toFixed(1),
          class: "mw-wpc-missing",
        });
        const tip = svgEl("title", {});
        tip.textContent = T.missing;
        dash.append(tip);
        svg.append(dash);
        continue;
      }
      // 墨色＝该层风速经色标映射（「色斑长在风羽上」）；scale 在 barb 模式入口已验必传，
      // 此守卫不可达——但兜默认色＝静默画错图，按不静默纪律留显式炸点
      const scaleInput = options.scale;
      if (scaleInput === undefined) {
        throw new Error('windProfileChart 的 glyph:"barb" 缺 scale 选项（入口已验的不可达守卫）');
      }
      const ink = colorAt(speed, scaleInput);
      if (speed < barbCalmThreshold) {
        // 静风：着色圆圈（不画杆——与 windBarbOf 静风不出杆同口径）
        const holder = svgEl("g", { transform: `translate(${barbCx.toFixed(1)} ${y.toFixed(1)})` });
        holder.append(calmGlyphEl(barbSize, ink));
        svg.append(holder);
        continue;
      }
      if (
        level.direction !== undefined &&
        level.direction !== null &&
        activeBarbScale !== undefined
      ) {
        const holder = svgEl("g", { transform: `translate(${barbCx.toFixed(1)} ${y.toFixed(1)})` });
        holder.append(
          barbGlyphEl({
            direction: level.direction,
            speed,
            scale: activeBarbScale,
            level: barbGlyphLevelOf(barbSize),
            size: barbSize,
            ink,
          }),
        );
        svg.append(holder);
      }
      // 阈上有速无向：不出符号（方向无从画——与折线模式的无箭口径一致）
      continue;
    }
    if (speed === undefined || speed === null) {
      // 缺测层：该高度一枚「缺测」短划（空缺可辨）
      const dash = svgEl("line", {
        x1: `${left + 4}`,
        y1: y.toFixed(1),
        x2: `${left + 22}`,
        y2: y.toFixed(1),
        class: "mw-wpc-missing",
      });
      const tip = svgEl("title", {});
      tip.textContent = T.missing;
      dash.append(tip);
      svg.append(dash);
      continue;
    }
    const cx = xOf(speed);
    svg.append(
      svgEl("circle", {
        cx: cx.toFixed(1),
        cy: y.toFixed(1),
        r: "2.6",
        class: "mw-wpc-mark",
      }),
    );
    if (level.direction !== undefined && level.direction !== null) {
      // 箭杆本地坐标指北（上），整组按 来向+180° 旋转＝指向风的去向
      const g = svgEl("g", {
        transform: `translate(${cx.toFixed(1)} ${y.toFixed(1)}) rotate(${((level.direction + 180) % 360).toFixed(1)})`,
        class: "mw-wpc-arrow",
      });
      g.append(
        svgEl("line", { x1: "0", y1: "6", x2: "0", y2: "-3" }),
        svgEl("polygon", { points: "0,-8 -2.6,-2.4 2.6,-2.4" }),
      );
      svg.append(g);
    }
  }

  root.append(svg);

  // barb 模式内嵌色标图例（风羽着色的读法键——renderColorScaleLegend categorical 形态）；
  // 折线模式不画（无着色可读，保持既有 DOM 零变化）
  if (glyph === "barb" && options.scale !== undefined) {
    const legend = renderColorScaleLegend(options.scale, {
      mode: "categorical",
      title: T.legendTitle(unit),
      firstEdgeLabel: "0",
    });
    legend.style.margin = "6px 0 0";
    root.append(legend);
  }
  return root;
}
