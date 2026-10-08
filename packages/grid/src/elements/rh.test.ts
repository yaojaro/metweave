/**
 * rh 要素档案单测：换算口径（恒等）、色标合法性、档位两模式（等距/分位数——有界场
 * 0–100 等距特例的档界与断点索引）、等值线留位——档案是色标与档位的单一事实来源，
 * 本测试锁其口径不被无意改动。零新能力切片：档案 + 清单一行即上线，内核零改动。
 */
import { describe, expect, it } from "vitest";
import { rhProfile, buildColorScale, equalStepBreaks, quantileBreaks, binIndexAt } from "../index";
import type { GridStats } from "../index";

describe("rh 档案", () => {
  it("显示换算恒等（% 存储＝% 显示，无换算）", () => {
    expect(rhProfile.toDisplay(0)).toBe(0);
    expect(rhProfile.toDisplay(79.3)).toBe(79.3);
    expect(rhProfile.toDisplay(100)).toBe(100);
    expect(rhProfile.displayUnit).toBe("%");
    expect(rhProfile.storageUnit).toBe("%");
  });

  it("入档口径与容器头对齐（RH/2m/%）", () => {
    expect(rhProfile.variable).toBe("RH");
    expect(rhProfile.level).toBe("2m");
    expect(rhProfile.shortName).toBe("rh");
  });

  it("色带为黄-绿-蓝单色渐进（浅→深＝干→湿），全部合法十六进制", () => {
    const stops = rhProfile.colorStops;
    expect(stops.length).toBeGreaterThanOrEqual(5);
    for (const c of stops) expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(stops[0]).toBe("#ffffd9"); // 干端近白浅黄
    expect(stops.at(-1)).toBe("#081d58"); // 湿端深蓝
  });

  it("等距档：有界场特例 0–100×10 档——断点恰为 10…90 共 9 个，0/100 落两端外延档", () => {
    const { min, max, bins } = rhProfile.equal!; // 等距域在位（threshold 要素才可缺席——档案字面量静态可证）
    expect(min).toBe(0);
    expect(max).toBe(100);
    expect(bins).toBe(10);
    const breaks = equalStepBreaks(min, max, bins);
    expect(breaks).toHaveLength(9);
    expect(breaks[0]).toBeCloseTo(10, 10);
    expect(breaks.at(-1)).toBeCloseTo(90, 10);
    expect((breaks[1] ?? 0) - (breaks[0] ?? 0)).toBeCloseTo(10, 10);
    // binIndexAt 两端外延档语义与物理边界重合：下界（含 0）落第 0 档、上界饱和值 100
    // 落最外第 9 档（[90,∞) 外延档恰兜住 [90,100]）；恰在断点上的值归上档（左闭右开）
    expect(binIndexAt(0, breaks)).toBe(0);
    expect(binIndexAt(9.9, breaks)).toBe(0);
    expect(binIndexAt(10, breaks)).toBe(1);
    expect(binIndexAt(50, breaks)).toBe(5);
    expect(binIndexAt(89.9, breaks)).toBe(8);
    expect(binIndexAt(90, breaks)).toBe(9);
    expect(binIndexAt(100, breaks)).toBe(9);
  });

  it("分位数档：分位点全在预计算八分位梯子上（中国域窗实测 stats）", () => {
    const stats: GridStats = {
      min: 7.2,
      max: 100,
      p10: 33.5,
      p25: 51.1,
      p50: 70.7,
      p75: 78,
      p90: 90,
      p99: 98.6,
    };
    const breaks = quantileBreaks(stats, rhProfile.quantile!);
    expect(breaks).toHaveLength(5);
    expect(breaks).toEqual([33.5, 51.1, 70.7, 78, 90]);
  });

  it("buildColorScale 缺省（等距）产出 9 断点完整色标", () => {
    const scale = buildColorScale(rhProfile, {
      min: 7.2,
      max: 100,
      p10: 33.5,
      p25: 51.1,
      p50: 70.7,
      p75: 78,
      p90: 90,
      p99: 98.6,
    });
    expect(rhProfile.defaultMode).toBe("equal");
    expect(scale.breaks).toHaveLength(9);
    expect(scale.colors).toBe(rhProfile.colorStops);
  });

  it("渲染形态＝色斑图；等值线留位字段口径在位（10%、无特值线）", () => {
    expect(rhProfile.renderForm).toBe("filled");
    expect(rhProfile.contours).toBeDefined();
    expect(rhProfile.contours?.interval).toBe(10);
    expect(rhProfile.contours?.highlighted).toEqual([]); // 相对湿度无特值线惯例
  });
});
