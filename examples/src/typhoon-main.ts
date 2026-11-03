/**
 * 台风回放页（0.7 批次演示件）：`addTyphoonWindCircleLayer`（四象限风圈）＋
 * `addHazardPolygonLayer`（告警多边形呈现接口）的整页消费。
 *
 * 数据面（零网络、全部本地）：
 * - 路径与风圈＝中央气象台台风网公开接口的固化快照 `typhoon-dolphin-2613.json`
 *   （178 时次，2026-10-22 抓取）——本模块做一次**宽容归一**：快照的 `r` 表
 *   （"30KTS"/"50KTS"/"64KTS" → 四象限半径 km，序 NE/SE/SW/NW）转成组件的
 *   quadrants 契约；空 `r` 表（临消散时次）＝无任何级，组件只出中心标签。
 * - 告警多边形＝页内合成样例（境内无公开官方告警多边形数据源——组件只做呈现
 *   接口，样例数据在页面边界声明中点名）。
 *
 * 交互：时间滑杆逐时次选点，风圈层 remove+add 换时次（图层是纯函数装配，重建
 * 成本可忽略）；播放键按 55ms/时次推进；已走过的路径按强度六级着色（宿主侧
 * polyline——与图层正交）。
 */
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { addHazardPolygonLayer, addTyphoonWindCircleLayer } from "@metweave/leaflet";
import type { TyphoonWindCircle } from "@metweave/leaflet";
import dolphinFile from "../typhoon-dolphin-2613.json";
import { readDolphinPts, type DolphinPoint } from "./typhoon-data";
import { inputById } from "./shared";
import { osmBasemap } from "./basemaps";
import "./style.css";

const PTS: readonly DolphinPoint[] = readDolphinPts(dolphinFile);

/** 强度六级的中文与色（快照类别词 → 显示口径；六级色阶与图例同源）。 */
const GRADE_CN: Record<string, string> = {
  TD: "热带低压",
  TS: "热带风暴",
  STS: "强热带风暴",
  TY: "台风",
  STY: "强台风",
  SuperTY: "超强台风",
};
const GRADE_COLOR: Record<string, string> = {
  TD: "#94a3b8",
  TS: "#22c55e",
  STS: "#eab308",
  TY: "#f97316",
  STY: "#ef4444",
  SuperTY: "#a21caf",
};
const gradeColor = (g: string): string => GRADE_COLOR[g] ?? "#6b7785";

/** 快照时次串 → 显示（202607270600 → 07-27 06:00 UTC）。 */
const fmtTime = (t: string): string =>
  `${t.slice(4, 6)}-${t.slice(6, 8)} ${t.slice(8, 10)}:${t.slice(10, 12)} UTC`;

/** 快照 r 表 → 组件 quadrants 契约（键名 "30KTS" → speedKt 30；空表 → 空数组）。 */
const quadrantsOf = (p: DolphinPoint): TyphoonWindCircle["quadrants"] =>
  Object.entries(p.r).flatMap(([key, radii]) => {
    const m = /^(\d+)KTS$/.exec(key);
    const kt = m === null ? Number.NaN : Number(m[1]);
    if (!Number.isFinite(kt) || kt <= 0 || radii.length !== 4) return [];
    const radiiKm = [
      radii[0] ?? null,
      radii[1] ?? null,
      radii[2] ?? null,
      radii[3] ?? null,
    ] as const;
    return [{ speedKt: kt, radiiKm }];
  });

/** 快照逐点 → 风圈层输入（宽容归一：缺级＝无该级，空 r 表＝无象限）。 */
const toCircles = (): TyphoonWindCircle[] =>
  PTS.map((p) => ({
    time: fmtTime(p.t),
    center: [p.lat, p.lon] as [number, number],
    grade: p.g,
    pressureHpa: p.p,
    quadrants: quadrantsOf(p),
  }));

/** 告警多边形样例（页内合成——境内无公开官方告警多边形数据源，页面边界声明点名）。 */
const SAMPLE_HAZARDS = [
  {
    coords: [
      [25.4, 121.2],
      [25.8, 123.4],
      [24.2, 124.4],
      [22.8, 122.6],
      [23.2, 120.6],
    ] as [number, number][],
    label: "样例警戒区",
    kind: "大风黄色（样例数据）",
  },
] as const;

// ---------------------------------------------------------------- 装配

const mapEl = document.getElementById("ty-map");
const slider = inputById("ty-slider");
const playBtn = document.getElementById("ty-play");
const stamp = document.getElementById("ty-stamp");
const readout = document.getElementById("ty-readout");
if (mapEl === null || slider === null || playBtn === null || stamp === null || readout === null) {
  throw new Error("台风回放页 DOM 缺失（ty-map / ty-slider / ty-play / ty-stamp / ty-readout）");
}

const map = L.map(mapEl, { zoomControl: true, attributionControl: true });
osmBasemap().addTo(map); // OpenStreetMap 公共瓦片（无 key）——地理参照，见页脚边界声明
map.fitBounds(
  PTS.map((p) => [p.lat, p.lon] as L.LatLngTuple),
  { padding: [30, 30] },
);

// 图例（强度六级＋风圈三档——静态装配一次）
const legendGrades = document.getElementById("ty-legend-grades");
if (legendGrades !== null) {
  for (const [grade, cn] of Object.entries(GRADE_CN)) {
    const row = document.createElement("div");
    row.className = "ty-legend-row";
    const chip = document.createElement("i");
    chip.className = "ty-chip ty-chip-grade";
    chip.style.background = gradeColor(grade);
    row.append(chip, ` ${cn}（${grade}）`);
    legendGrades.append(row);
  }
}

// 已走过的路径（宿主侧 polyline，按强度着色——与图层正交）
const trackGroup = L.layerGroup().addTo(map);
const drawTrack = (upto: number): void => {
  trackGroup.clearLayers();
  for (let i = 0; i < upto && i < PTS.length - 1; i += 1) {
    const a = PTS[i];
    const b = PTS[i + 1];
    if (a === undefined || b === undefined) continue;
    L.polyline(
      [
        [a.lat, a.lon],
        [b.lat, b.lon],
      ],
      { color: gradeColor(a.g), weight: 2, opacity: 0.55 },
    ).addTo(trackGroup);
  }
};

// 风圈层：逐时次选点渲染（remove+add 换时次——纯函数装配，重建成本可忽略）
let circleLayer: L.LayerGroup | undefined;
const drawCircles = async (idx: number): Promise<void> => {
  if (circleLayer !== undefined) {
    map.removeLayer(circleLayer);
    circleLayer = undefined;
  }
  const point = PTS[idx];
  if (point === undefined) return;
  circleLayer = await addTyphoonWindCircleLayer(map, toCircles().slice(idx, idx + 1));
};

// 告警多边形样例（一次装载——呈现接口消费样例数据）
void addHazardPolygonLayer(map, SAMPLE_HAZARDS).catch((error: unknown) => {
  readout.textContent = `告警多边形层装载失败：${error instanceof Error ? error.message : String(error)}`;
});

/** 半径行的显示（该级缺席＝「—」——与图层 tooltip 同一口径）。 */
const fmtR = (radii: readonly number[] | undefined): string =>
  radii === undefined ? "—" : radii.join("/");

// 读数行（当前时次要素——快照字段直读，不做研判）
const drawReadout = (idx: number): void => {
  const p = PTS[idx];
  if (p === undefined) return;
  readout.replaceChildren();
  const items: [string, string][] = [
    ["时次", fmtTime(p.t)],
    ["强度", `${GRADE_CN[p.g] ?? p.g}（${p.g}） · 最大风速 ${p.w} m/s`],
    ["中心气压", `${p.p} hPa`],
    ["中心位置", `${p.lat.toFixed(1)}°N ${p.lon.toFixed(1)}°E`],
    ["移向/移速", `${p.mv} · ${p.ms} km/h`],
    ["七级风圈 NE/SE/SW/NW", `${fmtR(p.r["30KTS"])} km`],
    ["十级风圈", `${fmtR(p.r["50KTS"])} km`],
    ["十二级风圈", `${fmtR(p.r["64KTS"])} km`],
  ];
  for (const [k, v] of items) {
    const row = document.createElement("span");
    row.className = "ty-read-item";
    const key = document.createElement("b");
    key.textContent = k;
    row.append(key, ` ${v}`);
    readout.append(row);
  }
};

const apply = (idx: number): void => {
  drawTrack(idx);
  void drawCircles(idx);
  drawReadout(idx);
  stamp.textContent = `${fmtTime(PTS[idx]?.t ?? "")} · ${idx + 1}/${PTS.length}`;
  slider.value = String(idx);
};

slider.max = String(PTS.length - 1);
slider.addEventListener("input", () => {
  stopPlay();
  apply(Number(slider.value));
});

// 播放：55ms/时次（与验证件同节奏）；末帧再按即回绕到 0
let timer: ReturnType<typeof setInterval> | undefined;
const stopPlay = (): void => {
  if (timer === undefined) return;
  clearInterval(timer);
  timer = undefined;
  playBtn.textContent = "播放";
};
playBtn.addEventListener("click", () => {
  if (timer !== undefined) {
    stopPlay();
    return;
  }
  if (Number(slider.value) >= PTS.length - 1) apply(0);
  playBtn.textContent = "暂停";
  timer = setInterval(() => {
    const next = Number(slider.value) + 1;
    if (next >= PTS.length) {
      stopPlay();
      return;
    }
    apply(next);
  }, 55);
});

apply(0);
