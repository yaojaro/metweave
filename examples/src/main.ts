import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
// 主流程分两阶段：① 站点元数据（stations.json，静态可信）立即上图「待更新」态，杜绝空白地图；
// ② 实况到达后移除待更新层、渲染条件色实况层。取数（含解析与定位联表）→ 卡片上图（底图切换见 basemaps.ts）
import { parse, parseTaf, renderCard } from "metweave";
import { getMetarReports } from "metweave/sources";
import {
  addMetarLayer,
  addTafLayer,
  setTafLayerTime,
  tafTierOf,
  TIER_COLORS,
  type ConditionTier,
  type TafExpandAt,
  type TafLayerItem,
  type TafReport,
} from "@metweave/leaflet";
import type * as LeafletNS from "leaflet";
import stationsFile from "../stations.json";
import {
  TL_STEPS,
  contAtOf,
  dayHourMs,
  fmtTl,
  monthAnchorOf,
  reanchorOf,
  selectReport,
  sortTafPool,
  zonedDayHour,
  type CalendarAnchor,
} from "./timeline-core";
import { stationTitleOf } from "./zh-stations";
import { setupBasemap } from "./basemaps";
import "./style.css";

/** 档名字符串守卫（DOM 回读值收窄到 ConditionTier，免类型断言） */
const isTier = (x: string): x is ConditionTier =>
  x === "good" || x === "caution" || x === "poor" || x === "unknown";

const map = L.map("map", { center: [35.5, 105], zoom: 4 });
const hasBasemap = setupBasemap(map);

// 图例/面板色值单一来源（评测批2#3）：@metweave/leaflet 的 TIER_COLORS——与地图圆点同表取色，
// 图例项由 main.ts 启动时注入（index.html 不再内联色值，两套色系并存的根因收口）
const legendBox = document.getElementById("map-legend");
if (legendBox !== null) {
  for (const chip of Array.from(legendBox.querySelectorAll<HTMLElement>(".lg-item i"))) {
    const tier = chip.dataset.tier;
    if (tier !== undefined && isTier(tier)) chip.style.background = TIER_COLORS[tier];
  }
}

// 弹窗自动避让边（owner 9/24 指令：卡片不与固定悬浮层重叠）：autoPan 只认这两角留白——
// 顶部让开模式切换条（实测 bottom≈68）；底部让开免责声明栏+时间轴条+图例+状态条（时间轴批后合计≈140）
const POPUP_AUTOPAN = {
  autoPanPaddingTopLeft: L.point(12, 84),
  autoPanPaddingBottomRight: L.point(16, 150),
};

// —— 无 key 预览态（2026-09-15 五角色评测批）：底图缺席时不让首屏停留在「灰点+空底」，
// 就地渲染两份本地静态示例报文的真实卡片（本地解析、零请求，明确标注非实况）——
// 「如何配置 key」与「这个库产出什么」同时可见，第一印象不再只有一张空底图。
const mountPreviewCards = (): void => {
  const hint = document.getElementById("basemap-hint");
  if (hint === null) return;
  const samples = [
    "ZSPD 120330Z 04004MPS 9999 SCT033 27/18 Q1020 NOSIG",
    "METAR ZBAD 121300Z 34012G20MPS 0800 +TSRA BKN005 OVC010 16/14 Q1002",
  ];
  const box = document.createElement("div");
  box.className = "mw-demo-preview";
  const caption = document.createElement("p");
  caption.className = "mw-demo-preview-caption";
  caption.textContent = "示例报文的渲染效果（本地静态演示，非实况）：";
  box.append(caption);
  for (const raw of samples) box.append(renderCard(parse(raw), { raw: true }));
  hint.append(box);
};
if (!hasBasemap) mountPreviewCards();

// —— 全局时区单制（owner 9/24 指令：全页只显一个时间，UTC/北京时一键切换；缺省 UTC）——
// 卡片/滑杆/站点面板/状态条统一读此一处；480＝北京时（+8）
let tzOffset: number | null = null;
let metarItems: Awaited<ReturnType<typeof getMetarReports>> | undefined; // 时区切换重建实况层的数据面
/** 状态条时钟（单一时区、真实月历带月位）：UTC＝M月D日 HH:MM UTC；京＝北京时M月D日 HH:MM */
const zonedClock = (utc: Date): string => fmtTl(utc.getTime(), tzOffset).replace(/Z$/, " UTC");
let statusOk: (() => string) | undefined; // 最近一条 ok 状态的再渲染函数（时区切换时按新制重写）

const panel = document.getElementById("panel");
const show = (message: string): void => {
  if (panel === null) return;
  panel.textContent = message;
  panel.hidden = false;
};

const status = document.getElementById("status");
const statusText = document.getElementById("status-text");
const setStatus = (text: string, tone: "loading" | "ok" | "error"): void => {
  if (status === null || statusText === null) return;
  status.dataset.tone = tone;
  statusText.textContent = text;
  status.hidden = false;
  if (tone === "ok") {
    window.setTimeout(() => {
      status.hidden = true;
    }, 6000);
  }
};

// 弹窗内容走 DOM 构建（与渲染层同一纪律：不经 innerHTML 拼接）
const spinnerSpan = (): HTMLSpanElement => {
  const spinner = document.createElement("span");
  spinner.className = "mw-demo-spinner";
  spinner.setAttribute("aria-hidden", "true");
  return spinner;
};

const loadingContent = (icao: string, name: string): HTMLElement => {
  const box = document.createElement("div");
  box.className = "mw-demo-loading";
  const text = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = `${icao} ${name}`;
  const line = document.createElement("div");
  line.textContent = "实况获取中…";
  const note = document.createElement("small");
  note.textContent = "数据来自 IEM 公开通路，整网拉取通常需要 10–40 秒";
  text.append(title, line, note);
  box.append(spinnerSpan(), text);
  return box;
};

const failureContent = (icao: string, name: string): HTMLElement => {
  const box = document.createElement("div");
  box.className = "mw-demo-loading mw-demo-loading-error";
  const text = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = `${icao} ${name}`;
  const line = document.createElement("div");
  line.textContent = "实况获取失败，请稍后刷新重试";
  text.append(title, line);
  box.append(text);
  return box;
};

// —— 第一阶段：39 站立即上图。实况未到达时为灰色呼吸「待更新」态，悬停有站名、点击有拉取反馈
const pendingLayer = L.layerGroup().addTo(map);
const pendingByMarker = new Map<L.CircleMarker, { icao: string; name: string }>();
let openedIcao: string | null = null;

for (const s of stationsFile.stations) {
  const zhName = stationTitleOf(s.icao, s.name); // 中文在前（批2#5：ZWSH 对小白毫无意义）
  const marker = L.circleMarker([s.lat, s.lon], {
    radius: 5,
    color: "#64748b",
    weight: 1,
    fillColor: "#94a3b8",
    fillOpacity: 0.55,
    className: "mw-demo-pending",
  }).bindTooltip(`${s.icao} ${zhName} · 实况获取中`);
  marker.bindPopup(loadingContent(s.icao, zhName), { maxWidth: 420 });
  marker.on("popupopen", () => {
    openedIcao = s.icao;
  });
  pendingByMarker.set(marker, { icao: s.icao, name: zhName });
  pendingLayer.addLayer(marker);
}

setStatus(
  `正在拉取 ${stationsFile.stations.length} 站实况（IEM 公开通路，通常 10–40 秒）…`,
  "loading",
);

// —— 第二阶段：实况到达。移除待更新层、渲染实况层；等待期间点开的弹窗原地升级为实况卡片
const report = async (): Promise<void> => {
  // stations.json（由 aviationweather.gov 站点元数据一次性生成）＝运行时定位权威源：精确坐标与站名经 icao 联表，
  // IEM 自带的中国站城市级粗坐标仅在未命中时兜底。
  // 个别站报文解析失败不拖垮整图：逐行容错（onUnparseable 可观测），面板摘要提示跳过数
  const skipped: string[] = [];
  const items = await getMetarReports("CN__ASOS", {
    stations: stationsFile.stations,
    onUnparseable: (failure) => skipped.push(failure.station),
    timeoutMs: 60_000, // 批3#9：上游挂死不再无界等待（超时报错走 sources 权威中文文案）
  });
  map.removeLayer(pendingLayer);
  // 站名中文化（批2#5）：卡片标题/tooltip/marker 名统一「ICAO 中文（英文）」——原始 items 留作数据面
  const zhItems = items.map((it) => ({
    ...it,
    title: `${it.report.station} ${stationTitleOf(it.report.station, it.title.slice(it.report.station.length + 1))}`,
  }));
  metarItems = zhItems; // 时区切换 / 模式回切重建实况层的数据面
  const group = await addMetarLayer(map, zhItems, {
    card: { raw: true, utcOffsetMinutes: tzOffset },
    conditionColors: true,
    popupOptions: POPUP_AUTOPAN,
  });
  metarLayer = group;
  const updated = new Date();
  statusOk = () =>
    `已更新 ${items.length} 站 · ${zonedClock(updated)}${skipped.length > 0 ? ` · ${skipped.length} 站跳过` : ""}`;
  setStatus(statusOk(), "ok");
  if (skipped.length > 0) {
    show(
      `${skipped.length} 站解析失败已跳过（${skipped.slice(0, 5).join("、")}${skipped.length > 5 ? " 等" : ""}）`,
    );
  }
  if (openedIcao !== null) {
    const target = items.find((item) => item.report.station === openedIcao);
    if (target === undefined) {
      show(`${openedIcao} 实况暂缺（该站解析失败或本次未返回）`);
      return;
    }
    group.eachLayer((layer) => {
      if (!(layer instanceof L.Marker)) return;
      const content = layer.getPopup()?.getContent();
      const card = content instanceof HTMLElement ? content : undefined;
      if (card?.querySelector("h2 span")?.textContent === openedIcao) layer.openPopup();
    });
  }
};

report().catch((err: unknown) => {
  const reason = err instanceof Error ? err.message : String(err);
  setStatus(`实况拉取失败：${reason}`, "error");
  show(`数据拉取失败：${reason}`);
  // 待更新弹窗同步改失败态，避免停留在「获取中」的假象
  pendingByMarker.forEach(({ icao, name }, marker) => {
    marker.setPopupContent(failureContent(icao, name));
  });
});

// —— TAF 预报模式（v0.2 渲染层演示）：拉 aviationweather 公开通路 39 站最新 TAF 原文，
// 本地 parseTaf 解析 → addTafLayer 预报当观测渲 + 时间滑杆全图换时刻（层①③；弹窗卡片为层②）
const modeBar = {
  metar: document.getElementById("mode-metar"),
  taf: document.getElementById("mode-taf"),
  list: document.getElementById("mode-list"),
  panel: document.getElementById("taf-panel"),
  panelTitle: document.getElementById("taf-panel-title"),
  panelBody: document.getElementById("taf-panel-body"),
};
// TAF 时间轴条（owner 9/24 窄条批）：提示栏上方一条窄轴——播放键 + 现在 + 带刻度滑道 + 当前时刻；
// 点刻度/拖动跳时刻（手动介入即停播），播放自动按 10 分钟步进扫过 24 小时（到尾循环）
const timelineBar = document.getElementById("taf-timeline");
/** 按类型守卫取 input（禁 as 断言）：非 input 元素返回 null，调用点各自判空 */
const inputById = (id: string): HTMLInputElement | null => {
  const el = document.getElementById(id);
  return el instanceof HTMLInputElement ? el : null;
};
const tlInput = inputById("tl-input");
const tlValue = document.getElementById("tl-value");
const tlTicksBox = document.getElementById("tl-ticks");
const tlPlayBtn = document.getElementById("tl-play");
// —— 时间轴状态与驱动（2026-09-24 评测 P1 月界批：真实毫秒序，跨月不回绕）——
// 旧实现把日号折成 (day-1)*1440 绝对分钟序，跨月 to<from → 滑杆 max 为负、刻度循环恒假、播放停 0；
// 现全链毫秒序（Date 真月历），TafExpandAt 的 day 为「自层锚月 1 日起的连续日序」（与
// @metweave/leaflet calendarAnchor 归一协议对接——层内逐报归一到各自锚月）。
let layerCal: CalendarAnchor | undefined; // 层锚月（loadTaf 时定格）
let tlAnchorMs: number | undefined; // 窗零点（「现在」向下取整 10 分钟；initTimeline 定格）
let curAt: TafExpandAt | undefined; // 当前查看时刻（连续序；面板档位数据直读用——批3#14）
let tlPlaying = false;
let tlTimer: number | undefined;
/** 格 → 查看时刻毫秒 */
const tlMsOf = (index: number): number => {
  if (tlAnchorMs === undefined) return 0;
  return tlAnchorMs + index * 600_000;
};
/** 查看时刻的连续序 TafExpandAt（层锚月基；层锚在位前的建层初值直接用日号） */
const tlAtOfMs = (ms: number): TafExpandAt =>
  layerCal === undefined
    ? {
        day: new Date(ms).getUTCDate(),
        hour: new Date(ms).getUTCHours(),
        minute: new Date(ms).getUTCMinutes(),
      }
    : contAtOf(ms, layerCal);
const tlSetPlayBtn = (): void => {
  if (tlPlayBtn === null) return;
  tlPlayBtn.textContent = tlPlaying ? "❚❚" : "▶";
  tlPlayBtn.setAttribute("aria-pressed", String(tlPlaying));
  tlPlayBtn.setAttribute("aria-label", tlPlaying ? "暂停播放" : "播放：自动扫过未来 24 小时");
};
const tlStopPlay = (): void => {
  if (!tlPlaying) return;
  tlPlaying = false;
  window.clearInterval(tlTimer);
  tlTimer = undefined;
  tlSetPlayBtn();
};
/** 落格并全图重渲：label/aria 即时更新，走 setTafLayerTime（滑杆换时刻持续以当前时区刷新）；
 *  先按查看时刻原位换在效报文（方案B——item.report 与图层 WeakMap 共享同一对象，setTafLayerTime 现读重渲；
 *  换报同步更新 item.monthAnchor（新月报的真实锚月，跨 00Z 边界的 10 月报归一到 10 月锚）；
 *  「现在」锚漂移重锚（批3#13）：真实时刻越过窗尾或漂移超 30 分钟时重算窗、保当前查看时刻格位 */
const tlApply = (rawIndex: number): void => {
  if (tlAnchorMs === undefined || tafLayer === undefined || tafItems === undefined) return;
  const nextAnchor = reanchorOf(tlAnchorMs, Date.now());
  if (nextAnchor !== undefined) {
    tlAnchorMs = nextAnchor;
    tlBuildTicks(); // 刻度随新窗重画；格位＝相对新「现在」的偏移保持（index 不动，观看不被打断）
  }
  const index = rawIndex;
  if (tlInput !== null) tlInput.value = String(index);
  const tMs = tlMsOf(index);
  const at = tlAtOfMs(tMs);
  curAt = at; // 面板数据直读的当前查看时刻（批3#14：不再从 marker DOM className 回读档位）
  const nowMs = Date.now();
  if (reportsByStation.size > 0) {
    for (const it of tafItems) {
      const sel = selectReport(reportsByStation.get(it.report.station), tMs, nowMs);
      if (sel !== undefined && sel !== it.report) {
        it.report = sel;
        it.monthAnchor = monthAnchorOf(sel, nowMs);
      }
    }
  }
  const text = fmtTl(tMs, tzOffset);
  if (tlValue !== null) tlValue.textContent = text;
  tlInput?.setAttribute("aria-valuetext", text); // 读屏不朗读裸格值
  void setTafLayerTime(map, tafLayer, tafItems, {
    at,
    ...(layerCal === undefined ? {} : { calendarAnchor: layerCal }),
    card: { utcOffsetMinutes: tzOffset },
  }).then(() => window.setTimeout(() => refreshPanel?.(), 60)); // 等原地更新图标落地后刷新列表
};
/** 刻度线（叠滑道、pointer-events 放行点击，毫秒序判整点/日界——真实月历跨月正确）：
 *  整点小刻度 / 3 小时主刻度 / 展示时区日界高刻度 */
const tlBuildTicks = (): void => {
  if (tlTicksBox === null || tlAnchorMs === undefined) return;
  tlTicksBox.replaceChildren();
  for (let i = 0; i <= TL_STEPS; i += 1) {
    const ms = tlAnchorMs + i * 600_000;
    if (ms % 3_600_000 !== 0 && i !== 0 && i !== TL_STEPS) continue; // 非整点只保留两端
    const zoneMs = ms + (tzOffset ?? 0) * 60_000;
    const tick = document.createElement("i");
    tick.className = zoneMs % 86_400_000 === 0 ? "day" : i % 18 === 0 ? "major" : "minor"; // 日界＞主刻度＞小刻度
    tick.style.left = `${((i / TL_STEPS) * 100).toFixed(3)}%`;
    tlTicksBox.append(tick);
  }
};
/** TAF 载入后初始化时间轴：定格层锚月与窗零点（现在取整 10 分钟 + 24h）、画刻度、默认落「现在」 */
const initTimeline = (): void => {
  const nowMs = Date.now();
  const d = new Date(nowMs);
  layerCal = { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
  tlAnchorMs = Math.floor(nowMs / 600_000) * 600_000;
  if (tlInput !== null) tlInput.max = String(TL_STEPS);
  tlBuildTicks();
  tlApply(0);
};
tlPlayBtn?.addEventListener("click", () => {
  if (tlPlaying) {
    tlStopPlay();
    return;
  }
  if (tlAnchorMs === undefined) return;
  tlPlaying = true;
  tlSetPlayBtn();
  tlTimer = window.setInterval(() => {
    if (tlAnchorMs === undefined || tlInput === null) {
      tlStopPlay();
      return;
    }
    const cur = Number(tlInput.value);
    tlApply(cur >= TL_STEPS ? 0 : cur + 1); // 到尾循环回「现在」
  }, 300); // ~3 格/秒：24 小时约 50 秒扫完一轮
});
let tlRafPending = false;
tlInput?.addEventListener("input", () => {
  tlStopPlay(); // 手动介入即停播
  if (tlRafPending) return; // rAF 合帧：拖动高频 input 每帧至多一次全图更新
  tlRafPending = true;
  requestAnimationFrame(() => {
    tlRafPending = false;
    tlApply(Number(tlInput?.value ?? 0));
  });
});
let metarLayer: LeafletNS.LayerGroup | undefined;
let tafLayer: LeafletNS.LayerGroup | undefined;
let tafItems: readonly TafLayerItem[] | undefined;
let listOpen = false;
let panelOrder: string[] | undefined; // 播放期间冻结的面板行序（批3#12：停播后下次刷新恢复档位排序）
let refreshPanel: (() => void) | undefined; // TAF 载入后由 loadTaf 赋值（列表渲染入口，面板开关直呼）
let pendingFlyOpen: (() => void) | undefined; // 行点击「先飞后开卡」的在途回调（换行连点时解绑防开错站）

// —— TAF 报池（owner 9/24 方案B：现在永远有在效报）——
// 最新周期 + 上一周期（date=now-4h 取「该时刻已发布的最新报」）合并进按站报池；
// 查看时刻落在最新报生效前（发布后 2–3 小时的空档）时自动用仍在效的上一份补位。
// 排序/选择的纯函数内核在 timeline-core（真实月历毫秒序——月界批收口，跨月不再 %31 折回）
const reportsByStation = new Map<string, TafReport[]>();

const setMode = (mode: "metar" | "taf"): void => {
  const active = mode === "taf";
  modeBar.metar?.classList.toggle("active", !active);
  modeBar.taf?.classList.toggle("active", active);
  modeBar.metar?.setAttribute("aria-pressed", String(!active));
  modeBar.taf?.setAttribute("aria-pressed", String(active));
  if (timelineBar !== null) timelineBar.hidden = !active;
  if (modeBar.list !== null) modeBar.list.hidden = !active;
  if (!active) {
    setListOpen(false);
    tlStopPlay(); // 批3#8：切回实况停播——否则播放循环每 300ms 对已摘除图层的 39 marker 空转
  }
};

/** 站点列表开关（评测签派 P2-7：38 站扫读列表态） */
const setListOpen = (open: boolean): void => {
  listOpen = open;
  modeBar.list?.classList.toggle("active", open);
  modeBar.list?.setAttribute("aria-pressed", String(open));
  if (modeBar.panel !== null) modeBar.panel.hidden = !open;
};

let tafLoading: Promise<void> | undefined; // 防重入（评测工程 P2-4：连点不重复拉取）

const loadTaf = async (): Promise<void> => {
  if (tafLayer !== undefined && tafItems !== undefined) {
    // 已加载过：直接换层
    if (metarLayer !== undefined) map.removeLayer(metarLayer);
    map.addLayer(tafLayer);
    setMode("taf");
    return;
  }
  if (tafLoading !== undefined) return tafLoading; // 拉取中：复用在飞请求
  tafLoading = (async () => {
    setStatus("正在拉取 39 站 TAF 预报（aviationweather 公开通路）…", "loading");
    const ids = stationsFile.stations.map((s) => s.icao).join(",");
    // 超时 20s（评测工程 P2-4：上游挂死不再无界等待）；错误分层在 catch 判别。
    // 上一周期并行拉取（owner 9/24 方案B）：上游 api/data/taf 不支持 hours，date 参数＝「该时刻已发布的最新报」
    // ——date=now-4h 取上一发布周期，与最新周期合并成报池、按查看时刻选在效报；属增强取数，失败静默降级
    const base = `/aw-taf?ids=${ids}&format=raw`;
    const prevTextPromise: Promise<string> = fetch(
      `${base}&date=${new Date(Date.now() - 4 * 3_600_000).toISOString()}`,
      { signal: AbortSignal.timeout(20_000) },
    )
      .then((r) => (r.ok ? r.text() : ""))
      .catch(() => "");
    let res: Response;
    try {
      res = await fetch(base, { signal: AbortSignal.timeout(20_000) }); // 走 vite 代理（见 vite.config.ts——上游无 CORS 头）
    } catch (err) {
      const timedOut = err instanceof DOMException && err.name === "TimeoutError";
      throw timedOut
        ? new Error("拉取超时（20 秒），请稍后重试")
        : new Error("网络请求失败，请检查网络后重试");
    }
    if (!res.ok) throw new Error(`上游返回异常状态 ${res.status}，请稍后重试`);
    const text = (await res.text()) + "\n" + (await prevTextPromise);
    const byIcao = new Map(stationsFile.stations.map((s) => [s.icao, s]));
    let failed = 0;
    // aviationweather raw 格式：新报行从行首起，续行以空白缩进续接——先归并再解析；
    // 两代周期合并进按站报池（raw 去重、生效起点升序——同起点晚发布者在后）
    const reports: string[] = [];
    for (const line of text.split("\n")) {
      if (line.trim() === "") continue;
      if (/^\s/.test(line) && reports.length > 0) reports[reports.length - 1] += ` ${line.trim()}`;
      else reports.push(line.trim());
    }
    const seen = new Set<string>();
    for (const raw of reports) {
      try {
        const taf = parseTaf(raw);
        if (byIcao.get(taf.station) === undefined || seen.has(taf.raw)) continue;
        seen.add(taf.raw);
        const pool = reportsByStation.get(taf.station) ?? [];
        pool.push(taf);
        reportsByStation.set(taf.station, pool);
      } catch {
        failed += 1;
      }
    }
    const nowMs = Date.now();
    for (const pool of reportsByStation.values()) sortTafPool(pool, nowMs);
    // 初始即取「现在」的在效报——首屏不再整片灰「未生效」（owner 9/24 方案B 的直接目的）；
    // 每报附真实锚月（item.monthAnchor——leaflet 层内归一到各报锚月，跨月报池正确）
    const nowFloorMs = Math.floor(nowMs / 600_000) * 600_000;
    const items: TafLayerItem[] = [];
    for (const s of stationsFile.stations) {
      const r = selectReport(reportsByStation.get(s.icao), nowFloorMs, nowMs);
      if (r !== undefined)
        items.push({
          report: r,
          position: [s.lat, s.lon],
          title: `${s.icao} ${stationTitleOf(s.icao, s.name)}`,
          monthAnchor: monthAnchorOf(r, nowMs),
        });
    }
    if (items.length === 0) throw new Error("上游返回的报文全部解析失败（数据异常），请稍后重试");
    tafItems = items;
    tafLayer = await addTafLayer(map, items, {
      popupOptions: POPUP_AUTOPAN,
      card: { utcOffsetMinutes: tzOffset },
    });
    if (metarLayer !== undefined) map.removeLayer(metarLayer);
    else map.removeLayer(pendingLayer);
    // 站点列表（档色点＋下一变化；滑杆换时刻即刷新；行点击飞行并开卡——评测签派 P2-7）
    const TIER_ORDER: Record<ConditionTier, number> = { poor: 0, caution: 1, good: 2, unknown: 3 };
    const CHANGE_WORD: Record<string, string> = {
      FM: "自此",
      BECMG: "渐变",
      TEMPO: "间歇",
      PROB: "概率",
    };
    const renderPanel = (): void => {
      refreshPanel = renderPanel; // 定义即登记（首跑可能在面板未开时早退，登记不得依赖渲染路径）
      if (!listOpen || tafLayer === undefined || tafItems === undefined) return;
      const body = modeBar.panelBody;
      if (body === null) return;
      body.replaceChildren();
      // 批3#14：档位数据直读——tafTierOf 与圆点同一判据管线（含 TEMPO 升档/出窗灰），
      // 不再从 marker DOM className 正则回读（状态经渲染产物回流的工程债收口），DOM 只做展示
      const atNow = curAt ?? tlAtOfMs(Math.floor(Date.now() / 600_000) * 600_000);
      const tierOpts: Parameters<typeof tafTierOf>[2] =
        layerCal === undefined ? {} : { calendarAnchor: layerCal };
      const rowsData = tafItems.map((it) => {
        const tier: ConditionTier = tafTierOf(it, atNow, tierOpts);
        const ch = it.report.changes[0];
        // 人话化窗口（复测小白#1/#面板 + 月界批真实月历 + 批4 前缀降噪）：ddHH/ddHH →
        // 当前时区单制「M月D日HH时–HH时」（同日尾端只显小时，「北京时」前缀首处保留）
        const nowMsPanel = Date.now();
        const win = ch?.window;
        const winText =
          win !== undefined && /^(\d{2})(\d{2})\/(\d{2})(\d{2})$/.test(win.raw)
            ? (() => {
                const m = /^(\d{2})(\d{2})\/(\d{2})(\d{2})$/.exec(win.raw);
                if (m === null) return win.raw;
                const [, d1, h1, d2, h2] = m;
                const tag = tzOffset === null ? "" : "北京时";
                const aFull = zonedDayHour(Number(d1), Number(h1), tzOffset, nowMsPanel);
                const bZ = new Date(
                  dayHourMs(Number(d2), Number(h2), 0, nowMsPanel) + (tzOffset ?? 0) * 60_000,
                );
                const bDay = `${bZ.getUTCMonth() + 1}月${bZ.getUTCDate()}日`;
                const bHm = `${String(bZ.getUTCHours()).padStart(2, "0")}时`;
                return aFull.slice(0, -3) === bDay
                  ? `${tag}${aFull}–${bHm}`
                  : `${tag}${aFull}–${bDay}${bHm}`;
              })()
            : ch?.at !== undefined
              ? `${String(ch.at.hour).padStart(2, "0")}:${String(ch.at.minute).padStart(2, "0")}Z`
              : undefined;
        const next =
          ch !== undefined ? `${CHANGE_WORD[ch.kind] ?? ch.kind} ${winText ?? ""}`.trim() : "—";
        return { it, tier, next };
      });
      // 批3#12：播放期间冻结行序（每 300ms 全量重建时行序随档位跳动——眼睛跟不上）；
      // 停播后下一次刷新恢复按档位排序（panelOrder 同时更新为最新序）
      const frozen = tlPlaying ? panelOrder : undefined;
      if (frozen !== undefined) {
        rowsData.sort(
          (a, b) => frozen.indexOf(a.it.report.station) - frozen.indexOf(b.it.report.station),
        );
      } else {
        rowsData.sort(
          (a, b) =>
            TIER_ORDER[a.tier] - TIER_ORDER[b.tier] ||
            a.it.report.station.localeCompare(b.it.report.station),
        );
        panelOrder = rowsData.map((r) => r.it.report.station);
      }
      const markers = tafLayer.getLayers(); // 行点击「先飞后开卡」用（档位已数据直读，DOM 仅展示）
      const colors = TIER_COLORS; // 批2#3：面板色点与地图圆点同一张表（两套色系的根因收口）
      for (const r of rowsData) {
        const tr = document.createElement("tr");
        tr.tabIndex = 0;
        const tdDot = document.createElement("td");
        const dot = document.createElement("span");
        dot.className = "p-dot";
        dot.style.background = colors[r.tier] ?? colors.unknown;
        tdDot.append(dot);
        const tdName = document.createElement("td");
        const code = document.createElement("span");
        code.className = "p-code";
        code.textContent = r.it.report.station;
        const name = document.createElement("span");
        name.className = "p-name";
        name.textContent = (r.it.title ?? r.it.report.station).slice(
          r.it.report.station.length + 1,
        );
        tdName.append(code, name);
        const tdNext = document.createElement("td");
        tdNext.className = "p-next";
        tdNext.textContent = r.next;
        tr.append(tdDot, tdName, tdNext);
        const fly = (): void => {
          const idx = tafItems?.findIndex((x) => x.report.station === r.it.report.station) ?? -1;
          const found = markers[idx];
          if (!(found instanceof L.Marker)) return;
          const marker = found;
          // 先飞到位再开卡：飞行中开弹窗＝autoPan 按中间帧算避让、动画随后把地图带走，
          // 限高后的卡仍会被推出视口/压住固定悬浮层（owner 9/24 版式批实测）。
          // 换行连点时先解绑上一行未触发的开卡回调，防陈旧回调开错站（Leaflet once 存原 fn 引用，off 可解）
          if (pendingFlyOpen !== undefined) {
            map.off("moveend", pendingFlyOpen);
            pendingFlyOpen = undefined;
          }
          // 已在目标视图则 flyTo 无位移、moveend 未必发——直接开卡
          if (map.getZoom() === 6 && map.getCenter().distanceTo(L.latLng(r.it.position)) < 1) {
            if (!marker.isPopupOpen()) marker.openPopup();
            return;
          }
          const open = (): void => {
            if (pendingFlyOpen === open) pendingFlyOpen = undefined;
            if (!marker.isPopupOpen()) marker.openPopup();
          };
          pendingFlyOpen = open;
          map.flyTo(r.it.position, 6);
          map.once("moveend", open);
        };
        tr.addEventListener("click", fly);
        tr.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") fly();
        });
        body.append(tr);
      }
      if (modeBar.panelTitle !== null) {
        modeBar.panelTitle.textContent = `站点预报 · ${rowsData.length} 站（按当前时刻状态排序）`;
        const legend = document.createElement("span");
        legend.className = "p-legend";
        const legendItems: Array<[ConditionTier, string]> = [
          ["poor", "差"],
          ["caution", "注意"],
          ["good", "良好"],
          ["unknown", "无数据"],
        ];
        for (const [key, word] of legendItems) {
          const chip = document.createElement("span");
          chip.className = "p-legend-item";
          const dot = document.createElement("span");
          dot.className = "p-dot";
          dot.style.background = colors[key] ?? colors.unknown;
          chip.append(dot, document.createTextNode(word));
          legend.append(chip);
        }
        modeBar.panelTitle.append(legend);
      }
    };
    // 时间轴（owner 9/24 窄条批）：现在起 24h、10 分钟一格、默认锚「现在」；初始化后拖/点/播都走 tlApply
    initTimeline();
    setMode("taf");
    renderPanel();
    statusOk = () =>
      `TAF 预报已上图：${items.length} 站${failed > 0 ? ` · ${failed} 条解析跳过` : ""} · 下方时间轴可拖动/播放换时刻`;
    setStatus(statusOk(), "ok");
  })();
  try {
    await tafLoading;
  } finally {
    tafLoading = undefined;
  }
};

modeBar.taf?.addEventListener("click", () => {
  loadTaf().catch((err: unknown) => {
    const reason = err instanceof Error ? err.message : String(err);
    setStatus(`TAF 拉取失败：${reason}`, "error");
    setMode("metar");
  });
});
/** 实况层回挂：在场即挂回；被时区切换弃置则按当前时区重建（卡片在建层时渲染，换区必重建） */
const ensureMetarLayer = async (): Promise<void> => {
  if (metarLayer !== undefined) {
    map.addLayer(metarLayer);
    return;
  }
  if (metarItems === undefined) return; // 实况未到达（第一阶段待更新态不动）
  metarLayer = await addMetarLayer(map, metarItems, {
    card: { raw: true, utcOffsetMinutes: tzOffset },
    conditionColors: true,
    popupOptions: POPUP_AUTOPAN,
  });
};
modeBar.metar?.addEventListener("click", () => {
  if (tafLayer !== undefined) map.removeLayer(tafLayer);
  void ensureMetarLayer();
  setMode("metar");
});
modeBar.list?.addEventListener("click", () => {
  setListOpen(!listOpen);
  if (listOpen) refreshPanel?.(); // 首开即渲染（此后滑杆换时刻经 onTime 自动刷新）
});

// —— 时区单制切换（owner 9/24：一个按钮控全页时间；缺省 UTC）——
const tzBtn = document.getElementById("tz-btn");
tzBtn?.addEventListener("click", () => {
  tzOffset = tzOffset === null ? 480 : null;
  const bj = tzOffset !== null;
  tzBtn.textContent = bj ? "北京时" : "UTC";
  tzBtn.setAttribute("aria-pressed", String(bj));
  tzBtn.title = bj ? "当前显示北京时，点击切回 UTC" : "当前显示 UTC，点击切换为北京时";
  // 实况层：卡片建层时定版——在场重建（随层关闭已开弹窗，重点即新时区）；不在场（TAF 模式中）弃置，回切时按新区重建
  if (metarItems !== undefined) {
    if (metarLayer !== undefined && map.hasLayer(metarLayer)) {
      map.removeLayer(metarLayer);
      metarLayer = undefined;
      void ensureMetarLayer();
    } else {
      metarLayer = undefined;
    }
  }
  // 预报层：不重建——可变 card 覆盖经 setTafLayerTime 即时生效（已开弹窗原地换时区，图标/列表不受影响）；
  // 时间轴不重建：刻度线按新制重画、当前格标签按新制重写（格位不动，手动位置天然保留）
  if (tafLayer !== undefined && tafItems !== undefined) {
    void setTafLayerTime(map, tafLayer, tafItems, { card: { utcOffsetMinutes: tzOffset } }).then(
      () => {
        tlBuildTicks();
        tlApply(Number(tlInput?.value ?? 0));
      },
    );
  }
  refreshPanel?.(); // 面板「下一变化」按新区重算
  if (statusOk !== undefined) setStatus(statusOk(), "ok"); // 状态条时钟按新区重写（顺带确认切换生效）
});

// 实况层完成后留存引用，供模式切换（原 addMetarLayer 调用点捕获返回值）
