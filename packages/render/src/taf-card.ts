/**
 * @metweave/render — TAF 预报卡片：TafReport IR → 自包含 DOM 组件（v0.2 渲染层②）。
 *
 * 结构：头行（站名 + TAF 徽章 + AMD/COR/NIL/CNL 标志）→ 元信息（有效期 + 时长 / 发布时刻）→
 * **时间线条**（有效期横条按分钟比例分段：BECMG 过渡渐变、TEMPO 间歇斜纹、PROB 概率浅叠、
 * FM 硬竖线、TX/TN 极值标记）→ 变化组清单 → 气温组行 → 可选 RAW 对照。
 * 与 card.ts 同纪律：纯 DOM 构建（createElement/textContent，无 innerHTML 注入面）、
 * 样式随组件注入（STYLE_ID 单次）、双语文案集中一张 locale 表、宿主 className 可叠加。
 * 预报警示：档位/摘要是扫视辅助，不得用作运行判据（沿 METAR 卡口径）。
 */
import type { TafChangeGroup, TafReport, TafTemperatureGroup } from "@metweave/core";

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
.mw-taf-changes { margin: 4px 0 0; padding: 0; list-style: none; font-size: 12px; }
.mw-taf-changes li { margin: 1px 0; }
.mw-taf-raw { margin-top: 6px; font-family: ui-monospace, monospace; font-size: 11px;
  color: #4a5560; word-break: break-all; }
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

/** 变化组一行摘要：变化词 + 窗/时刻 + 所列要素紧凑串 */
type LocaleTable = (typeof LOCALE)[keyof typeof LOCALE];
const changeLine = (c: TafChangeGroup, t: LocaleTable): string => {
  const head =
    c.kind === "PROB"
      ? `${c.probability !== undefined ? t.prob(c.probability) : "PROB"}${c.withTempo ? " TEMPO" : ""}`
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
  if (e?.wind !== undefined) {
    const dir = e.wind.variable ? "VRB" : String(e.wind.direction ?? "///").padStart(3, "0");
    parts.push(
      `${dir}${String(e.wind.speed.value).padStart(2, "0")}${e.wind.speed.unit === "mps" ? "MPS" : e.wind.speed.unit === "kt" ? "KT" : "KMH"}${e.wind.gust !== undefined ? `G${e.wind.gust.value}` : ""}`,
    );
  }
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

  // 变化组清单（含要素紧凑摘要，title 同款）
  if (report.changes.length > 0) {
    const ul = el("ul", "mw-taf-changes");
    for (const c of report.changes) {
      const li = el("li");
      li.append(document.createTextNode(changeLine(c, t)));
      ul.append(li);
    }
    card.append(ul);
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
