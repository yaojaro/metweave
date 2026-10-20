/**
 * 低空航路天气面板主流程（2026-10-20，场景演示件；同日升级：用户自设航路）：
 * 地图点击取点（≤8，拖拽微调、右键删除）→ 折线等弧长采样（≤12 点）→ Open-Meteo 沿采样点
 * 拉近地面多层 → 沿程-高度剖面（风速色带＋巡航轨迹线＋逐点参考风险徽标，巡航真高滑杆联动）。
 * 问一 地面实况：AWC 代理直达 → IEM 兜底；问六 目的端 TAF：AWC 代理（静态部署诚实缺席）；
 * 短临为接入形态静态卡（不实接）。
 * 降级纪律：示例航线（未改动）实时失败可退仓内快照；用户自设航路无快照可退，诚实报错。
 * 红线：风险为演示参考阈值（页面常驻口径），非机型适飞判据、非运行决策依据；展示官方发布＋
 * 标注来源，不做预报研判；示意航线非获批航线。
 */
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { parse, parseTaf, renderTafCard } from "metweave";
import { getMetarReports, getTafs } from "metweave/sources";
import { addMetarLayer } from "@metweave/leaflet";
import { setupBasemap } from "./basemaps";
import stationsFile from "../stations.json";
import {
  ROUTE_POINTS,
  METAR_STATIONS,
  TAF_STATION,
  isOwPointForecast,
  owForecastUrl,
  localHourStrOf,
  hourIndexAt,
  hourLabelOf,
  haversineKm,
  resampleRoute,
  riskAtOf,
  renderRouteProfileSvg,
  renderProfileTable,
  renderDaylightBar,
  RISK_THRESHOLDS,
  type Waypoint,
  type SamplePoint,
  type OwPointForecast,
  type RiskAssessment,
} from "./lowalt-profile";
import "./style.css";

interface StationMeta {
  readonly icao: string;
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
}

const stationMetaOf = (icao: string): StationMeta | undefined => {
  const hit = stationsFile.stations.find((s) => s.icao === icao);
  return hit === undefined
    ? undefined
    : { icao: hit.icao, name: hit.name, lat: hit.lat, lon: hit.lon };
};

// 刷新永远从页顶开始：滚动位恢复会让地图容器在视口外初始化，Leaflet 按错位尺寸排版后
// 瓦片与取景双输（实测复现）——演示页无恢复滚动的合理场景，根上关掉（下保 IntersectionObserver 兜底）
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
window.scrollTo(0, 0);

const map = L.map("map", { center: [30.5, 104.17], zoom: 11, zoomControl: false });
L.control.zoom({ position: "topright" }).addTo(map);
const hasBasemap = setupBasemap(map);
if (!hasBasemap) {
  const hint = document.getElementById("basemap-hint");
  if (hint !== null) {
    hint.textContent = "未配置底图 key（VITE_TIANDITU_KEY）——航线、航点与实况圆点仍可正常交互。";
    hint.hidden = false;
  }
}
// 刷新时地图容器可能在视口外完成初始化——首次进入视口时 invalidateSize 一次重排（一次性）
const mapBox = document.getElementById("map");
if (mapBox !== null && typeof IntersectionObserver === "function") {
  const firstSeen = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        map.invalidateSize();
        firstSeen.disconnect();
      }
    },
    { threshold: 0.1 },
  );
  firstSeen.observe(mapBox);
}

// ---------------------------------------------------------------- 航路状态与绘制（点击取点/拖拽微调/右键删除）

const MAX_WAYPOINTS = 8;
const PRESET_WAYPOINTS: readonly Waypoint[] = [
  { lat: ROUTE_POINTS[0]?.lat ?? 30.44, lon: ROUTE_POINTS[0]?.lon ?? 104.07 },
  {
    lat: ROUTE_POINTS[ROUTE_POINTS.length - 1]?.lat ?? 30.56,
    lon: ROUTE_POINTS[ROUTE_POINTS.length - 1]?.lon ?? 104.27,
  },
];

let waypoints: Waypoint[] = [...PRESET_WAYPOINTS];
let customized = false; // 用户改过航路＝快照兜底失效（快照只对示例航线有效）
let cruiseAlt = 120;

const routeLayer = L.layerGroup().addTo(map);

const totalKmOf = (wps: readonly Waypoint[]): number => {
  let total = 0;
  for (let i = 1; i < wps.length; i += 1) {
    const a = wps[i - 1];
    const b = wps[i];
    if (a !== undefined && b !== undefined) total += haversineKm(a, b);
  }
  return total;
};

const waypointMarksOf = (wps: readonly Waypoint[]): { distKm: number; label: string }[] => {
  const marks: { distKm: number; label: string }[] = [];
  let dist = 0;
  for (let i = 0; i < wps.length; i += 1) {
    const w = wps[i];
    if (w === undefined) continue;
    if (i > 0) {
      const prev = wps[i - 1];
      if (prev !== undefined) dist += haversineKm(prev, w);
    }
    marks.push({ distKm: dist, label: `航点${i + 1}` });
  }
  return marks;
};

const redrawRoute = (): void => {
  routeLayer.clearLayers();
  if (waypoints.length >= 2) {
    L.polyline(
      waypoints.map((w) => [w.lat, w.lon] as [number, number]),
      { color: "#4a7fbf", weight: 3, dashArray: "7 7", opacity: 0.85 },
    ).addTo(routeLayer);
  }
  waypoints.forEach((w, i) => {
    const marker = L.marker([w.lat, w.lon], {
      draggable: true,
      icon: L.divIcon({
        className: "lw-wp-icon",
        html: `<span>${i + 1}</span>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
    });
    marker.bindTooltip(`航点${i + 1} · 拖拽微调，右键删除`, { direction: "top", offset: [0, -10] });
    marker.on("dragend", () => {
      const ll = marker.getLatLng();
      const idx = waypoints.indexOf(w);
      if (idx >= 0) waypoints[idx] = { lat: ll.lat, lon: ll.lng };
      customized = true;
      redrawRoute();
      invalidateAnalysis();
    });
    marker.on("contextmenu", (e) => {
      e.originalEvent.preventDefault();
      waypoints.splice(i, 1);
      customized = true;
      redrawRoute();
      invalidateAnalysis();
    });
    routeLayer.addLayer(marker);
  });
  const info = document.getElementById("route-info");
  if (info !== null) {
    info.textContent =
      waypoints.length < 2
        ? `已设 ${waypoints.length} 点（至少 2 点）`
        : `航点 ${waypoints.length}/${MAX_WAYPOINTS} · 里程 ${totalKmOf(waypoints).toFixed(1)}km`;
  }
};

map.on("click", (e: L.LeafletMouseEvent) => {
  if (waypoints.length >= MAX_WAYPOINTS) {
    setStatus(`航点上限 ${MAX_WAYPOINTS} 个——如需调整，右键删除后再取点`, "error");
    return;
  }
  waypoints.push({ lat: e.latlng.lat, lon: e.latlng.lng });
  customized = true;
  redrawRoute();
  invalidateAnalysis();
});

const invalidateAnalysis = (): void => {
  bundle = undefined;
  const svgBox = document.getElementById("profile-svg");
  const tableBox = document.getElementById("profile-table");
  const daylightBox = document.getElementById("profile-daylight");
  svgBox?.replaceChildren();
  tableBox?.replaceChildren();
  daylightBox?.replaceChildren();
  const label = document.getElementById("profile-hour-label");
  if (label !== null) label.textContent = "—";
  const sourceNote = document.getElementById("profile-source");
  if (sourceNote !== null) sourceNote.textContent = "航路已改动——点「分析航路」重新取数";
  const analyze = document.getElementById("route-analyze");
  if (analyze instanceof HTMLButtonElement) analyze.disabled = waypoints.length < 2;
};

// 取景＝示例航线＋双站联合（「双站夹持」叙事要求两站圆点同框可见）
map.fitBounds(
  L.latLngBounds([
    ...PRESET_WAYPOINTS.map((p) => L.latLng(p.lat, p.lon)),
    ...METAR_STATIONS.map(stationMetaOf)
      .filter((s): s is StationMeta => s !== undefined)
      .map((s) => L.latLng(s.lat, s.lon)),
  ]).pad(0.15),
);

const status = document.getElementById("status");
const statusText = document.getElementById("status-text");
const setStatus = (text: string, tone: "loading" | "ok" | "error"): void => {
  if (status === null || statusText === null) return;
  status.dataset.tone = tone;
  statusText.textContent = text;
  status.hidden = false;
  if (tone === "ok") window.setTimeout(() => (status.hidden = true), 8000);
};

// ---------------------------------------------------------------- 问一：地面实况（机场报文＝低空最便宜的地面真值）

const loadMetar = async (): Promise<void> => {
  // 首选 AWC 代理（dev 即时；端点无 CORS 头，浏览器直连被拦——见 vite.config.ts 代理注释）
  try {
    const res = await fetch(`/aw-metar?ids=${METAR_STATIONS.join(",")}&format=json`);
    if (!res.ok) throw new Error(`AWC 代理 HTTP ${res.status}`);
    const body: unknown = await res.json();
    if (!Array.isArray(body)) throw new Error("AWC 代理返回非数组");
    // 运行时形状校验（沿 sources 层纪律：unknown 收窄靠守卫不靠断言），非法行跳过不炸页
    const rows: readonly unknown[] = body;
    const rawByStation = new Map<string, string>();
    for (const row of rows) {
      if (
        typeof row === "object" &&
        row !== null &&
        "icaoId" in row &&
        "rawOb" in row &&
        typeof row.icaoId === "string" &&
        typeof row.rawOb === "string"
      ) {
        rawByStation.set(row.icaoId, row.rawOb);
      }
    }
    const items = (["ZUUU", "ZUTF"] as const)
      .map((icao) => {
        const meta = stationMetaOf(icao);
        const raw = rawByStation.get(icao);
        if (meta === undefined || raw === undefined) return undefined;
        return {
          report: parse(raw),
          position: [meta.lat, meta.lon] as [number, number],
          title: `${meta.icao} ${meta.name}`,
        };
      })
      .filter((x) => x !== undefined);
    if (items.length === 0) throw new Error("AWC 返回无本航线两站报文");
    await addMetarLayer(map, items, {
      card: { raw: true },
      conditionColors: true,
      popupOptions: { maxWidth: 420 },
    });
    setStatus(`问一 · 地面实况已上图（AWC 实时，${items.length} 站）——点击圆点看中文卡`, "ok");
    return;
  } catch (awcErr) {
    // 兜底：IEM 公开通路（CORS 全开，静态部署亦可用；整网拉取通常 10–40 秒）
    try {
      const stations = (["ZUUU", "ZUTF"] as const)
        .map(stationMetaOf)
        .filter((s): s is StationMeta => s !== undefined);
      const items = await getMetarReports("CN__ASOS", {
        stations: stations.map((s) => ({ icao: s.icao, name: s.name, lat: s.lat, lon: s.lon })),
        timeoutMs: 60_000,
      });
      if (items.length === 0) throw new Error("IEM 无本航线两站报文", { cause: awcErr });
      await addMetarLayer(map, items, {
        card: { raw: true },
        conditionColors: true,
        popupOptions: { maxWidth: 420 },
      });
      setStatus(
        `问一 · 地面实况已上图（IEM 兜底通路，${items.length} 站；AWC 直达失败：${awcErr instanceof Error ? awcErr.message : String(awcErr)}）`,
        "ok",
      );
    } catch (iemErr) {
      setStatus(
        `问一 · 地面实况两条通路均不可用——AWC：${awcErr instanceof Error ? awcErr.message : String(awcErr)}；IEM：${iemErr instanceof Error ? iemErr.message : String(iemErr)}`,
        "error",
      );
    }
  }
};

// ---------------------------------------------------------------- 问六：目的端 TAF（AWC 代理；静态部署诚实缺席）

const loadTaf = async (): Promise<void> => {
  const box = document.getElementById("taf-card");
  const hint = document.getElementById("taf-hint");
  if (box === null) return;
  try {
    const rows = await getTafs([TAF_STATION], { baseUrl: "/aw-taf", timeoutMs: 20_000 });
    const raw = rows[0]?.raw;
    if (raw === undefined || raw === "") throw new Error("上游无 TAF 报文");
    box.replaceChildren(renderTafCard(parseTaf(raw)));
  } catch (err) {
    if (hint !== null) {
      hint.textContent = `目的端 TAF 此刻不可用（${err instanceof Error ? err.message : String(err)}）——静态部署无 AWC 代理时诚实缺席，dev server 下自动可用。`;
      hint.hidden = false;
    }
  }
};

// ---------------------------------------------------------------- 问二/三/四/五：沿采样点取数与剖面渲染

interface OwBundle {
  readonly points: readonly OwPointForecast[];
  readonly samples: readonly SamplePoint[];
  readonly source: "live" | "snapshot";
  readonly fetchedAt?: string;
}

let bundle: OwBundle | undefined;
let hourIndex = 0;
const localNow = (): string => localHourStrOf(Date.now());

const fetchOwPoints = async (
  samples: readonly SamplePoint[],
): Promise<readonly OwPointForecast[]> => {
  const res = await fetch(owForecastUrl(samples));
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  const body: unknown = await res.json();
  const rows: readonly unknown[] = Array.isArray(body) ? body : [];
  if (rows.length !== samples.length) throw new Error("返回点数与航线采样不符");
  if (!rows.every(isOwPointForecast)) throw new Error("响应 schema 不符（缺 hourly/time 骨架）");
  return rows;
};

const loadSnapshot = async (): Promise<readonly OwPointForecast[]> => {
  // 兜底：仓内快照（示例航线固化，快照时刻随文标注——不静默假充实时）；用户自设航路不可用
  const mod: unknown = await import("./lowalt-ow-fallback.json");
  if (typeof mod !== "object" || mod === null || !("default" in mod)) {
    throw new Error("快照产物缺失");
  }
  const def: unknown = mod.default;
  if (typeof def !== "object" || def === null || !("points" in def)) {
    throw new Error("快照 schema 不符（缺 points）");
  }
  const points: readonly unknown[] = Array.isArray(def.points) ? def.points : [];
  // 快照按示例航线的同一套 resampleRoute 采样坐标固化（坐标即采样点）——只校点数与形状
  if (
    points.length !== resampleRoute(PRESET_WAYPOINTS).length ||
    !points.every(isOwPointForecast)
  ) {
    throw new Error("快照点 schema 不符");
  }
  return points;
};

const analyzeRoute = async (): Promise<void> => {
  const samples = resampleRoute(waypoints);
  if (samples.length < 2) {
    setStatus("航路至少需要 2 个航点——点击地图取点后再分析", "error");
    return;
  }
  const analyzeBtn = document.getElementById("route-analyze");
  if (analyzeBtn instanceof HTMLButtonElement) analyzeBtn.disabled = true;
  setStatus(`正在沿 ${samples.length} 个采样点取数（Open-Meteo 近地面多层）…`, "loading");
  try {
    let points: readonly OwPointForecast[];
    let source: "live" | "snapshot" = "live";
    let fetchedAt: string | undefined;
    try {
      points = await fetchOwPoints(samples);
    } catch (liveErr) {
      if (customized) {
        throw liveErr instanceof Error ? liveErr : new Error(String(liveErr));
      }
      points = await loadSnapshot();
      source = "snapshot";
      const snap: unknown = await import("./lowalt-ow-fallback.json");
      if (typeof snap === "object" && snap !== null && "default" in snap) {
        const d: unknown = snap.default;
        if (
          typeof d === "object" &&
          d !== null &&
          "fetchedAt" in d &&
          typeof d.fetchedAt === "string"
        ) {
          fetchedAt = d.fetchedAt;
        }
      }
    }
    bundle = { points, samples, source, fetchedAt };
    hourIndex = hourIndexAt(points[0]?.hourly.time ?? [], localNow());
    renderAll();
    setStatus(
      source === "live"
        ? `分析完成：${samples.length} 个采样点 · 全长 ${totalKmOf(waypoints).toFixed(1)}km——拖时刻滑杆看全天，拖巡航真高看风险变化`
        : `Open-Meteo 实时取数失败，已切仓内快照兜底（${fetchedAt ?? "未知时刻"} 固化）`,
      "ok",
    );
  } catch (err) {
    setStatus(
      `分析失败：${err instanceof Error ? err.message : String(err)}——上游恢复后重试（示例航线可退仓内快照，自设航路无快照可退）`,
      "error",
    );
  } finally {
    if (analyzeBtn instanceof HTMLButtonElement) analyzeBtn.disabled = waypoints.length < 2;
  }
};

const buildProfileSvg = (risks: readonly RiskAssessment[]): SVGElement | null => {
  if (bundle === undefined) return null;
  return renderRouteProfileSvg(bundle.points, {
    samples: bundle.samples,
    hourIndex,
    cruiseAlt,
    risks,
    waypointMarks: waypointMarksOf(waypoints),
  });
};

const renderAll = (): void => {
  if (bundle === undefined) return;
  const { points, samples } = bundle;
  const times = points[0]?.hourly.time ?? [];
  const risks: readonly RiskAssessment[] = points.map((p) =>
    riskAtOf(p.hourly, hourIndex, cruiseAlt),
  );

  const svg = buildProfileSvg(risks);
  const svgBox = document.getElementById("profile-svg");
  if (svg !== null && svgBox !== null) svgBox.replaceChildren(svg);
  // 放大 overlay 打开时同步重渲（同一渲染件换容器）
  const modal = document.getElementById("profile-modal");
  const bigBox = document.getElementById("profile-svg-big");
  if (modal !== null && !modal.hidden && bigBox !== null) {
    const big = buildProfileSvg(risks);
    if (big !== null) bigBox.replaceChildren(big);
  }
  const tableBox = document.getElementById("profile-table");
  if (tableBox !== null) tableBox.replaceChildren(renderProfileTable(points, hourIndex, samples));
  const daylightBox = document.getElementById("profile-daylight");
  const daily = points[0]?.daily;
  if (daylightBox !== null && daily !== undefined) {
    const dayIndex = Math.min(Math.floor(hourIndex / 24), Math.max(daily.sunrise.length - 1, 0));
    daylightBox.replaceChildren(renderDaylightBar(daily, Math.max(dayIndex, 0), localNow()));
  }
  const label = document.getElementById("profile-hour-label");
  if (label !== null) {
    const iso = times[hourIndex] ?? localNow();
    label.textContent = `${hourLabelOf(iso)}${hourIndex === hourIndexAt(times, localNow()) ? "（现在）" : ""}`;
  }
  const sourceNote = document.getElementById("profile-source");
  if (sourceNote !== null) {
    sourceNote.textContent =
      bundle.source === "live"
        ? `数据源：Open-Meteo（ECMWF/GFS 近地面层，实时）· ${samples.length} 采样点 · 参考阈值：风 ${RISK_THRESHOLDS.windMidMs}/${RISK_THRESHOLDS.windHighMs} m/s · CAPE ${RISK_THRESHOLDS.capeMid}/${RISK_THRESHOLDS.capeHigh} J/kg · 降水 ${RISK_THRESHOLDS.precipMidMm}/${RISK_THRESHOLDS.precipHighMm} mm/h（演示口径，非机型判据）`
        : `数据源：Open-Meteo 仓内快照（${bundle.fetchedAt ?? "未知时刻"} 固化）· 参考阈值见上（演示口径，非机型判据）`;
  }
};

// ---------------------------------------------------------------- 装配

// 页签切换：剖面 / 明细表 / 机场预报 / 短临接入
const tabButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>(".lw-tabs button[data-tab]"),
);
const showTab = (name: string): void => {
  for (const b of tabButtons) b.classList.toggle("active", b.dataset.tab === name);
  for (const page of document.querySelectorAll<HTMLElement>(".lw-tabpage")) {
    page.hidden = page.id !== `tab-${name}`;
  }
};
for (const b of tabButtons) {
  b.addEventListener("click", () => {
    if (b.dataset.tab !== undefined) showTab(b.dataset.tab);
  });
}

// 面板收起/展开（收起＝整幅底图可玩）
const panel = document.getElementById("lw-panel");
const panelOpenBtn = document.getElementById("panel-open");
document.getElementById("panel-collapse")?.addEventListener("click", () => {
  panel?.classList.add("lw-hidden");
  if (panelOpenBtn !== null) panelOpenBtn.hidden = false;
});
panelOpenBtn?.addEventListener("click", () => {
  panel?.classList.remove("lw-hidden");
  if (panelOpenBtn !== null) panelOpenBtn.hidden = true;
});

// 剖面放大 overlay（同一渲染件的大图视图）
const modal = document.getElementById("profile-modal");
document.getElementById("profile-zoom")?.addEventListener("click", () => {
  if (modal === null || bundle === undefined) return;
  const bigBox = document.getElementById("profile-svg-big");
  const svg = buildProfileSvg(bundle.points.map((p) => riskAtOf(p.hourly, hourIndex, cruiseAlt)));
  if (bigBox !== null && svg !== null) bigBox.replaceChildren(svg);
  modal.hidden = false;
});
document.getElementById("profile-modal-close")?.addEventListener("click", () => {
  if (modal !== null) modal.hidden = true;
});

const main = async (): Promise<void> => {
  setStatus("正在装配低空航路天气面板…", "loading");
  redrawRoute();

  const hourSliderEl = document.getElementById("profile-hour");
  const hourSlider = hourSliderEl instanceof HTMLInputElement ? hourSliderEl : null;
  hourSlider?.addEventListener("input", () => {
    hourIndex = Number(hourSlider.value);
    renderAll();
  });
  document.getElementById("profile-now")?.addEventListener("click", () => {
    hourIndex = hourIndexAt(bundle?.points[0]?.hourly.time ?? [], localNow());
    if (hourSlider !== null) hourSlider.value = String(hourIndex);
    renderAll();
  });

  const cruiseEl = document.getElementById("cruise-alt");
  const cruiseSlider = cruiseEl instanceof HTMLInputElement ? cruiseEl : null;
  cruiseSlider?.addEventListener("input", () => {
    cruiseAlt = Number(cruiseSlider.value);
    const cruiseLabel = document.getElementById("cruise-alt-label");
    if (cruiseLabel !== null) cruiseLabel.textContent = `${cruiseAlt}m`;
    renderAll();
  });

  document.getElementById("route-analyze")?.addEventListener("click", () => {
    void analyzeRoute();
  });
  document.getElementById("route-clear")?.addEventListener("click", () => {
    waypoints = [];
    customized = true;
    redrawRoute();
    invalidateAnalysis();
  });
  document.getElementById("route-preset")?.addEventListener("click", () => {
    waypoints = [...PRESET_WAYPOINTS];
    customized = false;
    redrawRoute();
    invalidateAnalysis();
    void analyzeRoute();
  });

  const metar = loadMetar();
  const taf = loadTaf();
  const ow = analyzeRoute();
  await Promise.allSettled([metar, taf, ow]);
};

main().catch((err: unknown) => {
  setStatus(`面板装配失败：${err instanceof Error ? err.message : String(err)}`, "error");
});

// 弹窗原文区收起/展开（与 iwxxm 页同一交互约定，事件委托共享）
document.addEventListener("click", (e: MouseEvent) => {
  const title = e.target instanceof Element ? e.target.closest(".mw-raw-title") : null;
  if (!(title instanceof HTMLElement)) return;
  const body = title.nextElementSibling;
  if (
    !(body instanceof HTMLElement) ||
    !(body.classList.contains("mw-raw") || body.classList.contains("mw-raw-group"))
  )
    return;
  const collapsed = body.toggleAttribute("hidden");
  title.setAttribute("aria-expanded", collapsed ? "false" : "true");
});
