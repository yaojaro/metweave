/**
 * @metweave/render — 风速时序＋阵风标记（W-13）：逐时观测 → 折线＋包络带＋阵风事件。
 *
 * 形态（**阵风不是连续带**——这是本组件的设计裁定）：平均风速＝连续折线＋折线到
 * 基线的浅色包络带（走势体量一眼可读）；阵风＝**按事件画标记**——每个有阵风观测的
 * 时次一枚独立标记（自该时次平均风速点引一竖茎到阵风值＋阵风值端一枚圆点），时次
 * 之间不连线、不铺带。理由：阵风观测是**事件性**的（只在有阵风的时次编报），把散点
 * 连成带＝在无观测的时次之间编造数据——与「缺测处断线」同一条不编造纪律。
 *
 * 输入兼容观测逐时序列：speed/gust 各自可缺测（IEM 一类源里阵风只在该有阵风的时次
 * 在场）；speed 缺测处折线与包络带断开，该时次若仍有阵风观测则只画阵风标记（无茎
 * 端点）；**孤立单点**（前后时次皆缺测）不成线，补一枚与折线同色的小点保住该时次
 * 的读数可见性。静风（speed 0）照画在 0 线上。非法值显式抛错；unit 是量纲声明不是换算。
 */
import type { WindDisplayUnitInput, WindHourlySample, WindHourlySeries } from "./wind-profile";
import { normalizeWindDisplayUnit } from "./wind-profile";

/** gustBand 的选项。 */
export interface GustBandOptions {
  /** 风速量纲声明（缺省 `"m/s"`；数值必须已是该单位——本组件不换算） */
  readonly unit?: WindDisplayUnitInput;
  /** 文案语言（缺省 zh） */
  readonly locale?: "zh" | "en";
  /** 标题行（缺席不画） */
  readonly title?: string;
  /** 叠加到根元素的类名（宿主样式钩子） */
  readonly className?: string;
}

/** 风速时序的文案表（zh / en；同本包纪律）。 */
interface GustBandLocale {
  readonly ariaLabel: string;
  readonly speed: string;
  readonly gust: string;
  readonly soloTitle: string;
}

const LOCALE: Record<"zh" | "en", GustBandLocale> = {
  zh: {
    ariaLabel: "风速时序与阵风标记",
    speed: "平均风速",
    gust: "阵风",
    soloTitle: "孤立时次风速",
  },
  en: {
    ariaLabel: "Wind speed and gust",
    speed: "Mean wind",
    gust: "Gust",
    soloTitle: "Isolated speed",
  },
};

const STYLE_ID = "metweave-gust-band-style";
const SVG_NS = "http://www.w3.org/2000/svg";

const GUST_CSS = `
.mw-gb { display: inline-block; padding: 8px 10px; border: 1px solid #d8dee6; border-radius: 8px; background: #fbfcfd; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2a37; }
.mw-gb-title { font-size: 13px; font-weight: 600; color: #33506b; margin: 0 0 4px; }
.mw-gb svg { display: block; }
.mw-gb .mw-gb-grid { stroke: #e3e8ee; stroke-width: 1; }
.mw-gb .mw-gb-axis { stroke: #b9c4cf; stroke-width: 1; }
.mw-gb .mw-gb-ticktext { font: 10px system-ui, sans-serif; fill: #6b7785; }
.mw-gb .mw-gb-unittext { font: 10.5px system-ui, sans-serif; fill: #6b7785; }
.mw-gb .mw-gb-band { fill: rgba(44, 95, 138, 0.14); }
.mw-gb .mw-gb-curve { fill: none; stroke: #2c5f8a; stroke-width: 2; stroke-linejoin: round; }
.mw-gb .mw-gb-stem { stroke: #c2554a; stroke-width: 1.3; stroke-dasharray: 2 2; }
.mw-gb .mw-gb-gust { fill: #c2554a; }
.mw-gb .mw-gb-solo { fill: #2c5f8a; }
.mw-gb-note { margin: 4px 0 0; font-size: 11px; color: #6b7785; display: flex; gap: 12px; flex-wrap: wrap; }
.mw-gb-swatch { display: inline-block; width: 12px; height: 3px; border-radius: 2px; vertical-align: middle; background: #2c5f8a; }
.mw-gb-swatch.mw-gb-gust-swatch { width: 8px; height: 8px; border-radius: 50%; background: #c2554a; }
`;

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID) !== null) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = GUST_CSS;
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

/** 逐时样本校验：时刻非空、值域合法（speed/gust ≥0 有限；与族同口径）。 */
function assertSample(sample: WindHourlySample, index: number): void {
  const at = `第 ${index + 1} 时次`;
  if (typeof sample.time !== "string" || sample.time === "") {
    throw new Error(`gustBand ${at}缺时刻标签（time 非空字符串）`);
  }
  for (const field of ["speed", "gust"] as const) {
    const value = sample[field];
    if (value !== undefined && value !== null && !(Number.isFinite(value) && value >= 0)) {
      throw new Error(
        `gustBand ${at}的 ${field} 非法（${String(value)}，须为 ≥0 的有限数或缺测 null）`,
      );
    }
  }
}

/** 「好刻度」步长（与 windProfileChart 同款梯子）。 */
function niceStep(max: number, candidates: readonly number[]): number {
  for (const step of candidates) {
    if (max / step <= 6) return step;
  }
  return candidates[candidates.length - 1] ?? max;
}

const fmt = (v: number): string => (Number.isInteger(v) ? `${v}` : `${Math.round(v * 10) / 10}`);

/**
 * 画一张风速时序图（W-13）：平均风速折线＋包络带，阵风按事件独立标记（不连不铺）。
 *
 * @param series - 逐时观测序列（speed/gust 各自可缺测；≥2 时次）
 * @param options - 见 GustBandOptions。
 */
export function gustBand(series: WindHourlySeries, options: GustBandOptions = {}): HTMLElement {
  for (const key of Object.keys(options)) {
    if (key !== "unit" && key !== "locale" && key !== "title" && key !== "className") {
      throw new Error(
        `gustBand 收到未知选项 "${key}"（可用项：unit、locale、title、className）——拼错的选项不会生效`,
      );
    }
  }
  if (options.locale !== undefined && options.locale !== "zh" && options.locale !== "en") {
    const badLocale: string = options.locale; // never 收窄后的宽化中转（同 card.ts）
    throw new Error(`gustBand 的 locale 选项值 "${badLocale}" 不受支持（可用："zh" | "en"）`);
  }
  const unit = normalizeWindDisplayUnit(options.unit, "gustBand");
  if (unit !== "m/s" && unit !== "kt") {
    throw new Error(
      `gustBand 的 unit 选项值 "${String(options.unit)}" 不受支持（可用："m/s" | "kt"；"mps" 为别名）`,
    );
  }
  if (series.length < 2) {
    throw new Error(`gustBand 时次数不足（${series.length} < 2）——时序至少两个时次起画`);
  }
  for (const [index, sample] of series.entries()) assertSample(sample, index);

  ensureStyle();
  const T = LOCALE[options.locale ?? "zh"];
  const root = document.createElement("div");
  root.className = "mw-gb";
  if (options.className !== undefined) root.classList.add(options.className);
  root.dataset.samples = String(series.length);
  root.dataset.unit = unit;
  if (options.title !== undefined) {
    const title = document.createElement("p");
    title.className = "mw-gb-title";
    title.textContent = options.title;
    root.append(title);
  }

  // 画布几何：x＝时次序等距（观测逐时粒度，不解析时刻算术）、y＝0..niceMax
  const width = 640;
  const height = 240;
  const left = 40;
  const right = 14;
  const top = 14;
  const bottom = 34;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const n = series.length;
  const xOf = (i: number): number => left + (n > 1 ? i / (n - 1) : 0) * plotW;
  const maxAll = series.reduce((m, s) => Math.max(m, s.speed ?? 0, s.gust ?? 0), 0);
  const yStep = niceStep(maxAll, [1, 2, 5, 10, 20, 50]);
  const yMax = Math.max(yStep, Math.ceil(maxAll / yStep) * yStep);
  const yOf = (v: number): number => top + (1 - (yMax > 0 ? v / yMax : 0)) * plotH;

  const svg = svgEl("svg", {
    viewBox: `0 0 ${width} ${height}`,
    width: `${width}`,
    height: `${height}`,
    role: "img",
    "aria-label": T.ariaLabel,
  });

  // 纵横网格与刻度
  for (let v = 0; v <= yMax + 1e-9; v += yStep) {
    const y = yOf(v);
    svg.append(
      svgEl("line", {
        x1: `${left}`,
        y1: y.toFixed(1),
        x2: `${left + plotW}`,
        y2: y.toFixed(1),
        class: "mw-gb-grid",
      }),
    );
    const label = svgEl("text", {
      x: `${left - 6}`,
      y: (y + 3.5).toFixed(1),
      "text-anchor": "end",
      class: "mw-gb-ticktext",
    });
    label.textContent = fmt(v);
    svg.append(label);
  }
  const k = Math.max(1, Math.ceil(n / 8));
  series.forEach((sample, i) => {
    if (i % k !== 0 && i !== n - 1) return;
    const label = svgEl("text", {
      x: xOf(i).toFixed(1),
      y: `${top + plotH + 14}`,
      "text-anchor": i === 0 ? "start" : i === n - 1 ? "end" : "middle",
      class: "mw-gb-ticktext",
    });
    label.textContent = sample.time;
    svg.append(label);
  });
  const unitLabel = svgEl("text", {
    x: `${left + plotW}`,
    y: `${top + plotH + 28}`,
    "text-anchor": "end",
    class: "mw-gb-unittext",
  });
  unitLabel.textContent = `${T.speed} / ${T.gust}（${unit}）`;
  svg.append(unitLabel);
  svg.append(
    svgEl("line", {
      x1: `${left}`,
      y1: `${top + plotH}`,
      x2: `${left + plotW}`,
      y2: `${top + plotH}`,
      class: "mw-gb-axis",
    }),
    svgEl("line", {
      x1: `${left}`,
      y1: `${top}`,
      x2: `${left}`,
      y2: `${top + plotH}`,
      class: "mw-gb-axis",
    }),
  );

  // —— 平均风速：连续段（speed 非 null 的相邻时次）折线＋到基线的包络带；缺测处双断
  type Pt = { i: number; speed: number };
  const runs: Pt[][] = [];
  let current: Pt[] = [];
  series.forEach((sample, i) => {
    if (sample.speed === undefined || sample.speed === null) {
      if (current.length > 0) runs.push(current);
      current = [];
      return;
    }
    current.push({ i, speed: sample.speed });
  });
  if (current.length > 0) runs.push(current);
  for (const run of runs) {
    if (run.length === 1) {
      // 孤立单点不成线（画不出折线与带），但补一枚与折线同色的小点——该时次的
      // 风速读数不再整时次消失（P2-8 修复：此前无阵风时该时次在图上完全不可见）
      const solo = run[0];
      if (solo !== undefined) {
        const dot = svgEl("circle", {
          cx: xOf(solo.i).toFixed(1),
          cy: yOf(solo.speed).toFixed(1),
          r: "2.5",
          class: "mw-gb-solo",
        });
        const tip = svgEl("title", {});
        tip.textContent = T.soloTitle;
        dot.append(tip);
        svg.append(dot);
      }
      continue;
    }
    const linePts = run.map((p) => `${xOf(p.i).toFixed(1)},${yOf(p.speed).toFixed(1)}`).join(" ");
    svg.append(svgEl("polyline", { points: linePts, class: "mw-gb-curve" }));
    // 包络带：折线两端垂到基线、沿基线折返的闭合多边形
    const first = run[0];
    const last = run[run.length - 1];
    if (first !== undefined && last !== undefined) {
      const bandPts = `${xOf(first.i).toFixed(1)},${(top + plotH).toFixed(1)} ${linePts} ${xOf(last.i).toFixed(1)},${(top + plotH).toFixed(1)}`;
      svg.append(svgEl("polygon", { points: bandPts, class: "mw-gb-band" }));
    }
  }

  // —— 阵风事件标记：每观测一枚（有平均风速在场的时次带竖茎；无则孤点）
  let gustCount = 0;
  series.forEach((sample, i) => {
    const gust = sample.gust;
    if (gust === undefined || gust === null) return;
    gustCount += 1;
    const x = xOf(i);
    const speed = sample.speed;
    if (speed !== undefined && speed !== null) {
      svg.append(
        svgEl("line", {
          x1: x.toFixed(1),
          y1: yOf(speed).toFixed(1),
          x2: x.toFixed(1),
          y2: yOf(gust).toFixed(1),
          class: "mw-gb-stem",
        }),
      );
    }
    svg.append(
      svgEl("circle", {
        cx: x.toFixed(1),
        cy: yOf(gust).toFixed(1),
        r: "3",
        class: "mw-gb-gust",
      }),
    );
  });
  root.dataset.gusts = String(gustCount);
  root.append(svg);

  // 图例行：平均风速线＋阵风点
  const note = document.createElement("p");
  note.className = "mw-gb-note";
  const lineSwatch = document.createElement("i");
  lineSwatch.className = "mw-gb-swatch";
  const gustSwatch = document.createElement("i");
  gustSwatch.className = "mw-gb-swatch mw-gb-gust-swatch";
  const legend1 = document.createElement("span");
  legend1.append(lineSwatch, ` ${T.speed}`);
  const legend2 = document.createElement("span");
  legend2.append(gustSwatch, ` ${T.gust}`);
  note.append(legend1, legend2);
  root.append(note);
  return root;
}
