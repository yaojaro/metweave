/**
 * @metweave/render — 分级色标图例组件：色斑图的图例（颜色与档界一体呈现）。
 *
 * **数字与颜色不在本组件里**（与 wind-legend 同一条纪律）：断点与停靠色由调用方从
 * 要素档案的色标（`buildColorScale` 产物）传入——render 包不依赖 grid，色标只有
 * 档案一份真源，组件只负责画得可读。
 *
 * 两种形态（`mode`）：
 * - `"categorical"`（缺省）＝**分格图例**：每档一格等宽硬色（档界不等距也不失真——
 *   「第几格」即「第几档」），界值标注在格界上。适合阈值档业务色卡（如 10m 风的
 *   3/5/10/15/20/30 m/s），也是 windy 式读法；
 * - `"linear"` ＝**渐变图例**：停靠色连续渐变，刻度按值域线性定位（近值碰撞右让）。
 *   停靠色数＝档数时，渐变各色停在其档界的值轴位置——**换色点与刻度严格对齐**
 *   （非等距断点不失真）；多停靠的连续渐变意图（停靠≠档界）维持等分分布。
 *
 * 自足样式（`mw-csl-*` 类名，head 一次注入）；**不占布局**——组件只画内容框，定位
 * （如「地图左下角悬浮」）由宿主容器或自加类名安排。
 */
/** 色标入参（结构同 @metweave/grid 的 ColorScale——按结构收，包间零依赖）。 */
export interface ColorScaleLegendInput {
  /** 档界断点（显示单位空间、严格递增；档数＝breaks.length＋1） */
  readonly breaks: readonly number[];
  /** 停靠色（低→高；#rgb/#rgba/#rrggbb/#rrggbbaa——与色斑渲染同一份） */
  readonly colors: readonly string[];
}

/** 色标图例选项。 */
export interface RenderColorScaleLegendOptions {
  /** 图例形态（缺省 `"categorical"` 分格；`"linear"` 渐变＋线性刻度） */
  readonly mode?: "categorical" | "linear";
  /** 标题行（如「10m 风（m/s）」；缺席不画） */
  readonly title?: string;
  /** 单位注记（linear 形态右缘；缺席不画） */
  readonly unit?: string;
  /** linear 形态的刻度值（缺省＝breaks；categorical 形态不读——格界即刻度） */
  readonly tickValues?: readonly number[];
  /** 值格式化（缺省：整数原样、非整数一位小数） */
  readonly formatValue?: (value: number) => string;
  /** 末档注记（如 vis 的「≥24.1（满量程）」——末档外延无界的量程语义，缺席不画） */
  readonly topBinNote?: string;
  /** categorical 形态的首缘标注（如风速的 "0"＝物理下界；缺席不画首刻度） */
  readonly firstEdgeLabel?: string;
  /** categorical 形态的末缘标注（缺省 "+"＝末档外延无界） */
  readonly lastEdgeLabel?: string;
  /** 叠加到根元素的类名（宿主定位钩子） */
  readonly className?: string;
}

const STYLE_ID = "metweave-colorscale-legend-style";

const COLORSCALE_CSS = `
.mw-csl { display: inline-block; padding: 8px 12px; border-radius: 8px; background: rgba(255, 255, 255, 0.88); backdrop-filter: blur(2px); font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2a37; }
.mw-csl-title { font-size: 12px; font-weight: 600; color: #33506b; margin: 0 0 5px; }
.mw-csl-bar { display: flex; height: 10px; border-radius: 2px; overflow: hidden; }
.mw-csl-seg { flex: 1 1 0; }
.mw-csl-ticks { position: relative; height: 15px; margin-top: 2px; font-size: 10.5px; line-height: 15px; color: #3b4757; font-variant-numeric: tabular-nums; }
.mw-csl-tick { position: absolute; top: 0; white-space: nowrap; transform: translateX(-50%); }
.mw-csl-tick.mw-csl-first { transform: none; }
.mw-csl-tick.mw-csl-last { transform: translateX(-100%); }
.mw-csl-foot { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-top: 2px; }
.mw-csl-note { font-size: 10.5px; color: #6b7785; }
.mw-csl-unit { font-size: 11px; color: #6b7785; }
`;

/** 样式只注入一次（同 wind-legend.ts）。 */
function ensureStyle(): void {
  if (document.getElementById(STYLE_ID) !== null) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = COLORSCALE_CSS;
  document.head.append(style);
}

const fmtDefault = (v: number): string =>
  Number.isInteger(v) ? `${v}` : `${Math.round(v * 10) / 10}`;

/**
 * 画一份分级色标图例（色斑图的配套读图件）。
 *
 * categorical 形态：`breaks` 的每个界值标在对应格界（第 k 界＝k/档数 位置），首缘
 * （物理下界，如风速 0）与末缘（外延无界 "+`）可选标注——界值不等距的阈值档不失真。
 * linear 形态：停靠色 `linear-gradient` 连续渐变，刻度按值域首末张成线性定位，相邻
 * 中位刻度最小间距 6% 右让（近值不重叠）、首末恒锚两端。
 */
export function renderColorScaleLegend(
  scale: ColorScaleLegendInput,
  options: RenderColorScaleLegendOptions = {},
): HTMLElement {
  ensureStyle();
  const fmt = options.formatValue ?? fmtDefault;
  const bins = scale.breaks.length + 1;
  if (scale.colors.length === 0) {
    throw new Error("renderColorScaleLegend 收到空色带（colors 至少一色）");
  }
  // 分格形态的隐含前置显式化（不静默）：第几格＝第几档，停靠色数必须＝档数——档案色标
  // 里停靠≠档的（渐变意图，如 cape 9 停靠 4 档）按格画会格档错位，应走 linear 形态
  if (options.mode !== "linear" && scale.colors.length !== bins) {
    throw new Error(
      `renderColorScaleLegend 分格形态（categorical）要求停靠色数＝档数（colors ${String(scale.colors.length)} ≠ breaks＋1 ${String(bins)}）——渐变意图的色标请用 mode:"linear"`,
    );
  }
  for (const key of Object.keys(options)) {
    const known = new Set([
      "mode",
      "title",
      "unit",
      "tickValues",
      "formatValue",
      "topBinNote",
      "firstEdgeLabel",
      "lastEdgeLabel",
      "className",
    ]);
    if (!known.has(key)) {
      throw new Error(`renderColorScaleLegend 收到未知选项 "${key}"——拼错的选项不会生效`);
    }
  }

  const root = document.createElement("figure");
  root.className = `mw-csl${options.className !== undefined ? ` ${options.className}` : ""}`;
  root.style.margin = "0";
  if (options.title !== undefined) {
    const title = document.createElement("figcaption");
    title.className = "mw-csl-title";
    title.textContent = options.title;
    root.append(title);
  }

  // linear 形态的值域轴（先算——刻度定位与渐变停配色共用一份）
  const linearValues = options.mode === "linear" ? (options.tickValues ?? scale.breaks) : [];
  const lo = linearValues[0] ?? 0;
  const hi = linearValues[linearValues.length - 1] ?? 0;
  const span = hi - lo;

  const bar = document.createElement("div");
  bar.className = "mw-csl-bar";
  if (options.mode === "linear") {
    if (scale.colors.length === bins) {
      // 停靠色数＝档数：每色停在其档界（左界 break k−1）在值轴上的真实位置——换色点与
      // 刻度严格对齐（等分停配色在非等距断点下会系统性错位：刻度 10 落在值轴 25.9%
      // 而其停配色在等分 33.3%）；同位置双停＝硬换色边，CSS 合法
      const stops = scale.colors.map((c, k) => {
        if (k === 0) return `${c} 0%`;
        const b = scale.breaks[k - 1] ?? hi;
        const pct = span <= 0 ? (k / bins) * 100 : ((b - lo) / span) * 100;
        return `${c} ${pct.toFixed(3)}%`;
      });
      bar.style.background = `linear-gradient(90deg, ${stops.join(", ")})`;
    } else {
      // 多停靠的连续渐变意图（停靠≠档界）：等分渐变（各停靠本就不对应档界）
      bar.style.background = `linear-gradient(90deg, ${scale.colors.join(", ")})`;
    }
    bar.style.borderRadius = "2px";
  } else {
    for (const color of scale.colors) {
      const seg = document.createElement("span");
      seg.className = "mw-csl-seg";
      seg.style.background = color;
      bar.append(seg);
    }
  }
  root.append(bar);

  const ticks = document.createElement("div");
  ticks.className = "mw-csl-ticks";
  const put = (text: string, pct: number, anchor: "first" | "mid" | "last"): void => {
    const t = document.createElement("span");
    t.className = `mw-csl-tick${anchor === "first" ? " mw-csl-first" : anchor === "last" ? " mw-csl-last" : ""}`;
    t.textContent = text;
    t.style.left = `${pct}%`;
    ticks.append(t);
  };
  if (options.mode === "linear") {
    const values = linearValues;
    const MIN_GAP = 6;
    let prev = Number.NaN;
    values.forEach((value, i) => {
      if (i === 0) {
        prev = 0;
        put(fmt(value), 0, "first");
        return;
      }
      if (i === values.length - 1) {
        put(fmt(value), 100, "last");
        return;
      }
      const raw = span <= 0 ? 50 : ((value - lo) / span) * 100;
      const floor = Number.isFinite(prev) ? prev + MIN_GAP : MIN_GAP;
      const pct = Math.min(Math.max(raw, floor), 100 - MIN_GAP);
      prev = pct;
      put(fmt(value), pct, "mid");
    });
  } else {
    // 分格：界值落在 k/档数 格界；首末缘可选标注（首＝物理下界、末＝外延无界）
    const labels: Array<{ text: string; pct: number; anchor: "first" | "mid" | "last" }> = [];
    if (options.firstEdgeLabel !== undefined) {
      labels.push({ text: options.firstEdgeLabel, pct: 0, anchor: "first" });
    }
    scale.breaks.forEach((b, k) => {
      const pct = ((k + 1) / bins) * 100;
      labels.push({ text: fmt(b), pct, anchor: "mid" });
    });
    labels.push({ text: options.lastEdgeLabel ?? "+", pct: 100, anchor: "last" });
    for (const l of labels) put(l.text, l.pct, l.anchor);
  }
  root.append(ticks);

  if (options.topBinNote !== undefined || options.unit !== undefined) {
    const foot = document.createElement("div");
    foot.className = "mw-csl-foot";
    if (options.topBinNote !== undefined) {
      const note = document.createElement("span");
      note.className = "mw-csl-note";
      note.textContent = options.topBinNote;
      foot.append(note);
    }
    if (options.unit !== undefined) {
      const unit = document.createElement("span");
      unit.className = "mw-csl-unit";
      unit.textContent = options.unit;
      foot.append(unit);
    }
    root.append(foot);
  }
  return root;
}
