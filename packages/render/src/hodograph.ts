/**
 * @metweave/render — 高空风图（W-11）：多层风矢量 → u/v 极坐标端点连线（切变视图）。
 *
 * 形态：每层风画成极坐标**端点**（u＝东向、v＝北向，原点＝静风；`windComponentsOf`
 * 单源换算），相邻层端点连线＝该层间的**切变矢量**（线长＝切变大小、线向＝切变方向）
 * ——整条折线自下而上爬升，拐弯越急切变越强，是低空切变/飑线判读的经典件。
 *
 * 低空段高亮（缺省 0–1 km，可传 `highlight` 自定）：段两端的**低端层**高度落在区间内
 * 的连线换强调色——低空急流/边界层切变的业务关注段一眼可分。层高缺场的层不参与
 * 高亮判定（不编造高度）。
 *
 * 缺测口径：speed/direction 任一缺测的层不出端点，其两侧连线**同断**——连线按
 * **原始层序相邻**判定（成点带层下标，下标差 1 才连），跨缺测层的两点不连（线长
 * ＝切变大小是本组件的核心语义，跨缺测连线会冒充一个不存在的「大层间」切变）；
 * speed 0 的层端点在原点（静风锚——方向无意义但位置有意义）。≥8 层起画
 * （高空风图的读法建立在多层连续爬升上——验收口径）。非法值显式抛错，量纲声明同
 * windProfileChart（unit 是声明不是换算）。
 */
import type { WindProfile, WindProfileLevel } from "./wind-profile";
import { normalizeWindDisplayUnit, windComponentsOf } from "./wind-profile";
import type { WindDisplayUnitInput } from "./wind-profile";

/** 一段要高亮的层高区间（低端层落在此区间内的连线换强调色）。 */
export interface HodographLayer {
  /** 区间下界（m，含） */
  readonly fromHeightM: number;
  /** 区间上界（m，不含） */
  readonly toHeightM: number;
  /** 区间标签（图例行文案；缺席用 `fromHeightM–toHeightM m`） */
  readonly label?: string;
}

/** hodograph 的选项。 */
export interface HodographOptions {
  /** 风速量纲声明（缺省 `"m/s"`；数值必须已是该单位——本组件不换算） */
  readonly unit?: WindDisplayUnitInput;
  /** 高亮层高区间（缺省 `[{ fromHeightM: 0, toHeightM: 1000 }]`＝低空 0–1 km 段） */
  readonly highlight?: readonly HodographLayer[];
  /** 文案语言（缺省 zh） */
  readonly locale?: "zh" | "en";
  /** 标题行（缺席不画） */
  readonly title?: string;
  /** 叠加到根元素的类名（宿主样式钩子） */
  readonly className?: string;
}

/** 高空风图的文案表（zh / en；同本包纪律）。 */
interface HodographLocale {
  readonly ariaLabel: string;
  readonly shearHint: string;
  readonly highlightLabel: (from: number, to: number) => string;
}

const LOCALE: Record<"zh" | "en", HodographLocale> = {
  zh: {
    ariaLabel: "高空风图",
    shearHint: "端点连线＝层间切变矢量（线长＝切变大小）",
    highlightLabel: (from, to) => `${from}–${to} m`,
  },
  en: {
    ariaLabel: "Hodograph",
    shearHint: "Segment between endpoints = shear vector (length = magnitude)",
    highlightLabel: (from, to) => `${from}\u2013${to} m`,
  },
};

const STYLE_ID = "metweave-hodograph-style";
const SVG_NS = "http://www.w3.org/2000/svg";

const HODO_CSS = `
.mw-hodo { display: inline-block; padding: 8px 10px; border: 1px solid #d8dee6; border-radius: 8px; background: #fbfcfd; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2a37; }
.mw-hodo-title { font-size: 13px; font-weight: 600; color: #33506b; margin: 0 0 4px; }
.mw-hodo svg { display: block; }
.mw-hodo .mw-hodo-grid { stroke: #e3e8ee; stroke-width: 1; }
.mw-hodo .mw-hodo-ringtext { font: 9.5px system-ui, sans-serif; fill: #6b7785; }
.mw-hodo .mw-hodo-axis { stroke: #b9c4cf; stroke-width: 1; }
.mw-hodo .mw-hodo-seg { stroke-width: 2; stroke-linecap: round; }
.mw-hodo .mw-hodo-seg.mw-hodo-low { stroke: #c2554a; }
.mw-hodo .mw-hodo-seg.mw-hodo-mid { stroke: #44546a; }
.mw-hodo .mw-hodo-mark { fill: #2c3e50; }
.mw-hodo .mw-hodo-mark.mw-hodo-low { fill: #c2554a; }
.mw-hodo-note { margin: 4px 0 0; font-size: 11px; color: #6b7785; display: flex; gap: 12px; flex-wrap: wrap; }
.mw-hodo-chip { display: inline-block; width: 14px; height: 3px; border-radius: 2px; vertical-align: middle; }
.mw-hodo-chip.mw-hodo-low { background: #c2554a; }
.mw-hodo-chip.mw-hodo-mid { background: #44546a; }
`;

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID) !== null) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = HODO_CSS;
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

/** 单层校验（与 windProfileChart 同值域口径；层锚可全缺——几何不需要锚，高亮才需要）。 */
function assertSample(level: WindProfileLevel, index: number): void {
  const at = `第 ${index + 1} 层`;
  const { speed, direction, pressure, height } = level;
  if (speed !== undefined && speed !== null && !(Number.isFinite(speed) && speed >= 0)) {
    throw new Error(
      `hodograph ${at}的 speed 非法（${String(speed)}，须为 ≥0 的有限数或缺测 null）`,
    );
  }
  if (
    direction !== undefined &&
    direction !== null &&
    !(Number.isFinite(direction) && direction >= 0 && direction <= 360)
  ) {
    throw new Error(
      `hodograph ${at}的 direction 非法（${String(direction)}，须为 0–360 的有限数：北 0／东 90／南 180／西 270）`,
    );
  }
  if (pressure !== undefined && pressure !== null && !(Number.isFinite(pressure) && pressure > 0)) {
    throw new Error(
      `hodograph ${at}的 pressure 非法（${String(pressure)}，须为正有限数〔hPa〕或缺测 null）`,
    );
  }
  if (height !== undefined && height !== null && !(Number.isFinite(height) && height >= 0)) {
    throw new Error(
      `hodograph ${at}的 height 非法（${String(height)}，须为 ≥0 的有限数〔m〕或缺测 null）`,
    );
  }
}

/** 风速环刻度步长：两套口径各取业务顺手的整数档（m/s 5／kt 10）。 */
const RING_STEP: Readonly<Record<"m/s" | "kt", number>> = Object.freeze({ "m/s": 5, kt: 10 });

/**
 * 画一张高空风图（W-11）：多层风矢量 → u/v 端点＋层间连线（切变矢量）。
 *
 * @param samples - 多层风读数（≥8 层；层序任意，组件按层锚自排——层锚全缺时按输入序）
 * @param options - 见 HodographOptions。
 */
export function hodograph(samples: WindProfile, options: HodographOptions = {}): HTMLElement {
  for (const key of Object.keys(options)) {
    if (
      key !== "unit" &&
      key !== "highlight" &&
      key !== "locale" &&
      key !== "title" &&
      key !== "className"
    ) {
      throw new Error(
        `hodograph 收到未知选项 "${key}"（可用项：unit、highlight、locale、title、className）——拼错的选项不会生效`,
      );
    }
  }
  if (options.locale !== undefined && options.locale !== "zh" && options.locale !== "en") {
    const badLocale: string = options.locale; // never 收窄后的宽化中转（同 card.ts）
    throw new Error(`hodograph 的 locale 选项值 "${badLocale}" 不受支持（可用："zh" | "en"）`);
  }
  const unit = normalizeWindDisplayUnit(options.unit, "hodograph");
  if (unit !== "m/s" && unit !== "kt") {
    throw new Error(
      `hodograph 的 unit 选项值 "${String(options.unit)}" 不受支持（可用："m/s" | "kt"；"mps" 为别名）`,
    );
  }
  if (samples.length < 8) {
    throw new Error(
      `hodograph 层数不足（${samples.length} < 8）——高空风图的读法建立在多层连续爬升上，至少 8 层起画`,
    );
  }
  for (const [index, level] of samples.entries()) assertSample(level, index);
  const highlight = options.highlight ?? [{ fromHeightM: 0, toHeightM: 1000 }];
  for (const [index, layer] of highlight.entries()) {
    if (
      !(
        Number.isFinite(layer.fromHeightM) &&
        Number.isFinite(layer.toHeightM) &&
        layer.fromHeightM < layer.toHeightM
      )
    ) {
      throw new Error(
        `hodograph 的 highlight 第 ${index + 1} 段非法（fromHeightM ${String(layer.fromHeightM)} / toHeightM ${String(layer.toHeightM)}，须 from < to 的有限数）`,
      );
    }
  }

  // 层序：锚可用则自下而上（气压降序/高度升序——切变矢量的方向语义依赖层序）；锚全缺保输入序
  const allPressure = samples.every((l) => l.pressure !== undefined && l.pressure !== null);
  const allHeight = samples.every((l) => l.height !== undefined && l.height !== null);
  const ordered = [...samples];
  ordered.sort((a, b) => {
    if (allPressure) return (b.pressure ?? 0) - (a.pressure ?? 0);
    if (allHeight) return (a.height ?? 0) - (b.height ?? 0);
    return 0;
  });

  // 端点：speed 非 null 且（direction 非 null 或 speed 0）才成点——speed 0 的点在原点
  // （静风锚：方向无意义但位置有意义）；其余缺测形态不出点
  const points = ordered
    .map((level, index) => {
      const speed = level.speed;
      const direction = level.direction;
      if (speed === undefined || speed === null) return null;
      // 静风端点恒在原点（方向即令在场也不掺几何）；index＝原始层下标（连线的相邻判据）
      if (speed === 0) return { level, index, u: 0, v: 0 };
      if (direction === undefined || direction === null) return null;
      const { u, v } = windComponentsOf(direction, speed);
      return { level, index, u, v };
    })
    .filter(
      (p): p is { level: WindProfileLevel; index: number; u: number; v: number } => p !== null,
    );

  ensureStyle();
  const T = LOCALE[options.locale ?? "zh"];
  const root = document.createElement("div");
  root.className = "mw-hodo";
  if (options.className !== undefined) root.classList.add(options.className);
  root.dataset.points = String(points.length);
  root.dataset.unit = unit;
  if (options.title !== undefined) {
    const title = document.createElement("p");
    title.className = "mw-hodo-title";
    title.textContent = options.title;
    root.append(title);
  }

  // 画布：正方形 u/v 面，原点居中
  const size = 320;
  const pad = 34;
  const cx = size / 2;
  const cy = size / 2;
  const svg = svgEl("svg", {
    viewBox: `0 0 ${size} ${size}`,
    width: `${size}`,
    height: `${size}`,
    role: "img",
    "aria-label": T.ariaLabel,
  });

  // 速度环（同心圆＋沿 +u 轴的刻度数）：半径按数据最大风速向上取整到环步长
  const ringStep = RING_STEP[unit];
  const maxSpeed = points.reduce((m, p) => Math.max(m, Math.hypot(p.u, p.v)), 0);
  const ringMax = Math.max(ringStep, Math.ceil(maxSpeed / ringStep) * ringStep);
  const rOf = (speed: number): number => (ringMax > 0 ? (speed / ringMax) * (size / 2 - pad) : 0);
  const xOf = (u: number): number => cx + (ringMax > 0 ? (u / ringMax) * (size / 2 - pad) : 0);
  const yOf = (v: number): number => cy - (ringMax > 0 ? (v / ringMax) * (size / 2 - pad) : 0);
  for (let s = ringStep; s <= ringMax + 1e-9; s += ringStep) {
    const r = rOf(s).toFixed(1);
    svg.append(svgEl("circle", { cx: `${cx}`, cy: `${cy}`, r, class: "mw-hodo-grid" }));
    const label = svgEl("text", {
      x: `${cx + rOf(s) + 2}`,
      y: `${cy - 3}`,
      class: "mw-hodo-ringtext",
    });
    label.textContent = `${s}`;
    svg.append(label);
  }
  // u/v 轴（过原点十字）
  svg.append(
    svgEl("line", {
      x1: `${pad / 2}`,
      y1: `${cy}`,
      x2: `${size - pad / 2}`,
      y2: `${cy}`,
      class: "mw-hodo-axis",
    }),
    svgEl("line", {
      x1: `${cx}`,
      y1: `${pad / 2}`,
      x2: `${cx}`,
      y2: `${size - pad / 2}`,
      class: "mw-hodo-axis",
    }),
  );
  for (const [word, x, y, anchor] of [
    ["u", `${size - pad / 2 + 10}`, `${cy + 3}`, "middle"],
    ["v", `${cx + 10}`, `${pad / 2 - 6}`, "middle"],
  ] as const) {
    const label = svgEl("text", { x, y, "text-anchor": anchor, class: "mw-hodo-ringtext" });
    label.textContent = word;
    svg.append(label);
  }
  // 单位注记右对齐收在 viewBox 内（P2-4 修复：原 start 锚在 x=313 起、"(m/s)" 约 26px
  // 宽会越出 viewBox 320 被裁切）
  const unitLabel = svgEl("text", {
    x: `${size - 3}`,
    y: `${cy + 15}`,
    "text-anchor": "end",
    class: "mw-hodo-ringtext",
  });
  unitLabel.textContent = `(${unit})`;
  svg.append(unitLabel);

  // 端点连线（切变矢量）：**原始层下标相邻**才连线——跨缺测层的两点虽在成点序列里
  // 相邻，但层间隔≠1（中间隔着缺测层），连起来线长≠任何层间的切变大小（本组件的
  // 核心语义），不连；段属于「低端层」落区的高亮区间则强调色
  const inLayer = (level: WindProfileLevel): boolean => {
    const h = level.height;
    if (h === undefined || h === null) return false;
    return highlight.some((layer) => h >= layer.fromHeightM && h < layer.toHeightM);
  };
  const segments: Array<{ x1: number; y1: number; x2: number; y2: number; low: boolean }> = [];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (a === undefined || b === undefined) continue;
    if (b.index !== a.index + 1) continue; // 跨缺测层：层下标不相邻不连线（切变无从算）
    segments.push({
      x1: xOf(a.u),
      y1: yOf(a.v),
      x2: xOf(b.u),
      y2: yOf(b.v),
      low: inLayer(a.level),
    });
  }
  for (const seg of segments) {
    svg.append(
      svgEl("line", {
        x1: seg.x1.toFixed(1),
        y1: seg.y1.toFixed(1),
        x2: seg.x2.toFixed(1),
        y2: seg.y2.toFixed(1),
        class: `mw-hodo-seg ${seg.low ? "mw-hodo-low" : "mw-hodo-mid"}`,
      }),
    );
  }
  for (const p of points) {
    svg.append(
      svgEl("circle", {
        cx: xOf(p.u).toFixed(1),
        cy: yOf(p.v).toFixed(1),
        r: "2.8",
        class: `mw-hodo-mark ${inLayer(p.level) ? "mw-hodo-low" : ""}`.trim(),
      }),
    );
  }
  root.append(svg);

  // 图例行：高亮段标签＋切变读法提示
  const note = document.createElement("p");
  note.className = "mw-hodo-note";
  const labels = highlight.map(
    (layer) => layer.label ?? T.highlightLabel(layer.fromHeightM, layer.toHeightM),
  );
  const chips = document.createElement("span");
  const chip = document.createElement("i");
  chip.className = "mw-hodo-chip mw-hodo-low";
  chips.append(chip, ` ${labels.join("、")}　`);
  const hint = document.createElement("span");
  hint.textContent = T.shearHint;
  note.append(chips, hint);
  root.append(note);
  return root;
}
