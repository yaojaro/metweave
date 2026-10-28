// @vitest-environment happy-dom
/**
 * wind-profile（垂直与时间批次的输入契约层）可测面：windComponentsOf 的极坐标数学锚
 * （西风→正 u、北风→负 v、3-4-5 锚）与 windObservationSeries 的缺测容忍归一
 * （IEM 形态的占位串/空串/越界哨兵 → null；合法数值直过）。
 */
import { describe, expect, it } from "vitest";
import { normalizeWindDisplayUnit, windComponentsOf, windObservationSeries } from "./wind-profile";

describe("windComponentsOf（风向/风速 → u/v 分量）", () => {
  it("气象口径锚：西风 270° → u=+s 向东、北风 0° → v=−s 向南、南风 180° → v=+s", () => {
    const west = windComponentsOf(270, 10);
    expect(west.u).toBeCloseTo(10, 6);
    expect(west.v).toBeCloseTo(0, 6);
    const north = windComponentsOf(0, 8);
    expect(north.u).toBeCloseTo(0, 6);
    expect(north.v).toBeCloseTo(-8, 6);
    const south = windComponentsOf(180, 8);
    expect(south.u).toBeCloseTo(0, 6);
    expect(south.v).toBeCloseTo(8, 6);
  });

  it("3-4-5 锚：来向 216.87°（西南西）×5 → u=3、v=−4（与 windDirectionOf 互逆）", () => {
    const { u, v } = windComponentsOf(270 - (Math.atan2(-4, 3) * 180) / Math.PI, 5);
    expect(u).toBeCloseTo(3, 6);
    expect(v).toBeCloseTo(-4, 6);
  });

  it("静风：speed 0 → 原点；NaN 入 NaN 出（纯数学层不校验）", () => {
    const calm = windComponentsOf(137, 0);
    expect(calm.u).toBeCloseTo(0, 9); // −0 与 +0 的符号差不构成几何差异
    expect(calm.v).toBeCloseTo(0, 9);
    expect(Number.isNaN(windComponentsOf(Number.NaN, 5).u)).toBe(true);
  });
});

describe("normalizeWindDisplayUnit（量纲声明归一化·五组件单源）", () => {
  it("缺省 m/s；mps 别名归 m/s；kt 原样（P2-7 行为锁：不换算数值）", () => {
    expect(normalizeWindDisplayUnit(undefined, "test")).toBe("m/s");
    expect(normalizeWindDisplayUnit("mps", "test")).toBe("m/s");
    expect(normalizeWindDisplayUnit("m/s", "test")).toBe("m/s");
    expect(normalizeWindDisplayUnit("kt", "test")).toBe("kt");
  });

  it("非法值显式抛错且文案统一带调用方名（此前四处内联的报错文案微差）", () => {
    expect(() => normalizeWindDisplayUnit("kmh" as never, "gustBand")).toThrow(
      /gustBand 的 unit 选项值 "kmh" 不受支持/,
    );
    expect(() => normalizeWindDisplayUnit("kmh" as never, "hodograph")).toThrow(
      /hodograph 的 unit 选项值 "kmh" 不受支持/,
    );
  });
});

describe("windObservationSeries（观测逐时缺测容忍归一）", () => {
  it("IEM 形态归一：数字直过、占位串/空串 → null、数值串解析、undefined → null", () => {
    const series = windObservationSeries([
      { time: "01:00", speed: 4.2, gust: 7, direction: 220 },
      { time: "02:00", speed: "M", gust: "M", direction: "M" },
      { time: "03:00", speed: "3.5", gust: "", direction: "350" },
      { time: "04:00" },
    ]);
    expect(series).toEqual([
      { time: "01:00", speed: 4.2, gust: 7, direction: 220 },
      { time: "02:00", speed: null, gust: null, direction: null },
      { time: "03:00", speed: 3.5, gust: null, direction: 350 },
      { time: "04:00", speed: null, gust: null, direction: null },
    ]);
  });

  it("越界哨兵与负值按缺测收：方向 999、风速 -1 不进序列（逐条抛错会废掉整段）", () => {
    const series = windObservationSeries([
      { time: "01:00", direction: 999, speed: -1, gust: Number.NaN },
      { time: "02:00", direction: 360, speed: 0, gust: Number.POSITIVE_INFINITY },
    ]);
    expect(series[0]).toEqual({ time: "01:00", speed: null, gust: null, direction: null });
    expect(series[1]).toEqual({ time: "02:00", speed: 0, gust: null, direction: 360 });
  });

  it("time 原样透传（不解析时刻算术——布列是组件的事）", () => {
    const series = windObservationSeries([{ time: "2026-10-28T08:00Z" }]);
    expect(series[0]?.time).toBe("2026-10-28T08:00Z");
  });
});
