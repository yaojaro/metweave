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
