/**
 * @metweave/render — 风羽图例组件（v0.3.2 T6）：两套填图口径的刻度 + 单位切换。
 *
 * **口径数字不在本组件里**（刻意的设计）：旗/长划/短划各代表多少风速，由调用方从
 * `@metweave/grid` 的 `WIND_BARB_SCALES` 取得后经 `units` 传入——render 包不依赖 grid
 * （也不该依赖：渲染组件不背气象口径），而口径又只能有一份真源。于是「单一事实来源 +
 * 零依赖」两件事在这里同时成立：数字从内核流向组件，组件只负责画得可读。
 *
 * 图形是**示意**而非精确填图 glyph：本组件不引入 `@metweave/leaflet` 的几何常量，三枚
 * 小图只表达「旗是三角、长划比短划长」（读者要靠的是旁边的数字与单位，不是像素级比对）。
 * 真实图面上的杆形由 leaflet 的 `windBarbPath` 生成，两者形态同构、职责不同。
 *
 * 单位切换：点击口径按钮即重绘本组件刻度并回调 `onUnitChange(id)`——地图上的杆层是
 * 另一个对象，宿主要在回调里把新口径传回 `addWindBarbLayer`，两处才能一起变。
 */
/** 一套填图口径（数字由调用方从 `@metweave/grid` 的 `WIND_BARB_SCALES` 取，组件不存口径）。 */
export interface WindLegendUnit {
  /** 口径标识（如 "m/s" / "kt"——同时用作 `aria-pressed` 切换的键） */
  readonly id: string;
  /** 显示名（按钮文案，如 "m/s" / "kt"） */
  readonly label: string;
  /** 三角旗代表的风速（同 id 量纲） */
  readonly pennant: number;
  /** 长划代表的风速 */
  readonly long: number;
  /** 短划代表的风速 */
  readonly short: number;
}

/** 风羽图例选项。 */
export interface RenderWindLegendOptions {
  /** 口径表（必填，≥1 套；数字真源在 @metweave/grid） */
  readonly units: readonly WindLegendUnit[];
  /** 初始口径 id（缺省取 units[0]） */
  readonly unit?: string;
  /** 文案语言（缺省 zh） */
  readonly locale?: "zh" | "en";
  /** 切换回调：宿主据此把新口径传回 addWindBarbLayer，地图杆层才会跟着变 */
  readonly onUnitChange?: (id: string) => void;
  /** 叠加到根元素的类名 */
  readonly className?: string;
}

/** 风羽图例的文案表（zh / en；同本包纪律：新增语言＝新增一列。不入 terms 册的抽取面
 * 缺口与理由见 wind-chip.ts 文件头同一段记档）。 */
interface WindLegendLocale {
  readonly title: string;
  readonly pennant: string;
  readonly long: string;
  readonly short: string;
  readonly note: string;
  readonly unitGroup: string;
}

const LOCALE: Record<"zh" | "en", WindLegendLocale> = {
  zh: {
    title: "风羽图例",
    pennant: "三角旗",
    long: "长划",
    short: "短划",
    note: "kt＝国际航空惯例；m/s＝中国地面图惯例。两套刻度不通用，同一根杆在两种口径下形态不同。",
    unitGroup: "切换填图口径",
  },
  en: {
    title: "Wind barb legend",
    pennant: "Pennant",
    long: "Full barb",
    short: "Half barb",
    note: "kt = international aviation convention; m/s = Chinese surface-chart convention. The two scales are not interchangeable.",
    unitGroup: "Switch barb scale",
  },
};

const STYLE_ID = "metweave-wind-legend-style";
const SVG_NS = "http://www.w3.org/2000/svg";

const WIND_LEGEND_CSS = `
.mw-wind-legend { display: inline-block; padding: 10px 14px; border: 1px solid #d8dee6; border-radius: 8px; background: #fbfcfd; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2a37; }
.mw-wind-legend-head { display: flex; align-items: center; gap: 10px; justify-content: space-between; }
.mw-wind-legend-title { font-size: 13px; font-weight: 600; color: #33506b; }
.mw-wind-legend-units { display: flex; gap: 4px; }
.mw-wind-legend-units button { font: inherit; font-size: 12px; padding: 2px 8px; border: 1px solid #c3ccd8; border-radius: 999px; background: #fff; color: #3b4757; cursor: pointer; }
.mw-wind-legend-units button[aria-pressed="true"] { background: #33506b; border-color: #33506b; color: #fff; }
.mw-wind-legend-items { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 4px; }
.mw-wind-legend-items li { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #3b4757; }
.mw-wind-legend-items b { font-variant-numeric: tabular-nums; color: #1f2a37; }
.mw-wind-legend-note { margin: 8px 0 0; max-width: 320px; font-size: 11px; line-height: 1.5; color: #6b7785; }
.mw-wind-legend-glyph { width: 22px; height: 22px; flex: 0 0 auto; }
`;

/** 样式只注入一次（同 wind-chip.ts：本组件需要 DOM，不是 SSR 保护）。 */
function ensureStyle(): void {
  if (document.getElementById(STYLE_ID) !== null) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = WIND_LEGEND_CSS;
  document.head.append(style);
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Readonly<Record<string, string>>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
}

/**
 * 一枚示意 glyph：竖杆 + （旗／长划／短划）。
 * 几何是本组件自绘的**示意**比例（22×22 盒），不复刻 leaflet 的精确填图象限。
 *
 * 用 `<line>` / `<polygon>` 而不用 `<path d="M… L…">`：一是语义更准（三个元素本就是独立
 * 图元），二是 path 的坐标里会出现「字母 L＋个位数字」的片段，命中本仓泄露扫描的编号类
 * 模式（源码与构建产物都要逐个加豁免）——不划算，换图元即根治。
 */
function glyphOf(kind: "pennant" | "long" | "short"): SVGSVGElement {
  const svg = svgEl("svg", {
    class: "mw-wind-legend-glyph",
    viewBox: "0 0 22 22",
    "aria-hidden": "true",
  });
  svg.append(
    svgEl("line", {
      x1: "11",
      y1: "20",
      x2: "11",
      y2: "3",
      stroke: "#2c3e50",
      "stroke-width": "1.4",
      "stroke-linecap": "round",
    }),
  );
  if (kind === "pennant") {
    svg.append(
      svgEl("polygon", {
        points: "11,3 11,9 4,6",
        fill: "#2c3e50",
        stroke: "#2c3e50",
        "stroke-width": "1",
      }),
    );
  } else {
    const dy = kind === "long" ? 5 : 3;
    const dx = kind === "long" ? -6 : -3.5;
    svg.append(
      svgEl("line", {
        x1: "11",
        y1: "3",
        x2: String(11 + dx),
        y2: String(3 + dy),
        stroke: "#2c3e50",
        "stroke-width": "1.4",
        "stroke-linecap": "round",
      }),
    );
  }
  return svg;
}

/**
 * Render the wind-barb legend: three scale marks (pennant / full / half) plus a unit
 * switcher. 渲染风羽图例：三档刻度 + 口径切换（数字由调用方传入，组件不含口径常量）。
 *
 * @param options - 见 RenderWindLegendOptions。`units` 必填（口径真源在 @metweave/grid）。
 */
export function renderWindLegend(options: RenderWindLegendOptions): HTMLElement {
  for (const key of Object.keys(options)) {
    if (
      key !== "units" &&
      key !== "unit" &&
      key !== "locale" &&
      key !== "onUnitChange" &&
      key !== "className"
    ) {
      throw new Error(
        `renderWindLegend 收到未知选项 "${key}"（可用项：units、unit、locale、onUnitChange、className）——拼错的选项不会生效`,
      );
    }
  }
  if (options.locale !== undefined && LOCALE[options.locale] === undefined) {
    throw new Error(
      `renderWindLegend 的 locale 选项值 "${options.locale}" 不受支持（可用："zh" | "en"）`,
    );
  }
  const units = options.units;
  if (units.length === 0) {
    throw new Error(
      "renderWindLegend 的 units 为空——至少要一套填图口径（数字请取自 @metweave/grid 的 WIND_BARB_SCALES）",
    );
  }
  for (const [index, entry] of units.entries()) {
    if (entry.id === "" || entry.label === "") {
      throw new Error(`renderWindLegend 的 units 第 ${index + 1} 项缺 id/label`);
    }
    for (const field of ["pennant", "long", "short"] as const) {
      if (!Number.isFinite(entry[field]) || entry[field] <= 0) {
        throw new Error(
          `renderWindLegend 的 units[${index}].${field} 非法（${String(entry[field])}，须为正有限数）`,
        );
      }
    }
    // 位权：短划 < 长划 < 旗（反着写＝图例在教错误的读法，比不画更糟）
    if (!(entry.short < entry.long && entry.long < entry.pennant)) {
      throw new Error(
        `renderWindLegend 的 units[${index}] 位权反了（short ${entry.short} / long ${entry.long} / pennant ${entry.pennant}）——` +
          "须满足 短划 < 长划 < 旗",
      );
    }
  }
  const ids = new Set(units.map((u) => u.id));
  if (ids.size !== units.length) {
    // 重复 id 会让切换按钮的 aria-pressed 互相覆盖（Map 后写覆盖前写），两个按钮的按下态都错
    throw new Error(`renderWindLegend 的 units 有重复 id（${units.map((u) => u.id).join("、")}）`);
  }
  const initialId = options.unit ?? units[0]?.id ?? "";
  const initial = units.find((u) => u.id === initialId);
  if (initial === undefined) {
    throw new Error(
      `renderWindLegend 的 unit 选项值 "${initialId}" 不在 units 里（可用：${units.map((u) => u.id).join("、")}）`,
    );
  }
  ensureStyle();
  const T = LOCALE[options.locale ?? "zh"];
  const root = el("div", "mw-wind-legend");
  if (options.className !== undefined) root.classList.add(options.className);

  const head = el("div", "mw-wind-legend-head");
  head.append(el("span", "mw-wind-legend-title", T.title));
  const switcher = el("div", "mw-wind-legend-units");
  switcher.setAttribute("role", "group");
  switcher.setAttribute("aria-label", T.unitGroup);
  head.append(switcher);
  root.append(head);

  const items = el("ul", "mw-wind-legend-items");
  root.append(items);
  root.append(el("p", "mw-wind-legend-note", T.note));

  let active: WindLegendUnit = initial;
  /** 口径 id → 按钮（一次建好、切换只改 aria-pressed，不重建节点） */
  const buttonsById = new Map<string, HTMLButtonElement>();
  const paintTicks = (): void => {
    items.replaceChildren();
    const marks: Array<["pennant" | "long" | "short", string, number]> = [
      ["pennant", T.pennant, active.pennant],
      ["long", T.long, active.long],
      ["short", T.short, active.short],
    ];
    for (const [kind, label, value] of marks) {
      const li = el("li");
      li.append(
        glyphOf(kind),
        el("span", undefined, `${label} `),
        el("b", undefined, String(value)),
      );
      li.append(el("span", undefined, ` ${active.label}`));
      items.append(li);
    }
  };
  const paintButtons = (): void => {
    // 只更新 aria-pressed，不重建按钮——重建会丢键盘焦点（切换口径后继续 Tab 的姿势断裂）
    for (const [id, button] of buttonsById) {
      button.setAttribute("aria-pressed", id === active.id ? "true" : "false");
    }
  };
  // 按钮一次建好（顺序＝units 顺序），切换只改状态
  for (const entry of units) {
    const button = el("button", undefined, entry.label);
    button.type = "button";
    button.addEventListener("click", () => {
      if (active.id === entry.id) return;
      active = entry;
      paintButtons();
      paintTicks();
      options.onUnitChange?.(entry.id);
    });
    buttonsById.set(entry.id, button);
    switcher.append(button);
  }
  paintButtons();
  paintTicks();
  return root;
}
