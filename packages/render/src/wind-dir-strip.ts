/**
 * @metweave/render — 风向时序条（W-14）：逐时风向 → 色环映射色带。
 *
 * **接缝处理（本组件的核心难点与裁定）**：风向是循环量（0° ≡ 360°），北风两侧
 * （350° 与 10°）在物理上相邻；线性色带（如把 0–360 平铺进一条渐变）会在北向处
 * 从带尾色硬跳回带头色——图上「风向剧变」的假象。本组件用 **HSL 色相环直接当
 * 风向环**：色相角＝风向角（北 0°＝红、东 90°＝黄绿、南 180°＝青、西 270°＝紫），
 * 色相环天然首尾相接——350° 与 10° 同为红系相邻色，无缝可断。读法：色相转一圈
 * ＝风向转一圈，条上相邻格的色差＝真实的环流变化。
 *
 * 缺测/静风口径：direction null 且 speed 0 → 静风格（浅灰底＋中点小圆——有观测、
 * 无方向）；direction null 而非静风 → 缺测格（斜纹底——与任何着色格一眼可分）。
 * 越界（<0 或 >360）显式抛错——循环量的归一是供数方的事，组件不静默修正
 * （与 windBarbOf 的方向值域同一口径）；360 ≡ 0 合法收下。
 */
import type { WindHourlySample, WindHourlySeries } from "./wind-profile";

/** windDirStrip 的选项。 */
export interface WindDirStripOptions {
  /** 文案语言（缺省 zh） */
  readonly locale?: "zh" | "en";
  /** 标题行（缺席不画） */
  readonly title?: string;
  /** 叠加到根元素的类名（宿主样式钩子） */
  readonly className?: string;
}

/** 风向时序条的文案表（zh / en；同本包纪律）。 */
interface WindDirStripLocale {
  readonly ariaLabel: string;
  readonly calm: string;
  readonly missing: string;
  readonly note: string;
  /** 八方位名（N/NE/E/SE/S/SW/W/NW 的显示文案） */
  readonly compass: readonly string[];
}

const LOCALE: Record<"zh" | "en", WindDirStripLocale> = {
  zh: {
    ariaLabel: "风向时序条",
    calm: "静风",
    missing: "缺测",
    note: "色相＝风向（北 0°＝红，色环循环无缝）；色差＝环流变化",
    compass: ["北", "东北", "东", "东南", "南", "西南", "西", "西北"],
  },
  en: {
    ariaLabel: "Wind direction strip",
    calm: "Calm",
    missing: "Missing",
    note: "Hue = direction (N 0° = red, circular and seamless); hue change = circulation change",
    compass: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"],
  },
};

const STYLE_ID = "metweave-wind-dir-strip-style";

const WDS_CSS = `
.mw-wds { display: inline-block; padding: 8px 10px; border: 1px solid #d8dee6; border-radius: 8px; background: #fbfcfd; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2a37; }
.mw-wds-title { font-size: 13px; font-weight: 600; color: #33506b; margin: 0 0 4px; }
.mw-wds-strip { display: flex; width: 640px; height: 26px; border-radius: 4px; overflow: hidden; }
.mw-wds-cell { flex: 1 1 0; min-width: 0; }
.mw-wds-cell[data-dir] { box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.35); }
.mw-wds-cell.mw-wds-calm { background: #f2f5f8; position: relative; }
.mw-wds-cell.mw-wds-calm::after { content: ""; position: absolute; left: 50%; top: 50%; width: 5px; height: 5px; margin: -2.5px 0 0 -2.5px; border-radius: 50%; background: #8a94a3; }
.mw-wds-cell.mw-wds-miss { background: repeating-linear-gradient(45deg, #eef1f5 0 3px, #d7dee6 3px 5px); }
.mw-wds-labels { position: relative; width: 640px; height: 16px; margin-top: 2px; font-size: 9.5px; line-height: 16px; color: #6b7785; }
.mw-wds-label { position: absolute; top: 0; white-space: nowrap; transform: translateX(-50%); }
.mw-wds-legend { margin: 6px 0 0; font-size: 11px; color: #6b7785; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.mw-wds-chip { display: inline-block; width: 16px; height: 16px; border-radius: 3px; vertical-align: middle; }
.mw-wds-chip.mw-wds-chip-calm { background: #f2f5f8; border: 1px solid #c9d3dd; }
.mw-wds-chip.mw-wds-chip-miss { background: repeating-linear-gradient(45deg, #eef1f5 0 3px, #d7dee6 3px 5px); border: 1px solid #c9d3dd; }
.mw-wds-note { margin: 4px 0 0; font-size: 10.5px; color: #8a94a3; }
`;

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID) !== null) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = WDS_CSS;
  document.head.append(style);
}

/** 风向 → HSL 色环：色相角＝风向角（循环量进循环色，350 与 10 天然相邻）。 */
function hueOf(direction: number): string {
  const hue = ((direction % 360) + 360) % 360;
  return `hsl(${Math.round(hue * 10) / 10}, 68%, 55%)`;
}

/** 逐时样本校验：时刻非空；direction 值域 [0,360]（越界显式抛错，不静默归一）。 */
function assertSample(sample: WindHourlySample, index: number): void {
  const at = `第 ${index + 1} 时次`;
  if (typeof sample.time !== "string" || sample.time === "") {
    throw new Error(`windDirStrip ${at}缺时刻标签（time 非空字符串）`);
  }
  const direction = sample.direction;
  if (
    direction !== undefined &&
    direction !== null &&
    !(Number.isFinite(direction) && direction >= 0 && direction <= 360)
  ) {
    throw new Error(
      `windDirStrip ${at}的 direction 非法（${String(direction)}，须为 0–360 的有限数：北 0／东 90／南 180／西 270；循环量的归一由供数方负责）`,
    );
  }
  const speed = sample.speed;
  if (speed !== undefined && speed !== null && !(Number.isFinite(speed) && speed >= 0)) {
    throw new Error(
      `windDirStrip ${at}的 speed 非法（${String(speed)}，须为 ≥0 的有限数或缺测 null）`,
    );
  }
}

/**
 * 画一条风向时序条（W-14）：逐时风向 → 色环映射色格带（色相＝风向角，循环无缝）。
 *
 * @param series - 逐时观测序列（direction null＋speed 0＝静风格；direction null＝缺测格）
 * @param options - 见 WindDirStripOptions。
 */
export function windDirStrip(
  series: WindHourlySeries,
  options: WindDirStripOptions = {},
): HTMLElement {
  for (const key of Object.keys(options)) {
    if (key !== "locale" && key !== "title" && key !== "className") {
      throw new Error(
        `windDirStrip 收到未知选项 "${key}"（可用项：locale、title、className）——拼错的选项不会生效`,
      );
    }
  }
  if (options.locale !== undefined && options.locale !== "zh" && options.locale !== "en") {
    const badLocale: string = options.locale; // never 收窄后的宽化中转（同 card.ts）
    throw new Error(`windDirStrip 的 locale 选项值 "${badLocale}" 不受支持（可用："zh" | "en"）`);
  }
  if (series.length < 2) {
    throw new Error(`windDirStrip 时次数不足（${series.length} < 2）——时序至少两个时次起画`);
  }
  for (const [index, sample] of series.entries()) assertSample(sample, index);

  ensureStyle();
  const T = LOCALE[options.locale ?? "zh"];
  const root = document.createElement("div");
  root.className = "mw-wds";
  if (options.className !== undefined) root.classList.add(options.className);
  root.dataset.samples = String(series.length);
  if (options.title !== undefined) {
    const title = document.createElement("p");
    title.className = "mw-wds-title";
    title.textContent = options.title;
    root.append(title);
  }

  // 色带：逐时次一色格（方向→色相；静风/缺测各有专属形态）
  const strip = document.createElement("div");
  strip.className = "mw-wds-strip";
  strip.setAttribute("role", "img");
  strip.setAttribute("aria-label", T.ariaLabel);
  for (const sample of series) {
    const cell = document.createElement("span");
    cell.className = "mw-wds-cell";
    const direction = sample.direction;
    if (direction !== undefined && direction !== null) {
      cell.dataset.dir = `${direction}`;
      cell.style.background = hueOf(direction);
    } else if ((sample.speed ?? 1) === 0) {
      cell.classList.add("mw-wds-calm");
      cell.dataset.state = "calm";
    } else {
      cell.classList.add("mw-wds-miss");
      cell.dataset.state = "missing";
    }
    strip.append(cell);
  }
  root.append(strip);

  // 时刻标签：每 k 时次一枚（与 gustBand 同款最疏整间隔）
  const n = series.length;
  const k = Math.max(1, Math.ceil(n / 8));
  const labels = document.createElement("div");
  labels.className = "mw-wds-labels";
  series.forEach((sample, i) => {
    if (i % k !== 0 && i !== n - 1) return;
    const label = document.createElement("span");
    label.className = "mw-wds-label";
    label.textContent = sample.time;
    label.style.left = `${(n > 1 ? i / (n - 1) : 0) * 100}%`;
    if (i === 0) label.style.transform = "none";
    if (i === n - 1) label.style.transform = "translateX(-100%)";
    labels.append(label);
  });
  root.append(labels);

  // 图例：八方位色环（罗盘序）＋静风/缺测形态
  const legend = document.createElement("p");
  legend.className = "mw-wds-legend";
  T.compass.forEach((word, index) => {
    const chip = document.createElement("i");
    chip.className = "mw-wds-chip";
    chip.style.background = hueOf(index * 45);
    const span = document.createElement("span");
    span.append(chip, ` ${word}`);
    legend.append(span);
  });
  const calmChip = document.createElement("i");
  calmChip.className = "mw-wds-chip mw-wds-chip-calm";
  const calm = document.createElement("span");
  calm.append(calmChip, ` ${T.calm}`);
  const missChip = document.createElement("i");
  missChip.className = "mw-wds-chip mw-wds-chip-miss";
  const miss = document.createElement("span");
  miss.append(missChip, ` ${T.missing}`);
  legend.append(calm, miss);
  root.append(legend);

  const note = document.createElement("p");
  note.className = "mw-wds-note";
  note.textContent = T.note;
  root.append(note);
  return root;
}
