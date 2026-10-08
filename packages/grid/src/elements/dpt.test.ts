/**
 * dpt 要素档案单测：换算口径、色标合法性、档位两模式（等距/分位数）、等值线留位——
 * 档案是色标与档位的单一事实来源，本测试锁其口径不被无意改动。
 * 本切片为零新能力试金石：档案 + 清单一行即上线，内核零改动（见 grid-notes）。
 */
import { describe, expect, it } from "vitest";
import { dptProfile, buildColorScale, equalStepBreaks, quantileBreaks } from "../index";
import type { GridStats } from "../index";

describe("dpt 档案", () => {
  it("显示换算 K→°C（−273.15）", () => {
    expect(dptProfile.toDisplay(273.15)).toBeCloseTo(0, 10);
    expect(dptProfile.toDisplay(283.15)).toBeCloseTo(10, 10);
    expect(dptProfile.displayUnit).toBe("°C");
    expect(dptProfile.storageUnit).toBe("K");
  });

  it("入档口径与容器头对齐（DPT/2m/K）", () => {
    expect(dptProfile.variable).toBe("DPT");
    expect(dptProfile.level).toBe("2m");
    expect(dptProfile.shortName).toBe("dpt");
  });

  it("色带为绿系单色渐进（浅→深＝干→湿），全部合法十六进制", () => {
    const stops = dptProfile.colorStops;
    expect(stops.length).toBeGreaterThanOrEqual(5);
    for (const c of stops) expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(stops[0]).toBe("#f7fcf5"); // 干端近白
    expect(stops.at(-1)).toBe("#00441b"); // 湿端深绿
  });

  it("等距档：域 [-40,30]×14 档、5°C 步长、0°C 恰为档界", () => {
    const { min, max, bins } = dptProfile.equal!; // 等距域在位（threshold 要素才可缺席——档案字面量静态可证）
    expect(min).toBe(-40);
    expect(max).toBe(30);
    expect(bins).toBe(14);
    const breaks = equalStepBreaks(min, max, bins);
    expect(breaks).toHaveLength(13);
    expect(breaks[7]).toBeCloseTo(0, 10); // 第 8 断点＝0°C（-40 + 8×5）
    expect((breaks[1] ?? 0) - (breaks[0] ?? 0)).toBeCloseTo(5, 10);
  });

  it("分位数档：分位点全在预计算八分位梯子上", () => {
    const stats: GridStats = {
      min: 192.1,
      max: 299.3,
      p10: 263.0,
      p25: 269.3,
      p50: 277.1,
      p75: 290.4,
      p90: 296.0,
      p99: 297.6,
    };
    const breaks = quantileBreaks(stats, dptProfile.quantile!);
    expect(breaks).toHaveLength(5);
    expect(breaks).toEqual([263.0, 269.3, 277.1, 290.4, 296.0]);
  });

  it("buildColorScale 缺省（等距）产出 13 断点完整色标", () => {
    const scale = buildColorScale(dptProfile, {
      min: 192.1,
      max: 299.3,
      p10: 263,
      p25: 269.3,
      p50: 277.1,
      p75: 290.4,
      p90: 296,
      p99: 297.6,
    });
    expect(dptProfile.defaultMode).toBe("equal");
    expect(scale.breaks).toHaveLength(13);
    expect(scale.colors).toBe(dptProfile.colorStops);
  });

  it("渲染形态＝色斑图；等值线留位字段口径在位（2°C、无特值线）", () => {
    expect(dptProfile.renderForm).toBe("filled");
    expect(dptProfile.contours).toBeDefined();
    expect(dptProfile.contours?.interval).toBe(2);
    expect(dptProfile.contours?.highlighted).toEqual([]); // 露点无特值线惯例
  });
});
