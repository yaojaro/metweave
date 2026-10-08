/**
 * cape 要素档案单测：换算口径（恒等）、色标合法性、阈值档（1000/2500/4000——分位数失效
 * 场的替代定档）、首档透明（零值堆不上色、相邻档取样无副作用）、等值线留位——档案是
 * 色标与档位的单一事实来源，本测试锁其口径不被无意改动。本切片引入内核两能力
 * （thresholdBreaks／ColorScale.transparentBins），cape 档案是首个消费方。
 */
import { describe, expect, it } from "vitest";
import {
  capeProfile,
  buildColorScale,
  thresholdBreaks,
  binIndexAt,
  renderToImageData,
  type Grid,
  type GridStats,
} from "../index";

/** 中国域窗 cape_cn.mwgrid 容器头实测 stats（2026-10-06T18Z f000：0–3026、p50=1）。 */
const CN_STATS: GridStats = {
  min: 0,
  max: 3026,
  p10: 0,
  p25: 0,
  p50: 1,
  p75: 536,
  p90: 1128,
  p99: 1597,
};

/** 最小网格工厂（与 core.test 同构）：值按行序西→东。 */
const tinyGrid = (values: number[]): Grid => ({
  header: {
    version: 1,
    variable: "CAPE",
    level: "sfc",
    unit: "J kg-1",
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

describe("cape 档案", () => {
  it("显示换算恒等（J kg-1 存储＝J/kg 显示，无换算）", () => {
    expect(capeProfile.toDisplay(0)).toBe(0);
    expect(capeProfile.toDisplay(1234.5)).toBe(1234.5);
    expect(capeProfile.displayUnit).toBe("J/kg");
    expect(capeProfile.storageUnit).toBe("J kg-1");
  });

  it("入档口径与容器头对齐（CAPE/sfc/J kg-1——cape_cn.mwgrid 实测）", () => {
    expect(capeProfile.variable).toBe("CAPE");
    expect(capeProfile.level).toBe("sfc");
    expect(capeProfile.shortName).toBe("cape");
  });

  it("色带为暖色单色渐进（ColorBrewer YlOrRd，浅→深＝弱→强），全部合法十六进制", () => {
    const stops = capeProfile.colorStops;
    expect(stops.length).toBeGreaterThanOrEqual(5);
    for (const c of stops) expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(stops[0]).toBe("#ffffcc"); // 弱端近白浅黄
    expect(stops.at(-1)).toBe("#800026"); // 强端深红
  });

  it("阈值档：1000/2500/4000 严格递增×4 档（无/中度/强/极强对流潜势），实测分布落位", () => {
    const thresholds = capeProfile.thresholds ?? [];
    expect(thresholds).toEqual([1000, 2500, 4000]);
    const breaks = thresholdBreaks(thresholds);
    expect(breaks).toEqual([1000, 2500, 4000]); // 显式业务阈值原样（不做均分/分位近似）
    // 左闭右开：恰在阈值上的值归上档；两端外延档兜住全域
    expect(binIndexAt(0, breaks)).toBe(0);
    expect(binIndexAt(999, breaks)).toBe(0);
    expect(binIndexAt(1000, breaks)).toBe(1);
    expect(binIndexAt(2500, breaks)).toBe(2);
    expect(binIndexAt(4000, breaks)).toBe(3);
    expect(binIndexAt(Number.MAX_VALUE, breaks)).toBe(3);
    // 中国域窗实测分布落位：零值堆（p10=p25=0）与 p50=1 全落首档、max=3026 落强档
    // （[2500,4000)——本 cycle 未触及极强阈值，外延末档由更大值兜）
    expect(binIndexAt(CN_STATS.p50, breaks)).toBe(0);
    expect(binIndexAt(CN_STATS.max, breaks)).toBe(2);
  });

  it("不立等距/分位推荐（分位数档零值堆塌档失效实证；阈值档要素单一推荐模式）", () => {
    expect(capeProfile.equal).toBeUndefined();
    expect(capeProfile.quantile).toBeUndefined();
    expect(capeProfile.defaultMode).toBe("threshold");
  });

  it("首档透明：档案声明 [0] → 色标 Set{0}；渲染零值堆 alpha 0、相邻档满色", () => {
    expect(capeProfile.transparentBins).toEqual([0]);
    const scale = buildColorScale(capeProfile, CN_STATS);
    expect(scale.breaks).toEqual([1000, 2500, 4000]);
    expect(scale.colors).toBe(capeProfile.colorStops);
    expect(scale.transparentBins).toEqual(new Set([0]));
    // 集成断言：2×2 场＝零值（首档）、1500（中度档）、5000（极强档）、NaN（缺测）
    const img = renderToImageData(tinyGrid([0, 1500, 5000, Number.NaN]), scale);
    const px = (i: number): readonly number[] => Array.from(img.data.subarray(i * 4, i * 4 + 4));
    expect(px(0)).toEqual([0, 0, 0, 0]); // 零值堆命中透明首档——不上色、底图透出
    expect(px(1)[3]).toBe(255); // 中度档正常着色（透明档不牵连取样位置）
    expect(px(2)[3]).toBe(255); // 极强档（≥4000 外延末档）
    expect(px(3)).toEqual([0, 0, 0, 0]); // 缺测透明（既有语义）
  });

  it("渲染形态＝色斑图；等值线留位字段口径在位（500 J/kg、无特值线）", () => {
    expect(capeProfile.renderForm).toBe("filled");
    expect(capeProfile.contours).toBeDefined();
    expect(capeProfile.contours?.interval).toBe(500);
    expect(capeProfile.contours?.highlighted).toEqual([]); // CAPE 无特值线惯例
  });
});
