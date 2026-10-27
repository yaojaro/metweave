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
  toKnots,
  windAt,
  windProfile,
  windSpeedGrid,
  type Grid,
  type WindSpeedUnit,
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
import { renderColorScaleLegend } from "metweave";
import { inputById } from "./shared";
import "leaflet/dist/leaflet.css";
import "./style.css";

const loadGrid = async (file: string): Promise<Grid> => {
  const res = await fetch(`/data/grid/${file}`);
  if (!res.ok) throw new Error(`装载 ${file} 失败：HTTP ${String(res.status)}`);
  return parseGrid(await res.arrayBuffer());
};

const status = document.getElementById("wf-status");

/**
 * 复选框→图层开关联线（模块级——不捕获页面局部）：apply 是异步的（add*Layer 内有
 * await），快速连点勾选框会交错——「关」先发、「开」的落地在后，终态与复选框相反。
 * 序列化排队＋换代令牌（过期请求不落地），终态恒等于最后一次勾选。
 */
const wire = (id: string, apply: (on: boolean) => Promise<void>): void => {
  const box = inputById(id);
  if (box === null) return;
  let gen = 0;
  let tail: Promise<void> = Promise.resolve();
  const request = (on: boolean): void => {
    const mine = ++gen;
    tail = tail.then(() => (mine === gen ? apply(on) : undefined));
  };
  box.addEventListener("change", () => request(box.checked));
  request(box.checked);
};

void (async () => {
  const [u, v] = await Promise.all([loadGrid("windu_cn.mwgrid"), loadGrid("windv_cn.mwgrid")]);
  const speed = windSpeedGrid(u, v);
  const map = L.map("wf-map", { center: [35, 105], zoom: 4 });
  map.fitBounds(gridOverlayBounds(u), { padding: [12, 12] });
  // 对比页专用底图：OSM 标准层（owner 2026-10-27 裁定用回；官方瓦片自带地名标注，
  // 官方无「无标注」变体——要纯图时可换 CARTO light_nolabels：OSM 数据免 key 无地名）；
  // 主 demo 的天地图口径不变（key 门控，见 basemaps.ts）
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "底图 © OpenStreetMap 贡献者",
    maxZoom: 18,
  }).addTo(map);

  // 显示口径（页面级记忆，默认 m/s）：切 kt 时图例界值/点查询读数/风羽杆形三处联动；
  // 色斑档位是档案固定域不随口径切（主 demo 同口径——换算只发生在显示侧）
  let unit: WindSpeedUnit = "m/s";
  const fmtValue = (mps: number): string =>
    unit === "kt" ? toKnots(mps).toFixed(1) : mps.toFixed(1);

  // 点查询：点击读当地风（库的点查询原语 windAt——双线性采样与粒子同源，读数数学
  // 单源在内核）——对比锚点：在 windy 点同一点读数对照，即可分辨「色卡映射差」
  // 与「数据差」（色可以不同档，数值该一致）
  map.on("click", (e: L.LeafletMouseEvent) => {
    const { lat, lng } = e.latlng;
    const w = windAt(u, v, lat, lng);
    const content =
      w === null
        ? `${lat.toFixed(2)}°N ${lng.toFixed(2)}°E<br>场外（无数据）`
        : `${lat.toFixed(2)}°N ${lng.toFixed(2)}°E<br><b>${fmtValue(w.speed)} ${unit}</b>` +
          `（u ${fmtValue(w.u)} / v ${fmtValue(w.v)}）<br>风向（来向）${Math.round(w.direction)}°`;
    L.popup().setLatLng(e.latlng).setContent(content).openOn(map);
  });

  // 色卡图例（windy 式底部左下横条）：分格形态（每格一档、界值即标签）——
  // 色与档界与色斑同一份档案色标（buildColorScale 单一来源）；界值随显示口径换算。
  // 组件来自 @metweave/render 的 renderColorScaleLegend（页内不再手搓第二份图例）
  const scale = buildColorScale(windProfile, speed.header.stats);
  let legendEl: HTMLElement | undefined;
  const mountLegend = (): void => {
    legendEl?.remove();
    legendEl = renderColorScaleLegend(scale, {
      mode: "categorical",
      title: `${windProfile.labelZh}（${unit}）`,
      firstEdgeLabel: "0",
      formatValue: (mps) => fmtValue(mps),
    });
    legendEl.classList.add("wf-legend-pos"); // 页内只留定位（左下角悬浮），视觉全在组件
    map.getContainer().append(legendEl);
  };
  mountLegend();

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
    // unit 联动：kt 时杆形按国际航空口径重编码（旗 50/长划 10/短划 5——库层换算）
    if (on) barbLayer = await addWindBarbLayer(map, u, v, windProfile, { unit });
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

  // 五层开关（wire 的竞态纪律见模块层定义）
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

  // 单位切换（m/s ⇄ kt）：图例界值/标题、点查询读数、风羽杆形三处联动；
  // 色斑档位维持档案固定域（换算只发生在显示侧——跨口径可比的口径锚不变）
  const unitSel = document.getElementById("wf-unit");
  if (unitSel instanceof HTMLSelectElement) {
    unitSel.addEventListener("change", () => {
      unit = unitSel.value === "kt" ? "kt" : "m/s";
      mountLegend();
      const box = inputById("wf-on-barbs");
      if (box?.checked) void applyBarbs(true);
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
