/**
 * 低空航路天气面板主流程（2026-10-20，场景演示件）：
 * 「兴隆湖→龙泉山」示意航线（≈25km、真高 120m、上午作业窗口）的六问覆盖——
 * 问一 地面实况（AWC 代理直达 → IEM 兜底，两通路显式降级）；
 * 问二/三 真高风温廓线＋沿线剖面（Open-Meteo 直拉 → 仓内快照兜底，时刻滑杆同驱两视图）；
 * 问四 云/能见度（廓线地面行）＋晨昏窗口；问五 雷暴指数（CAPE 列）；短临为请求形态静态卡（不实接）；
 * 问六 目的端 TAF（AWC 代理；静态部署诚实缺席——与 iwxxm 预取同一降级纪律）。
 * 红线：展示官方发布＋标注来源，不做预报研判；示意航线非获批航线，不得用于运行决策。
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
  renderProfileSvg,
  renderProfileTable,
  renderDaylightBar,
  type OwPointForecast,
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

const map = L.map("map", { center: [30.5, 104.17], zoom: 11 });
const hasBasemap = setupBasemap(map);
if (!hasBasemap) {
  const hint = document.getElementById("basemap-hint");
  if (hint !== null) {
    hint.textContent = "未配置底图 key（VITE_TIANDITU_KEY）——航线、采样点与实况圆点仍可正常交互。";
    hint.hidden = false;
  }
}

// 航线与采样点先上图（静态可信元数据，杜绝空白地图——与主 demo 两阶段同思路）
L.polyline(
  ROUTE_POINTS.map((p) => [p.lat, p.lon] as [number, number]),
  { color: "#4a7fbf", weight: 3, dashArray: "7 7", opacity: 0.85 },
).addTo(map);
for (const p of ROUTE_POINTS) {
  L.circleMarker([p.lat, p.lon], {
    radius: 7,
    color: "#2b5d9b",
    weight: 2,
    fillColor: "#cfe3f7",
    fillOpacity: 1,
  })
    .bindTooltip(`${p.id} ${p.name}`, { direction: "top", offset: [0, -6] })
    .addTo(map);
}
// 取景＝航线＋双站联合（「双站夹持」叙事要求两站圆点同框可见）
map.fitBounds(
  L.latLngBounds([
    ...ROUTE_POINTS.map((p) => L.latLng(p.lat, p.lon)),
    ...METAR_STATIONS.map(stationMetaOf)
      .filter((s): s is StationMeta => s !== undefined)
      .map((s) => L.latLng(s.lat, s.lon)),
  ]).pad(0.15),
);

// 刷新时浏览器恢复滚动位可让地图容器在视口外完成初始化——Leaflet 按当时容器尺寸排版，
// 瓦片与取景会错位空白；首次进入视口时 invalidateSize 一次重排（一次性， thereafter 零开销）
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

// ---------------------------------------------------------------- 问二/三/四/五：Open-Meteo 廓线（直拉 → 快照兜底）

interface OwBundle {
  readonly points: readonly OwPointForecast[];
  readonly source: "live" | "snapshot";
  readonly fetchedAt?: string;
}

const loadOpenMeteo = async (): Promise<OwBundle> => {
  try {
    const res = await fetch(owForecastUrl(ROUTE_POINTS));
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
    const body: unknown = await res.json();
    const rows: readonly unknown[] = Array.isArray(body) ? body : [];
    if (rows.length !== ROUTE_POINTS.length) throw new Error("返回点数与航线采样不符");
    if (!rows.every(isOwPointForecast)) throw new Error("响应 schema 不符（缺 hourly/time 骨架）");
    return { points: rows, source: "live" };
  } catch {
    // 兜底：仓内快照（构建期固化，快照时刻随文标注——不静默假充实时）；同样过形状校验
    const mod: unknown = await import("./lowalt-ow-fallback.json");
    if (typeof mod !== "object" || mod === null || !("default" in mod)) {
      throw new Error("快照产物缺失");
    }
    const def: unknown = mod.default;
    if (typeof def !== "object" || def === null || !("points" in def)) {
      throw new Error("快照 schema 不符（缺 points）");
    }
    const points: readonly unknown[] = Array.isArray(def.points) ? def.points : [];
    if (points.length !== ROUTE_POINTS.length || !points.every(isOwPointForecast)) {
      throw new Error("快照点 schema 不符");
    }
    const fetchedAt =
      "fetchedAt" in def && typeof def.fetchedAt === "string" ? def.fetchedAt : "未知时刻";
    return { points, source: "snapshot", fetchedAt };
  }
};

const renderProfileSection = (bundle: OwBundle): void => {
  const points = bundle.points;
  const times = points[0]?.hourly.time ?? [];
  const localNow = localHourStrOf(Date.now());
  let hourIndex = hourIndexAt(times, localNow);

  const label = document.getElementById("profile-hour-label");
  const sliderEl = document.getElementById("profile-hour");
  const slider = sliderEl instanceof HTMLInputElement ? sliderEl : null;
  const nowBtn = document.getElementById("profile-now");
  const svgBox = document.getElementById("profile-svg");
  const tableBox = document.getElementById("profile-table");
  const daylightBox = document.getElementById("profile-daylight");
  const sourceNote = document.getElementById("profile-source");

  const renderAll = (): void => {
    if (svgBox !== null) svgBox.replaceChildren(renderProfileSvg(points, { hourIndex }));
    if (tableBox !== null) tableBox.replaceChildren(renderProfileTable(points, hourIndex));
    const daily = points[0]?.daily;
    if (daylightBox !== null && daily !== undefined) {
      const dayIndex = Math.min(Math.floor(hourIndex / 24), daily.sunrise.length - 1);
      daylightBox.replaceChildren(renderDaylightBar(daily, Math.max(dayIndex, 0), localNow));
    }
    if (label !== null) {
      const iso = times[hourIndex] ?? localNow;
      label.textContent = `${hourLabelOf(iso)}${hourIndex === hourIndexAt(times, localNow) ? "（现在）" : ""}`;
    }
  };

  if (slider !== null) {
    slider.max = String(Math.max(times.length - 1, 0));
    slider.value = String(hourIndex);
    slider.addEventListener("input", () => {
      hourIndex = Number(slider.value);
      renderAll();
    });
  }
  nowBtn?.addEventListener("click", () => {
    hourIndex = hourIndexAt(times, localHourStrOf(Date.now()));
    if (slider !== null) slider.value = String(hourIndex);
    renderAll();
  });

  renderAll();
  if (sourceNote !== null) {
    sourceNote.textContent =
      bundle.source === "live"
        ? "数据源：Open-Meteo（ECMWF/GFS 近地面层，浏览器直连，实时）"
        : `数据源：Open-Meteo 仓内快照（${bundle.fetchedAt ?? "未知时刻"} 固化——实时取数失败时的诚实兜底）`;
  }
};

// ---------------------------------------------------------------- 装配

const main = async (): Promise<void> => {
  setStatus("正在装配低空航路天气面板…", "loading");
  const metar = loadMetar();
  const taf = loadTaf();
  const ow = loadOpenMeteo().then((bundle) => {
    renderProfileSection(bundle);
    if (bundle.source === "snapshot") {
      setStatus(
        "问二至问五 · Open-Meteo 实时取数失败，已切仓内快照兜底（快照时刻见面板标注）",
        "ok",
      );
    }
  });
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
