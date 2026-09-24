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
  type TafExpandAt,
  type TafLayerItem,
} from "@metweave/leaflet";
import type * as LeafletNS from "leaflet";
import stationsFile from "../stations.json";
import { setupBasemap } from "./basemaps";
import "./style.css";

const map = L.map("map", { center: [35.5, 105], zoom: 4 });
const hasBasemap = setupBasemap(map);

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
/** dd/hh → 当前时区整点词：UTC＝dd日HH时；京时＝京dd日HH时（+8，日回绕 31 折回——面板「下一变化」用） */
const hourWordOf = (d: number, h: number): { d: number; h: number } => {
  if (tzOffset === null) return { d, h };
  const total = (d - 1) * 1440 + h * 60 + tzOffset;
  return { d: (Math.floor(total / 1440) % 31) + 1, h: Math.floor((total % 1440) / 60) };
};

if (!hasBasemap) mountPreviewCards();

// —— 全局时区单制（owner 9/24 指令：全页只显一个时间，UTC/北京时一键切换；缺省 UTC）——
// 卡片/滑杆/站点面板/状态条统一读此一处；480＝北京时（+8）
let tzOffset: number | null = null;
let metarItems: Awaited<ReturnType<typeof getMetarReports>> | undefined; // 时区切换重建实况层的数据面
/** 状态条时钟（单一时区）：UTC＝HH:MM UTC；京时＝京HH:MM（仅换显示，时刻本身仍 UTC 基准） */
const zonedClock = (utc: Date): string =>
  tzOffset === null
    ? `${utc.toISOString().slice(11, 16)} UTC`
    : `京${new Date(utc.getTime() + tzOffset * 60000).toISOString().slice(11, 16)}`;
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
  const marker = L.circleMarker([s.lat, s.lon], {
    radius: 5,
    color: "#64748b",
    weight: 1,
    fillColor: "#94a3b8",
    fillOpacity: 0.55,
    className: "mw-demo-pending",
  }).bindTooltip(`${s.icao} ${s.name} · 实况获取中`);
  marker.bindPopup(loadingContent(s.icao, s.name), { maxWidth: 420 });
  marker.on("popupopen", () => {
    openedIcao = s.icao;
  });
  pendingByMarker.set(marker, { icao: s.icao, name: s.name });
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
  });
  map.removeLayer(pendingLayer);
  metarItems = items; // 时区切换 / 模式回切重建实况层的数据面
  const group = await addMetarLayer(map, items, {
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
const tlInput = document.getElementById("tl-input") as HTMLInputElement | null;
const tlValue = document.getElementById("tl-value");
const tlTicksBox = document.getElementById("tl-ticks");
const tlPlayBtn = document.getElementById("tl-play");
/** 时间轴窗：零点＝当前时刻向下取整到 10 分钟刻度，跨度 24 小时（owner 定口径；默认锚「现在」） */
const timelineWindow = (): { from: TafExpandAt; to: TafExpandAt } => {
  const floor = new Date(Math.floor(Date.now() / 600_000) * 600_000);
  const end = new Date(floor.getTime() + 86_400_000);
  const atOf = (d: Date): TafExpandAt => ({
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  });
  return { from: atOf(floor), to: atOf(end) };
};
// —— 时间轴状态与驱动（10 分钟一格；apply 与图层 setTafLayerTime 同路，拖/点/播全图重渲级别）——
const tlAbsOf = (at: TafExpandAt): number => (at.day - 1) * 1440 + at.hour * 60 + at.minute;
const tlAtOf = (abs: number): TafExpandAt => ({
  day: Math.floor(abs / 1440) + 1,
  hour: Math.floor((abs % 1440) / 60),
  minute: abs % 60,
});
const tlPad = (n: number): string => String(n).padStart(2, "0");
/** 时刻文本（随时区单制）：UTC＝dd日 HH:MMZ；京＝京dd日HH:MM（日回绕 31 折回） */
const tlFmt = (at: TafExpandAt): string => {
  if (tzOffset === null) return `${tlPad(at.day)}日 ${tlPad(at.hour)}:${tlPad(at.minute)}Z`;
  const z = tlAtOf(tlAbsOf(at) + tzOffset);
  return `京${tlPad(((z.day - 1) % 31) + 1)}日${tlPad(z.hour)}:${tlPad(z.minute)}`;
};
let tlSpan: { from: number; to: number } | undefined; // 绝对分钟序窗（from＝现在取整 10 分钟）
let tlPlaying = false;
let tlTimer: number | undefined;
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
/** 落格并全图重渲：label/aria 即时更新，走 setTafLayerTime（滑杆换时刻持续以当前时区刷新） */
const tlApply = (index: number): void => {
  if (tlSpan === undefined || tafLayer === undefined || tafItems === undefined) return;
  if (tlInput !== null) tlInput.value = String(index);
  const at = tlAtOf(tlSpan.from + index * 10);
  const text = tlFmt(at);
  if (tlValue !== null) tlValue.textContent = text;
  tlInput?.setAttribute("aria-valuetext", text); // 读屏不朗读裸格值
  void setTafLayerTime(map, tafLayer, tafItems, { at, card: { utcOffsetMinutes: tzOffset } });
  window.setTimeout(() => refreshPanel?.(), 60); // 等原地更新图标落地后刷新列表
};
/** 刻度线（叠滑道、pointer-events 放行点击）：整点小刻度 / 3 小时主刻度 / 展示时区日界高刻度 */
const tlBuildTicks = (): void => {
  if (tlTicksBox === null || tlSpan === undefined) return;
  tlTicksBox.replaceChildren();
  const total = tlSpan.to - tlSpan.from;
  for (let a = tlSpan.from; a <= tlSpan.to; a += 10) {
    if (a % 60 !== 0 && a !== tlSpan.from && a !== tlSpan.to) continue; // 非整点只保留两端
    const zoneA = a + (tzOffset ?? 0);
    const tick = document.createElement("i");
    tick.className = zoneA % 1440 === 0 ? "day" : a % 180 === 0 ? "major" : "minor"; // 日界＞主刻度＞小刻度
    tick.style.left = `${(((a - tlSpan.from) / total) * 100).toFixed(3)}%`;
    tlTicksBox.append(tick);
  }
};
/** TAF 载入后初始化时间轴：建窗（现在取整 10 分钟 + 24h）、画刻度、默认落「现在」 */
const initTimeline = (): void => {
  const w = timelineWindow();
  tlSpan = { from: tlAbsOf(w.from), to: tlAbsOf(w.to) };
  if (tlInput !== null) tlInput.max = String(Math.round((tlSpan.to - tlSpan.from) / 10));
  tlBuildTicks();
  tlApply(0);
};
tlPlayBtn?.addEventListener("click", () => {
  if (tlPlaying) {
    tlStopPlay();
    return;
  }
  if (tlSpan === undefined) return;
  tlPlaying = true;
  tlSetPlayBtn();
  tlTimer = window.setInterval(() => {
    if (tlSpan === undefined || tlInput === null) {
      tlStopPlay();
      return;
    }
    const max = Number(tlInput.max);
    const cur = Number(tlInput.value);
    tlApply(cur >= max ? 0 : cur + 1); // 到尾循环回「现在」
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
let refreshPanel: (() => void) | undefined; // TAF 载入后由 loadTaf 赋值（列表渲染入口，面板开关直呼）
let pendingFlyOpen: (() => void) | undefined; // 行点击「先飞后开卡」的在途回调（换行连点时解绑防开错站）

const mapLegend = document.getElementById("map-legend");

const setMode = (mode: "metar" | "taf"): void => {
  const active = mode === "taf";
  modeBar.metar?.classList.toggle("active", !active);
  modeBar.taf?.classList.toggle("active", active);
  modeBar.metar?.setAttribute("aria-pressed", String(!active));
  modeBar.taf?.setAttribute("aria-pressed", String(active));
  if (timelineBar !== null) timelineBar.hidden = !active;
  if (modeBar.list !== null) modeBar.list.hidden = !active;
  if (mapLegend !== null) mapLegend.hidden = !active; // 地图角四档图例（复测签派 N4：自定义编码须配图例）
  if (!active) setListOpen(false);
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
    // 超时 20s（评测工程 P2-4：上游挂死不再无界等待）；错误分层在 catch 判别
    let res: Response;
    try {
      res = await fetch(`/aw-taf?ids=${ids}&format=raw`, { signal: AbortSignal.timeout(20_000) }); // 走 vite 代理（见 vite.config.ts——上游无 CORS 头）
    } catch (err) {
      const timedOut = err instanceof DOMException && err.name === "TimeoutError";
      throw timedOut
        ? new Error("拉取超时（20 秒），请稍后重试")
        : new Error("网络请求失败，请检查网络后重试");
    }
    if (!res.ok) throw new Error(`上游返回异常状态 ${res.status}，请稍后重试`);
    const text = await res.text();
    const byIcao = new Map(stationsFile.stations.map((s) => [s.icao, s]));
    const items: TafLayerItem[] = [];
    let failed = 0;
    // aviationweather raw 格式：新报行从行首起，续行以空白缩进续接——先归并再解析
    const reports: string[] = [];
    for (const line of text.split("\n")) {
      if (line.trim() === "") continue;
      if (/^\s/.test(line) && reports.length > 0) reports[reports.length - 1] += ` ${line.trim()}`;
      else reports.push(line.trim());
    }
    for (const raw of reports) {
      try {
        const taf = parseTaf(raw);
        const st = byIcao.get(taf.station);
        if (st === undefined) continue;
        items.push({ report: taf, position: [st.lat, st.lon], title: `${st.icao} ${st.name}` });
      } catch {
        failed += 1;
      }
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
    const TIER_ORDER: Record<string, number> = { danger: 0, caution: 1, good: 2, unknown: 3 };
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
      const markers = tafLayer.getLayers();
      const rowsData = tafItems.map((it, i) => {
        const ml = markers[i];
        const dot = ml instanceof L.Marker ? ml.getElement()?.querySelector(".mw-dot") : undefined;
        const tier = dot?.className.match(/mw-dot-(\w+)/)?.[1] ?? "unknown";
        const ch = it.report.changes[0];
        // 人话化窗口（复测小白#1/#面板）：ddHH/ddHH → 当前时区单制的 dd日HH–HH时（UTC 直读；京时 +8 换算）
        const win = ch?.window;
        const winText =
          win !== undefined && /^(\d{2})(\d{2})\/(\d{2})(\d{2})$/.test(win.raw)
            ? (() => {
                const m = /^(\d{2})(\d{2})\/(\d{2})(\d{2})$/.exec(win.raw);
                if (m === null) return win.raw;
                const [, d1, h1, d2, h2] = m;
                const a = hourWordOf(Number(d1), Number(h1));
                const b = hourWordOf(Number(d2), Number(h2));
                const tag = tzOffset === null ? "" : "京";
                const dd = (x: { d: number; h: number }): string =>
                  `${String(x.d).padStart(2, "0")}日${String(x.h).padStart(2, "0")}`;
                return a.d === b.d
                  ? `${tag}${dd(a)}–${String(b.h).padStart(2, "0")}时`
                  : `${tag}${dd(a)}时–${dd(b)}时`;
              })()
            : ch?.at !== undefined
              ? `${String(ch.at.hour).padStart(2, "0")}:${String(ch.at.minute).padStart(2, "0")}Z`
              : undefined;
        const next =
          ch !== undefined ? `${CHANGE_WORD[ch.kind] ?? ch.kind} ${winText ?? ""}`.trim() : "—";
        return { it, tier, next };
      });
      rowsData.sort(
        (a, b) =>
          (TIER_ORDER[a.tier] ?? 9) - (TIER_ORDER[b.tier] ?? 9) ||
          a.it.report.station.localeCompare(b.it.report.station),
      );
      const colors: Record<string, string> = {
        danger: "#c2504a",
        caution: "#d99a2b",
        good: "#2f9e63",
        unknown: "#94a3b8",
      };
      for (const r of rowsData) {
        const tr = document.createElement("tr");
        tr.tabIndex = 0;
        const tdDot = document.createElement("td");
        const dot = document.createElement("span");
        dot.className = "p-dot";
        dot.style.background = colors[r.tier] ?? colors.unknown ?? "#94a3b8";
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
        const legendItems: Array<[string, string]> = [
          ["danger", "差"],
          ["caution", "注意"],
          ["good", "良好"],
          ["unknown", "无数据"],
        ];
        for (const [key, word] of legendItems) {
          const chip = document.createElement("span");
          chip.className = "p-legend-item";
          const dot = document.createElement("span");
          dot.className = "p-dot";
          dot.style.background = colors[key] ?? colors.unknown ?? "#94a3b8";
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
