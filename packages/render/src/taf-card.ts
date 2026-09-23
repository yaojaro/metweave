/**
 * @metweave/render — TAF 预报卡片：TafReport IR → 自包含 DOM 组件（v0.2 渲染层②）。
 *
 * 结构：头行（站名 + TAF 徽章 + AMD/COR/NIL/CNL 标志）→ 元信息（有效期 + 时长 / 发布时刻）→
 * **分段天气明细**（tafSegments 逐段「时间窗 + 类型徽 + 人话要素」，
 * 悬停=电码紧凑串——owner 9/23 指令：按拆分时间段给具体天气，专业/小白双受众）→ 气温组行 → 可选 RAW 对照。
 * 与 card.ts 同纪律：纯 DOM 构建（createElement/textContent，无 innerHTML 注入面）、
 * 样式随组件注入（STYLE_ID 单次）、双语文案集中一张 locale 表、宿主 className 可叠加。
 * 预报警示：档位/摘要是扫视辅助，不得用作运行判据（沿 METAR 卡口径）。
 */
import type {
  CloudCondition,
  Span,
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
  cloudTone,
  ftToMeters,
  isCautionWeather,
  isDangerWeather,
  visibilityTone,
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
    change: "变化组",
    prob: (p: number): string => `概率 ${p}%`,
    temps: "气温极值",
    max: (c: number): string => `最高 ${c}°C`,
    min: (c: number): string => `最低 ${c}°C`,
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
    labelWind: "风",
    labelVis: "能见度",
    labelWx: "天气",
    labelCloud: "云",
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
    change: "Change groups",
    prob: (p: number): string => `PROB ${p}%`,
    temps: "Temperature extremes",
    max: (c: number): string => `Max ${c}°C`,
    min: (c: number): string => `Min ${c}°C`,
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
    labelWind: "Wind",
    labelVis: "Visibility",
    labelWx: "Weather",
    labelCloud: "Clouds",
    becomingLead: "becoming: ",
    nswText: "no significant weather then (NSW)",
    sep: " · ",
  },
} as const;
type LocaleTable = (typeof LOCALE)[keyof typeof LOCALE];

const STYLE_ID = "mw-taf-card-style";
const STYLE_TEXT = `
.mw-taf-card { font: 13px/1.6 system-ui, sans-serif; color: #1c2733; background: #fff;
  border: 1px solid #d8dee6; border-radius: 8px; padding: 10px 12px; max-width: 420px; }
.mw-taf-card h2 { margin: 0 0 4px; font-size: 15px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.mw-taf-badge { font-size: 11px; font-weight: 600; color: #fff; background: #3d5a80;
  border-radius: 4px; padding: 1px 6px; }
.mw-taf-flag { font-size: 11px; color: #8a5a00; background: #fdf3dd; border-radius: 4px; padding: 1px 6px; }
.mw-taf-meta { color: #4a5560; font-size: 12px; margin: 1px 0; }
.mw-taf-raw { margin: 10px 0 0; padding: 8px; border-radius: 6px; background: #f6f8fa;
  font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  white-space: pre-wrap; word-break: break-all; }
.mw-taf-periods-title { margin: 8px 0 2px; font-size: 11px; color: #6b7785; font-weight: 600; }
.mw-taf-periods { margin: 0; padding: 0; list-style: none; }
.mw-taf-period { padding: 4px 2px; border-top: 1px dashed #e3e8ee; font-size: 12px; border-radius: 4px; }
.mw-taf-period:first-child { border-top: none; }
.mw-taf-period-head { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
.mw-taf-period-body { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2px 16px; margin: 2px 0 0 14px; }
.mw-taf-item { color: #1c2733; min-width: 0; }
.mw-taf-item-full { grid-column: 1 / -1; }
.mw-taf-item-label { color: #6b7785; margin-right: 4px; }
.mw-taf-dot { font-size: 10px; }
.mw-taf-dot-good { color: #2f9e63; }
.mw-taf-dot-caution { color: #d99a2b; }
.mw-taf-dot-danger { color: #c2504a; }
.mw-taf-period-time { color: #6b7785; font-variant-numeric: tabular-nums; white-space: nowrap; }
.mw-taf-k { font-size: 11px; border-radius: 4px; padding: 0 5px; white-space: nowrap; }
.mw-taf-k-base { background: #f2f6fa; color: #44546a; }
.mw-taf-k-fm { background: #e8edf3; color: #1c2733; }
.mw-taf-k-becmg { background: #e3ecf6; color: #3d5a80; }
.mw-taf-k-tempo { background: #fdf3dd; color: #8a5a00; }
.mw-taf-k-prob { background: #eef0f3; color: #5a6b7d; }
.mw-taf-period-note { color: #8a5a12; font-size: 11px; }
/* 组级联动高亮（owner 三轮：悬停条目只点亮其来源组、悬停组片点亮对应条目/行头） */
.mw-taf-item.mw-taf-hl { background: #fdeeb9; border-radius: 3px; }
.mw-taf-period-head.mw-taf-hl { background: #fdf3dd; border-radius: 4px; }
.mw-taf-meta.mw-taf-hl { background: #fdeeb9; border-radius: 3px; }
.mw-taf-rawseg { border-bottom: 1px dashed #7f8c9a; cursor: help; }
.mw-taf-rawseg.mw-taf-hl { background: #fdeeb9; border-radius: 3px; }
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

/** 风组电码重建（变化组清单与分段悬停共用）：VRB/ddd 补零 + ff 补零 + G 阵风（单位前，电码序）+ 单位后缀 */
const windCodeOf = (w: WindGroup): string =>
  `${w.variable ? "VRB" : String(w.direction ?? "///").padStart(3, "0")}${String(w.speed.value).padStart(2, "0")}${w.gust !== undefined ? `G${w.gust.value}` : ""}${w.speed.unit === "mps" ? "MPS" : w.speed.unit === "kt" ? "KT" : "KMH"}`;

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

/** 分段行条目：要素标签 + 人话值 + 联动组键（wind/vis/wx/clouds＝四要素组；group＝整变化组；owner 9/23 三轮组级联动） */
interface SegItem {
  label: string;
  text: string;
  key?: "wind" | "vis" | "wx" | "clouds" | "group";
  /** 通栏条目（「转为：」引导与注记行） */
  full?: boolean;
}

const wxJoin = (locale: "zh" | "en"): string => (locale === "zh" ? "、" : ", ");

/** 展开四要素 → 带标签条目；CAVOK 独立成句（其让位语义下 vis/weather/clouds 缺席） */
const conditionItems = (
  c: TafResolvedConditions,
  locale: "zh" | "en",
  t: LocaleTable,
): SegItem[] => {
  if (c.cavok) return [{ label: t.labelWx, text: cavokText(locale), key: "wx" }];
  const items: SegItem[] = [];
  const w = segmentWindText(c.wind, locale);
  if (w !== undefined) items.push({ label: t.labelWind, text: w, key: "wind" });
  const v = segmentVisText(c.visibility);
  if (v !== undefined) items.push({ label: t.labelVis, text: v, key: "vis" });
  if (c.weather.length > 0)
    items.push({
      label: t.labelWx,
      text: c.weather.map((g) => weatherGloss(g, WX_GLOSS[locale])).join(wxJoin(locale)),
      key: "wx",
    });
  const clouds = segmentCloudTexts(c.clouds, locale);
  if (clouds.length > 0)
    items.push({ label: t.labelCloud, text: clouds.join(wxJoin(locale)), key: "clouds" });
  return items;
};

/** 变化组所列要素 → 带标签条目（BECMG 过渡带行/TEMPO 发作态）：未列要素不回溯，只报组内 */
const elementItems = (e: TrendElements, locale: "zh" | "en", t: LocaleTable): SegItem[] => {
  if (e.cavok !== undefined) return [{ label: t.labelWx, text: cavokText(locale), key: "wx" }];
  const items: SegItem[] = [];
  const w = segmentWindText(e.wind, locale);
  if (w !== undefined) items.push({ label: t.labelWind, text: w, key: "wind" });
  const v = segmentVisText(e.visibility);
  if (v !== undefined) items.push({ label: t.labelVis, text: v, key: "vis" });
  if (e.weather.length > 0)
    items.push({
      label: t.labelWx,
      text: e.weather.map((g) => weatherGloss(g, WX_GLOSS[locale])).join(wxJoin(locale)),
      key: "wx",
    });
  const clouds = segmentCloudTexts(e.clouds, locale);
  if (clouds.length > 0)
    items.push({ label: t.labelCloud, text: clouds.join(wxJoin(locale)), key: "clouds" });
  if (items.length === 0 && e.nsw !== undefined)
    items.push({ label: t.labelWx, text: t.nswText, key: "wx" });
  return items;
};

/** 组内要素 → 原文切片族（联动定位）：风＝整组 token 跨度（speed.span 全组）、能见度/天气逐组、云逐层 */
interface ElemSpans {
  wind: Span[];
  vis: Span[];
  wx: Span[];
  clouds: Span[];
}
const elemSpansOf = (e: TrendElements | undefined): ElemSpans => ({
  wind: e?.wind !== undefined && e.wind.speed.span !== undefined ? [e.wind.speed.span] : [],
  vis: e?.visibility?.span !== undefined ? [e.visibility.span] : [],
  wx: (e?.weather ?? []).flatMap((g) => (g.span !== undefined ? [g.span] : [])),
  clouds:
    e?.clouds !== undefined
      ? [
          ...e.clouds.elements.flatMap((l) => (l.span !== undefined ? [l.span] : [])),
          ...(e.clouds.clear?.span !== undefined ? [e.clouds.clear.span] : []),
        ]
      : [],
});

/** 基况四要素 → 原文切片族（CAVOK 归天气族——三关让位语义下它替代 vis/wx/clouds 位） */
const baseSpansOf = (report: TafReport): ElemSpans => ({
  wind:
    report.wind?.kind === "value" && report.wind.value.speed.span !== undefined
      ? [report.wind.value.speed.span]
      : [],
  vis:
    report.visibility?.kind === "value" && report.visibility.value.span !== undefined
      ? [report.visibility.value.span]
      : [],
  wx: [
    ...(report.weather?.kind === "value"
      ? report.weather.value.flatMap((g) => (g.span !== undefined ? [g.span] : []))
      : []),
    ...(report.cavokSpan !== undefined ? [report.cavokSpan] : []),
  ],
  clouds:
    report.clouds !== undefined
      ? [
          ...report.clouds.elements.flatMap((l) => (l.span !== undefined ? [l.span] : [])),
          ...(report.clouds.clear?.span !== undefined ? [report.clouds.clear.span] : []),
        ]
      : [],
});

/** 行条目的值从哪来（组级联动溯源）：自身变化组所列优先 → 沿变化链回溯（TEMPO/PROB 不改主导跳过、FM 硬界止）→ 基况兜底 */
const originSpansOf = (
  report: TafReport,
  sourceIndex: number | undefined,
  key: "wind" | "vis" | "wx" | "clouds",
): Span[] => {
  if (sourceIndex !== undefined) {
    for (let k = sourceIndex; k >= 0; k -= 1) {
      const ch = report.changes[k];
      if (ch === undefined) break;
      if (k !== sourceIndex && (ch.kind === "TEMPO" || ch.kind === "PROB")) continue;
      const hit = elemSpansOf(ch.elements)[key];
      if (hit.length > 0) return hit;
      if (ch.kind === "FM") break;
    }
  }
  return baseSpansOf(report)[key];
};

/** 分段扫视色点（好/注意/差，与 METAR 卡行色同判据族——显示层启发式，非运行判据） */
const segmentTone = (c: TafResolvedConditions): "good" | "caution" | "danger" => {
  let danger = false;
  let caution = false;
  for (const g of c.weather) {
    if (isDangerWeather(g)) danger = true;
    else if (isCautionWeather(g)) caution = true;
  }
  const vt = c.visibility === undefined ? undefined : visibilityTone(c.visibility);
  if (vt === "mw-danger") danger = true;
  else if (vt === "mw-caution") caution = true;
  if (c.clouds !== undefined && c.clouds.clear === undefined) {
    for (const layer of c.clouds.elements) {
      const lt = cloudTone(layer);
      if (lt === "mw-danger") danger = true;
      else if (lt === "mw-caution") caution = true;
    }
  }
  return danger ? "danger" : caution ? "caution" : "good";
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
 * Render a TAF report as a self-contained DOM card（period-by-period detail + RAW cross-link）.
 * 渲染 TAF 报文为自包含 DOM 卡片（分段天气明细 + RAW 对照与组级联动；比例时间线条已于
 * 2026-09-23 四轮评审移除——分段明细完整承载其信息量且更可读，无刻度图例的抽象条只余理解成本）。
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
  // —— 联动注册表（owner 9/23 三轮：着色细化到组级——条目/行头/原文片/元信息行双向点亮）
  const HL = "mw-taf-hl";
  const link = {
    items: [] as { el: HTMLElement; spans: Span[] }[],
    heads: [] as { el: HTMLElement; rowIdx: number }[],
    cuts: [] as {
      el: HTMLElement;
      rowIdx: number | null;
      key: string;
      start: number;
      end: number;
    }[],
    tempsEl: undefined as HTMLElement | undefined,
    validityEl: undefined as HTMLElement | undefined,
  };
  const clearHl = (): void => {
    for (const c of link.cuts) c.el.classList.remove(HL);
    for (const i of link.items) i.el.classList.remove(HL);
    for (const hd of link.heads) hd.el.classList.remove(HL);
    link.tempsEl?.classList.remove(HL);
    link.validityEl?.classList.remove(HL);
  };
  /** 悬停联动：自己 + 对侧集合同时点亮，离场全清 */
  const pairHover = (self: HTMLElement, others: () => HTMLElement[]): void => {
    self.addEventListener("mouseenter", () => {
      clearHl();
      self.classList.add(HL);
      for (const o of others()) o.classList.add(HL);
    });
    self.addEventListener("mouseleave", clearHl);
  };
  const validityEl = el("p", "mw-taf-meta", `${t.validity} ${v.raw}（${t.duration(hours)}）`);
  link.validityEl = validityEl;
  card.append(validityEl);
  if (report.issueTime !== undefined) {
    card.append(
      el(
        "p",
        "mw-taf-meta",
        `${t.issued} ${String(report.issueTime.day).padStart(2, "0")}日 ${String(report.issueTime.hour).padStart(2, "0")}:${String(report.issueTime.minute).padStart(2, "0")} Z`,
      ),
    );
  }

  // —— 分段天气明细（owner 9/23 指令「按拆分时间段给具体天气」；三轮版式：两列一行两条、组级联动）
  const rows = tafSegments(report);
  const rowEls: (HTMLElement | undefined)[] = [];
  if (rows.length > 0) {
    const title = el("p", "mw-taf-periods-title", t.periods);
    const ol = el("ol", "mw-taf-periods");
    for (const [rowIdx, row] of rows.entries()) {
      const li = el("li", "mw-taf-period");
      rowEls.push(li);
      const src = row.sourceIndex !== undefined ? report.changes[row.sourceIndex] : undefined;
      const shown = row.overlay?.conditions ?? row.conditions;
      // 行头：扫视色点 + 时间窗 + 类型徽（BECMG 拆「渐变中/转变后」两态；PROB 带概率）
      const head = el("div", "mw-taf-period-head");
      const dot = el("span", `mw-taf-dot mw-taf-dot-${segmentTone(shown)}`, "●");
      dot.setAttribute("aria-hidden", "true");
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
      head.append(
        dot,
        el(
          "span",
          "mw-taf-period-time",
          `${fmtSegAt(row.from, locale)}–${fmtSegAt(row.to, locale)}`,
        ),
        el("span", `mw-taf-k mw-taf-k-${row.kind.toLowerCase()}`, chipText),
      );
      link.heads.push({ el: head, rowIdx });
      // 行体：带标签要素条目，两列网格一行两条（owner 三轮版式）；TEMPO/PROB 行＝发作态、过渡带行＝「转为」
      const body = el("div", "mw-taf-period-body");
      const items: SegItem[] =
        row.uncertain && src?.elements !== undefined
          ? [
              { label: "", text: t.becomingLead, key: "group", full: true },
              ...elementItems(src.elements, locale, t),
            ]
          : conditionItems(shown, locale, t);
      if (items.length === 0) items.push({ label: "", text: t.emptySegment, full: true });
      for (const it of items) {
        const item = el("span", `mw-taf-item${it.full === true ? " mw-taf-item-full" : ""}`);
        if (it.label !== "") item.append(el("span", "mw-taf-item-label", it.label));
        item.append(document.createTextNode(it.text));
        // 组级联动注册：条目 ↔ 其值的来源组片（继承值溯源到基况/前变化组）
        if (it.key !== undefined) {
          const spans =
            it.key === "group"
              ? src?.span !== undefined
                ? [src.span]
                : []
              : originSpansOf(report, row.sourceIndex, it.key);
          if (spans.length > 0) link.items.push({ el: item, spans });
        }
        body.append(item);
      }
      if (row.uncertain)
        body.append(el("span", "mw-taf-period-note mw-taf-item-full", `（${t.uncertainNote}）`));
      else if (row.kind === "TEMPO" || row.overlay?.withTempo === true)
        body.append(el("span", "mw-taf-period-note mw-taf-item-full", `（${t.tempoNote}）`));
      li.append(head, body);
      // 悬停/读屏＝电码（专业面）：该段紧凑电码；挂载/过渡带行附来源组原文
      const code = `${fmtSegAt(row.from, locale)}–${fmtSegAt(row.to, locale)}｜${conditionsCodeOf(shown)}${row.overlay !== undefined && src !== undefined ? ` ｜ ${src.raw}` : ""}`;
      li.title = code;
      li.setAttribute("aria-label", code);
      ol.append(li);
    }
    card.append(title, ol);
  }

  // 气温组行（置于 RAW 之上——owner 三轮版式指令）
  if (report.temperatures.length > 0) {
    const p = el("p", "mw-taf-meta", `${t.temps}：`);
    p.append(document.createTextNode(report.temperatures.map((x) => tempLine(x, t)).join(" ｜ ")));
    card.append(p);
    link.tempsEl = p;
  }

  // —— RAW 对照（METAR 卡同款独立盒区置底）+ 行↔原文组级双向联动：
  // 已知组在原文逐组包 span（变化组内所列要素再嵌套子片）；悬停条目只点亮其来源组，悬停组片点亮对应条目/行头
  if (options.raw === true && rows.length > 0) {
    interface Cut {
      start: number;
      end: number;
      rowIdx: number | null;
      key: string;
      hint: string;
    }
    const cuts: Cut[] = [];
    if (v.span !== undefined)
      cuts.push({
        start: v.span.start,
        end: v.span.end,
        rowIdx: null,
        key: "validity",
        hint: `${t.validity} ${v.raw}`,
      });
    const baseRowIdx = rows.findIndex((r) => r.kind === "base");
    const baseHint = baseRowIdx >= 0 ? (rowEls[baseRowIdx]?.textContent ?? "") : "";
    const baseSpans = baseSpansOf(report);
    for (const key of ["wind", "vis", "wx", "clouds"] as const)
      for (const sp of baseSpans[key])
        cuts.push({ start: sp.start, end: sp.end, rowIdx: baseRowIdx, key, hint: baseHint });
    const rowIdxOfChange = new Map<number, number>();
    for (const [i, row] of rows.entries())
      if (row.sourceIndex !== undefined && !rowIdxOfChange.has(row.sourceIndex))
        rowIdxOfChange.set(row.sourceIndex, i);
    for (const [idx, change] of report.changes.entries()) {
      const ri = rowIdxOfChange.get(idx);
      if (ri === undefined || change.span === undefined) continue;
      const headHint = rowEls[ri]?.textContent ?? change.raw;
      cuts.push({
        start: change.span.start,
        end: change.span.end,
        rowIdx: ri,
        key: "group",
        hint: headHint,
      });
      const esp = elemSpansOf(change.elements);
      for (const key of ["wind", "vis", "wx", "clouds"] as const)
        for (const sp of esp[key])
          cuts.push({ start: sp.start, end: sp.end, rowIdx: ri, key, hint: headHint });
    }
    for (const temp of report.temperatures)
      if (temp.span !== undefined)
        cuts.push({
          start: temp.span.start,
          end: temp.span.end,
          rowIdx: null,
          key: "temp",
          hint: tempLine(temp, t),
        });
    // 排序（start 升序、同起长者先＝父组先于子片）＋嵌套装配：子片挂进父组 span，其余文本原样保真
    const sorted: Cut[] = [];
    for (const cut of cuts) {
      let at = sorted.length;
      while (at > 0) {
        const prev = sorted[at - 1];
        if (prev === undefined) break;
        if (prev.start < cut.start || (prev.start === cut.start && prev.end >= cut.end)) break;
        at -= 1;
      }
      sorted.splice(at, 0, cut);
    }
    const rawP = el("p", "mw-taf-raw");
    // 嵌套装配栈：span 创建一律留空，文本全部由栈管理——叶子片出栈补整段、父组首子片补头文本、
    // 出栈补层内尾文本（opened 标记父组是否已开层装子片）
    const open: {
      node: HTMLElement;
      start: number;
      end: number;
      inner: number;
      opened: boolean;
    }[] = [];
    let pos = 0;
    const popOne = (): void => {
      const top = open.pop();
      if (top === undefined) return;
      if (top.inner < top.end)
        top.node.append(document.createTextNode(report.raw.slice(top.inner, top.end)));
      if (top.end > pos) pos = top.end;
    };
    for (const cut of sorted) {
      if (cut.start >= cut.end) continue;
      while (open.length > 0) {
        const top = open[open.length - 1];
        if (top !== undefined && cut.start >= top.end) popOne();
        else break;
      }
      const top = open[open.length - 1];
      // 首个子片到达：写出父组头文本（如「TEMPO 2520/2524 」），层内游标就位
      if (top !== undefined && !top.opened) {
        top.node.append(document.createTextNode(report.raw.slice(top.start, cut.start)));
        top.opened = true;
        top.inner = cut.start;
      }
      const innerPos = top === undefined ? pos : top.inner;
      if (cut.start < innerPos) continue; // 同层重叠片跳过（防御传输怪形）
      const hostNode = top === undefined ? rawP : top.node;
      if (cut.start > innerPos)
        hostNode.append(document.createTextNode(report.raw.slice(innerPos, cut.start)));
      const seg = el("span", "mw-taf-rawseg"); // 文本由装配栈管理（防父组整段双写）
      seg.title = cut.hint;
      seg.setAttribute("aria-label", cut.hint);
      link.cuts.push({ el: seg, rowIdx: cut.rowIdx, key: cut.key, start: cut.start, end: cut.end });
      hostNode.append(seg);
      if (top !== undefined) top.inner = cut.end;
      else if (cut.end > pos) pos = cut.end;
      open.push({ node: seg, start: cut.start, end: cut.end, inner: cut.start, opened: false });
    }
    while (open.length > 0) popOne();
    rawP.append(document.createTextNode(report.raw.slice(pos)));
    // 联动接线：条目↔来源组片（组级）；行头↔该行全部片；气温/有效期组片↔对应元信息行
    for (const item of link.items)
      pairHover(item.el, () =>
        link.cuts
          .filter((c) => item.spans.some((sp) => sp.start === c.start && sp.end === c.end))
          .map((c) => c.el),
      );
    for (const hd of link.heads)
      pairHover(hd.el, () => link.cuts.filter((c) => c.rowIdx === hd.rowIdx).map((c) => c.el));
    for (const c of link.cuts)
      pairHover(c.el, () => {
        const out: HTMLElement[] = [];
        for (const item of link.items)
          if (item.spans.some((sp) => sp.start === c.start && sp.end === c.end)) out.push(item.el);
        for (const hd of link.heads)
          if (hd.rowIdx === c.rowIdx && c.key === "group") out.push(hd.el);
        if (c.key === "temp" && link.tempsEl !== undefined) out.push(link.tempsEl);
        if (c.key === "validity" && link.validityEl !== undefined) out.push(link.validityEl);
        return out;
      });
    card.append(rawP);
  }

  card.append(el("p", "mw-taf-warn", t.warning));
  return card;
}
