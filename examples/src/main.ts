import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
// 主流程分两阶段：① 站点元数据（stations.json，静态可信）立即上图「待更新」态，杜绝空白地图；
// ② 实况到达后移除待更新层、渲染条件色实况层。取数（含解析与定位联表）→ 卡片上图（底图切换见 basemaps.ts）
import { parse, renderCard } from "metweave";
import { getMetarReports } from "metweave/sources";
import { addMetarLayer } from "@metweave/leaflet";
import stationsFile from "../stations.json";
import { setupBasemap } from "./basemaps";
import "./style.css";

const map = L.map("map", { center: [35.5, 105], zoom: 4 });
const hasBasemap = setupBasemap(map);

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
  const group = await addMetarLayer(map, items, { card: { raw: true }, conditionColors: true });
  const updatedClock = new Date().toISOString().slice(11, 16);
  setStatus(
    `已更新 ${items.length} 站 · ${updatedClock} UTC${skipped.length > 0 ? ` · ${skipped.length} 站跳过` : ""}`,
    "ok",
  );
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
