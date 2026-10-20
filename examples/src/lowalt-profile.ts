/**
 * 低空航路天气面板 · 数据模型与渲染纯函数内核（2026-10-20，场景演示件）。
 *
 * 职责边界：Open-Meteo 沿航线多高度层取数的 URL 拼装、时刻索引、风向/风速人话化、
 * 风速配色分档、SVG 剖面图与表格卡两版渲染、晨昏条——全部纯函数/纯 DOM 构造，
 * 「现在」以参数注入（localNow / nowMs），与 timeline-core 同纪律：单测钉时间，不碰系统时钟。
 * 宿主（lowalt-main）只做取数编排与降级，不掺渲染逻辑。
 *
 * 数据口径：Open-Meteo 近地面多层（10/80/120/180m）为其模型层原生输出，风速单位按请求
 * 固定 m/s（wind_speed_unit=ms）与 METAR 口径一致；风向为来向（气象惯例）。城市楼宇间
 * 真实风与模式近地面风存在系统差——粗判够展示、不够判决（适飞判据不在本演示范围）。
 */

export const HEIGHT_LEVELS = [10, 80, 120, 180] as const;
export type HeightLevel = (typeof HEIGHT_LEVELS)[number];

export interface RoutePoint {
  readonly id: string;
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
}

/** 兴隆湖→龙泉山示意航线采样点（直线等分取点，坐标为示意；真实作业以获批航线为准） */
export const ROUTE_POINTS: readonly RoutePoint[] = [
  { id: "P0", name: "兴隆湖", lat: 30.44, lon: 104.07 },
  { id: "P1", name: "城区南", lat: 30.47, lon: 104.13 },
  { id: "P2", name: "平原中段", lat: 30.505, lon: 104.185 },
  { id: "P3", name: "山前", lat: 30.54, lon: 104.24 },
  { id: "P4", name: "龙泉山", lat: 30.56, lon: 104.27 },
];

export const METAR_STATIONS = ["ZUUU", "ZUTF"] as const;
export const TAF_STATION = "ZUTF";

// ---------------------------------------------------------------- Open-Meteo 请求与响应模型

const OW_HOURLY_VARS = [
  "wind_speed_10m",
  "wind_speed_80m",
  "wind_speed_120m",
  "wind_speed_180m",
  "wind_direction_10m",
  "wind_direction_80m",
  "wind_direction_120m",
  "wind_direction_180m",
  "temperature_2m",
  "dew_point_2m",
  "cloud_cover",
  "cape",
  "precipitation",
  "weather_code",
] as const;

/** Open-Meteo 预报请求 URL（多点多层单请求；单位 m/s 对齐 METAR；北京时；48 小时） */
export const owForecastUrl = (points: readonly { lat: number; lon: number }[]): string =>
  `https://api.open-meteo.com/v1/forecast` +
  `?latitude=${points.map((p) => p.lat).join(",")}` +
  `&longitude=${points.map((p) => p.lon).join(",")}` +
  `&hourly=${OW_HOURLY_VARS.join(",")}` +
  `&daily=sunrise,sunset&wind_speed_unit=ms&timezone=Asia%2FShanghai&forecast_days=2`;

export type NumOrNull = number | null;

export interface OwHourly {
  readonly time: readonly string[];
  readonly wind_speed_10m: readonly NumOrNull[];
  readonly wind_speed_80m: readonly NumOrNull[];
  readonly wind_speed_120m: readonly NumOrNull[];
  readonly wind_speed_180m: readonly NumOrNull[];
  readonly wind_direction_10m: readonly NumOrNull[];
  readonly wind_direction_80m: readonly NumOrNull[];
  readonly wind_direction_120m: readonly NumOrNull[];
  readonly wind_direction_180m: readonly NumOrNull[];
  readonly temperature_2m: readonly NumOrNull[];
  readonly dew_point_2m: readonly NumOrNull[];
  readonly cloud_cover: readonly NumOrNull[];
  readonly cape: readonly NumOrNull[];
  readonly precipitation: readonly NumOrNull[];
  readonly weather_code: readonly NumOrNull[];
}

export interface OwDaily {
  readonly time: readonly string[];
  readonly sunrise: readonly string[];
  readonly sunset: readonly string[];
}

export interface OwPointForecast {
  readonly latitude: number;
  readonly longitude: number;
  readonly elevation: number;
  readonly hourly: OwHourly;
  readonly daily?: OwDaily;
}

/**
 * 响应形状守卫（沿 sources 层「unknown 收窄靠守卫不靠断言」纪律）：核对渲染层承重的最小骨架——
 * 经纬数值与 hourly.time 字符串数组；各要素数组不逐一深检（缺字段由 null 容错渲染兜「—」）。
 */
export const isOwPointForecast = (x: unknown): x is OwPointForecast => {
  if (typeof x !== "object" || x === null) return false;
  if (!("latitude" in x) || !("longitude" in x) || !("elevation" in x) || !("hourly" in x)) {
    return false;
  }
  if (typeof x.latitude !== "number" || typeof x.longitude !== "number") return false;
  const hourly: unknown = x.hourly;
  if (typeof hourly !== "object" || hourly === null || !("time" in hourly)) return false;
  return Array.isArray(hourly.time) && hourly.time.every((t) => typeof t === "string");
};

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** 北京时「YYYY-MM-DDTHH:00」串（与 Open-Meteo timezone=Asia/Shanghai 的时刻粒度对齐） */
export const localHourStrOf = (nowMs: number, utcOffsetMinutes = 480): string => {
  const d = new Date(nowMs + utcOffsetMinutes * 60_000);
  return (
    `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}` +
    `T${pad2(d.getUTCHours())}:00`
  );
};

/** 时刻索引：time（ISO 升序）中 ≤ localNow 的最大索引；全部晚于 now → 0（首格，不越界） */
export const hourIndexAt = (times: readonly string[], localNow: string): number => {
  let idx = 0;
  for (let i = 0; i < times.length; i += 1) {
    const t = times[i];
    if (t !== undefined && t <= localNow) idx = i;
  }
  return idx;
};

/** 毫秒序 → 「M月D日 HH:00」北京时展示串（时刻滑杆标签用） */
export const hourLabelOf = (isoHour: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):/.exec(isoHour);
  if (m === null) return isoHour;
  return `${m[2]}月${Number(m[3])}日 ${m[4]}:00`;
};

// ---------------------------------------------------------------- 人话化与配色

const COMPASS8 = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"] as const;

/** 风向（来向，度）→ 八方位中文；越界归一；缺失 → null */
export const compassOf = (dir: NumOrNull): string | null => {
  if (dir === null || dir === undefined || Number.isNaN(dir)) return null;
  return COMPASS8[((Math.round(dir / 45) % 8) + 8) % 8] ?? null;
};

/** 风速配色分档（m/s）——扫视参考档，非标准分级；数值印在格内承信息主责 */
export const WIND_BUCKETS = [
  { max: 3, color: "#dff0df", label: "<3" },
  { max: 6, color: "#bfe3bf", label: "3–6" },
  { max: 9, color: "#f2e3b3", label: "6–9" },
  { max: 12, color: "#f0c894", label: "9–12" },
  { max: 15, color: "#e8a87c", label: "12–15" },
  { max: Number.POSITIVE_INFINITY, color: "#e2847a", label: "≥15" },
] as const;

export const windBucketOf = (
  speedMs: NumOrNull,
): { readonly color: string; readonly label: string } | null => {
  if (speedMs === null || speedMs === undefined || Number.isNaN(speedMs)) return null;
  for (const b of WIND_BUCKETS) {
    if (speedMs < b.max) return { color: b.color, label: b.label };
  }
  return WIND_BUCKETS[WIND_BUCKETS.length - 1] ?? null;
};

/** 风向箭头旋转角（度）：箭头指向风的去向＝来向 +180（SVG 坐标 0°=朝上=北） */
export const arrowRotationOf = (dir: NumOrNull): number | null => {
  if (dir === null || dir === undefined || Number.isNaN(dir)) return null;
  return (dir + 180) % 360;
};

/** 单元格风况文本：「6.7」+ 方位；缺失 → null（调用方渲「—」） */
export const windCellTextOf = (
  speed: NumOrNull,
  dir: NumOrNull,
): { readonly speed: string; readonly compass: string | null } | null => {
  if (speed === null || speed === undefined || Number.isNaN(speed)) return null;
  return { speed: speed.toFixed(1), compass: compassOf(dir) };
};

const numAt = (arr: readonly NumOrNull[] | undefined, i: number): NumOrNull => arr?.[i] ?? null;

const levelSpeedOf = (h: OwHourly, level: HeightLevel, i: number): NumOrNull =>
  numAt(h[`wind_speed_${level}m`], i);
const levelDirOf = (h: OwHourly, level: HeightLevel, i: number): NumOrNull =>
  numAt(h[`wind_direction_${level}m`], i);

// ---------------------------------------------------------------- 渲染件（纯 DOM 构造）

const SVG_NS = "http://www.w3.org/2000/svg";
const svgEl = (tag: string, attrs: Record<string, string | number>): SVGElement => {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
};
const htmlEl = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  if (className !== undefined) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
};

// ---------------------------------------------------------------- 航线采样（用户自设航路的基础）

export interface Waypoint {
  readonly lat: number;
  readonly lon: number;
}

export interface SamplePoint {
  readonly lat: number;
  readonly lon: number;
  readonly distKm: number;
}

const EARTH_R_KM = 6371;

/** 两点大圆距离（km）——小范围航线里程与采样的基础 */
export const haversineKm = (a: Waypoint, b: Waypoint): number => {
  const p1 = (a.lat * Math.PI) / 180;
  const p2 = (b.lat * Math.PI) / 180;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R_KM * Math.asin(Math.sqrt(h));
};

export const MAX_SAMPLES = 12;

/**
 * 折线等弧长采样：沿航点序列按 stepKm 均匀取气象采样点（含起终点，至多 MAX_SAMPLES）。
 * 二十余公里量级的经纬插值用线性近似即可，误差远小于模式分辨率。
 */
export const resampleRoute = (waypoints: readonly Waypoint[], stepKm = 2): SamplePoint[] => {
  if (waypoints.length < 2) return [];
  const cum: number[] = [0];
  for (let i = 1; i < waypoints.length; i += 1) {
    const prev = waypoints[i - 1];
    const cur = waypoints[i];
    if (prev === undefined || cur === undefined) return [];
    const prevCum = cum[i - 1];
    if (prevCum === undefined) return [];
    cum.push(prevCum + haversineKm(prev, cur));
  }
  const total = cum[cum.length - 1] ?? 0;
  if (!(total > 0)) return [];
  const count = Math.min(MAX_SAMPLES, Math.max(2, Math.ceil(total / stepKm) + 1));
  const samples: SamplePoint[] = [];
  for (let j = 0; j < count; j += 1) {
    const d = (total * j) / (count - 1);
    let k = 0;
    for (let i = 0; i < cum.length - 1; i += 1) {
      if ((cum[i] ?? 0) <= d) k = i;
    }
    const segStart = cum[k] ?? 0;
    const segEnd = cum[k + 1] ?? segStart;
    const t = segEnd > segStart ? (d - segStart) / (segEnd - segStart) : 0;
    const a = waypoints[k];
    const b = waypoints[k + 1];
    if (a === undefined || b === undefined) continue;
    samples.push({
      lat: a.lat + (b.lat - a.lat) * t,
      lon: a.lon + (b.lon - a.lon) * t,
      distKm: d,
    });
  }
  return samples;
};

// ---------------------------------------------------------------- 天气风险（参考提示口径，非运行判据）

/** 演示参考阈值（m/s、J/kg、mm/h）——扫视提示口径，非机型适飞判据（判据属航线管道产品位） */
export const RISK_THRESHOLDS = {
  windMidMs: 7,
  windHighMs: 10,
  capeMid: 400,
  capeHigh: 1000,
  precipMidMm: 0.1,
  precipHighMm: 2,
} as const;

export type RiskLevel = "low" | "mid" | "high" | "unknown";

export interface RiskAssessment {
  readonly level: RiskLevel;
  readonly factors: readonly string[];
}

export const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
  low: "低",
  mid: "中",
  high: "高",
  unknown: "—",
};

export const RISK_LEVEL_COLOR: Record<RiskLevel, string> = {
  low: "#8fc98f",
  mid: "#e8b45c",
  high: "#d95f52",
  unknown: "#c9d3dd",
};

/** 最接近巡航真高的数据层（层间取近者） */
export const nearestLevelOf = (cruiseAlt: number): HeightLevel => {
  let best: HeightLevel = HEIGHT_LEVELS[0] ?? 10;
  for (const l of HEIGHT_LEVELS) {
    if (Math.abs(l - cruiseAlt) < Math.abs(best - cruiseAlt)) best = l;
  }
  return best;
};

const bumpRisk = (cur: RiskLevel, incoming: "mid" | "high"): RiskLevel =>
  cur === "high" || incoming === "high" ? "high" : "mid";

/** 单采样点、单时刻的风险评估：风（巡航最近层）+ 对流（CAPE）+ 降水 → 最高档与因子明细 */
export const riskAtOf = (h: OwHourly, hourIndex: number, cruiseAlt: number): RiskAssessment => {
  const factors: string[] = [];
  let level: RiskLevel = "low";
  let hasData = false;

  const windLevel = nearestLevelOf(cruiseAlt);
  const speed = levelSpeedOf(h, windLevel, hourIndex);
  if (speed !== null) {
    hasData = true;
    if (speed >= RISK_THRESHOLDS.windHighMs) {
      level = bumpRisk(level, "high");
      factors.push(
        `${windLevel}m 风速 ${speed.toFixed(1)} m/s（≥${RISK_THRESHOLDS.windHighMs}，偏大）`,
      );
    } else if (speed >= RISK_THRESHOLDS.windMidMs) {
      level = bumpRisk(level, "mid");
      factors.push(
        `${windLevel}m 风速 ${speed.toFixed(1)} m/s（≥${RISK_THRESHOLDS.windMidMs}，需留意）`,
      );
    }
  }

  const cape = numAt(h.cape, hourIndex);
  if (cape !== null) {
    hasData = true;
    if (cape >= RISK_THRESHOLDS.capeHigh) {
      level = bumpRisk(level, "high");
      factors.push(`CAPE ${cape.toFixed(0)} J/kg（≥${RISK_THRESHOLDS.capeHigh}，对流苗头）`);
    } else if (cape >= RISK_THRESHOLDS.capeMid) {
      level = bumpRisk(level, "mid");
      factors.push(`CAPE ${cape.toFixed(0)} J/kg（≥${RISK_THRESHOLDS.capeMid}，留意对流）`);
    }
  }

  const precip = numAt(h.precipitation, hourIndex);
  if (precip !== null) {
    hasData = true;
    if (precip >= RISK_THRESHOLDS.precipHighMm) {
      level = bumpRisk(level, "high");
      factors.push(`降水 ${precip.toFixed(1)} mm/h（≥${RISK_THRESHOLDS.precipHighMm}）`);
    } else if (precip >= RISK_THRESHOLDS.precipMidMm) {
      level = bumpRisk(level, "mid");
      factors.push(`降水 ${precip.toFixed(1)} mm/h（≥${RISK_THRESHOLDS.precipMidMm}，留意）`);
    }
  }

  if (!hasData) return { level: "unknown", factors: ["该时刻数据缺失"] };
  if (factors.length === 0) factors.push("各参考要素均在演示阈值内");
  return { level, factors };
};

// ---------------------------------------------------------------- 沿程-高度剖面（主线图）

export interface RouteProfileOptions {
  readonly samples: readonly SamplePoint[];
  readonly hourIndex: number;
  readonly cruiseAlt: number;
  readonly risks: readonly RiskAssessment[];
  readonly waypointMarks: readonly {
    readonly distKm: number;
    readonly label: string;
  }[];
}

const CHART_MIN_W = 560;
const CHART_PER_SAMPLE = 64;
const PROFILE_MAX_ALT = 200;

/**
 * 沿程-高度剖面（主线图）：x＝沿航线里程，y＝真高（数据层按真实高度布带）；
 * 背景色带＝各位置各层风速；红色横线＝当前巡航真高的飞行轨迹；顶部徽标行＝
 * 各采样点参考风险（悬停见因子明细）。演示参考口径，非运行判据。
 */
export const renderRouteProfileSvg = (
  forecasts: readonly OwPointForecast[],
  opts: RouteProfileOptions,
): SVGElement => {
  const labelW = 46;
  const padR = 12;
  const riskRowH = 30;
  const headH = 16;
  const areaH = 168;
  const chartW = Math.max(CHART_MIN_W, opts.samples.length * CHART_PER_SAMPLE);
  const width = labelW + chartW + padR;
  const areaTop = riskRowH + headH;
  const baseY = areaTop + areaH;
  const height = baseY + 46;
  const totalKm = opts.samples[opts.samples.length - 1]?.distKm ?? 0;
  const xOf = (distKm: number): number => labelW + (totalKm > 0 ? distKm / totalKm : 0) * chartW;
  const yOf = (alt: number): number => areaTop + (1 - alt / PROFILE_MAX_ALT) * areaH;

  const svg = svgEl("svg", {
    viewBox: `0 0 ${width} ${height}`,
    width: String(width),
    role: "img",
    class: "lw-profile-svg",
  });

  // 顶部：风险徽标行（每采样点一枚；悬停 title 出因子明细）
  for (let i = 0; i < opts.samples.length; i += 1) {
    const s = opts.samples[i];
    const risk = opts.risks[i];
    if (s === undefined || risk === undefined) continue;
    const cx = xOf(s.distKm);
    const badge = svgEl("circle", {
      cx,
      cy: riskRowH / 2 + 2,
      r: 10,
      fill: RISK_LEVEL_COLOR[risk.level],
      class: "lw-risk-badge",
    });
    const tip = svgEl("title", {});
    tip.textContent = `里程 ${s.distKm.toFixed(1)}km · 风险${RISK_LEVEL_LABEL[risk.level]}：${risk.factors.join("；")}`;
    badge.append(tip);
    svg.append(badge);
    const tag = svgEl("text", {
      x: cx,
      y: riskRowH / 2 + 6,
      "text-anchor": "middle",
      class: "lw-risk-badge-text",
    });
    tag.textContent = RISK_LEVEL_LABEL[risk.level];
    svg.append(tag);
  }

  // 风速色带：每采样点 × 每层，x＝相邻采样点中点分段，y＝层真实高度带（相邻层中点分界）。
  // 布带与 bandEdges 同序（高度向上递增）：10m→[0,45]、80m→[45,100]、120m→[100,150]、180m→[150,200]——
  // 轨迹线 yOf(巡航真高) 必须与层带同一坐标系，否则「写的高 120」和画的 120 对不上（实测踩坑）
  const bandEdges = [0];
  for (let i = 0; i < HEIGHT_LEVELS.length - 1; i += 1) {
    const a = HEIGHT_LEVELS[i];
    const b = HEIGHT_LEVELS[i + 1];
    if (a !== undefined && b !== undefined) bandEdges.push((a + b) / 2);
  }
  bandEdges.push(PROFILE_MAX_ALT);
  for (let li = 0; li < HEIGHT_LEVELS.length; li += 1) {
    const level = HEIGHT_LEVELS[li];
    if (level === undefined) continue;
    const altLo = bandEdges[li] ?? 0;
    const altHi = bandEdges[li + 1] ?? PROFILE_MAX_ALT;
    const yTop = yOf(altHi);
    const yBot = yOf(altLo);
    for (let i = 0; i < opts.samples.length; i += 1) {
      const f = forecasts[i];
      const s = opts.samples[i];
      if (f === undefined || s === undefined) continue;
      const distL = i === 0 ? 0 : (opts.samples[i - 1]?.distKm ?? 0);
      const distR =
        i === opts.samples.length - 1 ? totalKm : (opts.samples[i + 1]?.distKm ?? totalKm);
      const xL = i === 0 ? labelW : (xOf(distL) + xOf(s.distKm)) / 2;
      const xR = i === opts.samples.length - 1 ? width - padR : (xOf(s.distKm) + xOf(distR)) / 2;
      const speed = levelSpeedOf(f.hourly, level, opts.hourIndex);
      const bucket = windBucketOf(speed);
      svg.append(
        svgEl("rect", {
          x: xL + 1,
          y: yTop + 1,
          width: Math.max(xR - xL - 2, 2),
          height: Math.max(yBot - yTop - 2, 2),
          rx: 4,
          fill: bucket?.color ?? "#f0f0f0",
        }),
      );
      if (xR - xL >= 34) {
        const t = svgEl("text", {
          x: (xL + xR) / 2,
          y: (yTop + yBot) / 2 + 4,
          "text-anchor": "middle",
          class: "lw-profile-celltext",
        });
        t.textContent = bucket === null ? "—" : (speed?.toFixed(1) ?? "—");
        svg.append(t);
      }
    }
    const rowLabel = svgEl("text", {
      x: 6,
      y: (yTop + yBot) / 2 + 4,
      class: "lw-profile-rowlabel",
    });
    rowLabel.textContent = `${level}m`;
    svg.append(rowLabel);
  }

  // 巡航轨迹线（当前真高等高横线）＋标注
  const ty = yOf(opts.cruiseAlt);
  svg.append(
    svgEl("line", {
      x1: labelW,
      y1: ty,
      x2: width - padR,
      y2: ty,
      class: "lw-route-line",
    }),
  );
  // 标注放右端：左端起位会压住前几个采样格的数值文字
  const tl = svgEl("text", {
    x: width - padR - 4,
    y: ty - 5,
    "text-anchor": "end",
    class: "lw-route-label",
  });
  tl.textContent = `巡航真高 ${opts.cruiseAlt}m`;
  svg.append(tl);

  // 0m 地面基线＋里程刻度（航点位置）
  svg.append(
    svgEl("line", {
      x1: labelW,
      y1: baseY,
      x2: width - padR,
      y2: baseY,
      class: "lw-profile-baseline",
    }),
  );
  const baseLabel = svgEl("text", { x: 6, y: baseY + 4, class: "lw-profile-rowlabel" });
  baseLabel.textContent = "0m";
  svg.append(baseLabel);
  for (const m of opts.waypointMarks) {
    const x = xOf(m.distKm);
    svg.append(
      svgEl("line", { x1: x, y1: baseY, x2: x, y2: baseY + 5, class: "lw-profile-baseline" }),
    );
    const t = svgEl("text", {
      x,
      y: baseY + 17,
      "text-anchor": "middle",
      class: "lw-profile-legendtext",
    });
    t.textContent = m.label;
    svg.append(t);
  }

  // 图例：风险三档 + 风速分档
  const legendY = baseY + 34;
  const legendTitle = svgEl("text", { x: labelW, y: legendY, class: "lw-profile-legendtitle" });
  legendTitle.textContent = "风险";
  svg.append(legendTitle);
  let lx = labelW + 34;
  for (const lvl of ["low", "mid", "high"] as const) {
    svg.append(svgEl("circle", { cx: lx + 6, cy: legendY - 4, r: 6, fill: RISK_LEVEL_COLOR[lvl] }));
    const t = svgEl("text", { x: lx + 16, y: legendY, class: "lw-profile-legendtext" });
    t.textContent = RISK_LEVEL_LABEL[lvl];
    svg.append(t);
    lx += 16 + RISK_LEVEL_LABEL[lvl].length * 11 + 12;
  }
  const windTitle = svgEl("text", { x: lx + 8, y: legendY, class: "lw-profile-legendtitle" });
  windTitle.textContent = "风速 m/s";
  svg.append(windTitle);
  lx += 66;
  for (const b of WIND_BUCKETS) {
    svg.append(
      svgEl("rect", { x: lx, y: legendY - 10, width: 14, height: 12, rx: 3, fill: b.color }),
    );
    const t = svgEl("text", { x: lx + 17, y: legendY, class: "lw-profile-legendtext" });
    t.textContent = b.label;
    svg.append(t);
    lx += 17 + b.label.length * 9 + 12;
  }
  return svg;
};

/**
 * 表格卡（验收版 B）：同一数据同一时刻的语义化表格——表 1 风场（采样点 × 真高层，
 * 单元格＝风速 m/s＋八方位），表 2 地面要素（温度/露点/温露差/云量/CAPE/降水）。
 */
export const renderProfileTable = (
  points: readonly OwPointForecast[],
  hourIndex: number,
  samples: readonly SamplePoint[] = [],
): HTMLDivElement => {
  const labelOf = (i: number): string => {
    const s = samples[i];
    return s === undefined ? `S${i + 1}` : `${s.distKm.toFixed(1)}km`;
  };
  const wrap = htmlEl("div", "lw-table-wrap");

  const windTable = htmlEl("table", "lw-table");
  const head = windTable.createTHead().insertRow();
  for (const text of ["采样点", ...HEIGHT_LEVELS.map((l) => `${l}m`)]) {
    head.insertCell().textContent = text;
  }
  const body = windTable.createTBody();
  for (let r = 0; r < points.length; r += 1) {
    const p = points[r];
    if (p === undefined) continue;
    const row = body.insertRow();
    row.insertCell().textContent = labelOf(r);
    const h = p.hourly;
    for (const level of HEIGHT_LEVELS) {
      const cell = windCellTextOf(
        levelSpeedOf(h, level, hourIndex),
        levelDirOf(h, level, hourIndex),
      );
      row.insertCell().textContent = cell === null ? "—" : `${cell.speed} ${cell.compass ?? ""}`;
    }
  }
  wrap.append(windTable);

  const groundTable = htmlEl("table", "lw-table lw-table-ground");
  const gHead = groundTable.createTHead().insertRow();
  for (const text of ["地面要素", ...points.map((_, i) => labelOf(i))]) {
    gHead.insertCell().textContent = text;
  }
  const gBody = groundTable.createTBody();
  const gRows: readonly (readonly [string, (h: OwHourly, i: number) => string])[] = [
    ["温度 ℃", (h, i) => fmtNum(numAt(h.temperature_2m, i))],
    ["露点 ℃", (h, i) => fmtNum(numAt(h.dew_point_2m, i))],
    ["云量 %", (h, i) => fmtNum(numAt(h.cloud_cover, i))],
    ["CAPE J/kg", (h, i) => fmtNum(numAt(h.cape, i))],
    ["降水 mm/h", (h, i) => fmtNum(numAt(h.precipitation, i))],
  ];
  for (const [label, pick] of gRows) {
    const row = gBody.insertRow();
    row.insertCell().textContent = label;
    for (const p of points) {
      row.insertCell().textContent = pick(p.hourly, hourIndex);
    }
  }
  wrap.append(groundTable);
  return wrap;
};

const fmtNum = (v: NumOrNull): string => (v === null || v === undefined ? "—" : String(v));

/** ISO 本地时串「…THH:MM」→ 当日小时数（小数）；解析失败 → null */
const hmToHourOfDay = (iso: string | undefined): number | null => {
  const m = /T(\d{2}):(\d{2})/.exec(iso ?? "");
  if (m === null) return null;
  return Number(m[1]) + Number(m[2]) / 60;
};

/** 当日小时数 → 「HH:MM」；缺失 → 「—」 */
const fmtHm = (v: number | null): string =>
  v === null ? "—" : `${pad2(Math.floor(v))}:${pad2(Math.round((v % 1) * 60))}`;

/**
 * 晨昏条：0–24 时横条，昼段着色＋「现在」刻线；附日出/日落/昼长人话。
 * sunrise/sunset 为 ISO 本地串（Open-Meteo timezone 口径），解析失败诚实显示「—」。
 */
export const renderDaylightBar = (
  daily: OwDaily,
  dayIndex: number,
  localNow: string,
): HTMLDivElement => {
  const wrap = htmlEl("div", "lw-daylight");
  const bar = htmlEl("div", "lw-daylight-bar");
  const sunrise = hmToHourOfDay(daily.sunrise[dayIndex]);
  const sunset = hmToHourOfDay(daily.sunset[dayIndex]);
  if (sunrise !== null && sunset !== null) {
    const day = htmlEl("div", "lw-daylight-span");
    day.style.left = `${(sunrise / 24) * 100}%`;
    day.style.width = `${((sunset - sunrise) / 24) * 100}%`;
    bar.append(day);
  }
  const nowM = /^T(\d{2}):/.exec(localNow);
  if (nowM !== null) {
    const nowPct = (Number(nowM[1]) / 24) * 100;
    const now = htmlEl("div", "lw-daylight-now");
    now.style.left = `${nowPct}%`;
    now.title = "现在";
    bar.append(now);
  }
  wrap.append(bar);
  const length =
    sunrise !== null && sunset !== null
      ? `${Math.floor(sunset - sunrise)}小时${Math.round(((sunset - sunrise) % 1) * 60)}分`
      : "—";
  const caption = htmlEl(
    "p",
    "lw-daylight-caption",
    `日出 ${fmtHm(sunrise)} · 日落 ${fmtHm(sunset)} · 昼长 ${length}（目视作业窗口参考，非运行判据）`,
  );
  wrap.append(caption);
  return wrap;
};
