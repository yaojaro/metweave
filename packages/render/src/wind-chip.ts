/**
 * @metweave/render — 风数值牌：IR 风组 → 小型数值块（三行：风向／风速／阵风）。
 *
 * 与报文卡片里那一行风组的**分工**（v0.3.2 T4 立项时的裁点 P6）：卡片风组是「正文里
 * 的一行」，带悬停解码与 RAW 联动；本组件是「墙上的牌」——三行大字、无交互、可单独
 * 挂在仪表盘/看板/内容配图里。两者读同一份 IR，口径（静风/VRB/缺测的判定与文案）
 * 刻意保持一致，但**不做同一张卡上重复展示**的默认行为（渲染卡片不自动内嵌本组件）。
 *
 * 三态（验收要求的三个快照）：
 * - `value`：有风 → 三行（风向 °／风速＋单位／阵风；无阵风则两行）
 * - `calm`：静风（非 VRB、000°、0 风速＝00000）→ 单行「静风」
 * - `missing`：显式缺测（kind "missing"）或风组整组省略（undefined）→ 单行缺测文案
 *   两种缺测在 `data-state` 上区分（`missing` / `omitted`），文案同一条——契约上「没值」
 *   是一件事，机读侧仍可分辨。
 *
 * 单位口径：**跟随报文原单位**（kt / mps / kmh），不做换算。理由：报文单位就是业务
 * 单位，换算会让牌上的数字与 RAW 原文对不上（牌是给人核对的，不是给人换算的）；需要
 * 换成 m/s 或 kt 的场所（图面填图口径）由 `@metweave/leaflet` 的 `unit` 选项承担，
 * 那是地图层的事，不是牌的事。
 *
 * 双语文案集中在本文件的 LOCALE 表（同 card.ts 纪律：新增语言＝新增一列表）。本表
 * **不经 terms 册**：`scripts/terms.mjs` 的抽取面 v1 只覆盖 `render/card.ts#LOCALE`、
 * `leaflet#TIER_WORDS`、`core#EN_MESSAGES` 与 sources/parser 的 CJK 字面量——同包的
 * `taf-card.ts` 与本文件都在面外（v2 扩面时一并收编；此处如实记档，不假装已入册）。
 */
import type { MetarReport, SpeedUnit, WindGroup } from "@metweave/core";
import { unwrap } from "@metweave/core";

/** 风数值牌的文案表（zh / en 两列，键集必须一致）。 */
interface WindChipLocale {
  readonly label: {
    readonly direction: string;
    readonly speed: string;
    readonly gust: string;
  };
  readonly calm: string;
  readonly missing: string;
  readonly variable: string;
  readonly beyondAbove: string;
  readonly unit: Record<SpeedUnit, string>;
}

const LOCALE: Record<"zh" | "en", WindChipLocale> = {
  zh: {
    label: { direction: "风向", speed: "风速", gust: "阵风" },
    calm: "静风（00000）",
    missing: "风组缺测",
    variable: "不定",
    beyondAbove: "＞",
    // 单位只写符号：牌是紧凑件，「5 m/s 米/秒」既长又像重复（全称留给卡片的悬停解释）
    unit: { kt: "kt", mps: "m/s", kmh: "km/h" },
  },
  en: {
    label: { direction: "Direction", speed: "Speed", gust: "Gust" },
    calm: "Calm (00000)",
    missing: "Wind group missing",
    variable: "Variable",
    beyondAbove: ">",
    unit: { kt: "kt", mps: "m/s", kmh: "km/h" },
  },
};

/** 风数值牌选项。 */
export interface RenderWindChipOptions {
  /** 文案语言（缺省 zh） */
  readonly locale?: "zh" | "en";
  /** 叠加到根元素的类名（宿主样式钩子） */
  readonly className?: string;
}

const STYLE_ID = "metweave-wind-chip-style";

const WIND_CHIP_CSS = `
.mw-wind-chip { display: inline-block; padding: 10px 14px; border: 1px solid #d8dee6; border-radius: 8px; background: #fbfcfd; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2a37; }
.mw-wind-chip-rows { display: grid; grid-template-columns: auto auto; gap: 4px 12px; margin: 0; align-items: baseline; }
.mw-wind-chip-rows dt { font-size: 12px; color: #6b7785; margin: 0; }
.mw-wind-chip-rows dd { font-size: 16px; font-variant-numeric: tabular-nums; margin: 0; }
.mw-wind-chip-state { font-size: 15px; font-weight: 600; }
.mw-wind-chip[data-state="calm"] .mw-wind-chip-state { color: #33506b; }
.mw-wind-chip[data-state="missing"] .mw-wind-chip-state,
.mw-wind-chip[data-state="omitted"] .mw-wind-chip-state { color: #8a94a3; font-weight: 500; }
`;

/**
 * 样式只注入一次。**不是 SSR 保护**：本组件与 card.ts 一样直接调 document API，无 DOM
 * 环境会在下方 `el()` 处直接 ReferenceError（要 SSR 请自带 happy-dom 一类实现）。
 */
function ensureStyle(): void {
  if (document.getElementById(STYLE_ID) !== null) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = WIND_CHIP_CSS;
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

/**
 * Render a compact wind value chip from a parsed report: direction / speed / gust in
 * three labelled rows, with calm and missing states. 渲染风数值牌：从已解析报文取风组，
 * 输出可直接挂载的三行数值块（静风与缺测各有独立形态）。零框架依赖、样式随组件注入。
 *
 * @param report - 已解析的报文 IR。Parsed IR (MetarReport).
 * @param options - 见 RenderWindChipOptions。
 */
export function renderWindChip(
  report: MetarReport,
  options: RenderWindChipOptions = {},
): HTMLElement {
  for (const key of Object.keys(options)) {
    if (key !== "locale" && key !== "className") {
      throw new Error(
        `renderWindChip 收到未知选项 "${key}"（可用项：locale、className）——拼错的选项不会生效`,
      );
    }
  }
  if (options.locale !== undefined && LOCALE[options.locale] === undefined) {
    throw new Error(
      `renderWindChip 的 locale 选项值 "${options.locale}" 不受支持（可用："zh" | "en"）`,
    );
  }
  ensureStyle();
  const T = LOCALE[options.locale ?? "zh"];
  const root = el("div", "mw-wind-chip");
  if (options.className !== undefined) root.classList.add(options.className);

  const observed = report.wind;
  const wind = unwrap(observed);
  if (wind === undefined) {
    // 显式缺测（kind missing）与整组省略（undefined）机读可分辨、文案同一条
    root.dataset.state = observed === undefined ? "omitted" : "missing";
    root.append(el("span", "mw-wind-chip-state", T.missing));
    return root;
  }

  // 静风判定与 card.ts 逐字同源口径：非 VRB、风向 000°、风速 0（＝00000 组）
  const calm = !wind.variable && wind.direction === 0 && wind.speed.value === 0;
  if (calm) {
    root.dataset.state = "calm";
    // 静风仍可能带阵风（自动站 G 组）——与 card.ts 的 `${calm}${gust}` 同口径，不吞
    const gust =
      wind.gust === undefined
        ? ""
        : ` · ${T.label.gust} ${speedText(wind.gust.value, wind.gust.beyond === "above", wind.gust.unit, T)}`;
    root.append(el("span", "mw-wind-chip-state", `${T.calm}${gust}`));
    return root;
  }

  root.dataset.state = "value";
  const rows = el("dl", "mw-wind-chip-rows");
  const row = (label: string, value: string): void => {
    rows.append(el("dt", undefined, label), el("dd", undefined, value));
  };
  row(T.label.direction, directionText(wind, T));
  row(
    T.label.speed,
    speedText(wind.speed.value, wind.speed.beyond === "above", wind.speed.unit, T),
  );
  if (wind.gust !== undefined) {
    row(T.label.gust, speedText(wind.gust.value, wind.gust.beyond === "above", wind.gust.unit, T));
  }
  root.append(rows);
  return root;
}

/** 风向文本：VRB → 「不定」；越界判缺测（null）→ 破折号；否则度数。 */
function directionText(wind: WindGroup, T: WindChipLocale): string {
  if (wind.variable) return T.variable;
  if (wind.direction === null) return "—";
  return `${wind.direction}°`;
}

/** 风速/阵风文本：超上限前缀 ＋ 值 ＋ 单位（单位跟随报文，不换算）。 */
function speedText(
  value: number,
  beyondAbove: boolean,
  unit: SpeedUnit,
  T: WindChipLocale,
): string {
  return `${beyondAbove ? T.beyondAbove : ""}${value} ${T.unit[unit]}`;
}
