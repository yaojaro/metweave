/**
 * @metweave/render — 风向频率图（W-16）：逐时风向观测 → 单环（极坐标）或条形（直角
 * 坐标）双形态的方位频率分布。
 *
 * **与 windRose 同输入同剔除同账**：输入样例结构、静风/缺向/缺速的剔除口径、扇区
 * 归桶（中心对齐＋边界归最近）与缺省量纲（kt）全部经同一份统计单源（windRose 的
 * `windRoseAccount`）——同输入下两组件的披露行数字**逐字相等**（由测试断言锁死，
 * 不靠快照眼验）。本组件把「按档分色堆叠」换成「只看方位占比」：环形态＝每扇区一
 * 瓣（半径＝占入扇区样本百分比），条形形态＝自北顺时针一杆一扇区的直角条形图——
 * 同一份账目的两种读法。
 *
 * 形态语义：`form:"ring"`（缺省）与 windRose 同一极坐标几何（去档色）；`form:"bars"`
 * 把方位拉直成横轴（16 扇区罗盘点一杆一名），条高即占比——方位对比在直角坐标下
 * 更好数（极坐标的面积错觉在这里消失）。
 *
 * 边界行为与 windRose 同一套：缺测整样本不入扇区（披露行承载）、空输入出空态不抛
 * 错、direction 越界显式抛错（照 windDirStrip 先例）、unit 是量纲声明不是换算开关。
 */
import type { WindDisplayUnitInput } from "./wind-profile";
import { normalizeWindDisplayUnit } from "./wind-profile";
import type { WindRoseSample } from "./wind-rose-sample";
import { windRoseAccount } from "./wind-rose-account";

/** windDirFrequency 的选项。 */
export interface WindDirFrequencyOptions {
  /** 形态（缺省 `"ring"` 单环；`"bars"` 条形图） */
  readonly form?: "ring" | "bars";
  /** 扇区数（缺省 16；正整数，与 windRose 同口径） */
  readonly sectors?: number;
  /** 风速量纲声明（缺省 `"kt"`——与 windRose 同缺省；只用于静风阈选档，本组件不换算） */
  readonly unit?: WindDisplayUnitInput;
  /** 静风阈（同 unit 量纲，缺省 kt 1／m/s 0.5——与 windRose 同缺省，账目口径一致的前提） */
  readonly calmThreshold?: number;
  /** 文案语言（缺省 zh） */
  readonly locale?: "zh" | "en";
  /** 标题行（缺席不画） */
  readonly title?: string;
  /** 叠加到根元素的类名（宿主样式钩子） */
  readonly className?: string;
}

/** 风向频率图的文案表（zh / en；同本包纪律）。 */
interface WindDirFrequencyLocale {
  readonly ariaRing: string;
  readonly ariaBars: string;
  readonly disclosure: (a: {
    samples: number;
    inSector: number;
    calm: number;
    calmPct: string;
    missingDirection: number;
    missingSpeed: number;
  }) => string;
  readonly noteRing: string;
  readonly noteBars: string;
}

const LOCALE: Record<"zh" | "en", WindDirFrequencyLocale> = {
  zh: {
    ariaRing: "风向频率环",
    ariaBars: "风向频率条形图",
    disclosure: (a) =>
      `样本 ${a.samples} · 入扇区 ${a.inSector} · 静风 ${a.calm}（${a.calmPct}%）· 缺向 ${a.missingDirection} · 缺速 ${a.missingSpeed}`,
    noteRing: "瓣半径＝占入扇区样本百分比（扇区 0＝正北、顺时针增）",
    noteBars: "条高＝占入扇区样本百分比（横轴自北顺时针）",
  },
  en: {
    ariaRing: "Direction frequency ring",
    ariaBars: "Direction frequency bars",
    disclosure: (a) =>
      `Samples ${a.samples} · In sectors ${a.inSector} · Calm ${a.calm} (${a.calmPct}%) · Dir missing ${a.missingDirection} · Speed missing ${a.missingSpeed}`,
    noteRing: "Radius = share of in-sector samples (sector 0 = north, clockwise)",
    noteBars: "Bar height = share of in-sector samples (x axis clockwise from north)",
  },
};

const STYLE_ID = "metweave-wind-dir-frequency-style";
const SVG_NS = "http://www.w3.org/2000/svg";

const WDF_CSS = `
.mw-wdf { display: inline-block; padding: 8px 10px; border: 1px solid #d8dee6; border-radius: 8px; background: #fbfcfd; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2a37; }
.mw-wdf-title { font-size: 13px; font-weight: 600; color: #33506b; margin: 0 0 4px; }
.mw-wdf svg { display: block; }
.mw-wdf .mw-wdf-ring { stroke: #e3e8ee; stroke-width: 1; fill: none; }
.mw-wdf .mw-wdf-ringtext { font: 9.5px system-ui, sans-serif; fill: #8a94a3; }
.mw-wdf .mw-wdf-sectorlabel { font: 10px system-ui, sans-serif; fill: #6b7785; }
.mw-wdf .mw-wdf-petal { fill: #2c5f8a; stroke: #fff; stroke-width: 0.8; }
.mw-wdf .mw-wdf-bar { fill: #2c5f8a; }
.mw-wdf .mw-wdf-axis { stroke: #b9c4cf; stroke-width: 1; }
.mw-wdf .mw-wdf-grid { stroke: #e3e8ee; stroke-width: 1; }
.mw-wdf .mw-wdf-ticktext { font: 10px system-ui, sans-serif; fill: #6b7785; }
.mw-wdf .mw-wdf-barvalue { font: 9.5px system-ui, sans-serif; fill: #33506b; }
.mw-wdf-note { margin: 4px 0 0; font-size: 10.5px; color: #8a94a3; }
`;

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID) !== null) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = WDF_CSS;
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

/** 刻度数字排版：整数原样、非整数一位小数。 */
const fmtTick = (v: number): string =>
  Number.isInteger(v) ? `${v}` : `${Math.round(v * 10) / 10}`;

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

/** 满圈自适应（与 windRose 同一取整族——共尺口径一致）。 */
function niceRim(maxShare: number): number {
  if (!(maxShare > 0)) return 50;
  const step = maxShare <= 8 ? 2 : maxShare <= 20 ? 5 : maxShare <= 40 ? 10 : 25;
  return Math.ceil(maxShare / step) * step;
}

/**
 * 画一张风向频率图（W-16）：与 windRose 同输入同剔除同账的方位频率分布——单环或
 * 条形双形态。
 *
 * @param samples - 风观测样本（与 windRose 同契约）
 * @param options - 见 WindDirFrequencyOptions。
 */
export function windDirFrequency(
  samples: readonly WindRoseSample[],
  options: WindDirFrequencyOptions = {},
): HTMLElement {
  for (const key of Object.keys(options)) {
    if (
      key !== "form" &&
      key !== "sectors" &&
      key !== "unit" &&
      key !== "calmThreshold" &&
      key !== "locale" &&
      key !== "title" &&
      key !== "className"
    ) {
      throw new Error(
        `windDirFrequency 收到未知选项 "${key}"（可用项：form、sectors、unit、calmThreshold、locale、title、className）——拼错的选项不会生效`,
      );
    }
  }
  const form = options.form ?? "ring";
  if (form !== "ring" && form !== "bars") {
    const badForm: string = form; // never 收窄后的宽化中转（同 card.ts）
    throw new Error(
      `windDirFrequency 的 form 选项值 "${badForm}" 不受支持（可用："ring" | "bars"）`,
    );
  }
  if (options.locale !== undefined && options.locale !== "zh" && options.locale !== "en") {
    const badLocale: string = options.locale;
    throw new Error(
      `windDirFrequency 的 locale 选项值 "${badLocale}" 不受支持（可用："zh" | "en"）`,
    );
  }
  // 缺省口径 kt——与 windRose 逐字同档（账目一致性前提：缺省参数也须一致）
  const unit =
    options.unit === undefined ? "kt" : normalizeWindDisplayUnit(options.unit, "windDirFrequency");
  const sectors = options.sectors ?? 16;
  if (!Number.isInteger(sectors) || sectors < 4 || sectors > 360) {
    throw new Error(`windDirFrequency 的 sectors 非法（${String(sectors)}，须为 4–360 的整数）`);
  }
  // 档界与静风阈同 windRose 缺省（本组件不分档，档界只进账目做静风判与剔除口径；
  // kt [2,4,6,8,10] 系整 2 kt 档缺省、m/s 对齐 10m 风档案口径——出处见 windRose 文件头）
  const edges = unit === "kt" ? [2, 4, 6, 8, 10] : [3, 5, 10, 15, 20, 30];
  const calmThreshold = options.calmThreshold ?? (unit === "kt" ? 1 : 0.5);
  if (!Number.isFinite(calmThreshold) || calmThreshold < 0) {
    throw new Error(
      `windDirFrequency 的 calmThreshold 非法（${String(options.calmThreshold)}，须 ≥0 的有限数，同 unit 量纲）`,
    );
  }

  // 统计单源：与 windRose 同一份账（披露行逐字相等的机械保证）
  const account = windRoseAccount(samples, {
    sectors,
    edges,
    calmThreshold,
    caller: "windDirFrequency",
  });
  const shares = account.matrix.map((row) =>
    account.inSector > 0 ? (row.reduce((a, b) => a + b, 0) / account.inSector) * 100 : 0,
  );
  const rim = niceRim(Math.max(...shares, 0));

  ensureStyle();
  const T = LOCALE[options.locale ?? "zh"];
  const root = document.createElement("div");
  root.className = "mw-wdf";
  if (options.className !== undefined) root.classList.add(options.className);
  // 机读账目：键与 windRose 逐字相同（两组件一致性断言的判面）
  root.dataset.samples = String(account.samples);
  root.dataset.inSector = String(account.inSector);
  root.dataset.calm = String(account.calm);
  root.dataset.missingDirection = String(account.missingDirection);
  root.dataset.missingSpeed = String(account.missingSpeed);
  root.dataset.form = form;
  root.dataset.unit = unit;
  root.dataset.sectors = String(sectors);
  root.dataset.rim = fmtTick(rim);
  if (options.title !== undefined) {
    const title = document.createElement("p");
    title.className = "mw-wdf-title";
    title.textContent = options.title;
    root.append(title);
  }

  const half = 180 / sectors;
  if (form === "ring") {
    // 单环：与 windRose 同一极坐标几何（去档色堆叠——每扇区一瓣单色）
    const size = 320;
    const cx = size / 2;
    const cy = size / 2;
    const R = size / 2 - 32;
    const svg = svgEl("svg", {
      viewBox: `0 0 ${size} ${size}`,
      width: `${size}`,
      height: `${size}`,
      role: "img",
      "aria-label": T.ariaRing,
    });
    for (const ring of [rim / 2, rim]) {
      svg.append(
        svgEl("circle", {
          cx: `${cx}`,
          cy: `${cy}`,
          r: (R * (Math.min(ring, rim) / rim)).toFixed(1),
          class: "mw-wdf-ring",
        }),
      );
      const label = svgEl("text", {
        x: `${cx + 3}`,
        y: (cy - R * (Math.min(ring, rim) / rim) - 2).toFixed(1),
        class: "mw-wdf-ringtext",
      });
      label.textContent = `${fmtTick(ring)}%`;
      svg.append(label);
    }
    shares.forEach((share, si) => {
      if (share <= 0) return;
      const center = si * (360 / sectors);
      const a0 = center - half;
      const a1 = center + half;
      const rad0 = ((a0 - 90) * Math.PI) / 180;
      const rad1 = ((a1 - 90) * Math.PI) / 180;
      const r = R * (Math.min(share, rim) / rim);
      const x0 = cx + r * Math.cos(rad0);
      const y0 = cy + r * Math.sin(rad0);
      const x1 = cx + r * Math.cos(rad1);
      const y1 = cy + r * Math.sin(rad1);
      const large = a1 - a0 > 180 ? 1 : 0;
      svg.append(
        svgEl("path", {
          d: `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r.toFixed(2)} ${r.toFixed(2)} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} L${cx} ${cy} Z`,
          class: "mw-wdf-petal",
        }),
      );
    });
    for (const [bearing, word] of [
      [0, "N"],
      [90, "E"],
      [180, "S"],
      [270, "W"],
    ] as const) {
      const label = svgEl("text", {
        x: (cx + (R + 12) * Math.sin((bearing * Math.PI) / 180)).toFixed(1),
        y: (cy - (R + 12) * Math.cos((bearing * Math.PI) / 180) + 3.5).toFixed(1),
        "text-anchor": "middle",
        class: "mw-wdf-sectorlabel",
      });
      label.textContent = word;
      svg.append(label);
    }
    if (sectors === 8 || sectors === 16) {
      const step = 360 / sectors;
      for (let si = 0; si < sectors; si++) {
        const bearing = si * step;
        if (bearing % 90 === 0) continue;
        const label = svgEl("text", {
          x: (cx + (R + 12) * Math.sin((bearing * Math.PI) / 180)).toFixed(1),
          y: (cy - (R + 12) * Math.cos((bearing * Math.PI) / 180) + 3).toFixed(1),
          "text-anchor": "middle",
          class: "mw-wdf-sectorlabel",
        });
        label.textContent = COMPASS_16[Math.round(bearing / 22.5)] ?? "";
        svg.append(label);
      }
    }
    root.append(svg);
  } else {
    // 条形：自北顺时针一杆一扇区，条高＝占比（直角坐标——方位对比更好数）
    const width = 640;
    const height = 210;
    const padLeft = 38;
    const padBottom = 30;
    const padTop = 16;
    const plotH = height - padTop - padBottom;
    const plotW = width - padLeft - 10;
    const svg = svgEl("svg", {
      viewBox: `0 0 ${width} ${height}`,
      width: `${width}`,
      height: `${height}`,
      role: "img",
      "aria-label": T.ariaBars,
    });
    const barW = plotW / sectors;
    const yOf = (share: number): number => padTop + plotH * (1 - Math.min(share, rim) / rim);
    // 横网格与 % 刻度（半圈与满圈两道——与环形态同刻度族）
    for (const tick of [rim / 2, rim]) {
      svg.append(
        svgEl("line", {
          x1: `${padLeft}`,
          y1: yOf(tick).toFixed(1),
          x2: `${width - 10}`,
          y2: yOf(tick).toFixed(1),
          class: "mw-wdf-grid",
        }),
      );
      const label = svgEl("text", {
        x: `${padLeft - 5}`,
        y: (yOf(tick) + 3.5).toFixed(1),
        "text-anchor": "end",
        class: "mw-wdf-ticktext",
      });
      label.textContent = `${fmtTick(tick)}%`;
      svg.append(label);
    }
    // 基线
    svg.append(
      svgEl("line", {
        x1: `${padLeft}`,
        y1: `${padTop + plotH}`,
        x2: `${width - 10}`,
        y2: `${padTop + plotH}`,
        class: "mw-wdf-axis",
      }),
    );
    shares.forEach((share, si) => {
      const x = padLeft + si * barW;
      const barWInner = Math.max(1, barW - 3);
      const barH = padTop + plotH - yOf(share);
      if (barH > 0.05) {
        svg.append(
          svgEl("rect", {
            x: (x + 1.5).toFixed(1),
            y: yOf(share).toFixed(1),
            width: barWInner.toFixed(1),
            height: barH.toFixed(1),
            class: "mw-wdf-bar",
          }),
        );
        // 条顶数值（16 扇区下 640px 仍有 ~37px 杆距，一位小数放得下）
        const value = svgEl("text", {
          x: (x + 1.5 + barWInner / 2).toFixed(1),
          y: (yOf(share) - 3).toFixed(1),
          "text-anchor": "middle",
          class: "mw-wdf-barvalue",
        });
        value.textContent = fmtTick(share);
        svg.append(value);
      }
      // 扇区名（4/8/16 扇区＝罗盘点名，其余标角度）
      const labelText =
        sectors === 4 || sectors === 8 || sectors === 16
          ? (COMPASS_16[Math.round((si * (360 / sectors)) / 22.5)] ?? "")
          : `${fmtTick(si * (360 / sectors))}°`;
      const label = svgEl("text", {
        x: (x + 1.5 + barWInner / 2).toFixed(1),
        y: `${padTop + plotH + 13}`,
        "text-anchor": "middle",
        class: "mw-wdf-sectorlabel",
      });
      label.textContent = labelText;
      svg.append(label);
    });
    root.append(svg);
  }

  const calmPct =
    account.samples > 0
      ? (Math.round((account.calm / account.samples) * 1000) / 10).toFixed(1)
      : "0.0";
  const note = document.createElement("p");
  note.className = "mw-wdf-note";
  note.textContent = `${T.disclosure({
    samples: account.samples,
    inSector: account.inSector,
    calm: account.calm,
    calmPct,
    missingDirection: account.missingDirection,
    missingSpeed: account.missingSpeed,
  })} ｜ ${form === "ring" ? T.noteRing : T.noteBars}`;
  root.append(note);
  return root;
}
