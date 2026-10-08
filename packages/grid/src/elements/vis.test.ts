/**
 * vis 要素档案单测：换算口径（m → km ÷1000）、色标合法性（RdYlBu 逆向渐进，低→高＝
 * 差→好——方向断言：首停靠红主导、末停靠蓝主导，写反即红）、阈值档（0.4/0.8/1.5/3/5/10
 * km——航空 METAR tier 同族定档）、满量程哨兵不透明（24130 m＝「≥24.1 km」打包真值，
 * 落最高档正常着色——与 cape/prate 首档透明相反）、末档注记（topBinNote——threshold
 * 档图例的泛化末缘标注，本要素首个消费方）、等值线留位——档案是色标与档位的单一
 * 事实来源，本测试锁其口径不被无意改动。本切片内核零改动（阈值档复用 CAPE 切片能力），
 * 唯一新小件是显示层的末档注记。
 */
import { describe, expect, it } from "vitest";
import {
  visProfile,
  buildColorScale,
  thresholdBreaks,
  binIndexAt,
  renderToImageData,
  type Grid,
  type GridStats,
} from "../index";

/**
 * 中国域窗 vis_cn.mwgrid 容器头实测 stats（2026-10-06T18Z f000：22.47 m–24134.87 m，
 * p25 起全档饱和在满量程哨兵——调研口径 24130 m 的解码落值，「≥24.1 km」语义）。
 */
const CN_STATS: GridStats = {
  min: 22.470609664916992,
  max: 24134.87109375,
  p10: 22970.0703125,
  p25: 24134.87109375,
  p50: 24134.87109375,
  p75: 24134.87109375,
  p90: 24134.87109375,
  p99: 24134.87109375,
};

/** 最小网格工厂（与 cape/prate.test 同构）：值按行序西→东，单位＝存储 m。 */
const tinyGrid = (values: number[]): Grid => ({
  header: {
    version: 1,
    variable: "VIS",
    level: "sfc",
    unit: "m",
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

/** 十六进制色 → RGB（方向断言用） */
const rgbOf = (hex: string): [number, number, number] => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
];

describe("vis 档案", () => {
  it("显示换算 ÷1000（m 存储 → km 显示），换算只在档案层", () => {
    expect(visProfile.toDisplay(0)).toBe(0);
    expect(visProfile.toDisplay(400)).toBe(0.4);
    expect(visProfile.toDisplay(24130)).toBeCloseTo(24.13, 10); // 满量程哨兵（调研口径值）
    expect(visProfile.toDisplay(CN_STATS.max)).toBeCloseTo(24.135, 3); // 实测解码落值
    expect(visProfile.displayUnit).toBe("km");
    expect(visProfile.storageUnit).toBe("m");
  });

  it("入档口径与容器头对齐（VIS/sfc/m——vis_cn.mwgrid 实测）", () => {
    expect(visProfile.variable).toBe("VIS");
    expect(visProfile.level).toBe("sfc");
    expect(visProfile.shortName).toBe("vis");
  });

  it("色带为逆向发散渐进（ColorBrewer RdYlBu，低→高＝差→好：红→蓝），全部合法十六进制", () => {
    const stops = visProfile.colorStops;
    expect(stops.length).toBeGreaterThanOrEqual(5);
    for (const c of stops) expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(stops[0]).toBe("#d73027"); // 差端深红（能见度差=警示色醒目）
    expect(stops.at(-1)).toBe("#4575b4"); // 好端深蓝
    // 逆向方向锁（色带停靠序写反即红）：首停靠红通道显著大于蓝、末停靠相反
    const first = rgbOf(stops[0]!);
    const last = rgbOf(stops.at(-1)!);
    expect(first[0]).toBeGreaterThan(first[2] + 80);
    expect(last[2]).toBeGreaterThan(last[0] + 80);
  });

  it("阈值档：0.4/0.8/1.5/3/5/10 km 严格递增×7 档（METAR 能见度 tier 同族），实测分布落位", () => {
    const thresholds = visProfile.thresholds ?? [];
    expect(thresholds).toEqual([0.4, 0.8, 1.5, 3, 5, 10]);
    const breaks = thresholdBreaks(thresholds);
    expect(breaks).toEqual([0.4, 0.8, 1.5, 3, 5, 10]); // 显式业务阈值原样（不做均分/分位近似）
    // 左闭右开：恰在阈值上的值归上档；两端外延档兜住全域（含满量程哨兵）
    expect(binIndexAt(0.02, breaks)).toBe(0);
    expect(binIndexAt(0.39, breaks)).toBe(0);
    expect(binIndexAt(0.4, breaks)).toBe(1);
    expect(binIndexAt(0.79, breaks)).toBe(1);
    expect(binIndexAt(0.8, breaks)).toBe(2);
    expect(binIndexAt(1.49, breaks)).toBe(2);
    expect(binIndexAt(1.5, breaks)).toBe(3);
    expect(binIndexAt(2.9, breaks)).toBe(3);
    expect(binIndexAt(3, breaks)).toBe(4);
    expect(binIndexAt(4.9, breaks)).toBe(4);
    expect(binIndexAt(5, breaks)).toBe(5);
    expect(binIndexAt(9.9, breaks)).toBe(5);
    expect(binIndexAt(10, breaks)).toBe(6);
    expect(binIndexAt(Number.MAX_VALUE, breaks)).toBe(6);
    // 中国域窗实测分布落位：min 22.47 m（0.02 km）落首档（最差）、p10 22.97 km 落最高档
    // （真实良好能见度）、p25 起至 max 全档饱和在哨兵 24.13 km——同落最高档 [10,∞)
    expect(binIndexAt(visProfile.toDisplay(CN_STATS.min), breaks)).toBe(0);
    expect(binIndexAt(visProfile.toDisplay(CN_STATS.p10), breaks)).toBe(6);
    expect(binIndexAt(visProfile.toDisplay(CN_STATS.p25), breaks)).toBe(6);
    expect(binIndexAt(visProfile.toDisplay(CN_STATS.max), breaks)).toBe(6);
  });

  it("满量程哨兵不透明：无透明档声明，24.13 km 落最高档正常着色（与 cape/prate 首档透明相反）", () => {
    expect(visProfile.transparentBins).toBeUndefined(); // 打包真值非缺测——不透明
    expect(visProfile.logScale).toBeUndefined(); // 线性定档（值域不跨量级）
    const scale = buildColorScale(visProfile, CN_STATS);
    expect(scale.breaks).toEqual([0.4, 0.8, 1.5, 3, 5, 10]);
    expect(scale.colors).toBe(visProfile.colorStops);
    expect(scale.transparentBins).toBeUndefined();
    // 集成断言（convert=toDisplay 进 km 后定档）：哨兵值（24.13 km，本窗 88% 像素）、
    // 300 m（0.3 km 最差档）、12000 m（12 km 真实良好）、NaN（缺测）
    const img = renderToImageData(tinyGrid([24134.87109375, 300, Number.NaN, 12000]), scale, {
      convert: visProfile.toDisplay,
    });
    const px = (i: number): readonly number[] => Array.from(img.data.subarray(i * 4, i * 4 + 4));
    const [sentinelR, , sentinelB, sentinelA] = px(0);
    const [worstR, , worstB, worstA] = px(1);
    expect(sentinelA).toBe(255); // 满量程哨兵＝「极好能见度」真值：不透明正常着色
    expect(sentinelB!).toBeGreaterThan(sentinelR!); // 且是末档深蓝（逆向方向在渲染像素可见）
    expect(worstA).toBe(255); // 最差档正常着色
    expect(worstR!).toBeGreaterThan(worstB!); // 首档红色主导（差=红）
    expect(px(2)).toEqual([0, 0, 0, 0]); // 缺测透明（既有语义——哨兵不透明不牵连它）
    expect(px(3)).toEqual(px(0)); // 12 km 真值与哨兵同档同色（同为 [10,∞) 最高档）
  });

  it("不立等距/分位推荐（p25 起饱和的分位档全塌最高档失效；阈值档要素单一推荐模式）", () => {
    expect(visProfile.equal).toBeUndefined();
    expect(visProfile.quantile).toBeUndefined();
    expect(visProfile.defaultMode).toBe("threshold");
  });

  it("末档注记在档（topBinNote＝「≥24.1（满量程）」——threshold 图例末缘标注的泛化数据位）", () => {
    expect(visProfile.topBinNote).toBe("≥24.1（满量程）");
    // 注记值与哨兵换算口径自洽：24130 m → 24.13 km，一位小数即注记的「24.1」
    expect(Math.round(visProfile.toDisplay(24130) * 10) / 10).toBeCloseTo(24.1, 10);
  });

  it("渲染形态＝色斑图；等值线留位字段口径在位（1 km、无特值线）", () => {
    expect(visProfile.renderForm).toBe("filled");
    expect(visProfile.contours).toBeDefined();
    expect(visProfile.contours?.interval).toBe(1);
    expect(visProfile.contours?.highlighted).toEqual([]); // 能见度无特值线惯例
  });
});
