/**
 * 「风怎么流动」演示页（windfield.html，0.3.4 矢量批次的看效果面）：真实中国域 10m
 * 风场（examples/data/grid/windu/windv_cn.mwgrid）整页四层可视——色斑（多大）＋风羽
 * （点位多强）＋流线（静态的路）＋粒子（动态的走），各自可开关、粒子速度可调。
 *
 * 与 verify.html 的分工：那页是逐项可判定的验收面（合成场、自带数据）；本页是真实
 * 数据的完整视觉体验（底图＋真场）。图层口径全部走库公开件，页内不写第二份数学。
 * 边界：演示的是「该时次的定常近似」——粒子是示踪物不是气块追踪，动画不构成预报。
 */
import {
  buildColorScale,
  parseGrid,
  streamlinesOf,
  arrowFieldOf,
  interpolateBilinear,
  windProfile,
  windSpeedGrid,
  type Grid,
} from "@metweave/grid";
import {
  addArrowFieldLayer,
  addGridLayer,
  addParticleLayer,
  addStreamlineLayer,
  addWindBarbLayer,
  gridOverlayBounds,
  type ArrowFieldLayer,
  type ParticleLayer,
} from "@metweave/leaflet";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";

const loadGrid = async (file: string): Promise<Grid> => {
  const res = await fetch(`/data/grid/${file}`);
  if (!res.ok) throw new Error(`装载 ${file} 失败：HTTP ${String(res.status)}`);
  return parseGrid(await res.arrayBuffer());
};

const inputById = (id: string): HTMLInputElement | null => {
  const node = document.getElementById(id);
  return node instanceof HTMLInputElement ? node : null;
};

const status = document.getElementById("wf-status");

void (async () => {
  const [u, v] = await Promise.all([loadGrid("windu_cn.mwgrid"), loadGrid("windv_cn.mwgrid")]);
  const speed = windSpeedGrid(u, v);
  const map = L.map("wf-map", { center: [35, 105], zoom: 4 });
  map.fitBounds(gridOverlayBounds(u), { padding: [12, 12] });
  // 对比页专用底图：OSM（免 key、与 windy 观感接近，方便同框对比）；主 demo 的
  // 天地图口径不变（key 门控，见 basemaps.ts）——两层底图策略按页各取所需
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "底图 © OpenStreetMap 贡献者",
    maxZoom: 18,
  }).addTo(map);

  // 点查询：点击读当地风（双线性采样，与粒子同源）——对比锚点：在 windy 点同一点
  // 读数对照，即可分辨「色卡映射差」与「数据差」（色可以不同档，数值该一致）
  map.on("click", (e: L.LeafletMouseEvent) => {
    const { lat, lng } = e.latlng;
    const uu = interpolateBilinear(u, lat, lng);
    const vv = interpolateBilinear(v, lat, lng);
    const content =
      Number.isNaN(uu) || Number.isNaN(vv)
        ? `${lat.toFixed(2)}°N ${lng.toFixed(2)}°E<br>场外（无数据）`
        : `${lat.toFixed(2)}°N ${lng.toFixed(2)}°E<br><b>${Math.hypot(uu, vv).toFixed(1)} m/s</b>` +
          `（u ${uu.toFixed(1)} / v ${vv.toFixed(1)}）<br>风向（来向）${Math.round((((270 - (Math.atan2(vv, uu) * 180) / Math.PI) % 360) + 360) % 360)}°`;
    L.popup().setLatLng(e.latlng).setContent(content).openOn(map);
  });

  // 色卡图例（windy 式底部左下横条）：12 档分格、界值标注——色与档界与色斑同一份
  // 档案色标（buildColorScale 单一来源），阈值档等宽分格（每格一档，界值即标签）
  const scale = buildColorScale(windProfile, speed.header.stats);
  const legend = document.createElement("div");
  legend.className = "wf-legend";
  const title = document.createElement("div");
  title.className = "wf-legend-title";
  title.textContent = `${windProfile.labelZh}（${windProfile.displayUnit}）`;
  const bar = document.createElement("div");
  bar.className = "wf-legend-bar";
  for (const c of scale.colors) {
    const seg = document.createElement("span");
    seg.className = "wf-legend-seg";
    seg.style.background = c;
    bar.append(seg);
  }
  const ticks = document.createElement("div");
  ticks.className = "wf-legend-ticks";
  const labels = ["0", ...scale.breaks.map((b) => String(b)), "+"];
  labels.forEach((t, i) => {
    const tick = document.createElement("span");
    tick.className = "wf-legend-tick";
    tick.textContent = t;
    tick.style.left = `${(i / (labels.length - 1)) * 100}%`;
    if (i === 0) tick.classList.add("first");
    if (i === labels.length - 1) tick.classList.add("last");
    ticks.append(tick);
  });
  legend.append(title, bar, ticks);
  map.getContainer().append(legend);

  let gridLayer: L.ImageOverlay | undefined;
  let barbLayer: L.LayerGroup | undefined;
  let streamLayer: L.LayerGroup | undefined;
  let arrowLayer: ArrowFieldLayer | undefined;
  let particle: ParticleLayer | undefined;
  let speedFactor = 2;

  const applyGrid = async (on: boolean): Promise<void> => {
    if (gridLayer !== undefined) {
      map.removeLayer(gridLayer);
      gridLayer = undefined;
    }
    if (on) gridLayer = await addGridLayer(map, speed, windProfile, { opacity: 0.55 });
  };
  const applyBarbs = async (on: boolean): Promise<void> => {
    if (barbLayer !== undefined) {
      map.removeLayer(barbLayer);
      barbLayer = undefined;
    }
    if (on) barbLayer = await addWindBarbLayer(map, u, v, windProfile);
  };
  const applyStream = async (on: boolean): Promise<void> => {
    if (streamLayer !== undefined) {
      map.removeLayer(streamLayer);
      streamLayer = undefined;
    }
    if (on) {
      // 密度是种子撒法的选择：8 格一线在中国域约 35×26 颗种子，够看清形态不糊图
      const lines = streamlinesOf(u, v, { seedSpacing: 8, maxSteps: 300, step: 0.4 });
      streamLayer = await addStreamlineLayer(map, lines, { width: 1.2, opacity: 0.8 });
    }
  };
  const applyArrows = async (on: boolean): Promise<void> => {
    arrowLayer?.remove();
    arrowLayer = undefined;
    if (on) {
      // 演示页箭头指**去向**（与粒子流向一致，免得同屏方向打架）；库缺省指来向
      // （业务惯例、与 windArrowPath 同契约）——同一面图不要混用两种指向
      const arrows = arrowFieldOf(u, v, { step: 12 });
      arrowLayer = await addArrowFieldLayer(map, arrows, { pointing: "to", length: 13 });
    }
  };
  const applyParticle = async (on: boolean): Promise<void> => {
    particle?.remove();
    particle = undefined;
    if (on) {
      // windy 惯例：**白色**粒子叠在彩色色斑上——色斑答「多大」（分档色）、白粒子答
      // 「去哪」（流动感），白在暖色斑上恒可辨。高密度＋短尾（5000 同时是批次止损线
      // 的核验数，达标线：本机 ≥60fps）
      particle = await addParticleLayer(map, u, v, {
        count: 5000,
        speedFactor,
        fade: 0.945,
        width: 1.1,
        color: "#ffffff",
      });
    }
  };

  const wire = (id: string, apply: (on: boolean) => Promise<void>): void => {
    const box = inputById(id);
    if (box === null) return;
    box.addEventListener("change", () => void apply(box.checked));
    void apply(box.checked);
  };
  wire("wf-on-grid", applyGrid);
  wire("wf-on-barbs", applyBarbs);
  wire("wf-on-stream", applyStream);
  wire("wf-on-arrows", applyArrows);
  wire("wf-on-particle", applyParticle);

  const speedBox = inputById("wf-speed");
  const speedOut = document.getElementById("wf-speed-out");
  if (speedBox !== null && speedOut !== null) {
    speedBox.addEventListener("input", () => {
      speedFactor = Number(speedBox.value);
      speedOut.textContent = `×${String(speedFactor)}`;
      const box = inputById("wf-on-particle");
      if (box?.checked) void applyParticle(true); // remove+add 换速（v0.3.4：原地调速留后续）
    });
  }

  // 帧率表（性能面随行可见——批次的粒子止损线要的就是这个数）
  const cycle = u.header.meta.referenceTime;
  let frames = 0;
  let t0 = performance.now();
  const tick = (): void => {
    frames += 1;
    const now = performance.now();
    if (now - t0 >= 500 && status !== null) {
      const fps = Math.round((frames * 1000) / (now - t0));
      status.textContent = `${String(fps)} fps · 5000 白粒子 · 数据时次 ${cycle}`;
      frames = 0;
      t0 = now;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})().catch((error: unknown) => {
  if (status !== null) {
    status.textContent = `装载失败：${error instanceof Error ? error.message : String(error)}`;
  }
});
