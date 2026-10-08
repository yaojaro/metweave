/**
 * prmsl 要素档案单测：换算口径（Pa→hPa ÷100）、入档头对齐（PRMSL/msl——容器头实测）、
 * 浅填色色带形态（RdBu 内七段：低蓝高红、白心钉 1014 hPa 档心）、等距档与等值线对齐
 * （固定域端点与全部断点均为 4 hPa 整数倍——填色档界即等值线位）、等值线口径
 * （4 hPa 常规＋2 hPa 加密＋无特值线）与渲染形态（filled+contours）、等值线几何集成
 * （真实口径在小场上的线值/线种）、L/H 中心检测集成——档案是色标与档位的单一事实
 * 来源，本测试锁其口径不被无意改动。
 */
import { describe, expect, it } from "vitest";
import {
  prmslProfile,
  buildColorScale,
  equalStepBreaks,
  contoursOf,
  centersOf,
  renderToImageData,
  type Grid,
  type GridStats,
} from "../index";

/**
 * 中国域窗 prmsl_cn.mwgrid 容器头实测 stats（2026-10-06T18Z f000：1000.63–1039.67 hPa，
 * p50 1015.28——连续场，低压中心＝内容锚；Pa 存储值）。
 */
const CN_STATS: GridStats = {
  min: 100062.890625,
  max: 103966.6953125,
  p10: 101140.6953125,
  p25: 101298.890625,
  p50: 101528.09375,
  p75: 102080.296875,
  p90: 102355.09375,
  p99: 102813.890625,
};

/** 最小网格工厂（与 vis/refc.test 同构）：值按行序西→东，单位＝存储 Pa。 */
const tinyGrid = (values: number[], nx = 2, ny = 2): Grid => ({
  header: {
    version: 1,
    variable: "PRMSL",
    level: "msl",
    unit: "Pa",
    grid: { nx, ny, la0: 40, lo0: 100, di: 1, dj: 1, order: "N2S,W2E,row-major" },
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

/** 十六进制色 → RGB。 */
const rgbOf = (hex: string): [number, number, number] => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
];

describe("prmsl 档案", () => {
  it("显示换算 Pa→hPa（÷100，换算只在档案层——转换器不动数值语义）", () => {
    expect(prmslProfile.toDisplay(100062.890625)).toBeCloseTo(1000.62890625, 10);
    expect(prmslProfile.toDisplay(103966.6953125)).toBeCloseTo(1039.666953125, 10);
    expect(prmslProfile.storageUnit).toBe("Pa"); // 容器头原串
    expect(prmslProfile.displayUnit).toBe("hPa");
  });

  it("入档口径与容器头对齐（PRMSL/msl——prmsl_cn.mwgrid 实测，mean sea level）", () => {
    expect(prmslProfile.variable).toBe("PRMSL");
    expect(prmslProfile.level).toBe("msl");
    expect(prmslProfile.shortName).toBe("prmsl");
    expect(prmslProfile.labelZh).toBe("海平面气压");
  });

  it("色带为 RdBu 内七段浅填色（低蓝→白→高红），中位白停靠、无深饱和端", () => {
    const stops = prmslProfile.colorStops;
    expect(stops).toHaveLength(7);
    for (const c of stops) expect(c).toMatch(/^#[0-9a-fA-F]{6}$/);
    const first = rgbOf(stops[0]!); // 低端浅蓝（蓝主导）
    const mid = rgbOf(stops[3]!); // 中位＝近白（1014 hPa 档心）
    const last = rgbOf(stops[6]!); // 高端浅红（红主导、非深饱和）
    expect(first[2]).toBeGreaterThan(first[0] + 30);
    expect(mid[0]).toBe(mid[2]); // 白心（RdBu #f7f7f7）
    expect(last[0]).toBeGreaterThan(last[2] + 30);
    expect(last[0]).toBeLessThan(225); // 裁去最外深色对（#b2182b 一族不上场）——浅填色
  });

  it("等距固定域 [984,1044]×4 hPa×15 档：全部断点为 4 的倍数（档界即等值线位）", () => {
    const equal = prmslProfile.equal!;
    expect(equal).toEqual({ min: 984, max: 1044, bins: 15 });
    const scale = buildColorScale(prmslProfile, CN_STATS);
    expect(scale.breaks).toEqual(equalStepBreaks(984, 1044, 15));
    expect(scale.breaks).toHaveLength(14);
    for (const b of scale.breaks) {
      expect(b % 4).toBe(0); // 档界与 4 hPa 常规等值线天然对齐（域端点为 4 的倍数）
    }
    expect(scale.breaks[0]).toBe(988);
    expect(scale.breaks[13]).toBe(1040);
    expect(scale.colors).toBe(prmslProfile.colorStops);
    expect(scale.transparentBins).toBeUndefined(); // 等值线主导：全域浅填色、无透明档
    expect(scale.logScale).toBeUndefined();
  });

  it("不立分位推荐（分位断点不落 4 hPa 倍数、与等值线错位失去对齐价值——单一推荐）", () => {
    expect(prmslProfile.quantile).toBeUndefined();
    expect(prmslProfile.defaultMode).toBe("equal");
  });

  it("渲染形态＝filled+contours（等值线主导）；等值线口径 4 hPa 常规＋2 hPa 加密＋无特值线", () => {
    expect(prmslProfile.renderForm).toBe("filled+contours");
    expect(prmslProfile.contours).toBeDefined();
    expect(prmslProfile.contours?.interval).toBe(4);
    expect(prmslProfile.contours?.minorInterval).toBe(2);
    expect(prmslProfile.contours?.highlighted).toEqual([]); // 气压无 tmp 0°C/gh 5880 类锚线
  });

  it("渲染集成：色斑像素方向（低＝蓝向、高＝红向、1014 附近白），白心恰落档 7 中心", () => {
    // 一行四值（Pa）：996（低）/1014（白心）/1020（暖）/1040（强暖）→ 档 3/7/9/14
    const img = renderToImageData(
      tinyGrid([99600, 101400, 102000, 104000], 4, 1),
      buildColorScale(prmslProfile, CN_STATS),
      { convert: prmslProfile.toDisplay },
    );
    const rgbaAt = (i: number): [number, number, number, number] => {
      const a = img.data.subarray(i * 4, i * 4 + 4);
      return [a[0] ?? 0, a[1] ?? 0, a[2] ?? 0, a[3] ?? 0];
    };
    const low = rgbaAt(0);
    const white = rgbaAt(1);
    const warm = rgbaAt(2);
    const hot = rgbaAt(3);
    expect(low[2]).toBeGreaterThan(low[0]); // 低端蓝主导
    expect(white[0]).toBe(white[2]); // 1014 hPa 恰落中位白停靠（t=(7+0.5)/15=0.5）
    expect(warm[0]).toBeGreaterThan(warm[2]); // 高端红主导（RdBu 红侧随档加深）
    expect(hot[0]).toBeGreaterThan(hot[2]);
    for (let i = 0; i < 4; i++) expect(rgbaAt(i)[3]).toBe(255); // 全域着色（无透明档）
  });

  it("等值线集成：真实口径在小场上出 4 的倍数常规线与 2 的奇倍数加密线", () => {
    // 1×8 行（Pa→hPa 996..1010 步 2）：threshold (996,1010) 内 2 倍数＝998..1008
    const grid = tinyGrid([99600, 99800, 100000, 100200, 100400, 100600, 100800, 101000], 8, 1);
    const lines = contoursOf(grid, prmslProfile.contours!, prmslProfile.toDisplay);
    expect(lines.map((l) => l.value)).toEqual([998, 1000, 1002, 1004, 1006, 1008]);
    expect(lines.map((l) => l.kind)).toEqual([
      "minor",
      "major",
      "minor",
      "major",
      "minor",
      "major",
    ]);
  });

  it("L/H 中心集成：坑场出一个 low（hPa 值）、倒坑场出一个 high（对称）", () => {
    const bowl: number[] = [];
    const dome: number[] = [];
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        const d = Math.max(Math.abs(y - 4), Math.abs(x - 4));
        bowl.push((1000 + d * 3) * 100); // Pa 存储
        dome.push((1012 - d * 3) * 100);
      }
    }
    const lows = centersOf(tinyGrid(bowl, 9, 9), {
      convert: prmslProfile.toDisplay,
      radius: 3,
    }).filter((c) => c.kind === "low");
    expect(lows).toHaveLength(1);
    expect(lows[0]?.value).toBe(1000); // hPa（显示空间检测）
    const highs = centersOf(tinyGrid(dome, 9, 9), {
      convert: prmslProfile.toDisplay,
      radius: 3,
    }).filter((c) => c.kind === "high");
    expect(highs).toHaveLength(1);
    expect(highs[0]?.value).toBe(1012);
  });
});
