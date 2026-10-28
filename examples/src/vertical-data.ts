/**
 * 「风的垂直与时间」演示页 · 示例数据与合成场（v0.6 批次，2026-10-28）。
 *
 * 全部数据页内自备、不拉外网：①多层×多时刻的合成 u/v 格点场（10 层标准等压面 ×
 * 8 个预报时效（0–21 时每 3h）的 5×5 小域场——经 @metweave/grid 的 `windProfileOf` / `windTimeHeightOf`
 * 适配器在采样点派生出 W-10/W-11/W-12 的输入，走的是**真实适配器管道**而非手拼数组）；
 * ②24 时次 IEM 形态的逐时观测原始行（占位串 "M"、空串、数值串混杂——喂
 * `windObservationSeries` 的缺测容忍归一，出 W-13/W-14 的输入）。
 *
 * 合成场的风速/风向设计：随高度增强＋顺转（西风带廓线的典型形态）、随预报时效缓慢
 * 增强顺转；两处缺测块（500 hPa 起报时刻、300 hPa 末时效的采样点邻域）供三个组件
 * 各自演示缺测形态（廓线断线／剖面空格）。标准大气近似高度表仅供高空风图的低空段
 * 高亮（演示示意，真实作业应取位势高度场）。
 */
import { windComponentsOf } from "metweave";
import { computeStats, type Grid } from "@metweave/grid";

/** 剖面采样点（合成小域内部，避开格点原点以吃到双线性插值）。 */
export const VERTICAL_POINT = { lat: 39.5, lon: 100.5 } as const;

/** 演示廓线的 10 层标准等压面（hPa，自下而上）。 */
const PROFILE_PRESSURES = [1000, 925, 850, 700, 500, 400, 300, 250, 200, 100] as const;

/** 演示剖面的 8 个预报时效（0–21 时每 3h——跨 24h 窗口的标准剖面形态）。 */
const FORECAST_HOURS = [0, 3, 6, 9, 12, 15, 18, 21] as const;

/** 合成场起报时刻（ISO，与容器头 referenceTime 同形）。 */
const REFERENCE_TIME = "2026-10-27T12:00Z";

/** 标准大气近似高度（gpm）——演示用示意值，供高空风图低空段高亮分层。 */
const DEMO_HEIGHTS: Readonly<Record<number, number>> = Object.freeze({
  1000: 110,
  925: 760,
  850: 1450,
  700: 3000,
  500: 5600,
  400: 7200,
  300: 9200,
  250: 10400,
  200: 11800,
  100: 16200,
});

/** 演示高空风图的低空段高亮（0–3 km：标准大气下约合 1000/925/850 三层）。 */
export const HODO_HIGHLIGHT = [
  { fromHeightM: 0, toHeightM: 3000, label: "0–3 km 低空段（示意）" },
] as const;

// ---------------------------------------------------------------- 合成多层×多时刻 u/v 场

const NX = 5;
const NY = 5;

/** 合成风参数：随高度增强＋顺转、随时效缓慢增强（西风带廓线形态）。 */
const speedAt = (levelIndex: number, hourIndex: number, x: number): number =>
  (6 + levelIndex * 3 + hourIndex * 1.5) * (0.9 + 0.05 * x);
const directionAt = (levelIndex: number, hourIndex: number, y: number): number =>
  170 + levelIndex * 14 + hourIndex * 10 + (y - 2) * 3;

/** 一层一时的 u/v 双场（25 格点逐点由方向/风速现算分量；缺测块注入 NaN）。 */
const fieldPairOf = (
  pressure: number,
  levelIndex: number,
  forecastHour: number,
  hourIndex: number,
  withSampleGap: boolean,
): { u: Grid; v: Grid } => {
  const us: number[] = [];
  const vs: number[] = [];
  for (let y = 0; y < NY; y += 1) {
    for (let x = 0; x < NX; x += 1) {
      // 采样点 (39.5, 100.5) 的双线性邻域＝行 2–3 × 列 2–3：缺测块注入这里
      const inGap = withSampleGap && y >= 2 && y <= 3 && x >= 2 && x <= 3;
      if (inGap) {
        us.push(Number.NaN);
        vs.push(Number.NaN);
        continue;
      }
      const { u, v } = windComponentsOf(
        directionAt(levelIndex, hourIndex, y),
        speedAt(levelIndex, hourIndex, x),
      );
      us.push(u);
      vs.push(v);
    }
  }
  const gridOf = (variable: string, values: number[]): Grid => ({
    header: {
      version: 1,
      variable,
      level: `${pressure}mb`,
      unit: "m s-1",
      grid: { nx: NX, ny: NY, la0: 42, lo0: 98, di: 1, dj: 1, order: "N2S,W2E,row-major" },
      stats: computeStats(Float32Array.from(values)),
      meta: {
        referenceTime: REFERENCE_TIME,
        forecastHour,
        source: "synthetic-demo",
        license: "",
        generated: "2026-10-28",
      },
    },
    values: Float32Array.from(values),
  });
  return { u: gridOf("UGRD", us), v: gridOf("VGRD", vs) };
};

/** 全量合成场（10 层 × 4 时效；500 hPa 起报与 300 hPa 末时效各带一块缺测）。 */
export const SYNTHETIC_FIELDS: readonly { u: Grid; v: Grid }[] = PROFILE_PRESSURES.flatMap(
  (pressure, levelIndex) =>
    FORECAST_HOURS.map((hour, hourIndex) =>
      fieldPairOf(
        pressure,
        levelIndex,
        hour,
        hourIndex,
        (pressure === 500 && hour === 0) || (pressure === 300 && hour === 18),
      ),
    ),
);

/** 起报时刻的 10 层子集（W-10 廓线与 W-11 高空风图的输入场）。 */
export const ANALYSIS_FIELDS: readonly { u: Grid; v: Grid }[] = SYNTHETIC_FIELDS.filter(
  (_f, i) => i % FORECAST_HOURS.length === 0,
);

/** 适配器产出的多层读数 → 高空风图输入（补标准大气近似高度，示意）。 */
export const withDemoHeights = (
  levels: readonly {
    pressure: number | null;
    height: number | null;
    speed: number | null;
    direction: number | null;
  }[],
): readonly {
  pressure: number | null;
  height: number | null;
  speed: number | null;
  direction: number | null;
}[] =>
  levels.map((level) => ({
    ...level,
    height: level.pressure !== null ? (DEMO_HEIGHTS[level.pressure] ?? null) : level.height,
  }));

// ---------------------------------------------------------------- IEM 形态逐时观测原始行

const dayHourOf = (startDay: number, startHour: number, offset: number): string => {
  const total = startHour + offset;
  const day = startDay + Math.floor(total / 24);
  const hour = total % 24;
  return `${String(day).padStart(2, "0")}日${String(hour).padStart(2, "0")}时`;
};

/**
 * 24 时次观测原始行（10-27 20时 → 10-28 19时）：午后阵风成串、后半夜静风、
 * 清晨三时次缺测（"M"/空串/缺席三种缺测形态都上场——喂 windObservationSeries 归一）。
 */
export const HOURLY_ROWS = Array.from({ length: 24 }, (_, i) => {
  const time = dayHourOf(27, 20, i);
  if (i >= 10 && i <= 12) {
    return { time, speed: "M" as const, gust: "" as const, direction: "M" as const };
  }
  if (i === 13) return { time, speed: "2.4", gust: null, direction: "" };
  if (i >= 7 && i <= 9) {
    return { time, speed: 0, gust: null, direction: null }; // 后半夜静风
  }
  // 白天风速峰值在午后（i 0–6 对应 20–02 时为过渡），阵风只在部分时次编报
  const hourOfDay = (20 + i) % 24;
  const base = hourOfDay >= 13 && hourOfDay <= 17 ? 9 + (hourOfDay - 13) : 4 + ((i * 7) % 5);
  const gusty = hourOfDay >= 13 && hourOfDay <= 17;
  // 风向逐时顺转扫过北向接缝（i=15→355°、i=16→4°：色环上相邻、线性色带上会断裂的样例；
  // 起相角刻意避开静风段 i=7–9 与缺测段 i=10–13，让接缝落在有观测的时次上）
  const dir = (220 + i * 9) % 360;
  return {
    time,
    speed: base,
    gust: gusty ? base + 6 + (i % 3) * 2 : null,
    direction: dir,
  };
});
