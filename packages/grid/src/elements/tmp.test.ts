/**
 * tmp 要素档案单测：换算口径、色标合法性、档位两模式（等距/分位数）、渲染形态与
 * 等值线留位字段——档案是色标与档位的单一事实来源，本测试锁其口径不被无意改动。
 */
import { describe, expect, it } from "vitest";
import { tmpProfile, buildColorScale, equalStepBreaks, quantileBreaks } from "../index";
import type { GridStats } from "../index";

describe("tmp 档案", () => {
  it("显示换算 K→°C（−273.15），冰点对齐", () => {
    expect(tmpProfile.toDisplay(273.15)).toBeCloseTo(0, 10);
    expect(tmpProfile.toDisplay(284.15)).toBeCloseTo(11, 10);
    expect(tmpProfile.displayUnit).toBe("°C");
    expect(tmpProfile.storageUnit).toBe("K");
  });

  it("入档口径与容器头对齐（TMP/2m/K）", () => {
    expect(tmpProfile.variable).toBe("TMP");
    expect(tmpProfile.level).toBe("2m");
    expect(tmpProfile.shortName).toBe("tmp");
  });

  it("色带为发散热带蓝-白-红：首尾冷/暖、中位近白、全部合法十六进制", () => {
    const stops = tmpProfile.colorStops;
    expect(stops.length).toBeGreaterThanOrEqual(5);
    for (const c of stops) expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
    const [first, mid, last] = [stops[0], stops[Math.floor((stops.length - 1) / 2)], stops.at(-1)];
    expect(first).toBe("#2166ac"); // 冷端蓝
    expect(last).toBe("#b2182b"); // 暖端红
    expect(mid).toBe("#f7f7f7"); // 白心
  });

  it("等距档：对称域 [-40,40]×20 档，4°C 步长且 0°C 恰为档界（白心/冰点对齐）", () => {
    const { min, max, bins } = tmpProfile.equal!; // 等距域在位（threshold 要素才可缺席——档案字面量静态可证）
    expect(min).toBe(-40);
    expect(max).toBe(40);
    expect(bins).toBe(20);
    const breaks = equalStepBreaks(min, max, bins);
    expect(breaks).toHaveLength(19);
    expect(breaks[9]).toBeCloseTo(0, 10); // 第 10 断点＝0°C
    expect((breaks[1] ?? 0) - (breaks[0] ?? 0)).toBeCloseTo(4, 10); // 4°C 步长
  });

  it("分位数档：分位点全在预计算八分位梯子上", () => {
    const stats: GridStats = {
      min: 264.27,
      max: 311.87,
      p10: 280.2,
      p25: 284.7,
      p50: 291.7,
      p75: 301.3,
      p90: 303.6,
      p99: 308.5,
    };
    const breaks = quantileBreaks(stats, tmpProfile.quantile!);
    expect(breaks).toHaveLength(5);
    expect(breaks).toEqual([280.2, 284.7, 291.7, 301.3, 303.6]);
  });

  it("buildColorScale 缺省（等距）产出 19 断点完整色标", () => {
    const scale = buildColorScale(tmpProfile, {
      min: 264,
      max: 312,
      p10: 280,
      p25: 284,
      p50: 291,
      p75: 301,
      p90: 303,
      p99: 308,
    });
    expect(tmpProfile.defaultMode).toBe("equal");
    expect(scale.breaks).toHaveLength(19);
    expect(scale.colors).toBe(tmpProfile.colorStops);
  });

  it("渲染形态＝色斑图；等值线留位字段口径在位（绘制能力后续引入，本切片不实现）", () => {
    expect(tmpProfile.renderForm).toBe("filled");
    expect(tmpProfile.contours).toBeDefined();
    expect(tmpProfile.contours?.interval).toBe(4);
    expect(tmpProfile.contours?.highlighted).toEqual([0]); // 0°C 冰点线高亮
  });
});
