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
export const owForecastUrl = (points: readonly RoutePoint[]): string =>
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

export interface ProfileSvgOptions {
  readonly hourIndex: number;
  readonly cellWidth?: number;
  readonly rowHeight?: number;
}

/**
 * 剖面图（验收版 A）：x＝沿线采样点（起飞端→降落端），y＝真高（10–180m，按真实高度布行），
 * 格＝该点该层的风速（配色分档＋数值＋风向箭头）。地图不依赖、纯 SVG，截图/缩放不糊。
 */
export const renderProfileSvg = (
  points: readonly OwPointForecast[],
  opts: ProfileSvgOptions,
): SVGElement => {
  const cellW = opts.cellWidth ?? 96;
  const rowH = opts.rowHeight ?? 40;
  const labelW = 52;
  const headH = 26;
  const width = labelW + points.length * cellW + 16;
  const height = headH + HEIGHT_LEVELS.length * rowH + 30;

  const svg = svgEl("svg", {
    viewBox: `0 0 ${width} ${height}`,
    width: "100%",
    role: "img",
    class: "lw-profile-svg",
  });

  // 列头：采样点名（与 ROUTE_POINTS 按序对齐——OwPointForecast 本身不含名号）
  for (let c = 0; c < points.length; c += 1) {
    const p = points[c];
    const label = svgEl("text", {
      x: labelW + c * cellW + cellW / 2,
      y: 17,
      "text-anchor": "middle",
      class: "lw-profile-colhead",
    });
    label.textContent =
      p === undefined ? "" : `${ROUTE_POINTS[c]?.id ?? ""} ${ROUTE_POINTS[c]?.name ?? ""}`.trim();
    svg.append(label);
  }

  // 行：真高层自顶向下布行（顶层在上；含 0m 地面基线刻度）＋格
  for (let r = 0; r < HEIGHT_LEVELS.length; r += 1) {
    const level = HEIGHT_LEVELS[HEIGHT_LEVELS.length - 1 - r];
    if (level === undefined) continue;
    const y = headH + r * rowH;
    const rowLabel = svgEl("text", { x: 6, y: y + rowH / 2 + 4, class: "lw-profile-rowlabel" });
    rowLabel.textContent = `${level}m`;
    svg.append(rowLabel);
    for (let c = 0; c < points.length; c += 1) {
      const point = points[c];
      if (point === undefined) continue;
      const h = point.hourly;
      const speed = levelSpeedOf(h, level, opts.hourIndex);
      const dir = levelDirOf(h, level, opts.hourIndex);
      const cell = windBucketOf(speed);
      const x = labelW + c * cellW;
      svg.append(
        svgEl("rect", {
          x: x + 3,
          y: y + 3,
          width: cellW - 6,
          height: rowH - 6,
          rx: 6,
          fill: cell?.color ?? "#f0f0f0",
        }),
      );
      const text = svgEl("text", {
        x: x + cellW / 2 - (dir === null ? 0 : 10),
        y: y + rowH / 2 + 5,
        "text-anchor": "middle",
        class: "lw-profile-celltext",
      });
      text.textContent = cell === null ? "—" : (speed?.toFixed(1) ?? "—");
      svg.append(text);
      const rot = arrowRotationOf(dir);
      if (rot !== null) {
        const arrow = svgEl("text", {
          x: x + cellW / 2 + 16,
          y: y + rowH / 2 + 5,
          "text-anchor": "middle",
          class: "lw-profile-arrow",
          transform: `rotate(${rot} ${x + cellW / 2 + 16} ${y + rowH / 2})`,
        });
        arrow.textContent = "↑";
        arrow.setAttribute("aria-label", `风向 ${compassOf(dir) ?? "未知"}（来向）`);
        svg.append(arrow);
      }
      const compass = compassOf(dir);
      if (compass !== null) {
        const sub = svgEl("text", {
          x: x + cellW / 2,
          y: y + rowH - 4,
          "text-anchor": "middle",
          class: "lw-profile-cellsub",
        });
        sub.textContent = compass + "风";
        svg.append(sub);
      }
    }
  }

  // 底部：0m 地面基线
  const baseY = headH + HEIGHT_LEVELS.length * rowH;
  svg.append(
    svgEl("line", {
      x1: labelW,
      y1: baseY,
      x2: width - 8,
      y2: baseY,
      class: "lw-profile-baseline",
    }),
  );
  const baseLabel = svgEl("text", { x: 6, y: baseY + 4, class: "lw-profile-rowlabel" });
  baseLabel.textContent = "0m";
  svg.append(baseLabel);

  // 图例：分档色块
  let lx = labelW;
  const legendY = baseY + 20;
  const legendTitle = svgEl("text", { x: lx, y: legendY, class: "lw-profile-legendtitle" });
  legendTitle.textContent = "风速 m/s";
  svg.append(legendTitle);
  lx += 52;
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
): HTMLDivElement => {
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
    row.insertCell().textContent =
      `${ROUTE_POINTS[r]?.id ?? ""} ${ROUTE_POINTS[r]?.name ?? ""}`.trim();
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
  for (const text of ["地面要素", ...ROUTE_POINTS.map((p) => p.id)]) {
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
