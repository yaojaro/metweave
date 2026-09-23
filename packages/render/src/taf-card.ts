/**
 * @metweave/render — TAF 预报卡片：TafReport IR → 自包含 DOM 组件（v0.2 渲染层②）。
 *
 * 结构：头行（站名 + TAF 徽章 + AMD/COR/NIL/CNL 标志）→ 元信息（有效期 + 时长 / 发布时刻）→
 * **时间线条**（有效期横条按分钟比例分段：BECMG 过渡渐变、TEMPO 间歇斜纹、PROB 概率浅叠、
 * FM 硬竖线、TX/TN 极值标记）→ **分段天气明细**（tafSegments 逐段「时间窗 + 类型徽 + 人话要素」，
 * 悬停=电码紧凑串——owner 9/23 指令：按拆分时间段给具体天气，专业/小白双受众）→ 气温组行 → 可选 RAW 对照。
 * 与 card.ts 同纪律：纯 DOM 构建（createElement/textContent，无 innerHTML 注入面）、
 * 样式随组件注入（STYLE_ID 单次）、双语文案集中一张 locale 表、宿主 className 可叠加。
 * 预报警示：档位/摘要是扫视辅助，不得用作运行判据（沿 METAR 卡口径）。
 */
import type {
  CloudCondition,
  TafChangeGroup,
  TafReport,
  TafTemperatureGroup,
  TrendElements,
  VisibilityGroup,
  WindGroup,
} from "@metweave/core";
import { tafSegments } from "@metweave/parser";
import type { TafExpandAt, TafResolvedConditions } from "@metweave/parser";
import {
  CAVOK_SHORT,
  CLOUD_GLOSS,
  WX_GLOSS,
  WIND_GLOSS,
  cloudCodeOf,
  ftToMeters,
  weatherCodeOf,
  weatherGloss,
} from "./gloss";

/** Options for renderTafCard: display locale, RAW view, host className. renderTafCard 的选项。 */
export interface RenderTafCardOptions {
  /** 显示语言，缺省中文 */
  locale?: "zh" | "en";
  /** 附带 RAW 对照行（原文保真） */
  raw?: boolean;
  /** 宿主附加类名 */
  className?: string;
}

const LOCALE = {
  zh: {
    badge: "TAF 预报",
    amended: "修订",
    corrected: "更正",
    nil: "缺报（NIL）",
    cancelled: "预报取消（CNL）",
    validity: "有效期",
    duration: (h: number): string => `${h} 小时`,
    issued: "发布",
    timeline: "时间线",
    change: "变化组",
    tempo: "间歇",
    becmg: "过渡",
    prob: (p: number): string => `概率 ${p}%`,
    fm: "自",
    temps: "气温极值",
    max: (c: number): string => `最高 ${c}°C`,
    min: (c: number): string => `最低 ${c}°C`,
    raw: "原文",
    noValidity: "无有效期（缺报）",
    warning: "预报值供扫视参考，不得用作运行判据",
    periods: "分段天气",
    kindBase: "基况",
    kindFm: "自此",
    kindBecmgDuring: "渐变中",
    kindBecmgAfter: "转变后",
    kindTempo: "间歇",
    probChip: (p: number): string => `概率 ${p}%`,
    uncertainNote: "转变时刻不确定",
    tempoNote: "短时发作，每次不足 1 小时",
    emptySegment: "（未编要素）",
    becomingLead: "转为：",
    nswText: "其间无重要天气（NSW）",
    sep: " ｜ ",
  },
  en: {
    badge: "TAF Forecast",
    amended: "Amended",
    corrected: "Corrected",
    nil: "No report (NIL)",
    cancelled: "Cancelled (CNL)",
    validity: "Validity",
    duration: (h: number): string => `${h} h`,
    issued: "Issued",
    timeline: "Timeline",
    change: "Change groups",
    tempo: "TEMPO",
    becmg: "BECMG",
    prob: (p: number): string => `PROB ${p}%`,
    fm: "FM",
    temps: "Temperature extremes",
    max: (c: number): string => `Max ${c}°C`,
    min: (c: number): string => `Min ${c}°C`,
    raw: "RAW",
    noValidity: "No validity (NIL)",
    warning: "Forecast values are for glance scanning only — not for operational decisions",
    periods: "By period",
    kindBase: "Base",
    kindFm: "From",
    kindBecmgDuring: "BECMG",
    kindBecmgAfter: "After",
    kindTempo: "TEMPO",
    probChip: (p: number): string => `PROB ${p}%`,
    uncertainNote: "change timing uncertain",
    tempoNote: "brief bursts, each under 1 hour",
    emptySegment: "(no elements reported)",
    becomingLead: "becoming: ",
    nswText: "no significant weather then (NSW)",
    sep: " · ",
  },
} as const;

const STYLE_ID = "mw-taf-card-style";
const STYLE_TEXT = `
.mw-taf-card { font: 13px/1.6 system-ui, sans-serif; color: #1c2733; background: #fff;
  border: 1px solid #d8dee6; border-radius: 8px; padding: 10px 12px; max-width: 420px; }
.mw-taf-card h2 { margin: 0 0 4px; font-size: 15px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.mw-taf-badge { font-size: 11px; font-weight: 600; color: #fff; background: #3d5a80;
  border-radius: 4px; padding: 1px 6px; }
.mw-taf-flag { font-size: 11px; color: #8a5a00; background: #fdf3dd; border-radius: 4px; padding: 1px 6px; }
.mw-taf-meta { color: #4a5560; font-size: 12px; margin: 1px 0; }
.mw-taf-strip { position: relative; height: 22px; margin: 8px 0 4px;
  background: #eef1f5; border-radius: 4px; overflow: hidden; }
.mw-taf-seg { position: absolute; top: 0; height: 100%; font-size: 9px; line-height: 22px;
  color: #2c3a48; text-align: center; overflow: hidden; white-space: nowrap; }
.mw-taf-seg-becmg { background: linear-gradient(90deg, rgba(61,90,128,.15), rgba(61,90,128,.45)); }
.mw-taf-seg-tempo { background: repeating-linear-gradient(45deg, rgba(224,161,60,.28) 0 4px, rgba(224,161,60,.12) 4px 8px); }
.mw-taf-seg-prob { background: repeating-linear-gradient(45deg, rgba(138,148,160,.25) 0 4px, rgba(138,148,160,.10) 4px 8px); }
.mw-taf-seg-fm { width: 2px !important; background: #1c2733; }
.mw-taf-txtn { position: absolute; top: -2px; font-size: 9px; color: #3d5a80; }
.mw-taf-raw { margin-top: 6px; font-family: ui-monospace, monospace; font-size: 11px;
  color: #4a5560; word-break: break-all; }
.mw-taf-periods-title { margin: 8px 0 2px; font-size: 11px; color: #6b7785; font-weight: 600; }
.mw-taf-periods { margin: 0; padding: 0; list-style: none; }
.mw-taf-period { display: grid; grid-template-columns: auto auto 1fr; gap: 2px 8px;
  align-items: baseline; padding: 3px 0; border-top: 1px dashed #e3e8ee; font-size: 12px; }
.mw-taf-period:first-child { border-top: none; }
.mw-taf-period-time { color: #6b7785; font-variant-numeric: tabular-nums; white-space: nowrap; }
.mw-taf-k { font-size: 11px; border-radius: 4px; padding: 0 5px; white-space: nowrap; }
.mw-taf-k-base { background: #f2f6fa; color: #44546a; }
.mw-taf-k-fm { background: #e8edf3; color: #1c2733; }
.mw-taf-k-becmg { background: #e3ecf6; color: #3d5a80; }
.mw-taf-k-tempo { background: #fdf3dd; color: #8a5a00; }
.mw-taf-k-prob { background: #eef0f3; color: #5a6b7d; }
.mw-taf-period-desc { color: #1c2733; }
.mw-taf-period-note { color: #8a5a12; font-size: 11px; }
.mw-taf-warn { margin-top: 6px; font-size: 10px; color: #8a94a0; }
`;

const el = (tag: string, cls?: string, text?: string): HTMLElement => {
  const node = document.createElement(tag);
  if (cls !== undefined) node.className = cls;
  if (text !== undefined) node.append(document.createTextNode(text));
  return node;
};

const injectStyle = (): void => {
  if (document.getElementById(STYLE_ID) !== null) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.append(document.createTextNode(STYLE_TEXT));
  document.head.append(style);
};

/** 分钟序（B3 回绕按 31 天缺省，卡片场景足用；跨月精确锚属展开层职责） */
const minutesOf = (day: number, hour: number): number => {
  const wrapped = day < 0 ? day + 31 : day;
  return wrapped * 1440 + hour * 60;
};

const windowSpan = (
  change: TafChangeGroup,
  base: { startDay: number; startHour: number },
): { from: number; to: number } | undefined => {
  const w = change.window;
  if (w === undefined) return undefined;
  const wrap = (d: number): number => (d < base.startDay ? d + 31 : d);
  return {
    from: minutesOf(wrap(w.startDay), w.startHour),
    to: minutesOf(wrap(w.endDay), w.endHour),
  };
};

/** 风组电码重建（变化组清单与分段悬停共用）：VRB/ddd 补零 + ff 补零 + G 阵风（单位前，电码序）+ 单位后缀 */
const windCodeOf = (w: WindGroup): string =>
  `${w.variable ? "VRB" : String(w.direction ?? "///").padStart(3, "0")}${String(w.speed.value).padStart(2, "0")}${w.gust !== undefined ? `G${w.gust.value}` : ""}${w.speed.unit === "mps" ? "MPS" : w.speed.unit === "kt" ? "KT" : "KMH"}`;

/** 变化组一行摘要：变化词 + 窗/时刻 + 所列要素紧凑串 */
type LocaleTable = (typeof LOCALE)[keyof typeof LOCALE];
const changeLine = (c: TafChangeGroup, t: LocaleTable): string => {
  const head =
    c.kind === "PROB"
      ? `${c.probability !== undefined ? t.probChip(c.probability) : "PROB"}${c.withTempo ? " TEMPO" : ""}`
      : c.kind === "FM"
        ? t.fm
        : c.kind === "BECMG"
          ? t.becmg
          : t.tempo;
  const when =
    c.at !== undefined
      ? `${String(c.at.hour).padStart(2, "0")}:${String(c.at.minute).padStart(2, "0")}`
      : (c.window?.raw ?? "");
  const e = c.elements;
  const parts: string[] = [];
  if (e?.wind !== undefined) parts.push(windCodeOf(e.wind));
  if (e?.visibility !== undefined) {
    parts.push(e.visibility.unit === "m" ? `${e.visibility.value} m` : `${e.visibility.value} SM`);
  }
  for (const g of e?.weather ?? []) {
    parts.push(
      `${g.intensity ?? ""}${g.proximity ? "VC" : ""}${g.descriptor ?? ""}${g.phenomena.join("")}`,
    );
  }
  for (const layer of e?.clouds?.elements ?? []) {
    if (layer.kind !== "layer") continue;
    parts.push(
      `${layer.amount ?? "?"}${String(Math.round((layer.heightFt.value ?? 0) / 100)).padStart(3, "0")}${layer.convective ?? ""}`,
    );
  }
  if (e?.nsw !== undefined) parts.push("NSW");
  if (e?.cavok !== undefined) parts.push("CAVOK");
  return `${head} ${when}${parts.length > 0 ? ` ｜ ${parts.join(" ")}` : ""}`.trim();
};

const tempLine = (t: TafTemperatureGroup, L: LocaleTable): string =>
  `${t.extremum === "max" ? L.max(t.celsius) : L.min(t.celsius)}${t.at.day !== undefined ? ` @ ${String(t.at.day).padStart(2, "0")}日${String(t.at.hour).padStart(2, "0")}Z` : ` @ ${String(t.at.hour).padStart(2, "0")}Z`}`;

// ---------------------------------------------------------------- 分段明细拼装（gloss 词表共用，与 METAR 卡同口径）

/** 分段行时刻标签（zh：23日06Z / en：23/06Z） */
const fmtSegAt = (at: TafExpandAt, locale: "zh" | "en"): string =>
  locale === "zh"
    ? `${String(at.day).padStart(2, "0")}日${String(at.hour).padStart(2, "0")}Z`
    : `${String(at.day).padStart(2, "0")}/${String(at.hour).padStart(2, "0")}Z`;

const cavokText = (locale: "zh" | "en"): string =>
  locale === "zh" ? `${CAVOK_SHORT.zh}（CAVOK）` : `${CAVOK_SHORT.en} (CAVOK)`;

/** 分段行人话——风（静风/风向不定/缺测口径同 METAR 卡） */
const segmentWindText = (w: WindGroup | undefined, locale: "zh" | "en"): string | undefined => {
  if (w === undefined) return undefined;
  const g = WIND_GLOSS[locale];
  const gust = w.gust === undefined ? "" : g.gustOf(w.gust.value);
  if (!w.variable && w.direction === 0 && w.speed.value === 0) return `${g.calm}${gust}`;
  const dir = w.variable ? g.variable : w.direction === null ? g.missing : `${w.direction}°`;
  return `${dir} ${w.speed.value} ${w.speed.unit}${gust}`;
};

/** 分段行人话——能见度（9999 → ≥10 km 上限口径同 METAR 卡） */
const segmentVisText = (v: VisibilityGroup | undefined): string | undefined => {
  if (v === undefined) return undefined;
  if (v.unit === "m") return v.beyond === "below" ? "<50 m" : v.exact ? `${v.value} m` : "≥10 km";
  return v.beyond === "below"
    ? `<${v.value} SM`
    : v.beyond === "above"
      ? `>${v.value} SM`
      : `${v.value} SM`;
};

/** 分段行人话——云（短名 + 云底折米 + 对流云威胁注；无云电码族走 skyClear 词表） */
const segmentCloudTexts = (c: CloudCondition | undefined, locale: "zh" | "en"): string[] => {
  if (c === undefined) return [];
  const g = CLOUD_GLOSS[locale];
  if (c.clear !== undefined) return [g.skyClear[c.clear.code] ?? c.clear.code];
  const parts: string[] = [];
  for (const layer of c.elements) {
    if (layer.kind === "vertical-visibility") {
      parts.push(
        layer.heightFt.value === null
          ? g.vvMissing
          : `${g.vvShort}${g.metersShort(ftToMeters(layer.heightFt.value))}`,
      );
      continue;
    }
    const amount = layer.amount === null ? g.amountUnknown : (g.shortAmount[layer.amount] ?? "");
    const base =
      layer.heightFt.value === null ? "" : g.baseShortMeters(ftToMeters(layer.heightFt.value));
    const conv = layer.convective === "CB" ? g.cbNote : layer.convective === "TCU" ? g.tcuNote : "";
    parts.push(`${amount}${base}${conv}`);
  }
  return parts;
};

/** 展开四要素 → 人话片段（主导段行与悬停共用）；CAVOK 独立成句（其让位语义下 vis/weather/clouds 缺席） */
const conditionsGloss = (c: TafResolvedConditions, locale: "zh" | "en"): string[] => {
  if (c.cavok) return [cavokText(locale)];
  const parts: string[] = [];
  const w = segmentWindText(c.wind, locale);
  if (w !== undefined) parts.push(w);
  const v = segmentVisText(c.visibility);
  if (v !== undefined) parts.push(v);
  for (const g of c.weather) parts.push(weatherGloss(g, WX_GLOSS[locale]));
  parts.push(...segmentCloudTexts(c.clouds, locale));
  return parts;
};

/** 变化组所列要素 → 人话片段（BECMG 过渡带行的「转为」内容）：未列要素不回溯，只报组内 */
const elementsGloss = (e: TrendElements, locale: "zh" | "en", t: LocaleTable): string[] => {
  if (e.cavok !== undefined) return [cavokText(locale)];
  const parts: string[] = [];
  const w = segmentWindText(e.wind, locale);
  if (w !== undefined) parts.push(w);
  const v = segmentVisText(e.visibility);
  if (v !== undefined) parts.push(v);
  for (const g of e.weather) parts.push(weatherGloss(g, WX_GLOSS[locale]));
  parts.push(...segmentCloudTexts(e.clouds, locale));
  if (e.nsw !== undefined && parts.length === 0) parts.push(t.nswText);
  return parts;
};

/** 分段行悬停电码（专业面）：由 IR 重建紧凑电码串——与变化组清单/RAW 同源同口径 */
const conditionsCodeOf = (c: TafResolvedConditions): string => {
  const parts: string[] = [];
  if (c.wind !== undefined) parts.push(windCodeOf(c.wind));
  if (c.visibility !== undefined)
    parts.push(c.visibility.unit === "m" ? `${c.visibility.value}` : `${c.visibility.value}SM`);
  for (const g of c.weather) parts.push(weatherCodeOf(g));
  if (c.clouds !== undefined) {
    if (c.clouds.clear !== undefined) parts.push(c.clouds.clear.code);
    for (const layer of c.clouds.elements) parts.push(cloudCodeOf(layer));
  }
  if (c.cavok) parts.push("CAVOK");
  return parts.join(" ");
};

/**
 * Render a TAF report as a self-contained DOM card with a proportional validity timeline strip.
 * 渲染 TAF 报文为自包含 DOM 卡片（含按有效期比例分段时间线：BECMG 渐变/TEMPO 斜纹/PROB 浅叠/FM 竖线/TX-TN 标记）。
 */
export function renderTafCard(report: TafReport, options: RenderTafCardOptions = {}): HTMLElement {
  injectStyle();
  const locale = options.locale ?? "zh";
  const t = LOCALE[locale];
  const card = el(
    "div",
    `mw-taf-card${options.className !== undefined ? ` ${options.className}` : ""}`,
  );

  // 头行：站名 + TAF 徽章 + 生命周期标志
  const h = el("h2");
  h.append(el("span", undefined, report.station), el("span", "mw-taf-badge", t.badge));
  if (report.flags.amended) h.append(el("span", "mw-taf-flag", t.amended));
  if (report.flags.corrected) h.append(el("span", "mw-taf-flag", t.corrected));
  card.append(h);
  if (report.nil === true) {
    card.append(el("p", "mw-taf-meta", t.nil));
    return card;
  }
  if (report.cancelled === true) {
    card.append(el("p", "mw-taf-meta", t.cancelled));
  }

  const v = report.validity;
  if (v === undefined) {
    card.append(el("p", "mw-taf-meta", t.noValidity));
    return card;
  }

  // 元信息：有效期 + 时长（差值口径）/ 发布时刻
  const hours =
    (v.endDay >= v.startDay ? v.endDay - v.startDay : v.endDay + 31 - v.startDay) * 24 +
    (v.endHour - v.startHour);
  card.append(el("p", "mw-taf-meta", `${t.validity} ${v.raw}（${t.duration(hours)}）`));
  if (report.issueTime !== undefined) {
    card.append(
      el(
        "p",
        "mw-taf-meta",
        `${t.issued} ${String(report.issueTime.day).padStart(2, "0")}日 ${String(report.issueTime.hour).padStart(2, "0")}:${String(report.issueTime.minute).padStart(2, "0")} Z`,
      ),
    );
  }

  // 时间线条：按分钟比例排布（含 B2 止时 24）
  const strip = el("div", "mw-taf-strip");
  strip.setAttribute("role", "img");
  strip.setAttribute("aria-label", `${t.timeline} ${v.raw}`);
  const base = { startDay: v.startDay, startHour: v.startHour };
  const t0 = minutesOf(v.startDay, v.startHour);
  const t1 = minutesOf(v.endDay >= v.startDay ? v.endDay : v.endDay + 31, v.endHour);
  const span = Math.max(t1 - t0, 1);
  const pct = (m: number): number => Math.min(100, Math.max(0, ((m - t0) / span) * 100));
  const labels: string[] = [];
  for (const c of report.changes) {
    if (c.kind === "FM" && c.at !== undefined) {
      const from = minutesOf(v.startDay, c.at.hour) + c.at.minute;
      const node = el("div", "mw-taf-seg mw-taf-seg-fm");
      node.style.left = `${pct(from)}%`;
      node.title = `FM ${String(c.at.hour).padStart(2, "0")}:${String(c.at.minute).padStart(2, "0")}`;
      strip.append(node);
      labels.push(node.title);
      continue;
    }
    const w = windowSpan(c, base);
    if (w === undefined) continue;
    const cls =
      c.kind === "TEMPO"
        ? "mw-taf-seg mw-taf-seg-tempo"
        : c.kind === "PROB"
          ? "mw-taf-seg mw-taf-seg-prob"
          : "mw-taf-seg mw-taf-seg-becmg";
    const node = el("div", cls);
    node.style.left = `${pct(w.from)}%`;
    node.style.width = `${Math.max(pct(w.to) - pct(w.from), 0.8)}%`;
    node.title = changeLine(c, t);
    strip.append(node);
    labels.push(node.title);
  }
  for (const temp of report.temperatures) {
    if (temp.at.day === undefined) continue;
    const at = minutesOf(temp.at.day < v.startDay ? temp.at.day + 31 : temp.at.day, temp.at.hour);
    const node = el("span", "mw-taf-txtn", temp.extremum === "max" ? "▲" : "▼");
    node.style.left = `${pct(at)}%`;
    node.title = tempLine(temp, t);
    strip.append(node);
  }
  if (labels.length > 0)
    strip.setAttribute("aria-label", `${t.timeline} ${v.raw}：${labels.join("；")}`);
  card.append(strip);

  // —— 分段天气明细（owner 9/23 指令「按拆分时间段给具体天气，像 METAR 报一样具体」）：
  // 每段一行「时间窗 + 类型徽 + 人话要素」，悬停/读屏＝该段电码紧凑串（专业面沿 METAR 卡口径：主表人话、原码悬停）
  {
    const rows = tafSegments(report);
    if (rows.length > 0) {
      const title = el("p", "mw-taf-periods-title", t.periods);
      const ol = el("ol", "mw-taf-periods");
      for (const row of rows) {
        const li = el("li", "mw-taf-period");
        const time = el(
          "span",
          "mw-taf-period-time",
          `${fmtSegAt(row.from, locale)}–${fmtSegAt(row.to, locale)}`,
        );
        // 类型徽：BECMG 拆「渐变中（过渡带）/转变后」两态；PROB 带概率
        const chipText =
          row.kind === "PROB"
            ? t.probChip(row.overlay?.probability ?? 30)
            : row.kind === "BECMG"
              ? row.uncertain
                ? t.kindBecmgDuring
                : t.kindBecmgAfter
              : row.kind === "TEMPO"
                ? t.kindTempo
                : row.kind === "FM"
                  ? t.kindFm
                  : t.kindBase;
        const chip = el("span", `mw-taf-k mw-taf-k-${row.kind.toLowerCase()}`, chipText);
        // 人话：TEMPO/PROB 行展示发作态（组内所列要素）；BECMG 过渡带行展示「转为」内容；其余主导段行=展开四要素
        const src = row.sourceIndex !== undefined ? report.changes[row.sourceIndex] : undefined;
        const parts =
          row.uncertain && src?.elements !== undefined
            ? [t.becomingLead + elementsGloss(src.elements, locale, t).join(t.sep)]
            : conditionsGloss(row.overlay?.conditions ?? row.conditions, locale);
        const descBox = el("span", "mw-taf-period-desc");
        descBox.append(
          document.createTextNode(parts.length > 0 ? parts.join(t.sep) : t.emptySegment),
        );
        if (row.uncertain)
          descBox.append(el("span", "mw-taf-period-note", `（${t.uncertainNote}）`));
        else if (row.kind === "TEMPO" || row.overlay?.withTempo === true)
          descBox.append(el("span", "mw-taf-period-note", `（${t.tempoNote}）`));
        li.append(time, chip, descBox);
        // 悬停/读屏＝电码（专业面）：该段紧凑电码；挂载/过渡带行附来源组原文
        const code = `${fmtSegAt(row.from, locale)}–${fmtSegAt(row.to, locale)}｜${conditionsCodeOf(row.overlay?.conditions ?? row.conditions)}${row.overlay !== undefined && src !== undefined ? ` ｜ ${src.raw}` : ""}`;
        li.title = code;
        li.setAttribute("aria-label", code);
        ol.append(li);
      }
      card.append(title, ol);
    }
  }

  // 气温组行
  if (report.temperatures.length > 0) {
    const p = el("p", "mw-taf-meta", `${t.temps}：`);
    p.append(document.createTextNode(report.temperatures.map((x) => tempLine(x, t)).join(" ｜ ")));
    card.append(p);
  }

  if (options.raw === true) {
    card.append(el("p", "mw-taf-raw", `${t.raw}｜${report.raw}`));
  }
  card.append(el("p", "mw-taf-warn", t.warning));
  return card;
}
