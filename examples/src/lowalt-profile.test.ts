/**
 * 低空航路面板纯函数内核单测：时刻索引/北京时串/方位/风速分档/箭头角/URL 拼装——
 * 全部钉死输入输出，不碰系统时钟、不碰 DOM（渲染件由宿主截图验收）。
 */
import { describe, expect, it } from "vitest";
import {
  ROUTE_POINTS,
  compassOf,
  hourIndexAt,
  hourLabelOf,
  localHourStrOf,
  owForecastUrl,
  windBucketOf,
  arrowRotationOf,
} from "./lowalt-profile";

describe("localHourStrOf（北京时时刻串）", () => {
  it("UTC 04:00 → 北京时 12:00", () => {
    expect(localHourStrOf(Date.UTC(2026, 9, 20, 4, 0, 0))).toBe("2026-10-20T12:00");
  });
  it("跨日：UTC 17:30 → 次日北京时 01:00", () => {
    expect(localHourStrOf(Date.UTC(2026, 9, 20, 17, 30, 0))).toBe("2026-10-21T01:00");
  });
});

describe("hourIndexAt（时刻索引）", () => {
  const times = ["2026-10-20T00:00", "2026-10-20T06:00", "2026-10-20T12:00", "2026-10-20T18:00"];
  it("早于全部 → 首格 0（诚实落首格，不越界）", () => {
    expect(hourIndexAt(times, "2026-10-19T23:00")).toBe(0);
  });
  it("恰中一格 → 该格", () => {
    expect(hourIndexAt(times, "2026-10-20T12:00")).toBe(2);
  });
  it("介于两格之间 → 较早格（≤ localNow 的最大索引）", () => {
    expect(hourIndexAt(times, "2026-10-20T15:00")).toBe(2);
  });
  it("晚于全部 → 末格", () => {
    expect(hourIndexAt(times, "2026-10-21T00:00")).toBe(3);
  });
});

describe("compassOf（八方位，来向）", () => {
  it("正北 0°/360° → 北", () => {
    expect(compassOf(0)).toBe("北");
    expect(compassOf(360)).toBe("北");
  });
  it("225° → 西南", () => {
    expect(compassOf(225)).toBe("西南");
  });
  it("280° → 西（最近方位归一）", () => {
    expect(compassOf(280)).toBe("西");
  });
  it("缺失/NaN → null", () => {
    expect(compassOf(null)).toBeNull();
    expect(compassOf(Number.NaN)).toBeNull();
  });
});

describe("windBucketOf（配色分档，扫视参考）", () => {
  it("边界归下档：<3 绿 / 6 黄 / ≥15 红", () => {
    expect(windBucketOf(2.9)?.label).toBe("<3");
    expect(windBucketOf(3)?.label).toBe("3–6");
    expect(windBucketOf(6)?.label).toBe("6–9");
    expect(windBucketOf(15)?.label).toBe("≥15");
  });
  it("缺失 → null（调用方渲「—」）", () => {
    expect(windBucketOf(null)).toBeNull();
  });
});

describe("arrowRotationOf（箭头指向去向＝来向+180）", () => {
  it("北风（来向 0°）→ 箭头朝南 180°", () => {
    expect(arrowRotationOf(0)).toBe(180);
  });
  it("西风（来向 270°）→ 箭头朝东 90°", () => {
    expect(arrowRotationOf(270)).toBe(90);
  });
  it("缺失 → null", () => {
    expect(arrowRotationOf(null)).toBeNull();
  });
});

describe("owForecastUrl（请求拼装）", () => {
  it("含五点坐标、四层风速、m/s 单位与北京时", () => {
    const url = owForecastUrl(ROUTE_POINTS);
    expect(url).toContain("latitude=30.44,30.47,30.505,30.54,30.56");
    expect(url).toContain("wind_speed_180m");
    expect(url).toContain("wind_speed_unit=ms");
    expect(url).toContain("timezone=Asia%2FShanghai");
    expect(url).toContain("daily=sunrise,sunset");
  });
});

describe("hourLabelOf（滑杆标签）", () => {
  it("ISO 时刻 → 「M月D日 HH:00」", () => {
    expect(hourLabelOf("2026-10-20T09:00")).toBe("10月20日 09:00");
  });
  it("非预期形态原样返回（不猜）", () => {
    expect(hourLabelOf("whatever")).toBe("whatever");
  });
});

// ---------------------------------------------------------------- 自设航路二期：采样与风险

import {
  MAX_SAMPLES,
  RISK_THRESHOLDS,
  haversineKm,
  nearestLevelOf,
  resampleRoute,
  riskAtOf,
  type OwHourly,
} from "./lowalt-profile";

const kmTolerance = 0.05;

describe("haversineKm（大圆距离）", () => {
  it("兴隆湖→龙泉山 ≈23.4km（手量口径 ±0.2）", () => {
    const d = haversineKm({ lat: 30.44, lon: 104.07 }, { lat: 30.56, lon: 104.27 });
    expect(Math.abs(d - 23.4)).toBeLessThan(0.2);
  });
  it("同点 → 0", () => {
    expect(haversineKm({ lat: 30, lon: 104 }, { lat: 30, lon: 104 })).toBe(0);
  });
});

describe("resampleRoute（折线等弧长采样）", () => {
  it("长航线封顶 MAX_SAMPLES，起终点保留、等距", () => {
    const samples = resampleRoute([
      { lat: 30.44, lon: 104.07 },
      { lat: 30.56, lon: 104.27 },
    ]);
    expect(samples.length).toBe(MAX_SAMPLES);
    expect(samples[0]?.distKm).toBe(0);
    expect(samples[samples.length - 1]?.distKm).toBeGreaterThan(23);
    const step0 = (samples[1]?.distKm ?? 0) - (samples[0]?.distKm ?? 0);
    const step1 = (samples[2]?.distKm ?? 0) - (samples[1]?.distKm ?? 0);
    expect(Math.abs(step1 - step0)).toBeLessThan(kmTolerance);
    // 端点坐标即航点本身
    expect(samples[0]?.lat).toBeCloseTo(30.44, 6);
    expect(samples[samples.length - 1]?.lon).toBeCloseTo(104.27, 6);
  });
  it("短航线 → 起终点两点", () => {
    const samples = resampleRoute([
      { lat: 30, lon: 104 },
      { lat: 30.001, lon: 104 },
    ]);
    expect(samples.length).toBe(2);
  });
  it("少于 2 航点 → 空数组", () => {
    expect(resampleRoute([{ lat: 30, lon: 104 }])).toEqual([]);
  });
});

describe("nearestLevelOf（巡航真高→最近数据层）", () => {
  it("120 → 120；30 → 10；160 → 180（层间取近者）", () => {
    expect(nearestLevelOf(120)).toBe(120);
    expect(nearestLevelOf(30)).toBe(10);
    expect(nearestLevelOf(160)).toBe(180);
  });
});

// riskAtOf 测试数据：最小 OwHourly 骨架（全要素数组同长，缺数据以 null 容错）
const hourlyOf = (overrides: {
  wind120?: number | null;
  cape?: number | null;
  precip?: number | null;
}): OwHourly => ({
  time: ["2026-10-20T00:00", "2026-10-20T01:00"],
  wind_speed_10m: [1, 1],
  wind_speed_80m: [1, 1],
  wind_speed_120m: [overrides.wind120 ?? null, overrides.wind120 ?? null],
  wind_speed_180m: [1, 1],
  wind_direction_10m: [270, 270],
  wind_direction_80m: [270, 270],
  wind_direction_120m: [270, 270],
  wind_direction_180m: [270, 270],
  temperature_2m: [20, 20],
  dew_point_2m: [10, 10],
  cloud_cover: [0, 0],
  cape: [overrides.cape ?? null, overrides.cape ?? null],
  precipitation: [overrides.precip ?? null, overrides.precip ?? null],
  weather_code: [0, 0],
});

describe("riskAtOf（参考阈值评估，非判据）", () => {
  it("各要素缺失 → unknown", () => {
    expect(riskAtOf(hourlyOf({}), 0, 120).level).toBe("unknown");
  });
  it("各要素均在阈值内 → low", () => {
    expect(riskAtOf(hourlyOf({ wind120: 5, cape: 100, precip: 0 }), 0, 120).level).toBe("low");
  });
  it("巡航最近层风 ≥7 → mid（30m 巡航取 10m 层）", () => {
    const h = hourlyOf({ wind120: 5 });
    expect(riskAtOf(h, 0, 120).level).toBe("low");
    const h2: OwHourly = { ...h, wind_speed_10m: [8, 8] };
    expect(riskAtOf(h2, 0, 30).level).toBe("mid");
  });
  it("风 ≥10 → high，因子含层位与风速", () => {
    const r = riskAtOf(hourlyOf({ wind120: 11.2 }), 0, 120);
    expect(r.level).toBe("high");
    expect(r.factors.join("")).toContain("120m 风速 11.2");
  });
  it("CAPE ≥1000 → high；降水 ≥2 → high（多因子取最高档）", () => {
    expect(riskAtOf(hourlyOf({ cape: 1200 }), 0, 120).level).toBe("high");
    expect(riskAtOf(hourlyOf({ precip: 2.5 }), 0, 120).level).toBe("high");
    const mixed = riskAtOf(hourlyOf({ wind120: 8, cape: 1200 }), 0, 120);
    expect(mixed.level).toBe("high");
    expect(mixed.factors.length).toBe(2);
  });
  it("阈值常量即演示口径（改动须自觉对齐页面文案）", () => {
    expect(RISK_THRESHOLDS.windMidMs).toBe(7);
    expect(RISK_THRESHOLDS.windHighMs).toBe(10);
  });
});
