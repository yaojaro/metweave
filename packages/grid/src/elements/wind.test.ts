/**
 * wind（10m 风）要素档案单测：双分量合成口径（variable WIND 对齐合成场、层/单位沿
 * 分量头）、暖色渐进色带形态（YlOrBr 七段低浅高深）、等距固定域 [0,32]×4 m/s×8 档
 * （断点全 4 倍数、0 物理下界、蒲福 12 级 32.7 落上外延档）、分位不立（单一推荐）、
 * renderForm "filled+barbs" 与风向杆口径（step 10／calmThreshold 1）＋等值线 4 m/s
 * 留位、渲染像素方向（合成风速低浅高深）＋杆位集成（windBarbsOf 按档案口径）——
 * 档案是色标与档位的单一事实来源，本测试锁其口径不被无意改动。
 */
import { describe, expect, it } from "vitest";
import {
  windProfile,
  buildColorScale,
  equalStepBreaks,
  windBarbsOf,
  windSpeedGrid,
  renderToImageData,
  type Grid,
  type GridStats,
} from "../index";

/**
 * 中国域窗 windu/windv_cn.mwgrid 双场**合成风速**实测 stats（2026-10-06T18Z f000：
 * √(u²+v²) 现算——min 0.008–max 20.44 m/s、p50 2.56；u/v 分量各自 −13.88–15.87／
 * −20.14–11.46 有符号，不作独立色斑）。档案色标消费的是合成场 stats（装载期
 * windSpeedGrid 现算入头），非分量 stats。
 */
const CN_SPEED_STATS: GridStats = {
  min: 0.008281614631414413,
  max: 20.43553352355957,
  p10: 0.8353166580200195,
  p25: 1.410438060760498,
  p50: 2.558358907699585,
  p75: 4.789395332336426,
  p90: 7.73383092880249,
  p99: 12.125712394714355,
};

/** 最小网格工厂：u/v 同几何成对产出（风向杆/合成集成用）。 */
const pairOf = (uValues: number[], vValues: number[], nx: number, ny: number): [Grid, Grid] => {
  const headerOf = (variable: string, values: number[]): Grid => ({
    header: {
      version: 1,
      variable,
      level: "10m",
      unit: "m s-1",
      grid: { nx, ny, la0: 44, lo0: 100, di: 1, dj: 1, order: "N2S,W2E,row-major" },
      stats: CN_SPEED_STATS,
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
  return [headerOf("UGRD", uValues), headerOf("VGRD", vValues)];
};

/** 十六进制色 → RGB。 */
const rgbOf = (hex: string): [number, number, number] => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
];

/** 相对亮度（YlOrBr 单色渐进的单调性判据：低档亮、高档暗）。 */
const lumaOf = (hex: string): number => {
  const [r, g, b] = rgbOf(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b;
};

/** 21 格一行（0/10/20 位取定值、其余填 1）——step 10 抽稀格位断言的取值工厂。 */
const rowOf = (a: number, b: number, c: number): number[] =>
  Array.from({ length: 21 }, (_, i) => (i === 0 ? a : i === 10 ? b : i === 20 ? c : 1));

describe("wind（10m 风）档案", () => {
  it("恒等直读（分量与合成同为 m/s，无换算）；显示单位排版惯例 m/s", () => {
    expect(windProfile.toDisplay(5)).toBe(5);
    expect(windProfile.storageUnit).toBe("m s-1"); // 容器头原串
    expect(windProfile.displayUnit).toBe("m/s");
  });

  it("入档口径：variable WIND 对齐合成场（gen CLI wind 条目 label WIND/10m）、层 10m；短名对齐 gen CLI 键", () => {
    // 分量文件头是 UGRD/VGRD（容器实测），档案 variable 对齐 windSpeedGrid 的合成头
    expect(windProfile.variable).toBe("WIND");
    expect(windProfile.level).toBe("10m");
    // 短名照 gen:grid CLI 的 ELEMENTS 键（「拉最新」中间件原样转发 CLI，键对齐即直通；
    // CLI wind 条目单请求双 message 产 windu/windv 双文件）
    expect(windProfile.shortName).toBe("wind");
    expect(windProfile.labelZh).toBe("10m 风");
  });

  it("色带为 YlOrBr 内七段暖色渐进（低浅黄→高深橙棕、暖主导非发散、裁去最深两档）", () => {
    const stops = windProfile.colorStops;
    expect(stops).toHaveLength(7);
    for (const c of stops) expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
    // 暖主导：每停靠红绿皆明显高于蓝（黄橙棕族——蓝是冷色低位）
    for (const c of stops) {
      const [r, g, b] = rgbOf(c);
      expect(r).toBeGreaterThan(b);
      expect(g).toBeGreaterThan(b);
    }
    // 亮度单调下降（弱风浅、强风深）
    for (let i = 1; i < stops.length; i++) {
      expect(lumaOf(stops[i]!)).toBeLessThan(lumaOf(stops[i - 1]!));
    }
    expect(lumaOf(stops[6]!)).toBeGreaterThan(40); // 浅纪律：最深档 #cc4c02 深橙可读非墨色
    expect(rgbOf(stops[6]!)[0]).toBeGreaterThan(rgbOf(stops[6]!)[2]); // 深端仍暖主导
  });

  it("等距固定域 [0,32]×4 m/s×8 档：断点全 4 倍数、0 物理下界、域含本窗极值且蒲福 12 级落上外延档", () => {
    const equal = windProfile.equal!;
    expect(equal).toEqual({ min: 0, max: 32, bins: 8 });
    const scale = buildColorScale(windProfile, CN_SPEED_STATS);
    expect(scale.breaks).toEqual(equalStepBreaks(0, 32, 8));
    expect(scale.breaks).toEqual([4, 8, 12, 16, 20, 24, 28]);
    expect(scale.colors).toBe(windProfile.colorStops);
    expect(scale.transparentBins).toBeUndefined(); // 风速无「无信号」档（静风是弱信号照画浅色）
    expect(scale.logScale).toBeUndefined();
    // 域容纳：本窗实测 max 20.44 在域内；蒲福 12 级界 32.7 落上外延档 [32,∞)（台风极端同色兜底）
    expect(CN_SPEED_STATS.max).toBeLessThan(32);
    expect(32.7).toBeGreaterThan(32);
  });

  it("不立分位推荐（风速无业务分位口径，可比性锚是固定档界——单一推荐）", () => {
    expect(windProfile.quantile).toBeUndefined();
    expect(windProfile.defaultMode).toBe("equal");
  });

  it("渲染形态＝filled+barbs；杆口径 step 10（2.5° 一根）＋静风阈 1 m/s；等值线 4 m/s 留位", () => {
    expect(windProfile.renderForm).toBe("filled+barbs");
    expect(windProfile.barbs).toEqual({ step: 10, calmThreshold: 1 });
    // 等值线留位（表 B 等值线列「无」；若接线 4 m/s 恰与填色档界重合）
    expect(windProfile.contours).toEqual({ interval: 4, highlighted: [] });
  });

  it("渲染集成：合成场沿档暖色渐进（低=浅亮、高=深暗），全域着色（静风照画浅色）", () => {
    // 一行四值合成风速 0.5/4/12/20 → 档 0/1/3/5（浅黄→中黄→橙→深橙棕）
    const [u, v] = pairOf([0.5, 4, 12, 20], [0, 0, 0, 0], 4, 1);
    const speed = windSpeedGrid(u, v);
    const img = renderToImageData(speed, buildColorScale(windProfile, CN_SPEED_STATS), {
      convert: windProfile.toDisplay,
    });
    const luma = (i: number): number => {
      const a = img.data.subarray(i * 4, i * 4 + 4);
      return 0.299 * (a[0] ?? 0) + 0.587 * (a[1] ?? 0) + 0.114 * (a[2] ?? 0);
    };
    expect(luma(0)).toBeGreaterThan(luma(1)); // 弱风浅
    expect(luma(1)).toBeGreaterThan(luma(2));
    expect(luma(2)).toBeGreaterThan(luma(3)); // 强风深
    for (let i = 0; i < 4; i++) {
      expect(img.data[i * 4 + 3]).toBe(255); // 全域着色（无透明档）
    }
  });

  it("杆位集成：档案口径出杆（step 10 抽稀格位、静风阈滤除、方向/速度数学锚）", () => {
    // 21×2 小场（step 10 的格位：列 0/10/20、行 0——中心对齐起点恰为 0）：
    // (0,0) 西风 3 m/s（u=3,v=0）、(10,0) 静风 0.5 m/s（阈值内滤除）、(20,0) 北风 4 m/s（v=−4）
    const [u, v] = pairOf(
      [...rowOf(3, 0.5, 0), ...rowOf(3, 0.5, 0)],
      [...rowOf(0, 0, -4), ...rowOf(0, 0, -4)],
      21,
      2,
    );
    const barbs = windBarbsOf(u, v, windProfile.barbs!);
    expect(barbs).toHaveLength(2); // 静风 0.5 < 1 m/s 不出杆
    const west = barbs[0]!;
    expect(west.direction).toBe(270); // u>0,v=0 向东吹＝西风来向 270
    expect(west.speed).toBeCloseTo(3, 6);
    const north = barbs[1]!;
    expect(north.direction).toBe(0); // v<0 向南吹＝北风来向 0（270−(−90)＝360 归一 0）
    expect(north.speed).toBeCloseTo(4, 6);
  });
});
