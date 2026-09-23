import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
// 主流程分两阶段：① 站点元数据（stations.json，静态可信）立即上图「待更新」态，杜绝空白地图；
// ② 实况到达后移除待更新层、渲染条件色实况层。取数（含解析与定位联表）→ 卡片上图（底图切换见 basemaps.ts）
import { parse, parseTaf, renderCard } from "metweave";
import { getMetarReports } from "metweave/sources";
import {
  addMetarLayer,
  addTafLayer,
  createTafTimeControl,
  type TafLayerItem,
} from "@metweave/leaflet";
import type * as LeafletNS from "leaflet";
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
/** dd/hh → 京dd日HH时（+8，日回绕 31 折回——面板「下一变化」人话化用） */
const ltHourOf = (d: number, h: number): string => {
  const total = (d - 1) * 1440 + h * 60 + 480;
  return `${String((Math.floor(total / 1440) % 31) + 1).padStart(2, "0")}日${String(Math.floor((total % 1440) / 60)).padStart(2, "0")}时`;
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
  metarLayer = group;
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

// —— TAF 预报模式（v0.2 渲染层演示）：拉 aviationweather 公开通路 39 站最新 TAF 原文，
// 本地 parseTaf 解析 → addTafLayer 预报当观测渲 + 时间滑杆全图换时刻（层①③；弹窗卡片为层②）
const modeBar = {
  metar: document.getElementById("mode-metar"),
  taf: document.getElementById("mode-taf"),
  list: document.getElementById("mode-list"),
  time: document.getElementById("taf-time"),
  panel: document.getElementById("taf-panel"),
  panelTitle: document.getElementById("taf-panel-title"),
  panelBody: document.getElementById("taf-panel-body"),
};
let metarLayer: LeafletNS.LayerGroup | undefined;
let tafLayer: LeafletNS.LayerGroup | undefined;
let tafItems: readonly TafLayerItem[] | undefined;
let listOpen = false;
let refreshPanel: (() => void) | undefined; // TAF 载入后由 loadTaf 赋值（列表渲染入口，面板开关直呼）

const setMode = (mode: "metar" | "taf"): void => {
  const active = mode === "taf";
  modeBar.metar?.classList.toggle("active", !active);
  modeBar.taf?.classList.toggle("active", active);
  modeBar.metar?.setAttribute("aria-pressed", String(!active));
  modeBar.taf?.setAttribute("aria-pressed", String(active));
  if (modeBar.time !== null) modeBar.time.hidden = !active;
  if (modeBar.list !== null) modeBar.list.hidden = !active;
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
    tafLayer = await addTafLayer(map, items);
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
        // 人话化窗口（复测小白#1/#面板）：ddHH/ddHH → dd日HH–HH时（京HH–HH时，+8）
        const win = ch?.window;
        const winText =
          win !== undefined && /^(\d{2})(\d{2})\/(\d{2})(\d{2})$/.test(win.raw)
            ? (() => {
                const m = /^(\d{2})(\d{2})\/(\d{2})(\d{2})$/.exec(win.raw);
                if (m === null) return win.raw;
                const [, d1, h1, d2, h2] = m;
                const sameDay = d1 === d2;
                return `${d1}日${h1}${sameDay ? "–" : `时–${d2}日`}${h2}时（京${ltHourOf(Number(d1), Number(h1))}–${ltHourOf(Number(d2), Number(h2))}）`;
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
          map.flyTo(r.it.position, 6);
          marker.openPopup();
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
    const ctrl = createTafTimeControl(map, {
      layer: tafLayer,
      items,
      layerOptions: {},
      onTime: () => {
        window.setTimeout(renderPanel, 60); // 等 setTafLayerTime 原地更新图标落地后刷新列表
      },
    });
    modeBar.time?.replaceChildren(ctrl);
    setMode("taf");
    renderPanel();
    setStatus(
      `TAF 预报已上图：${items.length} 站${failed > 0 ? ` · ${failed} 条解析跳过` : ""} · 拖动右上滑杆换时刻`,
      "ok",
    );
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
modeBar.metar?.addEventListener("click", () => {
  if (tafLayer !== undefined) map.removeLayer(tafLayer);
  if (metarLayer !== undefined) map.addLayer(metarLayer);
  setMode("metar");
});
modeBar.list?.addEventListener("click", () => {
  setListOpen(!listOpen);
  if (listOpen) refreshPanel?.(); // 首开即渲染（此后滑杆换时刻经 onTime 自动刷新）
});

// 实况层完成后留存引用，供模式切换（原 addMetarLayer 调用点捕获返回值）
