/**
 * @metweave/render — TAF 预报卡片：TafReport IR → 自包含 DOM 组件（v0.2 渲染层②）。
 *
 * 结构：头行（站名 + TAF 徽章 + AMD/COR/NIL/CNL 标志）→ 元信息（有效期 + 时长 / 发布时刻）→
 * **分段天气明细**（tafSegments 逐段「时间窗 + 类型徽 + 人话要素」，
 * 悬停=电码紧凑串——owner 9/23 指令：按拆分时间段给具体天气，专业/小白双受众）→ 气温极值（多组分行，置于分段上方——owner 五轮）→ 可选 RAW 对照。
 * 与 card.ts 同纪律：纯 DOM 构建（createElement/textContent，无 innerHTML 注入面）、
 * 样式随组件注入（STYLE_ID 单次）、双语文案集中一张 locale 表、宿主 className 可叠加。
 * 版式契约（owner 9/24 指令）：卡宽 480、卡高上限 min(65vh, 680px) 且超高卡内上下滚动
 * （超高弹窗不再占满整屏/被视口裁顶）、分段行间距 7px（段与段不贴死）。
 * 时区契约（owner 9/24 单制指令）：utcOffsetMinutes 决定全卡唯一展示时区（null=UTC 缺省 / 480=北京时），
 * 一处切换全卡一致；电码悬停（li.title）与 RAW 原文保持 UTC（与报文原码对齐，不随展示时区换算）。
 * 预报警示：档位/摘要是扫视辅助，不得用作运行判据（沿 METAR 卡口径）。
 */
import type {
  CloudCondition,
  CloudElement,
  Span,
  TafReport,
  TafTemperatureGroup,
  TrendElements,
  VisibilityGroup,
  WeatherGroup,
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
  /** 展开时刻（地图层传入）：与发布时刻同排右列「查看时刻 xxZ」（owner 六轮双列行） */
  at?: TafExpandAt;
  /** 附带 RAW 对照行（原文保真） */
  raw?: boolean;
  /** 宿主附加类名 */
  className?: string;
  /** 站点名（元数据联表所得，如「ZLXY 西安/咸阳」）——标题下 muted 站名行；缺省不渲染（沿 METAR 卡口径） */
  stationTitle?: string;
  /** 展示时区偏移（分钟）——owner 9/24 单制指令：全卡只显一个时区（旧「UTC+京时双括注」退役）。
   *  缺省 null＝UTC 单制；zh 传 480＝北京时单制（京dd日HH:MM 全卡统一）；en 无本地时词表恒 UTC */
  utcOffsetMinutes?: number | null;
  /** 月锚（真实年月，2026-09-24 评测 P1 月界批）：报文日号（或自该月 1 日起的连续日序）归属的日历月。
   *  在位时北京时制换算走真实月历——跨月显示「10月1日」而非「31日」回绕；缺席时按 31 天折回显示
   *  （残余近似仅显示位：TAF 报文本身无月份，无从判读真实月份；档位/展开判读不依赖显示串，无害）。
   *  month 为 1–12；连续日序 day > 31 按「锚月起第 N 天」进位（数学上恒正确，不受短月影响） */
  monthAnchor?: TafCalendarAnchor | null;
}

/** TAF 卡月锚：报文日号归属的真实年月（month 取 1–12）——北京时制真月历换算的日历上下文 */
export interface TafCalendarAnchor {
  readonly year: number;
  readonly month: number;
}

/** renderTafCard 合法选项键（运行时校验——拼错键不静默，沿 renderCard 不静默纪律） */
const RENDER_TAF_CARD_OPTION_KEYS: ReadonlySet<string> = new Set([
  "locale",
  "at",
  "raw",
  "className",
  "stationTitle",
  "utcOffsetMinutes",
  "monthAnchor",
]);

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
    atLabel: "查看时刻",
    atSuffix: "",
    localTag: "北京时",
    validityFrom: (day: string, hm: string): string => `自 ${day}日 ${hm}`,
    validityTo: (day: string, hm: string): string => `至 ${day}日 ${hm}`,
    validityFromZone: (clock: string): string => `自 ${clock}`,
    validityToZone: (clock: string): string => `至 ${clock}`,
    validityZone: "UTC",
    zoneLocal: "北京时",
    labelHigh: "高温",
    labelLow: "低温",
    change: "变化组",
    prob: (p: number): string => `概率 ${p}%`,
    temps: "气温极值",
    max: (c: number): string => `最高 ${c}°C`,
    min: (c: number): string => `最低 ${c}°C`,
    noValidity: "无有效期（缺报）",
    warning: "本卡由电码自动解析生成，供扫视参考；如有出入，以报文原文及官方发布为准",
    outEarly: "查看时刻早于本预报开始时间，以下显示预报起始时段的天气",
    outLate: "查看时刻已超出本预报结束时间，以下显示预报末段的天气",
    riskLead: "关键风险：",
    rawTitle: "报文原文（专业人员核对用）",
    rawHint: "悬停或 Tab 聚焦可与人话对照",
    toneGood: "良好",
    toneCaution: "注意",
    toneDanger: "差",
    periods: "分段天气",
    kindBase: "主要天气",
    kindFm: "FM·自此",
    kindBecmgDuring: "BECMG·渐变中",
    kindBecmgAfter: "BECMG·转变后",
    kindTempo: "TEMPO·间歇（概率≥40%）",
    probChip: (p: number, withTempo: boolean): string =>
      withTempo ? `PROB${p} TEMPO·概率间歇` : `PROB${p}·概率${p}%`,
    uncertainNote: "转变时刻不确定",
    tempoNote: "叠加在主时段之内的短时发作，每次不足 1 小时",
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
    atLabel: "Viewing",
    atSuffix: "",
    localTag: null,
    validityFrom: (day: string, hm: string): string => `from Day ${day}, ${hm}`,
    validityTo: (day: string, hm: string): string => `to Day ${day}, ${hm}`,
    validityFromZone: (clock: string): string => `from ${clock}`,
    validityToZone: (clock: string): string => `to ${clock}`,
    validityZone: "UTC",
    zoneLocal: "", // en 无本地时词表（localTag null）——时区单制恒 UTC，此键不可达、占位保形
    labelHigh: "High",
    labelLow: "Low",
    change: "Change groups",
    prob: (p: number): string => `PROB ${p}%`,
    temps: "Temperature extremes",
    max: (c: number): string => `Max ${c}°C`,
    min: (c: number): string => `Min ${c}°C`,
    noValidity: "No validity (NIL)",
    warning:
      "Auto-generated from the coded report for glance scanning; if in doubt, refer to the raw TAF and official channels",
    outEarly: "Viewing time is before this forecast starts — showing its first period",
    outLate: "Viewing time is beyond this forecast's end — showing its last period",
    riskLead: "Key risks: ",
    rawTitle: "Raw report (for professional cross-check)",
    rawHint: "hover or Tab-focus to cross-link with the plain-language rows",
    toneGood: "good",
    toneCaution: "caution",
    toneDanger: "poor",
    periods: "By period",
    kindBase: "Base",
    kindFm: "FM",
    kindBecmgDuring: "BECMG",
    kindBecmgAfter: "After BECMG",
    kindTempo: "TEMPO (prob ≥40%)",
    probChip: (p: number, withTempo: boolean): string =>
      withTempo ? `PROB${p} TEMPO` : `PROB${p}`,
    uncertainNote: "change timing uncertain",
    tempoNote: "brief bursts within the main period, each under 1 hour",
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
  border: 1px solid #d8dee6; border-radius: 8px; padding: 10px 12px; max-width: 480px;
  max-height: min(65vh, 680px); overflow-y: auto; position: relative; }
.mw-taf-card h2 { margin: 0 0 4px; font-size: 15px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.mw-taf-badge { font-size: 11px; font-weight: 600; color: #fff; background: #3d5a80;
  border-radius: 4px; padding: 1px 6px; }
.mw-taf-flag { font-size: 11px; color: #8a5a00; background: #fdf3dd; border-radius: 4px; padding: 1px 6px; }
.mw-taf-meta { color: #4a5560; font-size: 12px; margin: 1px 0; }
.mw-taf-meta-row { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.mw-taf-raw { margin: 10px 0 0; padding: 8px; border-radius: 6px; background: #f6f8fa;
  font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  white-space: pre-wrap; word-break: break-all; }
.mw-taf-periods-title { margin: 8px 0 2px; font-size: 11px; color: #6b7785; font-weight: 600; }
.mw-taf-temps { margin: 2px 0; }
.mw-taf-temp-line { margin: 0; font-size: 12px; color: #1c2733; }
.mw-taf-periods { margin: 0; padding: 0; list-style: none; }
.mw-taf-period { padding: 5px 6px 6px; border-top: 1px dashed #e3e8ee; font-size: 12px; border-radius: 4px;
  margin-bottom: 7px; }
.mw-taf-period:first-child { border-top: none; }
.mw-taf-period:last-child { margin-bottom: 0; }
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
.mw-taf-warn { margin-top: 6px; font-size: 11px; color: #5f6b79; }
.mw-taf-station { margin: -4px 0 4px; color: #6b7785; font-size: 12px; }
.mw-taf-outrange { color: #8a5a00; background: #fdf3dd; border-radius: 4px; padding: 1px 6px;
  font-size: 12px; display: inline-block; margin: 2px 0; }
.mw-taf-period-danger { border-left: 3px solid #c2504a; background: #fdf1f0; }
.mw-taf-period-caution { border-left: 3px solid #d99a2b; }
.mw-taf-risk { margin: 6px 0 0; font-size: 12px; color: #a02c2c; font-weight: 600; }
.mw-taf-raw-title { margin: 10px 0 0; font-size: 11px; color: #6b7785; font-weight: 600; }
.mw-taf-raw-hint { font-weight: 400; color: #6b7785; }
.mw-taf-rawseg-danger { color: #a02c2c; font-weight: 600; }
.mw-taf-rawseg-caution { color: #8a5a12; }
/* 联动可达性（评测工程 P0/P1）：tabIndex 聚焦通道 + 虚线 affordance；联动语言＝点亮＋浮签
   （owner 9/24 统一批定稿：不做压暗——原 focus+context 压暗已移除，两卡同口径） */
.mw-taf-item.mw-taf-link, .mw-taf-period-head.mw-taf-link { border-bottom: 1px dashed #7f8c9a; cursor: help; }
/* 就地电码浮签（owner 9/24 三轮）：绝对定位悬浮于条目上方——零占位零回流（旧 ::after 内联显码
   内容进文档流，行宽一变就换行回流「跳一跳」）；pointer-events:none 不挡悬停链 */
.mw-taf-codechip { position: absolute; display: none; z-index: 3; pointer-events: none; white-space: nowrap;
  font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: #44546a; background: #f7f9fc; border: 1px solid #cdd7e2; border-radius: 3px; padding: 1px 5px;
  box-shadow: 0 1px 3px rgba(20, 32, 45, 0.15); }
/* 解码气泡（owner 9/24 统一批）：点击条目弹「电码→人话」逐行 + FM 51 依据行——METAR 卡同款点击契约 */
.mw-taf-decode { position: absolute; display: none; z-index: 4; max-width: 300px; background: #fff;
  border: 1px solid #cdd7e2; border-radius: 6px; padding: 6px 8px; box-shadow: 0 2px 8px rgba(20, 32, 45, 0.18);
  font: 12px/1.5 system-ui, sans-serif; color: #1c2733; }
.mw-taf-decode-row { display: flex; gap: 6px; align-items: baseline; }
.mw-taf-decode-row span:last-child { min-width: 0; }
.mw-taf-decode-code { flex: none; font: 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: #44546a; background: #f2f6fa; border-radius: 3px; padding: 0 4px; }
.mw-taf-decode-arrow { color: #8a94a0; flex: none; }
.mw-taf-decode-cite { margin: 4px 0 0; font-size: 10px; color: #8a94a0; }
.mw-taf-item:focus-visible, .mw-taf-rawseg:focus-visible, .mw-taf-period-head:focus-visible
  { outline: 2px solid #4a90d9; outline-offset: 1px; }
.mw-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
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

/** 气温行紧凑值（评测小白#8：「高温最高」语义重复——标签已载极性，值只留 温度@时刻） */
const tempValueOf = (x: TafTemperatureGroup, lt = ""): string =>
  `${x.celsius}°C @ ${x.at.day !== undefined ? `${String(x.at.day).padStart(2, "0")}日${String(x.at.hour).padStart(2, "0")}Z` : `${String(x.at.hour).padStart(2, "0")}Z`}${lt}`;

// ---------------------------------------------------------------- 分段明细拼装（gloss 词表共用，与 METAR 卡同口径）

/** 元信息日号补零：23 */
const dayOf = (day: number): string => String(day).padStart(2, "0");

/** 元信息时钟（整点补零）：06:00Z——有效期行 UTC 单制的时刻段 */
const clockHmOf = (hour: number): string => `${String(hour).padStart(2, "0")}:00Z`;

const cavokText = (locale: "zh" | "en"): string =>
  locale === "zh" ? `${CAVOK_SHORT.zh}（CAVOK）` : `${CAVOK_SHORT.en} (CAVOK)`;

/** 日时 → 分钟序（出界比较用；TAF 无月，同报文语境内日号自洽） */
const absDayHour = (day: number, hour: number): number => (day - 1) * 1440 + hour * 60;

/** UTC → 本地时显示序（2026-09-24 评测 P1 月界批）：monthAnchor 在位时经 Date.UTC 真月历换算，
 *  跨月显示「10月1日」而非「31日」回绕；连续日序 day > 31 按「锚月起第 N 天」进位（恒正确）。
 *  报文日号可跨两月（如 9/30 23Z 发布、10/1 00Z 生效的报：发布日号 30 在生效月前一月）——
 *  minDay（生效起点日号）在位时，day ≥ minDay+16 判前一月（日号序在月内连续，跨月邻接差恒 ≈30）。
 *  无锚（TAF 报文无月份、宿主未传）或病态日号（锚月不含该日——守卫：月漂移即回退）时按 31 天折回，
 *  残余近似仅显示位：档位/展开判读不依赖显示串，且缺锚时无从判读真实月份 */
const ltClock = (
  day: number,
  hour: number,
  minute: number,
  offset: number,
  anchor?: TafCalendarAnchor,
  minDay?: number,
): string => {
  if (anchor !== undefined) {
    const prev = minDay !== undefined && day >= minDay + 16; // 发布等前月尾日号 → 锚月前一月
    const y = prev && anchor.month === 1 ? anchor.year - 1 : anchor.year;
    const m = prev ? (anchor.month === 1 ? 12 : anchor.month - 1) : anchor.month;
    const base = new Date(Date.UTC(y, m - 1, day, hour, minute));
    if (day > 31 || base.getUTCMonth() === m - 1) {
      const z = new Date(base.getTime() + offset * 60_000);
      return `${z.getUTCMonth() + 1}月${z.getUTCDate()}日 ${String(z.getUTCHours()).padStart(2, "0")}:${String(z.getUTCMinutes()).padStart(2, "0")}`;
    }
  }
  const total = (day - 1) * 1440 + hour * 60 + minute + offset;
  const d = (Math.floor(total / 1440) % 31) + 1;
  const h = Math.floor((total % 1440) / 60);
  const m = total % 60;
  return `${String(d).padStart(2, "0")}日${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/** 八方位中文风向词（小白人话：60° → 东北） */
const DIR_WORDS_ZH = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"] as const;

/** 蒲福风级（m/s 阈值上界；kt/kmh 先折 m/s）——小白人话：3 m/s → 2 级 */
const beaufortOf = (mps: number): number => {
  const bounds = [0.3, 1.6, 3.4, 5.5, 8.0, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7];
  let level = 12;
  for (const [i, b] of bounds.entries())
    if (mps < b) {
      level = i;
      break;
    }
  return level;
};

/** 分段行人话——风（zh：方位+风级给小白、括号内精确值给专业；静风/风向不定口径同 METAR 卡） */
const segmentWindText = (w: WindGroup | undefined, locale: "zh" | "en"): string | undefined => {
  if (w === undefined) return undefined;
  const g = WIND_GLOSS[locale];
  const gust = w.gust === undefined ? "" : g.gustOf(w.gust.value);
  if (!w.variable && w.direction === 0 && w.speed.value === 0) return `${g.calm}${gust}`;
  if (locale === "zh" && w.direction !== null) {
    const word = DIR_WORDS_ZH[Math.round(w.direction / 45) % 8];
    const mps =
      w.speed.unit === "kt"
        ? w.speed.value * 0.5144
        : w.speed.unit === "kmh"
          ? w.speed.value / 3.6
          : w.speed.value;
    return `${word}风 ${beaufortOf(mps)} 级（${w.direction}° ${w.speed.value} ${w.speed.unit}）${gust}`;
  }
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
  for (const layer of c.elements) parts.push(cloudLayerText(layer, locale));
  return parts;
};

/** 单层云人话（segmentCloudTexts 与解码气泡行共用——短名 + 云底台阶化折米 + 对流云威胁注） */
const cloudLayerText = (layer: CloudElement, locale: "zh" | "en"): string => {
  const g = CLOUD_GLOSS[locale];
  if (layer.kind === "vertical-visibility") {
    return layer.heightFt.value === null
      ? g.vvMissing
      : `${g.vvShort}${g.metersShort(Math.round(ftToMeters(layer.heightFt.value) / 100) * 100)}`;
  }
  const amount = layer.amount === null ? g.amountUnknown : (g.shortAmount[layer.amount] ?? "");
  // 云底台阶化（评测小白#7：914 米的换算残留精度对小白只传达诡异；精确值在悬停电码与 RAW 原文）
  const meters =
    layer.heightFt.value === null ? null : Math.round(ftToMeters(layer.heightFt.value) / 100) * 100;
  const base =
    meters === null ? "" : locale === "zh" ? `，云底约 ${meters} 米` : g.baseShortMeters(meters);
  const conv = layer.convective === "CB" ? g.cbNote : layer.convective === "TCU" ? g.tcuNote : "";
  return `${amount}${base}${conv}`;
};

/** 分段行条目：要素标签 + 人话值 + 联动组键（wind/vis/wx/clouds＝四要素组；group＝整变化组；owner 9/23 三轮组级联动） */
interface SegItem {
  label: string;
  text: string;
  key?: "wind" | "vis" | "wx" | "clouds" | "group";
  /** 通栏条目（「转为：」引导与注记行） */
  full?: boolean;
}

// ---------------------------------------------------------------- 解码气泡（owner 9/24 统一批：点击条目出「电码→人话」+ 依据行）

/** TAF 解码依据行文案（条款号核自 WMO-No. 306 卷 I.1（2019 版）FM 51–XV：风 §51.3 / 能见度 §51.4 /
 *  天气 §51.5（NSW §51.5.1）/ 云 §51.6；变化组条款未核到、不标——与 METAR 卡 DECODE_CITES 同四段式） */
const TAF_DECODE_CITES: Record<"wind" | "vis" | "wx" | "clouds", { zh: string; en: string }> = {
  wind: {
    zh: "依据：WMO-No. 306 卷 I.1（2019）FM 51 §51.3——预报地面平均风向/风速（风向不定 VRB 见 §51.3.4）",
    en: "Basis: WMO-No. 306 Vol I.1 (2019), FM 51 §51.3 — forecast surface wind (VRB: §51.3.4)",
  },
  vis: {
    zh: "依据：WMO-No. 306 卷 I.1（2019）FM 51 §51.4——预报能见度 VVVV（判据与 METAR 报告值一致，9999＝10 km 及以上）",
    en: "Basis: WMO-No. 306 Vol I.1 (2019), FM 51 §51.4 — forecast visibility VVVV (same criteria as METAR; 9999 = 10 km or more)",
  },
  wx: {
    zh: "依据：WMO-No. 306 卷 I.1（2019）FM 51 §51.5——预报天气现象（其间无重要天气 NSW 见 §51.5.1）",
    en: "Basis: WMO-No. 306 Vol I.1 (2019), FM 51 §51.5 — forecast weather (NSW: §51.5.1)",
  },
  clouds: {
    zh: "依据：WMO-No. 306 卷 I.1（2019）FM 51 §51.6——预报云组（逐层云量/云底；显著变化增发条款见 §51.5.2/§51.6.3）",
    en: "Basis: WMO-No. 306 Vol I.1 (2019), FM 51 §51.6 — forecast clouds (change provisions: §51.5.2/§51.6.3)",
  },
};

/** 解码行输入面（TafResolvedConditions 与 TrendElements 的结构公共子集） */
interface DecodeElems {
  wind?: WindGroup;
  visibility?: VisibilityGroup;
  weather: readonly WeatherGroup[];
  clouds?: CloudCondition;
}

/** 解码行：电码 → 人话，按要素族逐组/逐层成对（词表与分段行同一来源 gloss.ts，单一真相） */
const decodeRowsOf = (
  key: "wind" | "vis" | "wx" | "clouds" | "group",
  e: DecodeElems | undefined,
  locale: "zh" | "en",
): Array<{ code: string; text: string }> => {
  if (e === undefined) return [];
  switch (key) {
    case "wind":
      return e.wind === undefined
        ? []
        : [{ code: windCodeOf(e.wind), text: segmentWindText(e.wind, locale) ?? "" }];
    case "vis": {
      const v = e.visibility;
      if (v === undefined) return [];
      return [
        { code: v.unit === "m" ? `${v.value}` : `${v.value}SM`, text: segmentVisText(v) ?? "" },
      ];
    }
    case "wx":
      return e.weather.map((g) => ({
        code: weatherCodeOf(g),
        text: weatherGloss(g, WX_GLOSS[locale]),
      }));
    case "clouds": {
      const c = e.clouds;
      if (c === undefined) return [];
      if (c.clear !== undefined)
        return [
          {
            code: c.clear.code,
            text: CLOUD_GLOSS[locale].skyClear[c.clear.code] ?? c.clear.code,
          },
        ];
      return c.elements.map((layer) => ({
        code: cloudCodeOf(layer),
        text: cloudLayerText(layer, locale),
      }));
    }
    case "group":
      return [];
    default:
      return [];
  }
};

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
  for (const cloud of segmentCloudTexts(c.clouds, locale))
    items.push({ label: t.labelCloud, text: cloud, key: "clouds" });
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
  for (const cloud of segmentCloudTexts(e.clouds, locale))
    items.push({ label: t.labelCloud, text: cloud, key: "clouds" });
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
  for (const key of Object.keys(options)) {
    if (!RENDER_TAF_CARD_OPTION_KEYS.has(key)) {
      throw new Error(
        `renderTafCard 收到未知选项 "${key}"——拼错的选项不会生效，可用项见 RenderTafCardOptions`,
      );
    }
  }
  injectStyle();
  const locale = options.locale ?? "zh";
  const t = LOCALE[locale];
  // 展示时区（owner 9/24 单制指令：全卡只显一个时区，旧「UTC+京时双括注」退役）：
  // 缺省 null＝UTC 单制；480＝北京时单制；en 无本地时词表（localTag null）恒 UTC
  const zone =
    options.utcOffsetMinutes !== undefined &&
    options.utcOffsetMinutes !== null &&
    t.localTag !== null
      ? options.utcOffsetMinutes
      : null;
  const calAnchor = options.monthAnchor ?? undefined; // 真月历锚（缺省 %31 折回近似，见 ltClock 注释）
  /** 生效起点日号（发布等前月尾日号的跨月判据；无有效期报无此语境） */
  const minDay = report.validity?.startDay;
  const tag = t.localTag;
  /** 主显钟点：UTC＝dd日HH:MMZ；京＝北京时M月D日 HH:MM（真月历，月界批） */
  const clockAt = (day: number, hour: number, minute: number): string =>
    zone === null
      ? `${String(day).padStart(2, "0")}日${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}Z`
      : `${tag}${ltClock(day, hour, minute, zone, calAnchor, minDay)}`;
  /** 段界时刻（整点）：UTC＝dd日HHZ；京＝北京时M月D日 HH:00（段头/风险行/气温时刻） */
  const segClock = (day: number, hour: number, minute: number): string =>
    zone === null
      ? `${String(day).padStart(2, "0")}日${String(hour).padStart(2, "0")}Z`
      : `${tag}${ltClock(day, hour, minute, zone, calAnchor, minDay)}`;
  /** 段区间：dd日HHZ–dd日HHZ / 京dd日HH:00–dd日HH:00 */
  const segRangeOf = (from: TafExpandAt, to: TafExpandAt): string =>
    `${segClock(from.day, from.hour, from.minute)}–${segClock(to.day, to.hour, to.minute)}`;
  /** 时区名（有效期行）：UTC / 北京时 */
  const zoneName = zone === null ? t.validityZone : t.zoneLocal;
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
  if (options.stationTitle !== undefined && options.stationTitle !== "") {
    card.append(el("p", "mw-taf-station", options.stationTitle));
  }
  if (report.nil === true) {
    card.append(el("p", "mw-taf-meta", t.nil));
    return card;
  }
  if (report.cancelled === true) {
    card.append(el("p", "mw-taf-outrange", t.cancelled));
    card.append(el("p", "mw-taf-warn", t.warning));
    return card; // CNL：正文截断，无分段无原文（占风组位＝取消凭据，有效期信息已并入取消行语境）
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
  /** 解码气泡依据键（FM 51 条款族——见 TAF_DECODE_CITES） */
  type TafCiteKey = keyof typeof TAF_DECODE_CITES;
  /** 条目 → 解码气泡载荷（电码→人话行 + 依据键；点击条目时弹——owner 9/24 统一批） */
  const itemDecode = new Map<
    HTMLElement,
    { rows: Array<{ code: string; text: string }>; cites: TafCiteKey[] }
  >();
  /** 行头 → 该行全部条目的合并解码载荷（键盘 Enter/Space 开——行头代表段，评测 P1 键盘批） */
  const headDecode = new Map<
    HTMLElement,
    { rows: Array<{ code: string; text: string }>; cites: TafCiteKey[] }
  >();
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
  // —— 就地电码浮签（owner 9/24 三轮）：卡内绝对定位、悬浮于条目上方——零占位零回流
  //（旧 ::after 内联显码内容进文档流，行宽一变就换行回流「跳一跳」）；随联动 activate/clear 显隐
  const codeChip = el("span", "mw-taf-codechip");
  card.append(codeChip);
  const showCodeChip = (target: HTMLElement): void => {
    codeChip.textContent = target.dataset.code ?? "";
    codeChip.style.display = "inline-block";
    const cardR = card.getBoundingClientRect();
    const tR = target.getBoundingClientRect();
    const chipW = codeChip.offsetWidth;
    const left = Math.max(
      4,
      Math.min(tR.right - cardR.left - chipW + card.scrollLeft, card.clientWidth - chipW - 4),
    );
    const top = Math.max(0, tR.top - cardR.top - codeChip.offsetHeight - 2 + card.scrollTop);
    codeChip.style.left = `${left}px`;
    codeChip.style.top = `${top}px`;
  };
  const hideCodeChip = (): void => {
    codeChip.style.display = "none";
  };
  // —— 解码气泡（owner 9/24 统一批：点击条目弹「电码→人话」逐行 + FM 51 依据行——METAR 卡同款点击契约；
  // 切换语义与 METAR 一致：点已开的收起、点别的换内容、点空白处收起。
  // 键盘契约（2026-09-24 评测 P1 键盘批，两卡同款）：可聚焦元素（行头，代表段）Enter/Space 开合该行
  // 合并解码气泡、Esc 关闭；条目保持不入 Tab 序（复测工程 N3「行头代表段、Tab stop 减半」决策不推翻），
  // 鼠标点击条目仍开其单条气泡；aria-expanded 挂触发元素、气泡经 aria-describedby 接入读屏
  const decodeBubble = el("div", "mw-taf-decode");
  decodeBubble.setAttribute("role", "tooltip");
  card.append(decodeBubble);
  let decodeOpenFor: HTMLElement | null = null;
  let decodeSeq = 0;
  const hideDecode = (): void => {
    if (decodeOpenFor !== null) {
      decodeOpenFor.removeAttribute("aria-expanded");
      decodeOpenFor.removeAttribute("aria-describedby");
    }
    decodeBubble.style.display = "none";
    decodeOpenFor = null;
  };
  const showDecode = (
    item: HTMLElement,
    payload: { rows: Array<{ code: string; text: string }>; cites: TafCiteKey[] },
  ): void => {
    decodeBubble.replaceChildren();
    for (const r of payload.rows) {
      const line = el("div", "mw-taf-decode-row");
      line.append(
        el("span", "mw-taf-decode-code", r.code),
        el("span", "mw-taf-decode-arrow", "→"),
        el("span", undefined, r.text),
      );
      decodeBubble.append(line);
    }
    for (const cite of payload.cites) {
      decodeBubble.append(el("p", "mw-taf-decode-cite", TAF_DECODE_CITES[cite][locale]));
    }
    decodeBubble.style.display = "block";
    // 定位：条目下方优先，卡内钳制（卡可滚动，坐标作滚动补偿；先落位再量宽高）
    decodeBubble.style.left = "4px";
    decodeBubble.style.top = "0px";
    const cardR = card.getBoundingClientRect();
    const iR = item.getBoundingClientRect();
    const bw = Math.min(decodeBubble.offsetWidth, card.clientWidth - 8);
    const bh = decodeBubble.offsetHeight;
    const left = Math.max(4, Math.min(iR.left - cardR.left, card.clientWidth - bw - 4));
    const below = iR.bottom - cardR.top + 4 + card.scrollTop;
    const top =
      below + bh <= card.clientHeight - 4
        ? below
        : Math.max(0, iR.top - cardR.top - bh - 2 + card.scrollTop);
    decodeBubble.style.left = `${left}px`;
    decodeBubble.style.top = `${top}px`;
    if (decodeBubble.id === "") decodeBubble.id = `mw-taf-decode-${++decodeSeq}`;
    item.setAttribute("aria-expanded", "true");
    item.setAttribute("aria-describedby", decodeBubble.id);
    decodeOpenFor = item;
  };
  /** 解码载荷（条目单条 / 行头合并）→ 开合入口：已开者收起、否则开 */
  const toggleDecode = (
    item: HTMLElement,
    payload: { rows: Array<{ code: string; text: string }>; cites: TafCiteKey[] },
  ): void => {
    if (decodeOpenFor === item) hideDecode();
    else showDecode(item, payload);
  };
  card.addEventListener("click", (ev) => {
    const target = ev.target instanceof HTMLElement ? ev.target : null;
    const item = target?.closest<HTMLElement>(".mw-taf-item[data-code]") ?? null;
    const payload = item !== null ? itemDecode.get(item) : undefined;
    if (item !== null && payload !== undefined) {
      toggleDecode(item, payload);
      return;
    }
    if (target?.closest(".mw-taf-decode") === null) hideDecode();
  });
  card.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      hideDecode();
      return;
    }
    if (ev.key !== "Enter" && ev.key !== " ") return;
    // 行头代表段（可聚焦）：Enter/Space 开该行全部条目的合并解码表（键盘通道，评测 P1）
    const target = ev.target instanceof HTMLElement ? ev.target : null;
    const head = target?.closest<HTMLElement>(".mw-taf-period-head") ?? null;
    const payload = head !== null ? headDecode.get(head) : undefined;
    if (head !== null && payload !== undefined) {
      ev.preventDefault(); // Space 不滚动页面
      toggleDecode(head, payload);
    }
  });
  const clearHl = (): void => {
    for (const c of link.cuts) c.el.classList.remove(HL);
    for (const i of link.items) i.el.classList.remove(HL);
    for (const hd of link.heads) hd.el.classList.remove(HL);
    link.tempsEl?.classList.remove(HL);
    link.validityEl?.classList.remove(HL);
    hideCodeChip();
  };
  /**
   * 联动三通道（评测工程 P0：mouseenter 之外补 focusin——键盘可达；tabIndex 聚焦 + 虚线 affordance）。
   * 联动语言＝点亮＋浮签（owner 9/24 统一批定稿：不做压暗）。focusable=false（分段条目）不入 Tab 序——
   * 行头代表整段聚焦，单卡 Tab stop 从 ~27 降半（复测工程 N3 简版）
   */
  const pairHover = (self: HTMLElement, others: () => HTMLElement[], focusable = true): void => {
    self.classList.add("mw-taf-link");
    if (focusable) self.tabIndex = 0;
    const activate = (): void => {
      clearHl();
      self.classList.add(HL);
      for (const o of others()) o.classList.add(HL);
      if (self.dataset.code !== undefined) showCodeChip(self); // 带 data-code 的条目：浮签随行显码
    };
    self.addEventListener("mouseenter", activate);
    self.addEventListener("focusin", activate);
    self.addEventListener("mouseleave", clearHl);
    self.addEventListener("focusout", clearHl);
  };
  // 发布在前、有效期在后（owner 五轮语序）；展开时刻在位时与发布同行左右两列（owner 六轮）
  if (report.issueTime !== undefined || options.at !== undefined) {
    const row = el("p", "mw-taf-meta mw-taf-meta-row");
    if (report.issueTime !== undefined) {
      row.append(
        el(
          "span",
          undefined,
          `${t.issued} ${clockAt(report.issueTime.day, report.issueTime.hour, report.issueTime.minute)}`,
        ),
      );
    }
    if (options.at !== undefined) {
      row.append(
        el(
          "span",
          undefined,
          `${t.atLabel} ${clockAt(options.at.day, options.at.hour, options.at.minute)}`.trim(),
        ),
      );
    }
    card.append(row);
  }
  // 有效期直说具体日期时间（不用 ddHH/ddHH 短码）：止时 24＝次日 00:00（B2 午夜特例的显示位换算）；
  // 两制各自模板——UTC 带日号前缀 + HH:MMZ；京时整段京钟（validityFrom 的「dd日」前缀不重复套日号）
  const endClock =
    v.endHour === 24 ? { day: (v.endDay % 31) + 1, hour: 0 } : { day: v.endDay, hour: v.endHour };
  const validityText =
    zone === null
      ? `${t.validity} ${t.validityFrom(dayOf(v.startDay), clockHmOf(v.startHour))} ${t.validityTo(
          dayOf(endClock.day),
          clockHmOf(endClock.hour),
        )}（${zoneName}，${t.duration(hours)}）`
      : `${t.validity} ${t.validityFromZone(clockAt(v.startDay, v.startHour, 0))} ${t.validityToZone(
          clockAt(endClock.day, endClock.hour, 0),
        )}（${zoneName}，${t.duration(hours)}）`;
  const validityEl = el("p", "mw-taf-meta", validityText);
  link.validityEl = validityEl;
  card.append(validityEl);
  // 出界提示（评测共识⑤）：查看时刻落在本预报有效期外（展开器按窗前=基况/窗后=末段保守返回，须显式告知）
  if (options.at !== undefined) {
    const atAbs = absDayHour(options.at.day, options.at.hour) + options.at.minute;
    const startAbs = absDayHour(v.startDay, v.startHour);
    const endAbs = absDayHour(v.endDay < v.startDay ? v.endDay + 31 : v.endDay, v.endHour);
    if (atAbs < startAbs || atAbs >= endAbs) {
      const note = el("p", "mw-taf-outrange", atAbs < startAbs ? t.outEarly : t.outLate);
      // 时间倒错过渡说明（复测签派 N1）：明示所示报文的发布时刻——滑杆前段「未来的报文演过去」不再含糊
      if (report.issueTime !== undefined) {
        note.append(
          document.createTextNode(
            `（所示为 ${clockAt(report.issueTime.day, report.issueTime.hour, report.issueTime.minute)} 发布的报文）`,
          ),
        );
      }
      card.append(note);
    }
  }

  // 气温极值（owner 五轮：置于分段天气上方的基本固定信息；多组分行——组标题 + 高温一行 + 低温一行）
  if (report.temperatures.length > 0) {
    const box = el("div", "mw-taf-temps");
    box.append(el("p", "mw-taf-meta", `${t.temps}：`));
    const maxes = report.temperatures.filter((x) => x.extremum === "max");
    const mins = report.temperatures.filter((x) => x.extremum === "min");
    // 气温时刻随展示时区（单制）：UTC=@ dd日HHZ；京=@ 京dd日HH:00（无日短形态 HHZ 按时区折时、日号缺省不显）
    const tempText = (x: TafTemperatureGroup): string => {
      if (zone === null) return tempValueOf(x);
      const atText =
        x.at.day !== undefined
          ? `${tag}${ltClock(x.at.day, x.at.hour, 0, zone, calAnchor, minDay)}`
          : `${tag}${String(Math.floor(((x.at.hour * 60 + zone) % 1440) / 60)).padStart(2, "0")}:00`;
      return `${x.celsius}°C @ ${atText}`;
    };
    const tempRow = (label: string, list: TafTemperatureGroup[]): void => {
      if (list.length === 0) return;
      // 多组逐值一行（首行带标签，其余空标签对齐——复测小白#7：并列一行易漏看第二峰值）
      for (const [i, x] of list.entries()) {
        const row = el("p", "mw-taf-temp-line");
        row.append(el("span", "mw-taf-item-label", i === 0 ? label : ""));
        row.append(document.createTextNode(tempText(x)));
        box.append(row);
      }
    };
    tempRow(t.labelHigh, maxes);
    tempRow(t.labelLow, mins);
    card.append(box);
    link.tempsEl = box;
  }

  // —— 分段天气明细（owner 9/23 指令「按拆分时间段给具体天气」；三轮版式：两列一行两条、组级联动）
  const rows = tafSegments(report);
  const rowEls: (HTMLElement | undefined)[] = [];
  if (rows.length > 0) {
    // 关键风险摘要行（评测签派 P1-3：图上红点、卡内逐行读字的层级倒挂——置顶一眼定雷）
    const toneWord = { good: t.toneGood, caution: t.toneCaution, danger: t.toneDanger } as const;
    const riskParts: string[] = [];
    for (const row of rows) {
      const tone = segmentTone(row.overlay?.conditions ?? row.conditions);
      if (tone === "good") continue;
      const c = row.overlay?.conditions ?? row.conditions;
      const parts: string[] = [];
      for (const g of c.weather)
        parts.push(weatherGloss(g, WX_GLOSS[locale]).replace(/（[^）]*）/g, ""));
      const vis = segmentVisText(c.visibility);
      if (
        vis !== undefined &&
        (tone === "danger" ||
          (c.visibility !== undefined && visibilityTone(c.visibility) !== undefined))
      )
        parts.push(`${t.labelVis} ${vis}`);
      if (c.clouds !== undefined && c.clouds.clear === undefined)
        for (const layer of c.clouds.elements)
          if (layer.kind === "layer" && layer.convective !== undefined)
            parts.push(layer.convective === "CB" ? "积雨云" : "浓积云");
      if (parts.length > 0)
        riskParts.push(`${segRangeOf(row.from, row.to)} ${parts.join(wxJoin(locale))}`);
    }
    if (riskParts.length > 0) {
      const risk = el(
        "p",
        "mw-taf-risk",
        `${t.riskLead}${riskParts.slice(0, 3).join("；")}${riskParts.length > 3 ? " 等" : ""}`,
      );
      card.append(risk);
    }
    const title = el("p", "mw-taf-periods-title", t.periods);
    const ol = el("ol", "mw-taf-periods");
    for (const [rowIdx, row] of rows.entries()) {
      const tone = segmentTone(row.overlay?.conditions ?? row.conditions);
      const li = el("li", `mw-taf-period${tone === "good" ? "" : ` mw-taf-period-${tone}`}`);
      rowEls.push(li);
      const src = row.sourceIndex !== undefined ? report.changes[row.sourceIndex] : undefined;
      const shown = row.overlay?.conditions ?? row.conditions;
      // 行头：扫视色点 + 时间窗（随展示时区单制）+ 类型徽（评测签派 P1-4：行业词为主中文为辅；TEMPO 带隐含概率）
      const head = el("div", "mw-taf-period-head");
      const dot = el("span", `mw-taf-dot mw-taf-dot-${tone}`, "●");
      dot.setAttribute("aria-hidden", "true");
      head.append(el("span", "mw-sr", toneWord[tone]));
      const chipText =
        row.kind === "PROB"
          ? t.probChip(row.overlay?.probability ?? 30, row.overlay?.withTempo === true)
          : row.kind === "BECMG"
            ? row.uncertain
              ? t.kindBecmgDuring
              : t.kindBecmgAfter
            : row.kind === "TEMPO"
              ? t.kindTempo
              : row.kind === "FM"
                ? t.kindFm
                : t.kindBase;
      const timeSpan = el("span", "mw-taf-period-time", segRangeOf(row.from, row.to));
      head.append(
        dot,
        timeSpan,
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
      /** 本行有解码载荷的条目（行头合并气泡用） */
      const rowDecoded: Array<{
        rows: Array<{ code: string; text: string }>;
        cites: TafCiteKey[];
      }> = [];
      for (const it of items) {
        const item = el("span", `mw-taf-item${it.full === true ? " mw-taf-item-full" : ""}`);
        if (it.label !== "") item.append(el("span", "mw-taf-item-label", it.label));
        item.append(document.createTextNode(it.text));
        // 组级联动注册：条目 ↔ 其值的来源组片（继承值溯源到基况/前变化组）；条目不入 Tab 序（行头代表段）
        if (it.key !== undefined) {
          const spans =
            it.key === "group"
              ? src?.span !== undefined
                ? [src.span]
                : []
              : originSpansOf(report, row.sourceIndex, it.key);
          if (spans.length > 0) {
            link.items.push({ el: item, spans });
            // 就地电码（owner 9/24 交互批）：该条目值对应的原文片段，浮签随行显出——
            // 对应关系在行内即可见，不再只靠卡底 RAW 区的高亮（滚动后常在视区外）
            item.dataset.code = spans.map((sp) => report.raw.slice(sp.start, sp.end)).join(" ");
          }
          // 解码气泡载荷（owner 9/24 统一批）：行值与分段行同源（过渡带＝组内所列、其余＝展示态合成），
          // 逐组/逐层成对「电码→人话」+ 依据键——点击条目时弹（见卡级 click 委托）
          const dRows = decodeRowsOf(it.key, row.uncertain ? src?.elements : shown, locale);
          if (dRows.length > 0) {
            const payload = {
              rows: dRows,
              cites: it.key !== "group" ? [it.key] : [],
            };
            itemDecode.set(item, payload);
            rowDecoded.push(payload);
          }
        }
        body.append(item);
      }
      if (row.uncertain)
        body.append(el("span", "mw-taf-period-note mw-taf-item-full", `（${t.uncertainNote}）`));
      else if (row.kind === "TEMPO" || row.overlay?.withTempo === true)
        body.append(el("span", "mw-taf-period-note mw-taf-item-full", `（${t.tempoNote}）`));
      li.append(head, body);
      // 行头电码浮签（评测 P1 键盘批）：行头代表段可聚焦，focus/悬停时浮签显该段展示态电码——
      // 键盘 Tab 即可看到电码（原 head.title 原生气泡键盘不可达，且与浮签同屏双气泡，退役）
      head.dataset.code = `${conditionsCodeOf(shown)}${row.overlay !== undefined && src !== undefined ? ` ｜ ${src.raw}` : ""}`;
      // 行头合并解码载荷（键盘 Enter/Space 开）：本行全部条目的解码行按序合并、依据键去重
      if (rowDecoded.length > 0) {
        headDecode.set(head, {
          rows: rowDecoded.flatMap((p) => p.rows),
          cites: [...new Set(rowDecoded.flatMap((p) => p.cites))],
        });
      }
      ol.append(li);
    }
    card.append(title, ol);
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
      tone?: "caution" | "danger";
    }
    const cuts: Cut[] = [];
    if (v.span !== undefined)
      cuts.push({
        start: v.span.start,
        end: v.span.end,
        rowIdx: null,
        key: "validity",
        hint: validityText,
      });
    const baseRowIdx = rows.findIndex((r) => r.kind === "base");
    const baseHint = baseRowIdx >= 0 ? (rowEls[baseRowIdx]?.textContent ?? "") : "";
    const pushCut = (
      sp: Span | undefined,
      rowIdx: number | null,
      key: string,
      hint: string,
      tone?: "caution" | "danger",
    ): void => {
      if (sp === undefined || sp.start >= sp.end) return;
      cuts.push({
        start: sp.start,
        end: sp.end,
        rowIdx,
        key,
        hint,
        ...(tone !== undefined ? { tone } : {}),
      });
    };
    // 基况逐要素（带档位：能见度/云层/天气组各按自家判据）
    pushCut(
      report.wind?.kind === "value" ? report.wind.value.speed.span : undefined,
      baseRowIdx,
      "wind",
      baseHint,
    );
    if (report.visibility?.kind === "value")
      pushCut(
        report.visibility.value.span,
        baseRowIdx,
        "vis",
        baseHint,
        visibilityTone(report.visibility.value) === "mw-danger"
          ? "danger"
          : visibilityTone(report.visibility.value) === "mw-caution"
            ? "caution"
            : undefined,
      );
    if (report.weather?.kind === "value")
      for (const g of report.weather.value)
        pushCut(
          g.span,
          baseRowIdx,
          "wx",
          baseHint,
          isDangerWeather(g) ? "danger" : isCautionWeather(g) ? "caution" : undefined,
        );
    pushCut(report.cavokSpan, baseRowIdx, "wx", baseHint);
    if (report.clouds !== undefined) {
      for (const layer of report.clouds.elements)
        pushCut(
          layer.span,
          baseRowIdx,
          "clouds",
          baseHint,
          cloudTone(layer) === "mw-danger"
            ? "danger"
            : cloudTone(layer) === "mw-caution"
              ? "caution"
              : undefined,
        );
      pushCut(report.clouds.clear?.span, baseRowIdx, "clouds", baseHint);
    }
    const rowIdxOfChange = new Map<number, number>();
    for (const [i, row] of rows.entries())
      if (row.sourceIndex !== undefined && !rowIdxOfChange.has(row.sourceIndex))
        rowIdxOfChange.set(row.sourceIndex, i);
    for (const [idx, change] of report.changes.entries()) {
      const ri = rowIdxOfChange.get(idx);
      if (ri === undefined || change.span === undefined) continue;
      const headHint = rowEls[ri]?.textContent ?? change.raw;
      const rowTone = segmentTone(
        rows[ri]?.overlay?.conditions ?? rows[ri]?.conditions ?? { weather: [], cavok: false },
      );
      pushCut(
        change.span,
        ri,
        "group",
        headHint,
        rowTone === "danger" ? "danger" : rowTone === "caution" ? "caution" : undefined,
      );
      const e = change.elements;
      pushCut(e?.wind !== undefined ? e.wind.speed.span : undefined, ri, "wind", headHint);
      if (e?.visibility !== undefined)
        pushCut(
          e.visibility.span,
          ri,
          "vis",
          headHint,
          visibilityTone(e.visibility) === "mw-danger"
            ? "danger"
            : visibilityTone(e.visibility) === "mw-caution"
              ? "caution"
              : undefined,
        );
      for (const g of e?.weather ?? [])
        pushCut(
          g.span,
          ri,
          "wx",
          headHint,
          isDangerWeather(g) ? "danger" : isCautionWeather(g) ? "caution" : undefined,
        );
      for (const layer of e?.clouds?.elements ?? [])
        pushCut(
          layer.span,
          ri,
          "clouds",
          headHint,
          cloudTone(layer) === "mw-danger"
            ? "danger"
            : cloudTone(layer) === "mw-caution"
              ? "caution"
              : undefined,
        );
      pushCut(e?.clouds?.clear?.span, ri, "clouds", headHint);
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
      const seg = el(
        "span",
        `mw-taf-rawseg${cut.tone === "danger" ? " mw-taf-rawseg-danger" : cut.tone === "caution" ? " mw-taf-rawseg-caution" : ""}`,
      ); // 文本由装配栈管理（防父组整段双写）
      seg.title = cut.hint; // 读屏读原文本身，不再 aria-label 覆盖
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
      pairHover(
        item.el,
        () =>
          link.cuts
            .filter((c) => item.spans.some((sp) => sp.start === c.start && sp.end === c.end))
            .map((c) => c.el),
        false, // 条目不入 Tab 序（复测工程 N3：行头代表段聚焦，Tab stop 减半）
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
    // RAW 区身份行（评测小白#11：原文区无标题=乱码彩蛋；提示联动通道存在）
    const rawTitle = el("p", "mw-taf-raw-title", t.rawTitle);
    rawTitle.append(el("span", "mw-taf-raw-hint", `　·　${t.rawHint}`));
    card.append(rawTitle, rawP);
  }

  card.append(el("p", "mw-taf-warn", t.warning));
  return card;
}
