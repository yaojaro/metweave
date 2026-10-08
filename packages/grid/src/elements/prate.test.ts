/**
 * prate 要素档案单测：换算口径（kg m-2 s-1 → mm/h ×3600）、色标合法性（PuBu 蓝紫系）、
 * 阈值档（0.1/1/5/10 mm/h——对数偏态场的气象惯例定档）、log₁₀ 前置变换（断点线性声明、
 * 定档空间对数等价）、零值/微量首档透明（−Inf 通道与档级透明两路同形）、等值线留位——
 * 档案是色标与档位的单一事实来源，本测试锁其口径不被无意改动。本切片引入内核
 * log₁₀ 前置变换能力（ColorScale.logScale），prate 档案是首个消费方（threshold＋
 * log₁₀＋首档透明三能力正交组合）。
 */
import { describe, expect, it } from "vitest";
import {
  prateProfile,
  buildColorScale,
  thresholdBreaks,
  binIndexAt,
  renderToImageData,
  type Grid,
  type GridStats,
} from "../index";

/**
 * 中国域窗 prate_cn.mwgrid 容器头实测 stats（2026-10-06T18Z f000：
 * 0–0.00393 kg m-2 s-1＝0–14.1 mm/h，p50=0——零值堆 74.3%，p75 折 mm/h 0.0029）。
 */
const CN_STATS: GridStats = {
  min: 0,
  max: 0.0039264000952243805,
  p10: 0,
  p25: 0,
  p50: 0,
  p75: 8.000000093488779e-7,
  p90: 0.00005279999822960235,
  p99: 0.0006504000048153102,
};

/** 最小网格工厂（与 cape.test 同构）：值按行序西→东，单位＝存储 kg m-2 s-1。 */
const tinyGrid = (values: number[]): Grid => ({
  header: {
    version: 1,
    variable: "PRATE",
    level: "sfc",
    unit: "kg m-2 s-1",
    grid: { nx: 2, ny: 2, la0: 40, lo0: 100, di: 1, dj: 1, order: "N2S,W2E,row-major" },
    stats: CN_STATS,
    meta: {
      referenceTime: "2026-10-06T18:00Z",
      forecastHour: 0,
      source: "test",
      license: "",
      generated: "2026-10-07",
    },
  },
  values: Float32Array.from(values),
});

describe("prate 档案", () => {
  it("显示换算 ×3600（kg m-2 s-1 存储 → mm/h 显示），换算只在档案层", () => {
    expect(prateProfile.toDisplay(0)).toBe(0);
    expect(prateProfile.toDisplay(1)).toBe(3600);
    expect(prateProfile.toDisplay(CN_STATS.max)).toBeCloseTo(14.135, 3); // 本 cycle 极值
    expect(prateProfile.displayUnit).toBe("mm/h");
    expect(prateProfile.storageUnit).toBe("kg m-2 s-1");
  });

  it("入档口径与容器头对齐（PRATE/sfc/kg m-2 s-1——prate_cn.mwgrid 实测）", () => {
    expect(prateProfile.variable).toBe("PRATE");
    expect(prateProfile.level).toBe("sfc");
    expect(prateProfile.shortName).toBe("prate");
  });

  it("色带为蓝紫系单色渐进（ColorBrewer PuBu，浅→深＝弱→强降水），全部合法十六进制", () => {
    const stops = prateProfile.colorStops;
    expect(stops.length).toBeGreaterThanOrEqual(5);
    for (const c of stops) expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(stops[0]).toBe("#fff7fb"); // 弱端近白浅紫
    expect(stops.at(-1)).toBe("#023858"); // 强端深蓝
  });

  it("阈值档：0.1/1/5/10 mm/h 严格递增×5 档（小毛毛雨/中雨/大雨/暴雨量级），对数定档与线性声明一致", () => {
    const thresholds = prateProfile.thresholds ?? [];
    expect(thresholds).toEqual([0.1, 1, 5, 10]);
    const breaks = thresholdBreaks(thresholds);
    expect(breaks).toEqual([0.1, 1, 5, 10]); // 显式业务阈值原样（不做均分/分位近似）
    // 对数空间与线性声明的档位一致性：正数域上 binIndexAt(log₁₀v, log₁₀breaks)
    // ≡ binIndexAt(v, breaks)（log₁₀ 单调，左闭右开边界保持——恰在阈值上归上档）
    const logBreaks = breaks.map(Math.log10);
    const probes = [0.0029, 0.05, 0.0999, 0.1, 0.5, 0.99, 1, 2.34, 4.99, 5, 9.9, 10, 14.1, 48.4];
    for (const v of probes) {
      expect(binIndexAt(Math.log10(v), logBreaks)).toBe(binIndexAt(v, breaks));
    }
    expect(binIndexAt(Math.log10(0.1), logBreaks)).toBe(1); // 恰在 0.1 上 → bin1（非 bin0）
    // 中国域窗实测分布落位：p50=0（零值走 −Inf 透明通道）、p75=0.0029 与 p90=0.19 分别
    // 落首档（透明）与 [0.1,1) 档、max=14.1 落暴雨量级档 [10,∞)
    expect(binIndexAt(Math.log10(CN_STATS.p75 * 3600), logBreaks)).toBe(0);
    expect(binIndexAt(Math.log10(CN_STATS.p90 * 3600), logBreaks)).toBe(1);
    expect(binIndexAt(Math.log10(CN_STATS.max * 3600), logBreaks)).toBe(4);
  });

  it("log₁₀ 前置变换声明在档：断点留线性显示空间，装配进色标（stats 全缺测也不读）", () => {
    expect(prateProfile.logScale).toBe(true);
    const scale = buildColorScale(prateProfile, CN_STATS);
    expect(scale.breaks).toEqual([0.1, 1, 5, 10]); // 线性原值（图例直读不换算）
    expect(scale.logScale).toBe(true); // 渲染定档前对值与断点统一取 log₁₀
    expect(scale.transparentBins).toEqual(new Set([0]));
  });

  it("不立等距/分位推荐（零值堆 74% 分位塌零失效实证；threshold＋log₁₀ 单一组合）", () => {
    expect(prateProfile.equal).toBeUndefined();
    expect(prateProfile.quantile).toBeUndefined();
    expect(prateProfile.defaultMode).toBe("threshold");
  });

  it("首档透明＋零值透明：渲染集成（convert=toDisplay 进 mm/h 后取对数定档）", () => {
    const scale = buildColorScale(prateProfile, CN_STATS);
    // 2×2 场（存储单位）：0（零值）、1e-5（0.036 mm/h 微量→首档）、3e-4（1.08 mm/h）、
    // 3.9e-3（14.04 mm/h——本 cycle 极值量级）
    const img = renderToImageData(tinyGrid([0, 1e-5, 3e-4, 3.9e-3]), scale, {
      convert: prateProfile.toDisplay,
    });
    const px = (i: number): readonly number[] => Array.from(img.data.subarray(i * 4, i * 4 + 4));
    expect(px(0)).toEqual([0, 0, 0, 0]); // 零值：log₁₀→−Inf 非有限通道（与缺测同一形态）
    expect(px(1)).toEqual([0, 0, 0, 0]); // 微量 0.036 mm/h：bin0 命中档级透明
    expect(px(2)[3]).toBe(255); // 1.08 mm/h → bin2 正常着色
    expect(px(3)[3]).toBe(255); // 14.04 mm/h → bin4（暴雨量级外延末档）
    expect(px(2)).not.toEqual(px(3)); // 跨档色不同（中蓝 vs 深蓝）
  });

  it("渲染形态＝色斑图；等值线留位字段口径在位（1 mm/h、无特值线）", () => {
    expect(prateProfile.renderForm).toBe("filled");
    expect(prateProfile.contours).toBeDefined();
    expect(prateProfile.contours?.interval).toBe(1);
    expect(prateProfile.contours?.highlighted).toEqual([]); // 降水率无特值线惯例
  });
});
