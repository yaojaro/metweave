/**
 * 「风不是一个数」演示页（v0.3.2 风批次的可看面）：把本批新增/改动的四个公开件串在一页上——
 *
 * - `renderWindChip`（T4）：同一份风组 IR 的三种状态（有风 / 静风 / 缺测）；
 * - `renderWindLegend`（T6）：两套填图口径的刻度，单位切换会重绘下方图形；
 * - `windBarbPath`（T2）：同一风速在 m/s 与 kt 两套口径下的杆形差异；
 * - `windArrowPath`（T3）：纯方向件，与风羽并排看「速度编码」到底多给了什么信息；
 * - `windBarbOf`（T1）：每枚风羽下方的编码计数（旗/长划/短划）由内核算出，页面上不写死数字。
 *
 * 页面不接真实数据、不画地图：这是**看懂形态**的页，不是分析页（分析走首页格点面板与
 * 低空面板）。风羽的旋转与叶片几何同 leaflet 层的 divIcon 一致（`rotate(deg 16 16)`）。
 */
import { parse } from "metweave";
import { renderWindChip, renderWindLegend } from "metweave";
import { WIND_LEGEND_UNITS, toKnots, windBarbOf, type WindSpeedUnit } from "@metweave/grid";
import { addWindBarbGlyphs } from "@metweave/leaflet";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { arrowSvg, barbSvg } from "./wind-svg";
import "./style.css";

/** 图形统一用同一个风向（西南风 240°，杆身指向来向，读图时与风羽习惯一致） */
const SAMPLE_DIRECTION = 240;
/** 四档示例风速（m/s）：微风 / 强风 / 起旗 / 台风级 */
const SAMPLE_SPEEDS_MPS = [5, 10, 20, 33] as const;

/** 三条示例报文：有风带阵风 / 静风 / 缺测（都是 IR 层能表达的合法形态）。 */
const SAMPLE_REPORTS = [
  "METAR ZUUU 211200Z 24005G12MPS 3000 BR SCT020 18/16 Q1013",
  "METAR ZUUU 211200Z 00000MPS 0800 FG SCT002 12/11 Q1015",
  "METAR ZUUU 211200Z /////MPS 3000 BR SCT020 18/16 Q1013",
] as const;

/** 显示口径换算：只用 grid 的 `toKnots`（页面不写第二份常数）。 */
const speedIn = (mps: number, unit: WindSpeedUnit): number => (unit === "kt" ? toKnots(mps) : mps);

const text = (tag: "span" | "b" | "small", content: string): HTMLElement => {
  const node = document.createElement(tag);
  node.textContent = content;
  return node;
};

/** ① 数值牌：三条报文 → 三张牌（有风 / 静风 / 缺测）。 */
const mountChips = (): void => {
  const box = document.getElementById("wd-chips");
  if (box === null) return;
  const cells = SAMPLE_REPORTS.map((raw) => {
    const cell = document.createElement("div");
    cell.className = "wd-chip-cell";
    cell.append(renderWindChip(parse(raw)));
    // 报文原文里那一组（方便逐字对照牌上的数字）
    const code = text(
      "small",
      `报文：${raw.replace(/^METAR\s+\S+\s+\S+\s+/, "").split(" ")[0] ?? ""}`,
    );
    cell.append(code);
    return cell;
  });
  box.replaceChildren(...cells);
};

/** ③ 图形矩阵：四档风速 × 两形态（口径随图例切换重绘）。 */
const mountGlyphs = (unit: WindSpeedUnit): void => {
  const box = document.getElementById("wd-glyphs");
  if (box === null) return;
  const rows = SAMPLE_SPEEDS_MPS.map((mps) => {
    const row = document.createElement("div");
    row.className = "wd-glyph-row";
    const display = speedIn(mps, unit);
    // 行标始终把「报文单位的值」和「当前口径的值」都写出来——否则切到 kt 后
    // 「5 m/s … 编码 5 kt」看起来像没换算（产品审查 5.2）
    row.append(text("b", unit === "m/s" ? `${mps} m/s` : `${mps} m/s ≈ ${display.toFixed(1)} kt`));

    // 列名统一在表头（.wd-glyphs-head）里说，行内只放图——否则每行重复四个字，行高翻倍
    const barbCell = document.createElement("div");
    barbCell.className = "wd-glyph-cell";
    barbCell.append(barbSvg(SAMPLE_DIRECTION, display, unit));
    row.append(barbCell);

    const arrowCell = document.createElement("div");
    arrowCell.className = "wd-glyph-cell";
    // 箭头缺省指「来向」＝与左边风羽杆同向（同一页不混用两种约定）
    arrowCell.append(arrowSvg(SAMPLE_DIRECTION));
    row.append(arrowCell);

    // 读数由库里现算（页面不写死数字——口径变了它会跟着变）
    const enc = windBarbOf(SAMPLE_DIRECTION, display, { unit });
    const truncated = Math.round((display - (enc?.encodedSpeed ?? 0)) * 10) / 10;
    const marks =
      enc === null
        ? "静风：不出杆"
        : `旗 ${enc.pennants} · 长划 ${enc.longs} · 短划 ${enc.shorts} ｜ 编码 ${Math.round(enc.encodedSpeed * 10) / 10} ${unit}` +
          (truncated > 0 ? `（向下取整 −${truncated}）` : "");
    row.append(text("small", marks));
    return row;
  });
  box.replaceChildren(...rows);
};

/** ② 图例 + 切换联动：图例只做显示与回调，口径数字来自 grid 的单一常量表。 */
const mountLegend = (): void => {
  const slot = document.getElementById("wd-legend");
  if (slot === null) return;
  // 图例口径直接用 grid 的现成表（一行；数字仍单源）
  const units = WIND_LEGEND_UNITS;
  const legend = renderWindLegend({
    units,
    unit: "m/s",
    onUnitChange: (id) => {
      // 类型守卫收窄（不裸断言）：只认两套口径，其余忽略
      if (id === "m/s" || id === "kt") mountGlyphs(id);
    },
  });
  slot.replaceChildren(legend);
};

/**
 * ④ 单站上图：**没有格点场**时的入口演示。四个站、四根杆，数据是常量——
 * 这正是产品审查 1.4 指出的场景（手上有 METAR 的风，想画一根杆）。
 * 不加载底图（避免任何 key/审图号问题），只放杆。
 */
const SAMPLE_STATIONS = [
  { name: "成都", lat: 30.58, lon: 103.95, direction: 240, speed: 5 },
  { name: "北京", lat: 39.51, lon: 116.41, direction: 20, speed: 9 },
  { name: "广州", lat: 23.39, lon: 113.3, direction: 160, speed: 14 },
  { name: "上海", lat: 31.23, lon: 121.47, direction: 90, speed: 22 },
] as const;

const mountMiniMap = (): void => {
  const host = document.getElementById("wd-mini-map");
  if (host === null) return;
  const map = L.map(host, {
    center: [31, 114],
    zoom: 4,
    zoomControl: false,
    attributionControl: false,
  });
  void addWindBarbGlyphs(
    map,
    SAMPLE_STATIONS.map(({ lat, lon, direction, speed }) => ({ lat, lon, direction, speed })),
  );
  // 站名标注（杆本身不立可读名称——杆海是视觉件，单站场景才补标签）
  for (const station of SAMPLE_STATIONS) {
    L.marker([station.lat, station.lon], {
      interactive: false,
      icon: L.divIcon({ className: "wd-station-pin", html: "", iconSize: [1, 1] }),
    })
      .bindTooltip(station.name, {
        permanent: true,
        direction: "right",
        offset: [8, -6],
        className: "wd-station-label",
      })
      .addTo(map);
  }
};

mountChips();
mountLegend();
mountGlyphs("m/s");
mountMiniMap();
